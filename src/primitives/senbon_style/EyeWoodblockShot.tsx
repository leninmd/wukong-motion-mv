import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CLIMAX_ASSETS} from './ClimaxAsset';
import {InkSpecks, PaperField, WASHI} from './PaperStage';
import {SERIF_STACK, SENBON, clamp01, easeOutCubic, easeOutExpo, f, overshoot} from './style';

/**
 * `<EyeWoodblockShot />` —— Sub2A：宣纸白底上的眼部横切。
 *
 * 复刻《千本樱》00:32 / 00:37：整屏翻成暖白古宣纸，斜 -5° 撕开一道玄黑金边
 * 横条，横条里是**从参考片 00:17.5 真实抽帧**做成的木刻套色眼部特写——不是
 * 代码画的多边形眼睛。瞳孔方向迸出金色横向闪电，右侧在纸面上砸出
 * 【怎】【敌】【我】三字。
 */

export interface EyeWoodblockShotProps {
  time: number;
  start: number;
  openAt: number;
  end: number;
  wordTimes: readonly number[];
  words: readonly string[];
  pulse?: number;
}

const BAND_Y = 512;
const BAND_H = 356;
const ANGLE = -5;

export const EyeWoodblockShot: React.FC<EyeWoodblockShotProps> = ({
  time,
  start,
  openAt,
  end,
  wordTimes,
  words,
  pulse = 0,
}) => {
  const open = clamp01((time - openAt) / 0.16);
  const slam = overshoot(open, 9.2, 7.6);
  const height = BAND_H * (open > 0 ? Math.max(0, slam) : 0);
  const imageScale = 1.02 + Math.max(0, time - openAt) * 0.05;
  const flicker = Math.sin(time * 44) * 0.02;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <PaperField tone={WASHI.paperBright} seed={6112} vignette={0.14}>
        <InkSpecks count={74} seed={6221} time={time} color={WASHI.ink} spread={1.4} />
      </PaperField>

      {/* 斜向横条 */}
      <div
        style={{
          position: 'absolute',
          left: -140,
          top: BAND_Y - height / 2,
          width: 2200,
          height,
          transform: `rotate(${ANGLE}deg)`,
          transformOrigin: '50% 50%',
          overflow: 'hidden',
          backgroundColor: '#0A0709',
          boxShadow: `0 26px 60px rgba(30,18,12,${0.4 * open})`,
          opacity: 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            transform: `scale(${f(imageScale)})`,
            transformOrigin: '52% 46%',
          }}
        >
          <Img
            src={staticFile(CLIMAX_ASSETS.eyes.file)}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 2200,
              height: 356,
              marginLeft: -1100,
              marginTop: -178,
              filter: `contrast(1.08) saturate(1.05) brightness(${0.99 + flicker})`,
            }}
          />
        </div>

        {/* 双色调套印：朱砂 → 鎏金 → 朱砂，把偏淡的印张压成版画 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(100deg, #8E1A13 0%, #D9A15C 46%, #8E1A13 100%)',
            mixBlendMode: 'color',
            opacity: 0.14,
          }}
        />
        <div style={{position: 'absolute', inset: 0, backgroundColor: '#2A0B0A', mixBlendMode: 'multiply', opacity: 0.12}} />

        {/* 条内压边：上黑下黑的胶片齿孔感，两侧留金线 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, rgba(10,7,9,0.94) 0%, rgba(10,7,9,0) 16%, rgba(10,7,9,0) 82%, rgba(10,7,9,0.9) 100%)`,
          }}
        />
        <div style={{position: 'absolute', inset: 0, border: `3px solid ${WASHI.ochre}`}} />
        <div style={{position: 'absolute', inset: 9, border: `1px solid rgba(255,243,209,0.55)`}} />
      </div>

      {/* 瞳孔方向的金色闪电 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {open > 0
          ? Array.from({length: 7}, (_, index) => {
              const seedShift = index * 97;
              const y = BAND_Y - 60 + index * 26 + Math.sin(time * 8 + index) * 8;
              const startX = 720 + ((seedShift * 13) % 520);
              const len = 210 + (index % 3) * 130;
              const points: string[] = [];
              const steps = 6;
              for (let step = 0; step <= steps; step += 1) {
                const t = step / steps;
                const x = startX + len * t * (index % 2 === 0 ? 1 : -1);
                const dy = Math.sin(t * 9 + index * 2.1 + time * 14) * 16 * (1 - t * 0.4);
                points.push(`${step === 0 ? 'M' : 'L'} ${f(x)} ${f(y + dy)}`);
              }
              return (
                <path
                  key={`bolt-${index}`}
                  d={points.join(' ')}
                  stroke={index % 3 === 0 ? '#FFF6D8' : WASHI.ochre}
                  strokeWidth={index % 3 === 0 ? 3.4 : 1.8}
                  fill="none"
                  opacity={clamp01((time - openAt) * 4) * (0.5 + (index % 4) * 0.12)}
                  style={{mixBlendMode: 'multiply'}}
                />
              );
            })
          : null}
      </svg>

      {/* 右侧三字：纸面浓墨 + 朱印 */}
      <div style={{position: 'absolute', right: 132, top: 690, display: 'flex', flexDirection: 'column', gap: 4}}>
        {words.map((word, index) => {
          const local = clamp01((time - (wordTimes[index] ?? Infinity)) / 0.14);
          if (local <= 0) return null;
          const scale = 1.28 - easeOutCubic(local) * 0.28;
          return (
            <div
              key={`word-${word}`}
              style={{
                fontFamily: SERIF_STACK,
                fontSize: 132,
                lineHeight: 0.94,
                fontWeight: 900,
                color: WASHI.ink,
                transform: `scale(${f(scale)})`,
                transformOrigin: '0% 50%',
                opacity: clamp01(local * 2.2),
                textShadow: `2px 0 0 rgba(217,48,37,${0.55 * (1 - local)})`,
              }}
            >
              {word}
            </div>
          );
        })}
        <div
          style={{
            marginTop: 10,
            width: 46,
            height: 46,
            border: `2px solid ${WASHI.cinnabar}`,
            color: WASHI.cinnabar,
            fontFamily: SERIF_STACK,
            fontSize: 13,
            lineHeight: '20px',
            textAlign: 'center',
            opacity: clamp01((time - (wordTimes[2] ?? 0)) * 3),
          }}
        >
          怒目
        </div>
      </div>

      {/* 左上角小字：横条说明 */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 104,
          fontFamily: SERIF_STACK,
          fontSize: 22,
          letterSpacing: 8,
          color: WASHI.ink,
          opacity: 0.6 * clamp01((time - openAt) * 3),
        }}
      >
        火眼金睛 · 真帧放大
      </div>

      {/* 底部一条朱砂粗线，像版画的套色规矩线 */}
      <div style={{position: 'absolute', left: 96, right: 96, bottom: 74, height: 3, backgroundColor: WASHI.cinnabar, opacity: 0.5}} />
      <div
        style={{
          position: 'absolute',
          right: 96,
          bottom: 58,
          fontFamily: SERIF_STACK,
          fontSize: 16,
          letterSpacing: 6,
          color: WASHI.ink,
          opacity: 0.45,
        }}
      >
        木刻套色 · 朱砂与墨
      </div>

      {/* 冲击白闪（横条展开瞬间） */}
      {open > 0 && open < 1 ? (
        <AbsoluteFill style={{backgroundColor: SENBON.paper, opacity: (1 - open) * 0.5, mixBlendMode: 'screen'}} />
      ) : null}

      {/* 收尾压暗，给下一镜留呼吸 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: '#1A0E10',
          opacity: Math.max(0, easeOutExpo((time - (end - 0.22)) / 0.22)) * 0.9,
        }}
      />
    </AbsoluteFill>
  );
};

export default EyeWoodblockShot;
