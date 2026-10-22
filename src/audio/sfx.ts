import {rng} from '../utils/math';
import {frameFromSeconds} from '../utils/timing';

/**
 * SFX scheduling extracted from the original Python build (`sfx` cue table +
 * paired schedule implementations). The renderer consumes cue frames; the
 * Web Audio helper is preview-only and never part of a deterministic render.
 */
export type SfxKind =
  | 'impact'
  | 'whoosh'
  | 'gong'
  | 'ember'
  | 'click'
  | 'sub-drop';

export interface SfxCue {
  /** Seconds on the master audio timeline. */
  atSeconds: number;
  kind: SfxKind;
  gain?: number;
  /** Human-readable editorial reason; never parsed by code. */
  note?: string;
}

export interface ScheduledSfxCue extends SfxCue {
  frame: number;
}

export const scheduleSfx = (
  cues: readonly SfxCue[],
  fps: number,
): ScheduledSfxCue[] =>
  cues
    .map((cue) => ({...cue, frame: frameFromSeconds(cue.atSeconds, fps)}))
    .sort((a, b) => a.frame - b.frame);

export const sfxCuesInRange = (
  cues: readonly ScheduledSfxCue[],
  fromFrame: number,
  toFrame: number,
): ScheduledSfxCue[] =>
  cues.filter((cue) => cue.frame >= fromFrame && cue.frame < toFrame);

const makeNoiseBuffer = (context: AudioContext, seconds: number, seed: number): AudioBuffer => {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  const random = rng(seed);
  for (let i = 0; i < length; i += 1) {
    const envelope = 1 - i / length;
    channel[i] = (random() * 2 - 1) * envelope;
  }
  return buffer;
};

const tone = (
  context: AudioContext,
  type: OscillatorType,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
  endFrequency = frequency,
): void => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(20, endFrequency),
    start + duration,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
};

/**
 * Web Audio preview for the studio. It is intentionally not used by Remotion
 * rendering; final cues are rendered from files in public/audio.
 */
export const playSfxPreview = (
  context: AudioContext,
  kind: SfxKind,
  atTime = context.currentTime,
  gain = 1,
): void => {
  const level = Math.max(0.01, gain);

  switch (kind) {
    case 'impact': {
      tone(context, 'sine', 92, atTime, 0.28, 0.75 * level, 42);
      tone(context, 'triangle', 210, atTime, 0.09, 0.20 * level, 120);
      break;
    }
    case 'whoosh': {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.1;
      filter.frequency.setValueAtTime(280, atTime);
      filter.frequency.exponentialRampToValueAtTime(2600, atTime + 0.32);
      source.buffer = makeNoiseBuffer(context, 0.45, 771);
      source.connect(filter).connect(context.destination);
      source.start(atTime);
      break;
    }
    case 'gong': {
      const partials = [72, 151, 238, 366];
      partials.forEach((frequency, index) => {
        tone(
          context,
          'sine',
          frequency,
          atTime,
          2.8 - index * 0.35,
          (0.24 / (index + 1)) * level,
          frequency * 0.985,
        );
      });
      break;
    }
    case 'ember': {
      tone(context, 'sine', 1680, atTime, 0.12, 0.10 * level, 960);
      break;
    }
    case 'click': {
      tone(context, 'square', 1180, atTime, 0.025, 0.08 * level, 420);
      break;
    }
    case 'sub-drop': {
      tone(context, 'sine', 70, atTime, 0.9, 0.8 * level, 26);
      break;
    }
  }
};
