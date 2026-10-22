import React, {useId} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, easeOutExpo, SENBON, SERIF_STACK} from './style';

export interface SplitTypeProps {
  time: number;
  /** 四个字开始入画的秒数。 */
  revealAt: number;
  /** 斜向金光劈开的秒数。 */
  slashAt: number;
  /** 0–1 冲击脉冲。 */
  pulse?: number;
}

const TEXT = '无坚不摧';

/**
 * 一棒劈字。
 *
 * 四个鎏金大字先以巨压入画；到 `slashAt` 时沿斜向被一分为二——上下两个
 * 完全相同的文本图层使用互补的 clip-path 斜切遮罩，向两侧错位弹开，中间
 * 露出被劈开的金缝。文字始终是单个文本节点，符合 AGENTS.md §9.2。
 */
export const SplitType: React.FC<SplitTypeProps> = ({time, revealAt, slashAt, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `st-${rawId}-${suffix}`;
  const reveal = clamp01((time - revealAt) / 0.24);
  const split = easeOutExpo(clamp01((time - slashAt) / 0.16));
  const after = time - slashAt;

  if (time < revealAt) return null;

  const enter = 2.6 - 1.6 * easeOutExpo(reveal);
  const enterOpacity = clamp01(reveal * 2.4);
  const topShift = -split * 112;
  const bottomShift = split * 112;
  const halfRotate = 1.6 * split;

  const textStyle: React.CSSProperties = {
    fontFamily: SERIF_STACK,
    fontWeight: 900,
    fontSize: 238,
    letterSpacing: '0.015em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: 'transparent',
    backgroundImage: `linear-gradient(178deg, ${SENBON.goldPale} 0%, ${SENBON.gold} 34%, ${SENBON.goldLight} 52%, ${SENBON.gold} 68%, ${SENBON.goldDeep} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextStroke: `7px ${SENBON.ink}`,
    filter: `drop-shadow(0 8px 0 ${SENBON.goldShadow}) drop-shadow(0 0 ${18 + pulse * 30}px rgba(252,201,52,0.45))`,
  };

  const crackPath = Array.from({length: 15}, (_, index) => {
    const x = 200 + index * 110;
    const y = 300 + Math.sin(index * 1.7 + time * 2) * 26 + index * 9;
    return `${x},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}} aria-hidden="true">
      {/* 字底冲击光环 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 46% 30% at 50% 50%, rgba(252,201,52,${0.18 + pulse * 0.25}) 0%, rgba(217,48,37,0.12) 46%, rgba(11,9,10,0) 74%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 劈开后的金缝光 */}
      {after >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: -300,
            top: 500,
            width: 2520,
            height: 10 + split * 150,
            background: `linear-gradient(90deg, rgba(255,247,218,0) 0%, ${SENBON.goldLight} 22%, #FFFFFF 48%, ${SENBON.gold} 64%, rgba(255,247,218,0) 100%)`,
            transform: `rotate(-6.4deg) translateY(${split * 20}px)`,
            opacity: Math.max(0, 1 - split * 1.05) * 0.95,
            filter: `blur(${1 + split * 10}px)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}

      {/* 文字本体：上下两半互补遮罩 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 470,
          transform: `translate(-50%, -50%) scale(${enter.toFixed(4)})`,
          transformOrigin: '50% 50%',
          width: 1600,
          height: 280,
          opacity: enterOpacity,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1600,
            textAlign: 'center',
            transform: `translateY(${topShift}px) rotate(${-halfRotate}deg)`,
            clipPath: 'polygon(0 0, 100% 0, 100% 51%, 0 46%)',
          }}
        >
          <span style={textStyle}>{TEXT}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1600,
            textAlign: 'center',
            transform: `translateY(${bottomShift}px) rotate(${halfRotate}deg)`,
            clipPath: 'polygon(0 46%, 100% 51%, 100% 100%, 0 100%)',
          }}
        >
          <span style={textStyle}>{TEXT}</span>
        </div>
      </div>

      {/* 裂缝金线 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={id('crack')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.cinnabar} stopOpacity="0" />
            <stop offset="22%" stopColor={SENBON.goldLight} />
            <stop offset="56%" stopColor={SENBON.goldPale} />
            <stop offset="82%" stopColor={SENBON.cinnabar} />
            <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={crackPath}
          fill="none"
          stroke={`url(#${id('crack')})`}
          strokeWidth={2 + pulse * 4}
          opacity={after >= 0 ? clamp01(after / 0.08) * (1 - split * 0.5) : 0}
          transform={`translate(0 ${split * 36})`}
        />
        {/* 碎片 */}
        {after >= 0
          ? Array.from({length: 22}, (_, index) => {
              const angle = hash(3311, index) * Math.PI * 2;
              const speed = 220 + hash(4417, index) * 760;
              const travel = easeOutExpo(clamp01(after / 0.8)) * speed;
              const rot = hash(5519, index) * 360 * clamp01(after / 0.8);
              return (
                <rect
                  key={`shard-${index}`}
                  x={960 + Math.cos(angle) * travel}
                  y={500 + Math.sin(angle) * travel * 0.42}
                  width={6 + hash(6613, index) * 26}
                  height={2 + hash(7717, index) * 5}
                  fill={index % 5 === 0 ? SENBON.cinnabar : SENBON.goldLight}
                  opacity={Math.max(0, 1 - after / 0.9) * 0.8}
                  transform={`rotate(${rot} ${960 + Math.cos(angle) * travel} ${500 + Math.sin(angle) * travel * 0.42})`}
                />
              );
            })
          : null}
      </svg>

      {/* 笔画外扩的速度线 */}
      <AbsoluteFill
        style={{
          opacity: clamp01((time - revealAt) / 0.16) * 0.5,
          backgroundImage: `repeating-linear-gradient(90deg, rgba(244,239,230,0.16) 0px, rgba(244,239,230,0.16) 1px, transparent 1px, transparent 26px)`,
          maskImage: 'radial-gradient(ellipse 55% 26% at 50% 48%, black 20%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse 55% 26% at 50% 48%, black 20%, transparent 72%)',
        }}
      />
    </AbsoluteFill>
  );
};
