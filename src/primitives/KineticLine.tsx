import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACKS, PALETTE} from '../config/theme';
import type {AlignmentUnit} from '../utils/alignment';
import {clamp, ease} from '../utils/math';

export interface KineticLineProps {
  units: readonly AlignmentUnit[];
  fontSize?: number;
  width?: number;
  height?: number;
  /** 0–1 drum accent, thickens the underline and the active glow. */
  bass?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

interface GlyphLayout {
  char: string;
  x: number;
  width: number;
  start: number;
  end: number;
}

/**
 * Karaoke line rendered in ONE canvas.
 *
 * The constitution forbids one DOM node per hanzi, and splitting a line into 10
 * absolutely-positioned spans also destroys CJK shaping. A single canvas keeps
 * the line shaped as a line while still allowing per-character fill, scale and
 * glow — the animation is driven by the aligned seconds, never by frame stamps.
 */
export const KineticLine: React.FC<KineticLineProps> = ({
  units,
  fontSize = 64,
  width = 1920,
  height = 170,
  bass = 0,
  opacity = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeSeconds = frame / fps;

  const layout = useMemo<GlyphLayout[]>(() => {
    if (typeof document === 'undefined') return [];
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return [];
    context.font = `900 ${fontSize}px ${FONT_STACKS.heavy}`;
    const spacing = fontSize * 0.075;
    const widths = units.map((unit) => context.measureText(unit.text).width);
    const total = widths.reduce((sum, value) => sum + value, 0) + spacing * Math.max(0, units.length - 1);
    let cursor = (width - total) / 2;
    return units.map((unit, index) => {
      const glyphWidth = widths[index] ?? fontSize;
      const entry: GlyphLayout = {
        char: unit.text,
        x: cursor,
        width: glyphWidth,
        start: unit.start,
        end: unit.end,
      };
      cursor += glyphWidth + spacing;
      return entry;
    });
  }, [fontSize, units, width]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.textBaseline = 'alphabetic';
    context.font = `900 ${fontSize}px ${FONT_STACKS.heavy}`;
    context.lineJoin = 'round';

    const baseline = height - fontSize * 0.42;
    const lineStart = units[0]?.start ?? 0;
    const lineEnd = units[units.length - 1]?.end ?? lineStart + 1;
    const progress = clamp((timeSeconds - lineStart) / Math.max(0.001, lineEnd - lineStart));

    for (const glyph of layout) {
      const active = timeSeconds >= glyph.start && timeSeconds < glyph.end;
      const done = timeSeconds >= glyph.end;
      const lift = active ? -fontSize * 0.045 : 0;
      const scale = active ? 1.12 : 1;

      context.save();
      context.translate(glyph.x + glyph.width / 2, baseline + lift);
      context.scale(scale, scale);

      // Ink keyline keeps the line legible over a white flash.
      context.lineWidth = Math.max(5, fontSize * 0.17);
      context.strokeStyle = 'rgba(11,9,10,0.96)';
      context.strokeText(glyph.char, -glyph.width / 2, 0);

      if (active) {
        context.shadowColor = PALETTE.cinnabar;
        context.shadowBlur = 26 + bass * 18;
        context.fillStyle = PALETTE.paper;
      } else if (done) {
        context.shadowColor = 'rgba(252,201,52,0.55)';
        context.shadowBlur = 12;
        context.fillStyle = PALETTE.gold;
      } else {
        context.shadowBlur = 0;
        context.fillStyle = 'rgba(244,239,230,0.46)';
      }
      context.fillText(glyph.char, -glyph.width / 2, 0);
      context.restore();

      if (active) {
        // Cinnabar tick under the live character.
        const tickWidth = glyph.width * 1.05;
        const gradient = context.createLinearGradient(
          glyph.x - 8,
          0,
          glyph.x + tickWidth,
          0,
        );
        gradient.addColorStop(0, 'rgba(217,48,37,0)');
        gradient.addColorStop(0.5, PALETTE.cinnabar);
        gradient.addColorStop(1, 'rgba(217,48,37,0)');
        context.fillStyle = gradient;
        context.fillRect(glyph.x - 8, baseline + 14, tickWidth, 3 + bass * 3);
      }
    }

    // Line progress rail.
    const railY = baseline + 26;
    const railWidth = width * 0.34;
    const railX = (width - railWidth) / 2;
    context.fillStyle = 'rgba(244,239,230,0.14)';
    context.fillRect(railX, railY, railWidth, 1.5);
    context.fillStyle = `rgba(252,201,52,${(0.5 + bass * 0.4).toFixed(3)})`;
    context.fillRect(railX, railY, railWidth * ease.outCubic(progress), 1.5);
  }, [bass, fontSize, height, layout, timeSeconds, units, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height,
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};
