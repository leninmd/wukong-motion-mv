import rawAlignment from '../../public/alignment/climax_words.json';
import type {StemEnergy} from '../audio/spectrum';
import {
  assertValidAlignment,
  toFrameSpan,
  type AlignmentDocument,
  type AlignmentUnit,
} from '../utils/alignment';
import {frameFromSeconds} from '../utils/timing';

/**
 * Single source of truth for the climax segment.
 *
 * The alignment JSON stores seconds only. Every frame number below is derived
 * from the composition's runtime fps through `toFrameSpan()` / `frameFromSeconds()`
 * — never baked into the document and never hardcoded in the scene.
 */
export type ClimaxUnit = AlignmentUnit & {
  /** Lyric line id this character belongs to (l1–l4). */
  line?: string;
  /** Which onset detector produced the timestamp. */
  source?: string;
};

export interface ClimaxAlignmentDocument extends AlignmentDocument {
  units: ClimaxUnit[];
}

export const CLIMAX_ALIGNMENT = rawAlignment as unknown as ClimaxAlignmentDocument;
assertValidAlignment(CLIMAX_ALIGNMENT);

export const CLIMAX_DURATION_SECONDS = CLIMAX_ALIGNMENT.duration;
export const CLIMAX_LYRIC = CLIMAX_ALIGNMENT.sections?.map((section) => section.label ?? '') ?? [];

export interface ClimaxShot {
  id: string;
  label: string;
  /** Seconds, straight from the alignment document. */
  start: number;
  end: number;
  units: ClimaxUnit[];
  startFrame: number;
  endFrame: number;
}

/** Resolves the four lyric sections into frames for the current fps. */
export const climaxShots = (fps: number): ClimaxShot[] => {
  const sections = CLIMAX_ALIGNMENT.sections ?? [];
  return sections.map((section) => {
    const units = CLIMAX_ALIGNMENT.units.filter((unit) => unit.line === section.id);
    const span = toFrameSpan(
      {
        text: section.label ?? section.id,
        start: section.start,
        end: section.end,
      },
      fps,
    );
    return {
      id: section.id,
      label: section.label ?? '',
      start: section.start,
      end: section.end,
      units,
      startFrame: span.startFrame,
      endFrame: span.endFrame,
    };
  });
};

export const shotIndexAtSeconds = (seconds: number): number => {
  const sections = CLIMAX_ALIGNMENT.sections ?? [];
  let index = 0;
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (section && seconds >= section.start) index = i;
  }
  return index;
};

const unitById = (id: string): ClimaxUnit => {
  const unit = CLIMAX_ALIGNMENT.units.find((candidate) => candidate.id === id);
  if (!unit) throw new Error(`[climax] burst cue references unknown unit "${id}"`);
  return unit;
};

/* -------------------------------------------------------------------------- */
/*  Kinetic typography cues                                                   */
/* -------------------------------------------------------------------------- */

export interface BurstCue {
  id: string;
  text: string;
  start: number;
  /** Seconds the burst stays on screen. */
  hold: number;
  /** Centre in canvas fractions. */
  x: number;
  y: number;
  size: number;
  rotate: number;
  /** 0–1, scales the added ink splash and speed streaks. */
  power: number;
}

/**
 * Core burst characters. The four "hero" glyphs sit at 184 px, the supporting
 * ones at 118–150 px so the frame does not turn into a wall of type. Timing is
 * pulled from the aligned unit, never typed in.
 */
const BURST_SELECTION: Array<{
  unitId: string;
  x: number;
  y: number;
  size: number;
  rotate: number;
  power: number;
  hold: number;
}> = [
  {unitId: 'l1c07', x: 0.705, y: 0.335, size: 132, rotate: -6, power: 0.7, hold: 0.55},
  {unitId: 'l1c10', x: 0.5, y: 0.435, size: 184, rotate: 2, power: 0.95, hold: 0.62},
  {unitId: 'l2c05', x: 0.285, y: 0.4, size: 124, rotate: -8, power: 0.66, hold: 0.5},
  {unitId: 'l2c07', x: 0.525, y: 0.495, size: 184, rotate: -3, power: 1, hold: 0.66},
  {unitId: 'l3c03', x: 0.735, y: 0.3, size: 140, rotate: 5, power: 0.74, hold: 0.52},
  {unitId: 'l3c09', x: 0.415, y: 0.545, size: 184, rotate: -4, power: 1, hold: 0.66},
  {unitId: 'l4c08', x: 0.335, y: 0.355, size: 150, rotate: -5, power: 0.82, hold: 0.5},
  {unitId: 'l4c09', x: 0.565, y: 0.5, size: 184, rotate: 3, power: 1, hold: 0.72},
];

