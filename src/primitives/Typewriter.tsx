import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp} from '../utils/math';

export interface TypewriterProps {
  text: string;
  startFrame: number;
  endFrame: number;
  showCursor?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Performance-safe lyric reveal.
 *
 * This is deliberately a single text node sliced with `String.slice()`. It does
 * NOT map each character to a span and animate opacity, which would explode the
 * DOM and destroy Chrome's text shaping during a 60 fps render.
 */
export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame,
  endFrame,
  showCursor = true,
  className,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const span = Math.max(1, endFrame - startFrame);
  const progress = clamp((frame - startFrame) / span);
  const count = Math.min(text.length, Math.floor(progress * text.length));
  const visible = text.slice(0, count);
  const isTyping = frame >= startFrame && frame < endFrame;
  const cursorVisible = isTyping
    ? Math.floor((frame - startFrame) / Math.max(1, fps / 5)) % 2 === 0
    : false;

  return (
    <span
      className={className}
      style={{whiteSpace: 'pre-wrap', display: 'inline-block', ...style}}
      aria-label={text}
    >
      {visible}
      {showCursor && cursorVisible ? (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '0.055em',
            height: '0.82em',
            marginLeft: '0.06em',
            verticalAlign: '-0.04em',
            backgroundColor: 'currentColor',
          }}
        />
      ) : null}
    </span>
  );
};
