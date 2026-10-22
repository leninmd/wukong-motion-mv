import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {TAG_SLOTS, type TagSlot} from '../../sequences/senbonPlan';
import {clamp01, easeOutCubic, SENBON, SERIF_STACK} from './style';
import {WukongSilhouette} from './WukongSilhouette';

export interface VerdictTagsProps {
  time: number;
  /** 木牌被斩断的秒数。 */
  breakAt: number;
  /** 0–1，终局进度（大圣破壁）。 */
  finale: number;
  pulse?: number;
}

const CHAIN_Y: Record<0 | 1 | 2, number> = {0: 86, 1: 158, 2: 238};

const Chain: React.FC<{y: number; broken: number; idPrefix: string}> = ({y, broken, idPrefix}) => {
  const links = useMemo(() => Array.from({length: 52}, (_, index) => index), []);
  return (
    <g opacity={1 - broken * 0.85} transform={`translate(0 ${broken * 26})`}>
      {links.map((index) => {
        const x = -20 + index * 38;
        const sway = Math.sin(index * 0.55 + broken * 6) * broken * 10;
        return (
          <g key={`${idPrefix}-link-${index}`} transform={`translate(${x} ${y + sway}) rotate(${index % 2 === 0 ? 18 : -18})`}>
            <ellipse rx="15" ry="7.6" fill={SENBON.inkSoft} stroke={SENBON.goldDeep} strokeWidth="3.4" />
            <ellipse rx="10" ry="4.2" fill="none" stroke={SENBON.gold} strokeWidth="1.4" opacity="0.55" />
          </g>
        );
      })}
    </g>
  );
};

