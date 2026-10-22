import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CANVAS, FONT_STACKS} from '../config/theme';
import {
  bakeRigidTextCollapse,
  createRigidTextBodies,
  type RigidCharSpec,
} from './rigidBody';

export interface RigidTextCollapseProps {
  text: string;
  fontSize?: number;
  columns?: number;
  originX?: number;
  originY?: number;
  releaseAtSeconds?: number;
  staggerSeconds?: number;
  seed?: number;
  color?: string;
  gravity?: number;
  floorY?: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

interface PreparedBake {
  bodies: RigidCharSpec[];
  table: ReturnType<typeof bakeRigidTextCollapse>;
}

/**
 * Canvas renderer for the pre-baked rigid text table. It never creates one DOM
 * node per glyph and never animates `opacity` on characters.
 */
export const RigidTextCollapse: React.FC<RigidTextCollapseProps> = ({
  text,
  fontSize = 88,
  columns = 6,
  originX = CANVAS.width / 2,
  originY = 430,
  releaseAtSeconds = 1.2,
  staggerSeconds = 0.035,
  seed = 9137,
  color = 'rgba(244,239,230,0.94)',
  gravity = 2600,
  floorY = CANVAS.height - 40,
  width = CANVAS.width,
  height = CANVAS.height,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const baked = useMemo<PreparedBake>(() => {
    const bodies = createRigidTextBodies(text, {
      originX,
      originY,
      fontSize,
      columns,
      releaseAtSeconds,
      staggerSeconds,
      seed,
      color,
      family: FONT_STACKS.heavy,
    });
    return {
      bodies,
      table: bakeRigidTextCollapse(bodies, {
        fps,
        durationInFrames,
        floorY,
        gravity,
      }),
    };
  }, [
    color,
    columns,
    durationInFrames,
    floorY,
    fontSize,
    fps,
    gravity,
    originX,
    originY,
    releaseAtSeconds,
    seed,
    staggerSeconds,
    text,
  ]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const poses = baked.table[Math.min(frame, baked.table.length - 1)];
    if (!poses) return;

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let index = 0; index < baked.bodies.length; index += 1) {
      const body = baked.bodies[index];
      const pose = poses[index];
      if (!body || !pose) continue;
      context.save();
      context.translate(pose.x, pose.y);
      context.rotate(pose.angle);
      context.font = `${body.weight} ${body.fontSize}px ${body.family}`;
      context.fillStyle = body.color;
      context.fillText(body.char, 0, 0);
      context.restore();
    }
    context.restore();
  }, [baked, frame]);

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
        ...style,
      }}
    />
  );
};
