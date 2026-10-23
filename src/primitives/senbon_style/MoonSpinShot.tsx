import React, {useMemo} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {hash} from '../../utils/math';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {CloudBank, MoonDisc, WASHI} from './PaperStage';
import {SENBON, SERIF_STACK, clamp01, f} from './style';
import {VerticalCartouche} from './VerticalCartouche';

/**
 * `<MoonSpinShot />` —— V7 的 Sub1B：单棍、旋转光轮、落地云海与题笺。
 *
 * V6 的三处穿帮在 V7 被拆掉：
 *   1. 静态立绘里有一根斜棍，图层上又叠了 8 层冻结的黄棍 → 双棍。V7 换成
 *      双手胸前结印的 `woodblock_charge.png`，静态棍从源头消失；旋转武器
 *      改为圆心严格对齐双手（672, 652）的赤金/朱砂刀光轮。
 *   2. 天兵是一条悬空黑带 → 放大、压到画面底部，前面叠三层带墨线的浮世绘
 *      云海，后面叠南天门/凌霄殿远景天际线；边界被云吃掉了。
 *   3. 黑字撞黑天兵 → 右侧改成 220×704 的 `VerticalCartouche` 题笺：
 *      深墨底、双层鎏金框、朱砂云头、鎏金书法。
 */

export interface MoonSpinShotProps {
  time: number;
  start: number;
  progress: number;
  pulse?: number;
  high?: number;
}

const HERO_X = 672;
const HERO_BASELINE = 1168;
const HAND_X = 672;
const HAND_Y = 652;

/* -------------------------------------------------------------------------- */
/*  旋转金箍棒光轮                                                            */
/* -------------------------------------------------------------------------- */

