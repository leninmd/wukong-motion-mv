"""Independent verification of public/alignment/climax_words.json.

Nothing here reuses the builder's candidate set. The check is:

  1. structural: monotonic starts, end > start, inside 0–10 s, lyric matches;
  2. audio: every character start must sit on a local maximum of a spectral
     flux envelope computed from the *reference mix* (a different signal than
     the drum stem the builder aligned against);
  3. musical: distance from each start to the measured eighth-note pulse.

Run: python scripts/verify_climax.py
Exit code is non-zero if a character drifts more than 50 ms from the mix's
transient envelope.
"""

from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

ROOT = Path(__file__).resolve().parents[1]
ALIGN = ROOT / "public" / "alignment" / "climax_words.json"
STEM = ROOT / "public" / "audio" / "drums_stem.wav"
MIX = ROOT / "out" / "ref" / "segment_09_19.wav"

LYRIC = "玉境凌霄十万天兵合围怎敌我无坚不摧五指山下偿自由的罪罪名是老孙不敬权威"
TOLERANCE = 0.05
SR = 48000
HOP = 240
N_FFT = 1024


def read(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as handle:
        channels, rate = handle.getnchannels(), handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    data = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(1)
    return data, rate


def envelope(audio: np.ndarray, rate: int, band=(220.0, 5200.0)) -> np.ndarray:
    _, _, spec = signal.stft(
        audio,
        fs=rate,
        window="hann",
        nperseg=N_FFT,
        noverlap=N_FFT - HOP,
        boundary="zeros",
        padded=True,
    )
    freqs = np.fft.rfftfreq(N_FFT, d=1.0 / rate)
    mag = np.abs(spec)[(freqs >= band[0]) & (freqs <= band[1])]
    logmag = np.log1p(1200.0 * mag)
    diff = np.diff(logmag, axis=1, prepend=logmag[:, :1])
    flux = np.maximum(diff, 0.0).mean(0)
    return ndimage.uniform_filter1d((flux - flux.min()) / (flux.max() - flux.min() + 1e-12), 3)


def main() -> int:
    document = json.loads(ALIGN.read_text(encoding="utf-8"))
    units = document["units"]
    problems: list[str] = []

    # ---- structure -------------------------------------------------------
    if len(units) != len(LYRIC):
        problems.append(f"expected {len(LYRIC)} units, found {len(units)}")
    text = "".join(unit["text"] for unit in units)
    if text != LYRIC:
        problems.append(f"lyric mismatch:\n  got      {text}\n  expected {LYRIC}")
    previous = -1.0
    for index, unit in enumerate(units):
        start, end = float(unit["start"]), float(unit["end"])
        if end <= start:
            problems.append(f"{unit['id']}: end <= start")
        if start < previous:
            problems.append(f"{unit['id']}: start not monotonic")
        if not 0.0 <= start <= document["duration"]:
            problems.append(f"{unit['id']}: start outside the clip")
        previous = start

    # ---- audio -----------------------------------------------------------
    mix, mix_rate = read(MIX)
    env = envelope(mix, mix_rate)
    hop_seconds = HOP / mix_rate
    peaks, _ = signal.find_peaks(env, distance=int(0.05 / hop_seconds), prominence=0.06)
    peak_times = peaks * hop_seconds

    stem, stem_rate = read(STEM)
    stem_seconds = stem.size / stem_rate
    if abs(stem_seconds - 10.0) > 1e-4:
        problems.append(f"stem is {stem_seconds:.4f}s, expected 10.000s")

    beats = document.get("beats", {})
    bpm = float(beats.get("bpm", 0))
    period = 60.0 / bpm if bpm else 0.0
    pulse = period / 2.0

    rows = []
    worst = 0.0
    within = 0
    worst_pulse = 0.0
    for unit in units:
        start = float(unit["start"])
        nearest = float(np.min(np.abs(peak_times - start)))
        if period:
            phase = (start - float(beats.get("offset", 0))) / pulse
            pulse_delta = abs(phase - round(phase)) * pulse
        else:
            pulse_delta = float("nan")
        worst = max(worst, nearest)
        worst_pulse = max(worst_pulse, pulse_delta)
        if nearest <= TOLERANCE:
            within += 1
        rows.append((unit["id"], unit["text"], start, float(unit["end"]), nearest, pulse_delta))

    print(f"units            : {len(units)}")
    print(f"lyric            : {text}")
    print(f"stem duration    : {stem_seconds:.4f} s")
    print(f"tempo            : {bpm:.2f} BPM  (beat {period:.4f}s, eighth {pulse:.4f}s)")
    print(f"mix transients   : {len(peak_times)} local maxima in 220–5200 Hz")
    print(f"max |char - mix transient| : {worst * 1000:6.1f} ms   "
          f"({within}/{len(units)} <= {TOLERANCE * 1000:.0f} ms)")
    print(f"max |char - eighth pulse|  : {worst_pulse * 1000:6.1f} ms")
    print()
    print("id      char   start     end    Δtransient  Δpulse")
    for unit_id, char, start, end, nearest, pulse_delta in rows:
        flag = " " if nearest <= TOLERANCE else "!"
        print(f"{unit_id:6s} {char}  {start:6.3f} {end:7.3f}  {nearest * 1000:8.1f} ms {flag}"
              f" {pulse_delta * 1000:7.1f} ms")

    print()
    if problems:
        print("FAILED:")
        for problem in problems:
            print("  -", problem)
    if worst > TOLERANCE:
        problems.append(f"max transient deviation {worst * 1000:.1f} ms > {TOLERANCE * 1000:.0f} ms")

    if problems:
        print(f"RESULT: FAIL ({len(problems)} issue(s))")
        return 1
    print("RESULT: PASS — every character starts on a reference transient within 50 ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
