import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {BANNERS, type BannerSlot} from '../../sequences/senbonPlan';
import {clamp01, easeOutCubic, overshoot, SENBON, SERIF_STACK} from './style';

export interface WarBannersProps {
  time: number;
  /** 0–1，重音脉冲。 */
  pulse?: number;
  /** 是否在落地后继续轻轻摇晃。 */
  sway?: boolean;
}

interface BannerProps {
  slot: BannerSlot;
  time: number;
  index: number;
  pulse: number;
  sway: boolean;
  idPrefix: string;
}

const Banner: React.FC<BannerProps> = ({slot, time, index, pulse, sway, idPrefix}) => {
  const id = (suffix: string) => `${idPrefix}-${slot.id}-${suffix}`;
  const local = time - slot.dropAt;

  const fallDuration = 0.46;
  const k = clamp01(local / fallDuration);
  const fall = overshoot(k, 5, 2.2);
  const landed = clamp01((local - fallDuration) / 0.18);
  const targetTop = 118;
  const top = -900 + (900 + targetTop) * fall;
  const swing = sway ? Math.sin(time * 2.35 + index * 1.3) * 1.5 * landed : 0;
  const clothW = slot.width;
  const clothH = slot.height;

  const tassels = useMemo(
    () =>
      Array.from({length: 5}, (_, tassel) => ({
        x: 26 + tassel * ((clothW - 52) / 4),
        len: 40 + hash(6611 + index, tassel) * 44,
      })),
    [clothW, index],
  );

  const clothPath = useMemo(() => {
    const w = clothW;
    const h = clothH;
    return `M 18 26 L ${w - 18} 26 L ${w - 10} ${h - 54} L ${w * 0.82} ${h - 38} L ${w * 0.68} ${h - 58} L ${w * 0.52} ${h - 40} L ${w * 0.36} ${h - 60} L ${w * 0.2} ${h - 40} L 10 ${h - 56} Z`;
  }, [clothH, clothW]);

  if (local < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: slot.x - clothW / 2,
        top: 0,
        width: clothW,
        height: clothH,
        transform: `translateY(${top.toFixed(2)}px) rotate(${(slot.rotate + swing).toFixed(3)}deg)`,
        transformOrigin: '50% 0%',
        willChange: 'transform',
        filter: `drop-shadow(0 ${18 + (1 - landed) * 28}px ${28 + (1 - landed) * 40}px rgba(0,0,0,0.72))`,
      }}
    >
      {/* 下落残影 */}
      {landed < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateY(-${(1 - landed) * 90}px)`,
            opacity: 0.28 * (1 - landed),
            filter: 'blur(7px)',
          }}
        >
          <div style={{position: 'absolute', inset: 0, background: SENBON.ink, border: `8px solid ${SENBON.cinnabarDeep}`}} />
        </div>
      ) : null}

      <svg viewBox={`0 0 ${clothW} ${clothH + 26}`} width={clothW} height={clothH + 26} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={id('cloth')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151011" />
            <stop offset="55%" stopColor="#0D0A0B" />
            <stop offset="100%" stopColor="#080607" />
          </linearGradient>
          <linearGradient id={id('rod')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.goldShadow} />
            <stop offset="26%" stopColor={SENBON.gold} />
            <stop offset="56%" stopColor={SENBON.goldLight} />
            <stop offset="100%" stopColor={SENBON.goldDeep} />
          </linearGradient>
          <linearGradient id={id('textSheen')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={SENBON.goldLight} />
            <stop offset="48%" stopColor={SENBON.gold} />
            <stop offset="100%" stopColor="#FFDE7A" />
          </linearGradient>
          <pattern id={id('dots')} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="2" cy="2" r="1.1" fill={SENBON.gold} opacity="0.16" />
          </pattern>
        </defs>

        {/* 挂杆 */}
        <rect x="-14" y="2" width={clothW + 28} height="18" rx="8" fill={`url(#${id('rod')})`} stroke={SENBON.goldShadow} strokeWidth="1.6" />
        <circle cx="-12" cy="11" r="13" fill={SENBON.goldDeep} stroke={SENBON.goldLight} strokeWidth="2.4" />
        <circle cx={clothW + 12} cy="11" r="13" fill={SENBON.goldDeep} stroke={SENBON.goldLight} strokeWidth="2.4" />
        <path d={`M -12 11 L -4 4 M ${clothW + 12} 11 L ${clothW + 4} 4`} stroke={SENBON.goldPale} strokeWidth="2" opacity="0.8" />

        {/* 布面 */}
        <path d={clothPath} fill={`url(#${id('cloth')})`} stroke={SENBON.cinnabar} strokeWidth="9" strokeLinejoin="round" />
        <path d={clothPath} fill={`url(#${id('dots')})`} />
        <path d={clothPath} fill="none" stroke={SENBON.gold} strokeWidth="2.4" opacity="0.55" transform="translate(0, 0)" />
        <path
          d={`M 26 40 L ${clothW - 26} 40 L ${clothW - 20} ${clothH - 66} L ${clothW * 0.5} ${clothH - 44} L 20 ${clothH - 66} Z`}
          fill="none"
          stroke={SENBON.gold}
          strokeWidth="1.4"
          opacity="0.4"
        />

        {/* 布面受光斜条 */}
        <path
          d={`M 20 30 L ${clothW * 0.42} 30 L ${clothW * 0.24} ${clothH - 60} L 12 ${clothH - 60} Z`}
          fill={SENBON.paper}
          opacity={0.03 + pulse * 0.04}
        />

        {/* 底部流苏 */}
        {tassels.map((tassel, tasselIndex) => (
          <g key={`tassel-${tasselIndex}`}>
            <line
              x1={tassel.x}
              y1={clothH - 44}
              x2={tassel.x + swing * 2}
              y2={clothH - 44 + tassel.len}
              stroke={SENBON.goldDeep}
              strokeWidth="2.2"
            />
            <circle cx={tassel.x + swing * 2} cy={clothH - 44 + tassel.len} r="4.2" fill={SENBON.cinnabar} />
          </g>
        ))}

        {/* 顶角金饰 */}
        {[0, 1].map((side) => (
          <path
            key={`corner-${side}`}
            d={
              side === 0
                ? `M 18 26 L 66 26 L 18 74 Z`
                : `M ${clothW - 18} 26 L ${clothW - 66} 26 L ${clothW - 18} 74 Z`
            }
            fill={SENBON.gold}
            opacity="0.5"
          />
        ))}
      </svg>

      {/* 竖排巨字 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 44,
          width: clothW,
          height: clothH - 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: SERIF_STACK,
            fontWeight: 900,
            fontSize: slot.fontSize,
            lineHeight: 1.03,
            letterSpacing: slot.text.length > 2 ? '0.06em' : '0.1em',
            whiteSpace: 'nowrap',
            color: 'transparent',
            backgroundImage: `linear-gradient(160deg, ${SENBON.goldPale} 0%, ${SENBON.gold} 42%, ${SENBON.goldLight} 58%, ${SENBON.goldDeep} 100%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            filter: `drop-shadow(0 2px 0 ${SENBON.ink}) drop-shadow(0 0 ${10 + pulse * 14}px rgba(252,201,52,0.5))`,
            transform: `scale(${(0.94 + landed * 0.06).toFixed(3)})`,
          }}
        >
          {slot.text}
        </span>
      </div>

      {/* 落地金尘 */}
      {landed > 0 && landed < 1 ? (
        <div style={{position: 'absolute', left: -40, right: -40, bottom: -10, height: 40, opacity: (1 - landed) * 0.8}}>
          {Array.from({length: 9}, (_, dustIndex) => (
            <span
              key={`dust-${dustIndex}`}
              style={{
                position: 'absolute',
                left: `${(dustIndex / 8) * 100}%`,
                top: `${hash(7717 + index, dustIndex) * 22}px`,
                width: 3 + hash(8811, dustIndex) * 6,
                height: 3 + hash(9901, dustIndex) * 6,
                borderRadius: '50%',
                background: dustIndex % 3 === 0 ? SENBON.gold : SENBON.paperDim,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * 四分屏战幡。四道黑底红边金字竖幅从屏幕顶部按弹簧物理依次砸落，
 * 与《千本樱》的四分屏卡点同构。
 */
export const WarBanners: React.FC<WarBannersProps> = ({time, pulse = 0, sway = true}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}} aria-hidden="true">
      {BANNERS.map((slot, index) => (
        <Banner
          key={slot.id}
          slot={slot}
          time={time}
          index={index}
          pulse={pulse}
          sway={sway}
          idPrefix={rawId}
        />
      ))}
      {/* 顶部落幡时的一道横扫金光 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 24,
          height: 2,
          background: `linear-gradient(90deg, rgba(252,201,52,0) 0%, ${SENBON.gold} 32%, ${SENBON.goldLight} 50%, ${SENBON.gold} 68%, rgba(252,201,52,0) 100%)`,
          opacity: 0.3 + pulse * 0.5,
          transform: `scaleX(${0.6 + easeOutCubic(clamp01(time / 2.5)) * 0.4})`,
        }}
      />
    </AbsoluteFill>
  );
};
