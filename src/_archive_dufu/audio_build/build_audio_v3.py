#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_audio_v3.py — V3 音轨：**零旁白**，只有环境层 + 打击点 + 留白。

情绪结构（与 storyboard.v3.json 对齐）：
  S01 0–10   麻纸/墨：近乎静默，2.0s 一声低频金铁坠纸 + 古磬
  S02 10–24  高山风：风啸 + 排箫单音
  S03 24–38  荣枯：笙歌骤然掐断 → 铜门闭锁重击 → 暴风雪
  S04 38–54  广厦：暴雨黑矛 → 41.5s 全静（2s 真空）→ 洪钟古磬 + 金光低频
  S05 54–68  峡江：40Hz 江涛 + 枯叶裂空
  S06 68–82  平野：几乎无声，只剩水拍 + 一声鸟鸣 + 尺八长音
  S07 82–98  劫难：巨石坠地 → 91.0–98.0 七秒绝对静默（audio blackout）
  S08 98–110 丰碑：地火低鸣 → 青铜大钟
  S09 110–120 终章：风雪渐微 + 远寺钟声，余音收在 120s
"""
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = 120.0
OUT = os.path.join(ROOT, "output", "audio")

rng = np.random.default_rng(20241021)
NOTES = {
    'D1': 36.71, 'A1': 55.0, 'D2': 73.42, 'A2': 110.0, 'F2': 87.31, 'G2': 98.0,
    'D3': 146.83, 'F3': 174.61, 'G3': 196.0, 'A3': 220.0, 'C4': 261.63,
    'D4': 293.66, 'F4': 349.23, 'A4': 440.0
}


def env_adsr(n, a=0.01, d=0.2, s=0.6, r=0.3):
    e = np.ones(n)
    ai = max(1, int(a * n)); di = max(1, int(d * n)); ri = max(1, int(r * n))
    e[:ai] = np.linspace(0, 1, ai)
    e[ai:ai + di] = np.linspace(1, s, min(di, n - ai))
    e[ai + di:] = s
    if ri < n:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def karplus(freq, dur, amp=0.3, bright=0.5, seed=0):
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    d = max(2, int(SR / freq))
    r = np.random.default_rng(seed)
    buf = r.uniform(-1, 1, d)
    buf = buf * (1 - bright) + np.concatenate(([buf[0]], buf[:-1])) * bright
    out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        nxt = (idx + 1) % d
        buf[idx] = 0.5 * (buf[idx] + buf[nxt]) * 0.996
        idx = nxt
    return (out * env_adsr(n, 0.004, 0.12, 0.55, min(0.6, dur * 0.6)) * amp).astype(np.float32)


def pad(freq, dur, amp=0.1, detune=0.004, attack=1.2, release=2.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k, (mul, a) in enumerate([(1.0, 1.0), (1.5, 0.42), (2.0, 0.2), (1.006, 0.7), (1.497, 0.28)]):
        f = freq * mul + detune * freq * (k - 2)
        sig += a * np.sin(2 * np.pi * f * t + k)
    sig /= 3.0
    e = np.ones(n)
    ai = min(n, int(attack * SR)); ri = min(n, int(release * SR))
    if ai > 0: e[:ai] = np.linspace(0, 1, ai) ** 1.7
    if ri > 0: e[-ri:] *= np.linspace(1, 0, ri) ** 1.2
    return (sig * e * amp).astype(np.float32)


def noise_band(dur, lo, hi, amp=0.1, seed=0, attack=0.05, release=0.3):
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    r = np.random.default_rng(seed)
    x = r.standard_normal(n)
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mid = (lo + hi) / 2
    width = max(0.2, (np.log(hi) - np.log(lo)) / 2.4)
    mask = np.exp(-0.5 * ((np.log(np.maximum(freqs, 1)) - np.log(mid)) / width) ** 2)
    y = np.fft.irfft(X * mask, n)
    y = y / (np.max(np.abs(y)) + 1e-9)
    # attack/release 传的是秒，env_adsr 要的是比例
    a_frac = min(0.45, max(0.001, attack / max(0.01, dur)))
    r_frac = min(0.45, max(0.001, release / max(0.01, dur)))
    return (y * env_adsr(n, a_frac, 0.1 * (1 - a_frac), 0.85, r_frac) * amp).astype(np.float32)


def boom(dur=1.6, amp=0.5, f0=70, f1=28, seed=7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 3.2)
    click = noise_band(dur, 80, 900, 0.15, seed=seed)[:n] * np.exp(-t * 22)
    return ((sig * 0.9 + click) * amp).astype(np.float32)


def bell(freq=196.0, dur=6.0, amp=0.25, seed=3):
    """青铜钟：基频 + 非谐泛音 + 慢衰减"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k, (mul, a, dec) in enumerate([
        (0.5, 0.35, 0.30), (1.0, 1.0, 0.42), (1.19, 0.45, 0.55),
        (1.56, 0.30, 0.7), (2.0, 0.35, 0.9), (2.74, 0.18, 1.3), (3.76, 0.10, 1.8)
    ]):
        sig += a * np.sin(2 * np.pi * freq * mul * t + k * 1.7) * np.exp(-t * dec * 2.2)
    sig += noise_band(dur, 400, 4200, 0.04, seed=seed)[:n] * np.exp(-t * 9)
    return (sig * amp / 2.2).astype(np.float32)


