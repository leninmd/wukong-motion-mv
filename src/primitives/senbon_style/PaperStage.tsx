import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';

/**
 * 和纸舞台 —— V5 的"明亮底"基础设施。
 *
 * 《千本樱》的高级感来自**用亮底直接托住纯黑剪影**，而不是黑底 + 荧光描边。
 * 本文件提供四件东西：
 *   · `<PaperField />`  一张有纤维、有霉点、四边微暗的和纸
 *   · `<MoonDisc />`    暖白满月（半调网点 + 光晕），剪影的逆光板
 *   · `<CloudBank />`   浮世绘式云浪（多层同色系曲线带）
 *   · `<InkSpecks />`   飞溅的墨点（固定种子，逐帧只做视差）
 *
 * 全部用 SVG pattern 与纯色叠加，不跑 feTurbulence，不做逐帧模糊。
 */

/** V5 的和纸四色（AGENTS.md §9.8 允许在复刻段做明度/色相微调）。 */
export const WASHI = {
  /** 古宣纸米白 */
  paper: '#EAE0CE',
  /** 亮宣纸（眼部横切底） */
  paperBright: '#F2E8D5',
  /** 满月暖白 */
  moon: '#FFF3D1',
  /** 深绯红 */
  crimson: '#7A1C1C',
  /** 深黛紫 */
  purple: '#1B1521',
  /** 泥金黄 */
  ochre: '#C29526',
  /** 剪影墨（不用纯黑，留一点暖） */
  ink: '#120D14',
  /** 朱砂 */
  cinnabar: '#D93025',
} as const;

export const PaperField: React.FC<{
  tone?: string;
  seed?: number;
  children?: React.ReactNode;
  vignette?: number;
}> = ({tone = WASHI.paper, seed = 4411, children, vignette = 0.22}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `pf-${rawId}-${suffix}`;
  const flecks = useMemo(
    () =>
      Array.from({length: 220}, (_, index) => ({
        x: hash(seed, index) * 1920,
        y: hash(seed + 17, index) * 1080,
        r: 0.6 + hash(seed + 31, index) * 2.4,
        a: 0.04 + hash(seed + 47, index) * 0.12,
        dark: hash(seed + 59, index) > 0.55,
      })),
    [seed],
  );
  const fibers = useMemo(
    () =>
      Array.from({length: 90}, (_, index) => ({
        x: hash(seed + 101, index) * 1920,
        y: hash(seed + 131, index) * 1080,
        len: 18 + hash(seed + 151, index) * 120,
        angle: hash(seed + 173, index) * 180,
        a: 0.03 + hash(seed + 191, index) * 0.07,
      })),
    [seed],
  );

  return (
    <AbsoluteFill style={{backgroundColor: tone, overflow: 'hidden'}}>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id={id('warm')} cx="50%" cy="44%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
            <stop offset="62%" stopColor="#FFFFFF" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity={vignette} />
          </radialGradient>
        </defs>
        {fibers.map((fiber, index) => (
          <line
            key={`fib-${index}`}
            x1={fiber.x}
            y1={fiber.y}
            x2={fiber.x + Math.cos((fiber.angle * Math.PI) / 180) * fiber.len}
            y2={fiber.y + Math.sin((fiber.angle * Math.PI) / 180) * fiber.len}
            stroke={fiber.a > 0.06 ? '#FFFFFF' : '#6B5A43'}
            strokeOpacity={fiber.a}
            strokeWidth={0.8}
          />
        ))}
        {flecks.map((fleck, index) => (
          <circle
            key={`fleck-${index}`}
            cx={fleck.x}
            cy={fleck.y}
            r={fleck.r}
            fill={fleck.dark ? '#4A3626' : '#FFFFFF'}
            opacity={fleck.a}
          />
        ))}
        <rect width="1920" height="1080" fill={`url(#${id('warm')})`} />
      </svg>
      {children}
    </AbsoluteFill>
  );
};

