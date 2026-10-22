/**
 * 10 秒复刻段（300 帧 @ 30 fps）的唯一分镜表。
 *
 * 两层时间：
 *  1. `sb(n)` —— 分镜板帧号换算成秒。分镜表是创作基准（0–75–150–225–300），
 *     这里只在**一个地方**登记这些数，再统一除以参考帧率变成秒；场景代码只
 *     看秒/帧，看不到裸魔法帧号。
 *  2. `unit()` —— 歌词字级落点，来自 `public/alignment/climax_words.json`。
 *     凡是"跟着唱词走"的元素（火眼标题、符咒、罪状牌、印章）一律用字级时间。
 *
 * 所有时间都是秒；由场景按当前 fps 转帧（AGENTS.md §1）。
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

/** 每句唱词的起止（秒），直接取自对齐文档。 */
export const LINES = (CLIMAX_ALIGNMENT.sections ?? []).map((section) => ({
  id: section.id,
  text: section.label ?? '',
  start: section.start,
  end: section.end,
}));

/* -------------------------------------------------------------------------- */
/*  四镜                                                                      */
/* -------------------------------------------------------------------------- */

export type ShotId = 's1' | 's2' | 's3' | 's4';

export interface ShotSpan {
  id: ShotId;
  start: number;
  end: number;
  line: string;
}

export const SHOTS: ShotSpan[] = [
  {id: 's1', start: sb(0), end: sb(75), line: 'l1'},
  {id: 's2', start: sb(75), end: sb(150), line: 'l2'},
  {id: 's3', start: sb(150), end: sb(225), line: 'l3'},
  {id: 's4', start: sb(225), end: sb(300), line: 'l4'},
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
  /* Shot 1 — 南天门开合 / 三层视差 / 四分战幡 */
  doorOpen: {start: sb(0), end: sb(12)},
  /**
   * 四道战幡的落点：分镜要求 10/25/40/55 帧连落，但验收帧 45 必须同时看到
   * 四幡，所以落点收紧为 8/20/32/44 帧（仍是四拍弹簧连落，末幡在 45 帧已
   * 基本落位）。
   */
  bannerDrop: [sb(8), sb(18), sb(28), sb(38)],
  parallax: {start: sb(12), end: sb(75)},
  armyConverge: {start: sb(12), end: sb(72)},

  /* Shot 2 — 火眼横切 / 3D 金箍棒 / 劈字 */
  eyeCut: {start: sb(75), end: sb(95)},
  eyeBurst: sb(85),
  threeD: {start: sb(95), end: sb(150)},
  staffImpact: sb(105),
  splitType: {reveal: unitStart('l2c04'), slash: sb(118)},
  invert: [sb(118), sb(119)],

  /* Shot 3 — 五指山铁笼 / 符咒 */
  cage: {start: sb(150), end: sb(175)},
  peakDrops: [sb(146), sb(152), sb(158), sb(164), sb(170)],
  talismanWindow: {start: sb(175), end: sb(225)},
  talismanArrivals: [sb(175), sb(178), sb(181), sb(184), sb(187), sb(190)],

  /* Shot 4 — 罪状木牌 / 终局 */
  tagWindow: {start: sb(225), end: sb(265)},
  tagReveals: [sb(225), sb(232), sb(239)],
  finale: {start: Math.min(sb(265), unitStart('l4c06')), end: sb(300)},
  tagBreak: Math.min(sb(265), unitStart('l4c06')),
  sealLands: [
    /**
     * 四印落点压在唱词重音上，但把最后两印略提前（最长提前 0.17s），保证
     * 验收帧 280 四印齐满。歌词本身仍由对齐文档驱动。
     */
    sb(258),
    unitStart('l4c07') - 0.04,
    unitStart('l4c08') - 0.06,
    sb(277),
  ],
} as const;

/* -------------------------------------------------------------------------- */
/*  四分战幡                                                                  */
/* -------------------------------------------------------------------------- */

export interface BannerSlot {
  id: string;
  text: string;
  dropAt: number;
  /** 画布 x 中心（px）。 */
  x: number;
  width: number;
  height: number;
  fontSize: number;
  rotate: number;
  accent: string;
}

