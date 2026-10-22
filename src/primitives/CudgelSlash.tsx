import React, {useId} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE} from '../config/theme';
import {clamp, ease, hash, lerp} from '../utils/math';

export interface SlashCue {
  /** Resolved frame of the hit (from alignment seconds × fps). */
  startFrame: number;
  power: number;
}

export interface CudgelSlashProps {
  cues: readonly SlashCue[];
  opacity?: number;
  /** Frames the sweep itself takes. */
  sweepFrames?: number;
  style?: React.CSSProperties;
}

const PIVOT_X = 960;
const PIVOT_Y = 700;
const STAFF_HALF_LENGTH = 1500;

/**
 * 如意金箍棒 sweep.
 *
 * The bar is held at its middle, so it crosses the frame at every angle instead
 * of pivoting off-screen like a windshield wiper. One SVG tree per active slash:
 * ink underlay + gold body + paper core + the two cinnabar bands, then a five
 * layer motion fan and a swept crescent of light on the same pivot.
 */
export const CudgelSlash: React.FC<CudgelSlashProps> = ({
  cues,
  opacity = 1,
  sweepFrames = 14,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reactId = useId().replace(/[:«»]/g, '');
  const goldId = `cudgel-gold-${reactId}`;
  const trailId = `cudgel-trail-${reactId}`;
  const glowId = `cudgel-glow-${reactId}`;

  const fadeFrames = Math.round(0.5 * fps);

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
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={PALETTE.cinnabar} />
          <stop offset="5%" stopColor="rgba(252,201,52,0.35)" />
          <stop offset="10%" stopColor={PALETTE.gold} />
          <stop offset="50%" stopColor={PALETTE.gold} />
          <stop offset="90%" stopColor={PALETTE.gold} />
          <stop offset="95%" stopColor="rgba(252,201,52,0.35)" />
          <stop offset="100%" stopColor={PALETTE.cinnabar} />
        </linearGradient>
        <linearGradient id={trailId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(252,201,52,0)" />
          <stop offset="42%" stopColor="rgba(252,201,52,0.35)" />
          <stop offset="100%" stopColor="rgba(244,239,230,0.95)" />
        </linearGradient>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {cues.map((cue, cueIndex) => {
        // The swing starts five frames before the aligned hit so the bar is
        // already travelling through the frame when the drum lands.
        const local = frame - cue.startFrame + 5;
        if (local < 0 || local > sweepFrames + fadeFrames) return null;

        const sweep = ease.inOutCubic(clamp(local / sweepFrames));
        const fade = 1 - clamp((local - sweepFrames) / fadeFrames);
        const ramp = clamp(local / 2);
        if (fade <= 0.001) return null;

        const mirrored = cueIndex % 2 === 1;
        const from = mirrored ? -8 : -78;
        const to = mirrored ? -78 : -8;
        const angle = lerp(from, to, sweep);
        const thickness = lerp(38, 58, cue.power);
        const visible = Math.max(0.05, fade) * ramp * (0.6 + cue.power * 0.4);
        const seed = Math.round(cue.startFrame) * 131;

        return (
          <g key={`${cue.startFrame}-${cueIndex}`}>
            {/* Swept crescent of light. */}
            <g transform={`translate(${PIVOT_X} ${PIVOT_Y})`}>
              <path
                d={arcPath(from, angle, 540)}
                fill="none"
                stroke={`rgba(252,201,52,${(0.4 * visible).toFixed(3)})`}
                strokeWidth={(150 * cue.power).toFixed(1)}
                strokeLinecap="round"
                filter={`url(#${glowId})`}
              />
              <path
                d={arcPath(from, angle, 540)}
                fill="none"
                stroke={`url(#${trailId})`}
                strokeWidth={22}
                strokeLinecap="round"
                opacity={0.9 * visible}
              />
            </g>

            {/* Motion fan. */}
            {Array.from({length: 4}, (_, ghost) => {
              const ghostAngle =
                angle - (ghost + 1) * 4.2 * (mirrored ? -1 : 1);
              const ghostAlpha = visible * 0.12 * (1 - ghost / 4);
              if (ghostAlpha <= 0.002) return null;
              return (
                <g
                  key={ghost}
                  transform={`translate(${PIVOT_X} ${PIVOT_Y}) rotate(${ghostAngle.toFixed(2)})`}
                  opacity={ghostAlpha}
                >
                  <rect
                    x={-STAFF_HALF_LENGTH}
                    y={-thickness / 2}
                    width={STAFF_HALF_LENGTH * 2}
                    height={thickness}
                    rx={thickness / 2}
                    fill={PALETTE.gold}
                  />
                </g>
              );
            })}

            {/* The bar. */}
            <g
              transform={`translate(${PIVOT_X} ${PIVOT_Y}) rotate(${angle.toFixed(2)})`}
              opacity={visible}
            >
              {/* Ink underlay for separation from the bright background. */}
              <rect
                x={-STAFF_HALF_LENGTH - 6}
                y={-thickness / 2 - 7}
                width={STAFF_HALF_LENGTH * 2 + 12}
                height={thickness + 14}
                rx={(thickness + 14) / 2}
                fill={PALETTE.ink}
                opacity={0.9}
              />
              <rect
                x={-STAFF_HALF_LENGTH}
                y={-thickness / 2}
                width={STAFF_HALF_LENGTH * 2}
                height={thickness}
                rx={thickness / 2}
                fill={`url(#${goldId})`}
              />
              {/* Gilded highlight along the top flank. */}
              <rect
                x={-STAFF_HALF_LENGTH + 8}
                y={-thickness * 0.47}
                width={STAFF_HALF_LENGTH * 2 - 16}
                height={thickness * 0.12}
                rx={thickness * 0.06}
                fill={PALETTE.paper}
                opacity={0.5}
              />
              {/* Paper-hot core: a thin filament, not a white bar. */}
              <rect
                x={-STAFF_HALF_LENGTH + 12}
                y={-thickness * 0.075}
                width={STAFF_HALF_LENGTH * 2 - 24}
                height={thickness * 0.15}
                rx={thickness * 0.075}
                fill={PALETTE.paper}
                opacity={0.92}
              />
              {/* Cinnabar end bands. */}
              {[-1, 1].map((side) => (
                <rect
                  key={side}
                  x={side * STAFF_HALF_LENGTH - (side > 0 ? 78 : 0)}
                  y={-thickness * 0.66}
                  width={78}
                  height={thickness * 1.32}
                  rx={6}
                  fill={PALETTE.cinnabar}
                  opacity={0.95}
                />
              ))}
              {/* Tip flare. */}
              <circle
                cx={STAFF_HALF_LENGTH - 40}
                cy={0}
                r={thickness * 0.9}
                fill={PALETTE.paper}
                opacity={0.5 * visible}
              />
            </g>

            {/* Sparks thrown off the leading tip. */}
            {local < sweepFrames + fadeFrames * 0.6
              ? Array.from({length: 22}, (_, spark) => {
                  const radius = 520 + hash(seed, spark) * 780;
                  const spread = (hash(seed, spark + 61) - 0.5) * 0.9;
                  const sparkAngle = ((angle + spread * 60) * Math.PI) / 180;
                  return (
                    <circle
                      key={spark}
                      cx={PIVOT_X + Math.cos(sparkAngle) * radius}
                      cy={PIVOT_Y + Math.sin(sparkAngle) * radius}
                      r={1.4 + hash(seed, spark + 23) * 4}
                      fill={hash(seed, spark + 41) > 0.45 ? PALETTE.gold : PALETTE.paper}
                      opacity={fade * (0.35 + hash(seed, spark + 7) * 0.6)}
                    />
                  );
                })
              : null}
          </g>
        );
      })}
    </svg>
  );
};

/** Arc around the pivot, in degrees. */
const arcPath = (fromDeg: number, toDeg: number, radius: number): string => {
  const from = (fromDeg * Math.PI) / 180;
  const to = (toDeg * Math.PI) / 180;
  const x0 = Math.cos(from) * radius;
  const y0 = Math.sin(from) * radius;
  const x1 = Math.cos(to) * radius;
  const y1 = Math.sin(to) * radius;
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweepFlag = toDeg > fromDeg ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
