import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp} from '../utils/math';

/**
 * Mandatory spectrum contract.
 *
 * Bind this hook to the isolated drum stem or the instrumental bed, never the
 * full mix. 32 buckets is enough for a graphic accent and keeps every frame
 * under budget; `optimizeFor: 'speed'` keeps the render CPU-bound, not FFT-bound.
 */
export const SPECTRUM_SETTINGS = {
  numberOfSamples: 32,
  smoothing: true,
  optimizeFor: 'speed',
} as const;

export interface StemSpectrumOptions {
  /** staticFile('audio/drums_stem.wav') or instrumental/accompaniment stem. */
  src: string;
  /** Optional latency compensation in seconds. */
  dataOffsetInSeconds?: number;
}

/**
 * Returns 32 normalised frequency amplitudes for the current frame, or null
 * while the audio metadata is still loading.
 *
 * Never pass the lead vocal or the final mix here: vocal sibilance produces
 * nervous, semantically meaningless bars.
 */
export const useStemSpectrum = ({
  src,
  dataOffsetInSeconds = 0,
}: StemSpectrumOptions): number[] | null => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const audioData = useAudioData(src);

  if (!audioData) return null;

  return visualizeAudio({
    audioData,
    frame,
    fps,
    numberOfSamples: SPECTRUM_SETTINGS.numberOfSamples,
    smoothing: SPECTRUM_SETTINGS.smoothing,
    optimizeFor: SPECTRUM_SETTINGS.optimizeFor,
    dataOffsetInSeconds,
  });
};

export {visualizeAudio};

/* -------------------------------------------------------------------------- */
/*  Band energy                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 32 buckets of a 64-sample FFT are not linear in frequency, so the groups
 * below were measured against `drums_stem.wav` with `scripts/spectrum_probe.mjs`
 * instead of guessed: bucket 0–2 carries the kick, 3–15 the snare body and
 * 16–31 the hi-hats. The measured 99th-percentile peak of each group becomes
 * the reference so all three bands share one 0–1 scale.
 */
const BAND_SLICES = {
  low: [0, 2],
  mid: [3, 15],
  high: [16, 31],
} as const;

export const BAND_REFERENCE = {
  low: 0.72,
  mid: 0.045,
  high: 0.013,
} as const;

export interface StemEnergy {
  /** Kick / bass body, 0–1. Drives camera shake. */
  low: number;
  /** Snare and vocal body, 0–1. Drives impact flashes. */
  mid: number;
  /** Hi-hats and cymbal wash, 0–1. Drives edge glow and grain. */
  high: number;
  /** Weighted overall loudness, 0–1. */
  level: number;
}

const meanSlice = (
  bars: readonly number[],
  [from, to]: readonly [number, number],
): number => {
  let sum = 0;
  for (let index = from; index <= to; index += 1) sum += bars[index] ?? 0;
  return sum / (to - from + 1);
};

export interface StemEnergyOptions {
  /** staticFile('audio/drums_stem.wav'). */
  src: string;
  /** Frames of attack hold, so a 1-frame transient stays readable. */
  lookbehind?: number;
  dataOffsetInSeconds?: number;
}

/**
 * Normalised low / mid / high energy for the current frame.
 *
 * Still bound to the drum stem through the same `SPECTRUM_SETTINGS`; the only
 * extra work is a short max-hold across the previous frames, which turns the
 * noisy 64-sample FFT into a stable visual accent without touching the audio.
 *
 * Returns `null` while the stem is still decoding, so scenes must provide a
 * deterministic fallback instead of freezing at zero.
 */
export const useStemEnergy = ({
  src,
  lookbehind = 3,
  dataOffsetInSeconds = 0,
}: StemEnergyOptions): StemEnergy | null => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const audioData = useAudioData(src);

  return useMemo(() => {
    if (!audioData) return null;
    let low = 0;
    let mid = 0;
    let high = 0;
    for (let back = 0; back <= lookbehind; back += 1) {
      const bars = visualizeAudio({
        audioData,
        frame: Math.max(0, frame - back),
        fps,
        numberOfSamples: SPECTRUM_SETTINGS.numberOfSamples,
        smoothing: SPECTRUM_SETTINGS.smoothing,
        optimizeFor: SPECTRUM_SETTINGS.optimizeFor,
        dataOffsetInSeconds,
      });
      low = Math.max(low, meanSlice(bars, BAND_SLICES.low));
      mid = Math.max(mid, meanSlice(bars, BAND_SLICES.mid));
      high = Math.max(high, meanSlice(bars, BAND_SLICES.high));
    }
    const lowNorm = low / BAND_REFERENCE.low;
    const midNorm = mid / BAND_REFERENCE.mid;
    const highNorm = high / BAND_REFERENCE.high;
    return {
      low: clamp(lowNorm),
      mid: clamp(midNorm),
      high: clamp(highNorm),
      level: clamp(lowNorm * 0.55 + midNorm * 0.3 + highNorm * 0.15),
    };
  }, [audioData, dataOffsetInSeconds, fps, frame, lookbehind]);
};
