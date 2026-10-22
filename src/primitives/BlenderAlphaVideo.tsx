import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';

export interface BlenderAlphaVideoProps {
  /** File name inside public/blender_renders/, e.g. `cudgel_shatter_01.webm`. */
  file: string;
  startFrom?: number;
  playbackRate?: number;
  muted?: boolean;
  opacity?: number;
  blendMode?: React.CSSProperties['mixBlendMode'];
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Transparent Blender render (VP9 + alpha WebM or ProRes 4444).
 *
 * The heavy 3D simulation is never evaluated in the browser. Remotion only
 * plays back a pre-rendered alpha matte with `transparent`, which keeps the
 * render deterministic and the component tree light.
 *
 * - startFrom is a frame offset, not seconds.
 * - Pass `muted={false}` only when the effect itself carries designed sound.
 */
export const BlenderAlphaVideo: React.FC<BlenderAlphaVideoProps> = ({
  file,
  startFrom,
  playbackRate = 1,
  muted = true,
  opacity = 1,
  blendMode,
  style,
  className,
}) => (
  <OffthreadVideo
    src={staticFile(`blender_renders/${file}`)}
    startFrom={startFrom}
    playbackRate={playbackRate}
    muted={muted}
    transparent
    style={{
      opacity,
      mixBlendMode: blendMode,
      pointerEvents: 'none',
      ...style,
    }}
    className={className}
  />
);