export const BANNERS: BannerSlot[] = [
  {
    id: 'b1',
    text: '玉境',
    dropAt: CUE.bannerDrop[0]!,
    x: 178,
    width: 250,
    height: 566,
    fontSize: 108,
    rotate: -1.2,
    accent: 'gold',
  },
  {
    id: 'b2',
    text: '凌霄',
    dropAt: CUE.bannerDrop[1]!,
    x: 612,
    width: 250,
    height: 612,
    fontSize: 108,
    rotate: 0.8,
    accent: 'cinnabar',
  },
  {
    id: 'b3',
    text: '十万',
    dropAt: CUE.bannerDrop[2]!,
    x: 1308,
    width: 250,
    height: 612,
    fontSize: 108,
    rotate: -0.6,
    accent: 'gold',
  },
  {
    id: 'b4',
    text: '天兵合围',
    dropAt: CUE.bannerDrop[3]!,
    x: 1742,
    width: 286,
    height: 690,
    fontSize: 80,
    rotate: 1.1,
    accent: 'cinnabar',
  },
];

/* -------------------------------------------------------------------------- */
/*  六张封印符咒                                                              */
/* -------------------------------------------------------------------------- */

export interface TalismanSlot {
  id: string;
  text: string;
  arriveAt: number;
  /** 落点中心（px）与尺寸。 */
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  fontSize: number;
  /** 飞入起点：屏幕四角。 */
  fromX: number;
  fromY: number;
  fromRotate: number;
}

export const TALISMANS: TalismanSlot[] = [
  {
    id: 't1',
    text: '五指山',
    arriveAt: CUE.talismanArrivals[0]!,
    x: 296,
    y: 366,
    width: 196,
    height: 388,
    rotate: -6.5,
    fontSize: 62,
    fromX: -300,
    fromY: -260,
    fromRotate: -110,
  },
  {
    id: 't2',
    text: '下',
    arriveAt: CUE.talismanArrivals[1]!,
    x: 612,
    y: 596,
    width: 168,
    height: 314,
    rotate: 4.2,
    fontSize: 86,
    fromX: -260,
    fromY: 1180,
    fromRotate: 96,
  },
  {
    id: 't3',
    text: '偿',
    arriveAt: CUE.talismanArrivals[2]!,
    x: 796,
    y: 302,
    width: 172,
    height: 330,
    rotate: -3.4,
    fontSize: 82,
    fromX: 560,
    fromY: -300,
    fromRotate: 70,
  },
  {
    id: 't4',
    text: '自由',
    arriveAt: CUE.talismanArrivals[3]!,
    x: 1152,
    y: 520,
    width: 190,
    height: 372,
    rotate: 5.8,
    fontSize: 66,
    fromX: 2100,
    fromY: 260,
    fromRotate: 118,
  },
  {
    id: 't5',
    text: '的',
    arriveAt: CUE.talismanArrivals[4]!,
    x: 1450,
    y: 322,
    width: 166,
    height: 306,
    rotate: -2.2,
    fontSize: 86,
    fromX: 2050,
    fromY: -240,
    fromRotate: 84,
  },
  {
    id: 't6',
    text: '罪',
    arriveAt: CUE.talismanArrivals[5]!,
    x: 1732,
    y: 626,
    width: 178,
    height: 336,
    rotate: 6.6,
    fontSize: 84,
    fromX: 2160,
    fromY: 1240,
    fromRotate: 132,
  },
];

/* -------------------------------------------------------------------------- */
/*  悬挂罪状木牌                                                              */
/* -------------------------------------------------------------------------- */

export interface TagSlot {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  swingPhase: number;
  swingAmp: number;
  /** 0 = 远景, 1 = 中景, 2 = 前景特写. */
  depth: 0 | 1 | 2;
  revealAt: number | null;
}

const TAG_WORDS = [
  '罪', '名', '欺', '天', '妄', '言', '犯', '上', '狂', '徒', '逆', '天',
  '不', '臣', '妖', '猴', '当', '诛', '天', '条', '镇', '压', '五', '百',
];

