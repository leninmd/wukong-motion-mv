import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {IronChain} from './IronChain';
import {SENBON, clamp01, easeInCubic, easeOutCubic, easeOutExpo, f} from './style';

/**
 * V8 的三处"物理遮罩转场"。
 *
 * 这组组件解决的是 V7 最致命的问题：七段孤立硬切把 MV 变成了 PPT。三处
 * 转场都不是淡入淡出，而是**场景里的物理构件**横穿画面完成擦除：
 *
 *   · `<SlashCrack />`    1B → 2A：金箍棒刀光劈开屏幕；
 *   · `<MountainSmash />` 2B → 3A：黑山 + 浮世绘云海从两侧对撞合拢再拉开；
 *   · `<ChainCurtain />`  3B → 4A：铁索黑幡从顶部砸下遮满全屏再裂开。
 *
 * 全部只读秒数，不写帧号；所有随机纹理来自 `hash(seed, i)`。
 */

/* -------------------------------------------------------------------------- */
/*  1B → 2A：刀光裂屏                                                          */
/* -------------------------------------------------------------------------- */

export interface SlashCrackProps {
  time: number;
  start: number;
  end: number;
}

/** 刀痕：一条 -4° 的斜线。y(x) 在裂屏时用于上下两半的 clip-path。 */
export const SLASH_LINE = {yAtCentre: 548, slope: -0.075} as const;

export const slashLineY = (x: number): number => SLASH_LINE.yAtCentre + (x - 960) * SLASH_LINE.slope;

