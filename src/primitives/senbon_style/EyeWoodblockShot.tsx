import React, {useMemo} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {hash} from '../../utils/math';
import {CLIMAX_ASSETS} from './ClimaxAsset';
import {SENBON, SERIF_STACK, clamp01, easeOutCubic, easeOutExpo, f, overshoot} from './style';

/**
 * `<EyeWoodblockShot />` —— V7 的 Sub2A：暗金放射场里的眼部横切。
 *
 * V6 的横条上下是整片空白宣纸，右侧只有三个散字，像一张排版练习。V7：
 *   · 背景改成暗金/墨黑放射速度线 + 飞溅墨点，视线被强行收束到横条；
 *   · 横条上下各加一条 14px 的鎏金刀锋发光带；
 *   · 【怎】【敌】【我】改为黑底金边斜切牌匾，随 75 / 82 / 89 帧重拍砸下。
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

const SpeedField: React.FC<{time: number}> = ({time}) => {
  const lines = useMemo(
    () =>
      Array.from({length: 88}, (_, index) => {
        const angle = hash(7000, index) * Math.PI * 2;
        const inner = 155 + hash(7001, index) * 180;
        const outer = 620 + hash(7002, index) * 520;
        return {
          x1: 960 + Math.cos(angle) * inner,
          y1: 512 + Math.sin(angle) * inner * 0.82,
          x2: 960 + Math.cos(angle) * outer,
          y2: 512 + Math.sin(angle) * outer * 0.82,
          width: 0.7 + hash(7003, index) * 2.2,
          tone: index % 7 === 0 ? 1 : index % 3 === 0 ? 2 : 0,
          opacity: 0.12 + hash(7004, index) * 0.3,
        };
      }),
    [],
  );
  const splats = useMemo(
    () =>
      Array.from({length: 44}, (_, index) => ({
        x: hash(7100, index) * 1920,
        y: hash(7101, index) < 0.5 ? 40 + hash(7102, index) * 250 : 760 + hash(7102, index) * 290,
        r: 1 + hash(7103, index) ** 2 * 12,
        tone: index % 6 === 0 ? 1 : index % 4 === 0 ? 2 : 0,
        opacity: 0.12 + hash(7104, index) * 0.38,
      })),
    [],
  );
  return (
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <g>
        {lines.map((line, index) => (
          <line
            key={`ray-${index}`}
            x1={f(line.x1)}
            y1={f(line.y1)}
            x2={f(line.x2)}
            y2={f(line.y2)}
            stroke={line.tone === 1 ? SENBON.cinnabar : line.tone === 2 ? '#C89A32' : '#1A0E0C'}
            strokeWidth={f(line.width)}
            opacity={line.opacity}
          />
        ))}
      </g>
      <g>
        {splats.map((splat, index) => (
          <ellipse
            key={`splat-${index}`}
            cx={f(splat.x + Math.sin(time * 1.7 + index) * 2)}
            cy={f(splat.y)}
            rx={f(splat.r * 1.4)}
            ry={f(splat.r)}
            fill={splat.tone === 1 ? SENBON.cinnabar : splat.tone === 2 ? SENBON.gold : '#120D14'}
            opacity={splat.opacity}
            transform={`rotate(${f(hash(7105, index) * 160)} ${f(splat.x)} ${f(splat.y)})`}
          />
        ))}
      </g>
      <circle cx="960" cy="512" r="560" fill="none" stroke="#F5C242" strokeWidth="1" opacity="0.12" />
      <circle cx="960" cy="512" r="420" fill="none" stroke="#C8281E" strokeWidth="1" opacity="0.14" />
    </svg>
  );
};

const WordPlacard: React.FC<{word: string; time: number; at: number; index: number}> = ({word, time, at, index}) => {
  const local = clamp01((time - at) / 0.14);
  if (local <= 0) return null;
  const scale = 1.75 - 0.75 * easeOutCubic(local);
  const angle = [-5, 3.5, -2][index] ?? 0;
  return (
    <div
      style={{
        position: 'absolute',
        right: 128 + (index % 2) * 8,
        top: 186 + index * 196,
        width: 204,
        height: 204,
        zIndex: 8,
        opacity: local,
        transform: `rotate(${f(angle)}deg) scale(${f(scale)})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(160deg, #1C1115 0%, #0B0709 100%)',
          clipPath: 'polygon(12% 0, 100% 12%, 88% 100%, 0 88%)',
          boxShadow: '0 18px 34px rgba(0,0,0,0.6)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 5,
          border: '4px solid #F5C242',
          clipPath: 'polygon(12% 0, 100% 12%, 88% 100%, 0 88%)',
          boxShadow: 'inset 0 0 0 1px #4A2A0A',
        }}
      />
      <div style={{position: 'absolute', inset: 14, border: '1px solid rgba(200,40,30,0.6)', clipPath: 'polygon(12% 0, 100% 12%, 88% 100%, 0 88%)'}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF_STACK,
          fontSize: 118,
          fontWeight: 900,
          color: SENBON.cinnabar,
          WebkitTextStroke: '2px #F5C242',
          textShadow: '0 5px 0 rgba(0,0,0,0.55)',
        }}
      >
        {word}
      </div>
      <div style={{position: 'absolute', right: 16, bottom: 14, width: 26, height: 26, backgroundColor: SENBON.cinnabar, border: '1px solid #F5C242'}} />
    </div>
  );
};

export const EyeWoodblockShot: React.FC<EyeWoodblockShotProps> = ({time, openAt, end, wordTimes, words, pulse = 0}) => {
  const open = clamp01((time - openAt) / 0.14);
  const slam = overshoot(open, 9.2, 7.6);
  const height = BAND_H * (open > 0 ? Math.max(0, slam) : 0);
  const imageScale = 1.02 + Math.max(0, time - openAt) * 0.045;
  const flicker = Math.sin(time * 44) * 0.02;
  /* 横条未开之前只允许速度场出现，字幕/说明必须等 openAt 之后才亮，
     否则 70–76 帧的裂屏转场会提前泄露 2A 的排版。 */
  const chrome = clamp01((time - openAt) * 5);

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#0B0606'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 58% at 50% 48%, #3A2110 0%, #1B0F0A 44%, #0B0606 82%)`,
        }}
      />
      <SpeedField time={time} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 56% 24% at 50% 50%, rgba(245,194,66,0.22) 0%, rgba(200,40,30,0.08) 55%, rgba(0,0,0,0) 100%)`,
          mixBlendMode: 'screen',
        }}
      />

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
          backgroundColor: '#080506',
          boxShadow: `0 0 42px rgba(245,194,66,${0.45 * open}), 0 28px 64px rgba(0,0,0,0.7)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
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
              filter: `contrast(1.1) saturate(1.08) brightness(${0.99 + flicker})`,
            }}
          />
        </div>

        {/* 横条上下粗壮的鎏金刀锋带 */}
        {[
          {top: 0, rotate: 0},
          {top: BAND_H - 14, rotate: 0},
        ].map((edge, index) => (
          <div key={`blade-${index}`} style={{position: 'absolute', left: 0, right: 0, top: edge.top, height: 14, zIndex: 4}}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #C87A18 0%, #F5C242 18%, #FFF3D1 50%, #F5C242 82%, #C87A18 100%)',
                boxShadow: '0 0 26px rgba(245,194,66,0.9), 0 0 8px rgba(255,243,209,0.9)',
              }}
            />
            <div style={{position: 'absolute', left: 0, right: 0, top: 5, height: 3, backgroundColor: '#FFF7DA', opacity: 0.95}} />
          </div>
        ))}

        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(8,5,6,0.55) 0%, rgba(8,5,6,0) 14%, rgba(8,5,6,0) 86%, rgba(8,5,6,0.55) 100%)'}} />
      </div>

      {/* 右侧三块牌匾：75 / 82 / 89 帧重拍 */}
      {words.map((word, index) => (
        <WordPlacard key={`word-${word}`} word={word} time={time} at={wordTimes[index] ?? Infinity} index={index} />
      ))}

      {/* 左上说明 */}
      <div style={{position: 'absolute', left: 96, top: 104, fontFamily: SERIF_STACK, fontSize: 22, letterSpacing: 8, color: SENBON.gold, opacity: 0.82 * chrome}}>
        火眼金睛 · 木刻套色
      </div>
      <div style={{position: 'absolute', left: 96, top: 144, fontFamily: SERIF_STACK, fontSize: 14, letterSpacing: 6, color: '#C8A45A', opacity: 0.6 * chrome}}>
        第二幕 · 怎敌我
      </div>

      {/* 底部朱砂规矩线 */}
      <div style={{position: 'absolute', left: 96, right: 96, bottom: 74, height: 3, background: 'linear-gradient(90deg, rgba(200,40,30,0), #C8281E 22%, #F5C242 50%, #C8281E 78%, rgba(200,40,30,0))', opacity: 0.7 * chrome}} />
      <div style={{position: 'absolute', right: 96, bottom: 50, fontFamily: SERIF_STACK, fontSize: 15, letterSpacing: 6, color: '#C8A45A', opacity: 0.55 * chrome}}>
        木刻套色 · 朱砂与墨
      </div>

      {/* 收尾压暗，给下一镜留呼吸 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: '#080506',
          opacity: Math.max(0, easeOutExpo((time - (end - 0.22)) / 0.22)) * 0.92,
        }}
      />
    </AbsoluteFill>
  );
};

export default EyeWoodblockShot;
