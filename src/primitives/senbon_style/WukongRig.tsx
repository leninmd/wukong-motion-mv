import React, {useId, useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import {hash} from '../../utils/math';
import {ribbon} from './geometry';
import {SENBON} from './style';
import {
  POSES,
  RIG_H,
  RIG_W,
  type FeatherRoot,
  type Pt,
  type RigPart,
  type WukongPose,
} from './wukongRigGeometry';

/**
 * 孙悟空 2.5D 骨骼角色。
 *
 * 全部由 SVG **直边多边形**构成：躯干、肩甲、裙甲、四肢、爪。面部只保留
 * 「倒三角赤金眼眸 + 额头金箍」，没有任何鼻子 / 嘴 / 腮红 / 胸口旋涡。
 * 剪影内部恒为纯墨黑 `#0B090A`，外描边 2px 鎏金，整体套
 * `drop-shadow(0 0 3px #FCC934)` 的鎏金外发光。
 *
 * 分层：
 *   EchoTrail        —— 挥棒残影（赤红 / 鎏金 / 青色三层延迟重影）
 *   PheasantFeathers —— 两根 280px 双曲率翎，frame 双频正弦 + 音频高频驱动
 *   Body             —— 装甲剪影
 *   Eyes             —— 倒三角火眼金睛 + 十字星芒 + 横向拉丝
 *   SpinCudgel       —— 每帧 45° 的金箍棒、运动模糊金盘、40 颗火星
 */

export interface WukongRigProps {
  pose: WukongPose;
  /** 复刻段绝对帧，驱动翎与火星。 */
  frame: number;
  /** 风力 0–1.4。 */
  wind?: number;
  /** 音频高频能量 0–1。 */
  high?: number;
  /** 鎏金外发光倍率。 */
  glow?: number;
  /** 斩击残影强度 0–1。 */
  echo?: number;
  /** 金箍棒每帧旋转角度（度），默认 45。 */
  spinDegPerFrame?: number;
  /** 覆盖金箍棒静止角（弧度）。 */
  staffAngle?: number;
  /** 眼部爆闪强度 0–1：十字星芒 + 横向拉丝。 */
  eyeBurst?: number;
  /** 双目冲天金光强度 0–1（trapped_overhead）。 */
  beams?: number;
  opacity?: number;
  style?: React.CSSProperties;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  基础绘制                                                                  */
/* -------------------------------------------------------------------------- */

const pointsAttr = (points: readonly Pt[]): string =>
  points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');

interface BodyPalette {
  ink: string;
  gold: string;
  cinnabar: string;
  /** 描边引用的 url(#id) 或纯色。 */
  rim: string;
  /** 残影模式：所有材质统一压成一个颜色。 */
  flat: string | null;
}

const bodyPalette = (ids: (suffix: string) => string): BodyPalette => ({
  ink: SENBON.ink,
  gold: ids('goldFill'),
  cinnabar: SENBON.cinnabar,
  rim: ids('rimGrad'),
  flat: null,
});

const flatPalette = (color: string): BodyPalette => ({
  ink: color,
  gold: color,
  cinnabar: color,
  rim: color,
  flat: color,
});

interface PartStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  opacity: number;
}

const partStyle = (material: RigPart['material'], palette: BodyPalette): PartStyle => {
  if (palette.flat) {
    return {
      fill: material === 'goldLine' ? 'none' : palette.flat,
      stroke: palette.flat,
      strokeWidth: material === 'goldLine' ? 2.4 : 1.6,
      strokeOpacity: 1,
      opacity: 1,
    };
  }
  switch (material) {
    case 'gold':
      return {fill: palette.gold, stroke: SENBON.goldLight, strokeWidth: 1.4, strokeOpacity: 0.9, opacity: 1};
    case 'cinnabar':
      return {fill: SENBON.cinnabar, stroke: SENBON.gold, strokeWidth: 1.4, strokeOpacity: 0.85, opacity: 1};
    case 'goldLine':
      return {fill: 'none', stroke: SENBON.gold, strokeWidth: 2, strokeOpacity: 0.62, opacity: 1};
    case 'rim':
      return {
        fill: 'rgba(252,201,52,0.045)',
        stroke: palette.rim,
        strokeWidth: 1.2,
        strokeOpacity: 0.55,
        opacity: 1,
      };
    case 'ink':
    default:
      return {
        fill: palette.ink,
        stroke: palette.rim,
        strokeWidth: 2,
        strokeOpacity: 1,
        opacity: 1,
      };
  }
};

const Body: React.FC<{parts: readonly RigPart[]; palette: BodyPalette}> = ({parts, palette}) => (
  <g>
    {parts.map((item) => {
      const style = partStyle(item.material, palette);
      return (
        <polygon
          key={item.id}
          points={pointsAttr(item.points)}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          strokeOpacity={style.strokeOpacity}
          strokeLinejoin="miter"
          strokeMiterlimit={2.6}
          opacity={style.opacity}
        />
      );
    })}
  </g>
);

/* -------------------------------------------------------------------------- */
/*  双目翎——双曲率贝塞尔                                                     */
/* -------------------------------------------------------------------------- */

const featherCurves = (
  root: FeatherRoot,
  frame: number,
  high: number,
  wind: number,
): {outline: string; center: Pt[]} => {
  const steps = 22;
  const segment = root.length / steps;
  const center: Pt[] = [[root.origin[0], root.origin[1]]];
  let x = root.origin[0];
  let y = root.origin[1];
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    // 第一曲率：整体向后卷；第二曲率：高频抽打。两者叠加即"双曲率"。
    const bend = root.hand * (0.5 + wind * 0.55) * t * t * 1.45;
    const wave =
      Math.sin(frame * 0.23 + root.hand * 1.7 + t * 4.4) * (0.045 + high * 0.26) * t * t +
      Math.sin(frame * 0.61 + t * 7.1 + root.hand * 2.2) * (0.02 + high * 0.09) * t;
    const angle = root.angle + bend + wave;
    x += Math.cos(angle) * segment;
    y += Math.sin(angle) * segment;
    center.push([x, y]);
  }
  const widths = center.map((_, index) => {
    const t = index / (center.length - 1);
    const grow = Math.sin(Math.min(1, t / 0.18) * (Math.PI / 2));
    return Math.max(1.2, root.width * (0.5 + 0.5 * grow) * (1 - t) ** 0.55);
  });
  return {
    outline: ribbon(
      center.map(([x, y]) => ({x, y})),
      widths,
    ),
    center,
  };
};

