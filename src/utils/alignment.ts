import {staticFile} from 'remotion';
import {frameFromSeconds} from './timing';

/**
 * Millisecond-grade word/character alignment contract.
 *
 * All lyric animation MUST resolve timing through `toFrameSpan()` using the
 * composition's runtime fps. The JSON deliberately stores only seconds.
 */
export type AlignmentUnitMode = 'char' | 'word' | 'line';

export interface AlignmentUnit {
  /** Stable id shared with ComfyUI/Blender cue sheets. */
  id?: string;
  /** Exact lyric fragment. Do not normalise punctuation away. */
  text: string;
  /** Start in seconds from the beginning of the audio file. */
  start: number;
  /** End in seconds. Must be greater than start. */
  end: number;
  /** Optional confidence score (0–1) from the forced aligner. */
  confidence?: number;
  /** Optional energy peak from the source vocal. */
  energy?: number;
}

export interface BeatGrid {
  bpm: number;
  /** Silence before the first downbeat, in seconds. */
  offset: number;
  /** Explicit beat timestamps in seconds. Preferred over a generated grid. */
  beats?: number[];
}

export interface AlignmentDocument {
  version: 1;
  source?: string;
  mode: AlignmentUnitMode;
  /** Audio file this alignment belongs to, relative to public/. */
  audio: string;
  /** Runtime reference. Consumers must still use the composition fps. */
  fps?: number;
  /** Total duration in seconds. */
  duration: number;
  units: AlignmentUnit[];
  beats?: BeatGrid;
  sections?: Array<{
    id: string;
    start: number;
    end: number;
    label?: string;
  }>;
}

export interface AlignmentFrameSpan {
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
}

/** Converts one aligned unit into frames at the composition's actual fps. */
export const toFrameSpan = (unit: AlignmentUnit, fps: number): AlignmentFrameSpan => {
  const startFrame = frameFromSeconds(unit.start, fps);
  const endFrame = Math.max(startFrame + 1, frameFromSeconds(unit.end, fps));
  return {
    startFrame,
    endFrame,
    durationInFrames: endFrame - startFrame,
  };
};

export const unitAtFrame = (
  document: AlignmentDocument,
  frame: number,
  fps: number,
): AlignmentUnit | null => {
  let match: AlignmentUnit | null = null;
  for (const unit of document.units) {
    const {startFrame, endFrame} = toFrameSpan(unit, fps);
    if (frame >= startFrame && frame < endFrame) {
      match = unit;
    }
  }
  return match;
};

export const assertValidAlignment = (document: AlignmentDocument): void => {
  if (!document.units.length) {
    throw new Error('[alignment] `units` is empty.');
  }
  let previousStart = Number.NEGATIVE_INFINITY;
  for (const [index, unit] of document.units.entries()) {
    if (!Number.isFinite(unit.start) || !Number.isFinite(unit.end)) {
      throw new Error(`[alignment] Unit ${index} has non-finite timing.`);
    }
    if (unit.end <= unit.start) {
      throw new Error(
        `[alignment] Unit ${index} (${JSON.stringify(unit.text)}) has end <= start.`,
      );
    }
    if (unit.start < previousStart) {
      throw new Error('[alignment] Units must be sorted by start time.');
    }
    previousStart = unit.start;
  }
};

export const loadAlignment = async (
  relativePath: string,
): Promise<AlignmentDocument> => {
  const response = await fetch(staticFile(relativePath));
  if (!response.ok) {
    throw new Error(
      `[alignment] Failed to load ${relativePath}: HTTP ${response.status}`,
    );
  }
  const document = (await response.json()) as AlignmentDocument;
  assertValidAlignment(document);
  return document;
};
