import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {WukongRig} from './WukongRig';
import {SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 3：高空垂直俯视的石缝深渊。
 *
 * 告别平视纸带 —— 五块带立体折线切面与金色等高线纹理的玄黑巨岩，从左、右、
 * 上、下四个方向猛然砸入，把画面挤成一条竖直石缝；石缝深处
 * `<WukongRig pose="trapped_overhead" />` 仰头怒视，双目射出冲天金光。
 */

export type RockSide = 'left' | 'right' | 'top' | 'bottom' | 'corner';

export interface RockSpec {
  id: string;
  side: RockSide;
  dropAt: number;
  edge: Array<[number, number]>;
}

export interface ChainSpec {
  id: string;
  arriveAt: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AbyssTalisman {
  id: string;
  text: string;
  revealAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  fontSize: number;
}

export interface AbyssMountainProps {
  time: number;
  frame: number;
  rocks: readonly RockSpec[];
  chains: readonly ChainSpec[];
  talismans: readonly AbyssTalisman[];
  trappedAt: number;
  pulse?: number;
  high?: number;
}

const OFFSCREEN: Record<RockSide, [number, number]> = {
  left: [-1560, 0],
  right: [1560, 0],
  top: [0, -1080],
  bottom: [0, 1080],
  corner: [-1180, 900],
};

const centroid = (points: ReadonlyArray<readonly [number, number]>): [number, number] => {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
};

const shrink = (
  points: ReadonlyArray<readonly [number, number]>,
  ratio: number,
): Array<[number, number]> => {
  const [cx, cy] = centroid(points);
  return points.map(([x, y]) => [cx + (x - cx) * ratio, cy + (y - cy) * ratio] as [number, number]);
};

/** 把直边切成锯齿，读起来才像崩裂的玄黑巨岩而不是纸板。 */
const jagged = (
  points: ReadonlyArray<readonly [number, number]>,
  depth: number,
  seed: number,
): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    out.push([a[0], a[1]]);
    const segments = 2;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let step = 1; step <= segments; step += 1) {
      const t = step / (segments + 1);
      const wobble = (hash(seed + index * 13, step) - 0.5) * depth;
      out.push([a[0] + dx * t + nx * wobble, a[1] + dy * t + ny * wobble]);
    }
  }
  return out;
};

const toPoints = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

/** 单块巨岩：多层折面 + 金色等高线 + 落位后的余震。 */
const Rock: React.FC<{
  spec: RockSpec;
  time: number;
  pulse: number;
}> = ({spec, time, pulse}) => {
  const local = clamp((time - spec.dropAt) / 0.28);
  if (local <= 0) return null;
  const slam = overshoot(local, 8.4, 8.2);
  const [ox, oy] = OFFSCREEN[spec.side];
  const shakeAge = time - spec.dropAt;
  const quake = shakeAge < 0.5 ? Math.exp(-shakeAge * 9) * 7 : 0;
  const dx = ox * (1 - slam) + Math.sin(shakeAge * 61) * quake;
  const dy = oy * (1 - slam) + Math.cos(shakeAge * 53) * quake;

  const inner1 = shrink(spec.edge, 0.88);
  const inner2 = shrink(spec.edge, 0.64);
  const inner3 = shrink(spec.edge, 0.36);
  const [cx, cy] = centroid(spec.edge);
  const shell = jagged(spec.edge, 26, spec.dropAt * 1000);

  return (
    <g transform={`translate(${f(dx)} ${f(dy)})`}>
      {/* 岩石主体：接近纯黑的折面体，靠内缘高光与等高线把它从深渊里拉出来 */}
      <polygon points={toPoints(shell)} fill="#14100F" stroke={SENBON.gold} strokeWidth={4} strokeOpacity={0.92} />
      <polygon points={toPoints(inner1)} fill="#241C1D" opacity={0.98} />
      <polygon points={toPoints(inner2)} fill="#2E2426" opacity={0.94} />
      <polygon points={toPoints(inner3)} fill="#3A2E30" opacity={0.88} />
      {/* 金色等高线 */}
      <polygon points={toPoints(inner1)} fill="none" stroke={SENBON.gold} strokeOpacity={0.7} strokeWidth={2.4} />
      <polygon points={toPoints(inner2)} fill="none" stroke={SENBON.gold} strokeOpacity={0.4} strokeWidth={1.8} />
      <polygon points={toPoints(inner3)} fill="none" stroke={SENBON.cinnabar} strokeOpacity={0.34} strokeWidth={1.6} />
      {/* 内缘受光 */}
      <polygon
        points={toPoints(shell)}
        fill="none"
        stroke={SENBON.goldLight}
        strokeOpacity={0.5}
        strokeWidth={1.6}
      />
      {/* 折面棱线 */}
      {spec.edge.map(([x, y], index) => {
        if (index % 2 === 0) return null;
        return (
          <line
            key={`facet-${index}`}
            x1={x}
            y1={y}
            x2={cx + (x - cx) * 0.2}
            y2={cy + (y - cy) * 0.2}
            stroke={SENBON.gold}
            strokeOpacity={0.22}
            strokeWidth={1.4}
          />
        );
      })}
      {/* 落位冲击的赤金边光 */}
      {shakeAge >= 0 && shakeAge < 0.34 ? (
        <polygon
          points={toPoints(spec.edge)}
          fill="none"
          stroke={SENBON.goldLight}
          strokeWidth={4 + (1 - shakeAge / 0.34) * 10}
          opacity={(1 - shakeAge / 0.34) * 0.7 + pulse * 0.1}
        />
      ) : null}
    </g>
  );
};

