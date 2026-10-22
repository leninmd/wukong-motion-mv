/**
 * Wukong Motion MV — global design tokens.
 *
 * The palette is intentionally tiny and rigid:
 *   ink        the void / lacquer black
 *   paper      bleached xuan paper / bone white
 *   cinnabar   seal paste / warning red
 *   gold       gilded cudgel / furnace sparks
 *
 * Never introduce a fifth hero colour. Tints and transparencies are derived
 * from these four values only.
 */

export const PALETTE = {
  ink: '#0B090A',
  paper: '#F4EFE6',
  cinnabar: '#D93025',
  gold: '#FCC934',
} as const;

export const DERIVED = {
  ink80: 'rgba(11, 9, 10, 0.80)',
  ink60: 'rgba(11, 9, 10, 0.60)',
  ink40: 'rgba(11, 9, 10, 0.40)',
  paper92: 'rgba(244, 239, 230, 0.92)',
  paper70: 'rgba(244, 239, 230, 0.70)',
  paper42: 'rgba(244, 239, 230, 0.42)',
  paper16: 'rgba(244, 239, 230, 0.16)',
  cinnabar78: 'rgba(217, 48, 37, 0.78)',
  cinnabar34: 'rgba(217, 48, 37, 0.34)',
  gold86: 'rgba(252, 201, 52, 0.86)',
  gold45: 'rgba(252, 201, 52, 0.45)',
  gold18: 'rgba(252, 201, 52, 0.18)',
  gold08: 'rgba(252, 201, 52, 0.08)',
} as const;

export const CANVAS = {
  width: 1920,
  height: 1080,
  fps: 60,
} as const;

export const FONT_STACKS = {
  song: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif',
  heavy: '"Source Han Serif SC Heavy", "Noto Serif SC", "Songti SC", "SimSun", serif',
  kai: '"LXGW WenKai", "KaiTi", "STKaiti", "Kaiti SC", serif',
  brush: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
  mono: '"JetBrains Mono", "Cascadia Mono", "Consolas", monospace',
} as const;

export const TYPE = {
  hero: 184,
  title: 112,
  subtitle: 44,
  body: 30,
  annotation: 23,
  micro: 15,
} as const;

export const MOTION = {
  /** Durations are always expressed in seconds, then converted with the runtime fps. */
  micro: 0.24,
  quick: 0.36,
  standard: 0.72,
  slow: 1.2,
  stamp: 0.46,
  staggerWord: 0.08,
} as const;

export const SAFE_ZONE = {
  left: 112,
  top: 68,
  right: 1808,
  bottom: 1012,
} as const;

export const BUDGET = {
  /** Maximum share of frame occupied by a single atmospheric layer. */
  atmosphere: 0.30,
  particles: 0.28,
  grain: 0.18,
  vignette: 0.38,
} as const;
