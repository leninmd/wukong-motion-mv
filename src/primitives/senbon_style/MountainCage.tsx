import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {catmullRom, polyline, pt, type Pt} from './geometry';
import {clamp01, easeInCubic, overshoot, SENBON} from './style';
import {WukongSilhouette} from './WukongSilhouette';

export interface MountainCageProps {
  time: number;
  /** 五根山柱各自落地的秒数。 */
  peakTimes: readonly number[];
  /** 0–1，封印压迫值。 */
  pressure?: number;
  /** 0–1，重音脉冲。 */
  pulse?: number;
}

interface PeakDef {
  id: string;
  x0: number;
  x1: number;
  dropAt: number;
  seed: number;
  inner: 'left' | 'right' | 'none';
}

const PEAKS: PeakDef[] = [
  {id: 'p1', x0: -220, x1: 170, dropAt: 0, seed: 3101, inner: 'right'},
  {id: 'p2', x0: 238, x1: 552, dropAt: 0, seed: 4303, inner: 'right'},
  {id: 'p3', x0: 614, x1: 820, dropAt: 0, seed: 5507, inner: 'right'},
  {id: 'p4', x0: 1100, x1: 1306, dropAt: 0, seed: 6607, inner: 'left'},
  {id: 'p5', x0: 1374, x1: 2020, dropAt: 0, seed: 7703, inner: 'left'},
];

const buildPeak = (peak: PeakDef) => {
  const steps = 13;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const s = index / steps;
    const y = -700 + s * 1820;
    left.push(pt(peak.x0 + (hash(peak.seed, index) - 0.5) * 42, y));
    right.push(pt(peak.x1 + (hash(peak.seed + 7, index) - 0.5) * 42, y));
  }
  const bottom: Pt[] = [];
  const bottomSteps = 7;
  for (let index = 0; index <= bottomSteps; index += 1) {
    const s = index / bottomSteps;
    bottom.push(
      pt(
        peak.x0 + (peak.x1 - peak.x0) * s,
        1080 + (hash(peak.seed + 13, index) - 0.5) * 90 - (index % 2 === 0 ? 36 : 0),
      ),
    );
  }
  const outline = [...left, ...bottom, ...[...right].reverse()];
  const path = polyline(outline, true);
  const leftEdge = catmullRom(left, 0.4);
  const rightEdge = catmullRom([...right].reverse(), 0.4);
  return {path, leftEdge, rightEdge};
};

