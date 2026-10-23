import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, easeOutCubic, f} from './style';

/**
 * 横贯全屏的 18° 赤金半调刀光（Shot 2B）。
 *
 * 不是一条发光线：由「三色延迟残影 + 锥形刀身 + 半调网点 + 白热刀脊 +
 * 刀缘火星」五层叠成。刀身有宽度变化，两端收尖，读起来是被甩出去的棍风，
 * 而不是一根静止的激光。
 *
 * 青色只作为第 3 层残影的辅助色（AGENTS.md §9.8 的探索期放宽项），
 * 主视觉仍是玄黑 / 宣纸 / 朱砂 / 鎏金。
 */
export interface GiantSlashArcProps {
  progress?: number;
  pulse?: number;
  /** 刀光起点/终点（画布坐标）。 */
  from?: [number, number];
  to?: [number, number];
  maxWidth?: number;
}

interface Ribbon {
  points: string;
  core: string;
  edge: string;
}

const buildRibbon = (
  from: [number, number],
  to: [number, number],
  width: number,
  progress: number,
  bulge: number,
): Ribbon => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const steps = 30;
  const limit = Math.max(0.02, Math.min(1, progress));
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  const core: Array<[number, number]> = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * limit;
    const cx = from[0] + dx * t;
    const cy = from[1] + dy * t;
    const taper = Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.015)) ** 0.62;
    const wobble = 1 + Math.sin(t * 11 + bulge) * 0.12;
    const half = width * 0.5 * taper * wobble;
    top.push([cx + nx * half, cy + ny * half]);
    bottom.push([cx - nx * half, cy - ny * half]);
    core.push([cx + nx * half * 0.14, cy + ny * half * 0.14]);
  }
  const points = [...top, ...bottom.reverse()].map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  const coreLine = core.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  const edgeStart = top[0]!;
  const edgeEnd = top[top.length - 1]!;
  return {
    points,
    core: coreLine,
    edge: `M${f(edgeStart[0])} ${f(edgeStart[1])} L${f(edgeEnd[0])} ${f(edgeEnd[1])}`,
  };
};

