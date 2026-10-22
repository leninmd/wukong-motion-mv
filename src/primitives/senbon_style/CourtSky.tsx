import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {blob, pt, type Pt} from './geometry';
import {ALPHA, SENBON} from './style';

export interface CourtSkyProps {
  time: number;
  /** 相机横移量（px），三层视差按 0.22 / 0.5 / 1 分配。 */
  pan: number;
  /** 0–1，天兵合围的压迫值，推动云雾向内收。 */
  pressure: number;
  pulse: number;
  /** 0–1，月面受击时的赤金脉冲。 */
  impact?: number;
}

const VIEW_W = 2400;
const VIEW_H = 1300;

interface RoofProps {
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
  tone: string;
  lineOpacity: number;
  seed: number;
}

const Roof: React.FC<RoofProps> = ({x, y, scale, flip, tone, lineOpacity, seed}) => {
  const brackets = useMemo(
    () =>
      Array.from({length: 13}, (_, index) => ({
        x: -228 + index * 38,
        h: 16 + hash(seed, index) * 12,
      })),
    [seed],
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* 屋顶主体：举折曲线 + 两端起翘 */}
      <path
        d="M -286 0 C -214 -26 -150 -56 -96 -84 L -74 -104 L -48 -88 L -22 -110 L 0 -92 L 22 -110 L 48 -88 L 74 -104 L 96 -84 C 150 -56 214 -26 286 0 C 214 16 118 24 0 24 C -118 24 -214 16 -286 0 Z"
        fill={tone}
        stroke={SENBON.gold}
        strokeOpacity={lineOpacity}
        strokeWidth={2.4}
      />
      {/* 正脊与鸱吻 */}
      <path d="M -74 -104 L 74 -104 L 68 -118 L -68 -118 Z" fill={tone} stroke={SENBON.gold} strokeOpacity={lineOpacity} strokeWidth={2} />
      <path d="M -70 -118 C -88 -138 -78 -150 -64 -142 C -56 -138 -60 -126 -68 -124" fill="none" stroke={SENBON.gold} strokeOpacity={lineOpacity} strokeWidth={3} />
      <path d="M 70 -118 C 88 -138 78 -150 64 -142 C 56 -138 60 -126 68 -124" fill="none" stroke={SENBON.gold} strokeOpacity={lineOpacity} strokeWidth={3} />
      {/* 瓦垄 */}
      {Array.from({length: 15}, (_, index) => {
        const bx = -210 + index * 30;
        return (
          <path
            key={`tile-${index}`}
            d={`M ${bx} -2 C ${bx * 0.82} -34 ${bx * 0.55} -64 ${bx * 0.34} -92`}
            fill="none"
            stroke={SENBON.gold}
            strokeOpacity={lineOpacity * 0.45}
            strokeWidth={1.2}
          />
        );
      })}
      {/* 斗拱 */}
      {brackets.map((bracket, index) => (
        <g key={`bracket-${index}`}>
          <rect x={bracket.x} y={20} width={16} height={bracket.h} fill={tone} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.5} strokeWidth={1} />
          <rect x={bracket.x - 8} y={20 + bracket.h} width={32} height={7} fill={tone} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.45} strokeWidth={1} />
        </g>
      ))}
      {/* 殿身、柱子、窗棂 */}
      <path d="M -236 38 L 236 38 L 258 330 L -258 330 Z" fill={SENBON.inkEdge} />
      {[-196, -118, -40, 40, 118, 196].map((cx) => (
        <rect key={`col-${cx}`} x={cx - 11} y={44} width={22} height={270} fill={tone} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.32} strokeWidth={1.2} />
      ))}
      {[-158, -80, 80, 158].map((cx) => (
        <g key={`window-${cx}`}>
          <rect x={cx - 28} y={92} width={56} height={128} fill={SENBON.ink} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.42} strokeWidth={1.2} />
          {[1, 2, 3].map((line) => (
            <line key={`v-${line}`} x1={cx - 28 + line * 14} y1={92} x2={cx - 28 + line * 14} y2={220} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.3} strokeWidth={1} />
          ))}
          {[1, 2, 3].map((line) => (
            <line key={`h-${line}`} x1={cx - 28} y1={92 + line * 32} x2={cx + 28} y2={92 + line * 32} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.3} strokeWidth={1} />
          ))}
        </g>
      ))}
      {/* 檐铃 */}
      {[-262, 262].map((lx) => (
        <g key={`bell-${lx}`}>
          <line x1={lx} y1={4} x2={lx} y2={36} stroke={SENBON.gold} strokeOpacity={lineOpacity * 0.6} strokeWidth={1.4} />
          <path d={`M ${lx - 9} 36 Q ${lx} 56 ${lx + 9} 36 Z`} fill={SENBON.gold} opacity={lineOpacity * 0.55} />
        </g>
      ))}
    </g>
  );
};

