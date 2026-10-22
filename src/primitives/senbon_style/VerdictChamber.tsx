import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {WukongRig} from './WukongRig';
import {SERIF_STACK, SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 4：黑暗悬签 → 四连跳切破壁 → 黑屏留白。
 *
 * 上方横贯三道立体铁索，悬挂远近三层随风摆动的惨白罪状木牌；一束摇晃的
 * 聚光灯扫过前景三块木牌，依次亮出【罪名】【是】【老孙】。
 *
 * 随后在 256 / 264 / 272 / 280 四个重音上做 1.0 → 1.4 → 1.9 → 2.6 的跳切
 * 放大，直逼 `<WukongRig pose="snarl_closeup" />` 的火眼金睛；每跳切一次，
 * 对应象限的木牌崩碎成金火，并盖下一枚带裂纹的朱砂印章。
 */

export interface VerdictTag {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  swingPhase: number;
  swingAmp: number;
  depth: 0 | 1 | 2;
  revealAt: number | null;
  shatterAt: number | null;
}

export interface VerdictSeal {
  id: string;
  text: string;
  landAt: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

export interface VerdictChamberProps {
  time: number;
  frame: number;
  tags: readonly VerdictTag[];
  seals: readonly VerdictSeal[];
  jumpCuts: readonly number[];
  jumpScales: readonly number[];
  chamberAt: number;
  whiteFlashAt: number;
  blackoutAt: number;
  pulse?: number;
  high?: number;
}

const EYE = {x: 960, y: 520};

export const VerdictChamber: React.FC<VerdictChamberProps> = ({
  time,
  frame,
  tags,
  seals,
  jumpCuts,
  jumpScales,
  chamberAt,
  whiteFlashAt,
  blackoutAt,
  pulse = 0,
  high = 0,
}) => {
  const {width, height} = useVideoConfig();

  if (time >= blackoutAt) {
    return <AbsoluteFill style={{backgroundColor: '#000000'}} />;
  }

  /* 四连跳切：取当前所处的档位，档内用 3 帧弹出到位 */
  let scale = 1;
  let cutIndex = -1;
  for (let index = jumpCuts.length - 1; index >= 0; index -= 1) {
    if (time >= jumpCuts[index]!) {
      cutIndex = index;
      const from = index === 0 ? 1 : (jumpScales[index - 1] ?? 1);
      const to = jumpScales[index] ?? 1;
      const local = clamp((time - jumpCuts[index]!) / 0.1);
      scale = from + (to - from) * easeOutCubic(local);
      break;
    }
  }

  const flashAge = time - whiteFlashAt;
  const whiteFlash = flashAge >= 0 ? clamp(1 - flashAge / 0.1) : 0;
  const enter = clamp((time - chamberAt) / 0.3);

  const spotlightX = 300 + ((time * 520) % 1500);
  const spotlightY = 380 + Math.sin(time * 1.6) * 90;

  return (
    <AbsoluteFill style={{backgroundColor: '#000000', overflow: 'hidden', opacity: enter}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${f(scale)})`,
          transformOrigin: `${EYE.x}px ${EYE.y}px`,
        }}
      >
        {/* 底层的火眼金睛：跳切放大时它最先占满画面 */}
        <div
          style={{
            position: 'absolute',
            left: EYE.x - 430,
            top: 82,
            width: 860,
            height: 1170,
            opacity: 0.3 + clamp((scale - 1) / 1.6) * 0.7,
          }}
        >
          <WukongRig
            pose="snarl_closeup"
            frame={frame}
            glow={1.1}
            high={high}
            eyeBurst={clamp((scale - 1) / 1.2) * 0.9 + pulse * 0.2}
            wind={1.1}
          />
        </div>

        {/* 三道铁索 */}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
          {[72, 132, 196].map((y, index) => (
            <g key={`chain-row-${index}`}>
              <path
                d={`M -60 ${y} Q 960 ${y + 78 + index * 22} 1980 ${y}`}
                fill="none"
                stroke={SENBON.inkLift}
                strokeWidth={16 - index * 3}
                opacity={0.95}
              />
              <path
                d={`M -60 ${y} Q 960 ${y + 78 + index * 22} 1980 ${y}`}
                fill="none"
                stroke={SENBON.silverDim}
                strokeWidth={3 - index * 0.5}
                strokeDasharray="14 12"
                opacity={0.55}
              />
            </g>
          ))}
        </svg>

        {/* 罪状木牌：三层景深 */}
        {tags.map((tag) => {
          const hang = tag.y;
          const swing = Math.sin(time * (1.1 + tag.depth * 0.25) + tag.swingPhase) * tag.swingAmp;
          const reveal = tag.revealAt === null ? 1 : clamp((time - tag.revealAt) / 0.24);
          const shatterAge = tag.shatterAt === null ? -1 : time - tag.shatterAt;
          const blur = tag.depth === 0 ? 3.4 : tag.depth === 1 ? 1.2 : 0;

          if (shatterAge >= 0) {
            if (shatterAge > 0.8) return null;
            const spread = easeOutCubic(clamp(shatterAge / 0.8));
            return (
              <g key={tag.id}>
                {Array.from({length: 4}, (_, index) => {
                  const seed = tag.x + index * 17;
                  const dirX = (hash(9201, seed) - 0.5) * 620 * spread;
                  const dirY = (hash(9202, seed) - 0.4) * 520 * spread + 260 * spread * spread;
                  return (
                    <div
                      key={`frag-${index}`}
                      style={{
                        position: 'absolute',
                        left: tag.x - tag.width / 2 + dirX,
                        top: hang - tag.height / 2 + dirY,
                        width: tag.width * 0.52,
                        height: tag.height * 0.5,
                        backgroundColor: SENBON.paperDim,
                        opacity: (1 - spread) * 0.85,
                        transform: `rotate(${f(swing + spread * (index % 2 === 0 ? 140 : -140))}deg)`,
                        clipPath:
                          index % 2 === 0
                            ? 'polygon(0 0, 100% 6%, 84% 100%, 0 88%)'
                            : 'polygon(8% 0, 100% 0, 100% 92%, 0 100%)',
                      }}
                    />
                  );
                })}
                {/* 金火 */}
                {Array.from({length: 12}, (_, index) => {
                  const angle = hash(9301, tag.x + index) * Math.PI * 2;
                  const speed = 260 + hash(9302, tag.x + index) * 520;
                  return (
                    <div
                      key={`fire-${index}`}
                      style={{
                        position: 'absolute',
                        left: tag.x + Math.cos(angle) * speed * spread,
                        top: hang + Math.sin(angle) * speed * 0.5 * spread + 320 * spread * spread,
                        width: 7,
                        height: 7,
                        backgroundColor: index % 3 === 0 ? SENBON.cinnabar : SENBON.gold,
                        opacity: (1 - spread) * 0.95,
                        boxShadow: `0 0 12px ${SENBON.gold}`,
                      }}
                    />
                  );
                })}
              </g>
            );
          }

          return (
            <div
              key={tag.id}
              style={{
                position: 'absolute',
                left: tag.x - tag.width / 2,
                top: hang,
                width: tag.width,
                height: tag.height,
                transformOrigin: '50% 0%',
                transform: `rotate(${f(swing)}deg)`,
                filter: blur > 0 ? `blur(${blur}px)` : undefined,
                opacity:
                  (tag.depth === 0 ? 0.42 : tag.depth === 1 ? 0.72 : 1) *
                  (0.35 + reveal * 0.65) *
                  /* 跳切放大时木牌退成背景，避免在特写上糊满整屏 */
                  clamp(1.5 - scale * 0.55),
              }}
            >
              {/* 吊绳 */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -hang + 40,
                  width: 3,
                  height: hang - 40,
                  backgroundColor: 'rgba(207,200,186,0.4)',
                  transform: 'translateX(-50%)',
                }}
              />
              {/* 木牌 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: SENBON.paperDim,
                  border: `2px solid ${SENBON.paperShade}`,
                  boxShadow: `0 10px 30px rgba(0,0,0,0.7), inset 0 0 24px rgba(120,104,78,0.4)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SERIF_STACK,
                  fontWeight: 700,
                  fontSize: Math.min(tag.width * 0.68, tag.height * 0.24),
                  color: '#141011',
                  writingMode: 'vertical-rl',
                  letterSpacing: '0.05em',
                  lineHeight: 1.05,
                }}
              >
                {tag.text}
              </div>
              {/* 高亮：聚光灯扫过时 */}
              {tag.depth === 2 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at ${f(
                      spotlightX - (tag.x - tag.width / 2),
                    )}px ${f(spotlightY - hang)}px, rgba(255,247,218,${0.34 * reveal}) 0%, rgba(255,247,218,0) 62%)`,
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {/* 摇晃的聚光灯柱：只在跳切之前存在，放大后必须让位给火眼金睛 */}
        {cutIndex < 0 ? (
          <div
            style={{
              position: 'absolute',
              left: spotlightX - 420,
              top: -180,
              width: 840,
              height: 1400,
              background: `linear-gradient(100deg, rgba(255,247,218,0) 32%, rgba(255,247,218,0.07) 48%, rgba(255,247,218,0.11) 52%, rgba(255,247,218,0) 68%)`,
              transform: 'rotate(6deg)',
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 跳切后压一层暗幕：让火眼金睛与印章从杂乱背景里跳出来 */}
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 62% 56% at 50% 52%, rgba(0,0,0,0) 26%, rgba(0,0,0,${0.35 + clamp((scale - 1) / 1.6) * 0.45}) 100%)`,
          }}
        />
      </div>
      {seals.map((seal) => {
        const age = time - seal.landAt;
        if (age < 0) return null;
        const slam = overshoot(clamp(age / 0.16), 8.6, 8.4);
        return (
          <div
            key={seal.id}
            style={{
              position: 'absolute',
              left: seal.x - seal.size / 2,
              top: seal.y - seal.size / 2,
              width: seal.size,
              height: seal.size,
              transform: `rotate(${f(seal.rotate)}deg) scale(${f(1.7 - slam * 0.7)})`,
              opacity: clamp(age / 0.07) * 0.88,
            }}
          >
            <svg width="100%" height="100%" viewBox="0 0 200 200" style={{position: 'absolute', inset: 0}}>
              <rect x="4" y="4" width="192" height="192" fill={SENBON.cinnabar} opacity="0.9" />
              <rect x="14" y="14" width="172" height="172" fill="none" stroke={SENBON.paper} strokeWidth="3" opacity="0.5" />
              {/* 刀劈裂纹：从印心劈到边缘 */}
              {[0, 1, 2, 3].map((index) => (
                <polyline
                  key={`crack-${index}`}
                  points={crackPoints(index)}
                  fill="none"
                  stroke="#2A0A08"
                  strokeWidth={6 - index * 0.8}
                  opacity={0.72}
                />
              ))}
              {/* 印泥飞白 */}
              {Array.from({length: 14}, (_, index) => (
                <rect
                  key={`grain-${index}`}
                  x={10 + hash(7103, index) * 180}
                  y={10 + hash(7104, index) * 180}
                  width={3 + hash(7105, index) * 9}
                  height={2 + hash(7106, index) * 5}
                  fill="#2A0A08"
                  opacity={0.22}
                />
              ))}
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: SERIF_STACK,
                fontWeight: 900,
                fontSize: seal.size * 0.52,
                color: SENBON.paper,
                textShadow: `0 0 30px rgba(11,9,10,0.9), 0 0 6px rgba(11,9,10,0.8)`,
              }}
            >
              {seal.text}
            </div>
          </div>
        );
      })}

      {/* 白闪 → 硬切黑 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: SENBON.paper,
          opacity: whiteFlash * 0.94,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

const crackPoints = (index: number): string => {
  const seeds = [
    '30,20 62,86 44,128 96,182',
    '170,34 128,74 156,118 120,160',
    '20,150 78,140 112,178',
    '182,96 132,112 156,166',
  ];
  return seeds[index % seeds.length]!;
};

export default VerdictChamber;
