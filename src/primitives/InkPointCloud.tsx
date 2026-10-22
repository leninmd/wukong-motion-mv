import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CANVAS, PALETTE} from '../config/theme';
import {clamp, lerp} from '../utils/math';
import {
  createPointCloud,
  projectPoint3D,
  type CloudParticle,
  type PointCloudOptions,
} from './pointCloud';

export interface InkPointCloudProps extends PointCloudOptions {
  width?: number;
  height?: number;
  color?: string;
  accentColor?: string;
  opacity?: number;
  style?: React.CSSProperties;
}

const drawCloud = (
  context: CanvasRenderingContext2D,
  particles: CloudParticle[],
  width: number,
  height: number,
  timeSeconds: number,
  color: string,
  accentColor: string,
  opacity: number,
): void => {
  context.clearRect(0, 0, width, height);
  context.save();
  context.globalCompositeOperation = 'lighter';

  const yaw = timeSeconds * 0.055 - 0.45;
  const pitch = -0.24 + Math.sin(timeSeconds * 0.17) * 0.035;
  const camera = {
    width,
    height,
    yaw,
    pitch,
    distance: 8.8,
    fov: 0.9,
    centerX: width * 0.51,
    centerY: height * 0.48,
  };

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    if (!particle) continue;
    const bob = Math.sin(timeSeconds * 0.32 + particle.phase) * 0.035;
    const projected = projectPoint3D(
      {x: particle.x, y: particle.y + bob, z: particle.z},
      camera,
    );
    if (!projected) continue;
    if (
      projected.x < -120 ||
      projected.x > width + 120 ||
      projected.y < -120 ||
      projected.y > height + 120
    ) {
      continue;
    }

    const depthFade = clamp(1.16 - projected.depth / 18);
    const twinkle =
      0.64 + 0.36 * Math.sin(timeSeconds * 1.35 + particle.phase * 2.7);
    const alpha =
      opacity * (0.12 + depthFade * 0.62) * twinkle * (0.38 + particle.warmth * 0.62);
    if (alpha <= 0.004) continue;

    const size = Math.max(0.55, particle.radius * projected.scale);
    const useAccent = particle.spark || particle.warmth > 0.86;
    context.globalAlpha = alpha;
    context.fillStyle = useAccent ? accentColor : color;

    if (useAccent) {
      context.beginPath();
      context.arc(
        projected.x,
        projected.y,
        size * (1.6 + Math.sin(timeSeconds * 2.1 + particle.phase) * 0.3),
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      const stretch = lerp(0.7, 1.9, clamp(projected.depth / 12));
      context.fillRect(
        projected.x - size * 0.5,
        projected.y - size * stretch * 0.5,
        size,
        size * stretch,
      );
    }
  }

  context.restore();
};

/**
 * Gold-ink dust field. This is the Remotion equivalent of the original 3D ink
 * point cloud, with the palette swapped for furnace sparks on lacquer black.
 */
export const InkPointCloud: React.FC<InkPointCloudProps> = ({
  width = CANVAS.width,
  height = CANVAS.height,
  count = 2600,
  seed = 60613,
  spread = 3.4,
  flatten = 0.34,
  arms = 3,
  color = PALETTE.paper,
  accentColor = PALETTE.gold,
  opacity = 0.9,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(
    () => createPointCloud({count, seed, spread, flatten, arms}),
    [arms, count, flatten, seed, spread],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    drawCloud(
      context,
      particles,
      canvas.width,
      canvas.height,
      frame / fps,
      color,
      accentColor,
      opacity,
    );
  }, [accentColor, color, fps, frame, opacity, particles]);

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