const PheasantFeathers: React.FC<{
  roots: readonly FeatherRoot[];
  frame: number;
  high: number;
  wind: number;
  glow: number;
}> = ({roots, frame, high, wind, glow}) => (
  <g>
    {roots.map((root, index) => {
      const {outline, center} = featherCurves(root, frame, high, wind);
      const tip = center[center.length - 1]!;
      return (
        <g key={`feather-${index}`} opacity={0.94}>
          <path d={outline} fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={1.6} strokeOpacity={0.85} />
          <path
            d={`M${root.origin[0]} ${root.origin[1]} Q${(root.origin[0] + tip[0]) / 2 + root.hand * 26} ${
              (root.origin[1] + tip[1]) / 2
            } ${tip[0]} ${tip[1]}`}
            fill="none"
            stroke={SENBON.goldLight}
            strokeWidth={1.1}
            strokeOpacity={0.32 + glow * 0.24}
          />
        </g>
      );
    })}
  </g>
);

/* -------------------------------------------------------------------------- */
/*  火眼金睛                                                                  */
/* -------------------------------------------------------------------------- */

const Eye: React.FC<{
  points: readonly Pt[];
  core: readonly Pt[];
  ids: (suffix: string) => string;
  glow: number;
  burst: number;
}> = ({points, core, ids, glow, burst}) => (
  <g>
    <polygon points={pointsAttr(points)} fill={SENBON.cinnabar} opacity={0.55} filter={ids('eyeBlur')} />
    <polygon
      points={pointsAttr(points)}
      fill={ids('eyeFill')}
      stroke={SENBON.gold}
      strokeWidth={1.6}
      strokeOpacity={0.95}
      style={{filter: `drop-shadow(0 0 ${2 + glow * 5}px ${SENBON.gold})`}}
    />
    <polygon points={pointsAttr(core)} fill={SENBON.goldPale} opacity={0.7 + burst * 0.3} />
  </g>
);

