/**
 * 10 秒复刻段（300 帧 @ 30 fps）的唯一分镜表 —— V4。
 *
 * 时间只有两套，互不越界：
 *  1. `sb(n)` —— 分镜板帧号 → 秒。板号只在本文件出现，场景代码只看秒/帧
 *     （AGENTS.md §1）。V4 的板号：
 *       Sub1A 0–30 / Sub1B 30–75 / Sub2A 75–98 / Sub2B 98–150 /
 *       Sub3A 150–175 / Sub3B 175–225 / Sub4A 225–256 / Sub4B 256–291 / 黑 291–300。
 *  2. `unit()` —— 歌词字级落点，来自 `public/alignment/climax_words.json`。
 *
 * 例外说明（登记在 docs/EXPLORATION_LOG.md）：
 *  - Sub2A 的【怎】【敌】【我】被板号钉死在 75–98 帧的横条分格内，而字级
 *    对齐落在 87 / 96 / 104 帧（最后一字超出分格）。为了保证横条完整，这三字
 *    改用板号节拍 78 / 86 / 93。
 *  - Sub4A 的【罪名】【是】【老孙】同理用板号 228 / 236 / 244。
 *  - Sub4B 的【不】【敬】【权】【威】严格对齐 256 / 264 / 272 / 280。
 */

import {CLIMAX} from '../config/theme';
import {frameFromSeconds} from '../utils/timing';
import {CLIMAX_ALIGNMENT, type ClimaxUnit} from './climaxPlan';

/** 分镜板参考帧率 = 复刻段交付帧率（30）。 */
export const STORYBOARD_FPS = CLIMAX.fps;

/** 分镜板帧号 → 秒。整段唯一允许出现板帧号的地方。 */
export const sb = (storyboardFrame: number): number => storyboardFrame / STORYBOARD_FPS;

/** 秒 → 当前渲染帧。 */
export const atFrame = (seconds: number, fps: number): number => frameFromSeconds(seconds, fps);

export const DURATION_SECONDS = CLIMAX.durationInSeconds;

/* -------------------------------------------------------------------------- */
/*  歌词字级锚点                                                              */
/* -------------------------------------------------------------------------- */

const unitMap = new Map<string, ClimaxUnit>(
  CLIMAX_ALIGNMENT.units.map((unit) => [unit.id ?? '', unit]),
);

export const unit = (id: string): ClimaxUnit => {
  const found = unitMap.get(id);
  if (!found) throw new Error(`[senbon] unknown lyric unit "${id}"`);
  return found;
};

export const unitStart = (id: string): number => unit(id).start;

/* -------------------------------------------------------------------------- */
/*  八 + 一 个微切镜                                                          */
/* -------------------------------------------------------------------------- */

export type ShotId = 's1a' | 's1b' | 's2a' | 's2b' | 's3a' | 's3b' | 's4a' | 's4b' | 's5';

export interface ShotSpan {
  id: ShotId;
  start: number;
  end: number;
  label: string;
  line: string;
}

export const SHOTS: ShotSpan[] = [
  {id: 's1a', start: sb(0), end: sb(30), label: '玉境 · 四分屏微缩画卷', line: 'l1'},
  {id: 's1b', start: sb(30), end: sb(75), label: '十万天兵 · 侧面棍盾', line: 'l1'},
  {id: 's2a', start: sb(75), end: sb(98), label: '怎敌我 · 眼部横切', line: 'l2'},
  {id: 's2b', start: sb(98), end: sb(150), label: '无坚不摧 · 俯瞰崩裂', line: 'l2'},
  {id: 's3a', start: sb(150), end: sb(175), label: '五指山下 · 巨岩铁索', line: 'l3'},
  {id: 's3b', start: sb(175), end: sb(225), label: '偿自由的罪 · 复合符咒', line: 'l3'},
  {id: 's4a', start: sb(225), end: sb(256), label: '罪名是老孙 · 纯黑悬签', line: 'l4'},
  {id: 's4b', start: sb(256), end: sb(291), label: '不敬权威 · 四连跳切', line: 'l4'},
  {id: 's5', start: sb(291), end: sb(300), label: '黑屏留白', line: 'l4'},
];

export const shotAt = (seconds: number): ShotSpan => {
  for (let index = SHOTS.length - 1; index >= 0; index -= 1) {
    const span = SHOTS[index]!;
    if (seconds >= span.start) return span;
  }
  return SHOTS[0]!;
};