export const BURST_CUES: BurstCue[] = BURST_SELECTION.map((selection) => {
  const unit = unitById(selection.unitId);
  return {
    id: selection.unitId,
    text: unit.text,
    start: unit.start,
    hold: selection.hold,
    x: selection.x,
    y: selection.y,
    size: selection.size,
    rotate: selection.rotate,
    power: selection.power,
  };
});

/* -------------------------------------------------------------------------- */
/*  Impact / camera cues                                                     */
/* -------------------------------------------------------------------------- */

export interface ImpactCue {
  unitId: string;
  start: number;
  power: number;
  /** 'flash' blinks the frame, 'slash' launches the cudgel arc. */
  kind: 'flash' | 'slash';
}

const IMPACT_SELECTION: Array<{unitId: string; power: number; kind: 'flash' | 'slash'}> = [
  {unitId: 'l1c04', power: 0.62, kind: 'slash'},
  {unitId: 'l1c07', power: 0.86, kind: 'slash'},
  {unitId: 'l1c10', power: 1, kind: 'flash'},
  {unitId: 'l2c01', power: 0.72, kind: 'slash'},
  {unitId: 'l2c03', power: 0.8, kind: 'slash'},
  {unitId: 'l2c05', power: 0.9, kind: 'slash'},
  {unitId: 'l2c07', power: 1, kind: 'flash'},
  {unitId: 'l3c01', power: 0.95, kind: 'flash'},
  {unitId: 'l3c05', power: 0.62, kind: 'slash'},
  {unitId: 'l3c09', power: 0.82, kind: 'flash'},
  {unitId: 'l4c01', power: 0.7, kind: 'flash'},
  {unitId: 'l4c08', power: 0.8, kind: 'flash'},
  {unitId: 'l4c09', power: 1, kind: 'flash'},
];

export const IMPACT_CUES: ImpactCue[] = IMPACT_SELECTION.map((selection) => ({
  ...selection,
  start: unitById(selection.unitId).start,
}));

export const SLASH_CUES = IMPACT_CUES.filter((cue) => cue.kind === 'slash');
export const FLASH_CUES = IMPACT_CUES.filter((cue) => cue.kind === 'flash');

export interface ResolvedImpact {
  startFrame: number;
  power: number;
}

export const resolveCues = (cues: readonly ImpactCue[], fps: number): ResolvedImpact[] =>
  cues.map((cue) => ({startFrame: frameFromSeconds(cue.start, fps), power: cue.power}));

/* -------------------------------------------------------------------------- */
/*  Storyboard beats (seconds, derived from alignment)                        */
/* -------------------------------------------------------------------------- */

export const STORY = {
  courtAssemble: CLIMAX_ALIGNMENT.units[0]?.start ?? 0,
  courtCollapse: CLIMAX_ALIGNMENT.sections?.[1]?.start ?? 0,
  mountainDescent: CLIMAX_ALIGNMENT.sections?.[2]?.start ?? 0,
  mountainLock: CLIMAX_ALIGNMENT.sections?.[3]?.start ?? 0,
} as const;

/* -------------------------------------------------------------------------- */
/*  Deterministic fallback                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Used only while the stem is still decoding. It reproduces the transient
 * envelope from the aligned onsets so a still frame keeps its punch instead of
 * rendering a flat, motionless plate.
 */
export const fallbackEnergy = (seconds: number): StemEnergy => {
  let best = Number.POSITIVE_INFINITY;
  for (const unit of CLIMAX_ALIGNMENT.units) {
    const distance = Math.abs(seconds - unit.start);
    if (distance < best) best = distance;
  }
  const attack = Math.exp(-best / 0.085);
  return {
    low: attack,
    mid: attack * 0.88,
    high: attack * 0.62,
    level: attack,
  };
};
