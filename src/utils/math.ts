/**
 * Deterministic math extracted from `engine/theme.js` and
 * `engine/aesthetics-hub/motion-rules.js` of the original Canvas pipeline.
 *
 * No Math.random(), Date.now() or wall-clock calls are allowed anywhere in the
 * render tree. Every stochastic quantity must come from `rng(seed)` or
 * `hash(seed, index)`.
 */

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin = 0,
  outMax = 1,
): number => outMin + (outMax - outMin) * clamp((value - inMin) / (inMax - inMin));

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const ease = {
  outExpo: (value: number): number => {
    const t = clamp(value);
    return t <= 0 ? 0 : t >= 1 ? 1 : 1 - 2 ** (-10 * t);
  },
  inExpo: (value: number): number => {
    const t = clamp(value);
    return t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (10 * t - 10);
  },
  inOutExpo: (value: number): number => {
    const t = clamp(value);
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },
  outCubic: (value: number): number => 1 - (1 - clamp(value)) ** 3,
  inCubic: (value: number): number => clamp(value) ** 3,
  inOutCubic: (value: number): number => {
    const t = clamp(value);
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  },
  outQuint: (value: number): number => 1 - (1 - clamp(value)) ** 5,
  inQuint: (value: number): number => clamp(value) ** 5,
  outBack: (value: number, overshoot = 1.4): number => {
    const t = clamp(value) - 1;
    return 1 + (overshoot + 1) * t * t * t + overshoot * t * t;
  },
  snap: (value: number): number => {
    const t = clamp(value);
    return 1 - (1 - t) ** 7 + Math.sin(t * Math.PI) * 0.028 * (1 - t);
  },
} as const;

/** Underdamped spring, 0 → 1 with a small controlled overshoot. */
export const spring = (
  value: number,
  damping = 6.5,
  frequency = 7.2,
): number => {
  const t = clamp(value);
  if (t === 0) return 0;
  if (t === 1) return 1;
  return 1 - Math.exp(-damping * t) * Math.cos(frequency * Math.PI * t);
};

/** Physics spring expressed in real spring units, ported from the aesthetics hub. */
export const springPhysics = (
  progress: number,
  options: {stiffness?: number; damping?: number; mass?: number; duration?: number} = {},
): number => {
  const stiffness = options.stiffness ?? 180;
  const damping = options.damping ?? 14;
  const mass = options.mass ?? 1;
  const duration = options.duration ?? 1;
  const s = clamp(progress);
  if (s <= 0) return 0;
  if (s >= 1) return 1;

  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const t = s * duration;

  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
    );
  }

  return 1 - Math.exp(-zeta * w0 * t) * (1 + zeta * w0 * t);
};

/** Mulberry32: fixed-seed PRNG used by procedural textures and physics jitter. */
export const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stateless hash → [0,1), suitable for particles addressed by index. */
export const hash = (seed: number, index: number): number => {
  let t = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
};

const PERM = new Uint8Array(512);
(() => {
  const random = rng(20240917);
  for (let i = 0; i < 256; i += 1) PERM[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = PERM[i] ?? 0;
    PERM[i] = PERM[j] ?? 0;
    PERM[j] = temp;
  }
  for (let i = 0; i < 256; i += 1) PERM[i + 256] = PERM[i] ?? 0;
})();

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const grad2 = (h: number, x: number, y: number): number => {
  switch (h & 3) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
};

/** 2D value-gradient noise, deterministic and allocation-free. */
export const noise2 = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X = xi & 255;
  const Y = yi & 255;
  const u = fade(xf);
  const v = fade(yf);
  const aa = PERM[(PERM[X] ?? 0) + Y] ?? 0;
  const ab = PERM[(PERM[X] ?? 0) + Y + 1] ?? 0;
  const ba = PERM[(PERM[X + 1] ?? 0) + Y] ?? 0;
  const bb = PERM[(PERM[X + 1] ?? 0) + Y + 1] ?? 0;
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v) * 0.5 + 0.5;
};

/** Fractal Brownian motion wrapper around the deterministic noise above. */
export const fbm = (
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number => {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let normalizer = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise2(x * frequency, y * frequency);
    normalizer += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / normalizer;
};
