import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, SENBON, TAU} from './style';

export interface ForegroundMotionProps {
  time: number;
  /** 0–1，镜头推进量，越快前景越糊。 */
  rush: number;
  pulse?: number;
}

interface LanternSpec {
  baseX: number;
  y: number;
  scale: number;
  speed: number;
  phase: number;
  tone: 'gold' | 'red';
}

const LANTERNS: LanternSpec[] = [
  {baseX: 1700, y: 620, scale: 1.1, speed: 1180, phase: 2.0, tone: 'gold'},
  {baseX: 640, y: 540, scale: 0.8, speed: 940, phase: 4.8, tone: 'red'},
  {baseX: 2080, y: 700, scale: 1.35, speed: 1420, phase: 1.6, tone: 'gold'},
  {baseX: 300, y: 760, scale: 0.75, speed: 820, phase: 2.6, tone: 'red'},
  {baseX: 1320, y: 820, scale: 1.0, speed: 1280, phase: 4.2, tone: 'gold'},
];

const Lantern: React.FC<{spec: LanternSpec; time: number; rush: number; idPrefix: string; index: number}> = ({
  spec,
  time,
  rush,
  idPrefix,
  index,
}) => {
  const id = (suffix: string) => `${idPrefix}-lantern-${index}-${suffix}`;
  const travel = (time * spec.speed + spec.phase * 380) % 2900;
  const x = 2260 - travel;
  const swing = Math.sin(time * 2.1 + spec.phase) * 4;
  const blur = spec.speed > 1100 ? 2.4 : 1.2;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: spec.y,
        width: 240 * spec.scale,
        height: 380 * spec.scale,
        transform: `rotate(${swing.toFixed(2)}deg)`,
        transformOrigin: '50% 0%',
        filter: `blur(${blur}px) drop-shadow(0 0 34px rgba(252,201,52,0.35))`,
        opacity: 0.92,
      }}
    >
      <svg viewBox="0 0 240 380" width="100%" height="100%" style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id={id('body')} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#241516" />
            <stop offset="55%" stopColor="#120D0E" />
            <stop offset="100%" stopColor="#0B090A" />
          </linearGradient>
          <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.95" />
            <stop offset="42%" stopColor={SENBON.gold} stopOpacity="0.55" />
            <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.goldShadow} />
            <stop offset="38%" stopColor={SENBON.goldLight} />
            <stop offset="70%" stopColor={SENBON.gold} />
            <stop offset="100%" stopColor={SENBON.goldDeep} />
          </linearGradient>
        </defs>

        {/* 吊钩与绳 */}
        <line x1="120" y1="0" x2="120" y2="28" stroke={SENBON.goldDeep} strokeWidth="4" />
        <circle cx="120" cy="34" r="12" fill="none" stroke={SENBON.gold} strokeWidth="4" />

        {/* 光晕 */}
        <ellipse cx="120" cy="190" rx="150" ry="170" fill={`url(#${id('glow')})`} opacity={0.5} />

        {/* 顶盖 */}
        <path d="M 56 52 L 184 52 L 168 80 L 72 80 Z" fill={`url(#${id('gold')})`} stroke={SENBON.goldShadow} strokeWidth="2" />
        <rect x="48" y="44" width="144" height="14" rx="6" fill={SENBON.goldDeep} stroke={SENBON.goldLight} strokeWidth="1.6" />

        {/* 灯体 */}
        <path
          d="M 58 82 C 34 118 30 250 60 300 C 92 344 148 344 180 300 C 210 250 206 118 182 82 Z"
          fill={`url(#${id('body')})`}
          stroke={SENBON.gold}
          strokeWidth="4"
        />
        {/* 朱砂灯纱 */}
        <path
          d="M 78 102 C 62 142 60 246 82 288 C 104 318 136 318 158 288 C 180 246 178 142 162 102 Z"
          fill={spec.tone === 'gold' ? '#5A1B12' : '#6E1A12'}
          opacity="0.85"
        />
        <path
          d="M 78 102 C 62 142 60 246 82 288 C 104 318 136 318 158 288 C 180 246 178 142 162 102 Z"
          fill={`url(#${id('glow')})`}
          opacity="0.55"
        />
        {/* 金色骨架 */}
        {[-58, -28, 0, 28, 58].map((offset) => (
          <path
            key={`rib-${offset}`}
            d={`M ${120 + offset * 0.45} 84 C ${120 + offset} 140 ${120 + offset} 250 ${120 + offset * 0.55} 304`}
            fill="none"
            stroke={SENBON.gold}
            strokeWidth={offset === 0 ? 5 : 3}
            opacity="0.85"
          />
        ))}
        {[126, 184, 242].map((y) => (
          <path key={`band-${y}`} d={`M 48 ${y} C 90 ${y - 14} 150 ${y - 14} 192 ${y}`} fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.55" />
        ))}
        {/* 灯芯 */}
        <ellipse cx="120" cy="198" rx="34" ry="62" fill={SENBON.goldDeep} opacity="0.55" />
        <ellipse cx="120" cy="196" rx="14" ry="38" fill={SENBON.goldLight} opacity="0.9" />
        <path d="M 120 158 C 134 182 130 210 120 232 C 110 210 106 182 120 158 Z" fill={SENBON.goldPale} opacity="0.95" />
        <circle cx="120" cy="198" r="4" fill={SENBON.cinnabar} />

        {/* 底盖与流苏 */}
        <path d="M 64 304 L 176 304 L 160 330 L 80 330 Z" fill={`url(#${id('gold')})`} stroke={SENBON.goldShadow} strokeWidth="2" />
        <rect x="56" y="326" width="128" height="12" rx="5" fill={SENBON.goldDeep} stroke={SENBON.goldLight} strokeWidth="1.4" />
        {Array.from({length: 7}, (_, tassel) => (
          <g key={`tassel-${tassel}`}>
            <line
              x1={84 + tassel * 12}
              y1="338"
              x2={84 + tassel * 12 + Math.sin(time * 2.4 + tassel) * 3}
              y2={368 + hash(6611, tassel) * 12}
              stroke={SENBON.cinnabar}
              strokeWidth="3"
            />
            <circle cx={84 + tassel * 12} cy={370 + hash(6611, tassel) * 10} r="3.4" fill={SENBON.gold} />
          </g>
        ))}
        <rect x="100" y="332" width="40" height="8" fill={SENBON.cinnabar} opacity="0.9" />
      </svg>
    </div>
  );
};