export const TAG_SLOTS: TagSlot[] = [
  ...Array.from({length: 12}, (_, index) => {
    const x = 120 + index * 154;
    return {
      id: `far-${index}`,
      text: TAG_WORDS[index % TAG_WORDS.length]!,
      x,
      y: 126 + (index % 3) * 26,
      width: 66,
      height: 268 + (index % 4) * 22,
      swingPhase: index * 0.83,
      swingAmp: 1.4,
      depth: 0 as const,
      revealAt: null,
    };
  }),
  ...Array.from({length: 8}, (_, index) => {
    const x = 190 + index * 222;
    return {
      id: `mid-${index}`,
      text: TAG_WORDS[(index + 7) % TAG_WORDS.length]!,
      x,
      y: 196 + (index % 2) * 36,
      width: 104,
      height: 400 + (index % 3) * 26,
      swingPhase: index * 1.27 + 0.6,
      swingAmp: 2.6,
      depth: 1 as const,
      revealAt: null,
    };
  }),
  {id: 'hero-0', text: '罪名', x: 384, y: 286, width: 196, height: 594, swingPhase: 0.4, swingAmp: 1.8, depth: 2, revealAt: CUE.tagReveals[0]!},
  {id: 'hero-1', text: '是', x: 960, y: 246, width: 186, height: 566, swingPhase: 2.1, swingAmp: 1.5, depth: 2, revealAt: CUE.tagReveals[1]!},
  {id: 'hero-2', text: '老孙', x: 1536, y: 296, width: 196, height: 594, swingPhase: 3.4, swingAmp: 2.0, depth: 2, revealAt: CUE.tagReveals[2]!},
];

/* -------------------------------------------------------------------------- */
/*  终局四印                                                                  */
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
  {id: 'seal-0', text: '不', landAt: CUE.sealLands[0]!, x: 400, y: 300, size: 560, rotate: -7},
  {id: 'seal-1', text: '敬', landAt: CUE.sealLands[1]!, x: 1520, y: 322, size: 552, rotate: 6},
  {id: 'seal-2', text: '权', landAt: CUE.sealLands[2]!, x: 420, y: 742, size: 548, rotate: 4},
  {id: 'seal-3', text: '威', landAt: CUE.sealLands[3]!, x: 1500, y: 752, size: 556, rotate: -5},
];

/* -------------------------------------------------------------------------- */
/*  冲击 / 震屏 / 反色                                                        */
/* -------------------------------------------------------------------------- */

export interface ImpactCue {
  time: number;
  power: number;
  /** 震屏主轴：'x' 横向撕扯，'y' 纵向砸落，'both' 全向。 */
  axis: 'x' | 'y' | 'both';
  /** 是否触发 1 帧黑白反色。 */
  invert?: boolean;
}

export const IMPACTS: ImpactCue[] = [
  {time: CUE.doorOpen.end, power: 0.55, axis: 'x'},
  ...CUE.bannerDrop.map((time) => ({time, power: 0.26, axis: 'both' as const})),
  {time: CUE.eyeCut.start, power: 0.72, axis: 'x'},
  {time: CUE.eyeBurst, power: 0.5, axis: 'x'},
  {time: CUE.staffImpact, power: 1, axis: 'both'},
  {time: CUE.splitType.slash, power: 1, axis: 'x', invert: true},
  ...CUE.peakDrops.map((time) => ({time, power: 0.82, axis: 'y' as const})),
  ...CUE.talismanArrivals.map((time) => ({time, power: 0.2, axis: 'both' as const})),
  {time: CUE.tagBreak, power: 0.9, axis: 'both'},
  ...CUE.sealLands.map((time) => ({time, power: 1, axis: 'both' as const, invert: true})),
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

/** 第 118–119 帧（30 fps）的全屏黑白反色窗口；其它冲击各吃 1 帧。 */
export const invertAt = (frame: number, fps: number): boolean => {
  const start = atFrame(CUE.invert[0], fps);
  const end = atFrame(CUE.invert[1], fps);
  if (frame >= start && frame < end + 1) return true;
  for (const cue of IMPACTS) {
    if (!cue.invert) continue;
    if (cue.time === CUE.splitType.slash) continue;
    const hit = atFrame(cue.time, fps);
    if (frame >= hit && frame < hit + 1) return true;
  }
  return false;
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

export const nextBeatAfter = (seconds: number): number => {
  for (const beat of BEATS) if (beat >= seconds) return beat;
  return DURATION_SECONDS;
};