const Peak: React.FC<{
  peak: PeakDef;
  time: number;
  dropAt: number;
  pulse: number;
  idPrefix: string;
  index: number;
}> = ({peak, time, dropAt, pulse, idPrefix, index}) => {
  const id = (suffix: string) => `${idPrefix}-${peak.id}-${suffix}`;
  const local = time - dropAt;

  const fall = clamp01(local / 0.34);
  const y = -1560 + 1560 * overshoot(fall, 5.2, 2.4);
  const landed = clamp01((local - 0.34) / 0.2);
  const {path, leftEdge, rightEdge} = useMemo(() => buildPeak(peak), [peak]);
  const width = peak.x1 - peak.x0;

  if (local < 0) return null;

  return (
    <g transform={`translate(0 ${y.toFixed(2)})`}>
      <defs>
        <linearGradient id={id('fill')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#231A1C" />
          <stop offset="38%" stopColor="#171113" />
          <stop offset="100%" stopColor={SENBON.ink} />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
          <stop offset="70%" stopColor={SENBON.gold} stopOpacity="0.5" />
          <stop offset="100%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
        </linearGradient>
        <pattern id={id('dots')} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(21)">
          <circle cx="2" cy="2" r="1.2" fill={SENBON.paper} opacity="0.18" />
        </pattern>
      </defs>

      <path d={path} fill={`url(#${id('fill')})`} stroke={SENBON.inkEdge} strokeWidth={6} />
      <path d={path} fill={`url(#${id('dots')})`} opacity={0.5} />

      {/* 岩层等高线 */}
      {Array.from({length: 19}, (_, line) => {
        const baseY = 10 + line * 56;
        const points: Pt[] = [];
        for (let step = 0; step <= 8; step += 1) {
          const s = step / 8;
          points.push(
            pt(
              peak.x0 + 18 + (width - 36) * s,
              baseY + Math.sin(s * 5.2 + line * 0.9 + time * 0.55) * 7 + (hash(peak.seed + 17 + line, step) - 0.5) * 10,
            ),
          );
        }
        return (
          <path
            key={`contour-${line}`}
            d={catmullRom(points, 0.5)}
            fill="none"
            stroke={line % 4 === 0 ? SENBON.gold : SENBON.goldDeep}
            strokeWidth={line % 4 === 0 ? 2.2 : 1.2}
            opacity={(line % 4 === 0 ? 0.42 : 0.22) + pulse * 0.12}
          />
        );
      })}

      {/* 内侧受光棱线 */}
      <path
        d={peak.inner === 'left' ? leftEdge : rightEdge}
        fill="none"
        stroke={SENBON.gold}
        strokeWidth={16}
        strokeOpacity={0.1}
      />
      <path
        d={peak.inner === 'left' ? leftEdge : rightEdge}
        fill="none"
        stroke={SENBON.gold}
        strokeWidth={4}
        strokeOpacity={0.72}
      />

      {/* 岩面裂隙 */}
      {Array.from({length: 5}, (_, crack) => {
        const startX = peak.x0 + width * (0.2 + hash(peak.seed + 31, crack) * 0.6);
        const points: Pt[] = [];
        for (let step = 0; step <= 5; step += 1) {
          points.push(
            pt(
              startX + (hash(peak.seed + 41 + crack, step) - 0.5) * 50,
              160 + step * 150 + crack * 26,
            ),
          );
        }
        return (
          <path
            key={`crack-${crack}`}
            d={catmullRom(points, 0.4)}
            fill="none"
            stroke={SENBON.inkEdge}
            strokeWidth={3}
            opacity={0.55}
          />
        );
      })}

      {/* 顶部落岩 */}
      {local < 0.7
        ? Array.from({length: 7}, (_, rock) => (
            <path
              key={`rubble-${rock}`}
              d="M 0 0 L 16 8 L 10 24 L -8 18 Z"
              fill={SENBON.stoneDeep}
              stroke={SENBON.goldDeep}
              strokeWidth={1}
              opacity={0.7}
              transform={`translate(${(peak.x0 + width * hash(peak.seed + 51, rock)).toFixed(1)} ${(160 + hash(peak.seed + 61, rock) * 900).toFixed(1)}) rotate(${(hash(peak.seed + 71, rock) * 360).toFixed(1)}) scale(${(0.6 + hash(peak.seed + 81, rock) * 1.4).toFixed(2)})`}
            />
          ))
        : null}

      {/* 落地扬尘 */}
      {landed > 0 && landed < 1 ? (
        <g opacity={(1 - landed) * 0.72}>
          {Array.from({length: 16}, (_, dust) => {
            const angle = (dust / 16) * Math.PI;
            const distance = landed * (90 + hash(peak.seed + 91, dust) * 320);
            return (
              <circle
                key={`dust-${dust}`}
                cx={peak.x0 + width * (dust / 16) + Math.cos(angle) * distance * 0.4}
                cy={1040 - Math.sin(angle) * distance * 0.36}
                r={4 + hash(peak.seed + 101, dust) * 16}
                fill={dust % 4 === 0 ? SENBON.gold : SENBON.stoneLight}
                opacity={0.3 + hash(peak.seed + 111, dust) * 0.4}
              />
            );
          })}
        </g>
      ) : null}

      {/* 山脚金线 */}
      <path d={`M ${peak.x0 + 12} 1054 L ${peak.x1 - 12} 1066`} stroke={SENBON.gold} strokeWidth={2} opacity={0.4 * landed} />
    </g>
  );
};

/**
 * 五指山铁笼下砸。
 *
 * 五根带金色等高线纹理的玄黑巨峰柱按节拍依次从顶部砸落，把画面切成数道
 * 竖向深渊；中央缝隙里，大圣以 `kneel_defiant` 姿态昂首，双翎狂舞。
 */
export const MountainCage: React.FC<MountainCageProps> = ({
  time,
  peakTimes,
  pressure = 0.4,
  pulse = 0,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const peaks = PEAKS.map((peak, index) => ({
    ...peak,
    dropAt: peakTimes[index] ?? peakTimes[peakTimes.length - 1] ?? 0,
  }));
  const central = peaks[2]!;
  const centralRight = peaks[3]!;
  const gapLeft = central.x1 + 18;
  const gapRight = centralRight.x0 - 18;
  const gapCenter = (gapLeft + gapRight) / 2;
  const gapWidth = gapRight - gapLeft;

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      {/* 山体背后的金光深渊 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 70% at 50% 74%, rgba(252,201,52,${0.3 + pressure * 0.12}) 0%, rgba(217,48,37,0.18) 34%, rgba(11,9,10,0.92) 72%, ${SENBON.ink} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${SENBON.ink} 0%, rgba(11,9,10,0.72) 26%, rgba(11,9,10,0.1) 60%, rgba(11,9,10,0.86) 100%)`,
        }}
      />

      {/* 山缝光柱（在剪影之后、山柱之前） */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`mc-${rawId}-shaft`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENBON.goldPale} stopOpacity="0.06" />
            <stop offset="48%" stopColor={SENBON.gold} stopOpacity="0.34" />
            <stop offset="100%" stopColor={SENBON.goldLight} stopOpacity="0.62" />
          </linearGradient>
          <radialGradient id={`mc-${rawId}-floor`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.8" />
            <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d={`M ${gapLeft + 22} 0 L ${gapRight - 22} 0 L ${gapRight + 40} 1080 L ${gapLeft - 40} 1080 Z`}
          fill={`url(#mc-${rawId}-shaft)`}
          opacity={0.55 + pressure * 0.25}
        />
        <ellipse
          cx={gapCenter}
          cy={1000}
          rx={gapWidth * 1.5}
          ry={130}
          fill={`url(#mc-${rawId}-floor)`}
          opacity={0.7}
        />
        {Array.from({length: 34}, (_, index) => {
          const y = ((1600 - time * (60 + hash(3301, index) * 130) + hash(4409, index) * 900) % 1100);
          const x = gapLeft + hash(5501, index) * gapWidth + Math.sin(time * 0.8 + index) * 12;
          return (
            <circle
              key={`mote-${index}`}
              cx={x}
              cy={y}
              r={1.2 + hash(6607, index) * 3.2}
              fill={index % 3 === 0 ? SENBON.paper : SENBON.gold}
              opacity={0.25 + hash(7703, index) * 0.55}
            />
          );
        })}
      </svg>

      {/* 中央缝隙里的大圣（在山柱之后，被山体夹住） */}
      <div
        style={{
          position: 'absolute',
          left: gapCenter - 400,
          top: 372,
          width: 800,
          height: 900,
          filter: `drop-shadow(0 0 40px rgba(252,201,52,${0.28 + pressure * 0.18}))`,
        }}
      >
        <WukongSilhouette
          pose="kneel_defiant"
          width={800}
          height={900}
          wind={1.65}
          glow={0.95}
          aura={0.75}
          opacity={0.98}
        />
      </div>

      {/* 五根山柱 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        {peaks.map((peak, index) => (
          <Peak
            key={peak.id}
            peak={peak}
            time={time}
            dropAt={peak.dropAt}
            pulse={pulse}
            idPrefix={`mc-${rawId}`}
            index={index}
          />
        ))}

        {/* 山脚暗影 */}
        <rect x="0" y="1030" width="1920" height="50" fill={SENBON.ink} opacity="0.9" />
      </svg>

      {/* 前景碎石：把山脚压住，制造纵深 */}
      <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d="M 0 1080 L 0 1002 L 96 976 L 168 1010 L 268 986 L 352 1024 L 470 1000 L 566 1036 L 660 1008 L 780 1042 L 900 1012 L 1006 1044 L 1110 1010 L 1230 1040 L 1340 1004 L 1460 1038 L 1560 1006 L 1680 1040 L 1800 1004 L 1920 1032 L 1920 1080 Z"
          fill={SENBON.inkEdge}
        />
        <path
          d="M 0 1002 L 96 976 L 168 1010 L 268 986 L 352 1024 L 470 1000 L 566 1036 L 660 1008 L 780 1042 L 900 1012 L 1006 1044 L 1110 1010 L 1230 1040 L 1340 1004 L 1460 1038 L 1560 1006 L 1680 1040 L 1800 1004 L 1920 1032"
          fill="none"
          stroke={SENBON.gold}
          strokeWidth={2}
          opacity={0.24 + pulse * 0.1}
        />
      </svg>

      {/* 缝隙里的金色逆光 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(90deg, rgba(11,9,10,0) 0%, rgba(11,9,10,0.35) 36%, rgba(11,9,10,0) 50%, rgba(11,9,10,0.35) 64%, rgba(11,9,10,0) 100%)`,
          opacity: 0.5,
        }}
      />
      {/* 整体压暗与暗角 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 72% 66% at 50% 56%, rgba(11,9,10,0) 40%, rgba(11,9,10,0.55) 78%, rgba(11,9,10,0.92) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
