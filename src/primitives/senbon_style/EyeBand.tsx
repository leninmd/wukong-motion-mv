import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp} from '../../utils/math';
import {WukongRig} from './WukongRig';
import {SERIF_STACK, SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 2 前段：复刻《千本樱》00:32 的眼部横条特写。
 *
 * 画面瞬间切黑，中央斜向（-6°）撑开一道 260px 高、金边包口的分格横条，
 * 里面是 `<WukongRig pose="snarl_closeup" />` 的火眼金睛极近特写；瞳孔迸发
 * 赤金十字星芒与横向拉丝，右侧三个竖排金字【怎】【敌】【我】随重拍砸入。
 */

export interface EyeBandProps {
  time: number;
  start: number;
  openAt: number;
  end: number;
  /** 三个字的落点（秒）。 */
  wordTimes: readonly number[];
  words: readonly string[];
  /** 0–1 重音脉冲。 */
  pulse?: number;
  frame: number;
  high?: number;
}

const BAND_HEIGHT = 276;
const BAND_TILT = -6;
/** 特写里眼部（viewBox y 356–482）在横条内的高度占比。 */
const RIG_SCALE = 1.3;
const EYE_CENTER_Y = 419;

export const EyeBand: React.FC<EyeBandProps> = ({
  time,
  start,
  openAt,
  end,
  wordTimes,
  words,
  pulse = 0,
  frame,
  high = 0,
}) => {
  const local = clamp((time - start) / Math.max(0.001, openAt - start));
  if (time < start || time > end) return null;

  const open = overshoot(local, 7.4, 7.2);
  const bandHeight = Math.max(3, BAND_HEIGHT * open);
  const settle = easeOutCubic(clamp((time - openAt) / 0.16));
  const breath = 1 + Math.sin(time * 9) * 0.004 + pulse * 0.01;

  const rigWidth = 820 * RIG_SCALE * breath;
  const rigHeight = 1120 * RIG_SCALE * breath;
  const rigTop = bandHeight / 2 - EYE_CENTER_Y * RIG_SCALE * breath;
  const eyeBurst = clamp(settle * (0.55 + pulse * 0.9));

  return (
    <AbsoluteFill style={{backgroundColor: '#000000', pointerEvents: 'none', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: -260,
          top: 470 - bandHeight / 2,
          width: 2440,
          height: bandHeight,
          transform: `rotate(${BAND_TILT}deg)`,
          transformOrigin: '50% 50%',
          overflow: 'hidden',
          backgroundColor: SENBON.ink,
          boxShadow: `0 0 ${28 + pulse * 26}px rgba(252,201,52,${0.34 + pulse * 0.2}), 0 0 90px rgba(217,48,37,0.22)`,
          borderTop: `3px solid ${SENBON.gold}`,
          borderBottom: `3px solid ${SENBON.gold}`,
        }}
      >
        {/* 目镜内容 */}
        <div
          style={{
            position: 'absolute',
            left: 980 - rigWidth / 2,
            top: rigTop,
            width: rigWidth,
            height: rigHeight,
          }}
        >
          <WukongRig
            pose="snarl_closeup"
            frame={frame}
            glow={1.1}
            high={high}
            eyeBurst={eyeBurst}
            wind={0.7}
          />
        </div>

        {/* 横条内侧的暗角与扫描线，把注意力压到瞳孔 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(11,9,10,0.92) 0%, rgba(11,9,10,0.1) 26%, rgba(11,9,10,0) 50%, rgba(11,9,10,0.1) 74%, rgba(11,9,10,0.92) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(180deg, rgba(252,201,52,0.09) 0px, rgba(252,201,52,0.09) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)',
            mixBlendMode: 'screen',
            opacity: 0.5,
          }}
        />
      </div>

      {/* 右侧三枚竖排金字 */}
      {words.map((word, index) => {
        const at = wordTimes[index];
        if (at === undefined || time < at) return null;
        const slam = clamp((time - at) / 0.15);
        const pop = 1 + (1 - easeOutCubic(slam)) * 0.85;
        return (
          <div
            key={`eye-word-${index}`}
            style={{
              position: 'absolute',
              left: 1500 + index * 124,
              top: 264 + index * 128,
              width: 136,
              height: 136,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SERIF_STACK,
              fontWeight: 900,
              fontSize: 120,
              color: SENBON.gold,
              textShadow: `0 0 26px ${SENBON.gold}, 0 0 8px ${SENBON.goldLight}, 0 0 3px ${SENBON.paper}, 0 6px 0 rgba(0,0,0,0.85)`,
              transform: `rotate(${BAND_TILT}deg) scale(${f(pop)})`,
              opacity: clamp(slam * 1.6),
            }}
          >
            {word}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default EyeBand;
