import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, f} from './style';

/**
 * `<WukongFaceCloseup />` —— 京剧美猴王金色桃心脸谱的高精度特写。
 *
 * 这不是「两个带感叹号的三角眼」。分层：
 *   ① 墨底头骨 + 额顶鬃毛尖刺 + 双耳
 *   ② 金色桃心脸谱（多层贝塞尔外轮廓 + 内圈朱砂压边）
 *   ③ 京剧纹样：眉心火焰、太阳穴云纹、颧骨卷草、鼻梁与獠牙口
 *   ④ 火眼金睛：黑眼窝 + 金线眼睑 + 36 道赤金放射虹膜 + 竖瞳 + 星芒
 *   ⑤ 紧箍咒：云纹金箍 + 中央朱砂宝珠 + 凤翅
 *   ⑥ 锁子甲领口：互扣环 pattern + 山文甲肩片 + 云纹护喉
 *   ⑦ 战损（可选）：刀痕裂纹 + 崩口 + 烟熏
 *   ⑧ 金火粒子与横向拉丝（由 frame / intensity / high 驱动）
 *
 * `variant="eyes"` 时裁到眼部横条（viewBox 170 300 660 300），供 Shot 2A 使用；
 * `variant="full"` 用于 Shot 4B 的四连跳切。
 *
 * 所有几何都是显式数值 / 纯函数，禁止 Math.random。
 */
