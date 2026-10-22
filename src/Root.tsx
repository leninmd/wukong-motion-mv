import React from 'react';
import {Composition} from 'remotion';
import {CANVAS, CLIMAX} from './config/theme';
import {
  WUKONG_PROLOGUE_ID,
  WUKONG_PROLOGUE_SECONDS,
  WukongPrologue,
} from './compositions/WukongPrologue';
import {
  WUKONG_CLIMAX_ID,
  WUKONG_CLIMAX_SECONDS,
  WukongClimaxSegment,
} from './sequences/WukongClimaxSegment';
import {durationInFrames} from './utils/timing';

/**
 * Main render registry.
 *
 * Two entries only:
 *   WukongPrologue       60 fps foundation plate (master spec)
 *   WukongClimaxSegment  30 fps reference-match segment (09–19 s imitation)
 *
 * The climax composition is registered at 30 fps because the reference slice
 * it imitates is 30 fps / 300 frames; the override is declared in
 * `src/config/theme.ts` (CLIMAX) instead of being buried in a call site.
 * All nine archived Du Fu scenes stay out of this list.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={WUKONG_PROLOGUE_ID}
        component={WukongPrologue}
        durationInFrames={durationInFrames(WUKONG_PROLOGUE_SECONDS, CANVAS.fps)}
        fps={CANVAS.fps}
        width={CANVAS.width}
        height={CANVAS.height}
      />
      <Composition
        id={WUKONG_CLIMAX_ID}
        component={WukongClimaxSegment}
        durationInFrames={durationInFrames(WUKONG_CLIMAX_SECONDS, CLIMAX.fps)}
        fps={CLIMAX.fps}
        width={CLIMAX.width}
        height={CLIMAX.height}
      />
    </>
  );
};
