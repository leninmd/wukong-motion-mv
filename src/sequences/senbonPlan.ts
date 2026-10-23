/**
 * 10 秒复刻段（300 帧 @ 30 fps）的唯一分镜表 —— V8。
 *
 * 时间只有两套，互不越界：
 *  1. `sb(n)` —— 分镜板帧号 → 秒。板号只在本文件出现，场景代码只看秒/帧
 *     （AGENTS.md §1）。V8 的板号：
 *       Sub1A 0–30 / Sub1B 30–75 / Sub2A 75–98 / Sub2B 98–150 /
 *       Sub3A 150–175 / Sub3B 175–225 / Sub4A 225–256 / Sub4B 256–291 / 黑 291–300。
 *  2. `unit()` —— 歌词字级落点，来自 `public/alignment/climax_words.json`。
 *
 * V8 新增 `CUE.wipe`：五处"物理遮罩转场"横跨相邻两镜，渲染窗口因此比
 * `SHOTS` 的硬边界更宽（例如 1A 画格撑开一直画到 34 帧，1B 从 26 帧
 * 就在后面待命）。场景代码只读 `CUE.wipe`，不得再写另一套转场帧号。
 *
 * 例外说明（登记在 docs/EXPLORATION_LOG.md）：
 *  - Sub2A 的【怎】【敌】【我】被板号钉死在 75–98 帧的横条分格内，而字级
 *    对齐落在 87 / 96 / 104 帧（最后一字超出分格）。为了保证横条完整，这三字
 *    改用板号节拍 75 / 82 / 89。
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
  /* Sub1A —— 四分屏微缩画卷。V8：等障子门拉开一半，四格才依次砸入。 */
  panelDrop: [sb(0), sb(0.5), sb(1), sb(1.5)],
  panelExit: sb(26),
  panelGone: sb(34),

  /* Sub1B —— 侧面旋风棍盾 */
  shield: {start: sb(30), end: sb(75)},
  armyWaves: [sb(36), sb(50), sb(64)],

  /* Sub2A —— 眼部横切 */
  eyeBand: {start: sb(75), open: sb(73), end: sb(98)},
  eyeWords: [sb(75), sb(82), sb(89)],

  /* Sub2B —— 3D 崩裂 + 劈字 */
  palace: {start: sb(98), end: sb(150)},
  slash: {reveal: sb(104), cut: sb(112)},
  invert: [sb(112), sb(113)],
  /** V8：左下角大圣从"后拉蓄力"硬切到"腾空劈斩"的动作帧。 */
  actionSwitch: sb(112),

  /* Sub3A/3B —— 巨岩 + 铁索 */
  mountain: {start: sb(150), mid: sb(175), end: sb(225)},
  rockDrops: [sb(150), sb(151), sb(152), sb(153), sb(154)],
  kneelReveal: sb(155),
  chains: [sb(156), sb(160), sb(164), sb(168), sb(172), sb(176)],
  /** V8：五指山 1.25×/-120px 压降至 1.0/0 的时间窗。 */
  mountainPress: {start: sb(150), end: sb(158)},

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

  /* V8 —— 五处无缝物理遮罩转场。跨镜重叠窗口，全部由场景读取。 */
  wipe: {
    /** 0–9 帧：玄黑描金障子门向两侧猛烈拉开，露出 1A 四分屏。 */
    doors: {start: sb(0), end: sb(9)},
    /** 26–34 帧：第 4 格（大圣格）向左右撑满 1920px，前 3 格被推出左侧。 */
    expand: {start: sb(26), end: sb(34)},
    /** 70–76 帧：金箍棒刀光把 1B 上下劈开，从裂缝里撑开 2A。 */
    split: {start: sb(70), end: sb(76)},
    /** 144–156 帧：黑山与浮世绘云海从两侧对撞合拢，掩埋 2B 后拉开 3A。 */
    smash: {start: sb(144), end: sb(156)},
    /** 220–228 帧：密集铁索与黑幡从顶部拉下遮满全屏，再裂开垂落 4A。 */
    chain: {start: sb(220), end: sb(228)},
  },
} as const;

/**
 * V8 四连跳切：每一次都是跨量级的构图/色彩跳变，不再允许 1.0→1.04 的
 * "蚊子腿缩放"。`eye` 是把素材双眼对齐到画面 45% 的取景锚点。
 */
export const JUMP_CUTS = [
  {scale: 1.05, rotate: 0, tone: 'paper', text: '不', sealIndex: 0},
  {scale: 1.42, rotate: -6, tone: 'duotone', text: '敬', sealIndex: 1},
  {scale: 1.95, rotate: 5, tone: 'impact', text: '权', sealIndex: 2},
  {scale: 1.25, rotate: 0, tone: 'paper', text: '威', sealIndex: 3},
] as const;

export type JumpCutTone = (typeof JUMP_CUTS)[number]['tone'];

