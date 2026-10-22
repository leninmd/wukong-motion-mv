#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_audio.py — 旁白（edge-tts）+ 程序化配乐 + 音效 + 混音

  python audio/build_audio.py            # 生成 output/audio/mix.wav
  python audio/build_audio.py --tts-only # 只生成旁白并打印每句时长

规则：
  · 旁白时间点来自 storyboard.json 的 narration[].start
  · 音乐/音效全部用 numpy 合成，确定性（固定随机种子）
  · 旁白期间自动 duck 音乐 -6dB 左右
"""
import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")
CACHE = os.path.join(ROOT, "audio", "cache")
OUT = os.path.join(ROOT, "output", "audio")

sys.path.insert(0, os.path.join(ROOT, "render"))


# --------------------------------------------------------------------------
# 1. 旁白
# --------------------------------------------------------------------------
async def _tts_one(text, voice, rate, pitch, path):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await comm.save(path)


def tts(text, voice, rate, pitch):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.md5(f"{text}|{voice}|{rate}|{pitch}".encode()).hexdigest()[:12]
    mp3 = os.path.join(CACHE, f"{key}.mp3")
    if not os.path.exists(mp3):
        asyncio.run(_tts_one(text, voice, rate, pitch, mp3))
    return mp3


def decode(path):
    """任意音频 → 48k 单声道 float32"""
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim(x, thresh=0.006, pad=0.06):
    a = np.abs(x)
    idx = np.where(a > thresh)[0]
    if len(idx) == 0:
        return x
    s = max(0, idx[0] - int(pad * SR))
    e = min(len(x), idx[-1] + int(pad * SR))
    return x[s:e]


# --------------------------------------------------------------------------
# 2. 合成器
# --------------------------------------------------------------------------
rng = np.random.default_rng(20241020)


def env_adsr(n, a=0.01, d=0.2, s=0.6, r=0.3):
    t = np.linspace(0, 1, n, endpoint=False)
    e = np.ones(n)
    ai = max(1, int(a * n)); di = max(1, int(d * n)); ri = max(1, int(r * n))
    e[:ai] = np.linspace(0, 1, ai)
    e[ai:ai + di] = np.linspace(1, s, min(di, n - ai))
    e[ai + di:] = s
    if ri < n:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def karplus(freq, dur, amp=0.3, bright=0.5, seed=0):
    """Karplus-Strong 拨弦（古琴/琵琶的近似）"""
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    d = max(2, int(SR / freq))
    r = np.random.default_rng(seed)
    buf = r.uniform(-1, 1, d).astype(np.float64)
    # 低通初始化（控制明亮度）
    buf = buf * (1 - bright) + np.concatenate(([buf[0]], buf[:-1])) * bright
    out = np.zeros(n, dtype=np.float64)
    idx = 0
    decay = 0.996 - 0.004 * (d / 200.0)
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % d
        buf[idx] = 0.5 * (buf[idx] + buf[nxt]) * decay
        idx = nxt
    e = env_adsr(n, 0.004, 0.12, 0.55, min(0.5, dur * 0.5))
    return (out * e * amp).astype(np.float32)


def pad(freq, dur, amp=0.12, detune=0.004, attack=1.2, release=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k, (mul, a) in enumerate([(1.0, 1.0), (1.5, 0.45), (2.0, 0.22), (1.005, 0.7), (1.498, 0.3)]):
        f = freq * mul + detune * freq * (k - 2)
        sig += a * np.sin(2 * np.pi * f * t + k)
        sig += a * 0.15 * np.sin(2 * np.pi * f * 2 * t + k * 0.7)
    sig /= 3.2
    e = np.ones(n)
    ai = min(n, int(attack * SR)); ri = min(n, int(release * SR))
    if ai > 0: e[:ai] = np.linspace(0, 1, ai) ** 1.6
    if ri > 0: e[-ri:] *= np.linspace(1, 0, ri) ** 1.2
    return (sig * e * amp).astype(np.float32)


def noise_band(dur, lo, hi, amp=0.1, seed=0):
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    r = np.random.default_rng(seed)
    x = r.standard_normal(n)
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mask = np.exp(-0.5 * ((np.log(np.maximum(freqs, 1)) - np.log((lo + hi) / 2)) / max(0.2, (np.log(hi) - np.log(lo)) / 2.4)) ** 2)
    y = np.fft.irfft(X * mask, n)
    y = y / (np.max(np.abs(y)) + 1e-9)
    return (y * amp).astype(np.float32)


def boom(dur=1.6, amp=0.5, f0=70, f1=28):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 3.2)
    click = noise_band(dur, 80, 900, 0.15, seed=7)[:n] * np.exp(-t * 22)
    return ((sig * 0.9 + click) * amp).astype(np.float32)


def heartbeat(n_beats, dur, amp=0.22):
    one = boom(0.42, amp, 62, 34)
    out = np.zeros(int(dur * SR), dtype=np.float32)
    for i in range(n_beats):
        st = int((0.5 + i * 1.05) * SR)
        if st + len(one) < len(out):
            out[st:st + len(one)] += one
    return out


class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((self.n, 2), dtype=np.float32)

    def add(self, sig, at, gain=1.0, pan=0.0):
        if sig is None or len(sig) == 0:
            return
        st = int(at * SR)
        if st >= self.n:
            return
        m = min(len(sig), self.n - st)
        l = np.sqrt((1 - pan) / 2 + 0.5 * (1 - abs(pan)) * 0 + (1 - pan) * 0.5)
        # 等功率声像
        th = (pan + 1) * np.pi / 4
        gl, gr = np.cos(th), np.sin(th)
        self.buf[st:st + m, 0] += sig[:m] * gain * gl
        self.buf[st:st + m, 1] += sig[:m] * gain * gr

    def finish(self):
        x = self.buf
        # 轻压缩 + 归一
        peak = np.max(np.abs(x)) + 1e-9
        x = np.tanh(x * 1.15) * 0.92
        peak = np.max(np.abs(x)) + 1e-9
        return (x / peak * 0.89).astype(np.float32)


# --------------------------------------------------------------------------
# 3. 配乐
# --------------------------------------------------------------------------
NOTES = {
    'D2': 73.42, 'A2': 110.0, 'F2': 87.31, 'G2': 98.0,
    'D3': 146.83, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0, 'C4': 261.63,
    'D4': 293.66, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0, 'C5': 523.25,
    'D5': 587.33
}


def build_music(dur):
    m = Mix(dur)
    # 底层持续音（开场就有低频涌动，不要死寂）
    m.add(pad(NOTES['D2'], 6.0, 0.16, attack=1.6, release=3.4), 0.0, 1.0, -0.05)
    m.add(pad(NOTES['A2'], 5.0, 0.07, attack=2.2, release=2.6), 0.4, 1.0, 0.1)
    m.add(karplus(NOTES['D3'], 4.0, 0.09, 0.35, seed=201), 1.55, 1.0, 0.0)
    m.add(pad(NOTES['D2'], 14, 0.10, attack=3.0, release=4.0), 1.2, 1.0, -0.1)
    m.add(pad(NOTES['A2'], 12, 0.07, attack=2.0, release=3.5), 2.5, 1.0, 0.15)
    m.add(pad(NOTES['F2'], 12, 0.085, attack=2.4, release=3.0), 13.0, 1.0, -0.15)
    m.add(pad(NOTES['D3'], 10, 0.06, attack=2.0, release=3.0), 24.0, 1.0, 0.1)
    m.add(pad(NOTES['F2'], 14, 0.07, attack=2.6, release=3.4), 33.0, 1.0, -0.1)
    m.add(pad(NOTES['D2'], 9, 0.085, attack=1.6, release=2.4), 46.5, 1.0, 0.0)
    m.add(pad(NOTES['A2'], 9, 0.05, attack=1.2, release=2.0), 55.0, 1.0, 0.0)
    m.add(pad(NOTES['D3'], 8, 0.07, attack=2.2, release=2.6), 63.6, 1.0, 0.0)
    m.add(pad(NOTES['D2'], 12, 0.09, attack=1.4, release=4.5), 69.6, 1.0, 0.0)

    # 拨弦：开场稀疏
    seq1 = [('D4', 3.2, 0.16), ('A3', 4.9, 0.13), ('F4', 6.6, 0.12), ('C4', 8.3, 0.13),
            ('D4', 10.2, 0.11), ('A3', 11.8, 0.10)]
    for i, (n, t, a) in enumerate(seq1):
        m.add(karplus(NOTES[n], 3.2, a, 0.45, seed=i), t, 1.0, -0.2 + 0.1 * (i % 3))

    # 夜雨段：低沉、稀疏
    seq2 = [('D3', 14.6, 0.12), ('A2', 17.4, 0.10), ('F3', 19.8, 0.09), ('D3', 22.0, 0.10)]
    for i, (n, t, a) in enumerate(seq2):
        m.add(karplus(NOTES[n], 4.0, a, 0.25, seed=20 + i), t, 1.0, 0.1 * (-1) ** i)

    # 江面段：流动的五声音阶
    seq3 = [('G3', 25.0, 0.10), ('A3', 26.2, 0.09), ('C4', 27.4, 0.10), ('D4', 28.6, 0.09),
            ('A3', 30.0, 0.08), ('G3', 31.4, 0.09)]
    for i, (n, t, a) in enumerate(seq3):
        m.add(karplus(NOTES[n], 2.6, a, 0.5, seed=40 + i), t, 1.0, -0.12 + 0.12 * (i % 3))

    # 家书 → 孤舟
    seq4 = [('F3', 33.6, 0.10), ('A3', 35.2, 0.09), ('C4', 37.0, 0.10), ('D4', 39.0, 0.09),
            ('F4', 41.0, 0.08), ('A4', 43.2, 0.07)]
    for i, (n, t, a) in enumerate(seq4):
        m.add(karplus(NOTES[n], 3.6, a, 0.4, seed=60 + i), t, 1.0, 0.16 - 0.16 * (i % 2))

    # 长卷：温和的分解和弦
    seq5 = [('D4', 47.4, 0.10), ('F4', 48.8, 0.09), ('A4', 50.2, 0.09), ('G4', 51.6, 0.08),
            ('F4', 53.0, 0.08)]
    for i, (n, t, a) in enumerate(seq5):
        m.add(karplus(NOTES[n], 3.0, a, 0.5, seed=80 + i), t, 1.0, -0.1 + 0.1 * (i % 2))

    # 终章：极稀疏，收束
    seq6 = [('D4', 70.6, 0.08), ('A3', 73.4, 0.07), ('F4', 76.6, 0.06), ('D4', 79.6, 0.06),
            ('A3', 82.2, 0.05)]
    for i, (n, t, a) in enumerate(seq6):
        m.add(karplus(NOTES[n], 4.2, a, 0.42, seed=100 + i), t, 1.0, 0.12 * (-1) ** i)
    m.add(pad(NOTES['D2'], 5.0, 0.10, attack=0.6, release=3.8), 82.0, 1.0, 0.0)

    # 雨、风、水
    rain = noise_band(9.0, 900, 7000, 0.045, seed=3)
    m.add(rain, 14.6, 1.0, -0.2)
    m.add(noise_band(9.0, 300, 1600, 0.035, seed=4), 14.9, 1.0, 0.2)
    m.add(noise_band(11.0, 200, 900, 0.030, seed=5), 24.4, 1.0, -0.15)   # 江风
    m.add(noise_band(8.0, 180, 700, 0.026, seed=6), 39.2, 1.0, 0.15)     # 夜江

    # 章节重音
    for i, tt in enumerate([4.4, 13.5, 23.5, 33.2, 37.8, 54.8, 65.9, 70.9]):
        m.add(boom(1.8, 0.34 if tt not in (54.9,) else 0.22), tt, 1.0, 0.0)

    # ---- V2 音效卡点（视觉落点前 2–3 帧） ----
    # 印章砸落：1.0 / 8.0 / 50.0 / 83.0
    for tt, amp in [(0.94, 0.42), (7.94, 0.36), (49.94, 0.34), (82.94, 0.40)]:
        m.add(boom(1.5, amp, 78, 30), tt, 1.0, 0.0)
        m.add(noise_band(0.5, 120, 2200, 0.12, seed=int(tt * 10)), tt, 1.0, 0.0)
    # 秋风与竹叶（14.0–19.5）
    m.add(noise_band(6.0, 500, 5200, 0.075, seed=31), 13.9, 1.0, -0.25)
    m.add(noise_band(6.0, 250, 1400, 0.05, seed=32), 14.2, 1.0, 0.25)
    # 红线劈下 + 子弹时间：低频下坠
    m.add(boom(2.6, 0.46, 120, 22), 19.94, 1.0, 0.0)
    m.add(pad(NOTES['D2'], 4.5, 0.10, attack=0.02, release=3.6), 20.0, 1.0, 0.0)
    # 文字刚体砸地（58.5–61.0）
    for i, tt in enumerate([58.5, 58.75, 59.05, 59.4, 60.4, 60.55, 60.7, 60.85, 61.0]):
        m.add(boom(0.6, 0.16 + 0.02 * (i % 3), 110, 45), tt, 1.0, -0.3 + 0.075 * i)
        m.add(noise_band(0.22, 150, 2600, 0.09, seed=50 + i), tt, 1.0, -0.3 + 0.075 * i)
    # 四张卡牌翻转（66.2 起，每 6 帧错落）
    for i, tt in enumerate([66.20, 66.30, 66.40, 66.50]):
        m.add(noise_band(0.12, 1400, 8000, 0.12, seed=70 + i), tt, 1.0, -0.24 + 0.16 * i)
        m.add(boom(0.30, 0.09, 220, 90), tt + 0.01, 1.0, -0.24 + 0.16 * i)
    # 「打成了诗史」重击（67.44）
    m.add(boom(1.4, 0.30, 90, 34), 67.42, 1.0, 0.0)

    # 细节音效
    # 落第朱印：闷响
    m.add(boom(1.1, 0.30, 90, 40), 5.02, 1.0, 0.0)
    m.add(noise_band(0.35, 200, 2600, 0.10, seed=11), 5.00, 1.0, 0.0)
    # 红圈：纸上划过的沙沙
    m.add(noise_band(0.75, 1200, 6000, 0.055, seed=12), 9.18, 1.0, -0.15)
    # 翻页/掀起纸
    m.add(noise_band(0.9, 600, 5000, 0.05, seed=13), 23.62, 1.0, 0.2)
    # 金球与信纸的高频微光
    m.add(noise_band(3.2, 2500, 9000, 0.028, seed=14), 33.4, 1.0, -0.2)
    # 粒子聚合的细碎声
    m.add(noise_band(2.2, 1500, 8000, 0.035, seed=15), 47.0, 1.0, 0.1)
    # 翻牌三连（67s 前后）
    for i, tt in enumerate([66.95, 67.12, 67.30, 67.48]):
        m.add(noise_band(0.10, 900, 7000, 0.10, seed=20 + i), tt, 1.0, -0.3 + 0.2 * i)
        m.add(boom(0.35, 0.10, 160, 80), tt + 0.01, 1.0, -0.3 + 0.2 * i)
    # 落版的低频余响
    m.add(boom(3.0, 0.22, 55, 26), 81.6, 1.0, 0.0)

    # 崩塌段的心跳
    m.add(heartbeat(6, 8.6, 0.16), 55.2, 1.0, 0.0)

    return m.buf


# --------------------------------------------------------------------------
# 4. 主流程
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tts-only", action="store_true")
    args = ap.parse_args()

    story = json.load(open(os.path.join(ROOT, "storyboard.json"), encoding="utf-8"))
    dur = story["duration"]
    os.makedirs(OUT, exist_ok=True)

    m = Mix(dur)
    voice_buf = np.zeros(m.n, dtype=np.float32)

    print("=== 旁白 ===")
    vdefault = story.get("voice") or {}
    for line in story["narration"]:
        mp3 = tts(line["text"],
                  line.get("voice") or vdefault.get("name", "zh-CN-YunjianNeural"),
                  line.get("rate") or vdefault.get("rate", "-8%"),
                  line.get("pitch") or vdefault.get("pitch", "-2Hz"))
        x = trim(decode(mp3))
        d = len(x) / SR
        print(f"  {line['id']}  start={line['start']:6.2f}s  dur={d:5.2f}s  end={line['start']+d:6.2f}s")
        st = int(line["start"] * SR)
        mm = min(len(x), m.n - st)
        voice_buf[st:st + mm] += x[:mm] * 1.0

    if args.tts_only:
        return

    # 归一化旁白
    peak = np.max(np.abs(voice_buf)) + 1e-9
    voice_buf = voice_buf / peak * 0.72

    print("=== 配乐 ===")
    music = build_music(dur)

    # ducking：旁白包络
    env = np.abs(voice_buf)
    win = int(0.18 * SR)
    kern = np.ones(win) / win
    env = np.convolve(env, kern, mode="same")
    env = np.clip(env / (np.max(env) + 1e-9) * 3.2, 0, 1)
    duck = 1 - 0.55 * env

    music = music * duck[:, None] * 0.55
    mix = music.copy()
    mix[:, 0] += voice_buf
    mix[:, 1] += voice_buf

    # 母带：轻限幅
    peak = np.max(np.abs(mix)) + 1e-9
    if peak > 0.95:
        mix = mix / peak * 0.95
    mix = np.tanh(mix * 1.05) * 0.94
    p2 = np.max(np.abs(mix)) + 1e-9
    mix = (mix / p2 * 0.92).astype(np.float32)

    out = os.path.join(OUT, "mix.wav")
    pcm = (mix * 32767).astype(np.int16)
    with open(out, "wb") as f:
        f.write(b"RIFF")
        f.write((36 + len(pcm.tobytes())).to_bytes(4, "little"))
        f.write(b"WAVEfmt ")
        f.write((16).to_bytes(4, "little"))
        f.write((1).to_bytes(2, "little"))
        f.write((2).to_bytes(2, "little"))
        f.write(SR.to_bytes(4, "little"))
        f.write((SR * 2 * 2).to_bytes(4, "little"))
        f.write((4).to_bytes(2, "little"))
        f.write((16).to_bytes(2, "little"))
        f.write(b"data")
        f.write(len(pcm.tobytes()).to_bytes(4, "little"))
        f.write(pcm.tobytes())
    print("wrote", out, f"{dur:.1f}s")


if __name__ == "__main__":
    main()
