import {FONT_STACKS} from '../config/theme';
import {clamp, ease, fbm, hash} from '../utils/math';

export interface SampledParticle {
  x: number;
  y: number;
  /** Normalised horizontal coordinate, used for left-to-right wind peeling. */
  u: number;
  alpha: number;
}

export interface OffscreenMask {
  particles: SampledParticle[];
  width: number;
  height: number;
}

/**
 * Offscreen glyph → pixel mask sampling, extracted from
 * `HUB.sampleTextParticles` / `DFS.sampleParticles`.
 *
 * The canvas is rasterised once per key and cached by callers. That is the
 * whole point: thousands of glyphs become one particle field, and later frames
 * only move points instead of re-shaping text.
 */
export const sampleTextMask = (
  text: string,
  options: {
    size?: number;
    weight?: number;
    family?: string;
    step?: number;
    vertical?: boolean;
    maxChars?: number;
  } = {},
): OffscreenMask => {
  const size = options.size ?? 96;
  const weight = options.weight ?? 500;
  const family = options.family ?? FONT_STACKS.song;
  const step = Math.max(2, options.step ?? 4);
  const vertical = options.vertical ?? false;
  const characters = Array.from(text).slice(0, options.maxChars ?? Infinity);
  const pad = 8;

  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  if (!measure) return {particles: [], width: 0, height: 0};

  measure.font = `${weight} ${size}px ${family}`;
  const glyphWidths = characters.map((character) =>
    measure.measureText(character).width,
  );
  const totalWidth = glyphWidths.reduce((sum, width) => sum + width, 0);
  const contentWidth = vertical
    ? size * 1.5
    : Math.max(size * 0.7, totalWidth);
  const contentHeight = vertical
    ? size * 1.16 * characters.length
    : size * 1.55;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(contentWidth + pad * 2);
  canvas.height = Math.ceil(contentHeight + pad * 2);
  const context = canvas.getContext('2d');
  if (!context) return {particles: [], width: 0, height: 0};

  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${weight} ${size}px ${family}`;

  if (vertical) {
    characters.forEach((character, index) => {
      context.fillText(
        character,
        canvas.width / 2,
        pad + size * 0.72 + index * size * 1.16,
      );
    });
  } else {
    let cursor = pad;
    characters.forEach((character, index) => {
      const glyphWidth = glyphWidths[index] ?? size;
      context.fillText(
        character,
        cursor + glyphWidth / 2,
        canvas.height / 2,
      );
      cursor += glyphWidth;
    });
  }

  const image = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const particles: SampledParticle[] = [];
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = image[(y * canvas.width + x) * 4 + 3] ?? 0;
      if (alpha > 120) {
        particles.push({
          x: x - pad,
          y: y - pad,
          u: x / canvas.width,
          alpha: alpha / 255,
        });
      }
    }
  }

  return {
    particles,
    width: canvas.width - pad * 2,
    height: canvas.height - pad * 2,
  };
};

export const drawWindDissolve = (
  context: CanvasRenderingContext2D,
  mask: OffscreenMask,
  x: number,
  y: number,
  options: {
    assemble?: number;
    dissolve?: number;
    wind?: number;
    seed?: number;
    color?: string;
    sizePx?: number;
    alpha?: number;
  } = {},
): void => {
  const assemble = clamp(options.assemble ?? 1);
  const dissolve = clamp(options.dissolve ?? 0);
  const wind = options.wind ?? 1;
  const seed = options.seed ?? 17;
  const color = options.color ?? '26,19,9';
  const sizePx = options.sizePx ?? 2.2;
  const overallAlpha = options.alpha ?? 1;
  const originX = x - mask.width / 2;
  const originY = y - mask.height / 2;

  context.save();
  context.fillStyle = `rgba(${color},1)`;
  for (let index = 0; index < mask.particles.length; index += 1) {
    const particle = mask.particles[index];
    if (!particle) continue;
    const r1 = hash(seed, index * 5 + 1);
    const r2 = hash(seed, index * 5 + 2);
    const r3 = hash(seed, index * 5 + 3);

    const assembleProgress = clamp((assemble - r1 * 0.5) / 0.5);
    const assembleEase = ease.outExpo(assembleProgress);
    let px = originX + particle.x + (1 - assembleEase) * (r2 - 0.5) * 380;
    let py = originY + particle.y + (1 - assembleEase) * (r3 - 0.5) * 300;

    const delay = particle.u * 0.55;
    const dissolveProgress = clamp((dissolve - delay * 0.6) / 0.45);
    const dissolveEase = ease.inCubic(dissolveProgress);
    if (dissolveEase > 0) {
      const turbulence =
        (fbm(particle.x * 0.02 + dissolve * 2, particle.y * 0.02, 3) - 0.5) * 220;
      px += dissolveEase * (200 + particle.u * 900) * wind;
      py += dissolveEase * (turbulence - 240 * particle.u) * wind;
    }

    const alpha =
      (0.25 + 0.75 * assembleEase) *
      (1 - clamp(dissolve * 1.02)) *
      overallAlpha;
    if (alpha <= 0.01) continue;

    context.globalAlpha = alpha * (0.35 + r3 * 0.65);
    const pointSize = sizePx * (0.7 + r3 * 0.8) * (1 - dissolve * 0.3);
    context.fillRect(px, py, pointSize, pointSize);
  }
  context.restore();
};
