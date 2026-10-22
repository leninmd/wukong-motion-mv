import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE} from '../config/theme';
import {clamp, hash} from '../utils/math';

export interface RadialBurstProps {
  /** 0–1 accent. Zero hides the layer completely. */
  intensity?: number;
  seed?: number;
  /** Canvas centre in pixels. */
  cx?: number;
  cy?: number;
  lines?: number;
  color?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

/**
 * 术力口 radial burst: speed rays + concentric rings behind the hero glyphs.
 *
 * A single canvas, deterministic lengths from `hash(seed, i)`, and no per-frame
 * allocation beyond the draw calls. `intensity` is fed by the drum spectrum, so
 * the rays breathe with the kick instead of looping on a fixed cycle.
 */
export const RadialBurst: React.FC<RadialBurstProps> = ({
  intensity = 0,
  seed = 5501,
  cx = 960,
  cy = 470,
  lines = 84,
  color = PALETTE.gold,
  width = 1920,
  height = 1080,
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
    context.clearRect(0, 0, width, height);
    const strength = clamp(intensity);
    if (strength <= 0.004) return;

    const timeSeconds = frame / fps;
    const rotation = timeSeconds * 0.16;
    const inner = 210 + strength * 90;

    context.save();
    context.translate(cx, cy);
    context.globalCompositeOperation = 'lighter';

    for (let index = 0; index < lines; index += 1) {
      const baseAngle = (index / lines) * Math.PI * 2 + rotation;
      const jitter = (hash(seed, index) - 0.5) * 0.05;
      const angle = baseAngle + jitter;
      const length = (240 + hash(seed, index + 97) * 780) * (0.5 + strength * 0.9);
      const innerRadius = inner + hash(seed, index + 211) * 120;
      const alpha =
        strength * (0.05 + hash(seed, index + 311) * 0.16) * (index % 3 === 0 ? 1.5 : 1);
      context.strokeStyle = color;
      context.globalAlpha = clamp(alpha);
      context.lineWidth = index % 5 === 0 ? 3.2 : 1.1;
      context.beginPath();
      context.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
      context.lineTo(Math.cos(angle) * (innerRadius + length), Math.sin(angle) * (innerRadius + length));
      context.stroke();
    }

    // Concentric impact rings.
    for (let ring = 0; ring < 4; ring += 1) {
      const radius = inner + ring * (86 + strength * 60) + strength * 40;
      context.globalAlpha = clamp(strength * (0.22 - ring * 0.045));
      context.strokeStyle = ring % 2 === 0 ? color : PALETTE.cinnabar;
      context.lineWidth = ring === 0 ? 2.4 : 1.2;
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
    }

    // Hot core.
    const core = context.createRadialGradient(0, 0, 10, 0, 0, inner * 0.95);
    core.addColorStop(0, `rgba(244,239,230,${(0.3 * strength).toFixed(3)})`);
    core.addColorStop(0.35, `rgba(252,201,52,${(0.14 * strength).toFixed(3)})`);
    core.addColorStop(1, 'rgba(11,9,10,0)');
    context.globalAlpha = 1;
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, inner, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }, [color, cx, cy, fps, frame, height, intensity, lines, seed, width]);

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
        mixBlendMode: 'screen',
        ...style,
      }}
    />
  );
};