const EyeFlare: React.FC<{
  x: number;
  y: number;
  r: number;
  burst: number;
  glow: number;
}> = ({x, y, r, burst, glow}) => {
  if (burst <= 0.02) return null;
  const spike = (length: number, width: number, angle: number, opacity: number, color: string) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const px = -dy;
    const py = dx;
    return (
      <polygon
        key={`spike-${angle.toFixed(3)}-${length.toFixed(1)}`}
        points={pointsAttr([
          [x + dx * length, y + dy * length],
          [x + px * width, y + py * width],
          [x - dx * width * 0.6, y - dy * width * 0.6],
          [x - px * width, y - py * width],
        ])}
        fill={color}
        opacity={opacity}
      />
    );
  };
  return (
    <g opacity={Math.min(1, burst)} style={{mixBlendMode: 'screen'}}>
      {spike(r * 2.6, r * 0.022, 0, 0.62, SENBON.gold)}
      {spike(r * 2.6, r * 0.022, Math.PI, 0.62, SENBON.gold)}
      {spike(r * 1.5, r * 0.026, -Math.PI / 2, 0.58, SENBON.goldLight)}
      {spike(r * 0.9, r * 0.02, Math.PI / 2, 0.3, SENBON.gold)}
      {spike(r * 1.0, r * 0.014, Math.PI / 4, 0.42, SENBON.goldLight)}
      {spike(r * 1.0, r * 0.014, -Math.PI / 4, 0.42, SENBON.goldLight)}
      {spike(r * 0.8, r * 0.012, (Math.PI * 3) / 4, 0.3, SENBON.cinnabar)}
      {spike(r * 0.8, r * 0.012, (-Math.PI * 3) / 4, 0.3, SENBON.cinnabar)}
      {[0.42, 0.66, 0.9].map((ratio, index) => (
        <rect
          key={`streak-${index}`}
          x={x - r * 2.6 * ratio}
          y={y - r * 0.035 * (index + 1)}
          width={r * 5.2 * ratio}
          height={0.8 + index * 0.5}
          fill={index === 0 ? SENBON.goldLight : SENBON.gold}
          opacity={(0.34 - index * 0.09) * burst}
        />
      ))}
    </g>
  );
};

/* -------------------------------------------------------------------------- */
/*  金箍棒 + 火星                                                             */
/* -------------------------------------------------------------------------- */

const staffBody = (length: number, thickness: number, opacity: number): React.ReactNode => {
  const half = length / 2;
  const t = thickness / 2;
  const shaft: Pt[] = [
    [-half + 26, -t],
    [half - 26, -t],
    [half - 26, t],
    [-half + 26, t],
  ];
  /* 棒身中段压一道暗芯，避免读成一根发光灯管 */
  const inlay: Pt[] = [
    [-half + 60, -t * 0.34],
    [half - 60, -t * 0.34],
    [half - 60, t * 0.34],
    [-half + 60, t * 0.34],
  ];
  const band = (offset: number, width: number): Pt[] => [
    [offset, -t * 1.22],
    [offset + width, -t * 1.22],
    [offset + width, t * 1.22],
    [offset, t * 1.22],
  ];
  const capL = ((): Pt[] => [
    [-half - 12, 0],
    [-half + 26, -t * 1.1],
    [-half + 26, t * 1.1],
  ])();
  const capR: Pt[] = capL.map(([x, y]) => [-x, y] as Pt);
  return (
    <g opacity={opacity}>
      <polygon points={pointsAttr(capL)} fill={SENBON.goldLight} stroke={SENBON.gold} strokeWidth={1} />
      <polygon points={pointsAttr(capR)} fill={SENBON.goldLight} stroke={SENBON.gold} strokeWidth={1} />
      <polygon points={pointsAttr(shaft)} fill={SENBON.gold} stroke={SENBON.goldPale} strokeWidth={1.2} />
      <polygon points={pointsAttr(inlay)} fill={SENBON.goldDeep} opacity={0.75} />
      <polygon points={pointsAttr(band(-half + 26, 22))} fill={SENBON.cinnabarDeep} stroke={SENBON.goldLight} strokeWidth={1} />
      <polygon points={pointsAttr(band(half - 48, 22))} fill={SENBON.cinnabarDeep} stroke={SENBON.goldLight} strokeWidth={1} />
      <line x1={-half + 26} y1={-t * 0.6} x2={half - 26} y2={-t * 0.6} stroke={SENBON.goldPale} strokeWidth={1.1} opacity={0.7} />
    </g>
  );
};

