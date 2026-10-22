/**
 * The only legal bridge between seconds and frames.
 *
 * Alignment JSON stores human/tooling-friendly seconds. A render never stores
 * baked frame numbers. This keeps 30/60/90 fps masters in sync with one clock.
 */

export const frameFromSeconds = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);

export const secondsFromFrame = (frame: number, fps: number): number => frame / fps;

export const frameSpanFromSeconds = (
  startSeconds: number,
  endSeconds: number,
  fps: number,
): {startFrame: number; endFrame: number; durationInFrames: number} => {
  const startFrame = frameFromSeconds(startSeconds, fps);
  const endFrame = Math.max(startFrame + 1, frameFromSeconds(endSeconds, fps));
  return {startFrame, endFrame, durationInFrames: endFrame - startFrame};
};

/** A duration expressed in seconds, guaranteed to occupy at least one frame. */
export const durationInFrames = (seconds: number, fps: number): number =>
  Math.max(1, Math.round(seconds * fps));

export const isFrameInSpan = (
  frame: number,
  startSeconds: number,
  endSeconds: number,
  fps: number,
): boolean => {
  const start = frameFromSeconds(startSeconds, fps);
  const end = frameFromSeconds(endSeconds, fps);
  return frame >= start && frame < end;
};

export const beatFrame = (
  beatIndex: number,
  bpm: number,
  offsetSeconds: number,
  fps: number,
): number => frameFromSeconds(offsetSeconds + (beatIndex * 60) / bpm, fps);
