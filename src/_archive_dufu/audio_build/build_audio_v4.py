#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_audio_v4.py — V4 音轨：**物理建模的古琴与堂鼓** + 毫秒级音画同步

V3 的问题：纯 numpy 滤波噪波，缺真实乐器的瞬态与情感温度。
V4 的解法：
  1. Karplus-Strong 拨弦物理建模（分数延迟 + 循环滤波）
       · 散音 sǎn   —— 低音长鸣，模拟空弦
       · 泛音 fàn   —— 亮、短、清澈（延迟环里只剩偶数次谐波）
       · 吟猱 yín   —— 按弦揉动，延迟长度做 4~6Hz 正弦调制（音高游移）
  2. 堂鼓 / 太鼓：f0 * exp(-t*15) 指数频率下潜 + 皮膜噪声 + 低通"咚"体
  3. 每一个分镜的重点文字砸落 / 朱印 / 断碑崩裂，都在音轨上有精确同步
     （同步表直接读 storyboard.v4.json 的 cues + sfx，与画面同一张表）
  4. 两段硬静默之前先推向极致的风雨/战鼓渐强，静默之后一声孤琴泛音击穿人心

输出：output/audio/mix_v4.wav（48kHz / 16bit / 立体声 / 88s）
"""
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
OUT = os.path.join(ROOT, "output", "audio")

with open(os.path.join(ROOT, "storyboard.v4.json"), "r", encoding="utf-8") as f:
    SB = json.load(f)
DUR = float(SB["duration"])

rng = np.random.default_rng(20241021)

# 五声音阶（宫商角徵羽）+ 低音区；古琴常用调（正调 / F 调）
NOTE = {
    "C2": 65.41, "D2": 73.42, "E2": 82.41, "F2": 87.31, "G2": 98.00, "A2": 110.00,
    "C3": 130.81, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00,
    "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00, "A4": 440.00,
    "C5": 523.25, "D5": 587.33, "E5": 659.25, "G5": 784.00, "A5": 880.00,
}


# ---------------------------------------------------------------- 基础工具
def adsr(n, a=0.004, d=0.10, s=0.7, r=0.25):
    e = np.ones(n, dtype=np.float32)
    ai = max(1, int(a * n)); di = max(1, int(d * n)); ri = max(1, int(r * n))
    ai = min(ai, n); di = min(di, max(1, n - ai)); ri = min(ri, n)
    e[:ai] = np.linspace(0, 1, ai)
    if di > 0:
        e[ai:ai + di] = np.linspace(1, s, di)
    e[ai + di:] = s
    if ri > 0:
        e[-ri:] *= np.linspace(1, 0, ri) ** 1.2
    return e


def frac_delay_line(freq, bright=0.5, seed=0, odd_only=False):
    """构造 KS 激励：长度 = 采样率/频率（分数延迟用线性插值近似）。"""
    d = SR / max(20.0, freq)
    n = int(np.floor(d)) + 2
    r = np.random.default_rng(seed)
    x = r.uniform(-1, 1, n).astype(np.float64)
    # 激励的亮度：与"拨弦位置"有关，bright 越高越靠近琴桥
    if bright > 0:
        k = max(1, int((1.0 - bright) * 4) + 1)
        for _ in range(k):
            x = 0.5 * (x + np.roll(x, 1))
    if odd_only:
        # 泛音：只保留偶次谐波 → 频域做一次偶次抽取
        X = np.fft.rfft(x)
        h = np.arange(len(X))
        X[h % 2 == 1] *= 0.18
        x = np.fft.irfft(X, len(x))
    x -= x.mean()
    m = np.max(np.abs(x))
    return (x / m if m > 1e-9 else x), d


def ks_string(freq, dur, amp=0.3, bright=0.5, decay=0.9965, seed=0,
              odd_only=False, vibrato=0.0, vib_rate=5.2):
    """Karplus-Strong 拨弦（分数延迟 + 一阶低通环路）。

    分数延迟：每步在整数延迟 d 上做线性插值，音高才准（纯整数延迟会跑音）。
    vibrato：延迟长度做正弦调制 —— 古琴的"吟猱"。
    """
    n = int(dur * SR)
    if n <= 4:
        return np.zeros(0, dtype=np.float32)
    exc, d0 = frac_delay_line(freq, bright, seed, odd_only)
    L = len(exc)
    buf = np.zeros(L + 2, dtype=np.float64)
    buf[:len(exc)] = exc
    out = np.zeros(n, dtype=np.float64)
    # 环路低通系数：越接近 1 越亮（越"木"）
    lp = 0.5 + 0.30 * (1.0 - bright)
    d_int = int(np.floor(d0))
    d_frac = d0 - d_int
    pos = 0
    prev = 0.0
    for i in range(n):
        out[i] = buf[pos]
        # 吟猱：延迟长度微调（等价于音高的低频游移）
        dmod = 0.0
        if vibrato > 0:
            dmod = vibrato * np.sin(2 * np.pi * vib_rate * i / SR)
        di = d_int + (1 if dmod > 0.5 else 0)
        nxt = (pos + di) % L
        nxt2 = (pos + di + 1) % L
        v = buf[nxt] * (1.0 - d_frac) + buf[nxt2] * d_frac
        filt = lp * v + (1.0 - lp) * prev
        prev = filt
        buf[pos] = filt * decay
        pos = (pos + 1) % L
    env = np.exp(-np.arange(n) / (SR * max(0.25, dur * 0.55)))
    return (out * env * amp).astype(np.float32)


def guqin(key, dur=4.0, amp=0.30, kind="san", seed=0):
    """古琴三法：散音 / 泛音 / 吟猱。"""
    f = NOTE[key]
    if kind == "fan":
        return ks_string(f, dur, amp=amp, bright=0.78, decay=0.9940, seed=seed,
                         odd_only=True, vibrato=0.0)
    if kind == "yin":
        return ks_string(f, dur, amp=amp, bright=0.42, decay=0.9975, seed=seed,
                         vibrato=0.55, vib_rate=5.6)
    return ks_string(f, dur, amp=amp, bright=0.34, decay=0.9982, seed=seed)


def taiko(dur=2.4, amp=0.55, f0=78.0, drop=15.0, seed=7):
    """堂鼓：指数频率下潜 f0*exp(-t*15) + 皮膜噪声 + 低频体鸣。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * np.exp(-t * drop) + 26.0
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 2.6)
    body += 0.42 * np.sin(ph * 1.63 + 0.7) * np.exp(-t * 4.4)
    r = np.random.default_rng(seed)
    skin = r.standard_normal(n)
    # 皮膜噪声：一阶低通 + 极快衰减（"啪"的瞬态）
    a = 0.22
    skin = np.asarray([0.0] + list(skin[:-1])) * a + skin * (1 - a)
    skin *= np.exp(-t * 34.0) * 0.55
    sig = body + skin
    sig /= (np.max(np.abs(sig)) + 1e-9)
    return (sig * amp * adsr(n, 0.0015, 0.10, 0.55, 0.35)).astype(np.float32)