export const SlashCrack: React.FC<SlashCrackProps> = ({time, start, end}) => {
  const p = clamp01((time - start) / Math.max(0.001, end - start));
  if (p <= 0) return null;
  const draw = easeOutExpo(clamp01(p / 0.26));
  const flash = clamp01(1 - p / 0.18);
  const fade = 1 - clamp01((p - 0.22) / 0.34);
  const sparks = useMemo(
    () =>
      Array.from({length: 22}, (_, index) => ({
        x: 80 + hash(6411, index) * 1760,
        dx: (hash(6412, index) - 0.5) * 110,
        dy: 26 + hash(6413, index) * 84,
        r: 1.2 + hash(6414, index) * 3.4,
        tone: index % 4,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 34, overflow: 'hidden'}}>
      {flash > 0.02 ? (
        <AbsoluteFill style={{backgroundColor: '#FFF6DE', opacity: flash * 0.88, mixBlendMode: 'screen'}} />
      ) : null}

      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity: fade}}>
        <defs>
          <linearGradient id="v8-slash-core" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,247,218,0)" />
            <stop offset="12%" stopColor="#FFF7DA" />
            <stop offset="86%" stopColor="#FFF3D1" />
            <stop offset="100%" stopColor="rgba(255,247,218,0)" />
          </linearGradient>
          <radialGradient id="v8-slash-bloom" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,215,150,0.85)" />
            <stop offset="100%" stopColor="rgba(255,215,150,0)" />
          </radialGradient>
        </defs>

        {/* 刀光两侧的暖光晕 */}
        <ellipse cx="960" cy={f(slashLineY(960))} rx="980" ry="150" fill="url(#v8-slash-bloom)" opacity="0.55" />

        {/* 刀痕主体：外红、中金、内白 */}
        <g clipPath={`inset(0 ${f((1 - draw) * 100)}% 0 0)`}>
          <line x1="-40" y1={f(slashLineY(-40))} x2="1960" y2={f(slashLineY(1960))} stroke="#C8281E" strokeWidth="38" opacity="0.42" />
          <line x1="-40" y1={f(slashLineY(-40))} x2="1960" y2={f(slashLineY(1960))} stroke="#F5C242" strokeWidth="18" opacity="0.95" />
          <line x1="-40" y1={f(slashLineY(-40))} x2="1960" y2={f(slashLineY(1960))} stroke="url(#v8-slash-core)" strokeWidth="7" />
        </g>

        {/* 刀痕上的火星 */}
        {sparks.map((spark, index) => {
          const age = clamp01(p / 0.65);
          const x = spark.x - draw * spark.x * 0.2 + spark.dx * age;
          const y = slashLineY(spark.x) + spark.dy * age;
          const colour = spark.tone === 0 ? '#FFF7DA' : spark.tone === 1 ? '#F5C242' : spark.tone === 2 ? '#C8281E' : '#F4EFE6';
          return <circle key={`slash-spark-${index}`} cx={f(x)} cy={f(y)} r={f(spark.r * (1 - age * 0.6))} fill={colour} opacity={(1 - age) * 0.9} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  2B → 3A：黑山与云海对撞合拢                                                */
/* -------------------------------------------------------------------------- */

export interface MountainSmashProps {
  time: number;
  start: number;
  end: number;
}

const SLAB_W = 1200;

const Slab: React.FC<{side: -1 | 1; shift: number; scroll: number; glow: number}> = ({side, shift, scroll, glow}) => {
  const seed = side < 0 ? 5201 : 7301;
  const inner = useMemo(() => {
    const strata = Array.from({length: 11}, (_, index) => {
      const y = 60 + index * 96 + hash(seed, index) * 40;
      const points: string[] = [];
      for (let step = 0; step <= 8; step += 1) {
        const x = -20 + step * 155;
        points.push(`${x.toFixed(0)} ${(y + Math.sin(step * 1.7 + index) * 22).toFixed(0)}`);
      }
      return {d: `M ${points.join(' L ')}`, opacity: 0.18 + hash(seed + 1, index) * 0.24};
    });
    const cracks = Array.from({length: 7}, (_, index) => {
      const x = 120 + hash(seed + 2, index) * 940;
      const y = 120 + hash(seed + 3, index) * 760;
      return {
        d: `M ${x.toFixed(0)} ${y.toFixed(0)} l ${(hash(seed + 4, index) - 0.5) * 90} 84 l ${(hash(seed + 5, index) - 0.5) * 66} 120`,
        width: 2 + hash(seed + 6, index) * 4,
      };
    });
    const clouds = Array.from({length: 5}, (_, index) => ({
      y: 120 + index * 196 + hash(seed + 7, index) * 46,
      scale: 0.8 + hash(seed + 8, index) * 0.7,
      opacity: 0.5 + hash(seed + 9, index) * 0.4,
      speed: 0.6 + hash(seed + 10, index) * 0.9,
    }));
    const debris = Array.from({length: 9}, (_, index) => ({
      x: 900 + hash(seed + 11, index) * 300,
      y: 120 + hash(seed + 12, index) * 840,
      r: 4 + hash(seed + 13, index) * 14,
      rot: hash(seed + 14, index) * 180,
    }));
    return {strata, cracks, clouds, debris};
  }, [seed]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: side < 0 ? shift : 1920 + shift,
        width: SLAB_W,
        height: 1080,
        transform: side < 0 ? undefined : 'scaleX(-1)',
        transformOrigin: '50% 50%',
      }}
    >
      <svg viewBox={`0 0 ${SLAB_W} 1080`} width={SLAB_W} height={1080} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`slab-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4C3C36" />
            <stop offset="26%" stopColor="#2A1E1D" />
            <stop offset="58%" stopColor="#171011" />
            <stop offset="82%" stopColor="#0C0809" />
            <stop offset="100%" stopColor="#050405" />
          </linearGradient>
          <linearGradient id={`slab-rim-${side}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(245,194,66,0)" />
            <stop offset="82%" stopColor="rgba(245,194,66,0.18)" />
            <stop offset="96%" stopColor="rgba(255,243,209,0.75)" />
            <stop offset="100%" stopColor="rgba(200,40,30,0.9)" />
          </linearGradient>
        </defs>

        {/* 山体本体：内侧是锯齿断崖，外侧压出画面 */}
        <path
          d="M -80 -40 L 1060 -40 L 1130 96 L 1062 208 L 1128 330 L 1036 448 L 1118 566 L 1024 700 L 1100 836 L 1008 968 L 1046 1120 L -80 1120 Z"
          fill={`url(#slab-${side})`}
        />
        {/* 内侧受光边 */}
        <path
          d="M 1060 -40 L 1130 96 L 1062 208 L 1128 330 L 1036 448 L 1118 566 L 1024 700 L 1100 836 L 1008 968 L 1046 1120"
          fill="none"
          stroke={`url(#slab-rim-${side})`}
          strokeWidth={30}
          opacity={0.72 + glow * 0.24}
        />
        <path
          d="M 1060 -40 L 1130 96 L 1062 208 L 1128 330 L 1036 448 L 1118 566 L 1024 700 L 1100 836 L 1008 968 L 1046 1120"
          fill="none"
          stroke="#FFF3D1"
          strokeWidth={4}
          opacity={0.78 + glow * 0.2}
          style={{mixBlendMode: 'screen'}}
        />
        <path
          d="M 1060 -40 L 1130 96 L 1062 208 L 1128 330 L 1036 448 L 1118 566 L 1024 700 L 1100 836 L 1008 968 L 1046 1120"
          fill="none"
          stroke="#C8281E"
          strokeWidth={2.2}
          opacity={0.72}
        />

        {/* 层理 */}
        {inner.strata.map((stratum, index) => (
          <path key={`stratum-${index}`} d={stratum.d} fill="none" stroke="#7A665C" strokeWidth={2.6 + (index % 3)} opacity={stratum.opacity * 1.5} />
        ))}

        {/* 岩缝 */}
        {inner.cracks.map((crack, index) => (
          <path key={`crack-${index}`} d={crack.d} fill="none" stroke="#050405" strokeWidth={crack.width} opacity="0.85" />
        ))}

        {/* 金脉：只在断崖内侧 */}
        <path
          d="M 1096 60 Q 1040 190 1100 300 Q 1044 430 1092 560 Q 1038 690 1082 820 Q 1030 930 1060 1080"
          fill="none"
          stroke="#F5C242"
          strokeWidth={4}
          opacity={0.24 + glow * 0.36}
        />
        <path
          d="M 1070 120 Q 1010 240 1064 360 Q 1014 470 1052 600"
          fill="none"
          stroke="#C8281E"
          strokeWidth={2.4}
          opacity={0.34 + glow * 0.3}
        />

        {/* 浮世绘黑云：沿山体横向滚动 */}
        {inner.clouds.map((cloud, index) => {
          const shift = ((scroll * cloud.speed * 90 + index * 230) % 460) - 230;
          return (
            <g key={`cloud-${index}`} transform={`translate(${f(shift)} ${f(cloud.y)}) scale(${f(cloud.scale)})`} opacity={cloud.opacity}>
              <path
                d="M 0 0 Q 40 -34 92 -8 Q 126 -42 178 -10 Q 224 -30 268 4 Q 224 34 176 18 Q 134 44 92 20 Q 44 40 0 0 Z"
                fill="#080607"
                stroke="#3B3032"
                strokeWidth={2.2}
              />
              <path d="M 22 2 Q 58 -14 96 0 Q 134 -16 170 2" fill="none" stroke="#F5C242" strokeWidth={1.4} opacity="0.34" />
              <circle cx="92" cy="-6" r="4" fill="#F5C242" opacity="0.7" />
              <circle cx="178" cy="-4" r="3" fill="#C8281E" opacity="0.8" />
            </g>
          );
        })}

        {/* 撞击碎石 */}
        {inner.debris.map((piece, index) => (
          <path
            key={`debris-${index}`}
            d={`M ${piece.x} ${piece.y} l ${piece.r} -${piece.r * 0.8} l ${piece.r * 0.9} ${piece.r * 1.2} l -${piece.r * 1.3} ${piece.r * 0.4} Z`}
            fill="#171214"
            stroke="#F5C242"
            strokeWidth="1.2"
            opacity={0.4 + glow * 0.4}
            transform={`rotate(${piece.rot} ${piece.x} ${piece.y})`}
          />
        ))}
      </svg>
    </div>
  );
};

export const MountainSmash: React.FC<MountainSmashProps> = ({time, start, end}) => {
  const local = time - start;
  if (local < 0) return null;
  const close = easeOutCubic(clamp01(local / 0.2));
  const open = easeOutCubic(clamp01((local - 0.27) / Math.max(0.001, end - start - 0.27)));
  if (open >= 1) return null;

  const impact = clamp01(1 - Math.abs(local - 0.2) / 0.055);
  const leftShift = -SLAB_W + close * SLAB_W - open * SLAB_W;
  const rightShift = open * SLAB_W - close * SLAB_W;
  const seam = clamp01((local - 0.17) / 0.07) * (1 - open * 0.4);
  const underlay = clamp01((close - 0.72) / 0.28) * (1 - open);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 44, overflow: 'hidden'}}>
      {/* 黑底垫层：两山合拢到 72% 后彻底封死 2B，避免切换瞬间漏帧 */}
      <AbsoluteFill style={{backgroundColor: '#050405', opacity: underlay}} />
      <Slab side={-1} shift={leftShift} scroll={local * 6} glow={impact} />
      <Slab side={1} shift={rightShift} scroll={local * 5.2 + 1.7} glow={impact} />

      {/* 对撞缝：暖金天光从山缝里挤进来 */}
      {seam > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 930 - open * 120,
            top: 0,
            width: 60 + open * 120,
            height: 1080,
            background:
              'radial-gradient(ellipse 50% 70% at 50% 54%, rgba(255,243,209,0.95) 0%, rgba(245,194,66,0.65) 34%, rgba(200,40,30,0.16) 68%, rgba(0,0,0,0) 100%)',
            opacity: seam * (0.55 + impact * 0.45),
            mixBlendMode: 'screen',
            filter: 'blur(2px)',
          }}
        />
      ) : null}

      {impact > 0.08 ? (
        <AbsoluteFill style={{backgroundColor: '#FFF3D1', opacity: impact * 0.26, mixBlendMode: 'screen'}} />
      ) : null}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  3B → 4A：铁索黑幡砸落                                                      */