class Mix:
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.buf = np.zeros((self.n, 2), dtype=np.float32)

    def add(self, sig, at, gain=1.0, pan=0.0):
        if sig is None or len(sig) == 0:
            return
        st = int(at * SR)
        if st >= self.n or st < 0:
            return
        m = min(len(sig), self.n - st)
        th = (pan + 1) * np.pi / 4
        self.buf[st:st + m, 0] += sig[:m] * gain * np.cos(th)
        self.buf[st:st + m, 1] += sig[:m] * gain * np.sin(th)


def build():
    m = Mix(DUR)

    # ---------------- 1. 基底：极低的持续音，60→120 全程 ----------------
    m.add(pad(NOTES['D1'], 40, 0.10, attack=6, release=8), 0.0, 1.0, 0.0)
    m.add(pad(NOTES['D2'], 46, 0.055, attack=8, release=10), 0.0, 1.0, -0.1)
    m.add(pad(NOTES['A1'], 40, 0.05, attack=10, release=10), 24.0, 1.0, 0.12)
    m.add(pad(NOTES['F2'], 22, 0.05, attack=4, release=6), 38.0, 1.0, -0.08)
    m.add(pad(NOTES['D2'], 20, 0.06, attack=4, release=6), 54.0, 1.0, 0.0)
    m.add(pad(NOTES['A1'], 16, 0.04, attack=5, release=6), 68.0, 1.0, 0.0)
    m.add(pad(NOTES['D1'], 22, 0.075, attack=6, release=8), 82.0, 1.0, 0.0)
    m.add(pad(NOTES['D2'], 14, 0.07, attack=2, release=6), 98.0, 1.0, 0.0)
    m.add(pad(NOTES['D1'], 14, 0.08, attack=3, release=6), 110.0, 1.0, 0.0)

    # ---------------- 2. S01 墨入纸 ----------------
    m.add(boom(2.4, 0.34, 64, 26), 1.94, 1.0, 0.0)         # 印章落纸
    m.add(bell(146.83, 7.0, 0.20, seed=11), 2.6, 1.0, 0.0)   # 古磬
    m.add(noise_band(3.0, 2200, 9000, 0.022, seed=12, attack=1.2, release=1.4), 3.2, 1.0, -0.2)

    # ---------------- 3. S02 高山 ----------------
    m.add(noise_band(14.0, 500, 4200, 0.055, seed=21, attack=2.5, release=3.0), 10.2, 1.0, -0.25)
    m.add(noise_band(14.0, 120, 900, 0.045, seed=22, attack=3.0, release=3.0), 10.6, 1.0, 0.2)
    for i, tt in enumerate([12.0, 15.5, 19.0, 22.0]):
        m.add(karplus(NOTES[['D4', 'A3', 'F4', 'A4'][i]], 5.0, 0.10, 0.35, seed=30 + i), tt, 1.0, -0.15 + 0.1 * i)

    # ---------------- 4. S03 荣枯 ----------------
    m.add(noise_band(2.0, 800, 5000, 0.05, seed=31), 24.2, 1.0, 0.0)          # 青绿山水气声
    m.add(boom(0.9, 0.30, 120, 40), 26.02, 1.0, 0.0)                           # 蚀变（一帧）
    m.add(noise_band(0.7, 200, 6000, 0.11, seed=32), 26.02, 1.0, 0.0)
    # 铜门合拢
    m.add(noise_band(0.5, 60, 800, 0.20, seed=33), 27.9, 1.0, 0.0)
    m.add(boom(2.6, 0.46, 78, 24), 28.0, 1.0, 0.0)
    m.add(bell(110.0, 5.0, 0.16, seed=34), 28.05, 1.0, 0.0)
    # 暴风雪
    m.add(noise_band(10.0, 300, 3600, 0.06, seed=35, attack=1.2, release=2.0), 31.2, 1.0, 0.15)

    # ---------------- 5. S04 广厦 ----------------
    m.add(noise_band(4.0, 400, 6000, 0.09, seed=41, attack=0.4, release=0.3), 38.1, 1.0, -0.2)   # 暴雨
    m.add(noise_band(4.0, 80, 700, 0.07, seed=42, attack=1.0, release=0.4), 38.2, 1.0, 0.2)
    # 41.5 γ 骤停：先用一声短促的反向吸气，然后真空
    m.add(noise_band(0.55, 900, 9000, 0.10, seed=43, attack=0.5, release=0.05), 41.2, 1.0, 0.0)
    # 静默 41.9–43.2：用负增益把底噪也压掉（在混音后处理）
    m.add(bell(196.0, 9.0, 0.30, seed=44), 43.2, 1.0, 0.0)        # 洪钟古磬
    m.add(pad(NOTES['D3'], 12, 0.05, attack=0.6, release=4.0), 43.5, 1.0, 0.0)
    m.add(noise_band(9.0, 1600, 9000, 0.03, seed=45, attack=1.0, release=2.0), 44.0, 1.0, -0.1)  # 金色气声

    # ---------------- 6. S05 峡江 ----------------
    m.add(noise_band(14.0, 40, 220, 0.16, seed=51, attack=1.4, release=2.0), 54.1, 1.0, 0.0)     # 40Hz 江涛
    m.add(noise_band(14.0, 220, 1800, 0.07, seed=52, attack=1.2, release=2.0), 54.4, 1.0, -0.2)
    for i, tt in enumerate([57.0, 58.4, 59.8, 61.0, 62.4, 63.8, 65.0]):
        m.add(noise_band(0.25, 900, 7000, 0.055, seed=60 + i, attack=0.05, release=0.1), tt, 1.0, -0.3 + 0.1 * (i % 3))

    # ---------------- 7. S06 平野 ----------------
    m.add(noise_band(6.0, 150, 700, 0.035, seed=61, attack=2.0, release=2.5), 68.1, 1.0, 0.15)
    m.add(bell(523.25, 3.0, 0.10, seed=62), 74.9, 1.0, -0.1)      # 鸟鸣/入月的空灵点
    m.add(pad(NOTES['A3'], 10, 0.035, attack=2.0, release=3.0), 70.0, 1.0, 0.1)   # 尺八式长音

    # ---------------- 8. S07 劫难 + 七秒真空 ----------------
    for i, tt in enumerate([84.0, 84.4, 84.8, 85.2, 85.6]):
        m.add(boom(2.2, 0.30, 52, 18), tt, 1.0, -0.25 + 0.12 * i)
        m.add(noise_band(0.6, 60, 1400, 0.10, seed=70 + i), tt + 0.02, 1.0, -0.25 + 0.12 * i)
    # 87.6 之后彻底安静（在 mix 后处理里做硬门）

    # ---------------- 9. S08 丰碑 ----------------
    m.add(pad(NOTES['F2'], 12, 0.06, attack=1.4, release=3.0), 98.2, 1.0, 0.0)
    m.add(noise_band(8.0, 200, 2400, 0.05, seed=81, attack=1.0, release=2.0), 98.3, 1.0, 0.0)  # 地火
    m.add(bell(98.0, 12.0, 0.34, seed=82), 101.0, 1.0, 0.0)       # 青铜大钟
    m.add(bell(196.0, 10.0, 0.18, seed=83), 101.06, 1.0, 0.0)
    for i, tt in enumerate([103.4, 104.6, 105.8, 107.0]):
        m.add(karplus(NOTES[['D4', 'F4', 'A4', 'D4'][i]], 4.0, 0.08, 0.4, seed=84 + i), tt, 1.0, -0.1 + 0.08 * i)

    # ---------------- 10. S09 终章 ----------------
    m.add(noise_band(9.0, 700, 5200, 0.05, seed=91, attack=1.4, release=2.4), 110.1, 1.0, -0.15)  # 风雪
    m.add(bell(73.42, 14.0, 0.26, seed=92), 113.0, 1.0, 0.0)      # 远寺钟
    m.add(pad(NOTES['D2'], 10, 0.05, attack=2.0, release=4.0), 114.0, 1.0, 0.0)
    m.add(karplus(NOTES['D3'], 6.0, 0.08, 0.3, seed=93), 116.0, 1.0, 0.0)
    return m


