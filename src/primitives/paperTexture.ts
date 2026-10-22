import {fbm, rng} from '../utils/math';

export type PaperVariant = 'paper' | 'ink';

export interface PaperTextureOptions {
  seed?: number;
  variant?: PaperVariant;
}

/**
 * Pure canvas painter extracted from `engine/layers.js` (paper / grain) and
 * `engine/v3/paper-fluid.js` (mulberry paper, fibre direction, laid lines).
 *
 * It bakes once per canvas, not once per frame. All randomness is seeded, so
 * every rerender and every worker produces an identical sheet.
 */
export const paintPaperTexture = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: PaperTextureOptions = {},
): void => {
  const {seed = 7103, variant = 'paper'} = options;
  const inkMode = variant === 'ink';
  const random = rng(seed);

  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // L1 — fibrous base with a soft centre and darkened deckle edges.
  const base = ctx.createRadialGradient(
    width * 0.47,
    height * 0.42,
    height * 0.08,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.82,
  );
  if (inkMode) {
    base.addColorStop(0, '#1C1514');
    base.addColorStop(0.48, '#120E0F');
    base.addColorStop(1, '#0B090A');
  } else {
    base.addColorStop(0, '#F4EFE6');
    base.addColorStop(0.52, '#E8DCC8');
    base.addColorStop(1, '#CDBEA6');
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // L2 — low-resolution fBm cloud fibre, composited as soft light.
  const textureWidth = Math.max(240, Math.min(480, Math.round(width / 4)));
  const textureHeight = Math.max(
    135,
    Math.round((textureWidth * height) / width),
  );
  const lowRes = document.createElement('canvas');
  lowRes.width = textureWidth;
  lowRes.height = textureHeight;
  const lowCtx = lowRes.getContext('2d');

  if (lowCtx) {
    const image = lowCtx.createImageData(textureWidth, textureHeight);
    const data = image.data;
    for (let y = 0; y < textureHeight; y += 1) {
      for (let x = 0; x < textureWidth; x += 1) {
        const offset = (y * textureWidth + x) * 4;
        const broad = fbm(x * 0.045, y * 0.045, 4, 2.1, 0.55);
        const fine = fbm(x * 0.23 + 37.1, y * 0.23 + 8.3, 3, 2, 0.5);
        const value = (broad - 0.5) * 28 + (fine - 0.5) * 12;
        data[offset] = (inkMode ? 118 : 124) + value;
        data[offset + 1] = (inkMode ? 102 : 108) + value;
        data[offset + 2] = (inkMode ? 84 : 84) + value * 0.9;
        data[offset + 3] = 255;
      }
    }
    lowCtx.putImageData(image, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = inkMode ? 0.46 : 0.38;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(lowRes, 0, 0, width, height);
    ctx.restore();
  }

  // L3 — directional fibres. Mulberry paper is mostly horizontal, with a
  // minority of vertical strands from the couching process.
  const fibreCount = inkMode ? 2100 : 2800;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < fibreCount; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const horizontal = random() > 0.18;
    const length = horizontal ? 10 + random() * 180 : 7 + random() * 56;
    const alpha = (inkMode ? 0.012 : 0.018) + random() * (inkMode ? 0.045 : 0.038);
    const warm = random();
    ctx.strokeStyle =
      warm > 0.52
        ? `rgba(80, 62, 42, ${alpha})`
        : `rgba(255, 249, 232, ${alpha * 1.5})`;
    ctx.lineWidth = 0.35 + random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (horizontal) {
      ctx.lineTo(x + length, y + (random() - 0.5) * 1.8);
    } else {
      ctx.lineTo(x + (random() - 0.5) * 3.2, y + length);
    }
    ctx.stroke();
  }

  // L4 — impurities / mineral flecks.
  const speckCount = inkMode ? 1300 : 1700;
  for (let i = 0; i < speckCount; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const alpha = 0.015 + random() * (inkMode ? 0.07 : 0.05);
    ctx.fillStyle =
      random() > 0.18
        ? `rgba(58, 43, 30, ${alpha})`
        : `rgba(252, 201, 52, ${alpha * 0.6})`;
    const size = 0.6 + random() * (inkMode ? 2.2 : 1.6);
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  // L5 — laid lines and a few soft handling creases. On the dark variant this
  // becomes a barely perceptible lacquer sheen instead of a grey wash.
  ctx.save();
  ctx.globalCompositeOperation = inkMode ? 'soft-light' : 'multiply';
  const laidGap = inkMode ? 34 : 27;
  for (let y = random() * 12; y < height; y += laidGap + random() * 4) {
    ctx.fillStyle = inkMode
      ? 'rgba(244, 239, 230, 0.018)'
      : 'rgba(78, 61, 41, 0.045)';
    ctx.fillRect(0, y, width, 0.7);
  }

  for (let i = 0; i < 3; i += 1) {
    const y = height * (0.2 + i * 0.31) + (random() - 0.5) * 50;
    const crease = ctx.createLinearGradient(0, y - 28, 0, y + 28);
    crease.addColorStop(0, 'rgba(255,255,255,0)');
    crease.addColorStop(
      0.5,
      inkMode
        ? `rgba(244, 239, 230, ${0.015 + random() * 0.012})`
        : `rgba(138, 118, 91, ${0.025 + random() * 0.018})`,
    );
    crease.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = crease;
    ctx.fillRect(0, y - 28, width, 56);
  }
  ctx.restore();

  // L6 — a restrained hand-made edge burn, never a symmetrical Photoshop
  // vignette. The final Vignette component adds the cinematic falloff.
  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, inkMode ? 'rgba(0,0,0,0.18)' : 'rgba(96,77,53,0.10)');
  edge.addColorStop(0.18, 'rgba(0,0,0,0)');
  edge.addColorStop(0.82, 'rgba(0,0,0,0)');
  edge.addColorStop(1, inkMode ? 'rgba(0,0,0,0.24)' : 'rgba(96,77,53,0.12)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
};
