import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {BRUSH_STACK, SERIF_STACK, SENBON, f} from './style';

/**
 * `<ComplexOfudaTalisman />` —— 五层复合符咒（严禁单层白框）。
 *
 * ① 宣纸底：手撕毛边轮廓 + 和纸纤维 + 陈旧斑点
 * ② 外粗内细朱砂双框
 * ③ 四角云雷纹角花
 * ④ 中心八卦 / 雷纹暗印（低透明度，压在字下）
 * ⑤ 顶部「敕令」符头 + 中央苍劲毛笔字 + 底部朱文小印 + 钉入岩壁的金钉
 *
 * 每次实例都有独立 `useId()` 的 pattern / clip，互不串色。
 */
export interface ComplexOfudaTalismanProps {
  text: string;
  /** 旋转角（度）。 */
  angle?: number;
  width?: number;
  height?: number;
  /** 0→1 飞入落位；父组件负责按拍点传入。 */
  reveal?: number;
  /** 钉入瞬间的横向/纵向抖动（px）。 */
  shakeX?: number;
  shakeY?: number;
  /** 符头文字，默认「敕令」。 */
  header?: string;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

const VW = 200;
const VH = 460;

const deckle = (seed: number): string => {
  const points: Array<[number, number]> = [];
  const jitter = (index: number, amount: number) => (hash(seed, index) - 0.5) * amount;
  const steps = 9;
  // 上边
  for (let i = 0; i <= steps; i += 1) {
    points.push([8 + (184 * i) / steps, 8 + jitter(i + 1, 4)]);
  }
  // 右边
  for (let i = 1; i <= steps; i += 1) {
    points.push([192 + jitter(i + 30, 4), 8 + (444 * i) / steps]);
  }
  // 下边（中央留一个撕口）
  for (let i = 1; i <= steps; i += 1) {
    const x = 192 - (184 * i) / steps;
    const notch = Math.abs(x - 100) < 14 ? 7 : 0;
    points.push([x, 452 + jitter(i + 60, 4) + notch]);
  }
  // 左边
  for (let i = 1; i < steps; i += 1) {
    points.push([8 + jitter(i + 90, 4), 452 - (444 * i) / steps]);
  }
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')} Z`;
};

const cornerPath = (): string =>
  'M 3 30 C 3 16 10 8 24 5 C 30 14 27 22 19 24 C 13 25 11 19 16 16 C 21 13 24 18 21 21';

const trigrams = (cx: number, cy: number, radius: number): React.ReactNode =>
  Array.from({length: 8}, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    return (
      <g key={`trigram-${index}`} transform={`translate(${f(x)} ${f(y)}) rotate(${f((angle * 180) / Math.PI + 90)})`}>
        {[0, 1, 2].map((bar) => (
          <rect
            key={`bar-${bar}`}
            x={-13}
            y={-5 + bar * 5.4}
            width={index % 2 === bar ? 22 : 26}
            height={2}
            fill={SENBON.cinnabarDeep}
            opacity={0.9}
          />
        ))}
      </g>
    );
  });