/** 满月：暖白圆盘 + 半调网屏 + 外光晕。 */
export const MoonDisc: React.FC<{
  cx: number;
  cy: number;
  radius: number;
  seed?: number;
  halo?: number;
  opacity?: number;
  crescent?: number;
}> = ({cx, cy, radius, seed = 9091, halo = 1.45, opacity = 1, crescent = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `moon-${rawId}-${suffix}`;
  const dots = useMemo(
    () =>
      Array.from({length: 150}, (_, index) => ({
        x: hash(seed, index) * 2 - 1,
        y: hash(seed + 13, index) * 2 - 1,
        r: 0.8 + hash(seed + 29, index) * 2.6,
        a: 0.05 + hash(seed + 43, index) * 0.12,
      })),
    [seed],
  );
  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}
    >
      <defs>
        <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#FFF3D1" stopOpacity="0.5" />
          <stop offset="78%" stopColor="#FFEBB8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#FFE3A0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('disc')} cx="46%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#FFFBEC" />
          <stop offset="62%" stopColor="#FFF3D1" />
          <stop offset="100%" stopColor="#F3DDA6" />
        </radialGradient>
        <pattern id={id('dots')} width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="6.5" cy="6.5" r="1.6" fill="#C9A96A" opacity="0.35" />
        </pattern>
        <clipPath id={id('clip')}>
          <circle cx={cx} cy={cy} r={radius} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={radius * halo} fill={`url(#${id('halo')})`} />
      <circle cx={cx} cy={cy} r={radius} fill={`url(#${id('disc')})`} />
      <g clipPath={`url(#${id('clip')})`}>
        <rect x={cx - radius} y={cy - radius} width={radius * 2} height={radius * 2} fill={`url(#${id('dots')})`} />
        {dots.map((dot, index) => (
          <circle
            key={`crater-${index}`}
            cx={cx + dot.x * radius * 0.86}
            cy={cy + dot.y * radius * 0.86}
            r={dot.r * (radius / 320)}
            fill="#C29A5E"
            opacity={dot.a}
          />
        ))}
      </g>
      {crescent > 0 ? (
        <circle
          cx={cx - radius * (0.9 - crescent * 0.4)}
          cy={cy - radius * 0.06}
          r={radius * 0.96}
          fill="none"
          stroke="#E7D3A8"
          strokeOpacity={crescent}
          strokeWidth={radius * 0.03}
        />
      ) : null}
    </svg>
  );
};

/** 浮世绘云浪：三层同色系扁带，波浪相位随 `time` 平移。 */
export const CloudBank: React.FC<{
  y: number;
  height?: number;
  color?: string;
  shade?: string;
  time?: number;
  amp?: number;
  opacity?: number;
}> = ({y, height = 220, color = '#F7EFDD', shade = '#DCCDB2', time = 0, amp = 26, opacity = 1}) => {
  const bands = [0, 1, 2];
  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      preserveAspectRatio="none"
      style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}
    >
      {bands.map((band) => {
        const shift = (time * (18 + band * 9)) % 240;
        const top = y - band * height * 0.26;
        const points: string[] = [`M -240 ${top + amp}`];
        for (let x = -240; x <= 2160; x += 60) {
          const wave =
            Math.sin((x + shift) / 190 + band * 1.7) * amp * (1 - band * 0.18) +
            Math.sin((x + shift) / 74 + band) * amp * 0.42;
          points.push(`L ${x} ${top + wave}`);
        }
        points.push(`L 2160 1080 L -240 1080 Z`);
        return (
          <path
            key={`band-${band}`}
            d={points.join(' ')}
            fill={band % 2 === 0 ? color : shade}
            opacity={0.92 - band * 0.16}
          />
        );
      })}
    </svg>
  );
};

/** 墨点飞溅：固定种子，随 `time` 做轻微视差。 */
export const InkSpecks: React.FC<{
  count?: number;
  seed?: number;
  time?: number;
  color?: string;
  spread?: number;
}> = ({count = 60, seed = 3131, time = 0, color = WASHI.ink, spread = 1}) => {
  const specks = useMemo(
    () =>
      Array.from({length: count}, (_, index) => ({
        x: hash(seed, index) * 1920,
        y: hash(seed + 11, index) * 1080,
        r: 1.2 + hash(seed + 23, index) ** 3 * 16,
        a: 0.14 + hash(seed + 37, index) * 0.6,
        layer: 0.4 + hash(seed + 41, index) * 0.9,
      })),
    [count, seed],
  );
  return (
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {specks.map((speck, index) => (
        <ellipse
          key={`speck-${index}`}
          cx={speck.x + Math.sin(time * 1.4 + index) * 6 * spread * speck.layer}
          cy={speck.y + Math.cos(time * 1.1 + index) * 4 * spread * speck.layer}
          rx={speck.r * (1 + 0.5 * spread)}
          ry={speck.r}
          fill={color}
          opacity={speck.a}
          transform={`rotate(${(hash(seed + 61, index) - 0.5) * 140} ${speck.x} ${speck.y})`}
        />
      ))}
    </svg>
  );
};
