"""高潮段的配乐与"人声"合成。

移植自开源社区的生产级做法（abstract-algebra-promo 的 music.py / mg-styles-15 的
lib/audio 思路）：分轨总线 + 卷积混响 + 侧链 + 胶水压缩 + 前瞻限幅 + 响度归一。

本片独有的两点：
1. 旋律由 `public/alignment/climax_words.json` 驱动——每个汉字一个音；
2. 主唱不是采样，而是按拼音韵母做共振峰合成的"人力V"音色，
   每个字的元音决定 F1/F2/F3，辅音给一段噪声爆破。

产物（48 kHz 立体声，严格 10.000 s）：
  public/audio/climax_mix.wav   完整混音（合成播放）
  public/audio/drums_stem.wav   鼓组总线（频谱驱动只用它）

用法：
  python scripts/score.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
ALIGN = ROOT / "public" / "alignment" / "climax_words.json"
MIX_OUT = ROOT / "public" / "audio" / "climax_mix.wav"
DRUM_OUT = ROOT / "public" / "audio" / "drums_stem.wav"
FFMPEG = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

SR = 48000
BPM = 104.987
BEAT = 60.0 / BPM
OFFSET = 0.10
DURATION = 10.0
N = int(DURATION * SR)
F32 = np.float32
TAU = 2.0 * np.pi
rng = np.random.default_rng(20261022)

BUS = {k: np.zeros((2, N), F32) for k in ("mus", "pad", "drm", "vox", "sfx", "hall", "plate", "room", "voxwet")}
KICKS: list[tuple[float, float]] = []


# ---------------------------------------------------------------- helpers
def midi(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69.0) / 12.0)


def beat(n: float) -> float:
    return OFFSET + n * BEAT


def tv(dur: float) -> np.ndarray:
    return np.arange(max(1, int(dur * SR))) / SR


def noise(n: int) -> np.ndarray:
    return rng.standard_normal(n).astype(F32)


def put(sig, t0, bus, gain=1.0, pan=0.0, hall=0.0, plate=0.0, room=0.0, wet=0.0):
    if gain == 0:
        return
    sig = np.asarray(sig, F32)
    if sig.ndim == 1:
        a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)]) * 1.4142
    i = int(round(t0 * SR))
    if i < 0:
        sig = sig[:, -i:]
        i = 0
    n = min(sig.shape[1], N - i)
    if n <= 0:
        return
    seg = sig[:, :n] * gain
    BUS[bus][:, i : i + n] += seg
    for k, g in (("hall", hall), ("plate", plate), ("room", room), ("voxwet", wet)):
        if g:
            BUS[k][:, i : i + n] += seg * g


def adsr(n, a, d, s, r, hold):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    return (e * (1 - np.clip((t - hold) / max(r, 1e-4), 0, 1))).astype(F32)


def lp(x, f, o=2):
    return sosfilt(butter(o, min(f, SR * 0.45), "low", fs=SR, output="sos"), x).astype(F32)


def hp(x, f, o=2):
    return sosfilt(butter(o, max(f, 10), "high", fs=SR, output="sos"), x).astype(F32)


def bp(x, lo, hi, o=2):
    return sosfilt(
        butter(o, [max(lo, 10), min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x
    ).astype(F32)


def saw(f, t, det=0.0, vib=0.0, vr=5.5, ph=0.0):
    """PolyBLEP 限带锯齿。"""
    freq = f * (1 + det) * (1 + vib * np.sin(TAU * vr * t + ph)) if vib else np.full(t.shape, f * (1 + det), F32)
    phase = (np.cumsum(freq, dtype=np.float64) / SR + ph / TAU) % 1.0
    dt = freq / SR
    y = 2 * phase - 1
    m = phase < dt
    x = phase[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = phase > 1 - dt
    x = (phase[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y.astype(F32)


def sweep_sine(f0, f1, dur, curve="exp"):
    t = tv(dur)
    x = t / dur
    f = f0 * (f1 / f0) ** x if curve == "exp" else f0 + (f1 - f0) * x
    return np.sin(TAU * np.cumsum(f, dtype=np.float64) / SR).astype(F32), t


# ---------------------------------------------------------------- instruments
def taiko(t0, gain=0.3, pitch=1.0, pan=0.0):
    t = tv(1.4)
    f = (56 + 78 * np.exp(-t / 0.042)) * pitch
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.5)
    body += 0.32 * np.sin(TAU * np.cumsum(f * 1.61) / SR) * np.exp(-t / 0.22)
    s = body + bp(noise(len(t)), 140, 900) * np.exp(-t / 0.06) * 0.55
    s += hp(noise(len(t)), 2600) * np.exp(-t / 0.004) * 0.35
    put(np.tanh(1.25 * s), t0, "drm", gain, pan, room=0.3, hall=0.3)
    KICKS.append((t0, 0.45))


def kick(t0, gain=0.4, duck=0.7):
    t = tv(0.6)
    f = 46 + 140 * np.exp(-t / 0.028)
    s = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.24)
    s += 0.3 * hp(noise(len(t)), 2200) * np.exp(-t / 0.004)
    put(np.tanh(1.7 * s), t0, "drm", gain, room=0.12)
    KICKS.append((t0, duck))


def snare(t0, gain=0.16, pan=0.0, big=False):
    t = tv(0.6)
    s = bp(noise(len(t)), 900, 8000) * np.exp(-t / (0.2 if big else 0.13))
    s += 0.6 * np.sin(TAU * 188 * t) * np.exp(-t / 0.055)
    s += 0.3 * np.sin(TAU * 336 * t) * np.exp(-t / 0.04)
    put(s, t0, "drm", gain, pan, room=0.35, hall=0.14 if not big else 0.4)


def clap(t0, gain=0.12):
    n = int(0.45 * SR)
    s = np.zeros(n, F32)
    for k, d in enumerate((0, 0.011, 0.023)):
        i = int(d * SR)
        s[i:] += bp(noise(n - i), 1000, 5200) * np.exp(-np.arange(n - i) / SR / (0.011 if k < 2 else 0.11)).astype(F32)
    put(s, t0, "drm", gain, room=0.45, plate=0.3)


def hat(t0, gain=0.03, open_=False, pan=0.22):
    t = tv(0.3 if open_ else 0.07)
    put(hp(noise(len(t)), 7200) * np.exp(-t / (0.1 if open_ else 0.016)), t0, "drm", gain, pan, room=0.1)


def shaker(t0, gain=0.022, pan=-0.22):
    t = tv(0.12)
    put(bp(noise(len(t)), 4200, 11000) * np.sin(np.pi * t / 0.12) ** 2, t0, "drm", gain, pan)


def crash(t0, gain=0.09, dur=2.4, rev=False):
    t = tv(dur)
    s = hp(noise(len(t)), 4600) * np.exp(-t / (dur * 0.34))
    for r in (3.1, 4.7, 6.9):
        s += 0.07 * np.sin(TAU * 420 * r * t) * np.exp(-t / (dur * 0.24))
    if rev:
        put(s[::-1].copy(), max(0.0, t0 - dur), "drm", gain, hall=0.5)
    else:
        put(s, t0, "drm", gain, hall=0.45)


def impact(t0, lvl=1.0, root=26):
    t = tv(4.0)
    f = 30 + 62 * np.exp(-t / 0.28)
    put(np.tanh(2 * np.sin(TAU * np.cumsum(f) / SR)) * np.exp(-t / 1.5), t0, "drm", 0.42 * lvl)
    taiko(t0, 0.34 * lvl, 0.82)
    taiko(t0 + 0.014, 0.22 * lvl, 1.34, -0.3)
    put(lp(noise(len(t)), 2400) * np.exp(-t / 0.4), t0, "drm", 0.09 * lvl, hall=1.1)
    crash(t0, 0.07 * lvl)
    braam(t0, root, 3.4, 0.09 * lvl)
    KICKS.append((t0, 1.0))


def braam(t0, root, dur, gain):
    t = tv(dur + 0.4)
    for m in (root, root + 12, root + 19, root + 24):
        s = saw(midi(m), t, det=0.004) + saw(midi(m), t, det=-0.005)
        k = np.exp(-t / 0.9).astype(F32)
        s = np.tanh(2.2 * (lp(s, 2600) * k + lp(s, 380) * (1 - k))) * adsr(len(t), 0.04, 1.4, 0.5, 0.5, dur)
        put(s, t0, "mus", gain / 4, hall=0.7)


def riser(t_end, dur, gain=0.12):
    t = tv(dur)
    x = t / dur
    s = hp(noise(len(t)), 1200) * x ** 2.2 * 0.7
    for o in range(3):
        f = 180 * 2 ** o * 2 ** (x * 2)
        s += (np.sin(TAU * np.cumsum(f) / SR) * x ** 2 * 0.12 * np.sin(np.pi * np.clip(x * 1.2 - o * 0.1, 0, 1))).astype(F32)
    put(s.astype(F32), max(0.0, t_end - dur), "mus", gain, hall=0.6)


def strings(t0, notes, dur, gain=0.03, att=0.5, rel=0.8, cut=3200, hall=0.8, bus="pad"):
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    e = adsr(n, att, 0.8, 0.9, rel, dur)
    for i, m in enumerate(notes):
        f = midi(m)
        s = sum(saw(f, t, det=(v - 1.5) * 0.0035, vib=0.0035, vr=5.2 + v * 0.4, ph=rng.random() * 6) for v in range(4))
        put(lp(s, cut) * e / 4, t0, bus, gain, ((i / max(1, len(notes) - 1)) - 0.5) * 0.9, hall=hall)


def organ(t0, notes, dur, gain=0.05, att=0.4, rel=1.2, hall=1.0):
    stops = [(1, 1), (2, 0.6), (3, 0.3), (4, 0.32), (6, 0.14), (8, 0.1)]
    n = int((dur + rel) * SR)
    t = np.arange(n) / SR
    e = adsr(n, att, 0.5, 0.92, rel, dur)
    for i, m in enumerate(notes):
        f = midi(m)
        s = np.zeros(n, F32)
        for h, a in stops:
            if f * h > 8000:
                continue
            for dv in (-0.0011, 0.0012):
                s += (a * np.sin(TAU * f * h * (1 + dv) * t + rng.random() * TAU)).astype(F32)
        put(s * e / (2 * len(stops)), t0, "pad", gain, ((i / max(1, len(notes) - 1)) - 0.5) * 0.6, hall=hall)


def piano(t0, m, gain=0.09, vel=0.8, pan=0.0):
    f = midi(m)
    t = tv(4.0)
    B = 0.00015 * 2 ** ((m - 48) / 12)
    s = np.zeros(len(t), F32)
    for h in range(1, 10):
        fh = f * h * np.sqrt(1 + B * h * h)
        if fh > 12000:
            break
        a = vel ** (1 + 0.25 * (h - 1)) / h ** 0.85
        tau = max(0.25, 3.0 - (m - 60) * 0.04) / (1 + 0.45 * (h - 1))
        dec = np.exp(-t / tau).astype(F32)
        for dc in (-0.0006, 0, 0.0007):
            s += (a / 3 * np.sin(TAU * fh * (1 + dc) * t + rng.random() * 6)).astype(F32) * dec
    hn = int(0.012 * SR)
    s[:hn] += lp(noise(hn), 1500 + 3000 * vel) * np.exp(-np.arange(hn) / SR / 0.003).astype(F32) * 0.3 * vel
    put(s * np.minimum(1, t / 0.002), t0, "mus", gain, pan, hall=0.55)


def bell(t0, m, gain=0.04, dec=1.4, pan=0.0, ratio=3.5, index=1.8, bus="mus", hall=0.8, wet=0.0):
    f = midi(m)
    t = tv(dec * 5)
    s = np.sin(TAU * f * t + index * np.exp(-t / 0.3) * np.sin(TAU * f * ratio * t)) * np.exp(-t / dec)
    s += 0.3 * np.sin(TAU * f * 2.01 * t) * np.exp(-t / (dec * 0.4))
    put(s * np.minimum(1, t / 0.0015), t0, bus, gain, pan, hall=hall, wet=wet)


def sub(t0, m, dur, gain=0.14):
    f = midi(m)
    t = tv(dur + 0.3)
    s = np.tanh(1.5 * (np.sin(TAU * f * t) + 0.2 * np.sin(TAU * 2 * f * t))) * adsr(len(t), 0.02, 0.3, 0.9, 0.25, dur)
    put(s, t0, "pad", gain)


def bass8(t0, m, gain=0.09, dur=None):
    dur = dur or BEAT * 0.88
    f = midi(m)
    t = tv(dur + 0.15)
    s = (lp(saw(f, t), 680) + 0.6 * np.sin(TAU * f * t).astype(F32)) * adsr(len(t), 0.004, 0.12, 0.6, 0.08, dur)
    put(s, t0, "mus", gain)


# ---------------------------------------------------------------- 国风音色
def ks_pluck(t0, m, dur=0.9, gain=0.05, pan=0.0, bright=0.55, body=0.5):
    """Karplus-Strong：古筝/琵琶类拨弦。"""
    f = midi(m)
    n = int((dur + 0.05) * SR)
    period = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, period).astype(F32)
    # 激励：拨片噪声 + 一点琴体共鸣
    exc = np.zeros(period, F32)
    exc[:] = buf
    exc = lp(exc, 2400 + 5200 * bright)
    out = np.zeros(n, F32)
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = exc[idx % period]
        nxt = exc[(idx + 1) % period]
        val = body * (cur * 0.5 + nxt * 0.5) + (1 - body) * prev * 0.5
        exc[idx % period] = val
        out[i] = val
        prev = val
        idx += 1
    env = np.exp(-np.arange(n) / SR / (dur * 0.55)).astype(F32)
    out = out * env
    put(out, t0, "mus", gain, pan, hall=0.45, plate=0.2)


def dizi(t0, dur, m, gain=0.03, pan=0.0):
    """竹笛：正弦 + 气息噪声 + 延迟颤音 + 起音滑音。"""
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    f = midi(m)
    glide = 1.0 + 0.02 * np.exp(-t / 0.04)
    vib = 0.006 * np.clip((t - 0.12) / 0.25, 0, 1) * np.sin(TAU * 5.6 * t)
    inst = f * glide * (1 + vib)
    ph = np.cumsum(inst, dtype=np.float64) / SR
    tone = np.sin(TAU * ph) + 0.22 * np.sin(TAU * 2 * ph) + 0.08 * np.sin(TAU * 3 * ph)
    breath = bp(noise(n), f * 1.4, f * 3.2) * 0.35
    env = adsr(n, 0.05, 0.2, 0.86, 0.14, dur)
    put((tone.astype(F32) + breath) * env, t0, "mus", gain, pan, hall=0.9, plate=0.25)


def gong(t0, gain=0.16):
    """锣：非谐分音 + 长衰减。"""
    t = tv(3.4)
    base = 118.0
    partials = ((1.0, 1.0, 1.9), (1.51, 0.7, 1.2), (2.03, 0.55, 0.9), (2.66, 0.4, 0.62), (3.44, 0.28, 0.45), (4.7, 0.18, 0.3))
    s = np.zeros(len(t), F32)
    for r, a, d in partials:
        s += (a * np.sin(TAU * base * r * t + rng.random() * 6) * np.exp(-t / d)).astype(F32)
    s += bp(noise(len(t)), 200, 1800) * np.exp(-t / 0.12) * 0.5
    put(s * np.minimum(1, t / 0.004), t0, "drm", gain, 0.0, hall=0.8, plate=0.3)


def woodblock(t0, m=84, gain=0.045, pan=0.28):
    """木鱼/梆子：短促的有品敲击。"""
    t = tv(0.16)
    f = midi(m)
    s = np.sin(TAU * f * t) * np.exp(-t / 0.022)
    s += 0.5 * np.sin(TAU * f * 2.7 * t) * np.exp(-t / 0.012)
    s += bp(noise(len(t)), 1800, 5000) * np.exp(-t / 0.006) * 0.6
    put(s, t0, "drm", gain, pan, room=0.3)


# ---------------------------------------------------------------- 人声共振峰合成
# 韵母 → F1/F2/F3/F4（Hz）与相对能量，取自中文单元音的常见共振峰位置。
VOWELS: dict[str, tuple[tuple[float, float], ...]] = {
    "a": ((800, 1.0), (1200, 0.6), (2600, 0.3), (3400, 0.16)),
    "o": ((520, 1.0), (860, 0.5), (2600, 0.16), (3300, 0.08)),
    "e": ((480, 1.0), (1350, 0.6), (2500, 0.26), (3400, 0.12)),
    "i": ((300, 1.0), (2300, 0.6), (3000, 0.34), (3700, 0.2)),
    "u": ((330, 1.0), (720, 0.42), (2400, 0.1), (3200, 0.06)),
    "v": ((300, 1.0), (1900, 0.55), (2600, 0.3), (3400, 0.14)),
    "ai": ((760, 1.0), (1150, 0.6), (2500, 0.26), (3300, 0.14)),
    "ei": ((430, 1.0), (1900, 0.55), (2600, 0.28), (3400, 0.14)),
    "ao": ((600, 1.0), (1000, 0.55), (2500, 0.24), (3300, 0.12)),
    "ou": ((430, 1.0), (820, 0.5), (2500, 0.18), (3300, 0.1)),
    "ui": ((360, 1.0), (1500, 0.55), (2600, 0.26), (3400, 0.14)),
    "an": ((700, 1.0), (1150, 0.55), (2500, 0.28), (3300, 0.14)),
    "ang": ((700, 1.0), (1100, 0.5), (2450, 0.24), (3300, 0.12)),
}

PINYIN_VOWEL = {
    "玉": "v", "境": "i", "凌": "i", "霄": "ao", "十": "i", "万": "an",
    "天": "an", "兵": "i", "合": "e", "围": "ei",
    "怎": "e", "敌": "i", "我": "o", "无": "u", "坚": "an", "不": "u", "摧": "ui",
    "五": "u", "指": "i", "山": "an", "下": "a", "偿": "ang", "自": "i", "由": "ou",
    "的": "e", "罪": "ui",
    "名": "i", "是": "i", "老": "ao", "孙": "u", "敬": "i", "威": "ei", "权": "v",
}


def sing(t0, dur, m, vowel, gain=0.12, pan=0.0, consonant="", vel=1.0):
    """一个字的共振峰合成：锯齿源 + 元音共振峰 + 辅音噪声爆破 + 起音滑音。"""
    hold = max(0.06, dur)
    rel = 0.06
    n = int((hold + rel) * SR)
    t = np.arange(n) / SR
    f0 = midi(m)
    # 30ms 的入音滑音，制造"人力V"的咬字感
    glide = 1.0 + 0.055 * np.exp(-t / 0.028)
    vib = 0.004 * np.clip((t - 0.09) / 0.12, 0, 1)
    inst = f0 * glide * (1 + vib * np.sin(TAU * 5.4 * t))
    phase = (np.cumsum(inst, dtype=np.float64) / SR) % 1.0
    src = (2 * phase - 1).astype(F32)
    src += 0.05 * noise(n)
    formants = VOWELS.get(vowel, VOWELS["a"])
    out = np.zeros(n, F32)
    for fc, amp in formants:
        out += amp * bp(src, fc * 0.9, fc * 1.1)
    out /= 1.9
    # 包络
    e = np.minimum(1, t / 0.014) * np.exp(-np.maximum(0, t - hold * 0.7) / max(0.04, hold * 0.5))
    e *= 1 - np.clip((t - hold) / rel, 0, 1)
    out *= e.astype(F32) * vel
    # 辅音
    if consonant in ("z", "c", "s", "j", "q", "x", "zh", "ch", "sh"):
        cn = int(0.055 * SR)
        burst = hp(noise(cn), 3800) * np.exp(-np.arange(cn) / SR / 0.014).astype(F32) * 0.5
        out[:cn] += burst
    elif consonant in ("b", "d", "g", "p", "t", "k"):
        cn = int(0.02 * SR)
        out[:cn] += hp(noise(cn), 1800) * np.exp(-np.arange(cn) / SR / 0.004).astype(F32) * 0.35
    elif consonant in ("m", "n", "l", "r", "w", "y", ""):
        out[: int(0.03 * SR)] *= np.linspace(0.2, 1, int(0.03 * SR)).astype(F32)
    put(out * 0.9, t0, "vox", gain, pan, plate=0.18, hall=0.12, wet=0.22)


# ---------------------------------------------------------------- 和声与编排
CH = {
    "Dm": [50, 53, 57, 62],
    "Bb": [46, 53, 58, 62],
    "F": [48, 53, 57, 60],
    "C": [48, 52, 55, 60],
    "Gm": [50, 55, 58, 62],
    "A": [49, 52, 57, 61],
    "Dm9": [50, 53, 57, 64],
}
CHROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36, "Gm": 43, "A": 33, "Dm9": 38}

PENTA = [62, 65, 67, 69, 72, 74, 77, 79]  # D minor pentatonic


def main() -> int:
    doc = json.loads(ALIGN.read_text(encoding="utf-8"))
    units = doc["units"]
    sections = {s["id"]: (float(s["start"]), float(s["end"])) for s in doc.get("sections", [])}

    # ---------------- 和声时间表（按段落切换，不硬编码拍点） ----------------
    progressions = [
        ("Dm", 0.10, 1.55),
        ("Bb", 1.65, 2.90),
        ("Gm", 2.90, 3.86),
        ("A", 3.86, 4.86),
        ("Dm", 4.87, 5.66),
        ("Bb", 5.66, 6.46),
        ("F", 6.46, 7.18),
        ("Gm", 7.19, 8.18),
        ("A", 8.18, 9.18),
        ("Dm", 9.18, 10.0),
    ]

    # ---------------- 鼓与低频 ----------------
    for k in range(18):
        t = beat(k)
        if t > DURATION:
            break
        bar_pos = k % 4
        if bar_pos in (0, 2):
            kick(t, 0.34 if k < 4 else 0.42)
            taiko(t + 0.002, 0.2 if k < 4 else 0.28, 0.92 if bar_pos == 0 else 1.08, 0.15)
        if bar_pos in (1, 3):
            snare(t, 0.14 if t < 4.8 else 0.17)
            clap(t, 0.09 if t > 2.8 else 0.0)
        hat(t + BEAT * 0.5, 0.024, pan=0.24)
        shaker(t + BEAT * 0.25, 0.016)
        if t > 4.8:
            shaker(t + BEAT * 0.75, 0.018)

    for chord, start, end in progressions:
        root = CHROOT[chord]
        dur = end - start
        strings(start, [n + 12 for n in CH[chord]], dur, gain=0.024 + (0.01 if start > 4.8 else 0), att=0.25, cut=2600)
        sub(start, root, dur, 0.13)
        k = 0
        while start + k * BEAT < end - 0.02:
            bass8(start + k * BEAT, root + (12 if k % 4 == 3 else 0), 0.075 if start < 4.8 else 0.09)
            k += 1

    for cue in (0.10, 2.90, 4.87, 7.19):
        crash(cue, 0.07, 2.0)
    riser(4.87, 0.9, 0.1)
    impact(4.62, 0.8)
    impact(6.87, 0.7)
    impact(9.47, 0.95)
    crash(9.47, 0.1, 2.6)

    # 国风打击：木鱼在弱拍、锣在大落点
    for k in range(18):
        t = beat(k)
        if t > DURATION:
            break
        if t > 0.55 and k % 2 == 1:
            woodblock(t + BEAT * 0.75, 84 if k % 4 == 1 else 88, 0.035)
    gong(4.87, 0.13)
    gong(9.47, 0.17)

    # 点缀：每句末的钟声，跟着爆破字
    accents = {1.83: 74, 2.66: 77, 4.37: 79, 4.62: 81, 6.87: 77, 9.20: 74, 9.47: 81}
    for t0, m in accents.items():
        bell(t0, m, 0.045, dec=1.8, pan=0.2 * np.sin(m), bus="mus", hall=0.7)

    # ---------------- 人声：逐字一个字 ----------------
    # 旋律按五声音阶围绕和弦根音做级进/跳进，句尾下行。
    melody_shapes = {
        "l1": [0, 2, 3, 4, 3, 2, 4, 5, 4, 2],
        "l2": [4, 2, 1, 3, 2, 0, -1],
        "l3": [5, 4, 2, 3, 1, 2, 0, -1, -3],
        "l4": [-1, 1, 3, 2, 4, 3, 5, 4, 2],
    }
    line_cursor: dict[str, int] = {}
    for index, unit in enumerate(units):
        char = unit["text"]
        line = unit.get("line", "l1")
        shape = melody_shapes.get(line, melody_shapes["l1"])
        local = line_cursor.get(line, 0)
        line_cursor[line] = local + 1
        step = shape[local]
        note = PENTA[clamp_int(step + (3 if line == "l4" else 2), 0, len(PENTA) - 1)] + (12 if line in ("l3",) and local >= 5 else 0)
        vowel = PINYIN_VOWEL.get(char, "a")
        start = float(unit["start"])
        end = float(unit["end"])
        dur = max(0.09, end - start)
        sing(start, dur, note, vowel, gain=0.15 if line != "l2" else 0.16, pan=0.06 * np.sin(index))
        # 古筝同音高加花（每三个字补一个，避免糊）
        if local % 3 == 0:
            ks_pluck(start, note + 12, dur * 1.6, 0.045, 0.34 * np.sin(index * 1.7))

    # 竹笛副旋律：按和弦音，在第 2、4 句铺一条长音
    for chord, start, end in progressions:
        if chord in ("Dm", "Bb", "F", "A") and start > 2.8:
            top = CH[chord][-1] + 12
            dizi(start + 0.12, min(1.1, end - start - 0.2), top, 0.026, 0.28)

    # ---------------- 混响 + 母带 ----------------
    def ir(tau_bands, dur, pre, seed, er=8):
        r = np.random.default_rng(seed)
        n = int(dur * SR)
        t = np.arange(n) / SR
        out = []
        for _ in range(2):
            x = r.standard_normal(n).astype(F32)
            y = np.zeros(n, F32)
            for (lo, hi), tau in tau_bands:
                y += (bp(x, lo, hi) if lo else lp(x, hi)) * np.exp(-t / tau)
            y *= np.minimum(1, t / 0.008)
            for k in range(er):
                y[int((pre + r.random() * 0.06) * SR)] += (0.6 - k * 0.05) * (1 if r.random() < 0.5 else -1)
            y = np.concatenate([np.zeros(int(pre * SR), F32), y])
            out.append(y / np.sqrt(np.sum(y**2)))
        return out

    HALL = ir([((0, 300), 1.2), ((300, 1500), 1.0), ((1500, 5000), 0.7), ((5000, 16000), 0.35)], 3.4, 0.025, 1)
    PLATE = ir([((0, 500), 0.55), ((500, 4000), 0.6), ((4000, 16000), 0.45)], 1.7, 0.008, 2)
    ROOM = ir([((0, 400), 0.18), ((400, 6000), 0.16), ((6000, 16000), 0.08)], 0.65, 0.004, 3)

    def conv(bus, h):
        return np.stack([fftconvolve(BUS[bus][c], h[c])[:N].astype(F32) for c in range(2)])

    wet_music = conv("hall", HALL) * 0.5 + conv("plate", PLATE) * 0.42 + conv("room", ROOM) * 0.55
    wet_vox = conv("voxwet", PLATE) * 0.5 + conv("hall", HALL) * 0.2

    duck = np.zeros(N, F32)
    for tk, depth in KICKS:
        i = int(tk * SR)
        L = min(int(0.4 * SR), N - i)
        if L > 0:
            duck[i : i + L] = np.maximum(duck[i : i + L], depth * np.exp(-np.arange(L) / SR / 0.15))

    pad = BUS["pad"] * (1 - 0.45 * duck)
    music = BUS["mus"] + pad + BUS["drm"] * 0.95 + wet_music
    vox = BUS["vox"] + wet_vox
    sfx = BUS["sfx"]

    mix = music * 0.9 + vox * 1.0 + sfx
    mix = np.stack([hp(mix[c], 28) for c in range(2)])
    # 低频单声道（手机外放/单声道兼容）
    lowband = sosfiltfilt(butter(2, 120, "low", fs=SR, output="sos"), mix, axis=1).astype(F32)
    lowmono = lowband.mean(axis=0)
    mix = mix - lowband + np.stack([lowmono, lowmono])
    mix -= 0.55 * lowband
    mix -= 0.25 * sosfiltfilt(butter(2, 7200, "high", fs=SR, output="sos"), mix, axis=1).astype(F32)

    mono = np.sqrt((mix[0] ** 2 + mix[1] ** 2) / 2)
    a = np.exp(-1 / (0.12 * SR))
    env = np.sqrt(lfilter([1 - a], [1, -a], mono**2) + 1e-12)
    lvl = 20 * np.log10(env / (np.max(env) + 1e-9) + 1e-9)
    g = 10 ** (-np.maximum(0, lvl + 11) * (1 - 1 / 2.2) / 20)
    mix *= g.astype(F32)
    mix /= np.max(np.abs(mix)) + 1e-9

    L = int(0.004 * SR)
    pk = maximum_filter1d(np.max(np.abs(mix), axis=0), size=2 * L + 1)
    g = np.minimum(1, 0.5 / np.maximum(pk, 1e-9))
    a = np.exp(-1 / (0.09 * SR))
    gs = lfilter([1 - a], [1, -a], g)
    mix *= np.minimum(g, gs).astype(F32)

    # 起音 4 ms / 收尾 250 ms 淡出，正好 10.000 s
    t_all = np.arange(N)
    fade = np.minimum(1, (N - t_all) / (0.25 * SR)) * np.minimum(1, t_all / (0.004 * SR)).astype(F32)
    fade = fade.astype(F32)
    mix *= fade
    mix /= np.max(np.abs(mix)) + 1e-9

    def write(path: Path, data: np.ndarray) -> None:
        pcm = (np.clip(data, -1, 1).T * 32000).astype(np.int16)
        with wave.open(str(path), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())

    MIX_OUT.parent.mkdir(parents=True, exist_ok=True)
    write(MIX_OUT, mix)

    # 鼓组总线单独导出（频谱驱动专用），做 -1 dBFS 归一
    drums = BUS["drm"]
    drums = np.stack([hp(drums[c], 28) for c in range(2)])
    drums /= np.max(np.abs(drums)) + 1e-9
    drums *= 0.9
    drums *= fade
    write(DRUM_OUT, drums)

    stems = ROOT / "out" / "ref"
    stems.mkdir(parents=True, exist_ok=True)
    for name, bus in (("vox", BUS["vox"]), ("mus", BUS["mus"]), ("pad", BUS["pad"])):
        peak = float(np.max(np.abs(bus))) or 1.0
        write(stems / f"stem_{name}.wav", bus / peak * 0.9)
    print(f"mix   : {MIX_OUT.relative_to(ROOT)}  {N / SR:.3f}s  {MIX_OUT.stat().st_size} B")
    print(f"drums : {DRUM_OUT.relative_to(ROOT)}  {N / SR:.3f}s  {DRUM_OUT.stat().st_size} B")
    print(f"peaks : mix {np.max(np.abs(mix)):.3f}  drums {np.max(np.abs(drums)):.3f}")

    # -14 LUFS（两遍 loudnorm），失败也不阻断
    if FFMPEG.exists():
        for target, tag in ((MIX_OUT, "mix"),):
            tmp = target.with_name(f"{target.stem}_norm.wav")
            cmd = [
                str(FFMPEG), "-hide_banner", "-y", "-loglevel", "error",
                "-i", str(target), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                "-ar", "48000", str(tmp),
            ]
            done = subprocess.run(cmd, capture_output=True, text=True)
            if done.returncode == 0 and tmp.exists():
                tmp.replace(target)
                print(f"loudnorm: {tag} → -14 LUFS")
            else:
                print(f"loudnorm skipped ({done.stderr.strip()[:120]})")
    analyse(MIX_OUT, FFMPEG)
    return 0


def analyse(path: Path, ffmpeg: Path) -> None:
    """交付前自检：响度、真峰值、频段占比（对应 mgaudio.qc 的告警口径）。"""
    with wave.open(str(path), "rb") as h:
        raw = h.readframes(h.getnframes())
        sr = h.getframerate()
        ch = h.getnchannels()
    data = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    data = data.reshape(-1, ch)
    mono = data.mean(axis=1)
    print(f"qc: duration {data.shape[0] / sr:.3f}s peak {np.abs(data).max():.3f} dc {mono.mean():+.5f}")
    spec = np.abs(np.fft.rfft(mono * np.hanning(mono.size)))
    freq = np.fft.rfftfreq(mono.size, 1 / sr)
    total = (spec**2).sum() + 1e-12
    bands = {
        "sub<60": freq < 60,
        "bass<250": (freq >= 60) & (freq < 250),
        "lowmid<2k": (freq >= 250) & (freq < 2000),
        "presence<5k": (freq >= 2000) & (freq < 5000),
        "brilliance<12k": (freq >= 5000) & (freq < 12000),
    }
    print("qc: bands " + " ".join(f"{k} {100 * (spec[m] ** 2).sum() / total:.1f}%" for k, m in bands.items()))
    l = np.sqrt((data[:, 0] ** 2).mean())
    r = np.sqrt((data[:, 1] ** 2).mean())
    corr = float(np.corrcoef(data[:, 0], data[:, 1])[0, 1]) if data.shape[1] > 1 else 1.0
    print(f"qc: stereo corr {corr:.2f}  L/R {l:.3f}/{r:.3f}")
    if ffmpeg.exists():
        out = subprocess.run(
            [str(ffmpeg), "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
            capture_output=True, text=True,
        )
        tail = [line for line in out.stderr.splitlines() if "I:" in line or "Peak:" in line]
        for line in tail[-4:]:
            print("qc:", line.strip())


def clamp_int(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


if __name__ == "__main__":
    sys.exit(main())
