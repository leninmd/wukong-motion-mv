import React, {useId} from 'react';
import {FONT_STACKS, PALETTE} from '../config/theme';

export interface PosterFrameProps {
  /** Chapter label in the top cartouche. */
  title?: string;
  /** Small subtitle under the cartouche. */
  subtitle?: string;
  /** Vertical type down the left edge. */
  leftType?: string;
  /** Vertical type down the right edge. */
  rightType?: string;
  /** Seal text, 2–4 glyphs. */
  seal?: string;
  /** 0–1 accent: the frame rules glow with the kick. */
  pulse?: number;
  opacity?: number;
}

const INSET = 42;
const RULE_INNER = 56;

/**
 * 版画海报边框.
 *
 * The single biggest difference between a "render" and a "poster": a hard
 * printed frame. Double hairline rules, art-nouveau corner hooks, side
 * cartouches and a cinnabar seal hold every shot inside the same graphic
 * system, so twelve different compositions still read as one MV.
 */
export const PosterFrame: React.FC<PosterFrameProps> = ({
  title = '第三幕',
  subtitle = '凌霄 · 五行山',
  leftType = '如意金箍棒',
  rightType = '五行山下',
  seal = '齐天',
  pulse = 0,
  opacity = 1,
}) => {
  const reactId = useId().replace(/[:«»]/g, '');
  const gold = PALETTE.gold;
  const rule = `rgba(252,201,52,${(0.42 + pulse * 0.28).toFixed(3)})`;
  const ruleSoft = `rgba(252,201,52,${(0.16 + pulse * 0.12).toFixed(3)})`;

  const corner = (x: 1 | -1, y: 1 | -1) => {
    const cx = x > 0 ? 1920 - INSET : INSET;
    const cy = y > 0 ? 1080 - INSET : INSET;
    return (
      <g key={`corner-${x}-${y}`} stroke={ruleSoft} fill="none" strokeWidth={1.2}>
        <path d={`M ${cx} ${cy + y * 84} L ${cx} ${cy} L ${cx + x * 84} ${cy}`} />
        <path d={`M ${cx + x * 14} ${cy + y * 52} L ${cx + x * 14} ${cy + y * 14} L ${cx + x * 52} ${cy + y * 14}`} />
        <path
          d={`M ${cx + x * 24} ${cy + y * 70} q ${x * 26} ${y * 4} ${x * 30} ${y * 26}`}
          strokeWidth={0.9}
          opacity={0.8}
        />
        <circle cx={cx + x * 34} cy={cy + y * 34} r={2.4} fill={gold} stroke="none" />
      </g>
    );
  };

  return (
    <div aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity}}>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`foil-${reactId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE.gold} />
            <stop offset="45%" stopColor={PALETTE.paper} />
            <stop offset="100%" stopColor={PALETTE.gold} />
          </linearGradient>
        </defs>

        {/* double rules */}
        <rect x={INSET} y={INSET} width={1920 - INSET * 2} height={1080 - INSET * 2} fill="none" stroke={rule} strokeWidth={2} />
        <rect
          x={RULE_INNER}
          y={RULE_INNER}
          width={1920 - RULE_INNER * 2}
          height={1080 - RULE_INNER * 2}
          fill="none"
          stroke={ruleSoft}
          strokeWidth={1}
        />

        {/* corner hooks */}
        {corner(1, 1)}
        {corner(-1, 1)}
        {corner(1, -1)}
        {corner(-1, -1)}

        {/* top cartouche */}
        <g>
          <rect x={960 - 118} y={INSET - 1} width={236} height={54} fill={PALETTE.ink} stroke={rule} strokeWidth={1.4} />
          <rect x={960 - 108} y={INSET + 9} width={216} height={34} fill="none" stroke={ruleSoft} strokeWidth={0.8} />
          <text
            x={960}
            y={INSET + 22}
            textAnchor="middle"
            fontFamily={FONT_STACKS.song}
            fontSize={19}
            letterSpacing={8}
            fill={`url(#foil-${reactId})`}
          >
            {title}
          </text>
          <text
            x={960}
            y={INSET + 40}
            textAnchor="middle"
            fontFamily={FONT_STACKS.kai}
            fontSize={11}
            letterSpacing={4}
            fill="rgba(244,239,230,0.55)"
          >
            {subtitle}
          </text>
        </g>

        {/* bottom seal */}
        <g transform={`translate(${1920 - INSET - 92} ${1080 - INSET - 118}) rotate(-2.4)`}>
          <rect width={92} height={92} fill={PALETTE.cinnabar} opacity={0.92} />
          <rect x={7} y={7} width={78} height={78} fill="none" stroke={PALETTE.paper} strokeWidth={1.6} opacity={0.72} />
          <text
            x={46}
            y={38}
            textAnchor="middle"
            fontFamily={FONT_STACKS.heavy}
            fontWeight={900}
            fontSize={26}
            fill={PALETTE.paper}
          >
            {seal.slice(0, 1)}
          </text>
          <text
            x={46}
            y={70}
            textAnchor="middle"
            fontFamily={FONT_STACKS.heavy}
            fontWeight={900}
            fontSize={26}
            fill={PALETTE.paper}
          >
            {seal.slice(1, 2)}
          </text>
        </g>

        {/* side vertical cartouches */}
        {[
          {x: INSET + 18, text: leftType, side: -1 as const},
          {x: 1920 - INSET - 46, text: rightType, side: 1 as const},
        ].map((item) => (
          <g key={item.side}>
            <line
              x1={item.x + (item.side > 0 ? 28 : 0)}
              y1={180}
              x2={item.x + (item.side > 0 ? 28 : 0)}
              y2={560}
              stroke={ruleSoft}
              strokeWidth={0.8}
            />
            <text
              x={item.x + 14}
              y={200}
              fontFamily={FONT_STACKS.brush}
              fontSize={34}
              fill={`url(#foil-${reactId})`}
              opacity={0.78}
            >
              {Array.from(item.text).map((char, index) => (
                <tspan key={`${char}-${index}`} x={item.x + 14} dy={index === 0 ? 0 : 42}>
                  {char}
                </tspan>
              ))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
