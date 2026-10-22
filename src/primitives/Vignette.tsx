import React from 'react';
import {AbsoluteFill} from 'remotion';
import {PALETTE} from '../config/theme';

const grainSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="29" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="420" height="420" filter="url(#g)" opacity="0.55"/></svg>`;

const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(grainSvg)}")`;

export interface VignetteProps {
  strength?: number;
  grainOpacity?: number;
  warm?: boolean;
}

/**
 * Extracted from `DFS.drawGrainVignette`: a cinematic falloff plus a static,
 * baked film-grain tile. No per-frame random draw means no temporal boiling.
 */
export const Vignette: React.FC<VignetteProps> = ({
  strength = 0.68,
  grainOpacity = 0.16,
  warm = true,
}) => {
  return (
    <AbsoluteFill aria-hidden="true" style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 68% at 50% 44%, rgba(11,9,10,0) 28%, rgba(11,9,10,${(strength * 0.45).toFixed(3)}) 68%, rgba(11,9,10,${strength.toFixed(3)}) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_URL,
          backgroundSize: '420px 420px',
          opacity: grainOpacity,
          mixBlendMode: 'overlay',
        }}
      />
      {warm ? (
        <AbsoluteFill
          style={{
            background:
              'linear-gradient(180deg, rgba(252,201,52,0.035) 0%, rgba(252,201,52,0) 38%, rgba(217,48,37,0.025) 100%)',
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: `inset 0 0 260px 80px ${PALETTE.ink}`,
          opacity: 0.46,
        }}
      />
    </AbsoluteFill>
  );
};
