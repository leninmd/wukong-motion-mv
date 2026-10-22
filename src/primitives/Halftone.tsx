import React, {useLayoutEffect, useRef} from 'react';

export interface HalftoneProps {
  /** Dot pitch in px. */
  pitch?: number;
  opacity?: number;
  /** Second, coarser dot field that reads as foil grain. */
  coarse?: boolean;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

const makeDotPattern = (
  context: CanvasRenderingContext2D,
  step: number,
  radius: number,
  color: string,
): CanvasPattern | null => {
  const tile = document.createElement('canvas');
  tile.width = Math.max(2, Math.round(step * 2));
  tile.height = tile.width;
  const t = tile.getContext('2d');
  if (!t) return null;
  t.fillStyle = color;
  for (const [x, y] of [
    [0, 0],
    [step, step],
    [step * 2, 0],
    [0, step * 2],
  ]) {
    t.beginPath();
    t.arc(x, y, radius, 0, Math.PI * 2);
    t.fill();
  }
  return context.createPattern(tile, 'repeat');
};

/**
 * 半调网点 / 烫金颗粒.
 *
 * Printed-poster texture, baked once into a canvas with two repeating dot
 * patterns (a fine paper screen and a coarse gold foil grain) plus a radial
 * falloff, then screened over the art. Cheap way to make a flat render look
 * like it came off a press.
 */
export const Halftone: React.FC<HalftoneProps> = ({
  pitch = 6.5,
  opacity = 0.6,
  coarse = true,
  width = 1920,
  height = 1080,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);

    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(Math.PI / 4);
    const fine = makeDotPattern(context, pitch, pitch * 0.2, 'rgba(244,239,230,0.07)');
    if (fine) {
      context.fillStyle = fine;
      context.fillRect(-width, -height, width * 2, height * 2);
    }
    context.restore();

    if (coarse) {
      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(-Math.PI / 6);
      const grain = makeDotPattern(context, pitch * 3.2, pitch * 0.62, 'rgba(252,201,52,0.05)');
      if (grain) {
        context.fillStyle = grain;
        context.fillRect(-width, -height, width * 2, height * 2);
      }
      context.restore();
    }

    const mask = context.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.24,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.66,
    );
    mask.addColorStop(0, 'rgba(0,0,0,0.4)');
    mask.addColorStop(1, 'rgba(0,0,0,1)');
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = mask;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'source-over';
  }, [coarse, height, pitch, width]);

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
        opacity,
        ...style,
      }}
    />
  );
};
