import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, f} from './style';

/**
 * 旋风棍盾 —— Shot 1B 的核心图元。
 *
 * V3 的「交叉十字棍」被彻底替换为多层同心圆光盾：
 *   · 3 圈反向旋转的赤金弧形刀光（锥形刀片，不是虚线）
 *   · 2 圈真正的半调网点环（SVG pattern + 环带 mask，而不是画几个点）
 *   · 14 根高速旋转的金箍棒残影组成风车
 *   · 右缘弹开箭矢/长戈时的星形火花
 *   · 外圈运动模糊光晕
 *
 * 纯 SVG，零位图；所有角度由 `time` / `frame` 决定，可逐帧复现。
 */
export interface StaffShieldProps {
  cx: number;
  cy: number;
  radius: number;
  time: number;
  frame: number;
  intensity?: number;
  high?: number;
}

const blade = (
  cx: number,
  cy: number,
  radius: number,
  start: number,
  span: number,
  inner: number,
  outer: number,
): string => {
  const p1 = [cx + Math.cos(start) * radius, cy + Math.sin(start) * radius];
  const p2 = [cx + Math.cos(start + span) * radius, cy + Math.sin(start + span) * radius];
  const p3 = [cx + Math.cos(start + span * 0.72) * (radius + outer), cy + Math.sin(start + span * 0.72) * (radius + outer)];
  const p4 = [cx + Math.cos(start + span * 0.28) * (radius + outer), cy + Math.sin(start + span * 0.28) * (radius + outer)];
  const p5 = [cx + Math.cos(start + span * 0.5) * (radius - inner), cy + Math.sin(start + span * 0.5) * (radius - inner)];
  return [p1, p4, p3, p2, p5].map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
};

