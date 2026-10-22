"""Probe the extracted climax audio and calibrate the visual band references.

The bands here replicate `@remotion/media-utils`' `visualizeAudio()` exactly so
the numbers below can be pasted into `src/audio/spectrum.ts` without guessing:

  * sampleSize          = numberOfSamples * 2 = 64
  * window              = channel[0][max(0, floor(t*sr) - 32) : +64]
  * bars[k]             = smooth3x3(|FFT64|)[k] / (64/2) / (peak*32767)
  * smooth3x3           = 3 passes of a 3-tap box filter (remotion's `smoothen`)

Run:  python scripts/analyze_climax_audio.py
"""

from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
WAV = ROOT / "public" / "audio" / "climax_real_vocal.wav"

SAMPLE_SIZE = 64
BANDS = {"low": (0, 2), "mid": (3, 15), "high": (16, 31)}
FPS = 30


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as fh:
        channels = fh.getnchannels()
        width = fh.getsampwidth()
        rate = fh.getframerate()
        frames = fh.getnframes()
        raw = fh.readframes(frames)
    assert width == 2, f"expected pcm_s16le, got {width * 8} bit"
    data = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    data = data.reshape(-1, channels).mean(axis=1)  # channel 0 only, per remotion
    return data, rate


def smoothen(magnitudes: np.ndarray) -> np.ndarray:
    arr = magnitudes.copy()
    for _ in range(3):
        padded = np.concatenate(([arr[0]], arr, [arr[-1]]))
        arr = (padded[:-2] + padded[1:-1] + padded[2:]) / 3.0
    return arr


def bars_at(wave_data: np.ndarray, rate: int, seconds: float, peak: float) -> np.ndarray:
    start = int(np.floor(seconds * rate))
    actual = max(0, start - SAMPLE_SIZE // 2)
    chunk = wave_data[actual : actual + SAMPLE_SIZE]
    if chunk.size < SAMPLE_SIZE:
        chunk = np.pad(chunk, (0, SAMPLE_SIZE - chunk.size))
    spectrum = np.abs(np.fft.rfft(chunk))
    mags = spectrum[: SAMPLE_SIZE // 2]
    # remotion scales the float waveform by 32767 before the FFT, then divides by
    # (sampleSize/2) * peak*32767 — the two 32767 factors cancel.
    return smoothen(mags) / (SAMPLE_SIZE / 2) / max(peak, 1e-9)


def main() -> None:
    data, rate = read_wav(WAV)
    duration = len(data) / rate
    peak = float(np.max(np.abs(data)))
    rms = float(np.sqrt(np.mean(data**2)))

    print(f"file      : {WAV.name}")
    print(f"duration  : {duration:.3f} s   rate {rate} Hz   peak {peak:.3f}   rms {rms:.4f}")
    print()

    print("t(s)    rms    centroidHz  low     mid     high")
    for step in range(0, int(duration * 10) + 1):
        t = step / 10.0
        lo = int(t * rate)
        hi = min(len(data), lo + int(0.2 * rate))
        if hi - lo < 256:
            continue
        window = data[lo:hi]
        spec = np.abs(np.fft.rfft(window * np.hanning(window.size)))
        freqs = np.fft.rfftfreq(window.size, 1 / rate)
        centroid = float((spec * freqs).sum() / max(spec.sum(), 1e-9))
        bar = bars_at(data, rate, t, peak)
        band = {
            name: float(np.mean(bar[from_i : to_i + 1]))
            for name, (from_i, to_i) in BANDS.items()
        }
        print(
            f"{t:5.1f} {np.sqrt(np.mean(window**2)):.4f}  {centroid:9.0f}   "
            f"{band['low']:.4f}  {band['mid']:.4f}  {band['high']:.4f}"
        )

    print()
    all_bars = []
    for frame in range(int(duration * FPS) + 1):
        # remotion averages frame-1, frame, frame+1 when smoothing is on
        stack = [
            bars_at(data, rate, (frame + delta) / FPS, peak) for delta in (-1, 0, 1)
        ]
        all_bars.append(np.mean(np.stack(stack), axis=0))
    matrix = np.stack(all_bars)

    print("99th percentile of each band group (paste into BAND_REFERENCE):")
    for name, (from_i, to_i) in BANDS.items():
        group = matrix[:, from_i : to_i + 1].mean(axis=1)
        print(
            f"  {name:5s} p99={np.percentile(group, 99):.4f}  "
            f"p95={np.percentile(group, 95):.4f}  max={group.max():.4f}  mean={group.mean():.4f}"
        )

    payload = {
        "fps": FPS,
        "frames": int(matrix.shape[0]),
        "bandBars": matrix.round(5).tolist(),
    }
    out = ROOT / "out" / "climax_real_bars.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"\nwrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