export const GiantSlashArc: React.FC<GiantSlashArcProps> = ({
  progress = 1,
  pulse = 0,
  from = [262, 922],
  to = [1792, 398],
  maxWidth = 260,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `slash-${rawId}-${suffix}`;
  const eased = easeOutCubic(progress);

  const main = buildRibbon(from, to, maxWidth, eased, 0.4);
  const ghosts = useMemo(
    () => [
      {offset: [34, 26] as [number, number], color: '#63C9C0', opacity: 0.16, width: 1.5, lag: 0.84},
      {offset: [18, 14] as [number, number], color: SENBON.gold, opacity: 0.26, width: 1.3, lag: 0.9},
      {offset: [-10, -8] as [number, number], color: SENBON.cinnabar, opacity: 0.34, width: 1.12, lag: 0.95},
    ],
    [],
  );

  const sparks = useMemo(
    () =>
      Array.from({length: 38}, (_, index) => ({
        t: hash(4101, index),
        side: index % 2 === 0 ? 1 : -1,
        dist: 10 + hash(4102, index) * 120,
        size: 2 + hash(4103, index) * 8,
        drift: 20 + hash(4104, index) * 150,
        tint: hash(4105, index),
      })),
    [],
  );

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible'}}
    >
      <defs>
        <linearGradient id={id('blade')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0.2" />
          <stop offset="28%" stopColor={SENBON.gold} stopOpacity="0.9" />
          <stop offset="58%" stopColor={SENBON.goldPale} stopOpacity="1" />
          <stop offset="83%" stopColor={SENBON.cinnabar} stopOpacity="0.9" />
          <stop offset="100%" stopColor={SENBON.cinnabarDeep} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={id('core')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.paper} stopOpacity="0" />
          <stop offset="18%" stopColor={SENBON.paper} stopOpacity="0.95" />
          <stop offset="70%" stopColor={SENBON.goldPale} stopOpacity="1" />
          <stop offset="100%" stopColor={SENBON.paper} stopOpacity="0" />
        </linearGradient>
        <pattern id={id('dots')} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <circle cx="3" cy="3" r="2.1" fill={SENBON.cinnabarDeep} opacity="0.9" />
          <circle cx="8.5" cy="9" r="1.1" fill={SENBON.goldDeep} />
        </pattern>
        <clipPath id={id('ribbonClip')}>
          <polygon points={main.points} />
        </clipPath>
        <filter id={id('glow')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={id('soft')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* 三色延迟残影 */}
      {ghosts.map((ghost, index) => {
        const ghostRibbon = buildRibbon(
          [from[0] + ghost.offset[0], from[1] + ghost.offset[1]],
          [to[0] + ghost.offset[0], to[1] + ghost.offset[1]],
          maxWidth * ghost.width,
          eased * ghost.lag,
          0.4,
        );
        return (
          <polygon
            key={`ghost-${index}`}
            points={ghostRibbon.points}
            fill={ghost.color}
            opacity={ghost.opacity}
            style={{mixBlendMode: 'screen', filter: 'blur(5px)'}}
          />
        );
      })}

      {/* 刀身外辉 */}
      <polygon points={main.points} fill={SENBON.gold} opacity={0.26} filter={`url(#${id('glow')})`} style={{mixBlendMode: 'screen'}} />

      {/* 刀身 */}
      <polygon points={main.points} fill={`url(#${id('blade')})`} opacity={0.92} />
      <polygon points={main.points} fill="none" stroke={SENBON.goldPale} strokeWidth="2.4" opacity="0.8" />

      {/* 半调网点：夹在刀身里 */}
      <g clipPath={`url(#${id('ribbonClip')})`} style={{mixBlendMode: 'multiply'}} opacity={0.42}>
        <rect x="0" y="0" width="1920" height="1080" fill={`url(#${id('dots')})`} />
      </g>

      {/* 白热刀脊 */}
      <polyline points={main.core} fill="none" stroke={`url(#${id('core')})`} strokeWidth={6 + pulse * 8} strokeLinecap="round" />
      <polyline points={main.core} fill="none" stroke={SENBON.paper} strokeWidth={1.6} opacity="0.9" />

      {/* 刀缘火星 */}
      <g style={{mixBlendMode: 'screen'}}>
        {sparks.map((spark, index) => {
          const t = spark.t * eased;
          if (t <= 0.02) return null;
          const x = from[0] + (to[0] - from[0]) * t;
          const y = from[1] + (to[1] - from[1]) * t;
          const nx = -0.325;
          const ny = 0.945;
          const px = x + nx * spark.dist * spark.side + (index % 3 - 1) * spark.drift * 0.12;
          const py = y + ny * spark.dist * spark.side - spark.drift * 0.16;
          const len = spark.size * 2.6;
          return (
            <g key={`spark-${index}`} opacity={0.9 - (index % 4) * 0.12}>
              <line
                x1={f(px)}
                y1={f(py)}
                x2={f(px - nx * len * spark.side)}
                y2={f(py - ny * len * spark.side - len * 0.4)}
                stroke={spark.tint > 0.58 ? SENBON.cinnabar : SENBON.gold}
                strokeWidth={f(spark.size * 0.45)}
                strokeLinecap="round"
              />
              <circle cx={f(px)} cy={f(py)} r={f(spark.size * 0.42)} fill={index % 3 === 0 ? SENBON.paper : SENBON.goldPale} />
            </g>
          );
        })}
      </g>

      {/* 刀根冲击环 */}
      {progress > 0.04 ? (
        <g opacity={Math.min(1, progress * 2)} style={{mixBlendMode: 'screen'}}>
          <circle cx={from[0]} cy={from[1]} r={40 + eased * 180} fill="none" stroke={SENBON.goldPale} strokeWidth={3 + (1 - eased) * 8} opacity={0.5 * (1 - eased)} />
          <circle cx={from[0]} cy={from[1]} r={30 + eased * 120} fill="none" stroke={SENBON.cinnabar} strokeWidth="2" opacity={0.4 * (1 - eased)} />
        </g>
      ) : null}

      {/* 刀尖白闪 */}
      {progress > 0.35 ? (
        <g opacity={Math.min(1, (progress - 0.35) * 3)} style={{mixBlendMode: 'screen'}}>
          <circle cx={to[0]} cy={to[1]} r={12 + pulse * 20} fill={SENBON.paper} opacity="0.7" filter={`url(#${id('soft')})`} />
          <polygon
            points={`${to[0] - 70},${to[1]} ${to[0]},${to[1] - 10} ${to[0] + 70},${to[1]} ${to[0]},${to[1] + 10}`}
            fill={SENBON.goldPale}
            opacity="0.55"
          />
        </g>
      ) : null}
    </svg>
  );
};

export default GiantSlashArc;
