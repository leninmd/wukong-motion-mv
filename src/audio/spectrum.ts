import {useAudioData, visualizeAudio} from '@remotion/media-utils';
import {useCurrentFrame, useVideoConfig} from 'remotion';

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
