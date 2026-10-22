import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, SENBON} from './style';

export interface CelestialArmyProps {
  time: number;
  /** 0–1，从两侧向中心合拢的压迫值。 */
  pressure: number;
  /** 0–1，重音时的枪尖反光。 */
  pulse?: number;
}

const RANKS = [
  {scale: 0.4, y: 706, opacity: 0.34, gap: 84, offset: 40, converge: 190},
  {scale: 0.66, y: 836, opacity: 0.62, gap: 82, offset: 20, converge: 265},
  {scale: 0.98, y: 1002, opacity: 0.95, gap: 80, offset: -10, converge: 340},
] as const;

/**
 * 天兵阵列：左右各 30 名执戈天兵，三排纵深，随 `pressure` 向中心合拢。
 *
 * 单兵是一套可复用的 SVG 符号（盔缨/面甲/甲片/披风/长戈），通过 `<use>`
 * 实例化，保证 60 个对象仍然只有一份路径定义。
 */
export const CelestialArmy: React.FC<CelestialArmyProps> = ({time, pressure, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `army-${rawId}-${suffix}`;
  const p = clamp01(pressure);

  const soldiers = useMemo(() => {
    const list: Array<{
      key: string;
      x: number;
      y: number;
      scale: number;
      opacity: number;
      flip: boolean;
      tilt: number;
      phase: number;
      rank: number;
      spearGlow: number;
    }> = [];
    for (const side of [-1, 1] as const) {
      RANKS.forEach((rank, rankIndex) => {
        for (let row = 0; row < 10; row += 1) {
          const baseX = rank.offset + row * rank.gap;
          const jitter = (hash(3301 + rankIndex * 31, row) - 0.5) * 16;
          const x = side < 0 ? baseX + jitter : 1920 - baseX - jitter;
          list.push({
            key: `${side}-${rankIndex}-${row}`,
            x,
            y: rank.y + (hash(4409 + rankIndex, row) - 0.5) * 14,
            scale: rank.scale * (0.94 + hash(5501 + rankIndex, row) * 0.12),
            opacity: rank.opacity,
            flip: side > 0,
            tilt: (side < 0 ? 1 : -1) * (4 + p * 7),
            phase: hash(6607 + rankIndex, row) * Math.PI * 2,
            rank: rankIndex,
            spearGlow: hash(7703 + rankIndex, row),
          });
        }
      });
    }
    return list;
  }, [p]);

  const foreground = useMemo(
    () =>
      Array.from({length: 14}, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        return {
          key: `fg-${index}`,
          x: side < 0 ? -80 + row * 96 : 2000 - row * 96,
          y: 1096 + (hash(8811, index) - 0.5) * 30,
          scale: 1.55 + hash(9901, index) * 0.55,
          tilt: (side < 0 ? 1 : -1) * (16 + p * 5),
          opacity: 0.92,
          phase: hash(1123, index) * Math.PI * 2,
        };
      }),
    [p],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <g id={id('soldier')}>
            {/* 披风 */}
            <path
              d="M -30 -214 C -66 -156 -70 -76 -48 -8 L -26 -14 C -44 -78 -38 -158 -12 -208 Z"
              fill="#150F11"
              stroke={SENBON.gold}
              strokeOpacity="0.26"
              strokeWidth="1.4"
            />
            {/* 腿 */}
            <path d="M -36 -74 L -12 -74 L -8 0 L -34 0 Z" fill={SENBON.ink} />
            <path d="M 12 -74 L 36 -74 L 42 0 L 16 0 Z" fill={SENBON.ink} />
            <path d="M -40 0 L -4 0 L -6 -14 L -38 -14 Z" fill={SENBON.inkLift} stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.2" />
            <path d="M 10 0 L 46 0 L 44 -14 L 12 -14 Z" fill={SENBON.inkLift} stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.2" />
            {/* 战裙 */}
            <path d="M -42 -148 L 42 -148 L 50 -70 L 24 -78 L 12 -62 L 0 -80 L -12 -62 L -30 -78 L -50 -70 Z" fill="#1C1415" stroke={SENBON.gold} strokeOpacity="0.3" strokeWidth="1.4" />
            {/* 躯干 */}
            <path d="M -40 -246 L 40 -246 L 50 -152 L -50 -152 Z" fill="#1A1214" stroke={SENBON.gold} strokeOpacity="0.42" strokeWidth="1.8" />
            {[-228, -208, -188, -168].map((y) => (
              <path key={`lame-${y}`} d={`M -42 ${y} Q 0 ${y + 8} 42 ${y}`} fill="none" stroke={SENBON.gold} strokeOpacity="0.34" strokeWidth="1.2" />
            ))}
            <path d="M 0 -214 L 10 -202 L 0 -190 L -10 -202 Z" fill={SENBON.gold} opacity="0.7" />
            <path d="M -50 -200 L -50 -160" stroke={SENBON.gold} strokeWidth="1.4" opacity="0.45" />
            {/* 肩甲 */}
            <path d="M -56 -250 C -82 -240 -86 -212 -62 -202 L -38 -208 L -40 -244 Z" fill={SENBON.inkLift} stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.6" />
            <path d="M 56 -250 C 82 -240 86 -212 62 -202 L 38 -208 L 40 -244 Z" fill={SENBON.inkLift} stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.6" />
            <path d="M -60 -252 L -74 -274 L -50 -262 Z" fill={SENBON.gold} opacity="0.5" />
            <path d="M 60 -252 L 74 -274 L 50 -262 Z" fill={SENBON.gold} opacity="0.5" />
            {/* 持戈手臂 */}
            <path d="M 34 -236 C 52 -220 62 -196 60 -168 L 40 -160 C 40 -186 34 -208 22 -224 Z" fill={SENBON.ink} stroke={SENBON.gold} strokeOpacity="0.28" strokeWidth="1.4" />
            <path d="M -34 -236 C -52 -222 -60 -196 -54 -168 L -34 -160 C -38 -188 -30 -210 -20 -224 Z" fill={SENBON.ink} stroke={SENBON.gold} strokeOpacity="0.28" strokeWidth="1.4" />
            {/* 头盔 */}
            <ellipse cx="0" cy="-272" rx="23" ry="26" fill={SENBON.ink} />
            <path d="M -27 -282 Q 0 -318 27 -282 L 31 -260 Q 0 -242 -31 -260 Z" fill="#241A1B" stroke={SENBON.gold} strokeOpacity="0.6" strokeWidth="1.8" />
            <path d="M -27 -262 Q 0 -250 27 -262" fill="none" stroke={SENBON.cinnabar} strokeWidth="2.4" opacity="0.8" />
            <path d="M -18 -268 L 18 -268" stroke={SENBON.ink} strokeWidth="3" opacity="0.8" />
            <path d="M -30 -266 L -38 -248 L -28 -244" fill="#1E1618" stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.4" />
            <path d="M 30 -266 L 38 -248 L 28 -244" fill="#1E1618" stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.4" />
            <path d="M 0 -312 L 0 -298" stroke={SENBON.gold} strokeWidth="4" opacity="0.8" />
            <path d="M -17 -276 L 17 -276" stroke={SENBON.goldLight} strokeWidth="2.4" opacity="0.9" />
            <path d="M -22 -270 Q 0 -264 22 -270" fill="none" stroke={SENBON.gold} strokeWidth="1.2" opacity="0.45" />
            {/* 盔缨 */}
            <path d="M 0 -306 C -8 -344 8 -366 2 -404" fill="none" stroke={SENBON.cinnabar} strokeWidth="6" strokeLinecap="round" opacity="0.9" />
            <path d="M 0 -306 C -2 -340 14 -360 8 -392" fill="none" stroke={SENBON.gold} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            {/* 银白长戈 */}
            <line x1="46" y1="-140" x2="58" y2="-596" stroke={SENBON.silverDim} strokeWidth="5" />
            <line x1="46" y1="-140" x2="58" y2="-596" stroke={SENBON.silver} strokeWidth="2" />
            <path d="M 58 -596 L 74 -632 L 58 -682 L 42 -632 Z" fill={SENBON.silver} stroke={SENBON.paper} strokeWidth="1.4" />
            <path d="M 58 -596 L 58 -676" stroke={SENBON.paper} strokeWidth="1.2" opacity="0.8" />
            <path d="M 46 -560 C 30 -548 26 -536 30 -524" fill="none" stroke={SENBON.cinnabar} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
            <path d="M 52 -560 C 66 -548 70 -536 66 -524" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          </g>

          <linearGradient id={id('fog')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.ink} stopOpacity="0.9" />
            <stop offset="26%" stopColor={SENBON.ink} stopOpacity="0.2" />
            <stop offset="74%" stopColor={SENBON.ink} stopOpacity="0.2" />
            <stop offset="100%" stopColor={SENBON.ink} stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* 后景雾 */}
        <rect x="0" y="0" width="1920" height="1080" fill={`url(#${id('fog')})`} opacity="0.55" />

        {/* 60 名天兵 */}
        {soldiers.map((soldier) => {
          const converge = soldier.rank === 0 ? 170 : soldier.rank === 1 ? 250 : 330;
          const dx = (soldier.x < 960 ? 1 : -1) * converge * p * (0.6 + soldier.rank * 0.2);
          const bob = Math.sin(time * 4.4 + soldier.phase) * (1.4 + soldier.rank * 0.7);
          return (
            <g
              key={soldier.key}
              transform={`translate(${(soldier.x + dx).toFixed(2)} ${(soldier.y + bob).toFixed(2)}) scale(${(soldier.scale * (soldier.flip ? -1 : 1)).toFixed(3)} ${soldier.scale.toFixed(3)}) rotate(${soldier.tilt.toFixed(2)})`}
              opacity={soldier.opacity}
            >
              <use href={`#${id('soldier')}`} />
            </g>
          );
        })}

        {/* 前景枪林：高速视差 + 运动残影 */}
        {foreground.map((spear, index) => {
          const bob = Math.sin(time * 5.2 + spear.phase) * 3;
          return (
            <g
              key={spear.key}
              transform={`translate(${spear.x.toFixed(1)} ${(spear.y + bob).toFixed(1)}) scale(${(spear.scale * (spear.x > 960 ? -1 : 1)).toFixed(3)} ${spear.scale.toFixed(3)}) rotate(${spear.tilt.toFixed(2)})`}
              opacity={spear.opacity}
            >
              <use href={`#${id('soldier')}`} />
            </g>
          );
        })}

        {/* 压迫速度线 */}
        <g opacity={clamp01(p * 1.4 - 0.28)}>
          {Array.from({length: 26}, (_, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const y = 80 + hash(2203, index) * 940;
            const len = 120 + hash(3307, index) * 380 + p * 260;
            const x = side < 0 ? 0 : 1920;
            return (
              <line
                key={`speed-${index}`}
                x1={x}
                y1={y}
                x2={x - side * len}
                y2={y + (hash(4409, index) - 0.5) * 120}
                stroke={index % 4 === 0 ? SENBON.gold : SENBON.paperDim}
                strokeWidth={index % 4 === 0 ? 2.2 : 1}
                opacity={0.12 + hash(5501, index) * 0.28}
              />
            );
          })}
        </g>

        {/* 枪尖反光 */}
        {pulse > 0.05
          ? soldiers
              .filter((soldier) => soldier.rank >= 1)
              .slice(0, 22)
              .map((soldier) => {
                const dx = (soldier.x < 960 ? 1 : -1) * 330 * p;
                const y = soldier.y - 640 * soldier.scale;
                return (
                  <circle
                    key={`glint-${soldier.key}`}
                    cx={soldier.x + dx}
                    cy={y}
                    r={2 + soldier.spearGlow * 3}
                    fill={SENBON.goldLight}
                    opacity={pulse * 0.8}
                  />
                );
              })
          : null}
      </svg>

      {/* 底部压暗，保证主体与战幡不被枪林淹没 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(11,9,10,0) 64%, rgba(11,9,10,0.62) 88%, rgba(11,9,10,0.9) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
