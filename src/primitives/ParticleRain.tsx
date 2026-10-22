import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CANVAS, PALETTE} from '../config/theme';
import {clamp, hash, lerp} from '../utils/math';

export type ParticleRainVariant = 'ember' | 'ash' | 'ink';

export interface ParticleRainProps {
  variant?: ParticleRainVariant;
  count?: number;
  seed?: number;
  speed?: number;
  opacity?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

interface ParticleStyle {
  color: string;
  core: string;
  additive: boolean;
  fallSpeed: number;
  drift: number;
  size: [number, number];
}

const STYLES: Record<ParticleRainVariant, ParticleStyle> = {
  ember: {
    color: PALETTE.gold,
    core: '#FFF4C7',
    additive: true,
    fallSpeed: 0.52,
    drift: 18,
    size: [0.8, 2.9],
  },
  ash: {
    color: 'rgba(196, 186, 168, 0.72)',
    core: 'rgba(244, 239, 230, 0.75)',
    additive: false,
    fallSpeed: 0.78,
    drift: 34,
    size: [0.7, 2.4],
  },
  ink: {
    color: 'rgba(34, 26, 20, 0.55)',
    core: 'rgba(18, 13, 9, 0.55)',
    additive: false,
    fallSpeed: 1,
    drift: 28,
    size: [0.8, 2.2],
  },
};

const drawRain = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSeconds: number,
  variant: ParticleRainVariant,
  count: number,
  seed: number,
  speedMultiplier: number,
  overallOpacity: number,
): void => {
  const style = STYLES[variant];
  context.clearRect(0, 0, width, height);
  context.save();
  context.globalCompositeOperation = style.additive ? 'lighter' : 'source-over';

  const spanX = width * 1.3;
  const spanY = height * 1.25;
  const baseSpeed = style.fallSpeed * height * speedMultiplier;

  for (let index = 0; index < count; index += 1) {
    const r1 = hash(seed, index * 5 + 1);
    const r2 = hash(seed, index * 5 + 2);
    const r3 = hash(seed, index * 5 + 3);
    const r4 = hash(seed, index * 5 + 4);
    const phase = hash(seed, index * 5 + 5) * Math.PI * 2;
    const localSpeed = baseSpeed * (0.45 + r3 * 1.05);

    let x = r1 * spanX - width * 0.15;
    let y: number;

    if (variant === 'ember') {
      y =
        height * 0.99 -
        ((r2 * spanY + timeSeconds * localSpeed) % spanY);
      x += Math.sin(timeSeconds * 0.42 + phase) * style.drift * (0.4 + r4);
    } else {
      y =
        ((r2 * spanY + timeSeconds * localSpeed) % spanY) -
        height * 0.12;
      x +=
        timeSeconds * style.drift * (0.3 + r4 * 0.6) +
        Math.sin(timeSeconds * 0.35 + phase) * 7;
    }

    // Soft vertical fade at both edges keeps wrapped particles from popping.
    const edgeFade =
      Math.min(1, clamp(y / (height * 0.08)), clamp((height - y) / (height * 0.08)));
    const flicker =
      variant === 'ember'
        ? 0.5 + 0.5 * Math.sin(timeSeconds * (3.2 + r4 * 3.5) + phase)
        : 0.62 + 0.38 * Math.sin(timeSeconds * 1.2 + phase);
    const alpha =
      overallOpacity *
      edgeFade *
      (0.16 + r4 * 0.58) *
      (variant === 'ember' ? 0.4 + flicker * 0.6 : 0.78 + flicker * 0.22);
    if (alpha <= 0.005) continue;

    const radius = lerp(style.size[0], style.size[1], r4);

    if (variant === 'ember') {
      context.globalAlpha = alpha * 0.14;
      context.fillStyle = style.color;
      context.beginPath();
      context.arc(x, y, radius * 4.8, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = alpha;
    context.fillStyle = r4 > 0.82 ? style.core : style.color;
    if (variant === 'ash') {
      // Ash is a flake, not a bokeh ball.
      context.fillRect(x, y, radius * 1.5, radius * 0.7);
    } else {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.restore();
};

/**
 * Deterministic particle rain / furnace ash field extracted from
 * `DFS.Rain`, `V3.aerosol`, and the offscreen wind-dissolve particle logic.
 *
 * Uses a single canvas. On a paper scene use the `ink` variant; on the furnace
 * / demon-conquest scenes use `ember` and `ash` in separate layers.
 */
export const ParticleRain: React.FC<ParticleRainProps> = ({
  variant = 'ember',
  count = 240,
  seed = 8801,
  speed = 1,
  opacity = 0.8,
  width = CANVAS.width,
  height = CANVAS.height,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    drawRain(
      context,
      canvas.width,
      canvas.height,
      frame / fps,
      variant,
      count,
      seed,
      speed,
      opacity,
    );
  }, [count, fps, frame, height, opacity, seed, speed, variant, width]);

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