/** `face_glare_woodblock.png` 的双眼中心（像素）与对齐目标（屏幕比例）。 */
export const FACE_FOCUS = {
  /** 由橙色虹膜连通域量出的双眼中心（不是肉眼估的 678/612）。 */
  eyeX: 836,
  eyeY: 714,
  size: 2048,
  targetX: 0.5,
  targetY: 0.45,
} as const;

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
  /** V5：该格的和纸底色（四格四色）。 */
  tone: string;
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
    tone: '#EAE0CE',
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
    tone: '#7A1C1C',
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
    tone: '#1B1521',
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
    tone: '#C29526',
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

/** 六道实体铁索，交叉锁死岩壁。V7 改为大倾角 X 网，且全部画在角色之后。 */
export const CHAINS: ChainSlot[] = [
  {id: 'c1', arriveAt: CUE.chains[0]!, x1: -60, y1: 180, x2: 1980, y2: 760, sag: 22},
  {id: 'c2', arriveAt: CUE.chains[1]!, x1: 1980, y1: 160, x2: -60, y2: 780, sag: 26},
  {id: 'c3', arriveAt: CUE.chains[2]!, x1: -60, y1: 520, x2: 1980, y2: 1040, sag: 18},
  {id: 'c4', arriveAt: CUE.chains[3]!, x1: 1980, y1: 500, x2: -60, y2: 1060, sag: 20},
  {id: 'c5', arriveAt: CUE.chains[4]!, x1: 120, y1: 1040, x2: 900, y2: 260, sag: 14},
  {id: 'c6', arriveAt: CUE.chains[5]!, x1: 1800, y1: 1040, x2: 1020, y2: 260, sag: 14},
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
  {id: 't1', text: '五指山下', revealAt: CUE.ofuda[0]!, x: 286, y: 396, width: 174, height: 418, rotate: -6.5},
  {id: 't2', text: '偿', revealAt: CUE.ofuda[1]!, x: 470, y: 742, width: 148, height: 306, rotate: 4},
  {id: 't3', text: '自', revealAt: CUE.ofuda[2]!, x: 1452, y: 748, width: 148, height: 306, rotate: -4.5},
  {id: 't4', text: '由', revealAt: CUE.ofuda[3]!, x: 1638, y: 404, width: 168, height: 360, rotate: 6},
  {id: 't5', text: '的', revealAt: CUE.ofuda[4]!, x: 622, y: 210, width: 142, height: 288, rotate: 5},
  {id: 't6', text: '罪', revealAt: CUE.ofuda[5]!, x: 1300, y: 214, width: 150, height: 300, rotate: -6},
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
  {id: 'seal-0', text: '不', landAt: CUE.sealLands[0]!, x: 302, y: 246, size: 270, rotate: -7},
  {id: 'seal-1', text: '敬', landAt: CUE.sealLands[1]!, x: 1614, y: 258, size: 270, rotate: 6},
  {id: 'seal-2', text: '权', landAt: CUE.sealLands[2]!, x: 312, y: 844, size: 270, rotate: 4},
  {id: 'seal-3', text: '威', landAt: CUE.sealLands[3]!, x: 1602, y: 838, size: 270, rotate: -5},
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
  {time: CUE.wipe.expand.end, power: 0.62, axis: 'both'},
  {time: CUE.shield.start, power: 0.52, axis: 'both'},
  ...CUE.armyWaves.map((time) => ({time, power: 0.26, axis: 'x' as const})),
  {time: CUE.wipe.split.start, power: 0.9, axis: 'both'},
  {time: CUE.eyeBand.start, power: 0.82, axis: 'x'},
  {time: CUE.eyeBand.open, power: 0.5, axis: 'x'},
  ...CUE.eyeWords.map((time) => ({time, power: 0.42, axis: 'both' as const})),
  {time: CUE.palace.start, power: 0.7, axis: 'both'},
  {time: CUE.slash.cut, power: 1, axis: 'both'},
  ...CUE.rockDrops.map((time) => ({time, power: 0.5, axis: 'y' as const})),
  {time: CUE.wipe.smash.start + 0.2, power: 0.85, axis: 'both'},
  ...CUE.chains.map((time) => ({time, power: 0.24, axis: 'both' as const})),
  ...CUE.ofuda.map((time) => ({time, power: 0.2, axis: 'both' as const})),
  {time: CUE.wipe.chain.start, power: 0.55, axis: 'y'},
  {time: CUE.wipe.chain.start + 0.13, power: 0.9, axis: 'both'},
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

/**
 * 第 115–116 帧的全屏黑白反色（2B 刀光 Impact Frame）。
 *
 * V8 删掉了 V7"四枚巨印落地各反色 2 帧"的规则：4B 的四次跳切本来就有
 * 宣纸 / 黑金红 / 红黑三套色彩，再整屏反色会把它们全部翻成青蓝色，
 * 258 / 266 / 274 / 282 四个验收帧全部作废。跳切的冲击改由局部刀光与
 * 巨印本身承担。
 */
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