/* -------------------------------------------------------------------------- */
/*  分镜内部节拍                                                              */
/* -------------------------------------------------------------------------- */

export const CUE = {
  /* Sub1A —— 四分屏微缩画卷 */
  panelDrop: [sb(0), sb(6), sb(12), sb(18)],
  panelExit: sb(26),
  panelGone: sb(30),

  /* Sub1B —— 侧面旋风棍盾 */
  shield: {start: sb(30), end: sb(75)},
  armyWaves: [sb(36), sb(50), sb(64)],

  /* Sub2A —— 眼部横切 */
  eyeBand: {start: sb(75), open: sb(79), end: sb(98)},
  eyeWords: [sb(78), sb(86), sb(93)],

  /* Sub2B —— 3D 崩裂 + 劈字 */
  palace: {start: sb(98), end: sb(150)},
  slash: {reveal: sb(104), cut: sb(115)},
  invert: [sb(115), sb(116)],

  /* Sub3A —— 巨岩 + 铁索 */
  rockDrops: [sb(150), sb(151), sb(152), sb(153), sb(154)],
  kneelReveal: sb(155),
  chains: [sb(156), sb(160), sb(164), sb(168), sb(172), sb(176)],

  /* Sub3B —— 复合符咒 */
  ofuda: [sb(178), sb(185), sb(192), sb(199), sb(206), sb(213)],

  /* Sub4A —— 纯黑悬签 */
  chamber: sb(225),
  tagReveals: [sb(228), sb(236), sb(244)],

  /* Sub4B —— 四连跳切 */
  jumpCuts: [sb(256), sb(264), sb(272), sb(280)],
  sealLands: [sb(257), sb(265), sb(273), sb(281)],
  whiteFlash: sb(290),
  blackout: sb(291),
  end: sb(300),
} as const;

/** 四连跳切的放大倍率。 */
export const JUMP_SCALES = [1, 1.35, 1.8, 2.4] as const;

/* -------------------------------------------------------------------------- */
/*  Sub1A 四分屏                                                              */
/* -------------------------------------------------------------------------- */

export type PanelSceneKind = 'gate' | 'palace' | 'spear' | 'hero';

export interface PanelSlot {
  id: string;
  seal: string;
  subText: string;
  indexLabel: string;
  title: string;
  caption: string;
  scene: PanelSceneKind;
  dropAt: number;
  accent: 'gold' | 'cinnabar';
}

export const PANELS: PanelSlot[] = [
  {
    id: 'p1',
    seal: '壹',
    subText: '玉境',
    indexLabel: '其一',
    title: '南天门',
    caption: '玉境 · 南天门巨柱',
    scene: 'gate',
    dropAt: CUE.panelDrop[0]!,
    accent: 'gold',
  },
  {
    id: 'p2',
    seal: '贰',
    subText: '凌霄',
    indexLabel: '其二',
    title: '凌霄殿',
    caption: '凌霄 · 飞檐与赤金满月',
    scene: 'palace',
    dropAt: CUE.panelDrop[1]!,
    accent: 'cinnabar',
  },
  {
    id: 'p3',
    seal: '叁',
    subText: '十万',
    indexLabel: '其三',
    title: '银戈林',
    caption: '十万 · 银白长戈森林',
    scene: 'spear',
    dropAt: CUE.panelDrop[2]!,
    accent: 'gold',
  },
  {
    id: 'p4',
    seal: '肆',
    subText: '合围',
    indexLabel: '其四',
    title: '大圣',
    caption: '合围 · 侧面挥棒残影',
    scene: 'hero',
    dropAt: CUE.panelDrop[3]!,
    accent: 'cinnabar',
  },
];

/* -------------------------------------------------------------------------- */
/*  Sub3A 五道巨岩 + 六道铁索                                                 */
/* -------------------------------------------------------------------------- */

export interface BoulderSlot {
  id: string;
  x: number;
  width: number;
  bottom: number;
  dropAt: number;
  seed: number;
}

