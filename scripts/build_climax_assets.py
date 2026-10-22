"""Builds the char-level alignment (+ HPSS analysis reference).

Pipeline
--------
1. Read the 09.000–19.000 s slice of the reference mix.
2. HPSS (median-filter masks) -> percussive reference for onset detection (not shipped).
3. Detect vocal-band and low-band onset salience, merge into one candidate set.
4. Fit the drum beat grid (BPM + offset) from low-band onsets.
5. For each lyric line, pick exactly one onset per Chinese character with a
   dynamic program: maximise onset strength, penalise deviation from the
   measured eighth-note pulse. Every character therefore starts ON a real
   audio transient instead of on a guessed grid.
6. Write public/alignment/climax_words.json (seconds only, never frames) and
   print a verification report.
"""

from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "out" / "ref" / "segment_09_19.wav"
HPSS_OUT = ROOT / "out" / "ref" / "hpss_percussive.wav"
ALIGN = ROOT / "public" / "alignment" / "climax_words.json"

SR = 48000
HOP = 240
HOP_S = HOP / SR
N_FFT = 1024
DURATION = 10.0

# Caption-derived windows, measured frame by frame from the reference video.
# Times are relative to the 09.000 s cut-in point.
LINES = [
    {
        "id": "l1",
        "text": "玉境凌霄十万天兵合围",
        "start": 0.20,
        "end": 2.87,
    },
    {"id": "l2", "text": "怎敌我无坚不摧", "start": 2.87, "end": 4.73},
    {"id": "l3", "text": "五指山下偿自由的罪", "start": 4.73, "end": 7.04},
    {"id": "l4", "text": "罪名是老孙不敬权威", "start": 7.04, "end": 9.90},
]

MIN_CHAR_GAP = 0.13
TARGET_PULSE = 0.29  # eighth note at ~103.5 BPM
REGULARITY_LAMBDA = 26.0


