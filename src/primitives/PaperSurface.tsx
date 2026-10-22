import React, {useLayoutEffect, useRef} from 'react';
import {CANVAS} from '../config/theme';
import {paintPaperTexture, type PaperVariant} from './paperTexture';

export interface PaperSurfaceProps {
  width?: number;
  height?: number;
  seed?: number;
  variant?: PaperVariant;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Static xuan-paper/lacquer substrate. The expensive bake runs once; Remotion
 * only composites the cached bitmap on subsequent frames.
 */
export const PaperSurface: React.FC<PaperSurfaceProps> = ({
  width = CANVAS.width,
  height = CANVAS.height,
  seed = 7103,
  variant = 'ink',
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    paintPaperTexture(context, canvas.width, canvas.height, {seed, variant});
  }, [height, seed, variant, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
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
