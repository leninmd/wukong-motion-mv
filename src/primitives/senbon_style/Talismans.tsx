import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {TALISMANS, type TalismanSlot} from '../../sequences/senbonPlan';
import {clamp01, easeOutBack, easeOutCubic, SENBON, SERIF_STACK} from './style';

export interface TalismansProps {
  time: number;
  /** 0–1 重音脉冲。 */
  pulse?: number;
}

const Talisman: React.FC<{slot: TalismanSlot; time: number; index: number}> = ({slot, time, index}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `tal-${rawId}-${slot.id}-${suffix}`;
  const flightStart = slot.arriveAt - 0.4;
  const k = clamp01((time - flightStart) / 0.4);

  const landed = clamp01((time - slot.arriveAt) / 0.16);
  const wobble = landed > 0 ? Math.sin(time * 3.1 + index * 1.4) * 0.8 * landed : 0;
  const x = slot.fromX + (slot.x - slot.fromX) * easeOutCubic(k);
  const y = slot.fromY + (slot.y - slot.fromY) * easeOutCubic(k);
  const rotate = slot.fromRotate + (slot.rotate - slot.fromRotate) * easeOutBack(k, 1.4) + wobble;
  const scale = 1.35 - 0.35 * easeOutCubic(k) + (landed > 0 ? Math.sin(landed * Math.PI) * 0.05 : 0);
  const textReveal = clamp01((time - slot.arriveAt - 0.03) / 0.1);
  const w = slot.width;
  const h = slot.height;

  const paperPath = useMemo(() => {
    const ragged = Array.from({length: 9}, (_, step) => {
      const px = (step / 8) * w;
      const py = h + (step % 2 === 0 ? -8 : 4) + (hash(3311 + index, step) - 0.5) * 14;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
    return `M 6 10 L ${w - 6} 8 L ${w - 4} ${h - 10} L ${ragged.split(' ').reverse().join(' ')} L 4 ${h - 6} Z`;
  }, [h, index, w]);

  const fibers = useMemo(
    () =>
      Array.from({length: 26}, (_, fiber) => ({
        x: hash(4409 + index, fiber) * w,
        y: hash(5501 + index, fiber) * h,
        len: 10 + hash(6607 + index, fiber) * 54,
        angle: (hash(7703 + index, fiber) - 0.5) * 0.5,
        alpha: 0.08 + hash(8819 + index, fiber) * 0.18,
      })),
    [h, index, w],
  );

  if (k <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        transform: `rotate(${rotate.toFixed(3)}deg) scale(${scale.toFixed(3)})`,
        transformOrigin: '50% 8%',
        opacity: clamp01(k * 2.2),
        filter: `drop-shadow(${10 + (1 - landed) * 22}px ${18 + (1 - landed) * 30}px ${24 + (1 - landed) * 30}px rgba(0,0,0,0.62))`,
        willChange: 'transform',
      }}
    >
      {/* 飞行残影 */}
      {landed < 0.99 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${rotate < slot.rotate ? -6 : 6}deg) translateY(-12px)`,
            opacity: 0.22 * (1 - landed),
            filter: 'blur(6px)',
            background: SENBON.paperDim,
            clipPath: 'polygon(6% 3%, 96% 2%, 100% 92%, 88% 100%, 70% 95%, 52% 100%, 30% 94%, 4% 98%)',
          }}
        />
      ) : null}

      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={id('paper')} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#F4EBD7" />
            <stop offset="42%" stopColor="#E5D6B8" />
            <stop offset="100%" stopColor="#C6B08A" />
          </linearGradient>
          <pattern id={id('grain')} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
            <circle cx="1.4" cy="1.4" r="0.8" fill="#7A6440" opacity="0.18" />
          </pattern>
          <linearGradient id={id('fold')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.22" />
            <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#6B5737" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <path d={paperPath} fill={`url(#${id('paper')})`} stroke="#9A855F" strokeWidth="2" />
        <path d={paperPath} fill={`url(#${id('grain')})`} />
        <path d={paperPath} fill={`url(#${id('fold')})`} />
        {fibers.map((fiber, fiberIndex) => (
          <line
            key={`fiber-${fiberIndex}`}
            x1={fiber.x}
            y1={fiber.y}
            x2={fiber.x + Math.cos(fiber.angle) * fiber.len}
            y2={fiber.y + Math.sin(fiber.angle) * fiber.len}
            stroke="#6E5634"
            strokeWidth="0.7"
            opacity={fiber.alpha}
          />
        ))}

        {/* 朱砂双边框 */}
        <rect x="14" y="14" width={w - 28} height={h - 28} fill="none" stroke={SENBON.cinnabar} strokeWidth="5" opacity="0.9" />
        <rect x="24" y="24" width={w - 48} height={h - 48} fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="1.6" opacity="0.7" />

        {/* 太极暗纹 */}
        <g transform={`translate(${w / 2} 74)`} opacity="0.24">
          <circle r="34" fill="none" stroke={SENBON.cinnabar} strokeWidth="3" />
          <path d="M 0 -34 A 34 34 0 0 1 0 34 A 17 17 0 0 1 0 0 A 17 17 0 0 0 0 -34 Z" fill={SENBON.cinnabar} />
          <circle cx="0" cy="-17" r="6" fill={SENBON.paper} />
          <circle cx="0" cy="17" r="6" fill={SENBON.cinnabar} />
        </g>

        {/* 顶部钉 */}
        <circle cx={w / 2} cy="17" r="9" fill="#2A1A12" stroke={SENBON.gold} strokeWidth="3" />
        <circle cx={w / 2 - 2} cy="15" r="3" fill={SENBON.goldLight} />

        {/* 底部符尾 */}
        <path d={`M ${w * 0.22} ${h - 24} L ${w * 0.5} ${h - 8} L ${w * 0.78} ${h - 24}`} fill="none" stroke={SENBON.cinnabar} strokeWidth="3" opacity="0.7" />
      </svg>

      {/* 竖排符字 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 96,
          width: w,
          height: h - 116,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          clipPath: `inset(0 0 ${(1 - textReveal) * 100}% 0)`,
        }}
      >
        <span
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            fontFamily: SERIF_STACK,
            fontWeight: 900,
            fontSize: slot.fontSize,
            lineHeight: 1.04,
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            color: '#1B1210',
            textShadow: '0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          {slot.text}
        </span>
      </div>

      {/* 落钉冲击环 */}
      {landed > 0 && landed < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 30 - landed * 40,
            top: -14 - landed * 18,
            width: 60 + landed * 80,
            height: 60 + landed * 80,
            borderRadius: '50%',
            border: `2px solid ${SENBON.cinnabar}`,
            opacity: (1 - landed) * 0.8,
          }}
        />
      ) : null}
    </div>
  );
};

/**
 * 六张封印符咒。
 *
 * 米黄纸、朱砂双边框、太极暗纹；从屏幕四角飞入，各自带不同的倾斜角钉在
 * 五指山柱上，依次显现【五指山】【下】【偿】【自由】【的】【罪】。
 */
export const Talismans: React.FC<TalismansProps> = ({time, pulse = 0}) => {
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}} aria-hidden="true">
      {TALISMANS.map((slot, index) => (
        <Talisman key={slot.id} slot={slot} time={time} index={index} />
      ))}
      {/* 纸张的高光扫掠 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(252,201,52,${0.06 + pulse * 0.06}) 48%, rgba(255,255,255,0) 66%)`,
          mixBlendMode: 'screen',
          opacity: 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
