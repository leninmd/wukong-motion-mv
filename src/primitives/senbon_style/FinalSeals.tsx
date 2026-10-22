import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {SEALS, type SealSlot} from '../../sequences/senbonPlan';
import {clamp01, easeOutCubic, SENBON, SERIF_STACK} from './style';

export interface FinalSealsProps {
  time: number;
  /** 0–1 终局进度。 */
  finale: number;
  /** 0–1 重音脉冲。 */
  pulse?: number;
}

const SEAL_FONT =
  '"Source Han Serif SC Heavy", "Noto Serif SC Black", "Microsoft YaHei", "SimHei", "SimSun", serif';

const SealChar: React.FC<{slot: SealSlot; time: number; index: number; pulse: number}> = ({
  slot,
  time,
  index,
  pulse,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `fs-${rawId}-${slot.id}-${suffix}`;
  const local = time - slot.landAt;

  const k = clamp01(local / 0.14);
  const settle = easeOutCubic(k);
  const scale = 2.9 - 1.9 * settle;
  const opacity = clamp01(local / 0.05);
  const drift = Math.max(0, local - 0.14);
  const shake = drift < 0.22 ? Math.sin(drift * 90) * (1 - drift / 0.22) * 10 : 0;
  const landed = clamp01((local - 0.12) / 0.3);

  const cracks = useMemo(
    () =>
      Array.from({length: 4}, (_, crack) => {
        const points: string[] = [];
        let x = 12 + hash(3301 + index, crack) * 70;
        let y = 10 + hash(4409 + index, crack) * 16;
        for (let step = 0; step < 6; step += 1) {
          x += (hash(5501 + index + crack, step) - 0.5) * 22;
          y += 12 + hash(6607 + index + crack, step) * 12;
          points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        return `M ${(12 + hash(7703 + index, crack) * 70).toFixed(1)} ${(8 + hash(8819 + index, crack) * 10).toFixed(1)} L ${points.join(' L ')}`;
      }),
    [index],
  );

  const flecks = useMemo(
    () =>
      Array.from({length: 46}, (_, fleck) => ({
        x: 6 + hash(9901 + index, fleck) * 88,
        y: 6 + hash(1201 + index, fleck) * 88,
        r: 0.25 + hash(1301 + index, fleck) * 1.1,
        alpha: 0.1 + hash(1409 + index, fleck) * 0.4,
      })),
    [index],
  );

  if (local < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: slot.x - slot.size / 2 + shake,
        top: slot.y - slot.size / 2,
        width: slot.size,
        height: slot.size,
        transform: `rotate(${slot.rotate + (1 - settle) * 6}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: '50% 50%',
        opacity,
        filter: `drop-shadow(0 20px 50px rgba(0,0,0,0.7)) drop-shadow(0 0 ${24 + pulse * 30}px rgba(217,48,37,0.3))`,
        willChange: 'transform',
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id={id('red')} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#FF6A55" />
            <stop offset="34%" stopColor="#E8342A" />
            <stop offset="72%" stopColor={SENBON.cinnabar} />
            <stop offset="100%" stopColor="#A8170F" />
          </linearGradient>
          <linearGradient id={id('edge')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.8" />
            <stop offset="60%" stopColor={SENBON.gold} stopOpacity="0.25" />
            <stop offset="100%" stopColor={SENBON.cinnabarDeep} stopOpacity="0" />
          </linearGradient>
          <pattern id={id('grain')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(31)">
            <circle cx="1.6" cy="1.6" r="0.8" fill="#FFE9C9" opacity="0.2" />
          </pattern>
          <clipPath id={id('glyph')}>
            <text
              x="50"
              y="53"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={SEAL_FONT}
              fontWeight="900"
              fontSize="86"
            >
              {slot.text}
            </text>
          </clipPath>
        </defs>

        {/* 印章外框 */}
        <rect x="4" y="4" width="92" height="92" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.6" opacity={0.42 + landed * 0.25} />
        <rect x="9" y="9" width="82" height="82" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="1" opacity={0.3 + landed * 0.2} />

        {/* 落在纸上的暗红重影 */}
        <text
          x="50.8"
          y="53.8"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={SEAL_FONT}
          fontWeight="900"
          fontSize="86"
          fill="#3A0705"
          opacity="0.8"
        >
          {slot.text}
        </text>

        {/* 巨型朱砂字 */}
        <text
          x="50"
          y="53"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={SEAL_FONT}
          fontWeight="900"
          fontSize="86"
          fill={`url(#${id('red')})`}
          stroke="#4A0905"
          strokeWidth="4"
          paintOrder="stroke"
        >
          {slot.text}
        </text>
        <text
          x="50"
          y="53"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={SEAL_FONT}
          fontWeight="900"
          fontSize="86"
          fill="none"
          stroke={SENBON.gold}
          strokeWidth="0.9"
          opacity="0.4"
        >
          {slot.text}
        </text>

        {/* 裂纹与石屑（裁剪在字内） */}
        <g clipPath={`url(#${id('glyph')})`}>
          {cracks.map((crack, crackIndex) => (
            <g key={`crack-${crackIndex}`}>
              <path d={crack} fill="none" stroke={SENBON.ink} strokeWidth={0.7 + hash(2203 + index, crackIndex) * 0.9} opacity="0.35" />
              <path d={crack} fill="none" stroke={SENBON.goldPale} strokeWidth="0.4" opacity="0.2" transform="translate(0.6 0.6)" />
            </g>
          ))}
          {flecks.map((fleck, fleckIndex) => (
            <circle key={`fleck-${fleckIndex}`} cx={fleck.x} cy={fleck.y} r={fleck.r} fill={fleckIndex % 3 === 0 ? SENBON.paper : SENBON.ink} opacity={fleck.alpha} />
          ))}
        </g>

        {/* 印泥飞溅 */}
        {landed > 0 && landed < 1
          ? Array.from({length: 18}, (_, splash) => {
              const angle = hash(2303 + index, splash) * Math.PI * 2;
              const distance = 42 + landed * (30 + hash(3407 + index, splash) * 60);
              return (
                <circle
                  key={`splash-${splash}`}
                  cx={50 + Math.cos(angle) * distance}
                  cy={50 + Math.sin(angle) * distance}
                  r={0.8 + hash(4507 + index, splash) * 2.6}
                  fill={splash % 4 === 0 ? SENBON.ink : SENBON.cinnabar}
                  opacity={(1 - landed) * 0.75}
                />
              );
            })
          : null}
      </svg>

      {/* 落印冲击环 */}
      {landed > 0 && landed < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 100 + landed * 520,
            height: 100 + landed * 520,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `3px solid ${SENBON.cinnabar}`,
            opacity: (1 - landed) * 0.55,
          }}
        />
      ) : null}
    </div>
  );
};

/**
 * 终局：四个带裂纹质感的巨型朱砂印章字【不】【敬】【权】【威】。
 *
 * 每个字随唱词重音从 2.9 倍砸到 1 倍，落地产生印泥飞溅、冲击环与裂纹。
 */
export const FinalSeals: React.FC<FinalSealsProps> = ({time, finale, pulse = 0}) => {
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}} aria-hidden="true">
      {SEALS.map((slot, index) => (
        <SealChar key={slot.id} slot={slot} time={time} index={index} pulse={pulse} />
      ))}
      {/* 终局红光 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 46% at 50% 50%, rgba(217,48,37,${0.14 + finale * 0.16}) 0%, rgba(11,9,10,0) 68%)`,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};
