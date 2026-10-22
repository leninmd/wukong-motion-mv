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
  | 'snarl_closeup';

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
/*  导出                                                                      */
/* -------------------------------------------------------------------------- */

export const POSES: Record<WukongPose, PoseGeometry> = {
  spin_staff: buildSpinStaff(),
  slash_horizontally: buildSlash(),
  trapped_overhead: buildTrapped(),
  snarl_closeup: buildCloseup(),
};

export const POSE_IDS: WukongPose[] = [
  'spin_staff',
  'slash_horizontally',
  'trapped_overhead',
  'snarl_closeup',
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
