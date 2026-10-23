import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';

/**
 * `<SenbonStageFrame />` —— V7 的全片常驻画框 + 金火/残旗粒子层。
 *
 * V6 的八个微切镜各自为战：每一格都好看，但切镜之间像八张独立海报。V7 在
 * `WukongClimaxSegment` 的最顶层挂一层统一的：
 *   · 12px 玄黑乌木画框，双线鎏金内框，四角回纹角花；
 *   · 80 颗随风斜落的赤金火星与焦黑战旗残片（固定种子，无 Math.random）。
 *
 * 最后 9 帧黑场由 `WukongClimaxSegment` 提前 return，不渲染本组件。
 */

export interface SenbonStageFrameProps {
  time: number;
  /** 画框不透明度，默认 1；黑场前可淡出。 */
  opacity?: number;
}

const GOLD = '#F5C242';
const CINNABAR = '#C8281E';
const INK = '#0B090A';

const Corner: React.FC<{x: number; y: number; sx: number; sy: number}> = ({x, y, sx, sy}) => (
  <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
    <path d="M 6 92 L 6 6 L 92 6" fill="none" stroke={GOLD} strokeWidth="3" opacity="0.9" />
    <path d="M 14 84 L 14 14 L 84 14" fill="none" stroke={GOLD} strokeWidth="1" opacity="0.65" />
    <path d="M 24 56 L 24 24 L 56 24 L 56 44 L 40 44 L 40 34 L 48 34" fill="none" stroke={GOLD} strokeWidth="2.2" opacity="0.9" />
    <path d="M 92 18 L 108 18 L 108 34" fill="none" stroke={CINNABAR} strokeWidth="2.2" opacity="0.8" />
    <rect x="6" y="6" width="10" height="10" fill={CINNABAR} />
    <circle cx="92" cy="92" r="2.4" fill={GOLD} opacity="0.8" />
  </g>
);

interface Mote {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  phase: number;
  rot: number;
  gold: boolean;
  opacity: number;
}

export const SenbonStageFrame: React.FC<SenbonStageFrameProps> = ({time, opacity = 1}) => {
  const motes = useMemo<Mote[]>(
    () =>
      Array.from({length: 80}, (_, index) => {
        const gold = index % 5 !== 0;
        return {
          x: hash(9710, index) * 1980 - 30,
          y: hash(9711, index) * 1140 - 30,
          size: gold ? 1.1 + hash(9712, index) ** 2 * 3.6 : 4 + hash(9713, index) * 7,
          speed: 18 + hash(9714, index) * 44,
          sway: 10 + hash(9715, index) * 26,
          phase: hash(9716, index) * Math.PI * 2,
          rot: hash(9717, index) * 180,
          gold,
          opacity: 0.28 + hash(9718, index) * 0.5,
        };
      }),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {/* 画框外沿 + 内沿 */}
      <div style={{position: 'absolute', inset: 0, border: `12px solid ${INK}`}} />
      <div style={{position: 'absolute', inset: 12, border: `1px solid rgba(245,194,66,0.55)`}} />
      <div style={{position: 'absolute', inset: 18, border: `1px solid rgba(200,40,30,0.34)`}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 46px rgba(0,0,0,0.52)',
        }}
      />

      {/* 四角回纹 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <Corner x={12} y={12} sx={1} sy={1} />
        <Corner x={1908} y={12} sx={-1} sy={1} />
        <Corner x={12} y={1068} sx={1} sy={-1} />
        <Corner x={1908} y={1068} sx={-1} sy={-1} />
        {/* 上下中点的鎏金小云头 */}
        {[960, 0].map((cx, index) => (
          <g key={`crown-${index}`} transform={`translate(${cx} ${index === 0 ? 6 : 1074})`} opacity="0.82">
            <path d="M -30 0 Q -22 -9 -12 0 Q -6 -7 0 0 Q 6 -7 12 0 Q 22 -9 30 0" fill="none" stroke={GOLD} strokeWidth="1.6" />
            <circle cx="0" cy="0" r="2" fill={CINNABAR} />
          </g>
        ))}
      </svg>

      {/* 常驻粒子：金火 + 焦黑战旗残片 */}
      <svg
        viewBox="0 0 1920 1080"
        width="1920"
        height="1080"
        style={{position: 'absolute', inset: 0, overflow: 'hidden'}}
      >
        <g style={{mixBlendMode: 'screen'}}>
          {motes
            .filter((mote) => mote.gold)
            .map((mote, index) => {
              const x = ((mote.x + time * (mote.speed * 0.72) + Math.sin(time * 0.7 + mote.phase) * mote.sway) % 1980 + 1980) % 1980 - 30;
              const y = ((mote.y + time * mote.speed) % 1140 + 1140) % 1140 - 30;
              return (
                <g key={`ember-${index}`} opacity={mote.opacity}>
                  <circle cx={x} cy={y} r={mote.size * 2.6} fill={GOLD} opacity="0.16" />
                  <circle cx={x} cy={y} r={mote.size} fill={index % 4 === 0 ? '#FFF3D1' : GOLD} />
                </g>
              );
            })}
        </g>
        {motes
          .filter((mote) => !mote.gold)
          .map((mote, index) => {
            const x = ((mote.x + time * (mote.speed * 0.62) + Math.sin(time * 0.5 + mote.phase) * mote.sway) % 1980 + 1980) % 1980 - 30;
            const y = ((mote.y + time * mote.speed) % 1140 + 1140) % 1140 - 30;
            return (
              <g key={`scrap-${index}`} transform={`translate(${x} ${y}) rotate(${mote.rot + time * 38})`} opacity={mote.opacity * 0.8}>
                <rect x={-mote.size / 2} y={-mote.size} width={mote.size} height={mote.size * 2.2} fill="#1B1114" stroke="#7A4A1E" strokeWidth="0.6" />
                <path d={`M ${-mote.size / 2} ${-mote.size} L ${mote.size / 2} ${-mote.size * 0.4}`} stroke={GOLD} strokeWidth="0.7" opacity="0.6" />
              </g>
            );
          })}
      </svg>
    </AbsoluteFill>
  );
};

export default SenbonStageFrame;