/**
 * 前景：宫灯剪影 + 金色火星 + 飞掠光条。
 *
 * 这一层速度远高于中景天兵，用来制造第三层视差与“镜头被风切开”的速度感。
 */
export const ForegroundMotion: React.FC<ForegroundMotionProps> = ({time, rush, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `fg-${rawId}-${suffix}`;

  const sparks = useMemo(
    () =>
      Array.from({length: 150}, (_, index) => ({
        x: hash(3301, index) * 2100 - 90,
        y: hash(4409, index) * 1200,
        speed: 80 + hash(5501, index) * 420,
        drift: (hash(6607, index) - 0.5) * 120,
        size: 1 + hash(7703, index) * 4.2,
        streak: hash(8819, index) * 90,
        phase: hash(9901, index) * TAU,
        color: hash(1201, index) > 0.72 ? SENBON.cinnabar : SENBON.gold,
        alpha: 0.2 + hash(1301, index) * 0.7,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}} aria-hidden="true">
      {/* 飞掠的金色光条 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={id('streak')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="50%" stopColor={SENBON.goldLight} stopOpacity="0.8" />
            <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({length: 16}, (_, index) => {
          const speed = 1400 + hash(2203, index) * 2000;
          const x = 2400 - ((time * speed + index * 240) % 2900);
          const y = 120 + hash(3407, index) * 900;
          const len = 120 + hash(4507, index) * 420;
          return (
            <rect
              key={`streak-${index}`}
              x={x}
              y={y}
              width={len}
              height={1 + hash(5609, index) * 3}
              fill={`url(#${id('streak')})`}
              opacity={0.18 + rush * 0.3}
              transform={`rotate(${(hash(6701, index) - 0.5) * 8} ${x} ${y})`}
            />
          );
        })}
      </svg>

      {/* 宫灯 */}
      {LANTERNS.map((lantern, index) => (
        <Lantern key={`lantern-${index}`} spec={lantern} time={time} rush={rush} idPrefix={rawId} index={index} />
      ))}

      {/* 火星 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id={id('ember')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.goldPale} />
            <stop offset="55%" stopColor={SENBON.gold} />
            <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
          </radialGradient>
        </defs>
        {sparks.map((spark, index) => {
          const y = ((spark.y - time * spark.speed) % 1200 + 1200) % 1200;
          const x = spark.x + Math.sin(time * 1.3 + spark.phase) * 30 + time * spark.drift * 0.4;
          const fade = clamp01(1 - Math.abs(y - 560) / 640);
          return (
            <g key={`spark-${index}`} opacity={spark.alpha * (0.5 + rush * 0.5) * fade}>
              <line x1={x} y1={y} x2={x + spark.streak * 0.2} y2={y + spark.streak} stroke={spark.color} strokeWidth={spark.size * 0.6} strokeLinecap="round" opacity="0.6" />
              <circle cx={x} cy={y} r={spark.size} fill={`url(#${id('ember')})`} />
            </g>
          );
        })}
      </svg>

      {/* 前景压角：暗红绸带 */}
      <div
        style={{
          position: 'absolute',
          left: -120,
          top: -40,
          width: 520,
          height: 300,
          background: `linear-gradient(150deg, rgba(217,48,37,${0.2 + pulse * 0.15}) 0%, rgba(217,48,37,0) 70%)`,
          transform: `rotate(${-8 + Math.sin(time * 1.4) * 2}deg)`,
          filter: 'blur(10px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -160,
          bottom: -60,
          width: 620,
          height: 360,
          background: `linear-gradient(320deg, rgba(217,48,37,${0.18 + pulse * 0.12}) 0%, rgba(217,48,37,0) 70%)`,
          transform: `rotate(${6 + Math.cos(time * 1.2) * 2}deg)`,
          filter: 'blur(12px)',
        }}
      />
    </AbsoluteFill>
  );
};