export const BOULDERS: BoulderSlot[] = [
  {id: 'r1', x: 170, width: 300, bottom: 500, dropAt: CUE.rockDrops[0]!, seed: 11},
  {id: 'r2', x: 560, width: 280, bottom: 420, dropAt: CUE.rockDrops[1]!, seed: 23},
  {id: 'r3', x: 960, width: 360, bottom: 520, dropAt: CUE.rockDrops[2]!, seed: 37},
  {id: 'r4', x: 1360, width: 280, bottom: 420, dropAt: CUE.rockDrops[3]!, seed: 41},
  {id: 'r5', x: 1750, width: 300, bottom: 500, dropAt: CUE.rockDrops[4]!, seed: 53},
];

export interface ChainSlot {
  id: string;
  arriveAt: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sag?: number;
}

/** 六道实体铁索，交叉锁死岩壁。 */
export const CHAINS: ChainSlot[] = [
  {id: 'c1', arriveAt: CUE.chains[0]!, x1: 40, y1: 250, x2: 1880, y2: 760, sag: 20},
  {id: 'c2', arriveAt: CUE.chains[1]!, x1: 1880, y1: 230, x2: 40, y2: 790, sag: 24},
  {id: 'c3', arriveAt: CUE.chains[2]!, x1: 960, y1: -120, x2: 960, y2: 900, sag: 0},
  {id: 'c4', arriveAt: CUE.chains[3]!, x1: -120, y1: 548, x2: 2040, y2: 548, sag: -14},
  {id: 'c5', arriveAt: CUE.chains[4]!, x1: 100, y1: 1000, x2: 1820, y2: 180, sag: 18},
  {id: 'c6', arriveAt: CUE.chains[5]!, x1: 1820, y1: 1000, x2: 100, y2: 180, sag: 18},
];

/* -------------------------------------------------------------------------- */
/*  Sub3B 六张五层复合符咒                                                    */
/* -------------------------------------------------------------------------- */

export interface OfudaSlot {
  id: string;
  text: string;
  revealAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
}

export const OFUDA: OfudaSlot[] = [
  {id: 't1', text: '五指山下', revealAt: CUE.ofuda[0]!, x: 300, y: 336, width: 178, height: 424, rotate: -6.5},
  {id: 't2', text: '偿', revealAt: CUE.ofuda[1]!, x: 782, y: 254, width: 150, height: 310, rotate: 4},
  {id: 't3', text: '自', revealAt: CUE.ofuda[2]!, x: 1136, y: 254, width: 150, height: 310, rotate: -4.5},
  {id: 't4', text: '由', revealAt: CUE.ofuda[3]!, x: 1588, y: 360, width: 168, height: 366, rotate: 6},
  {id: 't5', text: '的', revealAt: CUE.ofuda[4]!, x: 512, y: 786, width: 144, height: 290, rotate: 5},
  {id: 't6', text: '罪', revealAt: CUE.ofuda[5]!, x: 1402, y: 786, width: 152, height: 306, rotate: -6},
];

/* -------------------------------------------------------------------------- */
/*  Sub4A 前景三块主牌                                                        */
/* -------------------------------------------------------------------------- */

export interface HeroTagSlot {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  revealAt: number;
}

export const HERO_TAGS: HeroTagSlot[] = [
  {id: 'hero-0', text: '罪名', x: 384, y: 300, width: 190, height: 566, revealAt: CUE.tagReveals[0]!},
  {id: 'hero-1', text: '是', x: 960, y: 262, width: 182, height: 548, revealAt: CUE.tagReveals[1]!},
  {id: 'hero-2', text: '老孙', x: 1536, y: 310, width: 190, height: 566, revealAt: CUE.tagReveals[2]!},
];

/* -------------------------------------------------------------------------- */
/*  Sub4B 终局四印                                                            */
/* -------------------------------------------------------------------------- */