def bronze_bell(freq=196.0, dur=6.0, amp=0.25, seed=3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k, (mul, a, dec) in enumerate([
        (0.5, 0.34, 0.60), (1.0, 1.00, 0.85), (1.19, 0.44, 1.10),
        (1.56, 0.28, 1.40), (2.0, 0.33, 1.80), (2.74, 0.17, 2.60), (3.76, 0.09, 3.60),
    ]):
        sig += a * np.sin(2 * np.pi * freq * mul * t + k * 1.7) * np.exp(-t * dec)
    r = np.random.default_rng(seed)
    strike = r.standard_normal(n) * np.exp(-t * 42.0) * 0.35
    return ((sig / 2.1 + strike) * amp).astype(np.float32)


def noise_band(dur, lo, hi, amp=0.1, seed=0, attack=0.05, release=0.3):
    n = int(dur * SR)
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    r = np.random.default_rng(seed)
    x = r.standard_normal(n)
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    mid = (lo + hi) / 2
    width = max(0.20, (np.log(hi) - np.log(lo)) / 2.4)
    mask = np.exp(-0.5 * ((np.log(np.maximum(freqs, 1)) - np.log(mid)) / width) ** 2)
    y = np.fft.irfft(X * mask, n)
    y = y / (np.max(np.abs(y)) + 1e-9)
    a_frac = min(0.45, max(0.001, attack / max(0.01, dur)))
    r_frac = min(0.45, max(0.001, release / max(0.01, dur)))
    return (y * adsr(n, a_frac, 0.10 * (1 - a_frac), 0.85, r_frac) * amp).astype(np.float32)


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
        if st < 0:
            sig = sig[-st:]
            st = 0
        m = min(len(sig), self.n - st)
        th = (pan + 1) * np.pi / 4
        self.buf[st:st + m, 0] += sig[:m] * gain * np.cos(th)
        self.buf[st:st + m, 1] += sig[:m] * gain * np.sin(th)


# ---------------------------------------------------------------- 句读调度器
def schedule(cue):
    """与 engine/v4/cadence.js 的 V4.schedule 严格同构。"""
    char_dur = cue.get("charDur", 0.06)
    pause = cue.get("pause", 0.2)
    groups = cue.get("groups") or []
    t = cue.get("t", 0.0)
    times, starts = [], []
    if not groups:
        return times, starts
    for g in groups:
        starts.append(t)
        for i in range(len(list(g))):
            times.append(t + i * char_dur)
        t += len(list(g)) * char_dur + pause
    return times, starts


def chapter_start(scene_id):
    ch = SB["chapters"]
    pre = "s" + scene_id[1]
    for c in ch:
        if c["scene"] == pre:
            return c["start"]
    return 0.0


# ---------------------------------------------------------------- 编排
def build():
    m = Mix(DUR)

    # ============ 1. 环境基底：持续低频床（情绪的地板，撤掉就空） ============
    m.add(guqin("C2", 30.0, 0.34, "san", seed=1), 0.0, 1.0, 0.0)
    m.add(guqin("C2", 30.0, 0.30, "san", seed=2), 22.0, 1.0, -0.08)
    m.add(guqin("G2", 28.0, 0.24, "san", seed=3), 44.0, 1.0, 0.08)
    m.add(guqin("C2", 26.0, 0.30, "san", seed=4), 64.0, 1.0, 0.0)
    m.add(noise_band(88.0, 30, 110, 0.045, seed=5, attack=3.0, release=6.0), 0.0, 1.0, 0.0)
    # 一层极淡的风（把静场托住，避免"死寂"）
    m.add(noise_band(88.0, 240, 1600, 0.022, seed=6, attack=5.0, release=6.0), 0.0, 1.0, -0.12)

    # ============ 2. 句读落字的自动同步（每个词组的重音 = 一声古琴） ============
    # 五声音阶循环：按词组序号取音，避免"同一个音一直响"
    PENTA = ["C4", "D4", "E4", "G4", "A4", "C5", "A4", "G4", "E4", "D4"]
    LOW = ["C3", "D3", "E3", "G3", "A3"]
    for cue in SB.get("cues", []):
        gid = cue.get("id", "")
        sid = gid.split("_")[0]
        base = chapter_start(sid)
        times, starts = schedule(cue)
        mode = cue.get("mode", "hist")
        for gi, st in enumerate(starts):
            at = base + st
            if mode == "chant":
                key = PENTA[gi % len(PENTA)]
                m.add(guqin(key, 6.0, 0.24, "san", seed=100 + gi), at, 1.0, -0.10 + 0.05 * gi)
                # 落字瞬间的一层泛音（清亮，像指尖离弦）
                m.add(guqin(PENTA[(gi + 4) % len(PENTA)], 2.0, 0.075, "fan", seed=200 + gi),
                      at + 0.02, 1.0, 0.16)
            elif mode == "hist":
                key = LOW[gi % len(LOW)]
                m.add(taiko(1.9, 0.34, 62.0, 17.0, seed=300 + gi), at, 1.0, 0.0)
                m.add(guqin(key, 5.4, 0.20, "yin", seed=310 + gi), at + 0.03, 1.0, 0.12)
            else:  # rub 碑拓
                key = LOW[gi % len(LOW)]
                m.add(guqin(key, 5.0, 0.18, "yin", seed=400 + gi), at, 1.0, -0.06)

    # ============ 3. 分镜级音效（storyboard.sfx，与画面同一张表） ============
    for ev in SB.get("sfx", []):
        t = float(ev["t"])
        kind = ev.get("kind")
        g = float(ev.get("gain", 1.0))
        if kind == "stamp":
            m.add(taiko(2.6, 0.62 * g, 58.0, 13.0, seed=901), t, 1.0, 0.0)
            m.add(noise_band(0.35, 200, 5200, 0.22 * g, seed=902, attack=0.002, release=0.2), t + 0.005, 1.0, 0.0)
            m.add(bronze_bell(87.31, 7.0, 0.30 * g, seed=903), t + 0.10, 1.0, 0.0)
        elif kind == "drum":
            m.add(taiko(2.4, 0.50 * g, 70.0, 15.0, seed=910), t, 1.0, -0.05)
            m.add(taiko(1.8, 0.28 * g, 96.0, 20.0, seed=911), t + 0.012, 1.0, 0.08)
        elif kind == "boom":
            m.add(taiko(3.0, 0.66 * g, 46.0, 10.0, seed=920), t, 1.0, 0.0)
            m.add(noise_band(1.2, 40, 700, 0.22 * g, seed=921, attack=0.01, release=0.7), t, 1.0, 0.0)
        elif kind == "bell":
            m.add(bronze_bell(98.0, 11.0, 0.30 * g, seed=930), t, 1.0, 0.0)
            m.add(bronze_bell(196.0, 9.0, 0.15 * g, seed=931), t + 0.03, 1.0, 0.10)
        elif kind == "guqin":
            m.add(guqin("D4", 4.2, 0.24 * g, "san", seed=940 + int(t * 10)), t, 1.0, 0.0)
            m.add(guqin("A4", 2.6, 0.10 * g, "fan", seed=950 + int(t * 10)), t + 0.015, 1.0, 0.15)
        elif kind == "wind":
            m.add(noise_band(9.0, 380, 5200, 0.075 * g, seed=960, attack=1.4, release=2.6), t, 1.0, -0.18)
            m.add(noise_band(9.0, 90, 720, 0.060 * g, seed=961, attack=2.0, release=2.6), t + 0.2, 1.0, 0.18)

    # ============ 4. 两段"真空"前推向极致 ============
    # 4A：33.30–34.55（广厦成形之前）—— 战鼓渐强 → 绝对静默 → 洪钟 + 孤琴泛音
    CRES_A = (31.10, 33.24)
    n = int((CRES_A[1] - CRES_A[0]) * SR)
    tk = np.arange(n) / SR
    ramp = (tk / max(0.01, tk[-1])) ** 2.2
    # 战鼓连击（速度从 2.2Hz 加到 7.5Hz）
    tt = CRES_A[0]
    while tt < CRES_A[1]:
        u = (tt - CRES_A[0]) / (CRES_A[1] - CRES_A[0])
        rate = 2.2 + 5.3 * u * u
        m.add(taiko(1.3, 0.10 + 0.34 * u * u, 74.0, 16.0, seed=int(tt * 100) % 9999), tt, 1.0, (u - 0.5) * 0.5)
        tt += 1.0 / rate
    # 风雨渐强
    m.add(noise_band(CRES_A[1] - CRES_A[0], 120, 4200, 0.15, seed=970, attack=0.4, release=0.02),
          CRES_A[0], 1.0, 0.0)
    # 吸气（反向噪波）→ 真空
    m.add(noise_band(0.60, 700, 9000, 0.20, seed=971, attack=0.55, release=0.03),
          CRES_A[1] - 0.55, 1.0, 0.0)

    # 4B：59.30–60.85（断碑落定 → 数尝寇乱之前）—— 石雨 + 低频压迫 → 静默 → 一声鼓 + 孤琴
    CRES_B = (57.20, 59.24)
    tt = CRES_B[0]
    while tt < CRES_B[1]:
        u = (tt - CRES_B[0]) / (CRES_B[1] - CRES_B[0])
        m.add(taiko(1.1, 0.08 + 0.30 * u * u, 88.0, 22.0, seed=int(tt * 97) % 9999), tt, 1.0, (u - 0.5) * 0.6)
        tt += 0.09 + 0.22 * (1 - u)
    m.add(noise_band(CRES_B[1] - CRES_B[0], 60, 2400, 0.13, seed=980, attack=0.5, release=0.02),
          CRES_B[0], 1.0, 0.0)
    m.add(noise_band(0.7, 500, 8000, 0.18, seed=981, attack=0.62, release=0.03),
          CRES_B[1] - 0.65, 1.0, 0.0)

    return m


def apply_space(x):
    """廉价空间感：三抽头反馈延迟（Schroeder 式），不引第三方库。"""
    y = x.copy()
    for delay_ms, gain, pan in [(23.0, 0.28, 0.0), (37.0, 0.22, 0.0), (61.0, 0.16, 0.0)]:
        d = int(delay_ms / 1000.0 * SR)
        for ch in (0, 1):
            src = x[:, ch]
            out = np.zeros_like(src)
            for k in range(1, 5):
                off = d * k
                if off >= len(src):
                    break
                out[off:] += src[:-off] * (gain ** k)
            y[:, ch] += out * 0.55
    return y


def main():
    m = build()
    x = m.buf

    x = apply_space(x)

    # —— 硬静默（audio blackout）：先有极致的渐强，才有这一刀切下去的效果 ——
    def blackout(a, b, fade=0.05):
        st, en = int(a * SR), int(b * SR)
        x[st:en, :] = 0.0
        f = int(fade * SR)
        if f > 0:
            if st - f > 0:
                x[st - f:st, :] *= np.linspace(1, 0, f)[:, None]
            if en + f < len(x):
                x[en:en + f, :] *= np.linspace(0, 1, f)[:, None]

    blackout(33.30, 34.55, 0.035)   # 广厦成形之前的真空
    blackout(59.30, 60.85, 0.040)   # 数尝寇乱之前的真空

    # —— 静默之后的"一声"：必须干净、单薄、击穿 ——
    m2 = Mix(0)  # 占位，避免 lint
    def put_after(sig, at, gain=1.0, pan=0.0):
        st = int(at * SR)
        n = min(len(sig), len(x) - st)
        if n <= 0:
            return
        th = (pan + 1) * np.pi / 4
        x[st:st + n, 0] += sig[:n] * gain * np.cos(th)
        x[st:st + n, 1] += sig[:n] * gain * np.sin(th)

    put_after(bronze_bell(146.83, 8.0, 0.34, seed=990), 34.56, 1.0, 0.0)     # 洪钟
    put_after(guqin("A4", 4.4, 0.28, "fan", seed=991), 34.62, 1.0, 0.06)     # 孤琴泛音
    put_after(taiko(2.6, 0.40, 60.0, 14.0, seed=992), 60.86, 1.0, 0.0)       # 一记堂鼓
    put_after(guqin("D4", 5.0, 0.26, "fan", seed=993), 60.92, 1.0, 0.0)      # 孤琴泛音

    # —— 母带 ——
    peak = np.max(np.abs(x)) + 1e-9
    x = x / peak * 0.72
    x = np.tanh(x * 1.30) * 0.94
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.91
    # 收尾 0.6s 淡出
    tail = int(0.6 * SR)
    x[-tail:, :] *= np.linspace(1, 0, tail)[:, None]
    x = x.astype(np.float32)

    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, "mix_v4.wav")
    pcm = (x * 32767).astype(np.int16)
    with open(out, "wb") as f:
        f.write(b"RIFF"); f.write((36 + len(pcm.tobytes())).to_bytes(4, "little"))
        f.write(b"WAVEfmt "); f.write((16).to_bytes(4, "little"))
        f.write((1).to_bytes(2, "little")); f.write((2).to_bytes(2, "little"))
        f.write(SR.to_bytes(4, "little")); f.write((SR * 2 * 2).to_bytes(4, "little"))
        f.write((4).to_bytes(2, "little")); f.write((16).to_bytes(2, "little"))
        f.write(b"data"); f.write(len(pcm.tobytes()).to_bytes(4, "little"))
        f.write(pcm.tobytes())
    print("wrote", out, "%.1fs" % (len(x) / SR))


if __name__ == "__main__":
    main()
