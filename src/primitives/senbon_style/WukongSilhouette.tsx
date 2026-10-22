import React, {useId, useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {hash} from '../../utils/math';
import {catmullRom, polar, pt, sampleCubic, type Pt} from './geometry';
import {f, SENBON, TAU} from './style';

export type WukongPose = 'stand' | 'eyes_closeup' | 'kneel_defiant' | 'smash';

export interface WukongSilhouetteProps {
  pose?: WukongPose;
  /** 渲染尺寸（px）。默认 900×1240 的剪影画框。 */
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  /** 水平镜像。 */
  flip?: boolean;
  /** 覆盖金箍棒角度（度）。 */
  staffAngle?: number;
  /** 0–1，挥棒拖影强度。 */
  staffSwing?: number;
  /** 风力倍率：翎子/披风/破布共同使用。 */
  wind?: number;
  /** 0–1，眼部赤金辉光。 */
  glow?: number;
  /** 0–1，身后金色气光。 */
  aura?: number;
  /** 时间相位，用于同屏多个剪影不同步。 */
  phase?: number;
  opacity?: number;
  /** 是否画金箍棒。 */
  showStaff?: boolean;
}

const VIEW_W = 900;
const VIEW_H = 1240;

const POSE_CONFIG: Record<
  Exclude<WukongPose, 'eyes_closeup'>,
  {
    scale: number;
    shiftY: number;
    bodyRotate: number;
    headTilt: number;
    staffPivot: Pt;
    staffAngle: number;
    staffLength: number;
    legKind: 'stand' | 'kneel' | 'smash';
    armKind: 'stand' | 'kneel' | 'smash';
    capeSway: number;
  }
> = {
  stand: {
    scale: 1,
    shiftY: 0,
    bodyRotate: 0,
    headTilt: -1.5,
    staffPivot: pt(614, 640),
    staffAngle: -31,
    staffLength: 1000,
    legKind: 'stand',
    armKind: 'stand',
    capeSway: 1,
  },
  kneel_defiant: {
    scale: 0.95,
    shiftY: 128,
    bodyRotate: -1,
    headTilt: -11,
    staffPivot: pt(706, 648),
    staffAngle: 5,
    staffLength: 1080,
    legKind: 'kneel',
    armKind: 'kneel',
    capeSway: 1.5,
  },
  smash: {
    scale: 1.03,
    shiftY: 8,
    bodyRotate: -3.5,
    headTilt: 5,
    staffPivot: pt(600, 214),
    staffAngle: 118,
    staffLength: 1080,
    legKind: 'smash',
    armKind: 'smash',
    capeSway: 2.1,
  },
};

/* -------------------------------------------------------------------------- */
/*  雉鸡翎与披风的物理                                                        */
/* -------------------------------------------------------------------------- */

const featherGeometry = (
  base: Pt,
  c1: Pt,
  c2: Pt,
  tip: Pt,
  time: number,
  phase: number,
  wind: number,
): {path: string; center: Pt[]; widths: number[]} => {
  const center = sampleCubic(base, c1, c2, tip, 26);
  const count = center.length;
  const widths = center.map((_, index) => {
    const s = index / (count - 1);
    const taper = 13.5 * (1 - s) ** 0.7 + 1.2;
    const bulge = 5.5 * Math.exp(-((s - 0.5) ** 2) / 0.03);
    return taper + bulge;
  });
  const waved = center.map((point, index) => {
    const s = index / (count - 1);
    const prev = center[Math.max(0, index - 1)]!;
    const next = center[Math.min(count - 1, index + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const wave =
      (Math.sin(time * 2.05 + phase + s * 4.6) * 21 +
        Math.sin(time * 3.55 + phase * 1.7 + s * 8.1) * 7.5) *
      s *
      wind;
    return {
      x: point.x + (-dy / len) * wave,
      y: point.y + (dx / len) * wave,
    };
  });
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let index = 0; index < count; index += 1) {
    const point = waved[index]!;
    const prev = waved[Math.max(0, index - 1)]!;
    const next = waved[Math.min(count - 1, index + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = widths[index]!;
    left.push({x: point.x + nx * w, y: point.y + ny * w});
    right.push({x: point.x - nx * w, y: point.y - ny * w});
  }
  const outline = [...left, ...right.reverse()];
  const path = catmullRom([...outline, outline[0]!], 0.36) + ' Z';
  return {path, center: waved, widths};
};

const capeGeometry = (time: number, wind: number, sway: number): {path: string; folds: string[]} => {
  const points: Pt[] = [];
  for (let index = 0; index <= 9; index += 1) {
    const s = index / 9;
    const wave = Math.sin(time * 1.55 + s * 4.3) * 16 + Math.sin(time * 2.7 + s * 7.9) * 6;
    points.push({x: 318 - 108 * s + wave * wind * 0.6, y: 342 + 706 * s});
  }
  for (let index = 0; index <= 10; index += 1) {
    const s = index / 10;
    const lobe = Math.sin(s * Math.PI * 3.2 + time * 1.9) * 26 + Math.cos(time * 2.6 + s * 9.1) * 10;
    points.push({
      x: 210 + 520 * s + Math.sin(time * 1.7 + s * 6.1) * 12 * wind,
      y: 1042 + lobe * wind * 0.9 - (s > 0.45 && s < 0.6 ? 64 : 0),
    });
  }
  for (let index = 0; index <= 8; index += 1) {
    const s = index / 8;
    const wave = Math.sin(time * 1.7 + s * 5.1 + 1.4) * 15;
    points.push({x: 730 - 116 * s + wave * wind * 0.7, y: 1042 - 700 * s});
  }
  const path = catmullRom([...points, points[0]!], 0.4) + ' Z';

  const folds = [0.2, 0.42, 0.62, 0.8].map((offset, index) => {
    const start = {x: 330 + offset * 240, y: 360};
    const mid = {
      x: 250 + offset * 380 + Math.sin(time * 2.2 + index) * 22 * wind * sway,
      y: 660,
    };
    const end = {
      x: 238 + offset * 420 + Math.sin(time * 1.8 + index * 1.7) * 30 * wind,
      y: 1000,
    };
    return catmullRom([start, mid, end], 0.5);
  });
  return {path, folds};
};

/* -------------------------------------------------------------------------- */
/*  肢体路径                                                                  */
/* -------------------------------------------------------------------------- */

const LEG_PATHS = {
  stand: [
    // 左腿（观者左）
    'M 356 676 C 330 782 322 888 336 972 L 318 1062 L 296 1108 C 292 1122 306 1132 330 1132 L 424 1118 C 432 1092 424 1064 414 1044 L 420 964 C 436 866 444 770 448 682 Z',
    // 右腿
    'M 544 676 C 570 782 578 888 564 972 L 582 1062 L 604 1108 C 608 1122 594 1132 570 1132 L 476 1118 C 468 1092 476 1064 486 1044 L 480 964 C 464 866 456 770 452 682 Z',
  ],
  kneel: [
    // 跪姿左腿：膝着地，小腿后折
    'M 356 690 C 330 790 316 900 330 990 C 292 1006 268 1040 274 1072 C 278 1096 316 1108 366 1104 L 468 1094 C 486 1072 474 1038 448 1020 C 420 1004 386 1004 372 990 C 382 900 402 796 448 700 Z',
    // 右腿：脚掌踏地，膝高抬
    'M 544 690 C 590 760 640 840 626 936 L 648 1052 L 668 1094 C 674 1110 658 1120 632 1120 L 532 1108 C 520 1084 532 1054 548 1036 L 540 940 C 512 862 486 772 452 700 Z',
  ],
  smash: [
    // 弓步左腿：前腿屈膝
    'M 356 688 C 300 770 252 862 236 942 L 214 1046 L 190 1094 C 184 1112 202 1124 228 1124 L 338 1110 C 352 1084 344 1052 330 1032 L 344 948 C 382 866 430 780 452 700 Z',
    // 后腿蹬直
    'M 548 688 C 600 780 664 874 700 964 L 716 1058 L 730 1106 C 734 1122 718 1132 694 1130 L 602 1112 C 588 1088 598 1058 610 1040 L 596 958 C 560 868 506 774 452 700 Z',
  ],
} as const;

const ARM_PATHS = {
  stand: {
    left: 'M 306 352 C 266 392 246 462 252 522 C 256 562 276 592 300 612 C 318 626 344 610 348 590 C 330 562 314 518 318 470 C 322 424 340 386 356 362 Z',
    right: 'M 594 352 C 634 392 654 462 648 522 C 644 562 624 592 600 612 C 582 626 556 610 552 590 C 570 562 586 518 582 470 C 578 424 560 386 544 362 Z',
  },
  kneel: {
    left: 'M 306 356 C 268 402 252 486 276 566 C 292 616 330 652 368 666 C 388 674 406 656 402 636 C 380 608 350 574 340 528 C 330 476 344 408 360 368 Z',
    right: 'M 594 356 C 640 398 682 470 706 546 C 720 590 718 620 706 640 C 690 664 660 662 640 646 C 646 618 640 586 626 550 C 606 494 580 414 560 368 Z',
  },
  smash: {
    left: 'M 306 352 C 262 322 232 278 240 232 C 246 202 274 190 298 204 C 316 216 332 250 344 282 C 358 318 376 340 394 356 Z',
    right: 'M 594 352 C 638 322 668 278 660 232 C 654 202 626 190 602 204 C 584 216 568 250 556 282 C 542 318 524 340 506 356 Z',
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 参数化大圣矢量剪影。
 *
 * 全部由 SVG path 构成：鬃毛、锁子甲、护心镜、战裙、云靴、雉鸡翎、披风、
 * 金箍棒。翎子与披风绑 `useCurrentFrame()` 的正弦/余弦波函数；双眸带赤金
 * 发光滤镜；金箍棒支持独立角度与挥击拖影。
 */
export const WukongSilhouette: React.FC<WukongSilhouetteProps> = ({
  pose = 'stand',
  width = VIEW_W,
  height = VIEW_H,
  className,
  style,
  flip = false,
  staffAngle,
  staffSwing = 0,
  wind = 1,
  glow = 1,
  aura = 0.55,
  phase = 0,
  opacity = 1,
  showStaff = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps + phase;
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `wk-${rawId}-${suffix}`;

  const config = POSE_CONFIG[pose === 'eyes_closeup' ? 'stand' : pose];
  const effectiveStaffAngle = staffAngle ?? config.staffAngle;
  const glowStrength = Math.min(1, Math.max(0, glow));

  const featherLeft = useMemo(
    () =>
      featherGeometry(
        pt(412, 168),
        pt(330, 26),
        pt(198, 128),
        pt(54, 334),
        time,
        phase + 0.4,
        wind,
      ),
    [phase, time, wind],
  );
  const featherRight = useMemo(
    () =>
      featherGeometry(
        pt(488, 168),
        pt(570, 26),
        pt(702, 128),
        pt(846, 334),
        time,
        phase + 2.15,
        wind,
      ),
    [phase, time, wind],
  );
  const cape = useMemo(
    () => capeGeometry(time, wind, config.capeSway),
    [config.capeSway, time, wind],
  );

  const mane = useMemo(() => {
    const points: Pt[] = [];
    for (let index = 0; index < 30; index += 1) {
      const angle = -Math.PI * 1.02 + (index / 29) * Math.PI * 2.04;
      /* 头顶保持平整（紧箍压住），只在两颊与下颌长出炸开的鬃毛。 */
      const upper = angle > -Math.PI * 0.8 && angle < -Math.PI * 0.2;
      const spike = upper ? 0 : index % 2 === 0 ? 24 : 5;
      const jitter = upper ? 4 : hash(9137, index) * 12;
      points.push(polar(450, 246, 98 + spike + jitter, angle));
    }
    points.push(polar(450, 372, 88, Math.PI / 2));
    return catmullRom([...points, points[0]!], 0.4) + ' Z';
  }, []);

  const barbs = useMemo(() => {
    const build = (feather: {center: Pt[]; widths: number[]}, seed: number) =>
      Array.from({length: 26}, (_, index) => {
        const s = 0.24 + (index / 25) * 0.68;
        const pointIndex = Math.min(feather.center.length - 1, Math.round(s * (feather.center.length - 1)));
        const point = feather.center[pointIndex]!;
        const prev = feather.center[Math.max(0, pointIndex - 1)]!;
        const next = feather.center[Math.min(feather.center.length - 1, pointIndex + 1)]!;
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const half = feather.widths[pointIndex]! + 6 + hash(seed, index) * 12;
        const side = index % 2 === 0 ? 1 : -1;
        return {
          x1: point.x + nx * half * 0.2,
          y1: point.y + ny * half * 0.2,
          x2: point.x + nx * half * side,
          y2: point.y + ny * half * side,
          alpha: 0.18 + hash(seed + 5, index) * 0.32,
        };
      });
    return [...build(featherLeft, 331), ...build(featherRight, 977)];
  }, [featherLeft, featherRight]);

  if (pose === 'eyes_closeup') {
    return (
      <EyeCloseup
        width={width}
        height={height}
        className={className}
        style={style}
        time={time}
        glow={glowStrength}
        opacity={opacity}
        flip={flip}
      />
    );
  }

  const legPaths = LEG_PATHS[config.legKind];
  const armPaths = ARM_PATHS[config.armKind];
  const staffPivot = config.staffPivot;
  const staffTop = staffPivot.y - config.staffLength * 0.62;
  const staffBottom = staffPivot.y + config.staffLength * 0.38;
  const swing = Math.min(1, Math.max(0, staffSwing));
  const bodyScale = config.scale * (1 + Math.sin(time * 1.4 + phase) * 0.004);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={height}
      className={className}
      aria-label="孙悟空剪影"
      role="img"
      style={{
        overflow: 'visible',
        opacity,
        transform: flip ? 'scaleX(-1)' : undefined,
        filter: 'drop-shadow(0 18px 34px rgba(0,0,0,0.65))',
        ...style,
      }}
    >
      <defs>
        <radialGradient id={id('aura')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0.34" />
          <stop offset="46%" stopColor={SENBON.cinnabar} stopOpacity="0.14" />
          <stop offset="100%" stopColor={SENBON.ink} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('staff')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.goldShadow} />
          <stop offset="18%" stopColor={SENBON.goldDeep} />
          <stop offset="46%" stopColor={SENBON.goldLight} />
          <stop offset="58%" stopColor={SENBON.gold} />
          <stop offset="82%" stopColor={SENBON.goldDeep} />
          <stop offset="100%" stopColor={SENBON.goldShadow} />
        </linearGradient>
        <linearGradient id={id('capeFill')} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={SENBON.inkLift} />
          <stop offset="55%" stopColor={SENBON.inkSoft} />
          <stop offset="100%" stopColor={SENBON.ink} />
        </linearGradient>
        <linearGradient id={id('armor')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SENBON.inkLift} />
          <stop offset="100%" stopColor={SENBON.inkSoft} />
        </linearGradient>
        <linearGradient id={id('trail')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
          <stop offset="45%" stopColor={SENBON.goldLight} stopOpacity="0.75" />
          <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('halftone')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SENBON.paper} stopOpacity="0.16" />
          <stop offset="100%" stopColor={SENBON.paper} stopOpacity="0.02" />
        </linearGradient>
        <pattern id={id('dots')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <circle cx="1.8" cy="1.8" r="1.05" fill={SENBON.paper} opacity="0.32" />
        </pattern>
        <filter id={id('eyeGlow')} x="-140%" y="-140%" width="380%" height="380%">
          <feGaussianBlur stdDeviation="7.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('staffGlow')} x="-80%" y="-30%" width="260%" height="160%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
        <clipPath id={id('capeClip')}>
          <path d={cape.path} />
        </clipPath>
      </defs>

      {/* 身后气光 */}
      {aura > 0 ? (
        <ellipse
          cx="450"
          cy="620"
          rx="430"
          ry="560"
          fill={`url(#${id('aura')})`}
          opacity={aura}
        />
      ) : null}

      <g
        transform={`translate(450 ${VIEW_H}) scale(${bodyScale.toFixed(4)}) translate(-450 -${VIEW_H}) translate(0 ${config.shiftY}) rotate(${config.bodyRotate} 450 700) translate(450 0) scale(1.06 1) translate(-450 0)`}
      >
        {/* 披风 */}
        <g>
          <path d={cape.path} fill={`url(#${id('capeFill')})`} stroke={SENBON.cinnabarDeep} strokeWidth={3} strokeOpacity={0.7} />
          <path d={cape.path} fill="none" stroke={SENBON.gold} strokeWidth={2.6} strokeOpacity={0.4} />
          <path d={cape.path} fill={`url(#${id('dots')})`} opacity={0.5} />
          <g clipPath={`url(#${id('capeClip')})`}>
            {cape.folds.map((fold, index) => (
              <path
                key={`fold-${index}`}
                d={fold}
                fill="none"
                stroke={index % 2 === 0 ? SENBON.cinnabar : SENBON.gold}
                strokeWidth={index % 2 === 0 ? 3 : 1.6}
                strokeOpacity={index % 2 === 0 ? 0.32 : 0.22}
              />
            ))}
            {/* 披风下摆的鎏金滚边 */}
            <path
              d={catmullRom(
                Array.from({length: 12}, (_, index) => {
                  const s = index / 11;
                  return {
                    x: 212 + 516 * s + Math.sin(time * 1.7 + s * 6.1) * 12 * wind,
                    y: 1028 - Math.abs(Math.sin(s * Math.PI * 3.2 + time * 1.9)) * 24 * wind,
                  };
                }),
                0.5,
              )}
              fill="none"
              stroke={SENBON.gold}
              strokeWidth={2.4}
              strokeOpacity={0.42}
            />
          </g>
        </g>

        {/* 雉鸡翎（在头之后、披风之前会更清楚，但必须先画，头部覆盖羽根） */}
        <g>
          {[featherLeft, featherRight].map((feather, index) => (
            <g key={`feather-${index}`}>
              <path
                d={feather.path}
                fill={SENBON.ink}
                stroke={SENBON.gold}
                strokeWidth={1.6}
                strokeOpacity={0.55}
              />
              <path
                d={feather.path}
                fill="none"
                stroke={SENBON.cinnabar}
                strokeWidth={1.1}
                strokeOpacity={0.45}
                transform="scale(0.986) translate(6 8)"
              />
            </g>
          ))}
          {barbs.map((barb, index) => (
            <line
              key={`barb-${index}`}
              x1={barb.x1}
              y1={barb.y1}
              x2={barb.x2}
              y2={barb.y2}
              stroke={index % 3 === 0 ? SENBON.gold : SENBON.paperDim}
              strokeWidth={1.1}
              strokeOpacity={barb.alpha}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* 腿 + 云靴 */}
        <g>
          {legPaths.map((path, index) => (
            <g key={`leg-${index}`}>
              <path d={path} fill={SENBON.ink} stroke={SENBON.inkEdge} strokeWidth={4} />
              <path d={path} fill={`url(#${id('dots')})`} opacity={0.4} />
              {/* 绑腿金线 */}
              <path
                d={
                  index === 0
                    ? 'M 330 972 C 360 986 392 990 420 982'
                    : 'M 570 972 C 540 986 508 990 480 982'
                }
                fill="none"
                stroke={SENBON.gold}
                strokeWidth={3}
                strokeOpacity={0.55}
              />
              {/* 云靴头 */}
              <path
                d={
                  index === 0
                    ? 'M 290 1104 C 324 1086 380 1082 424 1094 C 440 1098 444 1118 428 1126 C 386 1144 320 1146 294 1132 C 282 1126 282 1110 290 1104 Z'
                    : 'M 610 1104 C 576 1086 520 1082 476 1094 C 460 1098 456 1118 472 1126 C 514 1144 580 1146 606 1132 C 618 1126 618 1110 610 1104 Z'
                }
                fill={SENBON.inkLift}
                stroke={SENBON.gold}
                strokeWidth={2.4}
                strokeOpacity={0.7}
              />
            </g>
          ))}
        </g>

        {/* 战裙 */}
        <g>
          {[
            'M 344 600 L 408 606 L 396 812 L 360 862 L 330 796 Z',
            'M 404 604 L 456 610 L 452 836 L 424 884 L 402 820 Z',
            'M 452 610 L 504 604 L 522 820 L 494 878 L 458 832 Z',
            'M 504 604 L 560 600 L 590 790 L 556 856 L 520 812 Z',
          ].map((skirt, index) => (
            <g key={`skirt-${index}`}>
              <path
                d={skirt}
                fill={index % 2 === 0 ? SENBON.ink : SENBON.inkLift}
                stroke={SENBON.gold}
                strokeWidth={2.2}
                strokeOpacity={0.5}
              />
              <path
                d={skirt}
                fill={`url(#${id('dots')})`}
                opacity={0.35}
              />
            </g>
          ))}
        </g>

        {/* 躯干 + 山文甲 */}
        <g>
          <path
            d="M 300 360 C 340 336 398 324 450 324 C 502 324 560 336 600 360 L 578 520 C 560 574 520 610 450 614 C 380 610 340 574 322 520 Z"
            fill={SENBON.ink}
            stroke={SENBON.inkEdge}
            strokeWidth={4}
          />
          <path
            d="M 326 382 C 366 362 410 352 450 352 C 490 352 534 362 574 382 L 556 506 C 540 552 504 580 450 584 C 396 580 360 552 344 506 Z"
            fill={`url(#${id('armor')})`}
            stroke={SENBON.gold}
            strokeWidth={3.2}
            strokeOpacity={0.58}
          />
          <path
            d="M 326 382 C 366 362 410 352 450 352 C 490 352 534 362 574 382 L 556 506 C 540 552 504 580 450 584 C 396 580 360 552 344 506 Z"
            fill={`url(#${id('dots')})`}
            opacity={0.4}
          />
          {[430, 466, 502].map((y) => (
            <path
              key={`lame-${y}`}
              d={`M ${354 + (y - 430) * 0.18} ${y} C 400 ${y - 12} 500 ${y - 12} ${546 - (y - 430) * 0.18} ${y}`}
              fill="none"
              stroke={SENBON.gold}
              strokeWidth={2}
              strokeOpacity={0.38}
            />
          ))}
          {/* 护心镜 */}
          <circle cx="450" cy="452" r="62" fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={5} />
          <circle cx="450" cy="452" r="46" fill="none" stroke={SENBON.cinnabar} strokeWidth={7} strokeOpacity={0.85} />
          <path
            d="M 450 412 C 474 424 478 448 462 462 C 448 474 430 466 432 450 C 434 436 448 430 458 438 C 464 442 462 452 454 454"
            fill="none"
            stroke={SENBON.goldLight}
            strokeWidth={4}
            strokeOpacity={0.9}
          />
          <circle cx="450" cy="452" r="8" fill={SENBON.goldLight} />
          {/* 腰带与虎头扣 */}
          <rect x="338" y="594" width="224" height="34" rx="6" fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={2.6} />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <rect
              key={`belt-${index}`}
              x={350 + index * 30}
              y={600}
              width={18}
              height={22}
              rx={2}
              fill="none"
              stroke={SENBON.gold}
              strokeOpacity={0.5}
              strokeWidth={1.4}
            />
          ))}
          <circle cx="450" cy="612" r="31" fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={4} />
          <path d="M 434 604 L 466 604 L 458 620 L 442 620 Z" fill={SENBON.gold} opacity={0.9} />
          <circle cx="440" cy="608" r="3.2" fill={SENBON.cinnabar} />
          <circle cx="460" cy="608" r="3.2" fill={SENBON.cinnabar} />
          <path d="M 442 622 Q 450 630 458 622" fill="none" stroke={SENBON.gold} strokeWidth={2.4} />
          {/* 朱砂腰带与垂绦 */}
          <path
            d="M 340 628 C 400 650 500 650 560 628 L 566 668 C 500 692 400 692 334 668 Z"
            fill={SENBON.cinnabarDeep}
            stroke={SENBON.gold}
            strokeWidth={2}
            strokeOpacity={0.55}
            opacity={0.92}
          />
          <path d="M 372 660 L 360 780 L 386 796 L 398 670 Z" fill={SENBON.cinnabarDeep} opacity={0.75} stroke={SENBON.gold} strokeWidth={1.4} strokeOpacity={0.4} />
          <path d="M 528 660 L 540 780 L 514 796 L 502 670 Z" fill={SENBON.cinnabarDeep} opacity={0.75} stroke={SENBON.gold} strokeWidth={1.4} strokeOpacity={0.4} />
        </g>

        {/* 肩吞 + 手臂 */}
        <g>
          {[0, 1].map((side) => {
            const mirror = side === 1;
            return (
              <g key={`shoulder-${side}`} transform={mirror ? 'translate(900 0) scale(-1 1)' : undefined}>
                {[0, 1, 2].map((layer) => (
                  <path
                    key={`pauldron-${layer}`}
                    d={`M ${278 + layer * 6} ${362 + layer * 30} C ${246 + layer * 4} ${392 + layer * 26} ${240 + layer * 4} ${430 + layer * 24} ${264 + layer * 6} ${454 + layer * 22} C ${300 + layer * 4} ${462 + layer * 20} ${330 + layer * 3} ${438 + layer * 24} ${330 + layer * 3} ${410 + layer * 26} C ${330 + layer * 3} ${386 + layer * 28} ${314 + layer * 4} ${370 + layer * 28} ${290 + layer * 5} ${362 + layer * 30} Z`}
                    fill={layer === 0 ? SENBON.inkLift : SENBON.inkSoft}
                    stroke={SENBON.gold}
                    strokeWidth={2.2}
                    strokeOpacity={0.5 - layer * 0.08}
                  />
                ))}
                {/* 肩甲尖刺 */}
                <path d="M 252 402 L 224 372 L 268 386 Z" fill={SENBON.gold} opacity={0.55} />
                <path d="M 246 448 L 210 430 L 256 428 Z" fill={SENBON.gold} opacity={0.4} />
              </g>
            );
          })}
          <path d={armPaths.left} fill={SENBON.ink} stroke={SENBON.inkEdge} strokeWidth={4} />
          <path d={armPaths.right} fill={SENBON.ink} stroke={SENBON.inkEdge} strokeWidth={4} />
          <path d={armPaths.left} fill={`url(#${id('dots')})`} opacity={0.35} />
          <path d={armPaths.right} fill={`url(#${id('dots')})`} opacity={0.35} />
          {/* 护腕 */}
          <rect x={254} y={config.armKind === 'smash' ? 226 : 524} width={62} height={34} rx={8} fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={2.6} transform={`rotate(${config.armKind === 'smash' ? -28 : 8} ${285} ${config.armKind === 'smash' ? 243 : 541})`} />
          <rect x={584} y={config.armKind === 'smash' ? 226 : 524} width={62} height={34} rx={8} fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={2.6} transform={`rotate(${config.armKind === 'smash' ? 28 : -8} ${615} ${config.armKind === 'smash' ? 243 : 541})`} />
        </g>

        {/* 金箍棒 */}
        {showStaff ? (
          <g>
            {swing > 0.01 ? (
              <path
                d={`M ${staffPivot.x} ${staffPivot.y} m -${config.staffLength * 0.5} 0 a ${config.staffLength * 0.5} ${config.staffLength * 0.5} 0 0 1 ${config.staffLength} 0`}
                fill="none"
                stroke={`url(#${id('trail')})`}
                strokeWidth={70 + swing * 90}
                strokeLinecap="round"
                opacity={0.5 * swing}
                transform={`rotate(${effectiveStaffAngle + 58} ${staffPivot.x} ${staffPivot.y})`}
              />
            ) : null}
            <g transform={`rotate(${effectiveStaffAngle} ${staffPivot.x} ${staffPivot.y})`}>
              {/* 辉光 */}
              <rect
                x={staffPivot.x - 26}
                y={staffTop}
                width={52}
                height={staffBottom - staffTop}
                rx={26}
                fill={SENBON.gold}
                opacity={0.24 + swing * 0.3}
                filter={`url(#${id('staffGlow')})`}
              />
              <rect
                x={staffPivot.x - 24}
                y={staffTop}
                width={48}
                height={staffBottom - staffTop}
                rx={24}
                fill={`url(#${id('staff')})`}
                stroke={SENBON.goldShadow}
                strokeWidth={2}
              />
              <rect
                x={staffPivot.x - 7}
                y={staffTop + 14}
                width={12}
                height={staffBottom - staffTop - 28}
                rx={6}
                fill={SENBON.goldPale}
                opacity={0.55}
              />
              {/* 两端朱砂箍 */}
              <rect x={staffPivot.x - 30} y={staffTop + 6} width={60} height={64} rx={8} fill={SENBON.cinnabarDeep} stroke={SENBON.goldLight} strokeWidth={2.4} />
              <rect x={staffPivot.x - 30} y={staffBottom - 70} width={60} height={64} rx={8} fill={SENBON.cinnabarDeep} stroke={SENBON.goldLight} strokeWidth={2.4} />
              <circle cx={staffPivot.x} cy={staffTop + 2} r={18} fill={SENBON.goldLight} stroke={SENBON.goldShadow} strokeWidth={2} />
              <circle cx={staffPivot.x} cy={staffBottom - 2} r={18} fill={SENBON.goldLight} stroke={SENBON.goldShadow} strokeWidth={2} />
              {/* 云纹 */}
              {Array.from({length: 9}, (_, index) => (
                <circle
                  key={`staff-dot-${index}`}
                  cx={staffPivot.x + (index % 2 === 0 ? -5 : 5)}
                  cy={staffTop + 110 + index * ((staffBottom - staffTop - 190) / 9)}
                  r={3.4}
                  fill={SENBON.goldShadow}
                  opacity={0.5}
                />
              ))}
              {/* 分段金箍：避免整根读成一根发光灯管 */}
              {[0.2, 0.38, 0.56, 0.74, 0.9].map((ratio) => {
                const cy = staffTop + (staffBottom - staffTop) * ratio;
                return (
                  <g key={`staff-collar-${ratio}`}>
                    <rect x={staffPivot.x - 27} y={cy - 5} width={54} height={10} rx={4} fill={SENBON.goldDeep} stroke={SENBON.goldPale} strokeWidth={1} opacity={0.9} />
                    <circle cx={staffPivot.x} cy={cy} r={3} fill={SENBON.cinnabar} />
                  </g>
                );
              })}
            </g>
          </g>
        ) : null}

        {/* 头 */}
        <g transform={`rotate(${config.headTilt} 450 300)`}>
          <path d={mane} fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={2.4} strokeOpacity={0.34} />
          <path d={mane} fill={`url(#${id('dots')})`} opacity={0.35} />
          <path
            d="M 450 146 C 508 146 550 192 550 248 C 550 310 508 348 450 348 C 392 348 350 310 350 248 C 350 192 392 146 450 146 Z"
            fill={SENBON.ink}
            stroke={SENBON.inkEdge}
            strokeWidth={4}
          />
          {/* 猴吻部：让剪影从“恶魔面具”变成猕猴侧脸结构 */}
          <ellipse cx="450" cy="288" rx="58" ry="42" fill="#1B1313" stroke={SENBON.gold} strokeOpacity={0.28} strokeWidth={2} />
          <ellipse cx="450" cy="294" rx="43" ry="27" fill="#2A1A18" opacity="0.92" />
          <path d="M 418 270 C 432 260 468 260 482 270" fill="none" stroke={SENBON.gold} strokeWidth={2.4} strokeOpacity={0.5} />
          {/* 面颊绒毛 */}
          <path d="M 356 252 L 330 246 L 350 278 L 332 286 L 360 300 Z" fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={1.4} strokeOpacity={0.4} />
          <path d="M 544 252 L 570 246 L 550 278 L 568 286 L 540 300 Z" fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={1.4} strokeOpacity={0.4} />
          {/* 耳 */}
          <path d="M 354 232 C 320 210 306 256 326 286 C 338 304 356 296 362 280" fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={3} strokeOpacity={0.65} />
          <path d="M 546 232 C 580 210 594 256 574 286 C 562 304 544 296 538 280" fill={SENBON.inkSoft} stroke={SENBON.gold} strokeWidth={3} strokeOpacity={0.65} />
          {/* 眉骨 */}
          <path d="M 382 208 C 404 190 430 192 448 208" fill="none" stroke={SENBON.gold} strokeWidth={7} strokeLinecap="round" />
          <path d="M 518 208 C 496 190 470 192 452 208" fill="none" stroke={SENBON.gold} strokeWidth={7} strokeLinecap="round" />
          {/* 眼 */}
          <g filter={`url(#${id('eyeGlow')})`} opacity={0.75 + glowStrength * 0.25}>
            <path d="M 394 242 C 406 226 434 226 446 242 C 434 256 406 256 394 242 Z" fill={SENBON.goldLight} />
            <path d="M 454 242 C 466 226 494 226 506 242 C 494 256 466 256 454 242 Z" fill={SENBON.goldLight} />
          </g>
          <ellipse cx="422" cy="242" rx="4.6" ry="10" fill={SENBON.cinnabarDeep} />
          <ellipse cx="478" cy="242" rx="4.6" ry="10" fill={SENBON.cinnabarDeep} />
          <circle cx="423.5" cy="239" r="1.7" fill={SENBON.goldPale} />
          <circle cx="479.5" cy="239" r="1.7" fill={SENBON.goldPale} />
          {/* 鼻 / 口 / 獠牙 */}
          <path d="M 442 272 L 438 282 M 458 272 L 462 282" stroke={SENBON.gold} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
          <path d="M 416 296 C 434 310 466 310 484 296" fill="none" stroke={SENBON.paper} strokeWidth={3} strokeOpacity={0.72} />
          <path d="M 424 300 L 432 318 L 438 300 Z" fill={SENBON.paper} opacity={0.85} />
          <path d="M 476 300 L 468 318 L 462 300 Z" fill={SENBON.paper} opacity={0.85} />
          <path d="M 400 276 C 410 284 420 286 430 282" fill="none" stroke={SENBON.cinnabar} strokeWidth={2} strokeOpacity={0.5} />
          <path d="M 500 276 C 490 284 480 286 470 282" fill="none" stroke={SENBON.cinnabar} strokeWidth={2} strokeOpacity={0.5} />
          {/* 紧箍 */}
          <path d="M 362 204 C 398 176 502 176 538 204" fill="none" stroke={SENBON.gold} strokeWidth={12} strokeLinecap="round" />
          <path d="M 362 204 C 398 176 502 176 538 204" fill="none" stroke={SENBON.goldLight} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
          <path d="M 358 202 C 346 190 350 178 362 182 C 372 186 370 198 360 200" fill="none" stroke={SENBON.gold} strokeWidth={5} strokeLinecap="round" />
          <path d="M 542 202 C 554 190 550 178 538 182 C 528 186 530 198 540 200" fill="none" stroke={SENBON.gold} strokeWidth={5} strokeLinecap="round" />
          <circle cx="450" cy="186" r="12" fill={SENBON.cinnabar} stroke={SENBON.goldLight} strokeWidth={3} />
          <circle cx="450" cy="186" r="4" fill={SENBON.goldPale} />
        </g>

        {/* 手（覆盖棒身） */}
        <g>
          <path
            d={
              config.armKind === 'smash'
                ? 'M 576 196 C 596 182 626 186 634 204 C 642 224 622 240 600 236 C 582 232 566 212 576 196 Z'
                : `M ${staffPivot.x - 26} ${staffPivot.y - 18} C ${staffPivot.x - 6} ${staffPivot.y - 30} ${staffPivot.x + 24} ${staffPivot.y - 20} ${staffPivot.x + 28} ${staffPivot.y + 2} C ${staffPivot.x + 30} ${staffPivot.y + 22} ${staffPivot.x + 6} ${staffPivot.y + 32} ${staffPivot.x - 14} ${staffPivot.y + 24} C ${staffPivot.x - 30} ${staffPivot.y + 16} ${staffPivot.x - 34} ${staffPivot.y - 4} ${staffPivot.x - 26} ${staffPivot.y - 18} Z`
            }
            fill={SENBON.ink}
            stroke={SENBON.gold}
            strokeWidth={2.8}
          />
          <path
            d={
              config.armKind === 'smash'
                ? 'M 588 210 L 622 206 M 590 220 L 624 216'
                : `M ${staffPivot.x - 18} ${staffPivot.y - 4} L ${staffPivot.x + 18} ${staffPivot.y - 2} M ${staffPivot.x - 20} ${staffPivot.y + 8} L ${staffPivot.x + 16} ${staffPivot.y + 10}`
            }
            stroke={SENBON.gold}
            strokeWidth={2}
            strokeOpacity={0.6}
          />
          {config.armKind !== 'smash' ? (
            <circle cx={252} cy={config.armKind === 'kneel' ? 660 : 606} r={26} fill={SENBON.ink} stroke={SENBON.gold} strokeWidth={2.6} />
          ) : null}
        </g>
      </g>
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  火眼金睛特写                                                              */
/* -------------------------------------------------------------------------- */

interface EyeCloseupProps {
  width: number;
  height: number;
  className?: string;
  style?: React.CSSProperties;
  time: number;
  glow: number;
  opacity: number;
  flip: boolean;
}

const EyeCloseup: React.FC<EyeCloseupProps> = ({
  width,
  height,
  className,
  style,
  time,
  glow,
  opacity,
  flip,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `eye-${rawId}-${suffix}`;

  const contraction = 0.52 + Math.abs(Math.sin(time * 3.4)) * 0.34;
  const flare = 0.55 + Math.sin(time * 7.2) * 0.18;

  const beams = useMemo(
    () =>
      Array.from({length: 18}, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        const y = 205 + row * 7 - Math.sin(time * 2.1 + index) * 16;
        const length = 90 + hash(7717, index) * 380 + Math.sin(time * 5 + index) * 90;
        return {
          x1: 450 + side * (110 + row * 7),
          x2: 450 + side * (110 + row * 7 + length),
          y1: y,
          y2: y + (hash(8821, index) - 0.5) * 60,
          width: 1 + hash(991, index) * 4,
          alpha: 0.16 + hash(551, index) * 0.6,
        };
      }),
    [time],
  );

  return (
    <svg
      viewBox="0 0 900 520"
      width={width}
      height={height}
      className={className}
      aria-label="火眼金睛"
      role="img"
      style={{
        overflow: 'visible',
        opacity,
        transform: flip ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    >
      <defs>
        <radialGradient id={id('iris')} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="34%" stopColor={SENBON.gold} />
          <stop offset="72%" stopColor={SENBON.goldDeep} />
          <stop offset="100%" stopColor={SENBON.cinnabarDeep} />
        </radialGradient>
        <radialGradient id={id('sclera')} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.28" />
          <stop offset="70%" stopColor={SENBON.inkSoft} stopOpacity="0.6" />
          <stop offset="100%" stopColor={SENBON.ink} />
        </radialGradient>
        <linearGradient id={id('beam')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.05" />
          <stop offset="42%" stopColor={SENBON.goldLight} stopOpacity="0.9" />
          <stop offset="100%" stopColor={SENBON.cinnabar} stopOpacity="0" />
        </linearGradient>
        <pattern id={id('dots')} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(36)">
          <circle cx="1.5" cy="1.5" r="1" fill={SENBON.paper} opacity="0.4" />
        </pattern>
        <clipPath id={id('eyeClip')}>
          <path d="M 72 260 C 250 92 650 92 828 260 C 650 428 250 428 72 260 Z" />
        </clipPath>
        <filter id={id('glow')} x="-60%" y="-120%" width="220%" height="340%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('irisGlow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
      </defs>

      {/* 横向赤金闪电光束 */}
      <g opacity={0.55 + glow * 0.4}>
        {beams.map((beam, index) => (
          <line
            key={`beam-${index}`}
            x1={beam.x1}
            y1={beam.y1}
            x2={beam.x2}
            y2={beam.y2}
            stroke={`url(#${id('beam')})`}
            strokeWidth={beam.width}
            opacity={beam.alpha * flare}
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* 眼白底 */}
      <path
        d="M 72 260 C 250 92 650 92 828 260 C 650 428 250 428 72 260 Z"
        fill={SENBON.ink}
        stroke={SENBON.gold}
        strokeWidth={9}
      />
      <g clipPath={`url(#${id('eyeClip')})`}>
        <path
          d="M 72 260 C 250 92 650 92 828 260 C 650 428 250 428 72 260 Z"
          fill={`url(#${id('sclera')})`}
        />
        <rect x="60" y="80" width="780" height="380" fill={`url(#${id('dots')})`} opacity="0.32" />
        {/* 虹膜 */}
        <circle cx="450" cy="262" r="148" fill={SENBON.cinnabarDeep} opacity={0.55} filter={`url(#${id('irisGlow')})`} />
        <circle cx="450" cy="262" r="134" fill={`url(#${id('iris')})`} stroke={SENBON.goldLight} strokeWidth={6} />
        {Array.from({length: 40}, (_, index) => {
          const angle = (index / 40) * TAU + Math.sin(time * 0.7) * 0.08;
          return (
            <line
              key={`fiber-${index}`}
              x1={450 + Math.cos(angle) * 42}
              y1={262 + Math.sin(angle) * 42}
              x2={450 + Math.cos(angle) * 126}
              y2={262 + Math.sin(angle) * 126}
              stroke={index % 3 === 0 ? SENBON.paper : SENBON.goldLight}
              strokeWidth={1.3}
              opacity={0.22 + (index % 5) * 0.08}
            />
          );
        })}
        <circle cx="450" cy="262" r="106" fill="none" stroke={SENBON.cinnabar} strokeWidth={3} opacity={0.55} />
        {/* 竖瞳收缩 */}
        <ellipse
          cx="450"
          cy="262"
          rx={42 * contraction}
          ry={96 * (1.08 - contraction * 0.2)}
          fill={SENBON.ink}
          stroke={SENBON.goldLight}
          strokeWidth={2.4}
        />
        <circle cx="414" cy="218" r="20" fill={SENBON.goldPale} opacity={0.6} />
        <circle cx="486" cy="308" r="11" fill={SENBON.goldPale} opacity={0.4} />
        {/* 眼睑阴影 */}
        <path
          d="M 72 260 C 250 92 650 92 828 260 C 720 190 250 190 72 260 Z"
          fill={SENBON.ink}
          opacity={0.85}
        />
        <path
          d="M 72 260 C 250 428 650 428 828 260 C 700 330 240 330 72 260 Z"
          fill={SENBON.inkSoft}
          opacity={0.9}
        />
      </g>

      {/* 上眼睑与睫毛 */}
      <path
        d="M 66 258 C 246 78 654 78 834 258 C 660 132 240 132 66 258 Z"
        fill={SENBON.ink}
        stroke={SENBON.gold}
        strokeWidth={4}
      />
      {Array.from({length: 11}, (_, index) => {
        const t = index / 10;
        const x = 120 + t * 660;
        const y = 196 - Math.sin(t * Math.PI) * 74;
        return (
          <path
            key={`lash-${index}`}
            d={`M ${x} ${y} L ${x + (t - 0.5) * 26} ${y - 44 - Math.sin(t * Math.PI) * 20}`}
            stroke={SENBON.gold}
            strokeWidth={4.2}
            strokeLinecap="round"
            opacity={0.7}
          />
        );
      })}

      {/* 火焰眉 */}
      <g filter={`url(#${id('glow')})`} opacity={0.85}>
        <path d="M 176 150 C 250 104 352 96 430 126 C 372 122 320 138 288 164 C 340 146 388 152 420 172 C 350 158 268 176 214 212 C 246 178 244 162 176 150 Z" fill={SENBON.cinnabar} />
        <path d="M 724 150 C 650 104 548 96 470 126 C 528 122 580 138 612 164 C 560 146 512 152 480 172 C 550 158 632 176 686 212 C 654 178 656 162 724 150 Z" fill={SENBON.cinnabar} />
      </g>
      <path d="M 190 158 C 260 122 348 114 418 140" fill="none" stroke={SENBON.gold} strokeWidth={5} strokeLinecap="round" />
      <path d="M 710 158 C 640 122 552 114 482 140" fill="none" stroke={SENBON.gold} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
};

export default WukongSilhouette;