def read(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as handle:
        channels, rate = handle.getnchannels(), handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    data = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(1)
    return data, rate


def fit(data: np.ndarray, rate: int, seconds: float) -> np.ndarray:
    target = int(round(seconds * rate))
    return data[:target] if data.size >= target else np.pad(data, (0, target - data.size))


def write_wav(path: Path, data: np.ndarray, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(pcm.tobytes())


def stft(x: np.ndarray):
    return signal.stft(
        x,
        fs=SR,
        window="hann",
        nperseg=N_FFT,
        noverlap=N_FFT - HOP,
        boundary="zeros",
        padded=True,
    )[2]


def istft(spec: np.ndarray, length: int) -> np.ndarray:
    _, y = signal.istft(
        spec,
        fs=SR,
        window="hann",
        nperseg=N_FFT,
        noverlap=N_FFT - HOP,
        boundary=True,
        input_onesided=True,
    )
    if y.size < length:
        return np.pad(y, (0, length - y.size))
    return y[:length]


def hpss(spec: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    mag = np.abs(spec)
    harmonic = ndimage.median_filter(mag, size=(1, 17), mode="nearest")
    percussive = ndimage.median_filter(mag, size=(17, 1), mode="nearest")
    h2, p2 = harmonic ** 2, percussive ** 2
    total = h2 + p2 + 1e-12
    return spec * (h2 / total), spec * (p2 / total)


def band_flux(spec, freqs, lo, hi, compress=1200.0):
    mag = np.abs(spec)[(freqs >= lo) & (freqs <= hi)]
    logmag = np.log1p(compress * mag)
    diff = np.diff(logmag, axis=1, prepend=logmag[:, :1])
    return np.maximum(diff, 0.0).mean(0)


def normalize(x: np.ndarray) -> np.ndarray:
    return (x - x.min()) / (x.max() - x.min() + 1e-12)


def fit_beat_grid(envelope: np.ndarray) -> tuple[float, float]:
    """Tempo + phase from the low-band onset envelope.

    Autocorrelation proposes the period; a circular-residual search refines it
    against the detected hits, which is robust to syncopated extra kicks.
    """
    x = envelope - envelope.mean()
    correlation = np.correlate(x, x, mode="full")[len(x) - 1 :]
    lag_lo = int(round(0.42 / HOP_S))
    lag_hi = int(round(0.88 / HOP_S))
    lag = int(np.argmax(correlation[lag_lo:lag_hi])) + lag_lo
    period = lag * HOP_S

    peaks, _ = signal.find_peaks(envelope, distance=int(0.3 / HOP_S), prominence=0.12)
    hits = peaks * HOP_S
    if hits.size < 4:
        return float(period), 0.0

    best = (np.inf, period, hits[0])
    for candidate in np.arange(period * 0.9, period * 1.1, 0.0005):
        for offset in np.arange(0.0, candidate, 0.005):
            phase = ((hits - offset) / candidate) % 1.0
            distance = np.minimum(phase, 1.0 - phase) * candidate
            cost = float(np.percentile(distance, 70))
            if cost < best[0]:
                best = (cost, float(candidate), float(offset))
    _, period, offset = best
    return float(period), float(offset % period)


def merge_candidates(entries):
    entries = sorted(entries, key=lambda item: item[0])
    merged: list[tuple[float, float, str]] = []
    for time, strength, source in entries:
        if merged and time - merged[-1][0] < 0.075:
            if strength > merged[-1][1]:
                merged[-1] = (time, strength, source)
            continue
        merged.append((time, strength, source))
    return merged


ANCHOR_WEIGHT = 24.0


def pick_line(onsets, line, count: int, floor: float) -> list[tuple[float, float, str]]:
    a, b = line["start"], line["end"]
    lower = max(a - 0.12, floor)
    pool = [o for o in onsets if lower <= o[0] <= b]
    if len(pool) < count:
        raise SystemExit(
            f"line {line['id']} only has {len(pool)} onsets for {count} chars"
        )

    n, m = count, len(pool)
    neg = -1e18
    score = np.full((m, n), neg)
    back = np.full((m, n), -1, dtype=int)
    strength = np.array([o[1] for o in pool])
    times = np.array([o[0] for o in pool])

    for i in range(m):
        # The first character is pulled toward the caption/topline start so a
        # pickup onset cannot drag the whole line late.
        score[i, 0] = strength[i] - ANCHOR_WEIGHT * (times[i] - a) ** 2
    for k in range(1, n):
        for i in range(m):
            best, argbest = neg, -1
            for j in range(i):
                delta = times[i] - times[j]
                if delta < MIN_CHAR_GAP:
                    continue
                if score[j, k - 1] <= neg / 2:
                    continue
                penalty = REGULARITY_LAMBDA * (delta - TARGET_PULSE) ** 2
                candidate = score[j, k - 1] + strength[i] - penalty
                if candidate > best:
                    best, argbest = candidate, j
            score[i, k] = best
            back[i, k] = argbest

    # Force the last character to finish inside the line window.
    end_index = int(np.argmax(score[:, n - 1]))
    if score[end_index, n - 1] <= neg / 2:
        raise SystemExit(f"line {line['id']} has no feasible DP path")

    chosen = [end_index]
    for k in range(n - 1, 0, -1):
        step = int(back[chosen[-1], k])
        if step < 0:
            raise SystemExit(f"line {line['id']} DP reconstruction failed at k={k}")
        chosen.append(step)
    chosen.reverse()
    if len(chosen) != n or len(set(chosen)) != n:
        raise SystemExit(f"line {line['id']} DP produced {len(chosen)} picks for {n} chars")
    return [pool[i] for i in chosen]


def main() -> None:
    audio, rate = read(SRC)
    audio = fit(audio, rate, DURATION)

    spec = stft(audio)
    freqs = np.fft.rfftfreq(N_FFT, d=1.0 / rate)
    harmonic_spec, percussive_spec = hpss(spec)

    drummy = istft(percussive_spec, audio.size)
    # Gentle low-shelf so kick transients dominate the camera-shake band.
    b, a = signal.butter(2, 180 / (rate / 2), btype="low")
    low_boost = signal.lfilter(b, a, drummy)
    drummy = drummy + 0.6 * low_boost
    drummy = drummy / (np.max(np.abs(drummy)) or 1.0) * 0.89
    # 只作为分析中间产物：整条鼓组轨道由 scripts/score.py 合成后写出。
    write_wav(HPSS_OUT, drummy, rate)
    print(f"hpss percussive (analysis only): {HPSS_OUT.relative_to(ROOT)}")

    vocal_env = ndimage.uniform_filter1d(normalize(band_flux(harmonic_spec, freqs, 300, 4500)), 3)
    low_env = ndimage.uniform_filter1d(normalize(band_flux(percussive_spec, freqs, 25, 200)), 3)

    vocal_peaks, _ = signal.find_peaks(vocal_env, distance=int(0.08 / HOP_S), prominence=0.05)
    low_peaks, _ = signal.find_peaks(low_env, distance=int(0.12 / HOP_S), prominence=0.09)

    candidates = merge_candidates(
        [(float(p * HOP_S), float(vocal_env[p]), "vocal") for p in vocal_peaks]
        + [(float(p * HOP_S), 0.9 * float(low_env[p]), "low") for p in low_peaks]
    )
    candidates = [c for c in candidates if 0.0 <= c[0] <= DURATION]
    print(f"candidates: {len(candidates)}")

    period, offset = fit_beat_grid(low_env)
    bpm = 60.0 / period
    print(f"beat grid: bpm={bpm:.3f} period={period:.4f}s offset={offset:.4f}s")

    units = []
    section_list = []
    cursor = 0.0
    for line in LINES:
        chars = list(line["text"])
        picks = pick_line(candidates, line, len(chars), cursor)
        cursor = picks[-1][0] + MIN_CHAR_GAP
        for index, (char, (time, strength, source)) in enumerate(zip(chars, picks)):
            if index + 1 < len(picks):
                end = round(picks[index + 1][0], 3)
            else:
                end = round(min(line["end"], time + 0.34), 3)
            units.append(
                {
                    "id": f"{line['id']}c{index + 1:02d}",
                    "text": char,
                    "start": round(time, 3),
                    "end": max(round(time + 0.06, 3), end),
                    "confidence": round(0.62 + 0.3 * strength, 3),
                    "energy": round(float(strength), 3),
                    "line": line["id"],
                    "source": source,
                }
            )
        section_list.append(
            {
                "id": line["id"],
                "start": round(picks[0][0], 3),
                "end": round(picks[-1][0] + 0.34, 3),
                "label": line["text"],
            }
        )

    # ---- final snap: every character lands on a mix transient --------------
    mix_env = ndimage.uniform_filter1d(
        normalize(band_flux(stft(audio), freqs, 220, 5200)), 3
    )
    mix_peaks, _ = signal.find_peaks(mix_env, distance=int(0.05 / HOP_S), prominence=0.06)
    mix_times = mix_peaks * HOP_S
    snapped = 0
    for index, unit in enumerate(units):
        distance = float(np.min(np.abs(mix_times - unit["start"])))
        if distance <= 0.05:
            continue
        nearest = float(mix_times[int(np.argmin(np.abs(mix_times - unit["start"])))])
        if abs(nearest - unit["start"]) > 0.13:
            continue
        previous = units[index - 1]["start"] if index > 0 else -1.0
        nxt = units[index + 1]["start"] if index + 1 < len(units) else DURATION
        if not (nearest > previous + 0.1 and nearest < nxt - 0.1):
            continue
        unit["start"] = round(nearest, 3)
        unit["source"] = "mix-snap"
        snapped += 1
    print(f"snapped {snapped} character(s) onto detected mix transients")

    # Re-derive every end from the (possibly moved) starts.
    for line in LINES:
        line_units = [unit for unit in units if unit["line"] == line["id"]]
        for index, unit in enumerate(line_units):
            if index + 1 < len(line_units):
                unit["end"] = line_units[index + 1]["start"]
            else:
                unit["end"] = round(min(line["end"], unit["start"] + 0.34), 3)
            unit["end"] = max(round(unit["start"] + 0.06, 3), unit["end"])

    for section, line in zip(section_list, LINES):
        line_units = [unit for unit in units if unit["line"] == line["id"]]
        section["start"] = line_units[0]["start"]
        section["end"] = round(line_units[-1]["start"] + 0.34, 3)

    # Strictly monotonic starts are required by assertValidAlignment.
    for previous, current in zip(units, units[1:]):
        if current["start"] <= previous["start"]:
            raise SystemExit(f"non-monotonic units at {previous['id']}")

    beats = []
    index = 0
    while offset + index * period <= DURATION + 1e-6:
        if offset + index * period >= 0:
            beats.append(round(offset + index * period, 3))
        index += 1

    document = {
        "version": 1,
        "source": "HPSS onset alignment on 09.000–19.000 s reference slice",
        "mode": "char",
        "audio": "audio/drums_stem.wav",
        "fps": 30,
        "duration": DURATION,
        "units": units,
        "sections": section_list,
        "beats": {"bpm": round(bpm, 2), "offset": round(offset, 3), "beats": beats},
    }
    ALIGN.parent.mkdir(parents=True, exist_ok=True)
    ALIGN.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"alignment: {ALIGN.relative_to(ROOT)}  {len(units)} units")

    # ---------------- verification ----------------
    onset_times = np.array([c[0] for c in candidates])
    mix_distances = [float(np.min(np.abs(mix_times - unit["start"]))) for unit in units]
    print(f"max |start - nearest mix transient|    = {max(mix_distances) * 1000:.1f} ms")
    pulse = period / 2.0
    worst_candidate = 0.0
    worst_pulse = 0.0
    within_50ms = 0
    for unit in units:
        worst_candidate = max(worst_candidate, float(np.min(np.abs(onset_times - unit["start"]))))
        phase = (unit["start"] - offset) / pulse
        deviation = abs(phase - round(phase)) * pulse
        worst_pulse = max(worst_pulse, deviation)
        if deviation <= 0.05:
            within_50ms += 1
    print(f"max |start - nearest detected onset|  = {worst_candidate * 1000:.1f} ms")
    print(f"max |start - nearest eighth-note|     = {worst_pulse * 1000:.1f} ms  "
          f"(pulse {pulse * 1000:.0f} ms, {within_50ms}/{len(units)} units <= 50 ms)")

    print("\nper line:")
    for line in LINES:
        line_units = [u for u in units if u["line"] == line["id"]]
        stamps = " ".join(f"{u['start']:.2f}" for u in line_units)
        gaps = " ".join(f"{(b['start'] - a['start']):.2f}" for a, b in zip(line_units, line_units[1:]))
        print(f"  {line['text']}  n={len(line_units)}")
        print(f"    start: {stamps}")
        print(f"    gaps : {gaps}")

    # Energy summary so the scene can be checked against the stem.
    low_track, high_track = [], []
    for frame in range(int(DURATION * 30)):
        lo = int(frame / 30 * rate)
        hi = min(audio.size, int((frame + 1) / 30 * rate))
        _, _, s = signal.stft(drummy[lo:hi], fs=SR, nperseg=256, noverlap=128)
        power = np.abs(s) ** 2
        f = np.fft.rfftfreq(256, d=1 / SR)
        low_track.append(float(power[f < 200].sum()))
        high_track.append(float(power[f > 2000].sum()))
    low_track, high_track = normalize(np.array(low_track)), normalize(np.array(high_track))
    print(f"stem low band  max={low_track.max():.2f} mean={low_track.mean():.2f}")
    print(f"stem high band max={high_track.max():.2f} mean={high_track.mean():.2f}")
    np.savez(
        ROOT / "out" / "ref" / "stem_energy.npz",
        low=low_track,
        high=high_track,
        beats=np.array(beats),
    )


if __name__ == "__main__":
    main()
