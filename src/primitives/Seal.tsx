import React, {useId, useMemo} from 'react';
import {FONT_STACKS, PALETTE} from '../config/theme';
import {clamp, ease, rng} from '../utils/math';

export interface SealProps {
  text: string;
  size?: number;
  /** 0 → 1 stamping progress. Parent resolves seconds × fps before passing. */
  progress?: number;
  rotate?: number;
  seed?: number;
  color?: string;
  engravedColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface SealGlyph {
  char: string;
  x: number;
  y: number;
  fontSize: number;
}

const layoutGlyphs = (text: string): SealGlyph[] => {
  const chars = Array.from(text).slice(0, 4);
  if (chars.length <= 1) {
    return [{char: chars[0] ?? text, x: 50, y: 51.5, fontSize: 48}];
  }
  if (chars.length === 2) {
    return [
      {char: chars[0] ?? '', x: 50, y: 35.5, fontSize: 35},
      {char: chars[1] ?? '', x: 50, y: 70.5, fontSize: 35},
    ];
  }
  if (chars.length === 3) {
    return [
      {char: chars[0] ?? '', x: 65, y: 34, fontSize: 30},
      {char: chars[1] ?? '', x: 65, y: 68, fontSize: 30},
      {char: chars[2] ?? '', x: 35, y: 34, fontSize: 30},
    ];
  }
  // Traditional seal reading order: top-right → bottom-right → top-left → bottom-left.
  return [
    {char: chars[0] ?? '', x: 66, y: 34, fontSize: 29},
    {char: chars[1] ?? '', x: 66, y: 69, fontSize: 29},
    {char: chars[2] ?? '', x: 34, y: 34, fontSize: 29},
    {char: chars[3] ?? '', x: 34, y: 69, fontSize: 29},
  ];
};

/**
 * Living seal extracted from `DFS.seal` + `HUB.inkStampSplash`:
 * irregular cinnabar face, engraved paper-coloured glyphs, deterministic
 * weathering, physical drop, and a tiny ink splash. Intended for 齐天大圣 /
 * 如意 / 斗战胜佛 end plates.
 */
export const Seal: React.FC<SealProps> = ({
  text,
  size = 220,
  progress = 1,
  rotate = -3,
  seed = 17,
  color = PALETTE.cinnabar,
  engravedColor = PALETTE.paper,
  className,
  style,
}) => {
  const reactId = useId().replace(/:/g, '');
  const filterId = `seal-filter-${reactId}`;
  const clipId = `seal-clip-${reactId}`;

  const glyphs = useMemo(() => layoutGlyphs(text), [text]);

  const flecks = useMemo(() => {
    const random = rng(seed * 7919 + 3);
    return Array.from({length: 84}, () => ({
      x: 8 + random() * 84,
      y: 8 + random() * 84,
      r: 0.25 + random() * 1.1,
      alpha: 0.08 + random() * 0.28,
      pale: random() > 0.58,
    }));
  }, [seed]);

  const splash = useMemo(() => {
    const random = rng(seed * 4409 + 11);
    return Array.from({length: 56}, () => {
      const angle = random() * Math.PI * 2;
      const distance = 38 + random() * 36;
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance * 0.72 + random() * 8,
        radius: 0.35 + random() * 1.65,
        phase: random(),
      };
    });
  }, [seed]);

  const p = clamp(progress);
  const impactAt = 0.32;
  const settle = ease.outExpo(clamp((p - impactAt) / 0.52));
  const drop = 1 - ease.inCubic(clamp(p / impactAt));
  const scale = 1.55 - 0.55 * settle;
  const translateY = drop * -78;
  const blur = (1 - settle) * 5.2;
  const opacity = p <= 0 ? 0 : 0.12 + 0.88 * clamp(p / impactAt + 0.08);
  const splashProgress = clamp((p - impactAt) / 0.38);
  const splashEase = ease.outExpo(splashProgress);
  const splashFade = 1 - clamp(splashProgress) ** 2.2;

  return (
    <div
      role="img"
      aria-label={`印章：${text}`}
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        opacity,
        filter: `blur(${blur.toFixed(2)}px)`,
        transform: `translateY(${translateY.toFixed(2)}px) rotate(${rotate}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: '50% 50%',
        willChange: 'transform, opacity, filter',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{position: 'absolute', inset: 0, overflow: 'visible'}}
      >
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.53"
              numOctaves="2"
              seed={seed % 999}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="2.8"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <clipPath id={clipId}>
            <rect x="8" y="8" width="84" height="84" rx="1.4" />
          </clipPath>
        </defs>

        {splashFade > 0.001 ? (
          <g aria-hidden="true">
            {splash.map((particle, index) => {
              const travel = (0.15 + particle.phase * 0.85) * splashEase;
              return (
                <circle
                  key={`splash-${index}`}
                  cx={50 + particle.dx * travel}
                  cy={50 + particle.dy * travel}
                  r={particle.radius * (1 - splashProgress * 0.3)}
                  fill={index % 7 === 0 ? color : PALETTE.ink}
                  opacity={splashFade * (0.18 + particle.phase * 0.5)}
                />
              );
            })}
          </g>
        ) : null}

        <g filter={`url(#${filterId})`}>
          <rect x="8" y="8" width="84" height="84" rx="1.2" fill={color} />
          <rect
            x="18.2"
            y="18.2"
            width="63.6"
            height="63.6"
            fill="none"
            stroke={engravedColor}
            strokeWidth="1.25"
            opacity="0.66"
          />
        </g>

        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {flecks.map((fleck, index) => (
            <circle
              key={`fleck-${index}`}
              cx={fleck.x}
              cy={fleck.y}
              r={fleck.r}
              fill={fleck.pale ? engravedColor : PALETTE.ink}
              opacity={fleck.alpha}
            />
          ))}
        </g>

        <g
          fill={engravedColor}
          fontFamily={FONT_STACKS.heavy}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="middle"
          opacity="0.96"
        >
          {glyphs.map((glyph, index) => (
            <text
              key={`${glyph.char}-${index}`}
              x={glyph.x}
              y={glyph.y}
              fontSize={glyph.fontSize}
              letterSpacing="0.8"
            >
              {glyph.char}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
};
