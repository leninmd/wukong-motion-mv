import React from 'react';
import {Composition} from 'remotion';
import {CANVAS} from './config/theme';
import {
  WUKONG_PROLOGUE_ID,
  WUKONG_PROLOGUE_SECONDS,
  WukongPrologue,
} from './compositions/WukongPrologue';
import {durationInFrames} from './utils/timing';

/**
 * Main render registry.
 *
 * Only the new Wukong foundation plate is registered. All nine archived Du Fu
 * scenes and their storyboard data are intentionally absent from this list.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={WUKONG_PROLOGUE_ID}
      component={WukongPrologue}
      durationInFrames={durationInFrames(WUKONG_PROLOGUE_SECONDS, CANVAS.fps)}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
    />
  );
};