export interface SealSlot {
  id: string;
  text: string;
  landAt: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

export const SEALS: SealSlot[] = [
  {id: 'seal-0', text: '不', landAt: CUE.sealLands[0]!, x: 302, y: 246, size: 348, rotate: -7},
  {id: 'seal-1', text: '敬', landAt: CUE.sealLands[1]!, x: 1614, y: 258, size: 342, rotate: 6},
  {id: 'seal-2', text: '权', landAt: CUE.sealLands[2]!, x: 312, y: 844, size: 336, rotate: 4},
  {id: 'seal-3', text: '威', landAt: CUE.sealLands[3]!, x: 1602, y: 838, size: 342, rotate: -5},
];

/* -------------------------------------------------------------------------- */
/*  冲击 / 震屏 / 反色                                                        */
/* -------------------------------------------------------------------------- */

export interface ImpactCue {
  time: number;
  power: number;
  /** 震屏主轴：'x' 横向撕扯，'y' 纵向砸落，'both' 全向。 */
  axis: 'x' | 'y' | 'both';
}

export const IMPACTS: ImpactCue[] = [
  ...CUE.panelDrop.map((time) => ({time, power: 0.34, axis: 'both' as const})),
  {time: CUE.panelExit, power: 0.5, axis: 'x'},
  {time: CUE.shield.start, power: 0.52, axis: 'both'},
  ...CUE.armyWaves.map((time) => ({time, power: 0.26, axis: 'x' as const})),
  {time: CUE.eyeBand.start, power: 0.82, axis: 'x'},
  {time: CUE.eyeBand.open, power: 0.5, axis: 'x'},
  ...CUE.eyeWords.map((time) => ({time, power: 0.42, axis: 'both' as const})),
  {time: CUE.palace.start, power: 0.7, axis: 'both'},
  {time: CUE.slash.cut, power: 1, axis: 'both'},
  ...CUE.rockDrops.map((time) => ({time, power: 0.5, axis: 'y' as const})),
  ...CUE.chains.map((time) => ({time, power: 0.24, axis: 'both' as const})),
  ...CUE.ofuda.map((time) => ({time, power: 0.2, axis: 'both' as const})),
  {time: CUE.chamber, power: 0.55, axis: 'x'},
  ...CUE.tagReveals.map((time) => ({time, power: 0.3, axis: 'both' as const})),
  ...CUE.jumpCuts.map((time) => ({time, power: 1, axis: 'both' as const})),
  ...CUE.sealLands.map((time) => ({time, power: 0.92, axis: 'both' as const})),
  {time: CUE.whiteFlash, power: 1, axis: 'both'},
];

/** 单次冲击的位移向量（px），供场景叠加到相机。 */
export interface ShakeOffset {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export const shakeAt = (seconds: number, maxShift = 26): ShakeOffset => {
  let x = 0;
  let y = 0;
  let rotate = 0;
  let scale = 0;
  IMPACTS.forEach((cue, index) => {
    const dt = seconds - cue.time;
    if (dt < -0.05 || dt > 0.62) return;
    if (dt < 0) return;
    const decay = Math.exp(-dt * 13);
    const wobble = Math.sin(dt * 74 + index * 1.91) * decay * cue.power;
    const wobble2 = Math.cos(dt * 61 + index * 2.71) * decay * cue.power;
    if (cue.axis === 'x' || cue.axis === 'both') {
      x += wobble * maxShift * 0.9;
      rotate += wobble * 0.5;
    }
    if (cue.axis === 'y' || cue.axis === 'both') {
      y += wobble2 * maxShift * 0.8;
    }
    scale += decay * cue.power * 0.012;
  });
  return {x, y, rotate, scale};
};

/** 0–1 的白闪强度。 */
export const flashAt = (seconds: number): number => {
  let value = 0;
  for (const cue of IMPACTS) {
    const dt = seconds - cue.time;
    if (dt < 0 || dt > 0.12) continue;
    value = Math.max(value, (1 - dt / 0.12) ** 2.4 * cue.power);
  }
  return Math.min(1, value);
};

/** 第 115–116 帧的全屏黑白反色（Impact Frame）。 */
export const invertAt = (frame: number, fps: number): boolean => {
  const start = atFrame(CUE.invert[0], fps);
  const end = atFrame(CUE.invert[1], fps);
  return frame >= start && frame <= end;
};

/* -------------------------------------------------------------------------- */
/*  节拍                                                                      */
/* -------------------------------------------------------------------------- */

const BEATS = CLIMAX_ALIGNMENT.beats?.beats ?? [];
export const BPM = CLIMAX_ALIGNMENT.beats?.bpm ?? 100;

export const beatPulse = (seconds: number): number => {
  if (!BEATS.length) return 0;
  let previous = 0;
  for (const beat of BEATS) {
    if (beat <= seconds) previous = beat;
  }
  return Math.min(1, Math.max(0, 1 - (seconds - previous) / (60 / BPM)));
};

export const beatIndex = (seconds: number): number =>
  BEATS.reduce((count, beat) => (beat <= seconds ? count + 1 : count), 0);
