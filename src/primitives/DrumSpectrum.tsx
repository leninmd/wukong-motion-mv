import React from 'react';
import {staticFile} from 'remotion';
import {PALETTE} from '../config/theme';
import {SPECTRUM_SETTINGS, useStemSpectrum} from '../audio/spectrum';
import {clamp} from '../utils/math';

export interface DrumSpectrumProps {
  /** File name inside public/audio/, e.g. `drums_stem.wav`. */
  file: string;
  width?: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  opacity?: number;
  style?: React.CSSProperties;
}

/**
 * 32-band drum spectrum. Binding to the drum stem is mandatory; never pass the
 * vocal dry stem or the full mix. Falls back to a flat baseline while audio
 * metadata loads.
 */
export const DrumSpectrum: React.FC<DrumSpectrumProps> = ({
  file,
  width = 560,
  height = 120,
  barWidth = 8,
  gap = 8,
  color = PALETTE.gold,
  opacity = 0.75,
  style,
}) => {
  const amplitudes = useStemSpectrum({
    src: staticFile(`audio/${file}`),
  });
  const bars = SPECTRUM_SETTINGS.numberOfSamples;
  const usableWidth = bars * barWidth + (bars - 1) * gap;
  const scale = Math.min(1, width / usableWidth);

  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: gap * scale,
        width,
        height,
        opacity,
        ...style,
      }}
    >
      {Array.from({length: bars}, (_, index) => {
        const amplitude = clamp(amplitudes?.[index] ?? 0);
        const active = amplitude > 0.015;
        return (
          <div
            key={index}
            style={{
              width: barWidth * scale,
              height: Math.max(2, amplitude * height),
              backgroundColor: color,
              opacity: active ? 0.35 + amplitude * 0.65 : 0.14,
              transform: `scaleY(${active ? 1 : 0.08})`,
              transformOrigin: '50% 100%',
            }}
          />
        );
      })}
    </div>
  );
};
