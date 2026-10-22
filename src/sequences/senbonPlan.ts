/**
 * 10 秒复刻段（300 帧 @ 30 fps）的唯一分镜表 —— V3。
 *
 * 两层时间，互不越界：
 *  1. `sb(n)` —— 分镜板帧号换算成秒。板号只在这一个文件出现，场景代码只看
 *     秒/帧（AGENTS.md §1）。V3 的板号取自本次重制的逐帧要求
 *     （0/7/14/21/28/75/98/112/150/170/225/256/264/272/280/290/300）。
 *  2. `unit()` —— 歌词字级落点，来自 `public/alignment/climax_words.json`。
 *
 * 例外说明（已登记到 docs/EXPLORATION_LOG.md）：Shot 2 的【怎】【敌】【我】
 * 三字被板号钉死在 75–98 帧的横条分格内，而这三字的字级对齐落在 87/96/105
 * 帧（最后一字超出横条）。为了既不改动歌词时钟、又保持横条分格的完整性，
 * 这三字改用板号节拍（78/86/93），其余歌词元素仍走 alignment。
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
  /* Shot 1 —— 四分屏战幡 → 浓雾合围 + 转棍护盾 */
  panelDrop: [sb(0), sb(7), sb(14), sb(21)],
  panelExit: sb(28),
  panelGone: sb(35),
  siege: {start: sb(28), end: sb(75)},
  armyWaves: [sb(28), sb(45), sb(60)],
  staffWheel: {start: sb(26), end: sb(75)},

  /* Shot 2 —— 眼部横条 → 凌霄宝殿崩裂 + 劈字 */
  eyeBand: {start: sb(75), open: sb(80), end: sb(98)},
  eyeWords: [sb(78), sb(86), sb(93)],
  palace: {start: sb(98), end: sb(150)},
  staffSweep: sb(112),
  columnsBreak: sb(113),
  slash: {reveal: sb(100), cut: sb(112)},
  invert: [sb(112), sb(113)],

  /* Shot 3 —— 高空俯视石缝 → 米字封印 */
  rockDrops: [sb(150), sb(154), sb(158), sb(162), sb(166)],
  trappedReveal: sb(151),
  chains: [sb(172), sb(176), sb(180), sb(184), sb(188), sb(192)],
  talismanText: [sb(178), sb(185), sb(192), sb(199), sb(206)],

  /* Shot 4 —— 悬签罪状 → 四连跳切 → 黑屏留白 */
  chamber: sb(225),
  tagReveals: [sb(228), sb(236), sb(244)],
  jumpCuts: [sb(256), sb(264), sb(272), sb(280)],
  sealLands: [sb(258), sb(266), sb(274), sb(282)],
  whiteFlash: sb(290),
  blackout: sb(291),
  end: sb(300),
} as const;

/** 四连跳切的放大倍率。 */
export const JUMP_SCALES = [1, 1.4, 1.9, 2.6] as const;

/* -------------------------------------------------------------------------- */
/*  四分战幡                                                                  */
/* -------------------------------------------------------------------------- */

export interface BannerSlot {
  id: string;
  text: string;
  dropAt: number;
  /** 分格在倾斜条带内的列序号。 */
  column: number;
  /** 出画方向：-1 向左，+1 向右。 */
  exit: -1 | 1;
  fontSize: number;
  accent: 'gold' | 'cinnabar';
}

export const PANEL_TILT = 5;

export const BANNERS: BannerSlot[] = [
  {id: 'b1', text: '玉境', dropAt: CUE.panelDrop[0]!, column: 0, exit: -1, fontSize: 138, accent: 'cinnabar'},
  {id: 'b2', text: '凌霄', dropAt: CUE.panelDrop[1]!, column: 1, exit: -1, fontSize: 138, accent: 'gold'},
  {id: 'b3', text: '十万', dropAt: CUE.panelDrop[2]!, column: 2, exit: 1, fontSize: 138, accent: 'cinnabar'},
  {id: 'b4', text: '天兵合围', dropAt: CUE.panelDrop[3]!, column: 3, exit: 1, fontSize: 96, accent: 'gold'},
];

/* -------------------------------------------------------------------------- */
/*  六道封印锁链 + 五张符咒                                                   */
/* -------------------------------------------------------------------------- */