export const StaffShield: React.FC<StaffShieldProps> = ({
  cx,
  cy,
  radius,
  time,
  frame,
  intensity = 0.7,
  high = 0,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `shield-${rawId}-${suffix}`;
  const power = Math.min(1, Math.max(0, intensity + high * 0.2));

  const sparks = useMemo(
    () =>
      Array.from({length: 34}, (_, index) => ({
        angle: -1.15 + hash(7101, index) * 2.3,
        phase: hash(7102, index) * 1.1,
        size: 3 + hash(7103, index) * 8,
        speed: 240 + hash(7104, index) * 540,
        tint: hash(7105, index),
      })),
    [],
  );

  const rings = [
    {ratio: 1, blades: 18, spin: 178, width: 0.095, color: SENBON.gold},
    {ratio: 0.79, blades: 15, spin: -236, width: 0.11, color: SENBON.cinnabar},
    {ratio: 0.585, blades: 12, spin: 322, width: 0.12, color: SENBON.goldLight},
  ];

  const dotRings = [
    {r: radius * 0.9, w: radius * 0.15, opacity: 0.72},
    {r: radius * 0.7, w: radius * 0.1, opacity: 0.5},
  ];

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible'}}
    >
      <defs>
        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity={0.2 + power * 0.14} />
          <stop offset="42%" stopColor={SENBON.cinnabar} stopOpacity="0.12" />
          <stop offset="72%" stopColor={SENBON.gold} stopOpacity="0.08" />
          <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('blade')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="42%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.cinnabar} />
        </linearGradient>
        <pattern id={id('dots')} width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <circle cx="3" cy="3" r="1.9" fill={SENBON.goldLight} />
          <circle cx="7.6" cy="7.8" r="0.95" fill={SENBON.cinnabar} />
        </pattern>
        {dotRings.map((ring, index) => (
          <mask key={`mask-${index}`} id={id(`ringmask-${index}`)}>
            <circle cx={cx} cy={cy} r={ring.r} fill="none" stroke="#FFFFFF" strokeWidth={ring.w} opacity="0.92" />
          </mask>
        ))}
        <filter id={id('blur')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* 外圈光晕 */}
      <circle cx={cx} cy={cy} r={radius * 1.36} fill={`url(#${id('glow')})`} opacity="0.72" />
      <circle
        cx={cx}
        cy={cy}
        r={radius * 1.12}
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="12"
        opacity={0.07 + power * 0.06}
        filter={`url(#${id('blur')})`}
      />

      {/* 半调网点环 */}
      {dotRings.map((ring, index) => (
        <g key={`dotring-${index}`} opacity={ring.opacity * (0.7 + power * 0.3)} style={{mixBlendMode: 'screen'}}>
          <rect
            x={cx - radius * 1.45}
            y={cy - radius * 1.45}
            width={radius * 2.9}
            height={radius * 2.9}
            fill={`url(#${id('dots')})`}
            mask={`url(#${id(`ringmask-${index}`)})`}
          />
        </g>
      ))}

      {/* 三圈反向旋转的弧形刀光 */}
      {rings.map((ring, ringIndex) => {
        const r = radius * ring.ratio;
        const rotation = time * ring.spin;
        return (
          <g key={`ring-${ringIndex}`} transform={`translate(${f(cx)} ${f(cy)}) rotate(${f(rotation)})`}>
            {Array.from({length: ring.blades}, (_, index) => {
              const start = (index / ring.blades) * Math.PI * 2;
              return (
                <polygon
                  key={`blade-${ringIndex}-${index}`}
                  points={blade(0, 0, r, start, ring.width * (0.5 + hash(8101 + ringIndex, index) * 0.26), r * 0.04, r * 0.055)}
                  fill={index % 4 === 0 ? SENBON.goldPale : index % 3 === 0 ? ring.color : `url(#${id('blade')})`}
                  opacity={0.22 + power * 0.18}
                  stroke={SENBON.goldLight}
                  strokeWidth="0.8"
                  strokeOpacity="0.3"
                />
              );
            })}
            <circle cx="0" cy="0" r={r} fill="none" stroke={ring.color} strokeWidth={ringIndex === 0 ? 3 : 1.6} opacity={0.34} />
            <circle
              cx="0"
              cy="0"
              r={r}
              fill="none"
              stroke={SENBON.paper}
              strokeWidth="1"
              strokeDasharray="2 24"
              opacity={0.28}
            />
          </g>
        );
      })}

      {/* 14 根高速旋转的棒影 */}
      <g transform={`translate(${f(cx)} ${f(cy)}) rotate(${f(time * 880)})`} style={{mixBlendMode: 'screen'}}>
        {Array.from({length: 14}, (_, index) => {
          const angle = (index / 14) * 360;
          const length = radius * (0.9 + hash(9101, index) * 0.2);
          return (
            <g key={`spoke-${index}`} transform={`rotate(${f(angle)})`}>
              <polygon
                points={`${f(length)},0 ${f(radius * 0.12)},${f(-4 - (index % 3))} ${f(radius * 0.05)},0 ${f(radius * 0.12)},${f(4 + (index % 3))}`}
                fill={index % 5 === 0 ? SENBON.goldPale : SENBON.gold}
                opacity={0.06 + (index % 4) * 0.025}
              />
              <circle cx={f(length)} cy="0" r={f(2.4 + (index % 3))} fill={SENBON.goldPale} opacity="0.5" />
            </g>
          );
        })}
      </g>

      {/* 盾缘爆闪：箭矢撞上来的位置 */}
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const cycle = 0.62;
        const phase = ((time + index * 0.11) / cycle) % 1;
        const flash = phase < 0.22 ? 1 - phase / 0.22 : 0;
        const angle = -0.62 + index * 0.21;
        const x = cx + Math.cos(angle) * radius * 1.01;
        const y = cy + Math.sin(angle) * radius * 1.01;
        return (
          <g key={`impact-${index}`} opacity={flash} style={{mixBlendMode: 'screen'}}>
            <circle cx={f(x)} cy={f(y)} r={f(10 + flash * 36)} fill={SENBON.gold} opacity="0.32" filter={`url(#${id('blur')})`} />
            <polygon
              points={`${f(x - 46 * flash)},${f(y)} ${f(x)},${f(y - 7)} ${f(x + 46 * flash)},${f(y)} ${f(x)},${f(y + 7)}`}
              fill={SENBON.goldPale}
              opacity="0.9"
            />
            <polygon
              points={`${f(x)},${f(y - 38 * flash)} ${f(x + 6)},${f(y)} ${f(x)},${f(y + 38 * flash)} ${f(x - 6)},${f(y)}`}
              fill={SENBON.paper}
              opacity="0.8"
            />
          </g>
        );
      })}

      {/* 甩出的火星 */}
      <g style={{mixBlendMode: 'screen'}}>
        {sparks.map((spark, index) => {
          const cycle = 0.52 + (index % 5) * 0.06;
          const t = ((time + spark.phase) / cycle) % 1;
          const angle = 0.1 + spark.angle * 0.35;
          const distance = radius * 0.98 + spark.speed * t * cycle;
          const x = cx + Math.cos(angle) * distance;
          const y = cy + Math.sin(angle) * distance + 260 * t * t;
          const size = spark.size * (1 - t * 0.5);
          const direction = angle + (t - 0.5) * 0.8;
          return (
            <g key={`spark-${index}`} opacity={(1 - t) ** 1.2 * 0.95}>
              <line
                x1={f(x)}
                y1={f(y)}
                x2={f(x - Math.cos(direction) * size * 5)}
                y2={f(y - Math.sin(direction) * size * 5)}
                stroke={spark.tint > 0.6 ? SENBON.cinnabar : SENBON.gold}
                strokeWidth={f(Math.max(0.8, size * 0.4))}
                strokeLinecap="round"
              />
              <polygon
                points={`${f(x + Math.cos(direction) * size * 1.8)},${f(y + Math.sin(direction) * size * 1.8)} ${f(
                  x + Math.cos(direction + 2.2) * size * 0.55,
                )},${f(y + Math.sin(direction + 2.2) * size * 0.55)} ${f(x + Math.cos(direction - 2.2) * size * 0.55)},${f(
                  y + Math.sin(direction - 2.2) * size * 0.55,
                )}`}
                fill={index % 4 === 0 ? SENBON.paper : spark.tint > 0.6 ? SENBON.cinnabar : SENBON.gold}
              />
            </g>
          );
        })}
      </g>

      {/* 风眼：暗芯 + 极亮的核，读成“环”而不是“太阳” */}
      <circle cx={cx} cy={cy} r={radius * 0.44} fill="#070405" opacity="0.52" />
      <circle cx={cx} cy={cy} r={radius * 0.13} fill={SENBON.goldPale} opacity={0.1 + power * 0.07} filter={`url(#${id('blur')})`} />
      <circle cx={cx} cy={cy} r={radius * 0.035} fill={SENBON.paper} opacity="0.7" />
    </svg>
  );
};

export default StaffShield;
