import React, {useId, useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE} from '../config/theme';
import {clamp, ease, fbm, hash, lerp} from '../utils/math';

export interface FiveFingerMountainProps {
  /** Seconds when the fingers start to descend. */
  descendSeconds: number;
  /** Seconds when the last finger has landed (drives dust + light). */
  lockSeconds: number;
  /** 0–1 spectrum accent used by the golden fissure. */
  pulse?: number;
  /** 1 = wide shot, >1 pushes into the palm crack for the trapped close-up. */
  zoom?: number;
  focusX?: number;
  focusY?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

interface FingerSpec {
  cx: number;
  halfTop: number;
  halfTip: number;
  tipY: number;
  seed: number;
}

const FINGERS: FingerSpec[] = [
  {cx: -80, halfTop: 244, halfTip: 150, tipY: 664, seed: 11},
  {cx: 424, halfTop: 236, halfTip: 146, tipY: 832, seed: 23},
  {cx: 958, halfTop: 252, halfTip: 160, tipY: 968, seed: 37},
  {cx: 1492, halfTop: 236, halfTip: 146, tipY: 824, seed: 53},
  {cx: 1998, halfTop: 244, halfTip: 150, tipY: 644, seed: 71},
];

const TOP_Y = -170;
/** Every finger leans toward the palm centre: that is what reads as a hand. */
const LEAN = 0.17;

const centreAt = (spec: FingerSpec, t: number): number =>
  spec.cx + (960 - spec.cx) * LEAN * t;

const edgePoints = (spec: FingerSpec, side: 1 | -1): Array<[number, number]> => {
  const steps = 18;
  const points: Array<[number, number]> = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const y = TOP_Y + (spec.tipY - TOP_Y) * t;
    // Knuckle bulges, then a hard taper into the tip.
    const bulge = 1 + Math.sin(t * Math.PI * 2.4 + (side > 0 ? 0.6 : 0)) * 0.055;
    const half = lerp(spec.halfTop, spec.halfTip, ease.inOutCubic(t)) * bulge;
    const coarse =
      (fbm(spec.seed * 0.37 + t * 3.4, spec.seed * 0.11, 4) - 0.5) * (46 + t * 62)
      + Math.sin(t * 3.1 + spec.seed) * 12;
    const fine = (hash(spec.seed + (side > 0 ? 5 : 0), index * 3) - 0.5) * (14 + t * 20);
    points.push([centreAt(spec, t) + side * (half + coarse + fine), y]);
  }
  return points;
};

const edgePath = (spec: FingerSpec, side: 1 | -1): string => {
  const points = edgePoints(spec, side);
  const commands: string[] = [];
  points.forEach((point, index) => {
    commands.push(`${index === 0 ? 'M' : 'L'} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`);
  });
  return commands.join(' ');
};

const fingerPath = (spec: FingerSpec): string => {
  const left = edgePoints(spec, -1);
  const right = edgePoints(spec, 1);
  const commands: string[] = [`M ${left[0]?.[0]?.toFixed(2)} ${left[0]?.[1]?.toFixed(2)}`];
  for (let index = 1; index < left.length; index += 1) {
    const point = left[index];
    if (point) commands.push(`L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`);
  }
  const rightTip = right[right.length - 1];
  const tipX = centreAt(spec, 1);
  const tipDepth = spec.tipY + spec.halfTip * 1.05;
  commands.push(
    `Q ${tipX.toFixed(2)} ${tipDepth.toFixed(2)} ${rightTip?.[0]?.toFixed(2)} ${rightTip?.[1]?.toFixed(2)}`,
  );
  for (let index = right.length - 2; index >= 0; index -= 1) {
    const point = right[index];
    if (point) commands.push(`L ${point[0].toFixed(2)} ${point[1].toFixed(2)}`);
  }
  commands.push('Z');
  return commands.join(' ');
};

const palmPath = (): string => {
  const steps = 26;
  const commands: string[] = [`M -120 ${TOP_Y}`, 'L -120 70'];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = -120 + 2160 * t;
    const y = 70 + (fbm(t * 7.3, 3.1, 3) - 0.5) * 130 + Math.sin(t * 5.2) * 26;
    commands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  commands.push('L 2040 70', 'L 2040 0', 'Z');
  return commands.join(' ');
};

/**
 * 五行山 · 五指镇压.
 *
 * Five eroded monoliths lean toward the palm centre and slam down in a
 * staggered drop. The rock is modelled, not silhouetted: a directional body
 * gradient plus a clipped left rim light and horizontal strata, all generated
 * from fBm so no asset has to ship with the repo.
 */