export const ComplexOfudaTalisman: React.FC<ComplexOfudaTalismanProps> = ({
  text,
  angle = 0,
  width = 168,
  height = 420,
  reveal = 1,
  shakeX = 0,
  shakeY = 0,
  header = '敕令',
  opacity = 1,
  className,
  style,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `ofuda-${rawId}-${suffix}`;
  const paper = useMemo(() => deckle(7421), []);

  const specks = useMemo(
    () =>
      Array.from({length: 30}, (_, index) => ({
        x: 18 + hash(8101, index) * 164,
        y: 18 + hash(8102, index) * 420,
        r: 0.6 + hash(8103, index) * 2.6,
        a: 0.05 + hash(8104, index) * 0.14,
        red: hash(8105, index) > 0.72,
      })),
    [],
  );

  const brushSize = Math.min(
    width * 0.62,
    (height * 0.62) / Math.max(1, text.length) * 1.02,
    text.length > 2 ? 84 : 118,
  );

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        width,
        height,
        transform: `rotate(${f(angle)}deg) translate(${f(shakeX)}px, ${f(shakeY)}px) scale(${f(
          1.28 - 0.28 * Math.min(1, Math.max(0, reveal)),
        )})`,
        opacity: opacity * Math.min(1, Math.max(0, reveal * 1.9)),
        filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.8))',
        ...style,
      }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{position: 'absolute', inset: 0}}
      >
        <defs>
          <linearGradient id={id('paper')} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#FBF6EC" />
            <stop offset="52%" stopColor={SENBON.paper} />
            <stop offset="100%" stopColor="#D9CCB2" />
          </linearGradient>
          <linearGradient id={id('red')} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#E84236" />
            <stop offset="55%" stopColor={SENBON.cinnabar} />
            <stop offset="100%" stopColor={SENBON.cinnabarDeep} />
          </linearGradient>
          <pattern id={id('fibre')} width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M0 3H12" stroke="#8B7A5E" strokeWidth="0.45" opacity="0.16" />
            <path d="M0 9H12" stroke="#8B7A5E" strokeWidth="0.3" opacity="0.1" />
            <path d="M3 0V12" stroke="#8B7A5E" strokeWidth="0.25" opacity="0.07" />
          </pattern>
          <pattern id={id('halftone')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="2" cy="2" r="0.9" fill={SENBON.cinnabarDeep} opacity="0.18" />
          </pattern>
          <clipPath id={id('paperClip')}>
            <path d={paper} />
          </clipPath>
        </defs>

        {/* ① 宣纸底 + 纤维 + 陈斑 */}
        <g clipPath={`url(#${id('paperClip')})`}>
          <rect width={VW} height={VH} fill={`url(#${id('paper')})`} />
          <rect width={VW} height={VH} fill={`url(#${id('fibre')})`} />
          <rect width={VW} height={VH} fill={`url(#${id('halftone')})`} opacity="0.8" />
          {specks.map((speck, index) => (
            <circle
              key={`speck-${index}`}
              cx={f(speck.x)}
              cy={f(speck.y)}
              r={f(speck.r)}
              fill={speck.red ? SENBON.cinnabarDeep : '#6B5A41'}
              opacity={f(speck.a)}
            />
          ))}
          {/* 上下朱砂压边，模拟朱砂刷边 */}
          <rect x="0" y="0" width={VW} height="7" fill={SENBON.cinnabar} opacity="0.58" />
          <rect x="0" y={VH - 7} width={VW} height="7" fill={SENBON.cinnabar} opacity="0.58" />
          {/* 纸面折痕 */}
          <path d="M 100 8 L 94 452" stroke="#9A886B" strokeWidth="1.1" opacity="0.12" />
          <path d="M 8 236 L 192 232" stroke="#9A886B" strokeWidth="0.9" opacity="0.1" />
        </g>

        {/* ② 外粗内细朱砂双框 */}
        <rect x="19" y="18" width="162" height="424" fill="none" stroke={`url(#${id('red')})`} strokeWidth="8" />
        <rect x="31" y="30" width="138" height="400" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="2" opacity="0.9" />
        <rect x="35" y="34" width="130" height="392" fill="none" stroke={SENBON.paper} strokeWidth="1" opacity="0.55" />

        {/* ③ 四角云雷纹角花 */}
        <g fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="2.4" strokeLinecap="round">
          <g transform="translate(28 36)">
            <path d={cornerPath()} />
          </g>
          <g transform="translate(172 36) scale(-1 1)">
            <path d={cornerPath()} />
          </g>
          <g transform="translate(28 424) scale(1 -1)">
            <path d={cornerPath()} />
          </g>
          <g transform="translate(172 424) scale(-1 -1)">
            <path d={cornerPath()} />
          </g>
        </g>
        <g fill="none" stroke={SENBON.goldDeep} strokeWidth="0.9" opacity="0.6">
          <path d="M 36 44 L 50 44 L 50 36" />
          <path d="M 164 44 L 150 44 L 150 36" />
          <path d="M 36 416 L 50 416 L 50 424" />
          <path d="M 164 416 L 150 416 L 150 424" />
        </g>

        {/* ④ 八卦 / 雷纹暗印 */}
        <g opacity="0.32">
          <polygon
            points={Array.from({length: 8}, (_, index) => {
              const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
              return `${f(100 + Math.cos(angle) * 66)},${f(232 + Math.sin(angle) * 66)}`;
            }).join(' ')}
            fill="none"
            stroke={SENBON.cinnabarDeep}
            strokeWidth="1.8"
          />
          <circle cx="100" cy="232" r="52" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="1.2" />
          {trigrams(100, 232, 59)}
          <path d="M 100 180 L 112 198 L 96 214 L 110 232" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="3" />
        </g>
        {/* 两侧雷纹竖带 */}
        <g fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="1.6" opacity="0.24">
          {[46, 154].map((x) => (
            <path
              key={`thunder-${x}`}
              d={`M ${x} 70 L ${x + 7} 88 L ${x - 6} 106 L ${x + 6} 124 L ${x - 5} 142 L ${x + 4} 160 L ${x - 4} 178 L ${x + 5} 196 L ${x - 6} 214 L ${x + 4} 232`}
            />
          ))}
        </g>

        {/* ⑤ 顶部符头「敕令」 */}
        <rect x="52" y="24" width="96" height="52" fill={`url(#${id('red')})`} stroke={SENBON.cinnabarDeep} strokeWidth="2" />
        <rect x="56" y="28" width="88" height="44" fill="none" stroke={SENBON.paper} strokeWidth="0.9" opacity="0.55" />
        <text
          x="100"
          y="60"
          textAnchor="middle"
          fontFamily={BRUSH_STACK}
          fontWeight={700}
          fontSize="28"
          letterSpacing="2"
          fill={SENBON.paper}
        >
          {header}
        </text>

        {/* ⑤ 底部朱文小印 */}
        <rect x="83" y="402" width="34" height="30" fill={SENBON.cinnabar} stroke={SENBON.cinnabarDeep} strokeWidth="1.4" />
        <text x="100" y="423" textAnchor="middle" fontFamily={SERIF_STACK} fontWeight={800} fontSize="16" fill={SENBON.paper}>
          封
        </text>

        {/* 金钉：钉入岩壁 */}
        <g>
          <circle cx="38" cy="40" r="7" fill={SENBON.gold} stroke={SENBON.goldDeep} strokeWidth="1.6" />
          <circle cx="36" cy="38" r="2.2" fill={SENBON.goldPale} />
          <circle cx="162" cy="40" r="7" fill={SENBON.gold} stroke={SENBON.goldDeep} strokeWidth="1.6" />
          <circle cx="160" cy="38" r="2.2" fill={SENBON.goldPale} />
          <path d="M 38 47 C 42 58 34 64 38 76" fill="none" stroke={SENBON.gold} strokeWidth="1.4" opacity="0.6" />
          <path d="M 162 47 C 158 58 166 64 162 76" fill="none" stroke={SENBON.gold} strokeWidth="1.4" opacity="0.6" />
        </g>
      </svg>

      {/* ⑤ 中央苍劲毛笔字：单文本节点、竖排 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '18%',
          bottom: '12%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          width: '100%',
          fontFamily: BRUSH_STACK,
          fontWeight: 700,
          fontSize: brushSize,
          lineHeight: 1.02,
          letterSpacing: '0.04em',
          color: '#7C130D',
          textShadow: '0 0 1px rgba(42,6,4,0.9), 0 2px 4px rgba(42,6,4,0.24)',
          WebkitTextStroke: '0.5px rgba(42,6,4,0.35)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ComplexOfudaTalisman;
