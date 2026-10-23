/**
 * 孙悟空 2.5D 骨骼模型 —— 几何唯一真源。
 *
 * 设计约束（AGENTS.md §5 + 本次重制要求）：
 *  - 全部轮廓都是**直边多边形**（多面体折线装甲），禁止任何圆/椭圆/螺旋。
 *  - 身体内部填充恒为纯墨黑 `#0B090A`；外描边为 2px 鎏金。
 *  - 面部**只有**两道倒三角赤金眼眸与额头金箍，没有鼻子、嘴、腮红、胸口旋涡。
 *
 * 这个文件不 import 任何东西（Node 的类型擦除可以直接 import 它），
 * `scripts/export_wukong_model.mjs` 会把它导出成
 * `public/wukong_model/*.json|*.svg`，Python 再栅格化成透明 PNG。
 */

export type Pt = readonly [number, number];

/** 局部坐标系：820 × 1120，人物中轴 x = 410。 */
export const RIG_W = 820;
export const RIG_H = 1120;
export const AXIS = RIG_W / 2;

export type Material = 'ink' | 'gold' | 'cinnabar' | 'goldLine' | 'rim';

export interface RigPart {
  id: string;
  /** 绘制顺序，小的在后。 */
  layer: number;
  points: Pt[];
  material: Material;
}

export interface FeatherRoot {
  origin: Pt;
  /** 根部朝向（弧度，0 = 向右，-PI/2 = 向上）。 */
  angle: number;
  length: number;
  /** 弯曲偏手性：+1 向右卷，-1 向左卷。 */
  hand: 1 | -1;
  /** 根部半宽。 */
  width: number;
}

export type WukongPose =
  | 'spin_staff'
  | 'slash_horizontally'
  | 'trapped_overhead'
  | 'snarl_closeup'
  | 'side_lunge'
  | 'kneel_boulder'
  | 'back_overlook';

export interface StaffSpec {
  pivot: Pt;
  length: number;
  thickness: number;
  /** 静止角（弧度），组件按帧叠加旋转。 */
  angle: number;
  /** 双手握点（局部坐标），画成叠在棒上的角状护手。 */
  grips: Pt[];
}

export interface PoseGeometry {
  id: WukongPose;
  viewBox: [number, number];
  parts: RigPart[];
  /** 倒三角眼眸（左/右），以及内部的瞳芯。 */
  eyes: {left: Pt[]; right: Pt[]; coreLeft: Pt[]; coreRight: Pt[]};
  /** 金箍主体 + 中央冠饰 + 两侧凤翅。 */
  crown: Pt[];
  crownCrest: Pt[];
  crownWings: Pt[][];
  feathers: FeatherRoot[];
  staff: StaffSpec | null;
  /** 眼部光晕中心与半径（画在剪影之上）。 */
  eyeFocus: {x: number; y: number; r: number};
  /** 整个角色的外发光强度倍率。 */
  aura: number;
}

/* -------------------------------------------------------------------------- */
/*  基础构造                                                                  */
/* -------------------------------------------------------------------------- */

export const mirror = (points: Pt[]): Pt[] =>
  points.map(([x, y]) => [RIG_W - x, y] as Pt);

/** 关于任意轴的镜像。 */
export const mirrorAbout = (points: Pt[], axis: number): Pt[] =>
  points.map(([x, y]) => [axis * 2 - x, y] as Pt);

/** 关于任意点旋转（弧度）。 */
export const rotateAbout = (points: Pt[], [ox, oy]: Pt, angle: number): Pt[] => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y]) => {
    const dx = x - ox;
    const dy = y - oy;
    return [ox + dx * c - dy * s, oy + dx * s + dy * c] as Pt;
  });
};

export const translate = (points: Pt[], dx: number, dy: number): Pt[] =>
  points.map(([x, y]) => [x + dx, y + dy] as Pt);

const norm = ([ax, ay]: Pt, [bx, by]: Pt): {nx: number; ny: number; len: number} => {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return {nx: -dy / len, ny: dx / len, len};
};

/**
 * 锥形装甲肢节：从 a 到 b，宽度 wa → wb，中段鼓出一点，两端各带一个斜切头。
 * 全部直边，读起来像折面金属而不是圆柱。
 */
export const limb = (a: Pt, b: Pt, wa: number, wb: number, bulge = 0.16): Pt[] => {
  const {nx, ny} = norm(a, b);
  const mid: Pt = [a[0] + (b[0] - a[0]) * 0.36, a[1] + (b[1] - a[1]) * 0.36];
  const wm = wa + (wb - wa) * 0.36 + Math.abs(wa) * bulge;
  return [
    [a[0] + nx * wa, a[1] + ny * wa],
    [mid[0] + nx * wm, mid[1] + ny * wm],
    [b[0] + nx * wb, b[1] + ny * wb],
    [b[0] - nx * wb, b[1] - ny * wb],
    [mid[0] - nx * wm, mid[1] - ny * wm],
    [a[0] - nx * wa, a[1] - ny * wa],
  ];
};

/** 带尖角的下垂甲片（裙甲 / 肩鳞）。 */
export const tasset = (top: Pt, bottom: Pt, width: number, tipShift = 0): Pt[] => {
  const {nx, ny} = norm(top, bottom);
  const [tx, ty] = top;
  const [bx, by] = bottom;
  const hw = width / 2;
  return [
    [tx + nx * hw, ty + ny * hw],
    [bx + nx * hw * 0.72, by + ny * hw * 0.72],
    [bx + tipShift, by + width * 0.26],
    [bx - nx * hw * 0.72, by - ny * hw * 0.72],
    [tx - nx * hw, ty - ny * hw],
  ];
};

/**
 * 倒三角赤金眼眸：外角在组外侧、内角向下压 → 凶相。
 * (cx, cy) 为上边中点，w 为上边宽，h 为高度，tilt 为内角下沉量。
 */
export const eyeWedge = (
  cx: number,
  cy: number,
  w: number,
  h: number,
  tilt: number,
  facing: 1 | -1,
): Pt[] => {
  const half = w / 2;
  return [
    [cx - half * facing, cy],
    [cx + half * facing, cy + tilt],
    [cx + half * 0.16 * facing, cy + h],
  ];
};

/**
 * 瞳芯：竖立瞳缝（猫科/猴王的竖瞳），而不是缩放后的同形三角形。
 * 越靠下的收窄越明显，读起来是一道被压扁的高光，而不是一块白斑。
 */
export const eyeCore = (points: Pt[], factor = 0.42): Pt[] => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = minY + (maxY - minY) * 0.42;
  const halfW = ((maxX - minX) / 2) * factor * 0.34;
  const halfH = ((maxY - minY) / 2) * factor * 1.5;
  return [
    [cx - halfW, cy - halfH],
    [cx + halfW, cy - halfH],
    [cx + halfW * 0.55, cy + halfH],
    [cx - halfW * 0.55, cy + halfH],
  ];
};

/** 爪子：从腕部发出 n 根尖锐指节。 */
export const claw = (
  wrist: Pt,
  tipAngle: number,
  spread: number,
  count: number,
  length: number,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = tipAngle - spread / 2 + spread * t;
    const mid: Pt = [
      wrist[0] + Math.cos(angle) * length * 0.5,
      wrist[1] + Math.sin(angle) * length * 0.5,
    ];
    const tip: Pt = [
      wrist[0] + Math.cos(angle) * length,
      wrist[1] + Math.sin(angle) * length,
    ];
    const side = angle + Math.PI / 2;
    const r = length * 0.085;
    out.push(
      [mid[0] + Math.cos(side) * r, mid[1] + Math.sin(side) * r],
      tip,
      [mid[0] - Math.cos(side) * r, mid[1] - Math.sin(side) * r],
    );
  }
  return out;
};

