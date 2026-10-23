import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CLIMAX_ASSETS} from './ClimaxAsset';
import {InkSpecks, PaperField, WASHI} from './PaperStage';
import {SERIF_STACK, SENBON, clamp01, easeOutCubic, f, overshoot} from './style';

/**
 * `<WoodblockJumpCuts />` —— Sub4B：版画怒颜四连跳切破壁。
 *
 * 彻底删掉 V4 那个"几何猫头鹰面具"。四次跳切对齐【不】【敬】【权】【威】
 * 四个重拍，每次都在两种印张之间硬切：
 *   · A 面：宣纸白底 + 木刻重彩脸（真实参考帧套色）
 *   · B 面：朱砂红底 + 反白墨线（Impact Frame 反色印张）
 * 背景的悬签被金色刀光成片切碎，四角砸下裂纹朱砂巨印。
 */

export interface SealSpec {
  id: string;
  text: string;
  landAt: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

export interface WoodblockJumpCutsProps {
  time: number;
  cuts: readonly number[];
  seals: readonly SealSpec[];
  whiteFlash: number;
  pulse?: number;
  high?: number;
}

const WORD_FOR_CUT = ['不', '敬', '权', '威'];
const SCALES = [1.02, 1.16, 1.32, 1.5];

export const WoodblockJumpCuts: React.FC<WoodblockJumpCutsProps> = ({time, cuts, seals, whiteFlash, pulse = 0, high = 0}) => {
  let index = -1;
  let age = 0;
  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    if (time >= (cuts[i] ?? Infinity)) {
      index = i;
      age = time - (cuts[i] ?? time);
      break;
    }
  }
  if (index < 0) index = 0;
  const inverted = index % 2 === 1;
  const slam = clamp01(age / 0.03);
  const drift = clamp01(age / 0.267);
  const scale = SCALES[Math.min(index, SCALES.length - 1)]! * (1 + drift * 0.05);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {inverted ? (
        <AbsoluteFill style={{backgroundColor: '#B3261E'}}>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse 70% 70% at 50% 46%, rgba(255,120,80,0.28) 0%, rgba(120,16,12,0.6) 62%, rgba(48,6,6,0.92) 100%)`,
            }}
          />
        </AbsoluteFill>
      ) : (
        <PaperField tone={WASHI.paperBright} seed={9331} vignette={0.18}>
          <InkSpecks count={64} seed={9447} time={time} color={WASHI.ink} spread={1.1} />
        </PaperField>
      )}

      {/* 真实版画怒颜：满幅盖住，别露出印张的纸边 */}
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <Img
          src={staticFile(CLIMAX_ASSETS.face.file)}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 2180 * scale,
            height: 2044 * scale,
            marginLeft: -1020 * scale,
            marginTop: -1000 * scale,
            objectFit: 'cover',
            transform: `translate(${(index % 2 === 0 ? -1 : 1) * (1 - slam) * 26}px, ${(index % 3 === 0 ? 1 : -1) * (1 - slam) * 18}px) rotate(${index % 2 === 0 ? -2 : 2}deg)`,
            filter: inverted
              ? 'grayscale(1) invert(1) contrast(1.45) brightness(1.08)'
              : `contrast(1.08) saturate(1.05) brightness(${1 + pulse * 0.05})`,
            mixBlendMode: inverted ? 'screen' : 'normal',
            opacity: inverted ? 0.94 : 1,
          }}
        />
      </AbsoluteFill>

      {/* 反色印张上的黑色网屏，压回油墨感 */}
      {inverted ? (
        <AbsoluteFill
          style={{
            background: `repeating-linear-gradient(0deg, rgba(40,4,4,0.32) 0px, rgba(40,4,4,0.32) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)`,
            mixBlendMode: 'multiply',
          }}
        />
      ) : null}

      {/* 四角的裂纹——跳切时整体外扩 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 9}, (_, branch) => {
          const corner = branch % 4;
          const ox = corner === 0 || corner === 3 ? 0 : 1920;
          const oy = corner < 2 ? 0 : 1080;
          const len = 160 + ((branch * 37) % 200) + age * 180;
          const angle = (corner * Math.PI) / 2 + Math.PI / 4 + ((branch % 3) - 1) * 0.24;
          const mx = ox + Math.cos(angle) * len * 0.55;
          const my = oy + Math.sin(angle) * len * 0.55;
          const ex = ox + Math.cos(angle) * len;
          const ey = oy + Math.sin(angle) * len;
          return (
            <polyline
              key={`crack-${branch}`}
              points={`${ox},${oy} ${f(mx)},${f(my)} ${f(ex)},${f(ey)}`}
              fill="none"
              stroke={inverted ? '#1B0708' : WASHI.ink}
              strokeWidth={2.6}
              opacity={0.55}
            />
          );
        })}
      </svg>

      {/* 跳切时的金色刀光 */}
      {age < 0.16 ? (
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <line
            x1="0"
            y1={f(300 + index * 160)}
            x2="1920"
            y2={f(220 + index * 150)}
            stroke={SENBON.goldPale}
            strokeWidth={10}
            opacity={(1 - age / 0.16) * 0.85}
          />
          <line
            x1="0"
            y1={f(300 + index * 160)}
            x2="1920"
            y2={f(220 + index * 150)}
            stroke={SENBON.cinnabar}
            strokeWidth={22}
            opacity={(1 - age / 0.16) * 0.24}
          />
        </svg>
      ) : null}

      {/* 每次跳切的巨字：与脸错位，压在左下/右上 */}
      <div
        style={{
          position: 'absolute',
          left: 92,
          right: undefined,
          bottom: 88,
          fontFamily: SERIF_STACK,
          fontSize: 210,
          lineHeight: 0.88,
          fontWeight: 900,
          color: inverted ? '#FFF4DC' : WASHI.ink,
          opacity: clamp01(age / 0.02),
          transform: `scale(${f(1.24 - easeOutCubic(clamp01(age / 0.1)) * 0.24)})`,
          transformOrigin: '0% 100%',
          textShadow: inverted ? '0 0 30px rgba(255,220,160,0.4)' : `6px 6px 0 rgba(217,48,37,0.16)`,
        }}
      >
        {WORD_FOR_CUT[index] ?? '威'}
      </div>

      {/* 四角朱砂巨印：每切一次落一枚 */}
      {seals.map((seal, sealIndex) => {
        const sealAge = time - seal.landAt;
        if (sealAge < 0 || sealIndex > index) return null;
        const drop = overshoot(clamp01(sealAge / 0.14), 9, 8);
        const factor = 2.1 - drop * 1.1;
        return (
          <div
            key={seal.id}
            style={{
              position: 'absolute',
              left: seal.x - (seal.size * factor) / 2,
              top: seal.y - (seal.size * factor) / 2,
              width: seal.size * factor,
              height: seal.size * factor,
              transform: `rotate(${seal.rotate}deg)`,
              opacity: clamp01(sealAge / 0.04) * 0.96,
              zIndex: 6,
            }}
          >
            <svg viewBox="0 0 200 200" width="100%" height="100%">
              <rect x="8" y="8" width="184" height="184" fill="none" stroke="#D93025" strokeWidth="10" />
              <rect x="22" y="22" width="156" height="156" fill="none" stroke="#D93025" strokeWidth="3" />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={SERIF_STACK}
                fontSize="128"
                fontWeight="900"
                fill="#D93025"
                opacity="0.94"
              >
                {seal.text}
              </text>
            </svg>
          </div>
        );
      })}

      {/* 290 帧白光 */}
      {time >= whiteFlash ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#FFF8E6',
            opacity: clamp01(1 - (time - whiteFlash) / 0.075),
            mixBlendMode: 'screen',
          }}
        />
      ) : null}

      {/* 金粉闪点 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen'}}>
        {Array.from({length: 34}, (_, spark) => {
          const angle = (spark / 34) * Math.PI * 2 + index;
          const radius = 220 + ((spark * 53) % 520) + high * 120;
          return (
            <circle
              key={`flash-spark-${spark}`}
              cx={f(960 + Math.cos(angle) * radius)}
              cy={f(540 + Math.sin(angle) * radius * 0.72)}
              r={f(1.4 + (spark % 4) * 1.5)}
              fill={spark % 3 === 0 ? SENBON.cinnabar : SENBON.gold}
              opacity={0.18 + (spark % 5) * 0.08}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default WoodblockJumpCuts;