def main():
    m = build()
    x = m.buf

    # —— 硬性静默段（audio blackout）——
    def blackout(a, b, fade=0.06):
        st, en = int(a * SR), int(b * SR)
        x[st:en, :] = 0.0
        f = int(fade * SR)
        if f > 0:
            if st - f > 0:
                x[st - f:st, :] *= np.linspace(1, 0, f)[:, None]
            if en + f < len(x):
                x[en:en + f, :] *= np.linspace(0, 1, f)[:, None]

    blackout(41.9, 43.15, 0.05)     # S04 子弹时间 2 秒真空
    blackout(87.6, 98.0, 0.10)      # S07 七秒绝对静默（审判的真空）

    # —— 母带 ——
    peak = np.max(np.abs(x)) + 1e-9
    x = x / peak * 0.62
    x = np.tanh(x * 1.25) * 0.92
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.90
    x = x.astype(np.float32)

    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "mix_v3.wav")
    pcm = (x * 32767).astype(np.int16)
    with open(out, "wb") as f:
        f.write(b"RIFF"); f.write((36 + len(pcm.tobytes())).to_bytes(4, "little"))
        f.write(b"WAVEfmt "); f.write((16).to_bytes(4, "little"))
        f.write((1).to_bytes(2, "little")); f.write((2).to_bytes(2, "little"))
        f.write(SR.to_bytes(4, "little")); f.write((SR * 2 * 2).to_bytes(4, "little"))
        f.write((4).to_bytes(2, "little")); f.write((16).to_bytes(2, "little"))
        f.write(b"data"); f.write(len(pcm.tobytes()).to_bytes(4, "little"))
        f.write(pcm.tobytes())
    print("wrote", out, f"{len(x)/SR:.1f}s")


if __name__ == "__main__":
    main()