/**
 * Shot 1 的天空与远景。
 *
 * 纯 SVG：满月（径向渐变 + 半调网点阴影）、云带、飞檐殿宇剪影、檐铃、
 * 飞鸟与金色浮尘。三层视差由 `pan` 驱动，不依赖任何位图。
 */
export const CourtSky: React.FC<CourtSkyProps> = ({time, pan, pressure, pulse, impact = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `cs-${rawId}-${suffix}`;

  const roofsFar = useMemo(
    () =>
      Array.from({length: 8}, (_, index) => ({
        x: -80 + index * 330,
        y: 742 + (index % 2) * 30,
        scale: 0.5 + hash(3311, index) * 0.16,
        flip: index % 2 === 1,
        opacity: 0.36,
      })),
    [],
  );
  const roofsNear = useMemo(
    () =>
      Array.from({length: 7}, (_, index) => ({
        x: -120 + index * 400,
        y: 862 + (index % 3) * 26,
        scale: 0.86 + hash(7717, index) * 0.28,
        flip: index % 2 === 0,
        opacity: 0.68,
      })),
    [],
  );

  const dust = useMemo(
    () =>
      Array.from({length: 110}, (_, index) => ({
        x: hash(991, index) * VIEW_W,
        y: hash(1223, index) * VIEW_H,
        r: 0.8 + hash(1447, index) * 3.4,
        phase: hash(1777, index) * Math.PI * 2,
        speed: 6 + hash(1999, index) * 26,
        alpha: 0.12 + hash(2111, index) * 0.55,
      })),
    [],
  );

  const birds = useMemo(
    () =>
      Array.from({length: 9}, (_, index) => ({
        x: 560 + hash(303, index) * 1000,
        y: 160 + hash(307, index) * 300,
        scale: 0.4 + hash(311, index) * 0.7,
        speed: 8 + hash(313, index) * 16,
        wing: hash(317, index) * 6,
      })),
    [],
  );

  const moonX = 1200;
  const moonY = 326;
  const moonR = 336;

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      {/* 天幕底色 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 58% at 50% 40%, #2A1210 0%, #170D0C 42%, ${SENBON.ink} 78%)`,
        }}
      />
      {/* 月下金色地平线 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(11,9,10,0) 56%, rgba(154,106,13,${0.16 + pulse * 0.08}) 82%, rgba(11,9,10,0.92) 100%)`,
        }}
      />

      {/* 远景：满月 + 飞檐（慢速视差） */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        style={{
          position: 'absolute',
          left: -240 - pan * 0.22,
          top: -70,
          overflow: 'visible',
        }}
      >
        <defs>
          <radialGradient id={id('moon')} cx="42%" cy="38%" r="62%">
            <stop offset="0%" stopColor={SENBON.goldPale} />
            <stop offset="42%" stopColor={SENBON.gold} />
            <stop offset="78%" stopColor={SENBON.goldDeep} />
            <stop offset="100%" stopColor="#6B3F06" />
          </radialGradient>
          <radialGradient id={id('moonGlow')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0.45" />
            <stop offset="40%" stopColor={SENBON.cinnabar} stopOpacity="0.16" />
            <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
          </radialGradient>
          <pattern id={id('moonDots')} width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="4" cy="4" r="2.6" fill={SENBON.goldShadow} opacity="0.6" />
          </pattern>
          <pattern id={id('moonDotsFine')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
            <circle cx="2" cy="2" r="1.1" fill={SENBON.goldPale} opacity="0.35" />
          </pattern>
          <clipPath id={id('moonClip')}>
            <circle cx={moonX} cy={moonY} r={moonR} />
          </clipPath>
          <linearGradient id={id('cloud')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#241416" />
            <stop offset="100%" stopColor={SENBON.ink} />
          </linearGradient>
          <linearGradient id={id('haze')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {/* 月晕 */}
        <circle cx={moonX} cy={moonY} r={moonR * 2.2} fill={`url(#${id('moonGlow')})`} opacity={0.5 + pulse * 0.2 + impact * 0.2} />
        <circle cx={moonX} cy={moonY} r={moonR * 1.28} fill="none" stroke={SENBON.cinnabar} strokeWidth={1.6} strokeDasharray="3 14" opacity={0.34} />

        {/* 月面 */}
        <g style={{transformOrigin: `${moonX}px ${moonY}px`, transform: `translate(${(pan * 0.04).toFixed(2)}px, 0px)`}}>
          <circle cx={moonX} cy={moonY} r={moonR} fill={`url(#${id('moon')})`} />
          <g clipPath={`url(#${id('moonClip')})`}>
            {/* 半调网点阴影：左下弦月暗部 */}
            <path
              d={`M ${moonX - moonR} ${moonY} A ${moonR} ${moonR} 0 0 0 ${moonX + moonR * 0.4} ${moonY + moonR * 0.92} C ${moonX + moonR * 0.1} ${moonY + moonR * 0.3} ${moonX - moonR * 0.2} ${moonY - moonR * 0.25} ${moonX - moonR} ${moonY} Z`}
              fill={`url(#${id('moonDots')})`}
              opacity={0.55}
            />
            <circle cx={moonX} cy={moonY} r={moonR} fill={`url(#${id('moonDotsFine')})`} opacity={0.4} />
            {/* 环形山 */}
            {[
              [-90, -80, 42], [70, -140, 30], [130, 40, 54], [-30, 130, 36], [-150, 60, 24],
              [20, -40, 18], [180, -30, 22], [-70, 180, 20], [90, 190, 28], [-190, -20, 17],
            ].map(([dx, dy, r], index) => (
              <g key={`crater-${index}`}>
                <circle cx={moonX + dx!} cy={moonY + dy!} r={r!} fill={SENBON.goldDeep} opacity={0.12} />
                <circle cx={moonX + dx! - 4} cy={moonY + dy! - 4} r={r! * 0.72} fill={SENBON.goldPale} opacity={0.08} />
              </g>
            ))}
            {/* 月面裂纹 */}
            <path
              d={`M ${moonX - 190} ${moonY + 40} L ${moonX - 120} ${moonY + 70} L ${moonX - 70} ${moonY + 46} L ${moonX + 20} ${moonY + 92}`}
              fill="none"
              stroke={SENBON.goldShadow}
              strokeWidth={4}
              opacity={0.24}
            />
          </g>
          <circle cx={moonX} cy={moonY} r={moonR} fill="none" stroke={SENBON.goldLight} strokeWidth={4} opacity={0.75} />
          <circle cx={moonX} cy={moonY} r={moonR + 12} fill="none" stroke={SENBON.cinnabar} strokeWidth={2} opacity={0.35} />
        </g>

        {/* 飞鸟（穿过月面） */}
        {birds.map((bird, index) => {
          const x = ((bird.x - time * bird.speed + pan * 0.3) % 1400) + 440;
          const flap = Math.sin(time * 7 + bird.wing) * 8;
          return (
            <path
              key={`bird-${index}`}
              d={`M ${x - 14 * bird.scale} ${bird.y + flap} Q ${x} ${bird.y - 10 * bird.scale} ${x + 14 * bird.scale} ${bird.y + flap}`}
              fill="none"
              stroke={SENBON.ink}
              strokeWidth={3.4 * bird.scale}
              strokeLinecap="round"
              opacity={0.8}
            />
          );
        })}

        {/* 远层殿宇 */}
        {roofsFar.map((roof, index) => (
          <Roof
            key={`roof-far-${index}`}
            x={roof.x}
            y={roof.y}
            scale={roof.scale}
            flip={roof.flip}
            tone="#1C1416"
            lineOpacity={roof.opacity * 1.25}
            seed={4100 + index}
          />
        ))}

        {/* 金色地平雾 */}
        <rect x="0" y={VIEW_H - 300} width={VIEW_W} height={300} fill={`url(#${id('haze')})`} opacity={0.55} />
      </svg>

      {/* 中景：云带（中速视差） */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        style={{position: 'absolute', left: -240 - pan * 0.5, top: -70, overflow: 'visible'}}
      >
        <defs>
          <linearGradient id={id('cloudFill')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A1B18" />
            <stop offset="58%" stopColor="#1A0F10" />
            <stop offset="100%" stopColor={SENBON.ink} />
          </linearGradient>
        </defs>
        {[
          {y: 560, x: 120, w: 780, h: 90, drift: 10},
          {y: 640, x: 900, w: 920, h: 70, drift: -14},
          {y: 470, x: 1500, w: 620, h: 64, drift: 8},
          {y: 720, x: -160, w: 860, h: 80, drift: -8},
          {y: 760, x: 1250, w: 900, h: 96, drift: 12},
        ].map((cloud, index) => {
          const cx = cloud.x + Math.sin(time * 0.35 + index) * 22 + cloud.drift * time + pan * 0.18;
          const points: Pt[] = [];
          const lobes = 7;
          for (let i = 0; i <= lobes * 2; i += 1) {
            const t = i / (lobes * 2);
            const arc = Math.sin(t * Math.PI);
            const bumpy = Math.sin(t * Math.PI * lobes + index) * 0.16 + 1;
            points.push(pt(cx + t * cloud.w, cloud.y - arc * cloud.h * bumpy + Math.sin(time * 0.8 + i) * 2));
          }
          for (let i = lobes * 2; i >= 0; i -= 1) {
            const t = i / (lobes * 2);
            points.push(pt(cx + t * cloud.w, cloud.y + cloud.h * 0.34 + Math.sin(t * Math.PI) * 10));
          }
          return (
            <g key={`cloud-${index}`} opacity={0.8 - index * 0.06}>
              <path d={blob(points, 0.3)} fill={`url(#${id('cloudFill')})`} />
              <path
                d={blob(points, 0.3)}
                fill="none"
                stroke={SENBON.gold}
                strokeWidth={2}
                strokeOpacity={0.22}
              />
            </g>
          );
        })}
      </svg>

      {/* 近景：更暗的殿宇（快速视差） */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={VIEW_W}
        height={VIEW_H}
        style={{position: 'absolute', left: -240 - pan, top: -70, overflow: 'visible'}}
      >
        {roofsNear.map((roof, index) => (
          <Roof
            key={`roof-near-${index}`}
            x={roof.x}
            y={roof.y}
            scale={roof.scale}
            flip={roof.flip}
            tone={index % 2 === 0 ? '#161011' : '#1A1214'}
            lineOpacity={roof.opacity * 0.85}
            seed={8200 + index}
          />
        ))}
      </svg>

      {/* 金色浮尘 */}
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={VIEW_W} height={VIEW_H} style={{position: 'absolute', left: -240, top: -70}}>
        {dust.map((mote, index) => {
          const y = ((mote.y - time * mote.speed) % VIEW_H + VIEW_H) % VIEW_H;
          const x = mote.x + Math.sin(time * 0.6 + mote.phase) * 24 + pan * 0.2;
          return (
            <circle
              key={`mote-${index}`}
              cx={x}
              cy={y}
              r={mote.r}
              fill={index % 5 === 0 ? SENBON.paper : SENBON.gold}
              opacity={mote.alpha * (0.5 + pressure * 0.5)}
            />
          );
        })}
      </svg>

      {/* 压迫感暗边 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 52% at 50% 46%, rgba(11,9,10,0) 42%, rgba(11,9,10,${0.45 + pressure * 0.3}) 78%, ${ALPHA.ink85} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
