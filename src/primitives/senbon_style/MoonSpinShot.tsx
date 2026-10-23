import React, {useMemo} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {hash} from '../../utils/math';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {CloudBank, MoonDisc, WASHI} from './PaperStage';
import {SENBON, SERIF_STACK, clamp01, f} from './style';
import {VerticalCartouche} from './VerticalCartouche';

/**
 * `<MoonSpinShot />` —— V8 的 Sub1B：侧身战姿 + 斜向棍盘 + 三排天兵推进。
 *
 * V7 为了躲"双棍穿脸"，把大圣画成双手胸前合十、全身纹丝不动的立牌，光轮
 * 藏到背后变成佛光。V8 换成真正的战斗姿态：
 *
 *   1. **底层**：`woodblock_spin.png`（侧身微蹲、双手前后握棍、披风后甩）。
 *   2. **中层**：`CudgelVortex` —— 中心位于胸腹前方 (619, 780)、
 *      `rotate(-25deg) scaleY(0.5)` 的斜向椭圆棍盘；8 层角度渐隐的棍影 +
 *      三道旋转刀环 + 火星。椭圆最上缘 638px，严格低于下巴，不扫头脸。
 *   3. **顶层**：把同一张立绘在双手区域再裁一次（`clip-path: inset`），
 *      盖在棍盘中心，读成"双手握在旋转棍心上"。
 *
 * 天兵不再是一张死图：远/中/近三排枪旗以不同速度向左推进并做正弦颠簸，
 * 底边由三层不同流速的浮世绘云海吃掉。
 */

export interface MoonSpinShotProps {
  time: number;
  start: number;
  progress: number;
  pulse?: number;
  high?: number;
}

const HERO_X = 644;
const HERO_BASELINE = 1176;
const HERO_HEIGHT = 980;
const HERO_W = (1240 / 1800) * HERO_HEIGHT;
const HERO_LEFT = HERO_X - HERO_W / 2;
const HERO_TOP = HERO_BASELINE - HERO_HEIGHT;

/** `woodblock_spin.png` 双手中心（原图 1240×1800 → 屏幕坐标）。 */
const HAND_X = HERO_LEFT + (582 / 1240) * HERO_W;
const HAND_Y = HERO_TOP + (1005 / 1800) * HERO_HEIGHT;

/* -------------------------------------------------------------------------- */
/*  斜向椭圆棍盘                                                              */
/* -------------------------------------------------------------------------- */