const TagBoard: React.FC<{
  slot: TagSlot;
  time: number;
  breakAt: number;
  pulse: number;
  idPrefix: string;
}> = ({slot, time, breakAt, pulse, idPrefix}) => {
  const id = (suffix: string) => `${idPrefix}-${slot.id}-${suffix}`;
  const w = slot.width;
  const h = slot.height;
  const swing = Math.sin(time * (1.5 + slot.swingAmp * 0.12) + slot.swingPhase) * slot.swingAmp;
  const flip = slot.revealAt === null ? 1 : clamp01((time - slot.revealAt) / 0.24);
  const breakAge = time - breakAt;
  const broken = clamp01(breakAge / 0.42);
  const flight = clamp01(breakAge / 0.85);
  const halfFade = 1 - clamp01((breakAge - 0.95) / 0.45);
  const scale = slot.depth === 0 ? 0.62 : slot.depth === 1 ? 0.82 : 1;
  const opacity = slot.depth === 0 ? 0.42 : slot.depth === 1 ? 0.72 : 1;
  const blur = slot.depth === 0 ? 2.2 : slot.depth === 1 ? 0.8 : 0;
  const chainY = CHAIN_Y[slot.depth];
  const stringLength = Math.max(0, slot.y - chainY);
  const fontSize = slot.depth === 2 ? (slot.text.length > 1 ? 104 : 150) : 46;

  const splinters = useMemo(
    () =>
      Array.from({length: 10}, (_, index) => ({
        dx: (hash(3311 + slot.x, index) - 0.5) * 520,
        dy: -60 - hash(4409 + slot.x, index) * 420 + broken * 260,
        rot: (hash(5501 + slot.x, index) - 0.5) * 720,
        size: 4 + hash(6607 + slot.x, index) * 16,
      })),
    [slot.x],
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: slot.x - w / 2,
        top: chainY,
        width: w,
        height: stringLength + h,
        transformOrigin: '50% 0%',
        transform: `rotate(${swing.toFixed(3)}deg)`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    >
      {/* 吊绳 / 铁环 */}
      <svg viewBox={`0 0 ${w} ${stringLength + 24}`} width={w} height={stringLength + 24} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <line x1={w / 2} y1="0" x2={w / 2} y2={stringLength + 10} stroke={SENBON.goldDeep} strokeWidth={slot.depth === 2 ? 4 : 2} />
        {slot.depth === 2 ? (
          <>
            <circle cx={w / 2} cy={stringLength} r="14" fill="none" stroke={SENBON.gold} strokeWidth="4" />
            <circle cx={w / 2} cy={10} r="10" fill="none" stroke={SENBON.gold} strokeWidth="3.4" />
          </>
        ) : null}
      </svg>

      {/* 木牌本体 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: stringLength,
          width: w,
          height: h,
          transformStyle: 'preserve-3d',
          transform: `rotateY(${flip * 180}deg) scale(${scale})`,
          transformOrigin: '50% 8%',
          opacity: broken > 0.02 ? 0 : 1,
        }}
      >
        {/* 正面：白牌黑字 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(178deg, #F6F0E1 0%, #E9DFC9 46%, #CBBB9D 100%)',
            border: `${slot.depth === 2 ? 3 : 2}px solid #2A1D16`,
            boxShadow: `0 ${10 + (1 - flip) * 20}px ${26 + (1 - flip) * 30}px rgba(0,0,0,0.55)`,
            overflow: 'hidden',
          }}
        >
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{position: 'absolute', inset: 0}}>
            <defs>
              <pattern id={id('grain')} width="12" height="12" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="12" y2="12" stroke="#8A7352" strokeWidth="0.6" opacity="0.25" />
                <line x1="12" y1="0" x2="0" y2="12" stroke="#8A7352" strokeWidth="0.4" opacity="0.12" />
              </pattern>
            </defs>
            <rect width={w} height={h} fill={`url(#${id('grain')})`} />
            <rect x="6" y="6" width={w - 12} height={h - 12} fill="none" stroke="#2A1D16" strokeWidth="2" opacity="0.5" />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
                fontFamily: SERIF_STACK,
                fontWeight: 900,
                fontSize,
                lineHeight: 1.05,
                letterSpacing: '0.04em',
                color: '#141010',
                textShadow: '0 2px 0 rgba(255,255,255,0.45)',
              }}
            >
              {slot.text}
            </span>
          </div>
          {slot.depth === 2 ? (
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                bottom: 18,
                height: 10,
                background: SENBON.cinnabar,
                opacity: 0.82 + pulse * 0.1,
              }}
            />
          ) : null}
        </div>

        {/* 背面：深木 + 朱砂押印 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(160deg, #261713 0%, #150E0D 60%, #0C090A 100%)',
            border: `2px solid ${SENBON.goldDeep}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: w * 0.42,
              height: w * 0.42,
              border: `4px solid ${SENBON.cinnabar}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SERIF_STACK,
              fontSize: w * 0.22,
              fontWeight: 900,
              color: SENBON.cinnabar,
              opacity: 0.85,
              transform: 'rotate(-8deg)',
            }}
          >
            押
          </div>
        </div>
      </div>

      {/* 断裂后的两个半片：同一块牌被斜切成上下两段，向两侧纷飞 */}
      {broken > 0.02
        ? ([-1, 1] as const).map((side) => (
            <div
              key={`half-${side}`}
              style={{
                position: 'absolute',
                left: 0,
                top: stringLength,
                width: w,
                height: h,
                clipPath:
                  side < 0
                    ? 'polygon(0 0, 100% 0, 100% 52%, 0 46%)'
                    : 'polygon(0 46%, 100% 52%, 100% 100%, 0 100%)',
                transform: `translate(${side * flight * 150}px, ${side * flight * 260}px) rotate(${side * flight * 34}deg) scale(${(1 - flight * 0.38).toFixed(3)})`,
                opacity: halfFade * 0.86,
                background: 'linear-gradient(178deg, #F6F0E1 0%, #E9DFC9 46%, #CBBB9D 100%)',
                border: `2px solid #2A1D16`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 30px rgba(0,0,0,0.55)',
              }}
            >
              <span
                style={{
                  writingMode: 'vertical-rl',
                  textOrientation: 'upright',
                  fontFamily: SERIF_STACK,
                  fontWeight: 900,
                  fontSize,
                  lineHeight: 1.05,
                  color: '#141010',
                }}
              >
                {slot.text}
              </span>
            </div>
          ))
        : null}

      {/* 断裂后的碎片 */}
      {broken > 0
        ? splinters.map((splinter, index) => (
            <div
              key={`splinter-${index}`}
              style={{
                position: 'absolute',
                left: w / 2 + splinter.dx * easeOutCubic(flight),
                top: stringLength + h * 0.5 + splinter.dy * easeOutCubic(flight),
                width: splinter.size,
                height: splinter.size * 0.32,
                background: index % 4 === 0 ? SENBON.cinnabar : '#E8DCC2',
                transform: `rotate(${splinter.rot * flight}deg)`,
                opacity: halfFade,
              }}
            />
          ))
        : null}
    </div>
  );
};