export interface ChainSlot {
  id: string;
  arriveAt: number;
  /** 端点（画布坐标）。 */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 米字封印：从画面四边向中心交叉锁死。 */
export const CHAINS: ChainSlot[] = [
  {id: 'c1', arriveAt: CUE.chains[0]!, x1: 120, y1: 150, x2: 1800, y2: 930},
  {id: 'c2', arriveAt: CUE.chains[1]!, x1: 1800, y1: 130, x2: 120, y2: 950},
  {id: 'c3', arriveAt: CUE.chains[2]!, x1: 960, y1: -140, x2: 960, y2: 1180},
  {id: 'c4', arriveAt: CUE.chains[3]!, x1: -140, y1: 560, x2: 2060, y2: 560},
  {id: 'c5', arriveAt: CUE.chains[4]!, x1: 60, y1: 980, x2: 1880, y2: 180},
  {id: 'c6', arriveAt: CUE.chains[5]!, x1: 1880, y1: 980, x2: 60, y2: 190},
];

export interface TalismanSlot {
  id: string;
  text: string;
  revealAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
  fontSize: number;
}

export const TALISMANS: TalismanSlot[] = [
  {id: 't1', text: '五指山下', revealAt: CUE.talismanText[0]!, x: 356, y: 306, width: 168, height: 470, rotate: -6, fontSize: 86},
  {id: 't2', text: '偿', revealAt: CUE.talismanText[1]!, x: 852, y: 232, width: 158, height: 300, rotate: 3.5, fontSize: 132},
  {id: 't3', text: '自由', revealAt: CUE.talismanText[2]!, x: 1180, y: 782, width: 158, height: 400, rotate: -4, fontSize: 104},
  {id: 't4', text: '的', revealAt: CUE.talismanText[3]!, x: 1520, y: 268, width: 150, height: 290, rotate: 6, fontSize: 132},
  {id: 't5', text: '罪', revealAt: CUE.talismanText[4]!, x: 700, y: 858, width: 156, height: 300, rotate: -6, fontSize: 138},
];

/* -------------------------------------------------------------------------- */
/*  五块玄黑巨岩                                                              */
/* -------------------------------------------------------------------------- */

export type RockSide = 'left' | 'right' | 'top' | 'bottom' | 'corner';

export interface RockSlot {
  id: string;
  side: RockSide;
  dropAt: number;
  /** 落位后的内缘顶点（指向画面中心的折线）。 */
  edge: Array<[number, number]>;
}

/**
 * 五块岩石把画面挤成一条竖直石缝：左、右、上、下各一块，第五块从左下压角。
 * edge 是**落位后**的内侧锯齿边，落位前整体沿 side 方向外移 1400px。
 */
export const ROCKS: RockSlot[] = [
  {
    id: 'r-left',
    side: 'left',
    dropAt: CUE.rockDrops[0]!,
    edge: [
      [0, -80],
      [470, -80],
      [392, 168],
      [512, 300],
      [404, 470],
      [498, 640],
      [388, 812],
      [470, 980],
      [0, 1180],
    ],
  },
  {
    id: 'r-right',
    side: 'right',
    dropAt: CUE.rockDrops[1]!,
    edge: [
      [1920, -80],
      [1450, -80],
      [1528, 168],
      [1408, 300],
      [1516, 470],
      [1422, 640],
      [1532, 812],
      [1450, 980],
      [1920, 1180],
    ],
  },
  {
    id: 'r-top',
    side: 'top',
    dropAt: CUE.rockDrops[2]!,
    edge: [
      [-80, 0],
      [2000, 0],
      [2000, 96],
      [1524, 214],
      [1188, 128],
      [860, 236],
      [560, 140],
      [252, 236],
      [-80, 176],
    ],
  },
  {
    id: 'r-bottom',
    side: 'bottom',
    dropAt: CUE.rockDrops[3]!,
    edge: [
      [-80, 1180],
      [2000, 1180],
      [2000, 1004],
      [1500, 906],
      [1140, 1006],
      [840, 902],
      [470, 1008],
      [-80, 940],
    ],
  },
  {
    id: 'r-corner',
    side: 'corner',
    dropAt: CUE.rockDrops[4]!,
    edge: [
      [-120, 1180],
      [520, 1180],
      [392, 994],
      [512, 902],
      [300, 830],
      [-120, 880],
    ],
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
  /** 0 = 远景, 1 = 中景, 2 = 前景. */
  depth: 0 | 1 | 2;
  revealAt: number | null;
  /** 被跳切震碎的四分之一象限；null = 不碎。 */
  shatterAt: number | null;
}

const FILLER = ['罪', '名', '欺', '天', '妄', '言', '犯', '上', '狂', '徒', '逆', '天', '不', '臣', '妖', '猴', '当', '诛', '天', '条'];

export const TAG_SLOTS: TagSlot[] = [
  ...Array.from({length: 11}, (_, index) => ({
    id: `far-${index}`,
    text: FILLER[index % FILLER.length]!,
    x: 96 + index * 172,
    y: 128 + (index % 3) * 24,
    width: 62,
    height: 250 + (index % 4) * 20,
    swingPhase: index * 0.83,
    swingAmp: 1.3,
    depth: 0 as const,
    revealAt: null,
    shatterAt: CUE.jumpCuts[index % 4]!,
  })),
  ...Array.from({length: 7}, (_, index) => ({
    id: `mid-${index}`,
    text: FILLER[(index + 6) % FILLER.length]!,
    x: 236 + index * 236,
    y: 196 + (index % 2) * 34,
    width: 96,
    height: 366 + (index % 3) * 26,
    swingPhase: index * 1.27 + 0.6,
    swingAmp: 2.4,
    depth: 1 as const,
    revealAt: null,
    shatterAt: CUE.jumpCuts[index % 4]!,
  })),
  {
    id: 'hero-0',
    text: '罪名',
    x: 384,
    y: 300,
    width: 190,
    height: 566,
    swingPhase: 0.4,
    swingAmp: 1.7,
    depth: 2,
    revealAt: CUE.tagReveals[0]!,
    shatterAt: CUE.jumpCuts[0]!,
  },
  {
    id: 'hero-1',
    text: '是',
    x: 960,
    y: 262,
    width: 182,
    height: 548,
    swingPhase: 2.1,
    swingAmp: 1.4,
    depth: 2,
    revealAt: CUE.tagReveals[1]!,
    shatterAt: CUE.jumpCuts[1]!,
  },
  {
    id: 'hero-2',
    text: '老孙',
    x: 1536,
    y: 310,
    width: 190,
    height: 566,
    swingPhase: 3.4,
    swingAmp: 1.9,
    depth: 2,
    revealAt: CUE.tagReveals[2]!,
    shatterAt: CUE.jumpCuts[2]!,
  },
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
  {id: 'seal-0', text: '不', landAt: CUE.sealLands[0]!, x: 318, y: 246, size: 372, rotate: -7},
  {id: 'seal-1', text: '敬', landAt: CUE.sealLands[1]!, x: 1602, y: 262, size: 366, rotate: 6},
  {id: 'seal-2', text: '权', landAt: CUE.sealLands[2]!, x: 330, y: 838, size: 360, rotate: 4},
  {id: 'seal-3', text: '威', landAt: CUE.sealLands[3]!, x: 1590, y: 832, size: 368, rotate: -5},
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
  ...CUE.panelDrop.map((time) => ({time, power: 0.4, axis: 'both' as const})),
  {time: CUE.panelExit, power: 0.6, axis: 'x'},
  {time: CUE.siege.start, power: 0.55, axis: 'both'},
  ...CUE.armyWaves.map((time) => ({time, power: 0.3, axis: 'x' as const})),
  {time: CUE.eyeBand.start, power: 0.8, axis: 'x'},
  {time: CUE.eyeBand.open, power: 0.55, axis: 'x'},
  ...CUE.eyeWords.map((time) => ({time, power: 0.42, axis: 'both' as const})),
  {time: CUE.palace.start, power: 0.7, axis: 'both'},
  {time: CUE.staffSweep, power: 1, axis: 'both', invert: true},
  ...CUE.rockDrops.map((time) => ({time, power: 0.85, axis: 'y' as const})),
  ...CUE.chains.map((time) => ({time, power: 0.26, axis: 'both' as const})),
  ...CUE.talismanText.map((time) => ({time, power: 0.2, axis: 'both' as const})),
  {time: CUE.chamber, power: 0.6, axis: 'x'},
  ...CUE.tagReveals.map((time) => ({time, power: 0.3, axis: 'both' as const})),
  ...CUE.jumpCuts.map((time) => ({time, power: 1, axis: 'both' as const, invert: true})),
  ...CUE.sealLands.map((time) => ({time, power: 0.9, axis: 'both' as const})),
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

/** 第 112–113 帧的全屏黑白反色窗口；四连跳切各吃 1 帧。 */
export const invertAt = (frame: number, fps: number): boolean => {
  const start = atFrame(CUE.invert[0], fps);
  const end = atFrame(CUE.invert[1], fps);
  if (frame >= start && frame <= end) return true;
  for (const cue of IMPACTS) {
    if (!cue.invert) continue;
    if (cue.time >= CUE.invert[0] && cue.time <= CUE.invert[1]) continue;
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