export interface WukongFaceCloseupProps {
  /** 复刻段绝对帧，驱动火焰粒子与微颤。 */
  frame: number;
  /** 0–1 怒目强度：虹膜收缩、金火变旺、星芒变长。 */
  intensity?: number;
  /** 音频高频能量 0–1。 */
  high?: number;
  variant?: 'full' | 'eyes';
  /** 0–1 战损裂纹。 */
  damage?: number;
  /** 0–1 眼部爆闪。 */
  eyeBurst?: number;
  /** 瞳孔横移（px，眼坐标系）。 */
  gaze?: number;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

const EYE = {leftX: 398, rightX: 602, y: 432};

const polar = (cx: number, cy: number, radius: number, angle: number): [number, number] => [
  cx + Math.cos(angle) * radius,
  cy + Math.sin(angle) * radius,
];

const tri = (cx: number, cy: number, size: number, angle: number): string => {
  const points = [0, 1, 2].map((index) =>
    polar(cx, cy, size, angle + (index * Math.PI * 2) / 3),
  );
  return points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
};

export const WukongFaceCloseup: React.FC<WukongFaceCloseupProps> = ({
  frame,
  intensity = 0.6,
  high = 0,
  variant = 'full',
  damage = 0,
  eyeBurst = 0,
  gaze = 0,
  opacity = 1,
  className,
  style,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `face-${rawId}-${suffix}`;

  const power = Math.min(1, Math.max(0, intensity));
  const burst = Math.min(1, Math.max(0, eyeBurst + power * 0.24 + high * 0.2));
  const flicker = 0.92 + Math.sin(frame * 0.47) * 0.05 + power * 0.08;

  const rays = useMemo(
    () =>
      Array.from({length: 36}, (_, index) => {
        const angle = (index / 36) * Math.PI * 2;
        return {
          angle,
          inner: 12 + hash(5101, index) * 3,
          outer: 27 + hash(5102, index) * 6,
          width: 1.0 + hash(5103, index) * 1.4,
          color:
            index % 7 === 0
              ? SENBON.goldPale
              : index % 3 === 0
                ? SENBON.gold
                : index % 5 === 0
                  ? SENBON.cinnabar
                  : '#B97B12',
          opacity: 0.34 + hash(5104, index) * 0.4,
        };
      }),
    [],
  );

  const embers = useMemo(
    () =>
      Array.from({length: 44}, (_, index) => ({
        side: index % 2 === 0 ? -1 : 1,
        x: (index % 2 === 0 ? EYE.leftX : EYE.rightX) + (hash(6101, index) - 0.5) * 130,
        y: EYE.y + (hash(6102, index) - 0.3) * 90,
        speed: 42 + hash(6103, index) * 118,
        size: 2.4 + hash(6104, index) * 7,
        phase: hash(6105, index) * Math.PI * 2,
        tint: hash(6106, index),
      })),
    [],
  );

  const mailRows = useMemo(
    () =>
      Array.from({length: 7}, (_, row) =>
        Array.from({length: 15}, (_, col) => ({
          x: 268 + col * 33 + (row % 2 === 0 ? 0 : 16.5),
          y: 812 + row * 27,
          r: 12.5,
          row,
          col,
        })),
      ),
    [],
  );

  const leftPattern = (
    <g id={id('left')}>
      {/* 额顶鬃毛尖刺 */}
      <path
        d="M 300 160 L 268 128 L 286 196 L 246 182 L 272 232 L 232 232 L 262 274 L 226 288 L 258 322 L 230 348 L 260 382 L 238 408 L 266 436 L 240 468 L 268 494 L 242 524 L 274 544 L 252 578 L 288 590 L 272 624 L 310 626 L 300 662 L 336 650 L 336 690 L 370 664 L 374 704 L 404 668 Z"
        fill={SENBON.inkEdge}
        stroke={SENBON.gold}
        strokeWidth="1.4"
        strokeOpacity="0.38"
      />
      <path
        d="M 300 160 L 268 128 L 286 196 L 246 182 L 272 232 L 232 232 L 262 274 L 226 288 L 258 322 L 230 348 L 260 382 L 238 408 L 266 436"
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="2.6"
        opacity="0.42"
      />

      {/* 耳 */}
      <path
        d="M 258 386 C 220 376 196 404 202 446 C 208 490 236 514 266 504 C 250 470 250 424 258 386 Z"
        fill="#1A1011"
        stroke={SENBON.gold}
        strokeWidth="2.6"
      />
      <path
        d="M 240 408 C 220 412 214 438 224 462 C 232 480 248 486 258 476"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="5"
        opacity="0.7"
      />
      <path
        d="M 250 420 C 238 430 238 448 248 458"
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="1.6"
        opacity="0.65"
      />

      {/* 眉骨 */}
      <path
        d="M 292 380 C 336 330 438 322 490 360 L 476 392 C 426 356 350 364 308 410 Z"
        fill={SENBON.ink}
        stroke={SENBON.gold}
        strokeWidth="3.2"
        strokeLinejoin="miter"
      />
      <path
        d="M 306 386 C 348 346 430 342 472 368"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="4.2"
        opacity="0.8"
      />

      {/* 太阳穴云纹 */}
      <path
        d="M 358 306 C 314 322 292 360 300 398 C 308 438 344 456 374 438 C 398 422 396 390 372 382 C 356 376 346 390 352 402"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.88"
      />
      <path
        d="M 358 306 C 314 322 292 360 300 398 C 308 438 344 456 374 438 C 398 422 396 390 372 382 C 356 376 346 390 352 402"
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.9"
      />
      <polygon points="298,294 348,312 316,356" fill={SENBON.cinnabar} opacity="0.72" />
      <polygon points="306,302 336,314 318,342" fill={SENBON.gold} opacity="0.5" />

      {/* 颧骨卷草 */}
      <path
        d="M 330 508 C 296 524 288 566 314 592 C 340 618 382 606 390 576 C 396 552 378 534 356 540 C 342 544 340 562 352 568"
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="4.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 330 508 C 296 524 288 566 314 592"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M 338 468 C 318 486 314 508 326 522"
        fill="none"
        stroke={SENBON.cinnabarDeep}
        strokeWidth="2"
        opacity="0.5"
      />

      {/* 眼窝 + 金线眼睑 */}
      <path
        d="M 318 432 C 348 386 438 382 480 420 C 452 474 360 480 318 432 Z"
        fill="#070405"
        stroke={SENBON.gold}
        strokeWidth="4.6"
        strokeLinejoin="miter"
      />
      <path
        d="M 310 430 C 344 372 442 366 486 412"
        fill="none"
        stroke={SENBON.goldPale}
        strokeWidth="2.6"
        opacity="0.95"
      />
      <path
        d="M 322 446 C 360 472 430 470 468 438"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="5"
        opacity="0.85"
      />

      {/* 虹膜：36 道赤金放射 + 竖瞳 */}
      <g transform={`translate(${f(gaze)} 0)`}>
        <circle cx={EYE.leftX} cy={EYE.y} r="42" fill="#4B0B07" opacity="0.95" />
        <circle cx={EYE.leftX} cy={EYE.y} r="42" fill={`url(#${id('irisGlow')})`} opacity={0.48 + power * 0.3} />
        <circle cx={EYE.leftX} cy={EYE.y} r="45" fill="none" stroke="#0B090A" strokeWidth="7" opacity="0.9" />
        {rays.map((ray, index) => {
          const inner = polar(EYE.leftX, EYE.y, ray.inner, ray.angle);
          const outer = polar(EYE.leftX, EYE.y, ray.outer, ray.angle);
          return (
            <line
              key={`ray-${index}`}
              x1={f(inner[0])}
              y1={f(inner[1])}
              x2={f(outer[0])}
              y2={f(outer[1])}
              stroke={ray.color}
              strokeWidth={f(ray.width)}
              opacity={f(ray.opacity * (0.5 + power * 0.5))}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={EYE.leftX} cy={EYE.y} r="40" fill="none" stroke={SENBON.gold} strokeWidth="3.0" opacity="0.95" />
        <circle cx={EYE.leftX} cy={EYE.y} r="34" fill="none" stroke={SENBON.goldPale} strokeWidth="1.1" opacity="0.62" />
        <circle cx={EYE.leftX} cy={EYE.y} r="17" fill={`url(#${id('irisCore')})`} />
        <circle cx={EYE.leftX} cy={EYE.y} r="17" fill="none" stroke={SENBON.gold} strokeWidth="1.8" opacity="0.9" />
        <ellipse cx={EYE.leftX} cy={EYE.y + 1} rx={5.2} ry={21 - power * 3} fill={SENBON.ink} />
        <ellipse cx={EYE.leftX - 2} cy={EYE.y - 8} rx="1.7" ry="6" fill={SENBON.goldPale} opacity="0.9" />
        <circle cx={EYE.leftX - 13} cy={EYE.y - 15} r="5.6" fill={SENBON.paper} opacity="0.78" />
        <circle cx={EYE.leftX + 11} cy={EYE.y + 13} r="3" fill={SENBON.paper} opacity="0.3" />
      </g>

      {/* 下眼睑金粉 */}
      <path d="M 336 452 C 374 474 430 470 462 442" fill="none" stroke={SENBON.goldDeep} strokeWidth="1.6" opacity="0.7" />
    </g>
  );

  return (
    <svg
      viewBox={variant === 'eyes' ? '168 300 664 300' : '0 0 1000 1000'}
      width="100%"
      height="100%"
      preserveAspectRatio={variant === 'eyes' ? 'xMidYMid slice' : 'xMidYMid meet'}
      opacity={opacity}
      className={className}
      style={{display: 'block', overflow: 'visible', ...style}}
    >
      <defs>
        <radialGradient id={id('backGlow')} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#FCC934" stopOpacity={0.2 + power * 0.12} />
          <stop offset="44%" stopColor="#D93025" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#0B090A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('faceBase')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#33201C" />
          <stop offset="46%" stopColor="#1B1011" />
          <stop offset="100%" stopColor="#0C0809" />
        </linearGradient>
        <linearGradient id={id('goldHeart')} x1="0.1" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#FFEFB0" />
          <stop offset="34%" stopColor="#E8B62A" />
          <stop offset="74%" stopColor="#B87E0E" />
          <stop offset="100%" stopColor="#6B4707" />
        </linearGradient>
        <linearGradient id={id('goldDark')} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#D9A21A" />
          <stop offset="100%" stopColor="#5C3E06" />
        </linearGradient>
        <radialGradient id={id('irisGlow')} cx="50%" cy="42%" r="52%">
          <stop offset="0%" stopColor={SENBON.goldPale} stopOpacity="0.98" />
          <stop offset="42%" stopColor={SENBON.gold} stopOpacity="0.82" />
          <stop offset="74%" stopColor={SENBON.cinnabar} stopOpacity="0.7" />
          <stop offset="100%" stopColor="#4B0B07" stopOpacity="0.3" />
        </radialGradient>
        <radialGradient id={id('irisCore')} cx="48%" cy="44%" r="54%">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="58%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.cinnabar} />
        </radialGradient>
        <linearGradient id={id('crownGold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="48%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.goldDeep} />
        </linearGradient>
        <pattern id={id('mail')} width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
          <circle cx="18" cy="18" r="13" fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.7" />
          <circle cx="0" cy="0" r="13" fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.7" />
          <circle cx="36" cy="0" r="13" fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.7" />
          <circle cx="0" cy="36" r="13" fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.7" />
          <circle cx="36" cy="36" r="13" fill="none" stroke={SENBON.gold} strokeWidth="2.2" opacity="0.7" />
        </pattern>
        <radialGradient id={id('soot')} cx="50%" cy="46%" r="58%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="68%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
        </radialGradient>
        <filter id={id('soft')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={id('blaze')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {variant === 'full' ? (
        <rect x="0" y="0" width="1000" height="1000" fill="#080506" />
      ) : (
        <rect x="0" y="0" width="1000" height="1000" fill="#070405" />
      )}
      <ellipse cx="500" cy="440" rx="430" ry="430" fill={`url(#${id('backGlow')})`} />

      {/* 双翎：在头后 */}
      <g fill={SENBON.inkEdge} stroke={SENBON.gold} strokeWidth="2.4" strokeOpacity="0.75">
        <path d="M 352 296 C 292 214 230 146 122 74 C 196 168 262 268 322 354 Z" />
        <path d="M 648 296 C 708 214 770 146 878 74 C 804 168 738 268 678 354 Z" />
      </g>
      <g fill="none" stroke={SENBON.cinnabar} strokeWidth="2" opacity="0.6">
        <path d="M 342 304 C 286 226 226 158 138 94" />
        <path d="M 658 304 C 714 226 774 158 862 94" />
      </g>
      <g fill="none" stroke={SENBON.gold} strokeWidth="1" opacity="0.4">
        {Array.from({length: 9}, (_, index) => {
          const t = 0.16 + index * 0.09;
          const x = 352 - t * 220;
          const y = 296 - t * 210;
          return <line key={`barb-l-${index}`} x1={f(x)} y1={f(y)} x2={f(x - 16)} y2={f(y + 12)} />;
        })}
        {Array.from({length: 9}, (_, index) => {
          const t = 0.16 + index * 0.09;
          const x = 648 + t * 220;
          const y = 296 - t * 210;
          return <line key={`barb-r-${index}`} x1={f(x)} y1={f(y)} x2={f(x + 16)} y2={f(y + 12)} />;
        })}
      </g>

      {/* 头骨底 + 金桃心 */}
      <path
        d="M 500 92 C 618 92 710 150 754 252 C 792 342 790 446 762 532 C 730 632 646 710 566 754 C 542 768 524 776 500 776 C 476 776 458 768 434 754 C 354 710 270 632 238 532 C 210 446 208 342 246 252 C 290 150 382 92 500 92 Z"
        fill={`url(#${id('faceBase')})`}
        stroke={SENBON.gold}
        strokeWidth="3.4"
      />
      <path
        d="M 500 150 C 580 150 652 202 676 296 C 698 384 674 486 618 562 C 574 620 538 658 500 686 C 462 658 426 620 382 562 C 326 486 302 384 324 296 C 348 202 420 150 500 150 Z"
        fill={`url(#${id('goldHeart')})`}
        stroke={SENBON.ink}
        strokeWidth="4"
      />
      <path
        d="M 500 150 C 580 150 652 202 676 296 C 698 384 674 486 618 562 C 574 620 538 658 500 686 C 462 658 426 620 382 562 C 326 486 302 384 324 296 C 348 202 420 150 500 150 Z"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="8"
        opacity="0.42"
      />
      <path
        d="M 500 178 C 566 178 626 222 648 304 C 666 380 646 468 600 534 C 560 590 530 622 500 648 C 470 622 440 590 400 534 C 354 468 334 380 352 304 C 374 222 434 178 500 178 Z"
        fill="none"
        stroke={SENBON.goldDeep}
        strokeWidth="2.6"
        opacity="0.75"
      />
      {/* 金面高光与折面 */}
      <path
        d="M 500 168 C 552 168 604 196 632 246 C 596 226 552 212 500 212 C 448 212 404 226 368 246 C 396 196 448 168 500 168 Z"
        fill={SENBON.goldPale}
        opacity="0.34"
      />

      {/* 深色口鼻区：让脸从“一整块金牌”变成猴王的口鼻结构 */}
      <path
        d="M 500 486 C 548 486 586 524 588 582 C 590 642 550 684 500 692 C 450 684 410 642 412 582 C 414 524 452 486 500 486 Z"
        fill="#170F10"
        opacity="0.94"
        stroke={SENBON.ink}
        strokeWidth="3"
      />
      <path
        d="M 500 494 C 542 494 578 528 580 582 C 582 636 546 676 500 682 C 454 676 418 636 420 582 C 422 528 458 494 500 494 Z"
        fill="none"
        stroke={SENBON.goldDeep}
        strokeWidth="1.6"
        opacity="0.5"
      />
      {/* 颧骨朱砂 */}
      <path d="M 330 520 C 292 560 294 624 336 656 C 372 684 410 664 412 626" fill={SENBON.cinnabar} opacity="0.16" />
      <path
        d="M 670 520 C 708 560 706 624 664 656 C 628 684 590 664 588 626"
        fill={SENBON.cinnabar}
        opacity="0.16"
      />
      <path
        d="M 500 660 C 540 640 580 606 620 560 C 600 618 556 662 500 690 C 444 662 400 618 380 560 C 420 606 460 640 500 660 Z"
        fill="#6B4408"
        opacity="0.55"
      />

      {/* 左右对称纹样 */}
      {leftPattern}
      <use href={`#${id('left')}`} transform="translate(1000 0) scale(-1 1)" />

      {/* 眉心火焰 */}
      <path
        d="M 500 176 C 466 222 448 274 462 322 C 470 352 488 366 500 372 C 512 366 530 352 538 322 C 552 274 534 222 500 176 Z"
        fill={SENBON.cinnabar}
        stroke={SENBON.gold}
        strokeWidth="3.4"
      />
      <path
        d="M 500 216 C 482 250 472 286 482 314 C 490 336 510 336 518 314 C 528 286 518 250 500 216 Z"
        fill={SENBON.goldPale}
        opacity="0.82"
      />
      <path
        d="M 500 240 C 490 266 488 292 496 306 C 502 316 510 310 510 298 C 508 278 504 258 500 240 Z"
        fill="#FFF8DE"
        opacity="0.9"
      />

      {/* 鼻梁与鼻翼 */}
      <path
        d="M 500 372 C 486 434 480 496 492 536 C 482 552 468 560 460 570 C 480 586 520 586 540 570 C 532 560 518 552 508 536 C 520 496 514 434 500 372 Z"
        fill="#1A1011"
        stroke={SENBON.gold}
        strokeWidth="2.8"
      />
      <path d="M 500 386 L 500 522" stroke={SENBON.goldPale} strokeWidth="1.6" opacity="0.55" />
      <path
        d="M 470 556 C 458 562 452 572 456 580"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="2.8"
        opacity="0.85"
      />
      <path
        d="M 530 556 C 542 562 548 572 544 580"
        fill="none"
        stroke={SENBON.cinnabar}
        strokeWidth="2.8"
        opacity="0.85"
      />

      {/* 獠牙口：嘴角下沉的怒相，不是上扬的笑脸 */}
      <path
        d="M 404 640 C 442 608 470 612 500 628 C 530 612 558 608 596 640 C 584 676 544 698 500 702 C 456 698 416 676 404 640 Z"
        fill="#0B090A"
        stroke={SENBON.gold}
        strokeWidth="4.2"
        strokeLinejoin="miter"
      />
      <path
        d="M 410 640 C 446 614 472 618 500 632 C 528 618 554 614 590 640"
        fill="none"
        stroke={SENBON.goldPale}
        strokeWidth="4.4"
        opacity="0.9"
      />
      <path
        d="M 430 650 C 460 640 480 642 500 650 C 520 642 540 640 570 650 C 548 680 526 690 500 694 C 474 690 452 680 430 650 Z"
        fill={SENBON.cinnabarDeep}
        opacity="0.48"
      />
      {/* 上排三枚尖牙 */}
      {[456, 500, 544].map((x, index) => (
        <path
          key={`tooth-${index}`}
          d={`M ${x - 9} 648 L ${x + 9} 648 L ${x + 2} ${668 + (index % 2) * 4} Z`}
          fill={SENBON.paper}
          stroke={SENBON.goldDeep}
          strokeWidth="1.2"
        />
      ))}
      {/* 两枚外翻獠牙 */}
      <path d="M 414 642 L 432 648 L 424 692 L 408 660 Z" fill={SENBON.paper} stroke={SENBON.gold} strokeWidth="1.8" />
      <path d="M 586 642 L 568 648 L 576 692 L 592 660 Z" fill={SENBON.paper} stroke={SENBON.gold} strokeWidth="1.8" />
      <path d="M 416 654 L 426 657 L 421 678 Z" fill={SENBON.paperShade} opacity="0.6" />
      <path d="M 584 654 L 574 657 L 579 678 Z" fill={SENBON.paperShade} opacity="0.6" />
      {/* 下唇 */}
      <path
        d="M 428 692 C 458 704 542 704 572 692"
        fill="none"
        stroke={SENBON.gold}
        strokeWidth="2.6"
        opacity="0.72"
      />

      {/* 下颌鬃毛 */}
      <g fill={SENBON.inkEdge} stroke={SENBON.gold} strokeWidth="1.8" strokeOpacity="0.7">
        {Array.from({length: 7}, (_, index) => {
          const x = 380 + index * 40;
          const tip = 760 + (index % 2) * 26;
          return <path key={`chin-${index}`} d={`M ${x - 18} 712 L ${x + 18} 712 L ${x + 2} ${tip} Z`} />;
        })}
      </g>

      {/* 紧箍咒 */}
      <path
        d="M 274 268 C 340 232 660 232 726 268 L 716 326 C 650 292 350 292 284 326 Z"
        fill={`url(#${id('crownGold')})`}
        stroke={SENBON.ink}
        strokeWidth="3.6"
      />
      <path
        d="M 292 286 C 352 258 648 258 708 286"
        fill="none"
        stroke={SENBON.goldPale}
        strokeWidth="2.2"
        opacity="0.9"
      />
      {[338, 412, 500, 588, 662].map((x, index) => (
        <g key={`curl-${index}`} transform={`translate(${x} ${282 + (index % 2) * 6})`}>
          <path
            d="M -14 0 C -14 -10 -2 -14 4 -6 C 10 2 2 10 -4 6 C -8 4 -6 -2 -2 -2"
            fill="none"
            stroke={SENBON.goldDeep}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* 中央宝珠 */}
      <g>
        <polygon points="500,276 522,300 500,328 478,300" fill={SENBON.cinnabar} stroke={SENBON.goldPale} strokeWidth="2.6" />
        <polygon points="500,286 512,300 500,316 488,300" fill="#FF6A5B" opacity="0.7" />
        <circle cx="500" cy="300" r="34" fill={SENBON.gold} opacity={0.12 + power * 0.1} filter={`url(#${id('soft')})`} />
      </g>
      {/* 凤翅 */}
      <g fill={`url(#${id('crownGold')})`} stroke={SENBON.ink} strokeWidth="2.6">
        <path d="M 288 276 C 236 236 190 200 138 184 C 180 232 206 276 222 314 C 246 300 266 292 288 292 Z" />
        <path d="M 712 276 C 764 236 810 200 862 184 C 820 232 794 276 778 314 C 754 300 734 292 712 292 Z" />
      </g>
      <g fill="none" stroke={SENBON.cinnabar} strokeWidth="2.6" opacity="0.75">
        <path d="M 276 286 C 232 250 194 218 158 200" />
        <path d="M 724 286 C 768 250 806 218 842 200" />
      </g>
      {/* 金箍顶焰 */}
      <path
        d="M 500 252 C 468 210 460 168 478 126 C 486 106 494 90 500 68 C 506 90 514 106 522 126 C 540 168 532 210 500 252 Z"
        fill={`url(#${id('crownGold')})`}
        stroke={SENBON.goldPale}
        strokeWidth="2.4"
      />
      <path d="M 500 232 C 486 200 484 170 496 140 L 500 122 L 504 142 C 514 170 512 202 500 232 Z" fill={SENBON.cinnabar} opacity="0.8" />

      {/* 锁子甲领口 */}
      <path
        d="M 300 780 C 360 738 640 738 700 780 L 790 1040 L 210 1040 Z"
        fill="#141011"
        stroke={SENBON.gold}
        strokeWidth="3.2"
      />
      <path
        d="M 300 780 C 360 738 640 738 700 780 L 790 1040 L 210 1040 Z"
        fill={`url(#${id('mail')})`}
        opacity="0.55"
      />
      {mailRows.map((row, rowIndex) =>
        row.map((ring) => (
          <ellipse
            key={`mail-${rowIndex}-${ring.col}`}
            cx={ring.x}
            cy={ring.y}
            rx={ring.r}
            ry={ring.r * 0.72}
            fill="none"
            stroke={SENBON.gold}
            strokeWidth={rowIndex === 0 ? 2.2 : 1.4}
            opacity={0.28 + rowIndex * 0.025}
          />
        )),
      )}
      {/* 护喉 */}
      <path
        d="M 350 760 C 420 730 580 730 650 760 L 692 880 C 620 922 380 922 308 880 Z"
        fill="#1D1315"
        stroke={SENBON.gold}
        strokeWidth="3.4"
      />
      <path
        d="M 376 782 C 432 760 568 760 624 782 L 646 858 C 590 884 410 884 354 858 Z"
        fill={SENBON.ink}
        stroke={SENBON.cinnabar}
        strokeWidth="2"
        opacity="0.8"
      />
      <path
        d="M 360 800 C 424 816 576 816 640 800"
        fill="none"
        stroke={SENBON.goldPale}
        strokeWidth="1.8"
        opacity="0.7"
      />
      <path
        d="M 500 780 L 500 884"
        stroke={SENBON.gold}
        strokeWidth="1.6"
        opacity="0.55"
      />
      {/* 肩甲 */}
      <g fill="#1A1012" stroke={SENBON.gold} strokeWidth="2.8">
        <path d="M 300 780 L 216 802 L 178 906 L 282 952 L 340 862 Z" />
        <path d="M 700 780 L 784 802 L 822 906 L 718 952 L 660 862 Z" />
      </g>
      <g fill="none" stroke={SENBON.goldDeep} strokeWidth="1.6" opacity="0.8">
        <path d="M 292 806 L 232 824 L 206 898" />
        <path d="M 316 840 L 258 860 L 236 922" />
        <path d="M 708 806 L 768 824 L 794 898" />
        <path d="M 684 840 L 742 860 L 764 922" />
      </g>
      <g fill={SENBON.cinnabar} opacity="0.75">
        <polygon points="252,836 274,846 258,868" />
        <polygon points="748,836 726,846 742,868" />
      </g>

      {/* 金火粒子 */}
      <g style={{mixBlendMode: 'screen'}} opacity={0.5 + power * 0.5}>
        {embers.map((ember, index) => {
          const cycle = 1.15;
          const t = ((frame / 30) * (0.6 + ember.speed / 220) + ember.phase) % cycle;
          const rise = t * (120 + ember.speed);
          const wobble = Math.sin(t * 7 + ember.phase) * 14 * ember.side;
          const x = ember.x + wobble;
          const y = ember.y - rise;
          const fade = Math.sin((t / cycle) * Math.PI);
          const color = ember.tint > 0.7 ? SENBON.cinnabar : ember.tint > 0.36 ? SENBON.gold : SENBON.goldPale;
          return (
            <polygon
              key={`ember-${index}`}
              points={tri(x, y, ember.size * (0.7 + fade * 0.9), frame * 0.03 + index)}
              fill={color}
              opacity={f(fade * 0.9)}
            />
          );
        })}
      </g>

      {/* 眼部星芒与横向拉丝 */}
      {burst > 0.02 ? (
        <g style={{mixBlendMode: 'screen'}} opacity={Math.min(1, burst)}>
          {[EYE.leftX, EYE.rightX].map((cx, eyeIndex) => {
            const cy = EYE.y;
            return (
              <g key={`flare-${eyeIndex}`} filter={`url(#${id('blaze')})`}>
                {variant === 'eyes' ? (
                  <>
                    {/* 从瞳孔向外的横向金芒：只从眼窝内侧射出，不横切整张脸 */}
                    <rect
                      x={cx < 500 ? cx - 178 : cx + 12}
                      y={cy - 1.6}
                      width="166"
                      height="3.2"
                      fill={SENBON.gold}
                      opacity={0.26 + burst * 0.24}
                    />
                    <rect
                      x={cx < 500 ? cx - 168 : cx + 18}
                      y={cy - 0.6}
                      width="152"
                      height="1.3"
                      fill={SENBON.goldPale}
                      opacity={0.32 + burst * 0.3}
                    />
                    <rect
                      x={cx < 500 ? cx - 60 : cx + 10}
                      y={cy + 7}
                      width="50"
                      height="1.2"
                      fill={SENBON.gold}
                      opacity={0.2 * burst}
                    />
                    <polygon
                      points={`${cx},${cy - 7 * burst} ${cx + 5},${cy} ${cx},${cy + 7 * burst} ${cx - 5},${cy}`}
                      fill={SENBON.paper}
                      opacity={0.35 + burst * 0.3}
                    />
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {/* 战损裂纹 */}
      {damage > 0.01 ? (
        <g opacity={Math.min(1, damage)}>
          <path
            d="M 262 320 L 316 356 L 302 404 L 350 446 L 332 512 L 372 556"
            fill="none"
            stroke="#2A0604"
            strokeWidth="7"
            strokeLinejoin="miter"
          />
          <path
            d="M 262 320 L 316 356 L 302 404 L 350 446 L 332 512 L 372 556"
            fill="none"
            stroke={SENBON.goldPale}
            strokeWidth="1.8"
            opacity="0.55"
          />
          <path
            d="M 744 300 L 690 352 L 712 408 L 664 458 L 686 520"
            fill="none"
            stroke="#2A0604"
            strokeWidth="6"
            strokeLinejoin="miter"
          />
          <path
            d="M 744 300 L 690 352 L 712 408 L 664 458 L 686 520"
            fill="none"
            stroke={SENBON.goldPale}
            strokeWidth="1.4"
            opacity="0.45"
          />
          <path
            d="M 626 660 L 660 700 L 640 742 L 682 776"
            fill="none"
            stroke="#2A0604"
            strokeWidth="5.5"
          />
          <path d="M 236 500 L 272 508 L 258 536 Z" fill={SENBON.ink} />
          <path d="M 760 540 L 726 548 L 744 580 Z" fill={SENBON.ink} />
          <rect x="0" y="0" width="1000" height="1000" fill="#000000" opacity={damage * 0.16} />
        </g>
      ) : null}

      {/* 暗角 */}
      <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id('soot')})`} opacity={variant === 'full' ? 0.9 : 0.55} />
      {/* 微颤：整体极轻的呼吸 */}

      {/* 眼部横向金芒已经由每只眼睛自己的 Beam 完成，禁止再画跨脸长线 */}

      {/* 帧驱动的整体光呼吸（仅调透明度，不做 layout 抖动） */}
      <rect x="0" y="0" width="1000" height="1000" fill={SENBON.gold} opacity={0.015 * flicker} style={{mixBlendMode: 'screen'}} />
    </svg>
  );
};

export default WukongFaceCloseup;