const CudgelWheel: React.FC<{time: number; cx: number; cy: number; start: number}> = ({time, cx, cy, start}) => {
  const local = Math.max(0, time - start);
  const angle = local * 560;
  const counter = -angle * 0.72;
  const sparks = useMemo(
    () =>
      Array.from({length: 30}, (_, index) => ({
        seed: index,
        phase: hash(7600, index),
        speed: 0.65 + hash(7601, index) * 0.85,
        angle: hash(7602, index) * Math.PI * 2,
        size: 1.2 + hash(7603, index) ** 2 * 4.2,
        tone: index % 4,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 4}}>
      <div style={{position: 'absolute', left: cx, top: cy, width: 0, height: 0}}>
        {/* 中心暖光 */}
        <div
          style={{
            position: 'absolute',
            left: -280,
            top: -280,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,240,190,0.3) 0%, rgba(245,194,66,0.16) 38%, rgba(200,40,30,0.08) 62%, rgba(200,40,30,0) 74%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* 赤金/朱砂刀光环：conic 辐条 + 径向遮罩，形成真正的旋转盘 */}
        <div
          style={{
            position: 'absolute',
            left: -260,
            top: -260,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background:
              'repeating-conic-gradient(from 0deg, rgba(245,194,66,1) 0deg 3deg, rgba(200,40,30,0.92) 3deg 6deg, rgba(245,194,66,0) 6deg 15deg)',
            transform: `rotate(${f(angle * 0.55)}deg)`,
            WebkitMaskImage: 'radial-gradient(circle, transparent 0 55%, #000 59%, #000 97%, transparent 100%)',
            maskImage: 'radial-gradient(circle, transparent 0 55%, #000 59%, #000 97%, transparent 100%)',
            filter: 'blur(1.1px)',
            opacity: 1,
            mixBlendMode: 'screen',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -250,
            top: -250,
            width: 500,
            height: 500,
            borderRadius: '50%',
            border: '12px solid #F5C242',
            boxShadow: '0 0 46px rgba(245,194,66,0.9), inset 0 0 32px rgba(200,40,30,0.75)',
            mixBlendMode: 'screen',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: -195,
            top: -195,
            width: 390,
            height: 390,
            borderRadius: '50%',
            border: '6px solid rgba(200,40,30,0.92)',
            transform: `rotate(${f(counter)}deg)`,
            borderStyle: 'dashed',
            opacity: 0.88,
          }}
        />

        {/* 单根旋转金箍棒：中心径向遮罩掏空，只留向外的两段棍身，脸不被压住 */}
        <div
          style={{
            position: 'absolute',
            left: -260,
            top: -11,
            width: 520,
            height: 22,
            borderRadius: 11,
            border: '2px solid #120D14',
            background: 'linear-gradient(90deg, #F5C242 0%, #C8281E 7%, #F5C242 14%, #FFF3D1 50%, #F5C242 86%, #C8281E 93%, #F5C242 100%)',
            boxShadow: '0 0 30px rgba(245,194,66,0.95)',
            transform: `rotate(${f(angle)}deg)`,
            WebkitMaskImage: 'radial-gradient(circle, transparent 0 70px, #000 158px)',
            maskImage: 'radial-gradient(circle, transparent 0 70px, #000 158px)',
            opacity: 0.96,
          }}
        />

        {/* 飞溅火星 + 弹飞的断箭 */}
        <svg viewBox="-300 -300 600 600" width="600" height="600" style={{position: 'absolute', left: -300, top: -300, overflow: 'visible'}}>
          {sparks.map((spark) => {
            const age = (local * spark.speed + spark.phase) % 1;
            const radius = 150 + age * 210;
            const x = Math.cos(spark.angle) * radius;
            const y = Math.sin(spark.angle) * radius * 0.92;
            const colour = spark.tone === 0 ? '#FFF3D1' : spark.tone === 1 ? '#F5C242' : spark.tone === 2 ? '#C8281E' : '#F4EFE6';
            return (
              <g key={`spark-${spark.seed}`} opacity={(1 - age) * 0.9}>
                <circle cx={x} cy={y} r={spark.size * 2.6} fill={colour} opacity="0.16" />
                <circle cx={x} cy={y} r={spark.size} fill={colour} />
              </g>
            );
          })}
          {Array.from({length: 8}, (_, index) => {
            const angle = (index / 8) * Math.PI * 2 + 0.4;
            const radius = 270 + Math.sin(local * 3 + index) * 16;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const rot = (angle * 180) / Math.PI + 90;
            return (
              <g key={`broken-arrow-${index}`} transform={`translate(${x} ${y}) rotate(${rot})`} opacity="0.7">
                <line x1="0" y1="0" x2="0" y2="32" stroke="#120D14" strokeWidth="2.6" />
                <path d="M 0 0 L -6 10 L 6 10 Z" fill="#F5C242" stroke="#120D14" strokeWidth="0.8" />
                <line x1="0" y1="22" x2="10" y2="29" stroke="#C8281E" strokeWidth="1.8" />
              </g>
            );
          })}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  云海                                                                      */
/* -------------------------------------------------------------------------- */

const InkCloudBand: React.FC<{y: number; shift: number; fill: string; opacity: number; amp?: number}> = ({
  y,
  shift,
  fill,
  opacity,
  amp = 18,
}) => (
  <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none', zIndex: 1}}>
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
  const heroLift = Math.sin(local * 8) * 2.2;

  return (
    <AbsoluteFill style={{backgroundColor: WASHI.paperBright, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, #F8F0DE 0%, #F1E5CC 46%, #E4D4B8 100%)`}} />

      <MoonDisc cx={566} cy={430} radius={388} halo={1.36} opacity={1} seed={9082} />

      {/* 远景：南天门连绵飞檐天际线（复用 2K 凌霄殿顶部，压成远山楼影） */}
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

      {/* 十万天兵：压到画面底部，底边由三层云海吃掉 */}
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
          transform: `translateX(${f(-progress * 26)}px)`,
          filter: 'contrast(1.06) saturate(1.02)',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(242,232,213,0.98) 0%, rgba(242,232,213,0.62) 22%, rgba(242,232,213,0) 48%)',
        }}
      />

      {/* 箭雨：从右向左的细线 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 22}, (_, index) => {
          const y = 250 + hash(7800, index) * 640;
          const speed = 900 + hash(7801, index) * 700;
          const x = 1500 - ((local * speed + hash(7802, index) * 1600) % 1700);
          return (
            <g key={`arrow-${index}`} opacity={0.45 + (index % 3) * 0.14}>
              <line x1={f(x)} y1={f(y)} x2={f(x + 92)} y2={f(y + 16)} stroke={WASHI.ink} strokeWidth={1.6} />
              <path d={`M ${f(x)} ${f(y)} l 14 -5 l 0 12 Z`} fill={SENBON.cinnabar} />
            </g>
          );
        })}
      </svg>

      {/* 中景云海：盖住天兵底边与英雄小腿 */}
      <InkCloudBand y={690} shift={local * 0.7} fill="#F7ECD5" opacity={0.97} amp={20} />
      <InkCloudBand y={760} shift={local * 0.9 + 1.4} fill="#F2E4C8" opacity={0.98} amp={16} />
      <InkCloudBand y={835} shift={local * 1.1 + 2.2} fill="#ECDAB9" opacity={0.98} amp={14} />

      {/* 角色脚下的墨底：把宣纸色裤子从米白纸面里托出来 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 40% 46% at 35% 78%, rgba(18,13,20,0.34) 0%, rgba(18,13,20,0.14) 52%, rgba(18,13,20,0) 74%)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* 旋转刀光轮：圆心对齐双手；放在角色之后，避免棍身穿过面部，圆环从身体两侧露出 */}
      <CudgelWheel time={time} cx={HAND_X} cy={HAND_Y} start={start} />

      {/* 大圣：双手胸前结印，静态棍不再存在 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          transform: `rotate(${f(-1.4 + heroLift)}deg) translateY(${f(Math.sin(local * 6) * 3)}px)`,
          transformOrigin: '35% 90%',
        }}
      >
        <ClimaxAsset asset="charge" height={920} x={HERO_X} baseline={HERO_BASELINE} echo={0.24 + pulse * 0.06} rim={0} />
      </div>

      {/* 前景云海：盖住脚踝 */}
      <CloudBank y={868} height={250} color="#FCF4E1" shade="#E5D5B7" time={local} amp={20} opacity={1} />
      <CloudBank y={948} height={280} color="#F7ECD5" shade="#D9C4A1" time={local * 1.4} amp={16} opacity={0.96} />
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
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
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9}} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9}} />

      {/* 右侧题笺：在任何背景下 100% 可读 */}
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
        }}
      >
        天兵
      </div>
    </AbsoluteFill>
  );
};

export default MoonSpinShot;
