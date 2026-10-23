import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {SERIF_STACK, SENBON, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 2B 右上角的描金书法【无坚不摧】。
 *
 * 硬约束：第 115 帧被 9° 刀光切开后，四个字仍要 100% 可读。做法与 V3 相同：
 *   · 整串四字是**一个**文本节点，绝不拆字；
 *   · 上下两半各自用全屏半平面 clip，只错位 12px、法向拉开 6px；
 *   · 刀光线穿过文本框中心（不是画框中心），保证四字都被切到。
 */
export interface UnbreakableBannerProps {
  text: string;
  time: number;
  revealAt: number;
  cutAt: number;
  pulse?: number;
}

const W = 1920;
const H = 1080;
const ANGLE = 9;
const ANCHOR: [number, number] = [1455, 248];
const TEXT_LEFT = 1040;
const TEXT_TOP = 106;
const TEXT_WIDTH = 820;
const TEXT_HEIGHT = 300;
const FONT = 176;
const CUT_SHIFT = 12;
const CUT_GAP = 6;

const RAD = (ANGLE * Math.PI) / 180;
const LEFT_Y = ANCHOR[1] - ANCHOR[0] * Math.tan(RAD);
const RIGHT_Y = ANCHOR[1] + (W - ANCHOR[0]) * Math.tan(RAD);
const UPPER_CLIP = `polygon(0px ${f(LEFT_Y)}px, ${W}px ${f(RIGHT_Y)}px, ${W}px 0px, 0px 0px)`;
const LOWER_CLIP = `polygon(0px ${f(LEFT_Y)}px, ${W}px ${f(RIGHT_Y)}px, ${W}px ${H}px, 0px ${H}px)`;

const DIR = {x: Math.cos(RAD), y: Math.sin(RAD)};
const PERP = {x: -Math.sin(RAD), y: Math.cos(RAD)};

const TextBlock: React.FC<{text: string}> = ({text}) => (
  <>
    {/* 黑色重影底：把字从亮背景里拔出来 */}
    <div
      style={{
        position: 'absolute',
        left: TEXT_LEFT,
        top: TEXT_TOP,
        width: TEXT_WIDTH,
        height: TEXT_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SERIF_STACK,
        fontWeight: 900,
        fontSize: FONT,
        letterSpacing: '0.045em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: SENBON.ink,
        WebkitTextStroke: `13px ${SENBON.ink}`,
      }}
    >
      {text}
    </div>
    {/* 描金主字 */}
    <div
      style={{
        position: 'absolute',
        left: TEXT_LEFT,
        top: TEXT_TOP,
        width: TEXT_WIDTH,
        height: TEXT_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SERIF_STACK,
        fontWeight: 900,
        fontSize: FONT,
        letterSpacing: '0.045em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        background: `linear-gradient(178deg, #FFF8DE 0%, ${SENBON.goldPale} 22%, ${SENBON.gold} 54%, #D9A21A 82%, ${SENBON.goldDeep} 100%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextStroke: `2.6px ${SENBON.goldLight}`,
        filter: 'drop-shadow(0 0 18px rgba(252,201,52,0.45)) drop-shadow(0 6px 0 rgba(11,9,10,0.55))',
      }}
    >
      {text}
    </div>
  </>
);

export const UnbreakableBanner: React.FC<UnbreakableBannerProps> = ({text, time, revealAt, cutAt, pulse = 0}) => {
  if (time < revealAt - 0.001) return null;
  const appear = clamp((time - revealAt) / 0.18);
  const cut = clamp((time - cutAt) / 0.12);
  const cutEase = easeOutCubic(cut);
  const flash = cut > 0 && cut < 1 ? 1 - cut : 0;
  const pop = 1 + (1 - overshoot(appear, 7, 7)) * 0.34;

  const upper = {
    x: -DIR.x * (CUT_SHIFT / 2) * cutEase - PERP.x * (CUT_GAP / 2) * cutEase,
    y: -DIR.y * (CUT_SHIFT / 2) * cutEase - PERP.y * (CUT_GAP / 2) * cutEase,
  };
  const lower = {
    x: DIR.x * (CUT_SHIFT / 2) * cutEase + PERP.x * (CUT_GAP / 2) * cutEase,
    y: DIR.y * (CUT_SHIFT / 2) * cutEase + PERP.y * (CUT_GAP / 2) * cutEase,
  };

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${f(pop)})`, transformOrigin: `${ANCHOR[0]}px ${ANCHOR[1]}px`, opacity: clamp(appear * 2.2)}}>
        {cut <= 0 ? (
          <TextBlock text={text} />
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: UPPER_CLIP,
                transform: `translate3d(${f(upper.x)}px, ${f(upper.y)}px, 0)`,
              }}
            >
              <TextBlock text={text} />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: LOWER_CLIP,
                transform: `translate3d(${f(lower.x)}px, ${f(lower.y)}px, 0)`,
              }}
            >
              <TextBlock text={text} />
            </div>
          </>
        )}
      </div>

      {/* 刀光线 + 火星：刀光只在切开后 0.08 s 内存在，随后让位给 12px 错位字 */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: 'absolute',
          inset: 0,
          mixBlendMode: 'screen',
          opacity: clamp(cut * 2.4) * clamp(1 - Math.max(0, time - cutAt) / 0.08),
        }}
      >
        <defs>
          <linearGradient id="banner-cut" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="22%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
            <stop offset="48%" stopColor={SENBON.paper} stopOpacity="1" />
            <stop offset="76%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
            <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={f(LEFT_Y)} x2={W} y2={f(RIGHT_Y)} stroke="url(#banner-cut)" strokeWidth={3 + flash * 5} opacity={0.7 + flash * 0.3} />
        <line x1="0" y1={f(LEFT_Y)} x2={W} y2={f(RIGHT_Y)} stroke={SENBON.gold} strokeWidth={18} opacity={0.12 + flash * 0.3} style={{filter: 'blur(10px)'}} />
        {cutEase > 0.12
          ? Array.from({length: 22}, (_, index) => {
              const t = (index + 0.5) / 22;
              const x = t * W;
              const y = LEFT_Y + (RIGHT_Y - LEFT_Y) * t;
              const drift = easeOutCubic(cut) * (14 + hash(6101, index) * 70);
              return (
                <polygon
                  key={`banner-spark-${index}`}
                  points={`${f(x)},${f(y)} ${f(x + drift * 0.9)},${f(y - drift * 0.9)} ${f(x + drift * 0.2)},${f(y + drift * 0.5)}`}
                  fill={index % 3 === 0 ? SENBON.cinnabar : SENBON.goldLight}
                  opacity={(1 - clamp(cut)) * 0.85}
                />
              );
            })
          : null}
      </svg>

      {/* 右下角朱文小印：与刀口形成材质对比 */}
      {cut > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: 1680,
            top: 388,
            width: 62,
            height: 62,
            backgroundColor: SENBON.cinnabar,
            border: `2px solid ${SENBON.cinnabarDeep}`,
            transform: `rotate(-5deg) scale(${f(0.9 + (1 - cut) * 0.3)})`,
            opacity: clamp((cut - 0.4) * 2.5),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SERIF_STACK,
            fontWeight: 900,
            fontSize: 26,
            color: SENBON.paper,
            boxShadow: '0 0 18px rgba(217,48,37,0.4)',
          }}
        >
          破
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export default UnbreakableBanner;
