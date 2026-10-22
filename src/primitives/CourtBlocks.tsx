import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE} from '../config/theme';
import {clamp, ease, hash} from '../utils/math';
import {frameFromSeconds} from '../utils/timing';
import {
  bakeRigidTextCollapse,
  type RigidCharSpec,
  type RigidPose,
} from './rigidBody';

export interface CourtBlocksProps {
  /** Seconds when the formation starts rising out of the dark. */
  assembleSeconds: number;
  /** Seconds when the formation is hit and starts to collapse. */
  releaseSeconds: number;
  seed?: number;
  opacity?: number;
  /** Perspective floor grid that sells the "heavenly court" depth. */
  gridOpacity?: number;
  /** 0–1 accent from the drum bus; pulses the gold edges. */
  pulse?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

interface Row {
  y: number;
  size: number;
  gap: number;
  /** Ranks per side of the central aisle. */
  count: number;
  /** Half-width of the aisle at this depth. */
  corridor: number;
}

/**
 * Receding rows: the front rank is huge, the back rank is a thin line at the
 * horizon. Reads as an army of identical heavenly soldiers rather than a pile
 * of squares.
 */
const ROWS: Row[] = [
  {y: 604, size: 34, gap: 62, count: 6, corridor: 66},
  {y: 668, size: 48, gap: 84, count: 5, corridor: 122},
  {y: 746, size: 66, gap: 112, count: 4, corridor: 196},
  {y: 846, size: 92, gap: 154, count: 3, corridor: 292},
  {y: 966, size: 124, gap: 206, count: 2, corridor: 410},
];

/**
 * Foreground ranks: oversized, cropped by the frame edge. They are what makes
 * the army feel like it surrounds the camera instead of standing behind glass.
 */
const FOREGROUND: Array<{x: number; y: number; size: number}> = [
  {x: 44, y: 964, size: 210},
  {x: 1876, y: 964, size: 210},
  {x: 366, y: 1082, size: 150},
  {x: 1554, y: 1082, size: 150},
];

const CENTER_X = 960;
const HORIZON_Y = 286;

const buildBodies = (seed: number): RigidCharSpec[] => {
  const bodies: RigidCharSpec[] = [];
  FOREGROUND.forEach((block, rank) => {
    const index = bodies.length;
    bodies.push({
      char: '',
      x: block.x,
      y: block.y,
      width: block.size,
      height: block.size,
      fontSize: block.size,
      color: PALETTE.paper,
      weight: 400,
      family: 'sans-serif',
      releaseAtSeconds: 0,
      vx: (hash(seed, index * 3 + 2) - 0.5) * 320,
      vy: -(60 + hash(seed, index * 3 + 3) * 220),
      angularVelocity: (hash(seed, index * 5 + 4) - 0.5) * 3.4,
      restitution: 0.24 + hash(seed, index * 7 + 5) * 0.2,
    });
    void rank;
  });

  ROWS.forEach((row) => {
    // Two ranks flanking a central aisle: an army, not a wallpaper grid.
    for (const side of [-1, 1] as const) {
      for (let column = 0; column < row.count; column += 1) {
        const index = bodies.length;
        const x = CENTER_X + side * (row.corridor + column * row.gap);
        const jitter = (hash(seed, index * 3 + 1) - 0.5) * 8;
        bodies.push({
          char: '',
          x: x + jitter,
          y: row.y + (hash(seed, index * 13 + 8) - 0.5) * (4 + row.size * 0.1),
          width: row.size * (0.88 + hash(seed, index * 11 + 6) * 0.14),
          height: row.size * (0.88 + hash(seed, index * 11 + 7) * 0.14),
          fontSize: row.size,
          color: PALETTE.paper,
          weight: 400,
          family: 'sans-serif',
          // The formation is released rank by rank, then the whole court falls.
          releaseAtSeconds: 0,
          vx: (hash(seed, index * 3 + 2) - 0.5) * 260,
          vy: -(40 + hash(seed, index * 3 + 3) * 180),
          angularVelocity: (hash(seed, index * 5 + 4) - 0.5) * 2.4,
          restitution: 0.2 + hash(seed, index * 7 + 5) * 0.18,
        });
      }
    }
  });
  return bodies;
};

const drawGrid = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  alpha: number,
) => {
  if (alpha <= 0.002) return;
  context.save();
  context.lineWidth = 1;
  // Radiating floor lines.
  for (let index = -9; index <= 9; index += 1) {
    const farX = CENTER_X + index * 34;
    const nearX = CENTER_X + index * 330;
    const gradient = context.createLinearGradient(0, HORIZON_Y, 0, height);
    gradient.addColorStop(0, `rgba(252,201,52,${(alpha * 0.02).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(252,201,52,${(alpha * 0.16).toFixed(3)})`);
    context.strokeStyle = gradient;
    context.beginPath();
    context.moveTo(farX, HORIZON_Y);
    context.lineTo(nearX, height);
    context.stroke();
  }
  // Perspective horizontals.
  for (let index = 0; index < 11; index += 1) {
    const t = (index + 1) / 11;
    const y = HORIZON_Y + (height - HORIZON_Y) * t * t;
    context.strokeStyle = `rgba(244,239,230,${(alpha * 0.1 * (1 - t * 0.65)).toFixed(3)})`;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  // Horizon haze.
  const haze = context.createRadialGradient(
    CENTER_X,
    HORIZON_Y,
    10,
    CENTER_X,
    HORIZON_Y,
    720,
  );
  haze.addColorStop(0, `rgba(252,201,52,${(alpha * 0.5).toFixed(3)})`);
  haze.addColorStop(0.35, `rgba(217,48,37,${(alpha * 0.1).toFixed(3)})`);
  haze.addColorStop(1, 'rgba(11,9,10,0)');
  context.fillStyle = haze;
  context.fillRect(0, 0, width, height);
  context.restore();
};

/**
 * The order formation from the heavenly court shot.
 *
 * Per-block release is baked up front by `bakeRigidTextCollapse()`, so the
 * whole 300-frame collapse is a table lookup at render time. Before release the
 * blocks rise from the floor with a deterministic stagger; after release the
 * baked gravity + AABB collisions take over and the court literally falls apart.
 */
export const CourtBlocks: React.FC<CourtBlocksProps> = ({
  assembleSeconds,
  releaseSeconds,
  seed = 7301,
  opacity = 1,
  gridOpacity = 1,
  pulse = 0,
  width = 1920,
  height = 1080,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const bodies = useMemo(() => buildBodies(seed), [seed]);
  const table = useMemo(
    () =>
      bakeRigidTextCollapse(bodies, {
        fps,
        durationInFrames,
        gravity: 2850,
        floorY: height + 30,
        restitution: 0.24,
        wallLeft: 40,
        wallRight: width - 40,
      }),
    [bodies, durationInFrames, fps, height, width],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (opacity <= 0.002) return;

    const timeSeconds = frame / fps;
    const releaseFrame = frameFromSeconds(releaseSeconds, fps);
    const poses = table[Math.min(frame, table.length - 1)] ?? [];
    const collapsed = frame >= releaseFrame;

    context.save();
    context.globalAlpha = opacity;
    drawGrid(context, width, height, gridOpacity);
    context.globalCompositeOperation = 'source-over';

    for (let index = 0; index < bodies.length; index += 1) {
      const body = bodies[index];
      if (!body) continue;
      const pose: RigidPose = collapsed
        ? poses[index] ?? {x: body.x, y: body.y, angle: 0}
        : {x: body.x, y: body.y, angle: 0};

      const local = (timeSeconds - assembleSeconds - index * 0.012) / 0.5;
      const rise = 1 - ease.outQuint(clamp(local));
      const scale = 0.55 + 0.45 * (1 - rise);

      const drawX = pose.x;
      // Assembly offset only applies while the block is still static.
      const drawY = pose.y + (collapsed ? 0 : rise * 66);
      const flicker = 0.72 + 0.28 * Math.sin(timeSeconds * 3.1 + index * 0.7);
      // Atmospheric perspective: the back ranks sink into the haze.
      const depthFade = 0.4 + 0.6 * clamp((body.y - 200) / 720);
      const alpha = clamp((1 - rise) * 0.95 + 0.05) * flicker * depthFade;

      const size = body.width * scale;
      const half = size / 2;

      context.save();
      context.translate(drawX, drawY);
      context.rotate(pose.angle);
      context.globalAlpha = opacity * alpha;

      // Body: a stone slab with three tonal bands, not a glass frame.
      const mass = clamp((body.fontSize - 60) / 200);
      const base = 16 + Math.round(26 * mass);
      context.fillStyle = `rgba(${base + 14},${base + 10},${base + 9},${(0.98 * alpha).toFixed(3)})`;
      context.fillRect(-half, -half, size, size);
      context.fillStyle = `rgba(6,5,6,${(0.72 * alpha).toFixed(3)})`;
      context.fillRect(-half, -half + size * 0.34, size, size * 0.66);
      // lit top face
      context.fillStyle = `rgba(244,239,230,${(0.1 + pulse * 0.08 + mass * 0.06).toFixed(3)})`;
      context.fillRect(-half, -half, size, size * 0.2);
      context.fillStyle = `rgba(244,239,230,${(0.34 + pulse * 0.3).toFixed(3)})`;
      context.fillRect(-half, -half, size, Math.max(1.5, size * 0.055));
      // gilded seam + shadow side
      context.strokeStyle = `rgba(252,201,52,${(0.26 + pulse * 0.4).toFixed(3)})`;
      context.lineWidth = Math.max(1, size * 0.022);
      context.strokeRect(-half, -half, size, size);
      context.fillStyle = `rgba(0,0,0,${(0.45 * alpha).toFixed(3)})`;
      context.fillRect(half - size * 0.2, -half + size * 0.2, size * 0.2, size * 0.8);

      // Front ranks raise a spear shaft: texture for the army, not an arrow.
      if (body.fontSize >= 74) {
        context.strokeStyle = `rgba(252,201,52,${(0.12 + pulse * 0.2).toFixed(3)})`;
        context.lineWidth = Math.max(1, size * 0.018);
        context.beginPath();
        context.moveTo(half * 0.62, -half);
        context.lineTo(half * 0.62, -half - size * 1.45);
        context.stroke();
      }

      // Every fourth block carries a cinnabar tally: a war banner.
      if ((index + 3) % 4 === 0) {
        context.fillStyle = `rgba(217,48,37,${(0.34 + pulse * 0.4).toFixed(3)})`;
        context.fillRect(-half + size * 0.32, -half + size * 0.18, size * 0.1, size * 0.64);
      }
      context.restore();
    }

    context.restore();
  }, [
    assembleSeconds,
    bodies,
    fps,
    frame,
    gridOpacity,
    height,
    opacity,
    pulse,
    releaseSeconds,
    table,
    width,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};