/**
 * 悬挂罪状白签阵 + 金猴破壁。
 *
 * 画面上方横贯三道铁链，远/中/近三层白色罪状木牌按正弦波摇晃；前景三块
 * 特写牌依次翻面亮出【罪名】【是】【老孙】。终局一棒斩断全部木牌，大圣
 * 剪影撑满画面。
 */
export const VerdictTags: React.FC<VerdictTagsProps> = ({time, breakAt, finale, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `vt-${rawId}-${suffix}`;
  const broken = clamp01((time - breakAt) / 0.42);
  const figure = clamp01(finale);

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      {/* 石壁底色 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 58% at 50% 64%, rgba(60,28,24,${0.4 + figure * 0.3}) 0%, rgba(20,12,13,0.9) 52%, ${SENBON.ink} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, rgba(252,201,52,0.045) 0px, rgba(252,201,52,0.045) 1px, transparent 1px, transparent 96px)`,
          opacity: 0.6,
        }}
      />

      {/* 破壁大圣 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 620,
          width: 980,
          height: 1180,
          transform: `translate(-50%, -50%) scale(${(0.62 + figure * 0.62).toFixed(3)})`,
          opacity: 0.18 + figure * 0.52,
          filter: `drop-shadow(0 0 60px rgba(252,201,52,${0.2 + figure * 0.3}))`,
        }}
      >
        <WukongSilhouette
          pose="smash"
          width={980}
          height={1180}
          wind={1.9}
          glow={0.6 + figure * 0.4}
          aura={0.55 + figure * 0.4}
          staffSwing={figure}
        />
      </div>

      {/* 铁链 + 木牌 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.9}}>
        <Chain y={CHAIN_Y[0]} broken={broken} idPrefix={id('far')} />
        <Chain y={CHAIN_Y[1]} broken={broken} idPrefix={id('mid')} />
      </svg>

      {TAG_SLOTS.map((slot) => (
        <TagBoard key={slot.id} slot={slot} time={time} breakAt={breakAt} pulse={pulse} idPrefix={`vt-${rawId}`} />
      ))}

      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: 0.95}}>
        <Chain y={CHAIN_Y[2]} broken={broken} idPrefix={id('hero')} />
      </svg>

      {/* 斩断瞬间的横扫金光 */}
      {time - breakAt >= 0 && time - breakAt < 0.38 ? (
        <div
          style={{
            position: 'absolute',
            left: -400,
            top: 520 + clamp01((time - breakAt) / 0.38) * 120,
            width: 2720,
            height: 10 + clamp01((time - breakAt) / 0.38) * 90,
            background: `linear-gradient(90deg, rgba(255,247,218,0) 0%, ${SENBON.goldLight} 26%, #FFFFFF 50%, ${SENBON.gold} 70%, rgba(255,247,218,0) 100%)`,
            transform: 'rotate(-7deg)',
            opacity: 1 - clamp01((time - breakAt) / 0.38),
            filter: `blur(${clamp01((time - breakAt) / 0.38) * 8}px)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}

      {/* 底部压暗 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(11,9,10,0) 64%, rgba(11,9,10,0.5) 86%, rgba(11,9,10,0.82) 100%)`,
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
};