const CudgelVortex: React.FC<{time: number; start: number; cx: number; cy: number; pulse: number}> = ({
  time,
  start,
  cx,
  cy,
  pulse,
}) => {
  const local = Math.max(0, time - start);
  const angle = local * 690;
  const counter = -angle * 0.64;
  const radius = 246;
  const sparks = useMemo(
    () =>
      Array.from({length: 34}, (_, index) => ({
        seed: index,
        phase: hash(7600, index),
        speed: 0.75 + hash(7601, index) * 1.1,
        angle: hash(7602, index) * Math.PI * 2,
        size: 1 + hash(7603, index) ** 2 * 4.6,
        tone: index % 4,
      })),
    [],
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - radius - 22,
        top: cy - radius - 22,
        width: (radius + 22) * 2,
        height: (radius + 22) * 2,
        zIndex: 6,
        pointerEvents: 'none',
        transform: 'rotate(-25deg) scaleY(0.5)',
        transformOrigin: '50% 50%',
      }}
    >
      {/* 先压一层暗场，让赤金棍影能从宣纸色胸甲上分离出来 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 640,
          height: 640,
          marginLeft: -320,
          marginTop: -320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(20,10,14,0.34) 0%, rgba(20,10,14,0.16) 52%, rgba(20,10,14,0) 72%)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* 中心暖光（再铺一层，棍影压在上面） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 620,
          height: 620,
          marginLeft: -310,
          marginTop: -310,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,243,209,0.30) 0%, rgba(245,194,66,0.18) 34%, rgba(200,40,30,0.08) 58%, rgba(200,40,30,0) 74%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 8 层棍影：同一根棍在旋转平面的不同相位，模拟高速旋棍的运动模糊 */}
      {Array.from({length: 8}, (_, ghost) => {
        const ghostAngle = angle + ghost * 22.5;
        const opacity = 0.82 - ghost * 0.085;
        return (
          <div
            key={`ghost-${ghost}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: radius * 2,
              height: 20,
              marginLeft: -radius,
              marginTop: -10,
              borderRadius: 10,
              border: '1.5px solid #120D14',
              background:
                'linear-gradient(90deg, #F5C242 0%, #C8281E 6%, #F5C242 13%, #FFF3D1 50%, #F5C242 87%, #C8281E 94%, #F5C242 100%)',
              boxShadow: '0 0 22px rgba(245,194,66,0.85)',
              transform: `rotate(${f(ghostAngle)}deg)`,
              transformOrigin: '50% 50%',
              opacity,
              WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 12%, #000 88%, rgba(0,0,0,0) 100%)',
              maskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 12%, #000 88%, rgba(0,0,0,0) 100%)',
            }}
          />
        );
      })}

      {/* 三道旋转刀环 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 520,
          height: 520,
          marginLeft: -260,
          marginTop: -260,
          borderRadius: '50%',
          background:
            'repeating-conic-gradient(from 0deg, rgba(245,194,66,0.95) 0deg 2.6deg, rgba(200,40,30,0.85) 2.6deg 5.2deg, rgba(245,194,66,0) 5.2deg 14deg)',
          transform: `rotate(${f(angle * 0.5)}deg)`,
          WebkitMaskImage: 'radial-gradient(circle, transparent 0 58%, #000 61%, #000 96%, transparent 100%)',
          maskImage: 'radial-gradient(circle, transparent 0 58%, #000 61%, #000 96%, transparent 100%)',
          filter: 'blur(1.1px)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 500,
          height: 500,
          marginLeft: -250,
          marginTop: -250,
          borderRadius: '50%',
          border: '11px solid #F5C242',
          boxShadow: '0 0 44px rgba(245,194,66,0.92), inset 0 0 30px rgba(200,40,30,0.72)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 386,
          height: 386,
          marginLeft: -193,
          marginTop: -193,
          borderRadius: '50%',
          border: '5px dashed rgba(200,40,30,0.95)',
          transform: `rotate(${f(counter)}deg)`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 566,
          height: 566,
          marginLeft: -283,
          marginTop: -283,
          borderRadius: '50%',
          border: '2px solid rgba(245,194,66,0.55)',
          transform: `rotate(${f(-angle * 0.24)}deg)`,
          borderStyle: 'dotted',
          opacity: 0.7,
        }}
      />

      {/* 火星 / 弹飞断箭 */}
      <svg viewBox="0 0 536 536" width="536" height="536" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {sparks.map((spark) => {
          const age = (local * spark.speed + spark.phase) % 1;
          const distance = 148 + age * 218;
          const x = 268 + Math.cos(spark.angle) * distance;
          const y = 268 + Math.sin(spark.angle) * distance;
          const colour = spark.tone === 0 ? '#FFF7DA' : spark.tone === 1 ? '#F5C242' : spark.tone === 2 ? '#C8281E' : '#F4EFE6';
          return (
            <g key={`spark-${spark.seed}`} opacity={(1 - age) * 0.9}>
              <circle cx={f(x)} cy={f(y)} r={f(spark.size * 2.8)} fill={colour} opacity="0.16" />
              <circle cx={f(x)} cy={f(y)} r={f(spark.size)} fill={colour} />
            </g>
          );
        })}
        {Array.from({length: 7}, (_, index) => {
          const a = (index / 7) * Math.PI * 2 + 0.4;
          const distance = 208 + Math.sin(local * 4 + index) * 18;
          return (
            <g key={`arrow-${index}`} transform={`translate(${f(268 + Math.cos(a) * distance)} ${f(268 + Math.sin(a) * distance)}) rotate(${f((a * 180) / Math.PI + 90)})`} opacity="0.6">
              <line x1="0" y1="0" x2="0" y2="26" stroke="#120D14" strokeWidth="2.4" />
              <path d="M 0 0 L -5 9 L 5 9 Z" fill="#F5C242" stroke="#120D14" strokeWidth="0.8" />
            </g>
          );
        })}
        {/* 向心的速度线 */}
        {Array.from({length: 18}, (_, index) => {
          const a = (index / 18) * Math.PI * 2 + local * 0.6;
          const inner = 176 + (index % 4) * 12;
          const outer = 248 + (index % 3) * 14;
          return (
            <line
              key={`speed-${index}`}
              x1={f(268 + Math.cos(a) * inner)}
              y1={f(268 + Math.sin(a) * inner)}
              x2={f(268 + Math.cos(a) * outer)}
              y2={f(268 + Math.sin(a) * outer)}
              stroke={index % 3 === 0 ? '#C8281E' : '#F5C242'}
              strokeWidth={1.4}
              opacity={0.35 + pulse * 0.35}
            />
          );
        })}
      </svg>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  三排天兵推进                                                              */
/* -------------------------------------------------------------------------- */

const BattleLine: React.FC<{time: number; y: number; speed: number; scale: number; seed: number; opacity: number}> = ({
  time,
  y,
  speed,
  scale,
  seed,
  opacity,
}) => {
  const offset = (time * speed) % 360;
  const spears = useMemo(
    () =>
      Array.from({length: 30}, (_, index) => ({
        x: -360 + index * 84 + hash(seed, index) * 38,
        len: (180 + hash(seed + 1, index) * 90) * scale,
        lean: (hash(seed + 2, index) - 0.5) * 12,
        tone: index % 4,
      })),
    [scale, seed],
  );
  const banners = useMemo(
    () =>
      Array.from({length: 6}, (_, index) => ({
        x: -280 + index * 380 + hash(seed + 3, index) * 120,
        h: (150 + hash(seed + 4, index) * 90) * scale,
        w: (36 + hash(seed + 5, index) * 22) * scale,
        tone: index % 2,
      })),
    [scale, seed],
  );
  const bob = Math.sin(time * 7.2 + seed) * 2.4;

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity, clipPath: 'inset(398px 0px 0px 742px)'}}
    >
      <g transform={`translate(${f(-offset)} ${f(bob)})`}>
        {spears.map((spear, index) => {
          const top = y - spear.len;
          const colour = spear.tone === 0 ? '#F5C242' : spear.tone === 1 ? '#CFC8BA' : '#C8281E';
          return (
            <g key={`spear-${index}`} transform={`translate(${f(spear.x)} 0)`}>
              <line x1="0" y1={f(y)} x2={f(spear.lean)} y2={f(top)} stroke="#120D14" strokeWidth={5.5 * scale} opacity="0.8" />
              <line x1="0" y1={f(y)} x2={f(spear.lean)} y2={f(top)} stroke={colour} strokeWidth={2.6 * scale} />
              <path d={`M ${f(spear.lean)} ${f(top)} l ${f(-7 * scale)} ${f(18 * scale)} l ${f(14 * scale)} 0 Z`} fill="#F5C242" stroke="#120D14" strokeWidth="1" />
            </g>
          );
        })}
        {banners.map((banner, index) => (
          <g key={`banner-${index}`} transform={`translate(${f(banner.x)} ${f(y - banner.h)})`}>
            <line x1="0" y1="0" x2="0" y2={f(banner.h)} stroke="#120D14" strokeWidth="6" />
            <path
              d={`M 0 10 L ${f(banner.w)} 4 L ${f(banner.w)} ${f(banner.h * 0.72)} L 0 ${f(banner.h * 0.84)} Z`}
              fill={banner.tone === 0 ? '#C8281E' : '#8E1A13'}
              stroke="#120D14"
              strokeWidth="2.4"
            />
            <path d={`M 6 22 L ${f(banner.w - 6)} 18`} stroke="#F5C242" strokeWidth="2" opacity="0.75" />
            <path d={`M 6 34 L ${f(banner.w - 6)} 30`} stroke="#F5C242" strokeWidth="2" opacity="0.75" />
          </g>
        ))}
      </g>
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  云海                                                                      */
/* -------------------------------------------------------------------------- */

const InkCloudBand: React.FC<{y: number; shift: number; fill: string; opacity: number; amp?: number; z?: number}> = ({
  y,
  shift,
  fill,
  opacity,
  amp = 18,
  z = 1,
}) => (
  <svg
    viewBox="0 0 1920 1080"
    width="1920"
    height="1080"
    style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none', zIndex: z}}
  >
    <path
      d={`M -80 ${y} Q 120 ${y - amp} 280 ${y + 4} T 640 ${y - 2} T 1000 ${y + 6} T 1360 ${y - 4} T 1720 ${y + 2} L 1980 ${y + 2} L 1980 1120 L -80 1120 Z`}
      fill={fill}
      stroke="#120D14"
      strokeWidth="3.2"
      transform={`translate(${Math.sin(shift) * 16} 0)`}
    />
    <path
      d={`M -80 ${y + 22} Q 160 ${y + 2} 340 ${y + 26} T 760 ${y + 18} T 1180 ${y + 30} T 1600 ${y + 16} L 1980 ${y + 24}`}
      fill="none"
      stroke="#C29526"
      strokeWidth="1.6"
      opacity="0.55"
      transform={`translate(${Math.cos(shift) * 10} 0)`}
    />
  </svg>
);

export const MoonSpinShot: React.FC<MoonSpinShotProps> = ({time, start, progress, pulse = 0}) => {
  const local = Math.max(0, time - start);
  const reveal = clamp01(progress * 3.2);
  const breath = Math.sin(local * 5.2) * 3.2;
  const sway = Math.sin(local * 2.1) * 5.5;
  const tilt = -1.2 + Math.sin(local * 2.6) * 1.1;

  return (
    <AbsoluteFill style={{backgroundColor: WASHI.paperBright, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: 'linear-gradient(180deg, #F8F0DE 0%, #F1E5CC 46%, #E4D4B8 100%)'}} />

      <MoonDisc cx={520} cy={430} radius={388} halo={1.36} opacity={1} seed={9082} />

      {/* 远景：南天门连绵飞檐天际线 */}
      <Img
        src={staticFile(CLIMAX_ASSETS.palace.file)}
        style={{
          position: 'absolute',
          right: -160,
          top: 150,
          width: 1500,
          height: 520,
          objectFit: 'cover',
          objectPosition: '50% 5%',
          opacity: 0.2,
          filter: 'blur(1.4px) sepia(0.25) contrast(0.95)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* 十万天兵：底图慢推；上面叠三排不同速的枪旗，形成行军视差 */}
      <Img
        src={staticFile(CLIMAX_ASSETS.army.file)}
        style={{
          position: 'absolute',
          right: -160,
          top: 398,
          width: 1280,
          height: 760,
          objectFit: 'cover',
          objectPosition: '35% 32%',
          opacity: 0.96,
          transform: `translateX(${f(-progress * 30 + Math.sin(local * 1.4) * 4)}px)`,
          filter: 'contrast(1.06) saturate(1.02)',
        }}
      />
      <BattleLine time={time} y={620} speed={22} scale={0.6} seed={4101} opacity={0.22} />
      <BattleLine time={time} y={760} speed={38} scale={0.8} seed={4207} opacity={0.32} />
      <BattleLine time={time} y={930} speed={58} scale={1.0} seed={4313} opacity={0.45} />

      {/* 左缘纸色压边，让立绘从远景里分离 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(242,232,213,0.98) 0%, rgba(242,232,213,0.62) 22%, rgba(242,232,213,0) 48%)',
        }}
      />

      {/* 箭雨：从右向左的细线，越靠近镜头越长 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 34}, (_, index) => {
          const y = 230 + hash(7800, index) * 680;
          const speed = 980 + hash(7801, index) * 900;
          const x = 1640 - ((local * speed + hash(7802, index) * 1900) % 1960);
          const len = 70 + hash(7803, index) * 80;
          return (
            <g key={`arrow-${index}`} opacity={0.4 + (index % 3) * 0.16}>
              <line x1={f(x)} y1={f(y)} x2={f(x + len)} y2={f(y + 14)} stroke={WASHI.ink} strokeWidth={1.6} />
              <line x1={f(x)} y1={f(y)} x2={f(x + len * 1.6)} y2={f(y + 22)} stroke="#C8281E" strokeWidth={0.8} opacity="0.4" />
              <path d={`M ${f(x)} ${f(y)} l 14 -5 l 0 12 Z`} fill={SENBON.cinnabar} />
            </g>
          );
        })}
      </svg>

      {/* 中景云海：盖住天兵底边与英雄小腿，三层不同流速 */}
      <InkCloudBand y={690} shift={local * 1.5} fill="#F7ECD5" opacity={0.97} amp={20} z={1} />
      <InkCloudBand y={760} shift={local * 2.1 + 1.4} fill="#F2E4C8" opacity={0.98} amp={16} z={1} />
      <InkCloudBand y={835} shift={local * 2.8 + 2.2} fill="#ECDAB9" opacity={0.98} amp={14} z={1} />

      {/* 角色脚下的墨底 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 40% 46% at 34% 78%, rgba(18,13,20,0.34) 0%, rgba(18,13,20,0.14) 52%, rgba(18,13,20,0) 74%)',
          mixBlendMode: 'multiply',
          zIndex: 2,
        }}
      />

      {/* 战斗姿态：侧身微蹲、双手握棍、披风后甩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          transform: `translate(${f(sway)}px, ${f(breath)}px) rotate(${f(tilt)}deg)`,
          transformOrigin: '36% 90%',
        }}
      >
        <ClimaxAsset asset="spin" height={HERO_HEIGHT} x={HERO_X} baseline={HERO_BASELINE} echo={0.2 + pulse * 0.08} rim={0.14} />
      </div>

      {/* 斜向椭圆棍盘：中心在胸腹前，最上缘 638px，严格低于下巴 */}
      <CudgelVortex time={time} start={start} cx={HAND_X} cy={HAND_Y + 43} pulse={pulse} />

      {/*
        三明治顶层：把同一张立绘的**两只手**各裁一小块，分别盖在棍盘上。
        V8 第一版用一块大矩形把双手全裁进来，结果整块画布把整个棍盘盖死，
        只剩边缘一圈虚线。这里拆成上下两块 150×150 的补片，盘面留在中间。
      */}
      {[
        {top: 372, right: 187, bottom: 481, left: 366},
        {top: 602, right: 417, bottom: 265, left: 150},
      ].map((clip, index) => (
        <div
          key={`hand-patch-${index}`}
          style={{
            position: 'absolute',
            left: HERO_LEFT,
            top: HERO_TOP,
            width: HERO_W,
            height: HERO_HEIGHT,
            zIndex: 7,
            pointerEvents: 'none',
            clipPath: `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px)`,
            filter: 'drop-shadow(0 12px 16px rgba(0,0,0,0.45))',
            transform: `translate(${f(sway)}px, ${f(breath)}px) rotate(${f(tilt)}deg)`,
            transformOrigin: '36% 90%',
          }}
        >
          <Img
            src={staticFile(CLIMAX_ASSETS.spin.file)}
            style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
          />
        </div>
      ))}

      {/* 前景云海：盖住脚踝；z-index 8 保证在角色之上 */}
      <CloudBank y={868} height={250} color="#FCF4E1" shade="#E5D5B7" time={local * 1.6} amp={20} opacity={1} />
      <CloudBank y={948} height={280} color="#F7ECD5" shade="#D9C4A1" time={local * 2.2} amp={16} opacity={0.96} />
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8}}>
        <path
          d={`M -40 1006 q 180 ${-28 - pulse * 10} 360 2 q 200 38 380 -4 q 190 -42 400 6 q 190 38 420 -6 l 0 180 l -1560 0 Z`}
          fill="#FBF2DE"
          opacity="0.84"
        />
        <path
          d={`M -40 1042 q 220 ${-24 - pulse * 8} 420 4 q 210 30 400 -6 q 200 -36 420 8 q 200 36 400 -4 l 0 136 l -1640 0 Z`}
          fill="#F1E4CA"
          opacity="0.88"
        />
      </svg>

      {/* 竖幅墨边 */}
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9, zIndex: 9}} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9, zIndex: 9}} />

      {/* 右侧题笺：云头在 6–52px，文字从 112px 起排，六个字 100% 完整 */}
      <VerticalCartouche text="十万天兵合围" subtitle="天兵" reveal={reveal} style={{right: 44, top: 50, zIndex: 10}} />

      {/* 左下角：一枚小朱印，平衡右侧重题笺 */}
      <div
        style={{
          position: 'absolute',
          left: 104,
          bottom: 92,
          width: 54,
          height: 54,
          border: `2px solid ${WASHI.cinnabar}`,
          color: WASHI.cinnabar,
          fontFamily: SERIF_STACK,
          fontSize: 17,
          lineHeight: '23px',
          textAlign: 'center',
          opacity: 0.7 * reveal,
          zIndex: 10,
        }}
      >
        天兵
      </div>
    </AbsoluteFill>
  );
};

export default MoonSpinShot;
