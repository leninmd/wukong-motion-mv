import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {WukongFaceCloseup} from './WukongFaceCloseup';
import {SERIF_STACK, SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Sub2A —— 《千本樱》00:32 的眼部斜切横条。
 *
 * 与 V3 的 EyeBand 不同：
 *   · 横条内不再是简笔三角眼，而是 `<WukongFaceCloseup variant="eyes" />`：
 *     京剧桃心脸谱金线、锁子甲领口、紧箍云纹、36 道赤金放射虹膜、金火粒子；
 *   · 背景是高速流动的赤金速度线，而不是纯黑；
 *   · 横条 −5°，上下双金边，端头做漫画斜切；
 *   · 右侧【怎】【敌】【我】三枚金字带黑色重影描边，依次砸落。
 */
export interface EyeCutBandProps {
  time: number;
  frame: number;
  start: number;
  openAt: number;
  end: number;
  wordTimes: readonly number[];
  words: readonly string[];
  pulse?: number;
  high?: number;
}

const BAND_HEIGHT = 280;
const TILT = -5;

export const EyeCutBand: React.FC<EyeCutBandProps> = ({
  time,
  frame,
  start,
  openAt,
  end,
  wordTimes,
  words,
  pulse = 0,
  high = 0,
}) => {
  if (time < start || time > end) return null;

  const local = clamp((time - start) / Math.max(0.001, openAt - start));
  const open = overshoot(local, 7.4, 7.2);
  const bandHeight = Math.max(4, BAND_HEIGHT * open);
  const settle = easeOutCubic(clamp((time - openAt) / 0.16));
  const intensity = clamp(0.55 + settle * 0.3 + pulse * 0.35);
  const breath = 1 + Math.sin(frame * 0.21) * 0.004 + pulse * 0.012;

  const speedLines = Array.from({length: 52}, (_, index) => {
    const angle = (index / 52) * Math.PI * 2;
    const inner = 180 + hash(3101, index) * 120;
    const outer = 1300 + hash(3102, index) * 500;
    return {
      x1: 960 + Math.cos(angle) * inner,
      y1: 540 + Math.sin(angle) * inner * 0.62,
      x2: 960 + Math.cos(angle) * outer,
      y2: 540 + Math.sin(angle) * outer * 0.62,
      color: index % 4 === 0 ? SENBON.paper : index % 3 === 0 ? SENBON.cinnabar : SENBON.gold,
      width: 0.8 + hash(3103, index) * 2.6,
    };
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#040304', overflow: 'hidden', pointerEvents: 'none'}}>
      {/* 赤金速度线 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
        {speedLines.map((line, index) => {
          const travel = ((time * (0.55 + (index % 5) * 0.16) + index * 0.03) % 1);
          const alpha = Math.sin(travel * Math.PI) * 0.5;
          return (
            <line
              key={`speed-${index}`}
              x1={f(line.x1 + Math.cos(index) * travel * 80)}
              y1={f(line.y1)}
              x2={f(line.x2 + Math.cos(index) * travel * 120)}
              y2={f(line.y2)}
              stroke={line.color}
              strokeWidth={f(line.width)}
              opacity={f(alpha * (0.5 + pulse * 0.5))}
            />
          );
        })}
        <circle cx="960" cy="540" r="420" fill={SENBON.cinnabar} opacity={0.06 + pulse * 0.04} />
      </svg>

      {/* 斜切横条 */}
      <div
        style={{
          position: 'absolute',
          left: -340,
          top: 540 - bandHeight / 2,
          width: 2600,
          height: bandHeight,
          transform: `rotate(${TILT}deg)`,
          transformOrigin: '50% 50%',
          overflow: 'hidden',
          backgroundColor: '#070405',
          borderTop: `3px solid ${SENBON.gold}`,
          borderBottom: `3px solid ${SENBON.gold}`,
          boxShadow: `0 0 ${28 + pulse * 28}px rgba(252,201,52,${0.3 + pulse * 0.22}), 0 0 120px rgba(217,48,37,0.24)`,
        }}
      >
        {/* 眼特写 */}
        <div
          style={{
            position: 'absolute',
            left: 960 - 490 * breath,
            top: -(196 * breath) + bandHeight / 2,
            width: 980 * breath,
            height: 445 * breath,
          }}
        >
          <WukongFaceCloseup
            frame={frame}
            variant="eyes"
            intensity={intensity}
            high={high}
            eyeBurst={clamp(0.42 + settle * 0.3 + pulse * 0.5)}
            gaze={Math.sin(time * 9) * 2.4}
          />
        </div>

        {/* 条内暗角 / 横向金丝 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(4,3,4,0.96) 0%, rgba(4,3,4,0.2) 22%, rgba(4,3,4,0) 48%, rgba(4,3,4,0.2) 76%, rgba(4,3,4,0.96) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(252,201,52,0.1) 0px, rgba(252,201,52,0.1) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)',
            mixBlendMode: 'screen',
            opacity: 0.55,
          }}
        />
        {/* 端头斜切金边 */}
        <div style={{position: 'absolute', left: 300, top: -40, width: 46, height: bandHeight + 80, backgroundColor: SENBON.gold, transform: 'rotate(-18deg)', opacity: 0.9}} />
        <div style={{position: 'absolute', left: 356, top: -40, width: 10, height: bandHeight + 80, backgroundColor: SENBON.cinnabar, transform: 'rotate(-18deg)', opacity: 0.9}} />
        <div style={{position: 'absolute', right: 286, top: -40, width: 46, height: bandHeight + 80, backgroundColor: SENBON.gold, transform: 'rotate(-18deg)', opacity: 0.9}} />
        <div style={{position: 'absolute', right: 342, top: -40, width: 10, height: bandHeight + 80, backgroundColor: SENBON.cinnabar, transform: 'rotate(-18deg)', opacity: 0.9}} />
      </div>

      {/* 右侧三枚金字 */}
      {words.map((word, index) => {
        const at = wordTimes[index];
        if (at === undefined || time < at) return null;
        const slam = clamp((time - at) / 0.14);
        const pop = 1 + (1 - easeOutCubic(slam)) * 1.05;
        const baseX = 1378 + index * 164;
        const baseY = 196 + index * 128;
        return (
          <div
            key={`eye-word-${index}`}
            style={{
              position: 'absolute',
              left: baseX,
              top: baseY,
              width: 210,
              height: 210,
              transform: `rotate(${TILT}deg) scale(${f(pop)})`,
              opacity: clamp(slam * 1.8),
            }}
          >
            {/* 黑色重影底 */}
            <div
              style={{
                position: 'absolute',
                left: 9,
                top: 9,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: SERIF_STACK,
                fontWeight: 900,
                fontSize: 172,
                color: '#080506',
                WebkitTextStroke: `14px #080506`,
                lineHeight: 1,
              }}
            >
              {word}
            </div>
            {/* 金字 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: SERIF_STACK,
                fontWeight: 900,
                fontSize: 172,
                lineHeight: 1,
                background: `linear-gradient(175deg, #FFF8DE 0%, ${SENBON.goldPale} 26%, ${SENBON.gold} 58%, #D9A21A 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextStroke: `2.4px ${SENBON.goldLight}`,
                filter: 'drop-shadow(0 0 16px rgba(252,201,52,0.5)) drop-shadow(0 8px 0 rgba(11,9,10,0.65))',
              }}
            >
              {word}
            </div>
            {/* 砸落冲击线 */}
            {slam < 1 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: -20,
                  border: `3px solid ${SENBON.gold}`,
                  transform: `scale(${f(1.5 - slam * 0.5)})`,
                  opacity: (1 - slam) * 0.8,
                }}
              />
            ) : null}
          </div>
        );
      })}

      {/* 开场白闪 */}
      {local < 0.4 ? (
        <AbsoluteFill
          style={{
            backgroundColor: SENBON.paper,
            opacity: (1 - local / 0.4) * 0.42,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export default EyeCutBand;
