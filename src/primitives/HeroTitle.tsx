import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACKS, PALETTE} from '../config/theme';
import {clamp, springPhysics} from '../utils/math';

export interface HeroTitleProps {
  /** Vertical characters, top to bottom. */
  text: string;
  /** Seconds the title slams in. */
  startSeconds: number;
  /** Centre in canvas px. */
  x: number;
  y: number;
  size?: number;
  rotate?: number;
  opacity?: number;
  /** 0–1 drum accent. */
  pulse?: number;
}

/**
 * 主角级竖排大字.
 *
 * 画面需要一个"主体"。在没有插画资产的前提下，唯一能画到专业水准的主体是**字**：
 * 700px 竖排、鎏金渐变、朱砂描边、半调阴影、裁切出画框。字就是构图本身。
 */
export const HeroTitle: React.FC<HeroTitleProps> = ({
  text,
  startSeconds,
  x,
  y,
  size = 720,
  rotate = 0,
  opacity = 1,
  pulse = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame / fps - startSeconds;
  if (local < -0.01) return null;
  const pop = springPhysics(clamp((local + 0.02) / 0.34), {
    stiffness: 260,
    damping: 14,
    mass: 0.9,
    duration: 0.34,
  });
  const scale = 0.72 + pop * 0.3;
  const fade = clamp(local / 0.08);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${(scale + pulse * 0.02).toFixed(4)})`,
        opacity: opacity * fade,
        pointerEvents: 'none',
      }}
    >
      <div style={{position: 'relative', display: 'inline-block'}}>
        {/* 半调投影：把字"压"到画里，而不是浮在上面 */}
        <span
          style={{
            position: 'absolute',
            left: 18,
            top: 22,
            fontFamily: FONT_STACKS.heavy,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
            color: 'rgba(11,9,10,0.55)',
            writingMode: 'vertical-rl',
            filter: 'blur(6px)',
          }}
        >
          {text}
        </span>
        {/* 朱砂描边 */}
        <span
          style={{
            fontFamily: FONT_STACKS.heavy,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
            color: 'transparent',
            WebkitTextStroke: `${Math.round(size * 0.022)}px ${PALETTE.cinnabar}`,
            writingMode: 'vertical-rl',
            display: 'block',
          }}
        >
          {text}
        </span>
        {/* 鎏金填色 */}
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            fontFamily: FONT_STACKS.heavy,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 0.92,
            letterSpacing: '-0.02em',
            backgroundImage:
              'linear-gradient(176deg, #F4EFE6 0%, #FCC934 26%, #E4AE28 58%, #FCC934 82%, #F4EFE6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            writingMode: 'vertical-rl',
            display: 'block',
            filter: `drop-shadow(0 0 ${Math.round(size * 0.08)}px rgba(252,201,52,${(0.25 + pulse * 0.2).toFixed(2)}))`,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
