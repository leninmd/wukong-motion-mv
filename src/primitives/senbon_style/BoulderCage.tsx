import React, {useId, useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {IronChain} from './IronChain';
import {WukongRig} from './WukongRig';
import {SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 3A —— 五指山巨岩压顶 + 实体铁索。
 *
 * 五道带浮世绘波浪 / 山石网点肌理的玄黑巨岩柱从顶部砸下；大圣在底部
 * **侧面单膝跪地、双臂上撑、披风与双翎向两侧狂舞**。
 * 双手是掌形（五指撑住岩底），不是 V3 的黄色小皇冠。
 */
export interface BoulderSpec {
  id: string;
  x: number;
  width: number;
  /** 落位后岩柱底缘的 y。 */
  bottom: number;
  dropAt: number;
  seed: number;
}

export interface BoulderChainSpec {
  id: string;
  arriveAt: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sag?: number;
}

export interface BoulderCageProps {
  time: number;
  frame: number;
  boulders: readonly BoulderSpec[];
  chains: readonly BoulderChainSpec[];
  kneelAt: number;
  pulse?: number;
  high?: number;
}

const centroid = (points: ReadonlyArray<readonly [number, number]>): [number, number] => {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
};

const shrink = (points: ReadonlyArray<readonly [number, number]>, ratio: number): Array<[number, number]> => {
  const [cx, cy] = centroid(points);
  return points.map(([x, y]) => [cx + (x - cx) * ratio, cy + (y - cy) * ratio] as [number, number]);
};

const pointString = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

const makeBoulder = (spec: BoulderSpec): Array<[number, number]> => {
  const top = -300;
  const half = spec.width / 2;
  const bottom = spec.bottom;
  const points: Array<[number, number]> = [];
  const segments = 10;
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const y = top + (bottom - top) * t;
    const wobble = (hash(spec.seed, index + 1) - 0.5) * (26 + t * 34);
    points.push([spec.x - half - Math.sin(t * Math.PI) * 26 + wobble, y]);
  }
  const bottomJitter = (hash(spec.seed, 71) - 0.5) * 30;
  points.push([spec.x - half * 0.52, bottom + 16 + bottomJitter]);
  points.push([spec.x, bottom - 24 + bottomJitter]);
  points.push([spec.x + half * 0.5, bottom + 14 + bottomJitter]);
  for (let index = segments; index >= 0; index -= 1) {
    const t = index / segments;
    const y = top + (bottom - top) * t;
    const wobble = (hash(spec.seed, index + 40) - 0.5) * (26 + t * 34);
    points.push([spec.x + half + Math.sin(t * Math.PI) * 26 + wobble, y]);
  }
  return points;
};

const BoulderBody: React.FC<{
  spec: BoulderSpec;
  time: number;
  pulse: number;
  clipId: string;
  waveId: string;
  dotsId: string;
  bodyGradId: string;
}> = ({spec, time, pulse, clipId, waveId, dotsId, bodyGradId}) => {
  const local = clamp((time - spec.dropAt) / 0.26);
  if (local <= 0) return null;
  const slam = overshoot(local, 8.2, 8.6);
  const age = time - spec.dropAt;
  const quake = age >= 0 && age < 0.55 ? Math.exp(-age * 9) * 9 : 0;
  const shell = makeBoulder(spec);
  const inner1 = shrink(shell, 0.86);
  const inner2 = shrink(shell, 0.62);
  const inner3 = shrink(shell, 0.34);
  const [cx, cy] = centroid(shell);
  const offsetY = (1 - slam) * -1280 + Math.cos(age * 61) * quake;

  const debris = Array.from({length: 14}, (_, index) => {
    const angle = hash(spec.seed + index, 3) * Math.PI;
    const speed = 130 + hash(spec.seed + index, 4) * 380;
    return {
      x: spec.x + Math.cos(angle) * speed * age * 0.9,
      y: spec.bottom + Math.sin(angle) * speed * age * 0.5 + 300 * age * age,
      size: 4 + hash(spec.seed + index, 5) * 14,
      opacity: clamp(1 - age / 0.8),
    };
  });

  return (
    <g transform={`translate(0 ${f(offsetY)})`}>
      <polygon points={pointString(shell)} fill="#120D0E" stroke={SENBON.gold} strokeWidth="3.6" strokeOpacity="0.9" />
      <polygon points={pointString(inner1)} fill="#1E1617" />
      <polygon points={pointString(inner2)} fill="#2A2022" />
      <polygon points={pointString(inner3)} fill="#352A2C" />

      {/* 浮世绘波浪 + 山石网点：clip 到岩体 */}
      <g clipPath={`url(#${clipId})`} style={{mixBlendMode: 'screen'}}>
        <rect x={spec.x - spec.width} y={-320} width={spec.width * 2} height={spec.bottom + 400} fill={`url(#${waveId})`} opacity="0.62" />
        <rect x={spec.x - spec.width} y={-320} width={spec.width * 2} height={spec.bottom + 400} fill={`url(#${dotsId})`} opacity="0.5" />
      </g>
      {/* 上黑下暖的体积渐变：把一排岩柱从“纸板墙”拉成有厚度的石体 */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={spec.x - spec.width}
          y={-320}
          width={spec.width * 2}
          height={spec.bottom + 400}
          fill={`url(#${bodyGradId})`}
          opacity="0.72"
        />
      </g>

      <polygon points={pointString(inner1)} fill="none" stroke={SENBON.gold} strokeWidth="2.4" strokeOpacity="0.55" />
      <polygon points={pointString(inner2)} fill="none" stroke={SENBON.gold} strokeWidth="1.8" strokeOpacity="0.34" />
      <polygon points={pointString(inner3)} fill="none" stroke={SENBON.cinnabar} strokeWidth="1.8" strokeOpacity="0.4" />

      {shell
        .filter((_, index) => index % 2 === 1)
        .map(([x, y], index) => (
          <line
            key={`facet-${index}`}
            x1={f(x)}
            y1={f(y)}
            x2={f(cx + (x - cx) * 0.18)}
            y2={f(cy + (y - cy) * 0.18)}
            stroke={SENBON.gold}
            strokeWidth="1.2"
            opacity="0.2"
          />
        ))}

      {Array.from({length: 3}, (_, index) => {
        const startX = spec.x - spec.width * 0.3 + index * spec.width * 0.28;
        const startY = -200 + index * 80;
        return (
          <path
            key={`crack-${index}`}
            d={`M ${f(startX)} ${f(startY)} L ${f(startX + 28)} ${f(startY + 110)} L ${f(startX - 16)} ${f(startY + 220)} L ${f(
              startX + 22,
            )} ${f(startY + 330)}`}
            fill="none"
            stroke="#050303"
            strokeWidth={2.4 + index}
            opacity="0.7"
          />
        );
      })}

      <polygon points={pointString(shell)} fill="none" stroke={SENBON.goldLight} strokeWidth="1.6" opacity="0.5" />
      {/* 岩柱底缘受光：五根柱子的下沿必须各自读得出来 */}
      <path
        d={shell
          .slice(10, 15)
          .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${f(x)} ${f(y)}`)
          .join(' ')}
        fill="none"
        stroke={SENBON.goldPale}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.72"
      />
      {age >= 0 && age < 0.36 ? (
        <polygon
          points={pointString(shell)}
          fill="none"
          stroke={SENBON.goldPale}
          strokeWidth={4 + (1 - age / 0.36) * 12}
          opacity={(1 - age / 0.36) * 0.62}
        />
      ) : null}

      {debris.map((chunk, index) => (
        <polygon
          key={`debris-${index}`}
          points={`${f(chunk.x)},${f(chunk.y)} ${f(chunk.x + chunk.size)},${f(chunk.y + chunk.size * 0.5)} ${f(
            chunk.x + chunk.size * 0.3,
          )},${f(chunk.y + chunk.size)}`}
          fill={index % 4 === 0 ? SENBON.gold : '#3A2E30'}
          opacity={chunk.opacity}
        />
      ))}
      <circle cx={spec.x} cy={spec.bottom - 10} r={96} fill={SENBON.cinnabar} opacity={pulse * 0.08} style={{filter: 'blur(26px)'}} />
    </g>
  );
};

export const BoulderCage: React.FC<BoulderCageProps> = ({time, frame, boulders, chains, kneelAt, pulse = 0, high = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `cage-${rawId}-${suffix}`;
  const {width, height} = useVideoConfig();

  const shells = useMemo(() => boulders.map((boulder) => makeBoulder(boulder)), [boulders]);

  const dust = useMemo(
    () =>
      Array.from({length: 34}, (_, index) => ({
        boulder: index % boulders.length,
        phase: hash(8102, index) * 0.4,
        r: 20 + hash(8103, index) * 70,
        drift: (hash(8104, index) - 0.5) * 160,
      })),
    [boulders.length],
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#050405', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 48% 34% at 50% 84%, rgba(128,46,34,0.85) 0%, rgba(52,26,26,0.6) 42%, rgba(5,4,5,0.95) 76%), linear-gradient(180deg, rgba(217,48,37,0.1) 0%, rgba(5,4,5,0) 46%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 30% 26% at 50% 38%, rgba(252,201,52,${0.06 + pulse * 0.05}) 0%, rgba(5,4,5,0) 72%)`,
        }}
      />

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={id('wave')} width="96" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
            <path d="M0 34 Q24 12 48 34 T96 34" fill="none" stroke={SENBON.gold} strokeWidth="1.6" opacity="0.36" />
            <path d="M0 18 Q24 -4 48 18 T96 18" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.1" opacity="0.26" />
            <path d="M0 44 Q24 24 48 44 T96 44" fill="none" stroke={SENBON.goldLight} strokeWidth="0.8" opacity="0.2" />
          </pattern>
          <pattern id={id('dots')} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <circle cx="3" cy="3" r="1.6" fill={SENBON.gold} opacity="0.34" />
            <circle cx="8.5" cy="8.5" r="0.9" fill={SENBON.paper} opacity="0.2" />
          </pattern>
          <linearGradient id={id('body')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050404" />
            <stop offset="46%" stopColor="#0F0B0C" />
            <stop offset="82%" stopColor="#2A1B19" />
            <stop offset="100%" stopColor="#3E2622" />
          </linearGradient>
          {boulders.map((boulder, index) => (
            <clipPath key={`clip-${boulder.id}`} id={`boulder-clip-${rawId}-${index}`}>
              <polygon points={pointString(shells[index] ?? [])} />
            </clipPath>
          ))}
        </defs>

        {/* 岩柱落位扬尘 */}
        {dust.map((puff, index) => {
          const boulder = boulders[puff.boulder];
          if (!boulder) return null;
          const age = time - boulder.dropAt - puff.phase;
          if (age < 0 || age > 0.9) return null;
          const progress = clamp(age / 0.9);
          return (
            <ellipse
              key={`dust-${index}`}
              cx={f(boulder.x + puff.drift * progress)}
              cy={f(boulder.bottom + 22 + progress * 26)}
              rx={f(puff.r * (0.6 + progress * 1.5))}
              ry={f(puff.r * (0.18 + progress * 0.36))}
              fill={SENBON.paperDim}
              opacity={(1 - progress) * 0.18}
            />
          );
        })}

        {boulders.map((boulder, index) => (
          <BoulderBody
            key={boulder.id}
            spec={boulder}
            time={time}
            pulse={pulse}
            clipId={`boulder-clip-${rawId}-${index}`}
            waveId={id('wave')}
            dotsId={id('dots')}
            bodyGradId={id('body')}
          />
        ))}

        {chains.map((chain) => {
          const local = clamp((time - chain.arriveAt) / 0.24);
          if (local <= 0) return null;
          return (
            <IronChain
              key={chain.id}
              x1={chain.x1}
              y1={chain.y1}
              x2={chain.x2}
              y2={chain.y2}
              sag={chain.sag ?? 0}
              progress={easeOutCubic(local)}
              linkLen={26}
              glow={0.45}
              opacity={0.82}
              seed={chain.id.length * 17}
            />
          );
        })}
      </svg>

      {/* 人物身后的暖光：把黑色剪影从黑色岩体里拔出来 */}
      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 470,
          width: 920,
          height: 660,
          background: `radial-gradient(ellipse at 50% 58%, rgba(252,201,52,${0.16 + pulse * 0.06}) 0%, rgba(217,48,37,0.12) 38%, rgba(5,4,5,0) 72%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 370,
          width: 560,
          height: 765,
          opacity: clamp((time - kneelAt) / 0.18),
          filter: 'drop-shadow(0 0 14px rgba(252,201,52,0.2))',
        }}
      >
        <WukongRig pose="kneel_boulder" frame={frame} glow={1.12} high={high} wind={1.35} eyeBurst={0.42 + pulse * 0.36} />
      </div>

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 78% 70% at 50% 56%, rgba(5,4,5,0) 48%, rgba(5,4,5,0.3) 82%, rgba(5,4,5,0.7) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default BoulderCage;