export const FiveFingerMountain: React.FC<FiveFingerMountainProps> = ({
  descendSeconds,
  lockSeconds,
  pulse = 0,
  zoom = 1,
  focusX = 958,
  focusY = 800,
  opacity = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reactId = useId().replace(/[:«»]/g, '');
  const rockId = `rock-${reactId}`;
  const rimId = `rimlight-${reactId}`;
  const fissureId = `fissure-${reactId}`;
  const glowId = `rockglow-${reactId}`;
  const clipPrefix = `rockclip-${reactId}`;
  const edgeId = `rockedge-${reactId}`;

  const timeSeconds = frame / fps;
  const paths = useMemo(() => FINGERS.map((finger) => fingerPath(finger)), []);
  const palm = useMemo(() => palmPath(), []);

  const drops = FINGERS.map((finger, index) => {
    const local = (timeSeconds - descendSeconds - index * 0.055) / 0.42;
    const progress = ease.outQuint(clamp(local));
    return {translateY: -(1 - progress) * 660, progress};
  });

  const allLanded = timeSeconds >= lockSeconds ? clamp((timeSeconds - lockSeconds) / 0.3) : 0;
  const settle = 1 - ease.outExpo(clamp((timeSeconds - lockSeconds) / 0.9));
  const middleDrop = drops[2]?.progress ?? 0;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        opacity,
        ...style,
      }}
    >
      <defs>
        <linearGradient id={rockId} x1="0.05" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#3A2F2D" />
          <stop offset="22%" stopColor="#241C1C" />
          <stop offset="55%" stopColor="#120E0F" />
          <stop offset="82%" stopColor="#0A0708" />
          <stop offset="100%" stopColor="#050405" />
        </linearGradient>
        <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(244,239,230,0.55)" />
          <stop offset="2.5%" stopColor="rgba(244,239,230,0.18)" />
          <stop offset="9%" stopColor="rgba(252,201,52,0.06)" />
          <stop offset="42%" stopColor="rgba(0,0,0,0.42)" />
          <stop offset="72%" stopColor="rgba(0,0,0,0.68)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.86)" />
        </linearGradient>
        <linearGradient id={fissureId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(244,239,230,0.95)" />
          <stop offset="30%" stopColor="rgba(252,201,52,0.95)" />
          <stop offset="100%" stopColor="rgba(217,48,37,0.5)" />
        </linearGradient>
        <filter id={glowId} x="-60%" y="-40%" width="220%" height="180%">
          <feGaussianBlur stdDeviation="24" />
        </filter>
        <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(252,201,52,0)" />
          <stop offset="35%" stopColor="rgba(252,201,52,0.55)" />
          <stop offset="70%" stopColor="rgba(244,239,230,0.75)" />
          <stop offset="100%" stopColor="rgba(252,201,52,0.2)" />
        </linearGradient>
        {paths.map((path, index) => (
          <clipPath key={`clip-${index}`} id={`${clipPrefix}-${index}`}>
            <path d={path} />
          </clipPath>
        ))}
      </defs>

      <g
        transform={`translate(${focusX} ${focusY}) scale(${zoom}) translate(${-focusX} ${-focusY})`}
      >
        {/* Crushed ground plane. */}
        <ellipse cx={958} cy={1024} rx={1240} ry={200} fill="#050304" opacity={0.96} />
        <ellipse
          cx={958}
          cy={1010}
          rx={1180}
          ry={176}
          fill="none"
          stroke="rgba(244,239,230,0.09)"
          strokeWidth={2}
        />

        {/* Radiating impact cracks. */}
        {Array.from({length: 15}, (_, index) => {
          const seed = 4100 + index * 31;
          const angle = -Math.PI + (index / 14) * Math.PI;
          const length = 260 + hash(seed, index) * 580;
          const startX = 958 + hash(seed, index + 3) * 70;
          const midX = startX + Math.cos(angle) * length * 0.55;
          const midY = 1006 + Math.sin(angle) * length * 0.2;
          const endX = startX + Math.cos(angle) * length;
          const endY = 1006 + Math.sin(angle) * length * 0.34;
          return (
            <path
              key={`crack-${index}`}
              d={`M ${startX.toFixed(1)} 1006 L ${midX.toFixed(1)} ${midY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`}
              stroke={`rgba(217,48,37,${(0.1 + hash(seed, index + 9) * 0.2).toFixed(3)})`}
              strokeWidth={1 + hash(seed, index + 11) * 2.6}
              fill="none"
            />
          );
        })}

        {/* Golden daylight squeezing through the slits between the monoliths. */}
        <g opacity={clamp(middleDrop * 0.95 + pulse * 0.32)}>
          {[{x: 676, w: 34, tilt: -10}, {x: 1232, w: 22, tilt: 8}].map((slit, index) => (
            <g key={`slit-${index}`}>
              {/* Daylight falling the full height of the crack. */}
              <rect
                x={slit.x - 30}
                y={-40}
                width={slit.w + 60}
                height={1100}
                fill={`url(#${fissureId})`}
                opacity={(0.16 + pulse * 0.12) * (index === 0 ? 1 : 0.55)}
                filter={`url(#${glowId})`}
              />
              <path
                d={`M ${slit.x} -20 L ${slit.x + slit.tilt} 380 L ${slit.x - slit.tilt * 0.5} 720 L ${slit.x + slit.tilt * 0.4} 1016`}
                stroke={`url(#${fissureId})`}
                strokeWidth={slit.w * (0.5 + pulse * 0.45)}
                fill="none"
                strokeLinecap="round"
                opacity={0.58 + pulse * 0.4}
              />
              <path
                d={`M ${slit.x + 3} -20 L ${slit.x + slit.tilt * 0.8} 420 L ${slit.x - slit.tilt * 0.4} 760 L ${slit.x + slit.tilt * 0.2} 1010`}
                stroke={PALETTE.paper}
                strokeWidth={2.4}
                fill="none"
                opacity={0.4 + pulse * 0.3}
              />
            </g>
          ))}
          {/* Pool of light spilling onto the ground. */}
          <ellipse
            cx={700}
            cy={1000}
            rx={250}
            ry={40}
            fill="rgba(252,201,52,0.16)"
            filter={`url(#${glowId})`}
          />
        </g>

        {/* Palm mass above the fingers. */}
        <path d={palm} fill={`url(#${rockId})`} />
        <path d={palm} fill="none" stroke="rgba(244,239,230,0.12)" strokeWidth={2} />

        {/* The five fingers. */}
        {paths.map((path, index) => {
          const drop = drops[index];
          const spec = FINGERS[index];
          return (
            <g
              key={`finger-${index}`}
              transform={`translate(0 ${(drop?.translateY ?? -660).toFixed(2)})`}
            >
              <path d={path} fill={`url(#${rockId})`} />
              <g clipPath={`url(#${clipPrefix}-${index})`}>
                {/* Rim light from the left + shadow on the right. */}
                <path d={path} fill={`url(#${rimId})`} opacity={0.55 + pulse * 0.3} />
                {/* Irregular chiselled facets: the light and shadow planes. */}
                {Array.from({length: 9}, (_, facet) => {
                  const bandSeed = spec?.seed ?? 11;
                  const span = (spec?.halfTop ?? 160) * 2.4;
                  const left = -span * (0.2 + hash(bandSeed, facet * 9) * 0.8);
                  const right = span * (0.2 + hash(bandSeed, facet * 9 + 1) * 0.8);
                  const top = TOP_Y + 40 + hash(bandSeed, facet * 9 + 2) * (spec?.tipY ?? 700);
                  const height = 90 + hash(bandSeed, facet * 9 + 3) * 190;
                  const lit = hash(bandSeed, facet * 9 + 4);
                  return (
                    <path
                      key={`facet-${facet}`}
                      d={`M ${(left + (spec?.cx ?? 960)).toFixed(1)} ${top.toFixed(1)} L ${(right + (spec?.cx ?? 960)).toFixed(1)} ${(top + height * 0.22).toFixed(1)} L ${(right * 0.86 + (spec?.cx ?? 960)).toFixed(1)} ${(top + height).toFixed(1)} L ${(left * 0.9 + (spec?.cx ?? 960)).toFixed(1)} ${(top + height * 0.78).toFixed(1)} Z`}
                      fill={
                        lit > 0.55
                          ? `rgba(244,239,230,${(0.025 + lit * 0.05).toFixed(3)})`
                          : `rgba(0,0,0,${(0.24 + lit * 0.3).toFixed(3)})`
                      }
                    />
                  );
                })}
                {Array.from({length: 9}, (_, crack) => {
                  const bandSeed = spec?.seed ?? 11;
                  const top = TOP_Y + 80 + crack * 74;
                  const startX = (spec?.cx ?? 960) + (hash(bandSeed, crack * 5) - 0.5) * 220;
                  return (
                    <path
                      key={`fracture-${crack}`}
                      d={`M ${startX.toFixed(1)} ${top.toFixed(1)} l ${(hash(bandSeed, crack + 2) - 0.5) * 70} 48 l ${(hash(bandSeed, crack + 4) - 0.5) * 54} 62`}
                      stroke="rgba(0,0,0,0.55)"
                      strokeWidth={2 + hash(bandSeed, crack + 6) * 3}
                      fill="none"
                    />
                  );
                })}
                {/* Warm spill from the slits onto the neighbouring fingers. */}
                {index === 1 || index === 2 ? (
                  <ellipse
                    cx={index === 1 ? 700 : 1220}
                    cy={(spec?.tipY ?? 860) - 120}
                    rx={150}
                    ry={280}
                    fill="rgba(252,201,52,0.16)"
                    opacity={0.45 + pulse * 0.4}
                  />
                ) : null}
              </g>
              {/* 贴边受光：靠近石缝的岩面被金光吃掉边缘，这是"有光"的关键 */}
              <path
                d={edgePath(spec ?? FINGERS[2], -1)}
                fill="none"
                stroke={`url(#${edgeId})`}
                strokeWidth={26}
                strokeLinecap="round"
                opacity={0.55 + pulse * 0.35}
              />
              <path
                d={edgePath(spec ?? FINGERS[2], 1)}
                fill="none"
                stroke={`url(#${edgeId})`}
                strokeWidth={18}
                strokeLinecap="round"
                opacity={0.4 + pulse * 0.3}
              />

              {/* Rim light only on the lit flank — no all-round vector outline. */}
              <path
                d={edgePath(spec ?? FINGERS[2], -1)}
                fill="none"
                stroke={`rgba(244,239,230,${(0.55 + pulse * 0.3).toFixed(3)})`}
                strokeWidth={3.4}
                strokeLinejoin="round"
              />
              <path
                d={edgePath(spec ?? FINGERS[2], 1)}
                fill="none"
                stroke={`rgba(252,201,52,${(0.2 + pulse * 0.22).toFixed(3)})`}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              <ellipse
                cx={centreAt(spec ?? FINGERS[2], 1)}
                cy={(spec?.tipY ?? 860) + (spec?.halfTip ?? 100) * 0.9}
                rx={(spec?.halfTip ?? 100) * 1.1}
                ry={18}
                fill="rgba(0,0,0,0.55)"
              />
            </g>
          );
        })}

        {/* Impact dust rings. */}
        {allLanded > 0 && allLanded < 1 ? (
          <g opacity={(1 - allLanded) * 0.7}>
            {drops.map((drop, index) => {
              const finger = FINGERS[index];
              if (!finger) return null;
              const radius = 130 + allLanded * (440 + index * 30);
              return (
                <ellipse
                  key={`dust-${index}`}
                  cx={finger.cx}
                  cy={finger.tipY + 160 + index * 6}
                  rx={radius}
                  ry={radius * 0.17}
                  fill="none"
                  stroke={`rgba(244,239,230,${(0.3 * (1 - allLanded)).toFixed(3)})`}
                  strokeWidth={3}
                  opacity={drop.progress}
                />
              );
            })}
          </g>
        ) : null}

        {/* 前景碎石：压住画面下缘，拉开景深 */}
        <path
          d={`M -60 ${1080} L 120 964 L 268 1016 L 404 946 L 560 1024 L 720 976 L 860 1042 L 1040 986 L 1210 1046 L 1390 972 L 1560 1030 L 1730 962 L 1980 1032 L 1980 1080 Z`}
          fill="#050405"
          stroke="rgba(252,201,52,0.22)"
          strokeWidth={2}
        />
        <path
          d={`M -60 ${1080} L 260 1040 L 520 1076 L 800 1036 L 1100 1080 L 1420 1044 L 1700 1080 L 1980 1050 L 1980 1120 L -60 1120 Z`}
          fill="#030203"
        />

        {/* Scale cue: one crouching figure under the palm, the cudgel planted
            beside him. Without this the monoliths have no readable size. */}
        <g transform="translate(1128 868) scale(1.34)">
          <ellipse cx={0} cy={58} rx={62} ry={12} fill="rgba(0,0,0,0.6)" />
          <g fill="#100C0D" stroke={`rgba(252,201,52,${(0.34 + pulse * 0.24).toFixed(3)})`} strokeWidth={1.2}>
            <circle cx={-4} cy={-46} r={13} />
            <path d="M -22 -30 Q -30 2 -22 24 L 22 24 Q 30 -2 20 -30 Q 6 -40 -22 -30 Z" />
            <path d="M -20 22 L -34 52 L -18 52 L -8 26 Z" />
            <path d="M 18 22 L 34 52 L 16 52 L 6 26 Z" />
            <path d="M -24 -26 L -44 -2 L -38 6 L -18 -14 Z" />
            <path d="M 22 -26 L 42 -4 L 34 4 L 16 -14 Z" />
          </g>
          <line
            x1={44}
            y1={52}
            x2={78}
            y2={-150}
            stroke={PALETTE.gold}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.9}
          />
          <line
            x1={78}
            y1={-150}
            x2={96}
            y2={-208}
            stroke={PALETTE.paper}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>

        <circle
          cx={958}
          cy={960}
          r={40 + settle * 26}
          fill="none"
          stroke={`rgba(252,201,52,${(0.3 * settle).toFixed(3)})`}
          strokeWidth={2}
        />
      </g>
    </svg>
  );
};
