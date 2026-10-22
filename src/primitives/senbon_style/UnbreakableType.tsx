import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {SERIF_STACK, SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 2 末：可读的「无坚不摧」劈字。
 *
 * 硬性要求（验收帧 120 必须 100% 认得出这四个字）：
 *  - 上下两半**只**沿 15° 刀痕方向错位 12px；
 *  - 两半之间垂直间距只拉开 6px；
 *  - 任何一半都在自己的 clip 半平面内完整保留四个字，不截笔画。
 * 整串文字是**一个**文本节点（AGENTS.md §2），刀口靠两个半平面 clip 实现。
 */

export interface UnbreakableTypeProps {
  text: string;
  time: number;
  revealAt: number;
  cutAt: number;
  pulse?: number;
}

const W = 1920;
const H = 1080;
const CUT_DEG = 15;
const CUT_SHIFT = 12;
const CUT_GAP = 6;
const FONT = 236;

/** 15° 刀痕与画框的两个交点（y = 540 处过中线）。 */
const RAD = (CUT_DEG * Math.PI) / 180;
const LEFT: [number, number] = [0, H / 2 - (W / 2) * Math.tan(RAD)];
const RIGHT: [number, number] = [W, H / 2 + (W / 2) * Math.tan(RAD)];

const clipUpper = `polygon(${LEFT[0]}px ${f(LEFT[1])}px, ${RIGHT[0]}px ${f(RIGHT[1])}px, ${W}px 0px, 0px 0px)`;
const clipLower = `polygon(${LEFT[0]}px ${f(LEFT[1])}px, ${RIGHT[0]}px ${f(RIGHT[1])}px, ${W}px ${H}px, 0px ${H}px)`;

const DIR = {x: Math.cos(RAD), y: Math.sin(RAD)};
const PERP = {x: -Math.sin(RAD), y: Math.cos(RAD)};

export const UnbreakableType: React.FC<UnbreakableTypeProps> = ({text, time, revealAt, cutAt, pulse = 0}) => {
  if (time < revealAt - 0.001) return null;
  const appear = clamp((time - revealAt) / 0.16);
  const cut = clamp((time - cutAt) / 0.14);
  const cutEase = easeOutCubic(cut);
  const flash = cut > 0 && cut < 1 ? 1 - cut : 0;

  const upper = {
    x: -DIR.x * (CUT_SHIFT / 2) * cutEase - PERP.x * (CUT_GAP / 2) * cutEase,
    y: -DIR.y * (CUT_SHIFT / 2) * cutEase - PERP.y * (CUT_GAP / 2) * cutEase,
  };
  const lower = {
    x: DIR.x * (CUT_SHIFT / 2) * cutEase + PERP.x * (CUT_GAP / 2) * cutEase,
    y: DIR.y * (CUT_SHIFT / 2) * cutEase + PERP.y * (CUT_GAP / 2) * cutEase,
  };

  const pop = 1 + (1 - overshoot(appear, 7, 7)) * 0.42;

  const textStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: SERIF_STACK,
    fontWeight: 900,
    fontSize: FONT,
    letterSpacing: '0.1em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: SENBON.paper,
    WebkitTextStroke: `3px ${SENBON.ink}`,
    textShadow: `0 0 26px rgba(252,201,52,${0.5 + pulse * 0.3}), 0 0 90px rgba(217,48,37,0.5), 0 8px 0 rgba(11,9,10,0.9)`,
  };

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${f(pop)})`}}>
        {cut <= 0 ? (
          <div style={textStyle}>{text}</div>
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: clipUpper,
                transform: `translate3d(${f(upper.x)}px, ${f(upper.y)}px, 0)`,
              }}
            >
              <div style={textStyle}>{text}</div>
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: clipLower,
                transform: `translate3d(${f(lower.x)}px, ${f(lower.y)}px, 0)`,
              }}
            >
              <div style={textStyle}>{text}</div>
            </div>
          </>
        )}
      </div>

      {/* 刀痕光 */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: clamp(cut * 2.6)}}
      >
        <defs>
          <linearGradient id="cutLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="22%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
            <stop offset="50%" stopColor={SENBON.paper} stopOpacity="1" />
            <stop offset="78%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
            <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={LEFT[0]}
          y1={LEFT[1]}
          x2={RIGHT[0]}
          y2={RIGHT[1]}
          stroke="url(#cutLine)"
          strokeWidth={3 + flash * 5}
          opacity={0.6 + flash * 0.4}
        />
        <line
          x1={LEFT[0]}
          y1={LEFT[1]}
          x2={RIGHT[0]}
          y2={RIGHT[1]}
          stroke={SENBON.gold}
          strokeWidth={16}
          opacity={0.12 + flash * 0.3}
          style={{filter: 'blur(9px)'}}
        />
        {/* 刀口的火星 */}
        {cutEase > 0.15
          ? Array.from({length: 18}, (_, index) => {
              const t = (index + 0.5) / 18;
              const x = LEFT[0] + (RIGHT[0] - LEFT[0]) * t;
              const y = LEFT[1] + (RIGHT[1] - LEFT[1]) * t;
              const spread = 8 + hash(4103, index) * 60;
              const drift = easeOutCubic(cut) * spread;
              return (
                <polygon
                  key={`spark-${index}`}
                  points={`${x},${y} ${x + drift * 0.9},${y - drift * 0.8} ${x + drift * 0.2},${y + drift * 0.5}`}
                  fill={index % 3 === 0 ? SENBON.cinnabar : SENBON.goldLight}
                  opacity={(1 - clamp(cut)) * 0.9}
                />
              );
            })
          : null}
      </svg>
    </AbsoluteFill>
  );
};

export default UnbreakableType;
