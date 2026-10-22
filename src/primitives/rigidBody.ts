import {hash, rng} from '../utils/math';
import {frameFromSeconds} from '../utils/timing';

/**
 * Deterministic rigid-body text collapse, ported from
 * `HUB.PrebakedCollapse` in `remonster-physics.js`.
 *
 * The entire fall is baked once at the render fps. Drawing each frame is a
 * table lookup, so the physics cost never appears in the render loop. Release
 * times are supplied in seconds and converted with the current fps — never as
 * baked frame literals.
 */
export interface RigidCharSpec {
  char: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  weight: number;
  family: string;
  releaseAtSeconds: number;
  vx?: number;
  vy?: number;
  angularVelocity?: number;
  restitution?: number;
}

export interface RigidPose {
  x: number;
  y: number;
  angle: number;
}

export interface RigidBakeOptions {
  fps: number;
  durationInFrames: number;
  gravity?: number;
  floorY?: number;
  restitution?: number;
  friction?: number;
  wallLeft?: number;
  wallRight?: number;
}

export interface RigidCollapseLayoutOptions {
  originX: number;
  originY: number;
  fontSize: number;
  columns?: number;
  columnGap?: number;
  rowGap?: number;
  releaseAtSeconds?: number;
  staggerSeconds?: number;
  seed?: number;
  color?: string;
  weight?: number;
  family: string;
}

interface SimulationState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  av: number;
  static: boolean;
  asleep: boolean;
  width: number;
  height: number;
  restitution: number;
}

export const createRigidTextBodies = (
  text: string,
  options: RigidCollapseLayoutOptions,
): RigidCharSpec[] => {
  const characters = Array.from(text);
  const columns = Math.max(1, options.columns ?? Math.min(6, characters.length));
  const fontSize = options.fontSize;
  const columnGap = options.columnGap ?? fontSize * 1.02;
  const rowGap = options.rowGap ?? fontSize * 1.16;
  const rows = Math.ceil(characters.length / columns);
  const seed = options.seed ?? 9137;
  const baseRelease = options.releaseAtSeconds ?? 1.2;
  const stagger = options.staggerSeconds ?? 0.035;

  return characters.map((character, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, characters.length - row * columns);
    const rowWidth = (rowCount - 1) * columnGap;
    const x = options.originX - rowWidth / 2 + column * columnGap;
    const y = options.originY + (row - (rows - 1) / 2) * rowGap;

    return {
      char: character,
      x,
      y,
      width: fontSize * 0.92,
      height: fontSize * 0.96,
      fontSize,
      color: options.color ?? 'rgba(244,239,230,0.94)',
      weight: options.weight ?? 900,
      family: options.family,
      releaseAtSeconds: baseRelease + index * stagger,
      vx: (hash(seed, index * 4 + 1) - 0.5) * 150,
      vy: -(20 + hash(seed, index * 4 + 2) * 120),
      angularVelocity: (hash(seed, index * 4 + 3) - 0.5) * 1.6,
      restitution: 0.18 + hash(seed, index * 4 + 4) * 0.14,
    };
  });
};

/** Bake all collisions up-front and return an immutable per-frame pose table. */
export const bakeRigidTextCollapse = (
  bodies: readonly RigidCharSpec[],
  options: RigidBakeOptions,
): RigidPose[][] => {
  const {
    fps,
    durationInFrames,
    gravity = 2600,
    floorY = 1040,
    restitution = 0.22,
    friction = 0.66,
    wallLeft = 40,
    wallRight = 1880,
  } = options;
  const delta = 1 / fps;
  const frames = Math.max(1, Math.floor(durationInFrames));
  const states: SimulationState[] = bodies.map((body) => ({
    x: body.x,
    y: body.y,
    angle: 0,
    vx: 0,
    vy: 0,
    av: 0,
    static: true,
    asleep: false,
    width: body.width,
    height: body.height,
    restitution: body.restitution ?? restitution,
  }));

  const table: RigidPose[][] = [];

  for (let frame = 0; frame < frames; frame += 1) {
    // Release each glyph at its own fps-resolved timestamp.
    for (let index = 0; index < bodies.length; index += 1) {
      const body = bodies[index];
      const state = states[index];
      if (!body || !state) continue;
      const releaseFrame = frameFromSeconds(body.releaseAtSeconds, fps);
      if (releaseFrame <= frame && state.static) {
        state.static = false;
        state.vx = body.vx ?? 0;
        state.vy = body.vy ?? 0;
        state.av = body.angularVelocity ?? 0;
      }
    }

    // Semi-implicit Euler integration.
    for (const state of states) {
      if (state.static || state.asleep) continue;
      state.vy += gravity * delta;
      state.x += state.vx * delta;
      state.y += state.vy * delta;
      state.angle += state.av * delta;
      state.vx *= 0.999;
      state.av *= 0.995;
    }

    // Floor and side walls.
    for (const state of states) {
      if (state.static) continue;
      const halfHeight = state.height / 2;
      const halfWidth = state.width / 2;
      if (state.y + halfHeight > floorY) {
        state.y = floorY - halfHeight;
        if (state.vy > 0) {
          state.vy = -state.vy * state.restitution;
          if (Math.abs(state.vy) < 60) state.vy = 0;
        }
        state.vx *= friction;
        state.av *= 0.72;
        if (Math.abs(state.vx) < 4) state.vx = 0;
      }
      if (state.x - halfWidth < wallLeft) {
        state.x = wallLeft + halfWidth;
        state.vx = Math.abs(state.vx) * 0.35;
      }
      if (state.x + halfWidth > wallRight) {
        state.x = wallRight - halfWidth;
        state.vx = -Math.abs(state.vx) * 0.35;
      }
      if (
        Math.abs(state.vx) + Math.abs(state.vy) < 8 &&
        state.y + halfHeight > floorY - 2
      ) {
        state.asleep = true;
      }
    }

    // AABB collision with minimum-penetration separation.
    for (let a = 0; a < states.length; a += 1) {
      const A = states[a];
      if (!A || A.static) continue;
      for (let b = a + 1; b < states.length; b += 1) {
        const B = states[b];
        if (!B || B.static) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const overlapX = (A.width + B.width) / 2 - Math.abs(dx);
        const overlapY = (A.height + B.height) / 2 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const direction = dx < 0 ? -1 : 1;
          const push = overlapX * 0.55;
          A.x -= direction * push;
          B.x += direction * push;
          const relative = B.vx - A.vx;
          const impulse = -relative * 0.5 * (1 + restitution);
          A.vx -= impulse;
          B.vx += impulse;
          A.av += direction * 0.6;
          B.av -= direction * 0.6;
        } else {
          const direction = dy < 0 ? -1 : 1;
          const push = overlapY * 0.55;
          A.y -= direction * push;
          B.y += direction * push;
          const relative = B.vy - A.vy;
          if (relative < 0) {
            const impulse = -relative * 0.5 * (1 + restitution);
            A.vy -= impulse;
            B.vy += impulse;
            A.vx *= 0.92;
            B.vx *= 0.92;
          }
        }
        A.asleep = false;
        B.asleep = false;
      }
    }

    table.push(states.map((state) => ({x: state.x, y: state.y, angle: state.angle})));
  }

  return table;
};

/** Small helper for callers that need a deterministic horizontal drift field. */
export const makeCollapseJitter = (seed: number, count: number): number[] => {
  const random = rng(seed);
  return Array.from({length: count}, () => random() * 2 - 1);
};
