/**
 * 《千本樱》式纯代码视觉的公共设计令牌。
 *
 * 这是 senbon_style 原语族的唯一配色/字体/线宽来源。所有组件只允许从这里
 * 取色，禁止在组件里凭空新增第五种主色（AGENTS.md §5）。
 */

export const SENBON = {
  /** 玄黑：底、剪影、门板、字骨。 */
  ink: '#0B090A',
  /** 帘幕级黑，比底色略亮一档，用于分层而不破坏暗场。 */
  inkSoft: '#141011',
  inkLift: '#1E1718',
  inkEdge: '#060505',
  /** 宣纸米白：符纸、木牌、月面高光。 */
  paper: '#F4EFE6',
  paperDim: '#D7CCB6',
  paperShade: '#B9AA8E',
  /** 朱砂赤红：印、符边、翎根、血光。 */
  cinnabar: '#D93025',
  cinnabarDeep: '#8E1A13',
  cinnabarGlow: 'rgba(217, 48, 37, 0.55)',
  /** 鎏金亮黄：唯一光源。 */
  gold: '#FCC934',
  goldLight: '#FFEFB0',
  goldPale: '#FFF7DA',
  goldDeep: '#9A6A0D',
  goldShadow: '#5C3E06',
  /** 银白长戈、天兵甲片。 */
  silver: '#CFC8BA',
  silverDim: '#8C8478',
  /** 暗灰岩柱。 */
  stone: '#2B2527',
  stoneDeep: '#171214',
  stoneLight: '#463D3F',
} as const;

export const ALPHA = {
  gold10: 'rgba(252, 201, 52, 0.10)',
  gold18: 'rgba(252, 201, 52, 0.18)',
  gold28: 'rgba(252, 201, 52, 0.28)',
  gold45: 'rgba(252, 201, 52, 0.45)',
  gold65: 'rgba(252, 201, 52, 0.65)',
  gold85: 'rgba(252, 201, 52, 0.85)',
  paper12: 'rgba(244, 239, 230, 0.12)',
  paper24: 'rgba(244, 239, 230, 0.24)',
  paper38: 'rgba(244, 239, 230, 0.38)',
  paper60: 'rgba(244, 239, 230, 0.60)',
  ink70: 'rgba(11, 9, 10, 0.70)',
  ink85: 'rgba(11, 9, 10, 0.85)',
  cinnabar20: 'rgba(217, 48, 37, 0.20)',
  cinnabar35: 'rgba(217, 48, 37, 0.35)',
  cinnabar60: 'rgba(217, 48, 37, 0.60)',
} as const;

/** 线宽节奏：印刷描边 → 结构线 → 巨幅轮廓。 */
export const LINE = {
  hair: 1.2,
  thin: 2,
  mid: 3.2,
  bold: 5,
  heavy: 8,
} as const;

export const SERIF_STACK =
  '"Source Han Serif SC Heavy", "Noto Serif SC", "Songti SC", "SimSun", serif';
export const KAI_STACK = '"LXGW WenKai", "KaiTi", "STKaiti", "Kaiti SC", serif';
export const BRUSH_STACK = '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive';

export const TAU = Math.PI * 2;

/** 0 → 1 的三次/指数缓动，禁止依赖 framer-motion。 */
export const easeOutCubic = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const easeInCubic = (t: number): number => Math.min(1, Math.max(0, t)) ** 3;
export const easeOutExpo = (t: number): number => {
  const v = Math.min(1, Math.max(0, t));
  return v >= 1 ? 1 : 1 - 2 ** (-10 * v);
};
export const easeOutBack = (t: number, s = 1.7): number => {
  const v = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (s + 1) * v * v * v + s * v * v;
};
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 弹簧过冲：战幡/山柱/印章砸落的统一手感。 */
export const overshoot = (t: number, damping = 6.4, frequency = 8.4): number => {
  const v = clamp01(t);
  if (v === 0) return 0;
  if (v === 1) return 1;
  return 1 - Math.exp(-damping * v) * Math.cos(frequency * Math.PI * v);
};

/** 以秒为单位的衰减正弦，冲击后的余震。 */
export const decaySine = (dt: number, decay = 11, freq = 26): number => {
  if (dt < 0) return 0;
  return Math.sin(dt * freq) * Math.exp(-dt * decay);
};

/** SVG 数字格式化，避免路径字符串出现 12 位小数。 */
export const f = (n: number): string => (Math.round(n * 100) / 100).toString();