const ngon = (radius: number): string => {
  const points: Pt[] = [];
  for (let index = 0; index < 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return pointsAttr(points);
};

const SpinDisc: React.FC<{
  pivot: Pt;
  length: number;
  high: number;
  glow: number;
  ids: (suffix: string) => string;
  spinDegPerFrame: number;
}> = ({pivot, length, high, glow, ids, spinDegPerFrame}) => {
  const [px, py] = pivot;
  const strength = spinDegPerFrame > 1 ? 1 : 0;
  if (!strength) return null;
  return (
    <g transform={`translate(${px} ${py})`} style={{mixBlendMode: 'screen'}}>
      {/* 运动模糊金盘：三层同轴多边形叠加，最外层为亮金环 */}
      <polygon
        points={ngon(length * 0.5)}
        fill={ids('spinDisc')}
        opacity={0.55 + high * 0.4 + glow * 0.08}
      />
      <polygon points={ngon(length * 0.485)} fill="none" stroke={SENBON.gold} strokeWidth={3} opacity={0.34} />
      <polygon
        points={ngon(length * 0.44)}
        fill="none"
        stroke={SENBON.goldLight}
        strokeWidth={1.4}
        opacity={0.22}
        strokeDasharray="26 44"
      />
    </g>
  );
};

const SpinStaff: React.FC<{
  pivot: Pt;
  length: number;
  thickness: number;
  baseAngle: number;
  spinDegPerFrame: number;
  frame: number;
  high: number;
  glow: number;
  grips: readonly Pt[];
  ids: (suffix: string) => string;
}> = ({pivot, length, thickness, baseAngle, spinDegPerFrame, frame, high, glow, grips}) => {
  const {fps} = useVideoConfig();
  const [px, py] = pivot;
  const step = frame * spinDegPerFrame;
  const baseDeg = (baseAngle * 180) / Math.PI;
  /**
   * 高速转棍：每帧 45° 意味着每 8 帧一圈。为了不 strobe 成一条线，把过去
   * 七帧的棒位一起画出来 —— 八根棒合成金色风车，透明度沿时间衰减，
   * 再叠一层扇面残影补成整轮光晕。
   */
  const spokes =
    spinDegPerFrame > 1
      ? [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
          delta: -spinDegPerFrame * index,
          opacity: [1, 0.62, 0.4, 0.26, 0.17, 0.11, 0.07, 0.04][index] ?? 0.04,
        }))
      : [{delta: 0, opacity: 1}];

  const sparks = useMemo(
    () =>
      Array.from({length: 40}, (_, index) => ({
        a: hash(7101, index),
        b: hash(7102, index),
        c: hash(7103, index),
        d: hash(7104, index),
      })),
    [],
  );

  return (
    <g>
      {/* 扇面残影：把八根棒位连成金色光轮 */}
      {spinDegPerFrame > 1
        ? spokes.slice(1).map((spoke, index) => {
            const lead = ((baseDeg + step) * Math.PI) / 180;
            const trail = ((baseDeg + step + spoke.delta) * Math.PI) / 180;
            const r = length * 0.5;
            return (
              <polygon
                key={`fan-${index}`}
                points={pointsAttr([
                  [px, py],
                  [px + Math.cos(lead) * r, py + Math.sin(lead) * r],
                  [px + Math.cos(trail) * r, py + Math.sin(trail) * r],
                ])}
                fill={SENBON.gold}
                opacity={0.055 / (index * 0.6 + 1)}
                style={{mixBlendMode: 'screen'}}
              />
            );
          })
        : null}

      {spokes.map((spoke, index) => (
        <g
          key={`staff-${index}`}
          transform={`rotate(${baseDeg + step + spoke.delta} ${px} ${py})`}
          style={{mixBlendMode: index === 0 ? 'normal' : 'screen'}}
        >
          <g transform={`translate(${px} ${py})`}>{staffBody(length, thickness, spoke.opacity)}</g>
        </g>
      ))}

      {/* 火星：40 颗，从盘缘沿切线甩出 */}
      <g style={{mixBlendMode: 'screen'}}>
        {sparks.map((spark, index) => {
          const life = 0.42 + spark.b * 0.5;
          const phase = ((frame / fps) / life + spark.a * 7) % 1;
          const angle = spark.c * Math.PI * 2 + step * 0.02;
          const speed = 360 + spark.d * 640;
          const radius = length * 0.28 + speed * phase * life;
          const x = px + Math.cos(angle) * radius;
          const y = py + Math.sin(angle) * radius + 380 * phase * phase * life;
          const size = 5 + spark.a * 9;
          const dir = Math.atan2(y - py, x - px);
          const tip: Pt = [x + Math.cos(dir) * size * 2.1, y + Math.sin(dir) * size * 2.1];
          const left: Pt = [x + Math.cos(dir + 2.1) * size * 0.55, y + Math.sin(dir + 2.1) * size * 0.55];
          const right: Pt = [x + Math.cos(dir - 2.1) * size * 0.55, y + Math.sin(dir - 2.1) * size * 0.55];
          return (
            <polygon
              key={`spark-${index}`}
              points={pointsAttr([tip, left, right])}
              fill={index % 5 === 0 ? SENBON.goldPale : index % 3 === 0 ? SENBON.cinnabar : SENBON.gold}
              opacity={(1 - phase) ** 1.4 * 0.95}
            />
          );
        })}
      </g>

      {grips.map(([x, y], index) => (
        <g key={`grip-${index}`}>
          <polygon
            points={pointsAttr([
              [x - 16, y - 12],
              [x + 14, y - 6],
              [x + 16, y + 14],
              [x - 14, y + 12],
            ])}
            fill={SENBON.ink}
            stroke={SENBON.gold}
            strokeWidth={2}
          />
          <polygon
            points={pointsAttr([
              [x - 13, y - 6],
              [x + 11, y - 1],
              [x + 12, y + 9],
              [x - 11, y + 7],
            ])}
            fill="none"
            stroke={SENBON.goldLight}
            strokeWidth={1}
            opacity={0.5}
          />
        </g>
      ))}
    </g>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

export const WukongRig: React.FC<WukongRigProps> = ({
  pose,
  frame,
  wind = 1,
  high = 0,
  glow = 1,
  echo = 0,
  spinDegPerFrame = 45,
  staffAngle,
  eyeBurst = 0,
  beams = 0,
  opacity = 1,
  style,
  className,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const idName = (suffix: string) => `wk-${rawId}-${suffix}`;
  /** 渐变/滤镜必须用 `url(#id)`；只写 `#id` 会静默回落成黑色。 */
  const ids = (suffix: string) => `url(#${idName(suffix)})`;
  const geometry = POSES[pose];
  const palette = bodyPalette(ids);

  const echoLayers = pose === 'slash_horizontally' && echo > 0.01
    ? [
        {dx: -58, dy: 14, color: '#63C9C0', opacity: 0.2},
        {dx: -36, dy: 8, color: SENBON.gold, opacity: 0.32},
        {dx: -18, dy: 3, color: SENBON.cinnabar, opacity: 0.42},
      ]
    : [];

  return (
    <svg
      className={className}
      viewBox={`0 0 ${RIG_W} ${RIG_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      opacity={opacity}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible',
        filter: `drop-shadow(0 0 ${(2.4 + glow * 1.6).toFixed(2)}px ${SENBON.gold})${
          glow > 0.4 ? ` drop-shadow(0 0 ${(9 * glow).toFixed(1)}px rgba(252,201,52,0.42))` : ''
        }`,
        ...style,
      }}
    >
      <defs>
        <linearGradient id={idName('rimGrad')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} stopOpacity={0.95} />
          <stop offset="42%" stopColor={SENBON.gold} stopOpacity={0.85} />
          <stop offset="100%" stopColor={SENBON.goldDeep} stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={idName('goldFill')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="46%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.goldDeep} />
        </linearGradient>
        <linearGradient id={idName('eyeFill')} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="46%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.cinnabar} />
        </linearGradient>
        <radialGradient id={idName('spinDisc')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity={0.26} />
          <stop offset="46%" stopColor={SENBON.gold} stopOpacity={0.13} />
          <stop offset="82%" stopColor={SENBON.goldDeep} stopOpacity={0.1} />
          <stop offset="100%" stopColor={SENBON.gold} stopOpacity={0} />
        </radialGradient>
        <filter id={idName('eyeBlur')} x="-80%" y="-160%" width="260%" height="420%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* 运动模糊金盘在身体之后：剪影压住光轮，保持纯黑主体 */}
      {geometry.staff ? (
        <SpinDisc
          pivot={geometry.staff.pivot}
          length={geometry.staff.length}
          high={high}
          glow={glow}
          ids={ids}
          spinDegPerFrame={spinDegPerFrame}
        />
      ) : null}

      {/* 三层延迟重影：仅在横扫姿态 */}
      {echoLayers.map((layer, index) => (
        <g
          key={`echo-${index}`}
          transform={`translate(${layer.dx * echo} ${layer.dy * echo})`}
          opacity={layer.opacity * echo}
          style={{mixBlendMode: 'screen'}}
        >
          <Body parts={geometry.parts} palette={flatPalette(layer.color)} />
        </g>
      ))}

      <PheasantFeathers roots={geometry.feathers} frame={frame} high={high} wind={wind} glow={glow} />

      <Body parts={geometry.parts} palette={palette} />

      {/* 金箍 */}
      <polygon
        points={pointsAttr(geometry.crown)}
        fill={ids('goldFill')}
        stroke={SENBON.goldLight}
        strokeWidth={1.6}
        strokeOpacity={0.95}
      />
      {geometry.crownWings.map((wing, index) => (
        <polygon
          key={`crown-wing-${index}`}
          points={pointsAttr(wing)}
          fill={ids('goldFill')}
          stroke={SENBON.goldLight}
          strokeWidth={1.4}
          strokeOpacity={0.9}
        />
      ))}
      <polygon
        points={pointsAttr(geometry.crownCrest)}
        fill={SENBON.goldLight}
        stroke={SENBON.gold}
        strokeWidth={1.4}
        style={{filter: `drop-shadow(0 0 ${3 + glow * 2}px ${SENBON.gold})`}}
      />

      {/* 双目冲天金光 */}
      {beams > 0.01 && pose === 'trapped_overhead' ? (
        <g style={{mixBlendMode: 'screen'}} opacity={beams}>
          {[geometry.eyes.left, geometry.eyes.right].map((eye, index) => {
            const cx = (eye[0]![0] + eye[1]![0]) / 2;
            const cy = (eye[0]![1] + eye[1]![1]) / 2;
            const spread = 14 + index * 6;
            return (
              <polygon
                key={`beam-${index}`}
                points={pointsAttr([
                  [cx - 10, cy],
                  [cx - spread - 26, -160],
                  [cx + spread + 40, -160],
                  [cx + 10, cy],
                ])}
                fill={SENBON.gold}
                opacity={0.2}
              />
            );
          })}
        </g>
      ) : null}

      <Eye
        points={geometry.eyes.left}
        core={geometry.eyes.coreLeft}
        ids={ids}
        glow={glow}
        burst={eyeBurst}
      />
      <Eye
        points={geometry.eyes.right}
        core={geometry.eyes.coreRight}
        ids={ids}
        glow={glow}
        burst={eyeBurst}
      />
      <EyeFlare
        x={geometry.eyeFocus.x}
        y={geometry.eyeFocus.y}
        r={geometry.eyeFocus.r}
        burst={eyeBurst}
        glow={glow}
      />

      {geometry.staff ? (
        <SpinStaff
          pivot={geometry.staff.pivot}
          length={geometry.staff.length}
          thickness={geometry.staff.thickness}
          baseAngle={staffAngle ?? geometry.staff.angle}
          spinDegPerFrame={spinDegPerFrame}
          frame={frame}
          high={high}
          glow={glow}
          grips={geometry.staff.grips}
          ids={ids}
        />
      ) : null}
    </svg>
  );
};

export default WukongRig;