const part = (id: string, layer: number, material: Material, points: Pt[]): RigPart => ({
  id,
  layer,
  material,
  points,
});

/* -------------------------------------------------------------------------- */
/*  共用的头 / 冠 / 躯干子件                                                   */
/* -------------------------------------------------------------------------- */

/** 头骨轮廓（正面 3/4，尖下颌、宽颧骨）。 */
const SKULL: Pt[] = [
  [356, 196],
  [370, 158],
  [410, 144],
  [450, 158],
  [464, 196],
  [458, 244],
  [436, 286],
  [410, 302],
  [384, 286],
  [362, 244],
];

/** 侧颊的凤翅尖角。 */
const CHEEK_L: Pt[] = [
  [360, 210],
  [310, 186],
  [322, 244],
  [354, 264],
];

/** 下颌护面（浅折面，靠描边读出来）。 */
const JAW: Pt[] = [
  [368, 246],
  [410, 260],
  [452, 246],
  [434, 288],
  [410, 306],
  [386, 288],
];

/** 金箍：贴着眉骨的一道窄带，不做出帽檐。 */
const CROWN: Pt[] = [
  [345, 199],
  [360, 178],
  [410, 168],
  [460, 178],
  [475, 199],
  [462, 209],
  [410, 187],
  [358, 209],
];

/** 冠心：向上的尖锥。 */
const CROWN_CREST: Pt[] = [
  [410, 172],
  [397, 132],
  [410, 94],
  [423, 132],
];

/** 两侧上扬的凤翅。 */
const CROWN_WING_L: Pt[] = [
  [348, 198],
  [280, 148],
  [306, 196],
  [342, 214],
];

const GORGET: Pt[] = [
  [380, 300],
  [410, 308],
  [440, 300],
  [456, 342],
  [410, 366],
  [364, 342],
];

const CHEST: Pt[] = [
  [358, 340],
  [410, 322],
  [462, 340],
  [498, 392],
  [490, 476],
  [462, 542],
  [410, 570],
  [358, 542],
  [330, 476],
  [322, 392],
];

const CHEST_V: Pt[] = [
  [410, 352],
  [478, 436],
  [410, 522],
  [342, 436],
];

const CHEST_V_INNER: Pt[] = [
  [410, 388],
  [448, 438],
  [410, 480],
  [372, 438],
];

const CHEST_CHEVRON_1: Pt[] = [
  [364, 498],
  [410, 476],
  [456, 498],
  [456, 516],
  [410, 494],
  [364, 516],
];

const CHEST_CHEVRON_2: Pt[] = [
  [372, 532],
  [410, 514],
  [448, 532],
  [448, 548],
  [410, 530],
  [372, 548],
];

const ABDOMEN: Pt[] = [
  [362, 542],
  [410, 570],
  [458, 542],
  [462, 688],
  [410, 706],
  [358, 688],
];

const ABDOMEN_STRIP: Pt[] = [
  [410, 580],
  [426, 642],
  [410, 698],
  [394, 642],
];

const BELT: Pt[] = [
  [346, 696],
  [410, 680],
  [474, 696],
  [468, 734],
  [410, 718],
  [352, 734],
];

const BUCKLE: Pt[] = [
  [410, 684],
  [438, 708],
  [410, 736],
  [382, 708],
];

/** 肩甲：一枚高高上扬的尖角 + 两片叠鳞。 */
const PAULDRON_L: Pt[] = [
  [358, 336],
  [272, 278],
  [322, 352],
  [296, 372],
  [258, 444],
  [316, 478],
  [354, 424],
  [352, 374],
];

const PAULDRON_L_SCALE: Pt[] = [
  [352, 380],
  [286, 410],
  [276, 468],
  [326, 500],
  [356, 452],
];

/** 披风：被风吹向侧后的破布。 */
const CAPE_L: Pt[] = [
  [352, 396],
  [292, 408],
  [262, 528],
  [252, 656],
  [232, 748],
  [272, 706],
  [262, 812],
  [302, 742],
  [318, 618],
  [334, 472],
];

/* -------------------------------------------------------------------------- */
/*  Pose 1 — spin_staff                                                       */
/* -------------------------------------------------------------------------- */

