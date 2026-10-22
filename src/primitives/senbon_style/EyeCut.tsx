import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, easeOutExpo, overshoot, SENBON, SERIF_STACK} from './style';
import {WukongSilhouette} from './WukongSilhouette';

export interface EyeCutProps {
  time: number;
  start: number;
  end: number;
  /** 【怎敌我】出现的秒数（唱词字级起点）。 */
  titleAt: number;
  /** 眼部迸发时刻。 */
  burstAt: number;
  /** 0–1 冲击脉冲。 */
  pulse?: number;
}

/**
 * 漫画眼部横切条。
 *
 * 屏幕中央斜向撕开一道黑底金边分格；格内是火眼金睛特写，金色瞳孔收缩、
 * 横向赤金闪电迸射；左侧竖排金字【怎敌我】随震动浮现。
 */
export const EyeCut: React.FC<EyeCutProps> = ({
  time,
  start,
  end,
  titleAt,
  burstAt,
  pulse = 0,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `ec-${rawId}-${suffix}`;

  const span = Math.max(0.001, end - start);
  const p = clamp01((time - start) / span);
  const open = easeOutExpo(clamp01(p / 0.22));
  const bandH = 26 + open * 436;
  const cy = 500;
  const tilt = 40;
  const topY = cy - bandH / 2;
  const bottomY = cy + bandH / 2;
  const titleProgress = clamp01((time - titleAt) / 0.26);
  const titleSpring = overshoot(titleProgress, 8.2, 8.8);
  const burst = clamp01(1 - Math.abs(time - burstAt) / 0.22);
  const blink = Math.sin(time * 9.2) * 0.5 + 0.5;

  const shards = useMemo(
    () =>
      Array.from({length: 18}, (_, index) => ({
        x: hash(3311, index) * 1920,
        y: topY + (index % 2 === 0 ? -12 : bandH + 12),
        w: 24 + hash(4417, index) * 90,
        h: 3 + hash(5519, index) * 9,
        angle: (hash(6613, index) - 0.5) * 50,
        alpha: 0.2 + hash(7717, index) * 0.5,
      })),
    [bandH, topY],
  );

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      {/* 上下黑场，留一条细金线暗示分格 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: Math.max(0, topY),
          background: SENBON.ink,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: bottomY,
          bottom: 0,
          background: SENBON.ink,
        }}
      />

      {/* 斜切分格 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `polygon(0 ${topY + tilt}px, 1920px ${topY - tilt}px, 1920px ${bottomY - tilt}px, 0px ${bottomY + tilt}px)`,
          overflow: 'hidden',
          backgroundColor: '#100C0D',
        }}
      >
        {/* 格内底色 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(102deg, #080607 0%, #150A09 42%, #210B08 64%, #080607 100%)`,
          }}
        />
        {/* 网点 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle, rgba(252,201,52,0.30) 1px, rgba(252,201,52,0) 1.4px)`,
            backgroundSize: '7px 7px',
            opacity: 0.35,
          }}
        />
        {/* 横向赤金闪电 */}
        <div
          style={{
            position: 'absolute',
            left: -100,
            right: -100,
            top: cy - 180,
            height: 360,
            background: `linear-gradient(90deg, rgba(252,201,52,0) 0%, rgba(252,201,52,${0.05 + burst * 0.1}) 30%, rgba(255,247,218,${0.14 + burst * 0.2}) 52%, rgba(217,48,37,${0.05 + burst * 0.08}) 76%, rgba(252,201,52,0) 100%)`,
            filter: 'blur(18px)',
            opacity: 0.38 + burst * 0.3,
          }}
        />
        {Array.from({length: 9}, (_, index) => (
          <div
            key={`beam-${index}`}
            style={{
              position: 'absolute',
              left: index % 2 === 0 ? 0 : '52%',
              top: cy + (index - 4) * 26,
              width: index % 2 === 0 ? 900 : 1020,
              height: 2 + (index % 3) * 1.6,
              background: `linear-gradient(90deg, rgba(255,247,218,0) 0%, ${(index + Math.floor(time * 30)) % 3 === 0 ? SENBON.cinnabar : SENBON.goldLight} 42%, rgba(255,247,218,0) 100%)`,
              opacity: (0.15 + hash(8811 + index, index) * 0.4) * (0.4 + burst * 0.9),
              transform: `rotate(${(index - 4) * 0.5}deg)`,
            }}
          />
        ))}

        {/* 火眼金睛特写 */}
        <div
          style={{
            position: 'absolute',
            left: 760,
            top: cy - 330,
            width: 1250,
            height: 660,
            transform: `scale(${(0.92 + open * 0.08).toFixed(3)})`,
            transformOrigin: '50% 50%',
          }}
        >
          <WukongSilhouette
            pose="eyes_closeup"
            width={1250}
            height={660}
            glow={0.7 + burst * 0.3}
            wind={0.4}
          />
        </div>

        {/* 左侧竖排金字【怎敌我】 */}
        <div
          style={{
            position: 'absolute',
            left: 138 + Math.sin(time * 38) * (2 + burst * 5),
            top: 352 + Math.cos(time * 31) * 2,
            width: 200,
            height: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: clamp01(titleProgress * 2.4),
            transform: `scale(${(1.6 - 0.6 * titleSpring).toFixed(3)})`,
            transformOrigin: '50% 50%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-18px -26px',
              background: 'linear-gradient(180deg, rgba(11,9,10,0.82), rgba(11,9,10,0.35))',
              borderLeft: `3px solid ${SENBON.cinnabar}`,
              transform: 'skewX(-4deg)',
              opacity: 0.72,
            }}
          />
          <span
            style={{
              position: 'relative',
              writingMode: 'vertical-rl',
              textOrientation: 'upright',
              whiteSpace: 'nowrap',
              fontFamily: SERIF_STACK,
              fontWeight: 900,
              fontSize: 104,
              letterSpacing: '0.06em',
              lineHeight: 1.02,
              color: 'transparent',
              backgroundImage: `linear-gradient(180deg, ${SENBON.goldPale} 0%, ${SENBON.gold} 48%, ${SENBON.cinnabar} 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              filter: `drop-shadow(0 0 26px rgba(252,201,52,${0.4 + burst * 0.4})) drop-shadow(0 4px 0 rgba(11,9,10,0.9))`,
            }}
          >
            怎敌我
          </span>
        </div>

        {/* 格线：沿斜切边缘的金边 + 朱砂内线 */}
        <div
          style={{
            position: 'absolute',
            left: -240,
            top: topY - 8,
            width: 2400,
            height: 16,
            background: `linear-gradient(90deg, ${SENBON.goldShadow}, ${SENBON.goldLight} 30%, ${SENBON.gold} 70%, ${SENBON.goldShadow})`,
            opacity: 0.95,
            transform: 'rotate(-2.74deg)',
            transformOrigin: '50% 50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -240,
            top: topY + 12,
            width: 2400,
            height: 3,
            background: SENBON.cinnabar,
            opacity: 0.85,
            transform: 'rotate(-2.74deg)',
            transformOrigin: '50% 50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -240,
            top: bottomY - 8,
            width: 2400,
            height: 16,
            background: `linear-gradient(90deg, ${SENBON.goldShadow}, ${SENBON.goldLight} 30%, ${SENBON.gold} 70%, ${SENBON.goldShadow})`,
            opacity: 0.95,
            transform: 'rotate(-2.74deg)',
            transformOrigin: '50% 50%',
          }}
        />

        {/* 格内四角网点压边 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 80% 120% at 50% 50%, rgba(11,9,10,0) 46%, rgba(11,9,10,0.78) 100%)`,
          }}
        />

        <div style={{position: 'absolute', right: 42, bottom: 22, fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.4em', color: 'rgba(244,239,230,0.32)'}}>
          FIRE EYE · 火眼金睛
        </div>
      </div>

      {/* 撕裂边缘的碎片 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <defs>
          <linearGradient id={id('shard')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} />
            <stop offset="100%" stopColor={SENBON.cinnabar} />
          </linearGradient>
        </defs>
        {shards.map((shard, index) => (
          <g
            key={`shard-${index}`}
            transform={`translate(${shard.x} ${shard.y}) rotate(${shard.angle + p * 20})`}
            opacity={shard.alpha * open}
          >
            <rect x={-shard.w / 2} y={-shard.h / 2} width={shard.w} height={shard.h} fill={`url(#${id('shard')})`} />
          </g>
        ))}
        {/* 上下边缘锯齿 */}
        {[0, 1].map((edge) => (
          <polyline
            key={`tear-${edge}`}
            points={Array.from({length: 25}, (_, index) => {
              const x = index * 80;
              const base = edge === 0 ? topY + tilt - x * (tilt / 960) : bottomY - tilt + x * (tilt / 960);
              const wobble = (hash(991 + edge, index) - 0.5) * 22;
              return `${x},${(base + wobble).toFixed(1)}`;
            }).join(' ')}
            fill="none"
            stroke={edge === 0 ? SENBON.goldLight : SENBON.cinnabar}
            strokeWidth={3.4}
            opacity={0.75}
          />
        ))}
      </svg>

      {/* 眼部爆闪 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 26% 20% at 58% 44%, rgba(255,247,218,${0.5 * burst + 0.1 * blink}) 0%, rgba(252,201,52,${0.18 * burst}) 46%, rgba(11,9,10,0) 74%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(11,9,10,0.95) 0%, rgba(11,9,10,0) 26%, rgba(11,9,10,0) 74%, rgba(11,9,10,0.95) 100%)`,
          opacity: 0.32 + pulse * 0.15,
        }}
      />
    </AbsoluteFill>
  );
};