/** 飞石碎屑。 */
const Debris: React.FC<{time: number; rocks: readonly RockSpec[]; width: number; height: number}> = ({
  time,
  rocks,
  width,
  height,
}) => (
  <g>
    {rocks.map((rock, rockIndex) => {
      const age = time - rock.dropAt;
      if (age < 0 || age > 0.9) return null;
      const [ox, oy] = OFFSCREEN[rock.side];
      const originX = width / 2 + ox * 0.42;
      const originY = height / 2 + oy * 0.42;
      return Array.from({length: 14}, (_, index) => {
        const seed = rockIndex * 31 + index;
        const angle = hash(6101, seed) * Math.PI * 2;
        const speed = 220 + hash(6102, seed) * 520;
        const x = originX + Math.cos(angle) * speed * age;
        const y = originY + Math.sin(angle) * speed * age + 480 * age * age;
        return (
          <polygon
            key={`debris-${rock.id}-${index}`}
            points={`${f(x)},${f(y)} ${f(x + 9)},${f(y + 5)} ${f(x + 3)},${f(y + 13)}`}
            fill={index % 4 === 0 ? SENBON.gold : '#3A3032'}
            opacity={clamp(1 - age / 0.9) * 0.85}
          />
        );
      });
    })}
  </g>
);

export const AbyssMountain: React.FC<AbyssMountainProps> = ({
  time,
  frame,
  rocks,
  chains,
  talismans,
  trappedAt,
  pulse = 0,
  high = 0,
}) => {
  const {width, height} = useVideoConfig();
  const depth = easeOutCubic(clamp((time - trappedAt) / 1.6));

  return (
    <AbsoluteFill style={{backgroundColor: '#050405', overflow: 'hidden'}}>
      {/* 深渊底光：比岩体亮一档，岩石才有剪影可读 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 44% 40% at 50% 56%, rgba(96,40,32,${0.92 + depth * 0.08}) 0%, rgba(42,22,24,0.9) 42%, rgba(5,4,5,0.9) 78%), linear-gradient(180deg, rgba(217,48,37,0.16) 0%, rgba(5,4,5,0) 46%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 22% 26% at 50% 58%, rgba(252,201,52,${0.12 + depth * 0.16}) 0%, rgba(217,48,37,0.05) 48%, rgba(5,4,5,0) 76%)`,
        }}
      />

      <AbsoluteFill
        style={{
          transform: `scale(${f(1.06 - depth * 0.06)})`,
          transformOrigin: '50% 56%',
        }}
      >
        {/* 石缝深处的大圣 */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 330,
            top: 300,
            width: 660,
            height: 660,
            opacity: clamp((time - trappedAt) / 0.2),
          }}
        >
          <WukongRig
            pose="trapped_overhead"
            frame={frame}
            high={high}
            glow={1.15}
            wind={1.2}
            beams={0.32 + depth * 0.24}
            eyeBurst={0.4 + pulse * 0.4}
          />
        </div>

        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
          <Debris time={time} rocks={rocks} width={width} height={height} />
          {rocks.map((rock) => (
            <Rock key={rock.id} spec={rock} time={time} pulse={pulse} />
          ))}
        </svg>
      </AbsoluteFill>

      {/* 交叉封印锁链 + 符咒 */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
        {chains.map((chain) => {
          const local = clamp((time - chain.arriveAt) / 0.2);
          if (local <= 0) return null;
          const grow = easeOutCubic(local);
          const x2 = chain.x1 + (chain.x2 - chain.x1) * grow;
          const y2 = chain.y1 + (chain.y2 - chain.y1) * grow;
          return (
            <g key={chain.id}>
              <line
                x1={chain.x1}
                y1={chain.y1}
                x2={x2}
                y2={y2}
                stroke={SENBON.ink}
                strokeWidth={13}
                strokeLinecap="round"
                opacity={0.92}
              />
              <line
                x1={chain.x1}
                y1={chain.y1}
                x2={x2}
                y2={y2}
                stroke={SENBON.gold}
                strokeWidth={5}
                strokeDasharray="16 11"
                strokeLinecap="round"
                opacity={0.85}
                style={{filter: `drop-shadow(0 0 6px ${SENBON.gold})`}}
              />
              <line
                x1={chain.x1}
                y1={chain.y1}
                x2={x2}
                y2={y2}
                stroke={SENBON.goldLight}
                strokeWidth={1.6}
                strokeDasharray="16 11"
                opacity={0.7}
              />
            </g>
          );
        })}
      </svg>

      {talismans.map((talisman) => {
        const local = clamp((time - talisman.revealAt) / 0.22);
        if (local <= 0) return null;
        const pop = overshoot(local, 7.4, 7.4);
        return (
          <div
            key={talisman.id}
            style={{
              position: 'absolute',
              left: talisman.x - talisman.width / 2,
              top: talisman.y - talisman.height / 2,
              width: talisman.width,
              height: talisman.height,
              transform: `rotate(${f(talisman.rotate)}deg) scale(${f(pop)})`,
              opacity: clamp(local * 2.2),
              backgroundColor: SENBON.paper,
              border: `4px solid ${SENBON.cinnabar}`,
              boxShadow: `0 0 26px rgba(217,48,37,0.55), inset 0 0 0 2px rgba(11,9,10,0.7)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
              fontWeight: 700,
              fontSize: talisman.fontSize,
              color: SENBON.cinnabarDeep,
              writingMode: 'vertical-rl',
              letterSpacing: '0.06em',
              lineHeight: 1.05,
              textShadow: '0 0 2px rgba(142,26,19,0.6)',
            }}
          >
            {talisman.text}
          </div>
        );
      })}

      {/* 深渊压边 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 80% 74% at 50% 54%, rgba(5,4,5,0) 50%, rgba(5,4,5,0.22) 84%, rgba(5,4,5,0.52) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default AbyssMountain;