const buildSpinStaff = (): PoseGeometry => {
  const hipL: Pt = [366, 724];
  const hipR: Pt = [454, 724];
  const kneeL: Pt = [330, 892];
  const kneeR: Pt = [490, 892];
  const ankleL: Pt = [306, 1032];
  const ankleR: Pt = [514, 1032];
  const shoulderL: Pt = [330, 382];
  const shoulderR: Pt = [490, 382];
  const elbowL: Pt = [258, 512];
  const elbowR: Pt = [562, 512];
  const wristL: Pt = [354, 556];
  const wristR: Pt = [466, 556];

  const parts: RigPart[] = [
    part('cape-l', 1, 'ink', CAPE_L),
    part('cape-r', 1, 'ink', mirror(CAPE_L)),
    part('cape-ribbon-l', 2, 'goldLine', [
      [300, 520],
      [268, 648],
      [252, 776],
      [276, 690],
      [292, 552],
    ]),
    part('cape-ribbon-r', 2, 'goldLine', mirror([[300, 520], [268, 648], [252, 776], [276, 690], [292, 552]])),

    part('thigh-l', 10, 'ink', limb(hipL, kneeL, 42, 30)),
    part('thigh-r', 10, 'ink', mirror(limb(hipL, kneeL, 42, 30))),
    part('shin-l', 11, 'ink', limb(kneeL, ankleL, 29, 20)),
    part('shin-r', 11, 'ink', mirror(limb(kneeL, ankleL, 29, 20))),
    part('knee-l', 12, 'gold', [
      [330, 858],
      [356, 892],
      [330, 926],
      [304, 892],
    ]),
    part('knee-r', 12, 'gold', mirror([[330, 858], [356, 892], [330, 926], [304, 892]])),
    part('boot-l', 13, 'ink', [
      [290, 1018],
      [232, 1052],
      [216, 1082],
      [332, 1082],
      [338, 1026],
      [318, 1014],
    ]),
    part('boot-r', 13, 'ink', mirror([[290, 1018], [232, 1052], [216, 1082], [332, 1082], [338, 1026], [318, 1014]])),

    part('tasset-c', 20, 'ink', tasset([410, 716], [410, 946], 78)),
    part('tasset-il', 20, 'ink', translate(tasset([410, 716], [386, 912], 60), -44, 0)),
    part('tasset-ir', 20, 'ink', mirror(translate(tasset([410, 716], [386, 912], 60), -44, 0))),
    part('tasset-ol', 20, 'ink', translate(tasset([410, 716], [330, 864], 56), -92, 0)),
    part('tasset-or', 20, 'ink', mirror(translate(tasset([410, 716], [330, 864], 56), -92, 0))),
    part('abdomen', 21, 'ink', ABDOMEN),
    part('abdomen-strip', 22, 'goldLine', ABDOMEN_STRIP),
    part('chest', 23, 'ink', CHEST),
    part('chest-v', 24, 'goldLine', CHEST_V),
    part('chest-v-inner', 25, 'goldLine', CHEST_V_INNER),
    part('chevron-1', 25, 'goldLine', CHEST_CHEVRON_1),
    part('chevron-2', 25, 'goldLine', CHEST_CHEVRON_2),
    part('belt', 26, 'gold', BELT),
    part('buckle', 27, 'cinnabar', BUCKLE),

    part('upperarm-l', 30, 'ink', limb(shoulderL, elbowL, 30, 23)),
    part('upperarm-r', 30, 'ink', limb(shoulderR, elbowR, 30, 23)),
    part('forearm-l', 31, 'ink', limb(elbowL, wristL, 24, 16)),
    part('forearm-r', 31, 'ink', limb(elbowR, wristR, 24, 16)),
    part('pauldron-l', 32, 'ink', PAULDRON_L),
    part('pauldron-r', 32, 'ink', mirror(PAULDRON_L)),
    part('pauldron-scale-l', 33, 'ink', PAULDRON_L_SCALE),
    part('pauldron-scale-r', 33, 'ink', mirror(PAULDRON_L_SCALE)),

    part('cheek-l', 40, 'ink', CHEEK_L),
    part('cheek-r', 40, 'ink', mirror(CHEEK_L)),
    part('gorget', 41, 'ink', GORGET),
    part('skull', 42, 'ink', SKULL),
    part('jaw', 43, 'rim', JAW),
    part('brow', 44, 'goldLine', [
      [350, 200],
      [374, 212],
      [410, 200],
      [446, 212],
      [470, 200],
    ]),
  ];

  return {
    id: 'spin_staff',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eyeWedge(376, 214, 56, 30, 13, 1),
      right: eyeWedge(444, 214, 56, 30, 13, -1),
      coreLeft: eyeCore(eyeWedge(376, 214, 56, 30, 13, 1), 0.3),
      coreRight: eyeCore(eyeWedge(444, 214, 56, 30, 13, -1), 0.3),
    },
    crown: CROWN,
    crownCrest: CROWN_CREST,
    crownWings: [CROWN_WING_L, mirror(CROWN_WING_L)],
    feathers: [
      {origin: [394, 160], angle: -Math.PI / 2 - 0.2, length: 280, hand: -1, width: 40},
      {origin: [426, 160], angle: -Math.PI / 2 + 0.2, length: 280, hand: 1, width: 40},
    ],
    staff: {
      pivot: [410, 604],
      length: 720,
      thickness: 24,
      angle: 0.32,
      grips: [wristL, wristR],
    },
    eyeFocus: {x: 410, y: 224, r: 84},
    aura: 1,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 2 — slash_horizontally                                               */
/* -------------------------------------------------------------------------- */

const buildSlash = (): PoseGeometry => {
  const hipL: Pt = [372, 716];
  const hipR: Pt = [466, 702];
  const kneeL: Pt = [286, 860];
  const kneeR: Pt = [568, 854];
  const ankleL: Pt = [214, 998];
  const ankleR: Pt = [640, 1008];
  const shoulderL: Pt = [336, 388];
  const shoulderR: Pt = [498, 358];
  const elbowL: Pt = [268, 488];
  const elbowR: Pt = [604, 406];
  const wristL: Pt = [322, 572];
  const wristR: Pt = [702, 454];

  /* 躯干整体绕腰部前倾，制造挥棒的力量线 */
  const lean = -0.19;
  const pivot: Pt = [418, 702];
  const L = (points: Pt[]): Pt[] => rotateAbout(points, pivot, lean);

  const parts: RigPart[] = [
    part('cape-back', 1, 'ink', [
      [330, 396],
      [222, 456],
      [168, 646],
      [208, 818],
      [300, 730],
      [318, 544],
    ]),
    part('cape-ribbon', 2, 'goldLine', [
      [286, 472],
      [216, 604],
      [200, 776],
      [240, 694],
      [260, 522],
    ]),

    part('thigh-l', 10, 'ink', limb(hipL, kneeL, 44, 31)),
    part('thigh-r', 10, 'ink', limb(hipR, kneeR, 44, 31)),
    part('shin-l', 11, 'ink', limb(kneeL, ankleL, 30, 20)),
    part('shin-r', 11, 'ink', limb(kneeR, ankleR, 30, 20)),
    part('knee-l', 12, 'gold', [
      [286, 828],
      [310, 860],
      [286, 894],
      [262, 860],
    ]),
    part('knee-r', 12, 'gold', [
      [568, 822],
      [592, 854],
      [568, 888],
      [544, 854],
    ]),
    part('boot-l', 13, 'ink', [
      [200, 988],
      [138, 1028],
      [126, 1046],
      [232, 1046],
      [238, 998],
    ]),
    part('boot-r', 13, 'ink', [
      [626, 998],
      [696, 1038],
      [708, 1056],
      [598, 1056],
      [592, 1006],
    ]),

    part('tasset-c', 20, 'ink', L(tasset([418, 708], [418, 918], 80))),
    part('tasset-il', 20, 'ink', L(translate(tasset([418, 708], [386, 878], 60), -44, 0))),
    part('tasset-ir', 20, 'ink', L(translate(tasset([418, 708], [450, 878], 60), 44, 0))),
    part('tasset-ol', 20, 'ink', L(translate(tasset([418, 708], [330, 840], 56), -90, 0))),
    part('tasset-or', 20, 'ink', L(translate(tasset([418, 708], [506, 840], 56), 90, 0))),
    part('abdomen', 21, 'ink', L(ABDOMEN)),
    part('abdomen-strip', 22, 'goldLine', L(ABDOMEN_STRIP)),
    part('chest', 23, 'ink', L(CHEST)),
    part('chest-v', 24, 'goldLine', L(CHEST_V)),
    part('chest-v-inner', 25, 'goldLine', L(CHEST_V_INNER)),
    part('chevron-1', 25, 'goldLine', L(CHEST_CHEVRON_1)),
    part('chevron-2', 25, 'goldLine', L(CHEST_CHEVRON_2)),
    part('belt', 26, 'gold', L(BELT)),
    part('buckle', 27, 'cinnabar', L(BUCKLE)),

    part('upperarm-l', 30, 'ink', limb(shoulderL, elbowL, 30, 23)),
    part('upperarm-r', 30, 'ink', limb(shoulderR, elbowR, 30, 23)),
    part('forearm-l', 31, 'ink', limb(elbowL, wristL, 24, 16)),
    part('forearm-r', 31, 'ink', limb(elbowR, wristR, 24, 16)),
    part('pauldron-l', 32, 'ink', L(PAULDRON_L)),
    part('pauldron-r', 32, 'ink', L(mirror(PAULDRON_L))),
    part('pauldron-scale-l', 33, 'ink', L(PAULDRON_L_SCALE)),
    part('pauldron-scale-r', 33, 'ink', L(mirror(PAULDRON_L_SCALE))),

    part('cheek-l', 40, 'ink', L(CHEEK_L)),
    part('cheek-r', 40, 'ink', L(mirror(CHEEK_L))),
    part('gorget', 41, 'ink', L(GORGET)),
    part('skull', 42, 'ink', L(SKULL)),
    part('jaw', 43, 'rim', L(JAW)),
    part('brow', 44, 'goldLine', L([
      [350, 200],
      [374, 212],
      [410, 200],
      [446, 212],
      [470, 200],
    ])),
  ];

  const eyeL = L(eyeWedge(376, 214, 56, 30, 13, 1));
  const eyeR = L(eyeWedge(444, 214, 56, 30, 13, -1));

  return {
    id: 'slash_horizontally',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eyeL,
      right: eyeR,
      coreLeft: eyeCore(eyeL, 0.3),
      coreRight: eyeCore(eyeR, 0.3),
    },
    crown: L(CROWN),
    crownCrest: L(CROWN_CREST),
    crownWings: [L(CROWN_WING_L), L(mirror(CROWN_WING_L))],
    feathers: [
      {origin: L([[394, 160]])[0]!, angle: -Math.PI / 2 - 0.7, length: 280, hand: -1, width: 40},
      {origin: L([[426, 160]])[0]!, angle: -Math.PI / 2 - 0.36, length: 280, hand: 1, width: 40},
    ],
    staff: {
      pivot: wristR,
      length: 880,
      thickness: 26,
      angle: 0.04,
      grips: [wristR],
    },
    eyeFocus: {x: 396, y: 226, r: 84},
    aura: 1.05,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 3 — trapped_overhead                                                 */
/* -------------------------------------------------------------------------- */

const buildTrapped = (): PoseGeometry => {
  const skull: Pt[] = [
    [286, 512],
    [320, 454],
    [410, 434],
    [500, 454],
    [534, 512],
    [524, 606],
    [470, 674],
    [410, 694],
    [350, 674],
    [296, 606],
  ];

  const jaw: Pt[] = [
    [332, 602],
    [410, 574],
    [488, 602],
    [468, 666],
    [410, 702],
    [352, 666],
  ];

  const cheekL: Pt[] = [
    [288, 530],
    [232, 494],
    [246, 578],
    [292, 600],
  ];

  const crown: Pt[] = [
    [268, 508],
    [292, 468],
    [410, 448],
    [528, 468],
    [552, 508],
    [516, 524],
    [410, 502],
    [304, 524],
  ];

  const crest: Pt[] = [
    [410, 452],
    [392, 394],
    [410, 352],
    [428, 394],
  ];

  const shoulderL: Pt[] = [
    [300, 618],
    [206, 652],
    [176, 782],
    [286, 838],
    [332, 716],
  ];

  const upperArmL: Pt[] = limb([268, 702], [174, 468], 40, 26);
  const foreArmL: Pt[] = limb([174, 468], [126, 258], 26, 17);
  const clawL = claw([126, 258], -Math.PI * 0.64, 1.55, 4, 140);

  const eyeL = eyeWedge(338, 542, 88, 48, -16, 1);
  const eyeR = eyeWedge(482, 542, 88, 48, -16, -1);

  const parts: RigPart[] = [
    part('upperarm-l', 10, 'ink', upperArmL),
    part('upperarm-r', 10, 'ink', mirrorAbout(upperArmL, 410)),
    part('forearm-l', 11, 'ink', foreArmL),
    part('forearm-r', 11, 'ink', mirrorAbout(foreArmL, 410)),
    part('claw-l', 12, 'gold', clawL),
    part('claw-r', 12, 'gold', mirrorAbout(clawL, 410)),

    part('gorget', 20, 'ink', [
      [330, 674],
      [410, 702],
      [490, 674],
      [508, 752],
      [410, 796],
      [312, 752],
    ]),
    part('chest-rim', 21, 'ink', [
      [316, 752],
      [410, 796],
      [504, 752],
      [540, 836],
      [410, 898],
      [280, 836],
    ]),
    part('chest-v', 22, 'goldLine', [
      [410, 798],
      [496, 866],
      [410, 936],
      [324, 866],
    ]),

    part('pauldron-l', 30, 'ink', shoulderL),
    part('pauldron-r', 30, 'ink', mirrorAbout(shoulderL, 410)),
    part('pauldron-tip-l', 31, 'gold', [
      [206, 652],
      [142, 600],
      [186, 692],
    ]),
    part('pauldron-tip-r', 31, 'gold', mirrorAbout([[206, 652], [142, 600], [186, 692]], 410)),

    part('cheek-l', 40, 'ink', cheekL),
    part('cheek-r', 40, 'ink', mirrorAbout(cheekL, 410)),
    part('skull', 41, 'ink', skull),
    part('jaw', 42, 'rim', jaw),
    part('brow', 43, 'goldLine', [
      [292, 514],
      [340, 502],
      [410, 510],
      [480, 502],
      [528, 514],
    ]),
    part('eyebrow-l', 44, 'rim', [
      [286, 528],
      [344, 516],
      [336, 548],
      [292, 552],
    ]),
    part('eyebrow-r', 44, 'rim', mirrorAbout([[286, 528], [344, 516], [336, 548], [292, 552]], 410)),
  ];

  return {
    id: 'trapped_overhead',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eyeL,
      right: eyeR,
      coreLeft: eyeCore(eyeL, 0.3),
      coreRight: eyeCore(eyeR, 0.3),
    },
    crown,
    crownCrest: crest,
    crownWings: [
      [
        [272, 506],
        [198, 462],
        [228, 528],
        [274, 546],
      ],
      mirrorAbout([[272, 506], [198, 462], [228, 528], [274, 546]], 410),
    ],
    feathers: [
      {origin: [372, 464], angle: -Math.PI / 2 - 0.14, length: 280, hand: -1, width: 46},
      {origin: [448, 464], angle: -Math.PI / 2 + 0.14, length: 280, hand: 1, width: 46},
    ],
    staff: null,
    eyeFocus: {x: 410, y: 560, r: 150},
    aura: 1.15,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 4 — snarl_closeup                                                    */
/* -------------------------------------------------------------------------- */

const buildCloseup = (): PoseGeometry => {
  const skull: Pt[] = [
    [128, 306],
    [186, 190],
    [410, 120],
    [634, 190],
    [692, 306],
    [672, 526],
    [560, 696],
    [410, 766],
    [260, 696],
    [148, 526],
  ];

  const jaw: Pt[] = [
    [198, 506],
    [410, 458],
    [622, 506],
    [576, 650],
    [410, 750],
    [244, 650],
  ];

  const cheekL: Pt[] = [
    [186, 340],
    [44, 266],
    [76, 460],
    [178, 502],
  ];

  const crown: Pt[] = [
    [118, 302],
    [172, 250],
    [410, 200],
    [648, 250],
    [702, 302],
    [632, 340],
    [410, 288],
    [188, 340],
  ];

  const crest: Pt[] = [
    [410, 204],
    [368, 104],
    [410, 22],
    [452, 104],
  ];

  const eyeL = eyeWedge(272, 356, 224, 126, 38, 1);
  const eyeR = eyeWedge(548, 356, 224, 126, 38, -1);

  const parts: RigPart[] = [
    part('skull', 10, 'ink', skull),
    part('jaw', 11, 'rim', jaw),
    part('cheek-l', 12, 'ink', cheekL),
    part('cheek-r', 12, 'ink', mirrorAbout(cheekL, 410)),
    part('brow', 13, 'goldLine', [
      [146, 334],
      [250, 302],
      [410, 334],
      [570, 302],
      [674, 334],
    ]),
    part('nose-bridge', 14, 'goldLine', [
      [410, 350],
      [368, 486],
      [410, 516],
      [452, 486],
    ]),
    part('cheek-scar-l', 15, 'goldLine', [
      [244, 388],
      [300, 440],
      [246, 484],
    ]),
    part('cheek-scar-r', 15, 'goldLine', [
      [576, 388],
      [520, 440],
      [574, 484],
    ]),
  ];

  return {
    id: 'snarl_closeup',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eyeL,
      right: eyeR,
      coreLeft: eyeCore(eyeL, 0.3),
      coreRight: eyeCore(eyeR, 0.3),
    },
    crown,
    crownCrest: crest,
    crownWings: [
      [
        [124, 300],
        [-10, 232],
        [30, 342],
        [128, 356],
      ],
      mirrorAbout([[124, 300], [-10, 232], [30, 342], [128, 356]], 410),
    ],
    feathers: [
      {origin: [300, 214], angle: -Math.PI / 2 - 0.8, length: 280, hand: -1, width: 72},
      {origin: [520, 214], angle: -Math.PI / 2 + 0.8, length: 280, hand: 1, width: 72},
    ],
    staff: null,
    eyeFocus: {x: 410, y: 408, r: 300},
    aura: 1.3,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 5 — side_lunge（V4：侧面弓步迎敌，棍盾在身前）                        */
/* -------------------------------------------------------------------------- */

/**
 * 侧视剪影：面朝右，前腿大弓步、后腿蹬直，双手把金箍棒推在身体前方。
 * 这是为了打破 V3「正对镜头站在正中央」的图腾柱构图。
 */
const buildSideLunge = (): PoseGeometry => {
  const skull: Pt[] = [
    [340, 236],
    [352, 190],
    [390, 156],
    [448, 148],
    [492, 170],
    [510, 208],
    [506, 240],
    [532, 268],
    [514, 300],
    [480, 312],
    [468, 344],
    [430, 356],
    [394, 340],
    [366, 310],
    [348, 278],
  ];
  const jaw: Pt[] = [
    [408, 318],
    [470, 328],
    [502, 306],
    [488, 352],
    [444, 366],
    [410, 350],
  ];
  const cheek: Pt[] = [
    [360, 292],
    [330, 318],
    [354, 338],
    [392, 332],
  ];
  const ear: Pt[] = [
    [350, 242],
    [306, 220],
    [294, 258],
    [316, 286],
    [346, 286],
  ];
  const crown: Pt[] = [
    [344, 224],
    [356, 194],
    [440, 178],
    [500, 196],
    [514, 224],
    [476, 232],
    [420, 210],
    [360, 238],
  ];
  const crest: Pt[] = [
    [430, 190],
    [420, 128],
    [440, 68],
    [452, 130],
  ];
  const wingL: Pt[] = [
    [350, 232],
    [278, 194],
    [306, 252],
    [344, 258],
  ];
  const wingR: Pt[] = [
    [504, 224],
    [566, 196],
    [542, 252],
    [508, 252],
  ];

  const eye: Pt[] = [
    [438, 242],
    [506, 254],
    [456, 276],
  ];
  const eyeCorePt: Pt[] = [
    [458, 252],
    [490, 256],
    [462, 264],
  ];

  const parts: RigPart[] = [
    /* 披风与尾 */
    part('cape-back', 1, 'ink', [
      [344, 404],
      [300, 400],
      [252, 480],
      [230, 600],
      [214, 730],
      [254, 690],
      [232, 800],
      [284, 740],
      [312, 650],
      [332, 520],
    ]),
    part('cape-ribbon', 2, 'goldLine', [
      [302, 468],
      [270, 556],
      [250, 660],
      [238, 752],
      [262, 688],
      [276, 586],
      [294, 500],
    ]),
    part('tail', 3, 'ink', [
      [368, 720],
      [320, 700],
      [270, 710],
      [238, 750],
      [230, 800],
      [256, 826],
      [276, 796],
      [266, 766],
      [290, 738],
      [330, 728],
      [370, 750],
    ]),
    part('tail-tip', 4, 'gold', [
      [230, 800],
      [246, 816],
      [256, 826],
      [238, 818],
    ]),

    /* 后腿（蹬直） */
    part('thigh-back', 10, 'ink', limb([360, 716], [268, 884], 46, 32)),
    part('shin-back', 11, 'ink', limb([268, 884], [196, 1034], 32, 22)),
    part('knee-back', 12, 'gold', [
      [268, 852],
      [292, 884],
      [268, 916],
      [244, 884],
    ]),
    part('boot-back', 13, 'ink', [
      [180, 1022],
      [118, 1046],
      [102, 1062],
      [210, 1062],
      [224, 1032],
    ]),
    part('boot-back-rim', 14, 'goldLine', [
      [180, 1022],
      [118, 1046],
      [102, 1062],
      [210, 1062],
      [224, 1032],
    ]),

    /* 前腿（弓步） */
    part('thigh-front', 15, 'ink', limb([450, 724], [512, 858], 44, 32)),
    part('shin-front', 16, 'ink', limb([512, 858], [548, 1024], 30, 21)),
    part('knee-front', 17, 'gold', [
      [512, 826],
      [536, 858],
      [512, 890],
      [488, 858],
    ]),
    part('boot-front', 18, 'ink', [
      [526, 1010],
      [586, 1036],
      [618, 1058],
      [532, 1058],
      [514, 1022],
    ]),
    part('boot-front-rim', 19, 'goldLine', [
      [526, 1010],
      [586, 1036],
      [618, 1058],
      [532, 1058],
      [514, 1022],
    ]),
    part('shin-gold-front', 19, 'goldLine', [
      [520, 880],
      [536, 982],
      [526, 1010],
      [510, 900],
    ]),

    /* 裙甲与躯干 */
    part('tasset-back', 20, 'ink', [
      [330, 700],
      [280, 720],
      [300, 800],
      [340, 770],
    ]),
    part('tasset-front', 20, 'ink', [
      [470, 700],
      [520, 720],
      [500, 800],
      [462, 770],
    ]),
    part('tasset-c', 20, 'ink', [
      [410, 710],
      [470, 700],
      [490, 800],
      [440, 772],
      [410, 828],
      [380, 772],
      [330, 800],
      [342, 700],
    ]),
    part('abdomen', 21, 'ink', [
      [352, 604],
      [470, 616],
      [470, 690],
      [352, 680],
    ]),
    part('chest', 23, 'ink', [
      [330, 392],
      [466, 404],
      [492, 470],
      [480, 540],
      [452, 610],
      [470, 668],
      [400, 690],
      [352, 662],
      [330, 570],
      [318, 470],
    ]),
    part('chest-v', 24, 'goldLine', [
      [410, 430],
      [470, 500],
      [410, 562],
      [368, 500],
    ]),
    part('chest-v-inner', 25, 'goldLine', [
      [410, 456],
      [448, 502],
      [410, 540],
      [384, 502],
    ]),
    part('chevron-1', 25, 'goldLine', [
      [364, 586],
      [410, 566],
      [456, 586],
      [456, 604],
      [410, 584],
      [364, 604],
    ]),
    part('chevron-2', 25, 'goldLine', [
      [374, 622],
      [410, 606],
      [446, 622],
      [446, 638],
      [410, 622],
      [374, 638],
    ]),
    part('belt', 26, 'gold', [
      [338, 664],
      [466, 676],
      [462, 726],
      [330, 716],
    ]),
    part('buckle', 27, 'cinnabar', [
      [410, 676],
      [440, 704],
      [410, 732],
      [380, 704],
    ]),

    /* 双臂：都伸向身前的棍盾 */
    part('upperarm-back', 30, 'ink', limb([384, 410], [452, 510], 34, 26)),
    part('forearm-back', 31, 'ink', limb([452, 510], [588, 600], 28, 18)),
    part('upperarm-front', 30, 'ink', limb([466, 414], [548, 512], 34, 26)),
    part('forearm-front', 31, 'ink', limb([548, 512], [612, 586], 28, 18)),
    part('bracer-back', 32, 'gold', [
      [548, 560],
      [570, 576],
      [566, 596],
      [542, 580],
    ]),
    part('bracer-front', 32, 'gold', [
      [582, 552],
      [606, 568],
      [600, 588],
      [576, 572],
    ]),
    part('pauldron-back', 32, 'ink', [
      [344, 384],
      [286, 366],
      [306, 430],
      [338, 458],
      [370, 438],
    ]),
    part('pauldron-front', 33, 'ink', [
      [466, 398],
      [510, 382],
      [526, 434],
      [500, 466],
      [472, 448],
    ]),
    part('pauldron-scale-back', 33, 'ink', [
      [336, 430],
      [296, 452],
      [292, 500],
      [330, 516],
      [356, 480],
    ]),
    part('pauldron-scale-front', 34, 'ink', [
      [478, 438],
      [516, 456],
      [520, 500],
      [486, 516],
      [464, 480],
    ]),
    part('hand-front', 35, 'ink', [
      [596, 572],
      [624, 584],
      [634, 604],
      [620, 620],
      [594, 612],
      [584, 592],
    ]),
    part('hand-back', 35, 'ink', [
      [576, 590],
      [600, 604],
      [606, 624],
      [588, 634],
      [566, 620],
      [560, 602],
    ]),
    part('hand-vein-front', 36, 'goldLine', [
      [600, 584],
      [614, 594],
      [622, 606],
      [612, 612],
      [604, 600],
    ]),

    /* 头 */
    part('skull-back', 38, 'ink', [
      [340, 236],
      [314, 268],
      [318, 306],
      [344, 338],
      [374, 346],
      [366, 308],
      [352, 276],
    ]),
    part('ear', 39, 'ink', ear),
    part('ear-inner', 39, 'cinnabar', [
      [338, 248],
      [312, 234],
      [312, 260],
      [330, 276],
    ]),
    part('cheek', 40, 'ink', cheek),
    part('neck', 40, 'ink', [
      [408, 338],
      [462, 350],
      [470, 400],
      [404, 392],
    ]),
    part('skull', 41, 'ink', skull),
    part('jaw', 42, 'rim', jaw),
    part('brow', 43, 'goldLine', [
      [372, 224],
      [420, 214],
      [472, 226],
      [504, 244],
    ]),
    part('cheek-gold', 43, 'goldLine', [
      [364, 300],
      [342, 316],
      [356, 330],
      [386, 326],
    ]),
    part('face-contour', 43, 'goldLine', [
      [392, 340],
      [420, 352],
      [452, 344],
      [478, 322],
      [502, 300],
      [514, 274],
    ]),
    part('fang', 44, 'gold', [
      [468, 330],
      [484, 344],
      [470, 352],
      [464, 338],
    ]),
  ];

  return {
    id: 'side_lunge',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eye,
      right: [],
      coreLeft: eyeCorePt,
      coreRight: [],
    },
    crown,
    crownCrest: crest,
    crownWings: [wingL, wingR],
    feathers: [
      {origin: [382, 188], angle: -Math.PI / 2 - 0.88, length: 234, hand: -1, width: 27},
      {origin: [408, 184], angle: -Math.PI / 2 - 1.18, length: 252, hand: 1, width: 29},
    ],
    staff: {
      pivot: [640, 600],
      length: 760,
      thickness: 26,
      angle: 0.1,
      grips: [
        [612, 590],
        [620, 618],
      ],
    },
    eyeFocus: {x: 478, y: 258, r: 50},
    aura: 1.06,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 6 — kneel_boulder（V4：侧面单膝跪地、双掌撑住压顶巨岩）               */
/* -------------------------------------------------------------------------- */

const buildKneelBoulder = (): PoseGeometry => {
  const skull: Pt[] = [
    [346, 318],
    [356, 272],
    [392, 244],
    [444, 240],
    [486, 260],
    [502, 292],
    [494, 324],
    [512, 344],
    [494, 370],
    [462, 380],
    [452, 408],
    [418, 422],
    [384, 408],
    [366, 380],
    [352, 348],
  ];
  const jaw: Pt[] = [
    [408, 388],
    [462, 394],
    [496, 372],
    [488, 412],
    [448, 426],
    [414, 412],
  ];
  const cheek: Pt[] = [
    [360, 374],
    [330, 398],
    [354, 418],
    [390, 410],
  ];
  const ear: Pt[] = [
    [352, 328],
    [322, 310],
    [320, 350],
    [344, 366],
  ];
  const crown: Pt[] = [
    [344, 314],
    [356, 286],
    [432, 270],
    [490, 286],
    [504, 314],
    [470, 322],
    [414, 300],
    [362, 326],
  ];
  const crest: Pt[] = [
    [424, 282],
    [414, 222],
    [432, 170],
    [444, 226],
  ];
  const wingL: Pt[] = [
    [348, 318],
    [278, 284],
    [306, 338],
    [344, 346],
  ];
  const wingR: Pt[] = [
    [496, 312],
    [558, 284],
    [536, 336],
    [500, 340],
  ];

  const eye: Pt[] = [
    [438, 296],
    [502, 308],
    [456, 330],
  ];
  const eyeCorePt: Pt[] = [
    [458, 306],
    [486, 310],
    [462, 318],
  ];

  const handFront: Pt[] = [
    [564, 224],
    [566, 192],
    [576, 170],
    [586, 184],
    [596, 166],
    [606, 184],
    [616, 172],
    [620, 198],
    [610, 224],
    [588, 236],
  ];
  const handBack: Pt[] = [
    [226, 224],
    [228, 192],
    [238, 170],
    [248, 184],
    [258, 166],
    [268, 184],
    [278, 172],
    [282, 198],
    [272, 224],
    [250, 236],
  ];

  const parts: RigPart[] = [
    /* 披风向两侧狂舞 */
    part('cape-left', 1, 'ink', [
      [340, 466],
      [284, 492],
      [246, 622],
      [222, 764],
      [266, 742],
      [240, 864],
      [298, 802],
      [328, 700],
    ]),
    part('cape-right', 1, 'ink', [
      [470, 476],
      [524, 500],
      [558, 640],
      [574, 782],
      [532, 754],
      [562, 874],
      [506, 808],
      [480, 700],
    ]),
    part('cape-ribbon-left', 2, 'goldLine', [
      [316, 526],
      [282, 620],
      [258, 732],
      [238, 820],
      [268, 744],
      [290, 636],
      [310, 550],
    ]),
    part('cape-ribbon-right', 2, 'goldLine', [
      [498, 530],
      [530, 626],
      [552, 740],
      [568, 826],
      [540, 748],
      [518, 640],
      [502, 556],
    ]),

    /* 后腿：膝盖落地、小腿横铺 */
    part('thigh-back', 10, 'ink', limb([370, 728], [320, 1000], 46, 36)),
    part('shin-back', 11, 'ink', limb([320, 1000], [228, 1040], 36, 24)),
    part('knee-pad', 12, 'gold', [
      [300, 972],
      [344, 1000],
      [316, 1030],
      [282, 1000],
    ]),
    part('boot-back', 13, 'ink', [
      [216, 1026],
      [154, 1044],
      [138, 1060],
      [248, 1060],
      [264, 1038],
    ]),
    part('boot-back-rim', 14, 'goldLine', [
      [216, 1026],
      [154, 1044],
      [138, 1060],
      [248, 1060],
      [264, 1038],
    ]),

    /* 前腿：屈膝蹬地 */
    part('thigh-front', 15, 'ink', limb([450, 730], [520, 880], 48, 34)),
    part('shin-front', 16, 'ink', limb([520, 880], [558, 1030], 34, 24)),
    part('knee-front', 17, 'gold', [
      [520, 848],
      [544, 880],
      [520, 912],
      [496, 880],
    ]),
    part('boot-front', 18, 'ink', [
      [538, 1016],
      [596, 1042],
      [628, 1060],
      [542, 1060],
      [526, 1028],
    ]),
    part('boot-front-rim', 19, 'goldLine', [
      [538, 1016],
      [596, 1042],
      [628, 1060],
      [542, 1060],
      [526, 1028],
    ]),
    part('shin-gold', 19, 'goldLine', [
      [530, 900],
      [546, 976],
      [540, 1014],
      [522, 920],
    ]),

    /* 躯干 */
    part('tasset-c', 20, 'ink', [
      [400, 708],
      [466, 700],
      [486, 812],
      [440, 780],
      [414, 840],
      [384, 780],
      [330, 812],
      [344, 700],
    ]),
    part('abdomen', 21, 'ink', [
      [340, 610],
      [472, 620],
      [470, 700],
      [342, 694],
    ]),
    part('chest', 23, 'ink', [
      [338, 462],
      [466, 478],
      [490, 540],
      [478, 610],
      [452, 660],
      [468, 706],
      [400, 724],
      [340, 700],
      [326, 620],
      [320, 520],
    ]),
    part('chest-v', 24, 'goldLine', [
      [410, 500],
      [472, 560],
      [410, 620],
      [366, 560],
    ]),
    part('chest-v-inner', 25, 'goldLine', [
      [410, 524],
      [452, 562],
      [410, 600],
      [380, 562],
    ]),
    part('chevron-1', 25, 'goldLine', [
      [364, 642],
      [410, 624],
      [456, 642],
      [456, 660],
      [410, 642],
      [364, 660],
    ]),
    part('belt', 26, 'gold', [
      [340, 668],
      [468, 678],
      [464, 728],
      [332, 720],
    ]),
    part('buckle', 27, 'cinnabar', [
      [410, 680],
      [440, 706],
      [410, 734],
      [380, 706],
    ]),

    /* 双臂上撑：大幅张开成 V 形，掌根压住岩底 */
    part('upperarm-back', 30, 'ink', limb([368, 486], [268, 372], 42, 30)),
    part('forearm-back', 31, 'ink', limb([268, 372], [250, 240], 34, 24)),
    part('upperarm-front', 30, 'ink', limb([466, 486], [578, 372], 40, 30)),
    part('forearm-front', 31, 'ink', limb([578, 372], [590, 240], 34, 24)),
    part('bracer-back', 32, 'gold', [
      [232, 232],
      [268, 232],
      [270, 260],
      [234, 260],
    ]),
    part('bracer-front', 32, 'gold', [
      [572, 232],
      [608, 232],
      [610, 260],
      [574, 260],
    ]),
    part('forearm-gold-back', 34, 'goldLine', [
      [262, 360],
      [256, 300],
      [248, 250],
      [256, 250],
      [264, 300],
      [270, 360],
    ]),
    part('forearm-gold-front', 34, 'goldLine', [
      [584, 360],
      [590, 300],
      [598, 250],
      [606, 250],
      [598, 300],
      [592, 360],
    ]),
    /* 暴起的青筋 */
    part('vein-back', 33, 'cinnabar', [
      [282, 444],
      [266, 408],
      [276, 384],
      [264, 356],
      [278, 372],
      [286, 402],
      [276, 446],
    ]),
    part('vein-front', 33, 'cinnabar', [
      [556, 444],
      [576, 408],
      [566, 384],
      [580, 356],
      [590, 372],
      [580, 402],
      [570, 446],
    ]),
    part('pauldron-back', 32, 'ink', [
      [344, 470],
      [274, 452],
      [286, 526],
      [330, 552],
      [368, 512],
    ]),
    part('pauldron-front', 33, 'ink', [
      [462, 478],
      [528, 458],
      [538, 530],
      [496, 556],
      [458, 516],
    ]),
    part('pauldron-scale-back', 33, 'ink', [
      [336, 512],
      [286, 540],
      [282, 590],
      [328, 604],
      [358, 560],
    ]),
    part('pauldron-scale-front', 34, 'ink', [
      [472, 518],
      [524, 542],
      [530, 594],
      [486, 608],
      [454, 562],
    ]),
    part('hand-back', 35, 'ink', handBack),
    part('hand-front', 35, 'ink', handFront),
    part('hand-outline-back', 36, 'goldLine', handBack),
    part('hand-outline-front', 36, 'goldLine', handFront),
    part('palm-lines-back', 36, 'cinnabar', [
      [238, 198],
      [256, 210],
      [242, 220],
    ]),
    part('palm-lines-front', 36, 'cinnabar', [
      [586, 196],
      [604, 208],
      [590, 220],
    ]),

    /* 头：最后画，压在双臂之前 */
    part('skull-back', 38, 'ink', [
      [346, 318],
      [322, 340],
      [326, 380],
      [350, 404],
      [380, 410],
      [372, 376],
      [358, 344],
    ]),
    part('mane-gold', 39, 'goldLine', [
      [344, 322],
      [322, 342],
      [326, 378],
      [348, 400],
      [376, 406],
    ]),
    part('ear', 39, 'ink', ear),
    part('cheek', 40, 'ink', cheek),
    part('neck', 40, 'ink', [
      [404, 412],
      [458, 422],
      [466, 472],
      [400, 464],
    ]),
    part('skull', 41, 'ink', skull),
    part('jaw', 42, 'rim', jaw),
    part('brow', 43, 'goldLine', [
      [370, 280],
      [418, 270],
      [466, 282],
      [496, 300],
    ]),
    part('fang', 44, 'gold', [
      [468, 392],
      [484, 406],
      [470, 414],
      [464, 400],
    ]),
  ];

  return {
    id: 'kneel_boulder',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: eye,
      right: [],
      coreLeft: eyeCorePt,
      coreRight: [],
    },
    crown,
    crownCrest: crest,
    crownWings: [wingL, wingR],
    feathers: [
      {origin: [360, 270], angle: -Math.PI / 2 - 1.14, length: 250, hand: -1, width: 34},
      {origin: [420, 266], angle: -Math.PI / 2 + 0.34, length: 238, hand: 1, width: 32},
    ],
    staff: null,
    eyeFocus: {x: 466, y: 310, r: 48},
    aura: 1.16,
  };
};

/* -------------------------------------------------------------------------- */
/*  Pose 7 — back_overlook（V4：左下角前景背影，俯瞰 3D 崩裂）                 */
/* -------------------------------------------------------------------------- */

const buildBackOverlook = (): PoseGeometry => {
  const skull: Pt[] = [
    [344, 330],
    [360, 250],
    [410, 212],
    [480, 208],
    [540, 240],
    [562, 312],
    [550, 382],
    [510, 418],
    [460, 426],
    [400, 408],
    [360, 372],
  ];
  const crown: Pt[] = [
    [346, 312],
    [366, 264],
    [460, 246],
    [552, 262],
    [572, 302],
    [520, 296],
    [440, 300],
    [380, 318],
  ];
  const crest: Pt[] = [
    [460, 240],
    [448, 176],
    [466, 116],
    [480, 178],
  ];
  const wingL: Pt[] = [
    [350, 314],
    [278, 282],
    [306, 336],
    [346, 344],
  ];
  const wingR: Pt[] = [
    [562, 306],
    [626, 276],
    [602, 330],
    [566, 338],
  ];

  const eyeGlint: Pt[] = [
    [528, 334],
    [568, 340],
    [542, 354],
  ];
  const eyeCorePt: Pt[] = [
    [542, 341],
    [558, 343],
    [544, 349],
  ];

  const parts: RigPart[] = [
    /* 披风 */
    part('cape-left', 1, 'ink', [
      [306, 440],
      [252, 520],
      [230, 700],
      [262, 866],
      [332, 902],
      [362, 782],
      [342, 642],
      [392, 560],
    ]),
    part('cape-right', 1, 'ink', [
      [564, 444],
      [622, 524],
      [646, 704],
      [614, 874],
      [544, 908],
      [514, 786],
      [534, 644],
      [488, 562],
    ]),
    part('cape-ribbon-left', 2, 'goldLine', [
      [292, 540],
      [266, 636],
      [252, 744],
      [244, 828],
      [270, 748],
      [284, 644],
      [304, 552],
    ]),
    part('cape-ribbon-right', 2, 'goldLine', [
      [580, 544],
      [606, 640],
      [620, 748],
      [628, 832],
      [602, 752],
      [588, 648],
      [568, 556],
    ]),

    /* 下半身（前景裁切） */
    part('hips', 10, 'ink', [
      [344, 860],
      [500, 860],
      [542, 1120],
      [318, 1120],
    ]),
    part('hip-gold', 11, 'goldLine', [
      [362, 900],
      [430, 926],
      [494, 900],
      [484, 962],
      [430, 986],
      [374, 962],
    ]),

    /* 背甲 */
    part('back', 20, 'ink', [
      [330, 404],
      [390, 382],
      [500, 392],
      [590, 380],
      [650, 416],
      [690, 520],
      [670, 700],
      [600, 820],
      [450, 860],
      [310, 820],
      [250, 700],
      [250, 540],
    ]),
    part('spine', 21, 'goldLine', [
      [430, 414],
      [470, 438],
      [462, 700],
      [430, 744],
      [398, 700],
      [390, 438],
    ]),
    part('chevron-1', 22, 'goldLine', [
      [330, 500],
      [430, 536],
      [530, 500],
      [530, 520],
      [430, 556],
      [330, 520],
    ]),
    part('chevron-2', 22, 'goldLine', [
      [318, 592],
      [430, 628],
      [542, 592],
      [542, 612],
      [430, 648],
      [318, 612],
    ]),
    part('chevron-3', 22, 'goldLine', [
      [308, 684],
      [430, 720],
      [552, 684],
      [552, 704],
      [430, 740],
      [308, 704],
    ]),
    part('belt-back', 23, 'gold', [
      [320, 760],
      [540, 760],
      [536, 806],
      [324, 806],
    ]),
    part('buckle-back', 24, 'cinnabar', [
      [430, 760],
      [454, 784],
      [430, 808],
      [406, 784],
    ]),

    /* 左臂垂在胯上 */
    part('upperarm-left', 30, 'ink', limb([310, 470], [280, 600], 40, 30)),
    part('forearm-left', 31, 'ink', limb([280, 600], [330, 700], 30, 22)),
    part('hand-left', 32, 'ink', [
      [316, 690],
      [346, 700],
      [352, 722],
      [330, 734],
      [308, 720],
    ]),
    part('pauldron-left', 33, 'ink', [
      [300, 430],
      [210, 470],
      [200, 590],
      [300, 610],
      [330, 520],
    ]),
    part('pauldron-scale-left', 34, 'ink', [
      [294, 512],
      [236, 536],
      [232, 594],
      [288, 612],
      [318, 566],
    ]),

    /* 右臂前伸持棒 */
    part('upperarm-right', 30, 'ink', limb([620, 470], [700, 590], 42, 32)),
    part('forearm-right', 31, 'ink', limb([700, 590], [748, 714], 34, 24)),
    part('hand-right', 32, 'ink', [
      [732, 700],
      [764, 712],
      [772, 736],
      [750, 750],
      [726, 736],
    ]),
    part('pauldron-right', 33, 'ink', [
      [560, 426],
      [650, 462],
      [660, 582],
      [560, 604],
      [530, 516],
    ]),
    part('pauldron-scale-right', 34, 'ink', [
      [566, 508],
      [624, 532],
      [628, 590],
      [572, 608],
      [542, 562],
    ]),

    /* 头：背面 + 极轻的侧脸 */
    part('mane', 39, 'ink', [
      [330, 330],
      [310, 300],
      [318, 268],
      [340, 248],
      [368, 234],
      [398, 228],
      [426, 232],
      [450, 248],
      [468, 274],
      [462, 302],
      [446, 332],
      [420, 352],
      [390, 356],
      [360, 348],
    ]),
    part('mane-gold', 40, 'goldLine', [
      [330, 330],
      [312, 300],
      [320, 270],
      [342, 250],
      [370, 236],
      [400, 230],
      [426, 234],
      [450, 250],
      [466, 274],
      [460, 302],
      [444, 330],
    ]),
    part('head', 41, 'ink', skull),
    part('head-rim', 42, 'goldLine', [
      [344, 330],
      [360, 250],
      [410, 212],
      [480, 208],
      [540, 240],
      [562, 312],
      [550, 382],
      [510, 418],
      [460, 426],
      [400, 408],
      [360, 372],
    ]),
    part('head-fur', 42, 'goldLine', [
      [360, 250],
      [342, 226],
      [352, 292],
      [338, 316],
      [360, 342],
      [350, 372],
    ]),
    part('ear-left', 43, 'ink', [
      [348, 344],
      [300, 322],
      [304, 382],
      [344, 398],
    ]),
    part('ear-right', 43, 'ink', [
      [560, 348],
      [608, 326],
      [604, 386],
      [566, 402],
    ]),
    part('ear-inner-left', 43, 'cinnabar', [
      [342, 352],
      [314, 340],
      [318, 374],
      [342, 382],
    ]),
    part('ear-inner-right', 43, 'cinnabar', [
      [566, 356],
      [594, 344],
      [590, 378],
      [566, 386],
    ]),
    part('neck-back', 43, 'ink', [
      [390, 400],
      [500, 402],
      [520, 452],
      [380, 452],
    ]),
    part('cheek-turn', 44, 'rim', [
      [530, 330],
      [558, 352],
      [548, 392],
      [520, 404],
      [510, 372],
    ]),
  ];

  return {
    id: 'back_overlook',
    viewBox: [RIG_W, RIG_H],
    parts,
    eyes: {
      left: [],
      right: eyeGlint,
      coreLeft: [],
      coreRight: eyeCorePt,
    },
    crown,
    crownCrest: crest,
    crownWings: [wingL, wingR],
    feathers: [
      {origin: [414, 248], angle: -Math.PI / 2 - 0.72, length: 288, hand: -1, width: 34},
      {origin: [478, 246], angle: -Math.PI / 2 - 0.28, length: 276, hand: 1, width: 32},
    ],
    staff: {
      pivot: [752, 730],
      length: 580,
      thickness: 28,
      angle: 0.78,
      grips: [[748, 722]],
    },
    eyeFocus: {x: 548, y: 344, r: 40},
    aura: 1.1,
  };
};

/* -------------------------------------------------------------------------- */
/*  导出                                                                      */
/* -------------------------------------------------------------------------- */

export const POSES: Record<WukongPose, PoseGeometry> = {
  spin_staff: buildSpinStaff(),
  slash_horizontally: buildSlash(),
  trapped_overhead: buildTrapped(),
  snarl_closeup: buildCloseup(),
  side_lunge: buildSideLunge(),
  kneel_boulder: buildKneelBoulder(),
  back_overlook: buildBackOverlook(),
};

export const POSE_IDS: WukongPose[] = [
  'spin_staff',
  'slash_horizontally',
  'trapped_overhead',
  'snarl_closeup',
  'side_lunge',
  'kneel_boulder',
  'back_overlook',
];

/** 多边形 → SVG points 字符串。 */
export const polygonPoints = (points: readonly Pt[]): string =>
  points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');

/** 多边形 → SVG path d。 */
export const polygonPath = (points: readonly Pt[]): string => {
  if (!points.length) return '';
  const [head, ...rest] = points;
  let d = `M${head![0]} ${head![1]}`;
  for (const [x, y] of rest) d += ` L${x} ${y}`;
  return `${d} Z`;
};