/* -------------------------------------------------------------------------- */

export interface ChainCurtainProps {
  time: number;
  start: number;
  end: number;
}

const CurtainHalf: React.FC<{side: -1 | 1; split: number; drop: number; glow: number}> = ({side, split, drop, glow}) => {
  const width = 960;
  const seed = side < 0 ? 0 : 7;
  const chains = useMemo(
    () =>
      Array.from({length: 7}, (_, index) => ({
        x: 70 + index * 140,
        len: 92 + hash(8811 + seed, index) * 150,
        phase: hash(8812 + seed, index) * Math.PI * 2,
      })),
    [seed],
  );
  const wallChains = useMemo(
    () =>
      Array.from({length: 11}, (_, index) => ({
        x: 30 + index * 88 + (hash(8830 + seed, index) - 0.5) * 18,
        top: 40 + hash(8831 + seed, index) * 260,
        links: 12 + Math.floor(hash(8832 + seed, index) * 14),
        swing: (hash(8833 + seed, index) - 0.5) * 8,
        tone: index % 4,
      })),
    [seed],
  );
  const banners = useMemo(
    () =>
      Array.from({length: 3}, (_, index) => ({
        x: 90 + index * 280,
        top: 120 + index * 220,
        w: 150 + hash(8821 + (side < 0 ? 0 : 5), index) * 70,
        h: 380 + hash(8822 + (side < 0 ? 0 : 5), index) * 180,
        rot: (hash(8823 + (side < 0 ? 0 : 5), index) - 0.5) * 9,
      })),
    [side],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: -1080 + drop * 1080,
        left: side < 0 ? 0 : width,
        width,
        height: 1080,
        transform: `translateX(${f(side * split * width)}px)`,
        willChange: 'transform',
      }}
    >
      {/* 玄黑铁幕底 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #080607 0%, #0E0A0C 40%, #050405 100%)',
          boxShadow: side < 0 ? 'inset -40px 0 70px rgba(0,0,0,0.9)' : 'inset 40px 0 70px rgba(0,0,0,0.9)',
        }}
      />
      {/* 竖向铁肋 + 横向铆钉 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(245,194,66,0.08) 0px, rgba(245,194,66,0.08) 3px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 86px), radial-gradient(circle, rgba(245,194,66,0.5) 0.8px, rgba(0,0,0,0) 1.4px)',
          backgroundSize: 'auto, 86px 94px',
          opacity: 0.62,
        }}
      />

      {/* 密布竖向铁索：从幕顶垂到不同长度，链环是实体椭圆 */}
      <svg viewBox={`0 0 ${width} 1080`} width={width} height={1080} style={{position: 'absolute', inset: 0, opacity: 0.72}}>
        {wallChains.map((chain, index) => (
          <g key={`wall-chain-${index}`} transform={`translate(${f(chain.x)} 0) rotate(${f(chain.swing)} 0 0)`}>
            <line x1="0" y1="0" x2="0" y2={chain.top} stroke="#1A1113" strokeWidth="7" />
            {Array.from({length: chain.links}, (_, link) => {
              const y = chain.top + link * 21;
              const tone = chain.tone === 0 ? '#F5C242' : chain.tone === 1 ? '#8C8478' : '#C8281E';
              return (
                <g key={`wall-link-${index}-${link}`} transform={`translate(0 ${f(y)})`}>
                  <ellipse cx="0" cy="0" rx="7.5" ry="12" fill="none" stroke="#0B090A" strokeWidth="4.6" />
                  <ellipse cx="0" cy="0" rx="7.5" ry="12" fill="none" stroke={tone} strokeWidth="2.2" opacity={0.86 - link * 0.02} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>

      {/* 黑幡：朱砂边 + 鎏金云头 */}
      {banners.map((banner, index) => (
        <div
          key={`banner-${index}`}
          style={{
            position: 'absolute',
            left: banner.x,
            top: banner.top,
            width: banner.w,
            height: banner.h,
            transform: `rotate(${f(banner.rot)}deg)`,
            background: 'linear-gradient(180deg, #120C0E 0%, #0A0708 100%)',
            border: '3px solid #C8281E',
            boxShadow: 'inset 0 0 0 1px #3A2408, 0 0 34px rgba(0,0,0,0.8)',
          }}
        >
          <svg viewBox="0 0 160 420" width="100%" height="100%" preserveAspectRatio="none" style={{position: 'absolute', inset: 0}}>
            <path d="M 8 8 Q 40 26 80 10 Q 120 26 152 8" fill="none" stroke="#F5C242" strokeWidth="4" />
            <path d="M 14 34 Q 52 14 84 32 Q 118 14 148 34" fill="none" stroke="#F5C242" strokeWidth="1.6" opacity="0.7" />
            <path d="M 24 370 Q 80 344 140 372" fill="none" stroke="#F5C242" strokeWidth="3" opacity="0.66" />
            <circle cx="80" cy="80" r="30" fill="none" stroke="#F5C242" strokeWidth="3" opacity="0.7" />
            <path d="M 50 80 Q 80 52 110 80 Q 80 108 50 80 Z" fill="#C8281E" opacity="0.55" />
            <path d="M 28 160 Q 80 130 132 162 M 28 230 Q 80 200 132 232 M 28 300 Q 80 270 132 302" fill="none" stroke="#F5C242" strokeWidth="1.2" opacity="0.3" />
          </svg>
        </div>
      ))}

      {/* 底部垂链：每一环都是实体椭圆，不是虚线 */}
      <svg viewBox={`0 0 ${width} 300`} width={width} height={300} style={{position: 'absolute', left: 0, top: 1080 - 6, overflow: 'visible'}}>
        {chains.map((chain, index) => (
          <g key={`chain-${index}`}>
            {Array.from({length: 9}, (_, link) => {
              const scale = 1 - link * 0.04;
              const y = link * 22;
              const sway = Math.sin(chain.phase + link * 0.5) * (2 + link * 0.9);
              return (
                <g key={`link-${index}-${link}`} transform={`translate(${f(chain.x + sway)} ${f(y)}) scale(${f(scale)})`}>
                  <ellipse cx="0" cy="0" rx="9" ry="14" fill="none" stroke="#F5C242" strokeWidth="3.4" opacity={0.9 - link * 0.06} />
                  <ellipse cx="0" cy="0" rx="9" ry="14" fill="none" stroke="#0B090A" strokeWidth="1.2" opacity="0.9" />
                  <ellipse cx="0" cy="0" rx="3" ry="5" fill="none" stroke="#F5C242" strokeWidth="1.2" opacity="0.7" />
                </g>
              );
            })}
            <path
              d={`M ${chain.x - 18} 206 L ${chain.x - 8} ${206 + chain.len * 0.5} L ${chain.x + 2} ${206 + chain.len}`}
              fill="none"
              stroke="#C8281E"
              strokeWidth="5"
              opacity="0.72"
            />
            <circle cx={chain.x + 2} cy={206 + chain.len} r="7" fill="#C8281E" stroke="#F5C242" strokeWidth="2" />
          </g>
        ))}
      </svg>

      {/* 门缝侧的金边 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 10,
          [side < 0 ? 'right' : 'left']: 0,
          background: 'linear-gradient(90deg, rgba(245,194,66,0) 0%, rgba(245,194,66,0.85) 50%, rgba(255,243,209,0.95) 100%)',
          opacity: 0.4 + glow * 0.6,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 46,
          height: 5,
          background: 'linear-gradient(90deg, rgba(245,194,66,0), #F5C242 30%, #C8281E 50%, #F5C242 70%, rgba(245,194,66,0))',
          opacity: 0.8,
        }}
      />
    </div>
  );
};

export const ChainCurtain: React.FC<ChainCurtainProps> = ({time, start, end}) => {
  const local = time - start;
  if (local < 0) return null;
  const drop = easeOutExpo(clamp01(local / 0.13));
  const split = easeOutCubic(clamp01((local - 0.18) / Math.max(0.001, end - start - 0.18)));
  if (split >= 1) return null;
  const impact = clamp01(1 - Math.abs(local - 0.13) / 0.055);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 46, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0)'}}>
      <CurtainHalf side={-1} split={split} drop={drop} glow={impact} />
      <CurtainHalf side={1} split={split} drop={drop} glow={impact} />

      {/* 顶部横向主链：砸落时最后入画 */}
      <svg viewBox="0 0 1920 120" width="1920" height="120" style={{position: 'absolute', left: 0, top: -120 + drop * 120, opacity: 0.9}}>
        <IronChain x1={-40} y1={54} x2={1960} y2={54} sag={26} linkLen={30} glow={0.3} runeText="" runeStep={11} seed={5} />
      </svg>

      {/* 落幕瞬间只用中缝金线发亮，绝不整屏提亮（否则黑幕变灰幕） */}
      {impact > 0.08 ? (
        <div
          style={{
            position: 'absolute',
            left: 930,
            top: 0,
            width: 60,
            height: 1080,
            background: 'linear-gradient(90deg, rgba(245,194,66,0) 0%, rgba(255,243,209,0.85) 50%, rgba(245,194,66,0) 100%)',
            opacity: impact * 0.8,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export default SlashCrack;
