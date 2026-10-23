import React, {useMemo} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {hash} from '../../utils/math';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {ComplexOfudaTalisman} from './ComplexOfudaTalisman';
import {FlowingSutra} from './FlowingSutra';
import {IronChain} from './IronChain';
import {InkSpecks} from './PaperStage';
import {SENBON, clamp01, easeOutCubic, f} from './style';

/**
 * `<MountainCleft />` —— V8 的 Sub3A/3B：会动的五指山。
 *
 * V7 的五指山是**一张死壁纸**：山不合拢、云不翻、梵文不流、大圣只是被
 * 裁切显现。V8 把它拆成七层：
 *
 *   1. 生图 2K 山体（150–158 帧从 1.24×/−120px 压降到 1.0/0，带低频震动）；
 *   2. `<FlowingSutra />` 十二列流动鎏金经文 + 七道横向压力光网；
 *   3. 左右前景黑岩（随帧数向中心挤压，带层理/金脉/受光边）；
 *   4. 六道 X 形铁索（在角色之后，不再穿手）；
 *   5. 底部三层不同流速的黑云河；
 *   6. 大圣：每 2 帧 ±3px 的发力震颤 + 向上逆流的赤金火焰与碎石；
 *   7. 六张五层复合符咒（3B）。
 *
 * 所有时间只读 `start`/`pressAt` 秒值；所有随机纹理来自 `hash`。
 */

export interface ChainSpec {
  id: string;
  arriveAt: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sag?: number;
}

export interface OfudaSpec {
  id: string;
  text: string;
  revealAt: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
}

export interface MountainCleftProps {
  time: number;
  start: number;
  end: number;
  rockDrops: readonly number[];
  kneelAt: number;
  chains: readonly ChainSpec[];
  ofuda?: readonly OfudaSpec[];
  pulse?: number;
  /** V8：Blender 离线烘焙的 3D 巨岩 + 铁索层（透明 .mov），插在角色与符咒之间。 */
  insertLayer?: React.ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  前景黑岩                                                                  */
/* -------------------------------------------------------------------------- */

const ForegroundRock: React.FC<{side: -1 | 1; squeeze: number; time: number; pulse: number}> = ({
  side,
  squeeze,
  time,
  pulse,
}) => {
  const seed = side < 0 ? 3101 : 4901;
  const strata = useMemo(
    () =>
      Array.from({length: 9}, (_, index) => ({
        y: 90 + index * 118 + hash(seed, index) * 40,
        d: `M 0 ${(40 + index * 110 + hash(seed + 1, index) * 30).toFixed(0)} L 150 ${(90 + index * 110).toFixed(0)} L 300 ${(62 + index * 110 + hash(seed + 2, index) * 26).toFixed(0)}`,
        opacity: 0.18 + hash(seed + 3, index) * 0.26,
      })),
    [seed],
  );
  const shift = side < 0 ? -260 + squeeze * 168 : 1920 + 260 - squeeze * 168;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: side < 0 ? shift : shift - 440,
        width: 440,
        height: 1080,
        transform: side < 0 ? undefined : 'scaleX(-1)',
        transformOrigin: '50% 50%',
        zIndex: 3,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 440 1080" width="440" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={`fg-rock-${side}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1B1517" />
            <stop offset="42%" stopColor="#0E0A0C" />
            <stop offset="100%" stopColor="#050405" />
          </linearGradient>
          <linearGradient id={`fg-rim-${side}`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,243,209,0.65)" />
            <stop offset="4%" stopColor="rgba(245,194,66,0.22)" />
            <stop offset="18%" stopColor="rgba(245,194,66,0)" />
          </linearGradient>
        </defs>

        {/* 主体：内侧锯齿断崖 */}
        <path
          d="M -20 -40 L 250 -40 L 306 96 L 246 214 L 330 338 L 250 472 L 344 600 L 262 742 L 350 878 L 274 1000 L 318 1120 L -20 1120 Z"
          fill={`url(#fg-rock-${side})`}
        />
        {/* 内侧受光 */}
        <path
          d="M 250 -40 L 306 96 L 246 214 L 330 338 L 250 472 L 344 600 L 262 742 L 350 878 L 274 1000 L 318 1120"
          fill="none"
          stroke={`url(#fg-rim-${side})`}
          strokeWidth={16}
          opacity={0.6 + pulse * 0.3}
        />
        <path
          d="M 250 -40 L 306 96 L 246 214 L 330 338 L 250 472 L 344 600 L 262 742 L 350 878 L 274 1000 L 318 1120"
          fill="none"
          stroke="rgba(255,243,209,0.55)"
          strokeWidth={2.2}
          opacity="0.72"
        />
        {/* 层理 */}
        {strata.map((stratum, index) => (
          <path key={`fg-stratum-${index}`} d={stratum.d} fill="none" stroke="#3A3032" strokeWidth={2.4 + (index % 3)} opacity={stratum.opacity} />
        ))}
        {/* 金脉 + 朱砂暗线 */}
        <path
          d={`M 272 ${40 + Math.sin(time * 1.4) * 6} Q 214 220 292 360 Q 226 520 300 660 Q 232 820 296 1000`}
          fill="none"
          stroke="#F5C242"
          strokeWidth={3}
          opacity={0.18 + pulse * 0.22}
        />
        <path
          d="M 298 120 Q 250 300 312 470 Q 258 660 314 860"
          fill="none"
          stroke="#C8281E"
          strokeWidth={2}
          opacity={0.28 + pulse * 0.2}
        />
        {/* 岩面碎屑 */}
        {Array.from({length: 16}, (_, index) => {
          const x = 40 + hash(seed + 20, index) * 260;
          const y = 40 + hash(seed + 21, index) * 980;
          const r = 1.4 + hash(seed + 22, index) * 4.6;
          return <circle key={`fg-dust-${index}`} cx={f(x)} cy={f(y)} r={f(r)} fill="#F5C242" opacity={0.12 + hash(seed + 23, index) * 0.18} />;
        })}
      </svg>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  底部黑云河                                                                */
/* -------------------------------------------------------------------------- */

const BlackCloudRiver: React.FC<{time: number; pulse: number}> = ({time, pulse}) => (
  <svg
    viewBox="0 0 1920 1080"
    width="1920"
    height="1080"
    style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6}}
  >
    {[0, 1, 2].map((band) => {
      const y = 892 + band * 62;
      const speed = 34 + band * 26;
      const shift = (time * speed) % 420;
      const amp = 20 - band * 4 + pulse * 6;
      const points: string[] = [`M -260 ${y}`];
      for (let x = -260; x <= 2180; x += 90) {
        points.push(
          `L ${x} ${(y + Math.sin((x + shift) / 130 + band * 1.6) * amp + Math.sin((x + shift) / 47 + band) * amp * 0.42).toFixed(1)}`,
        );
      }
      points.push('L 2180 1120 L -260 1120 Z');
      return (
        <g key={`river-${band}`}>
          <path d={points.join(' ')} fill={band === 2 ? '#050304' : '#0A0708'} opacity={0.94 - band * 0.06} />
          <path
            d={points.slice(0, 14).join(' ')}
            fill="none"
            stroke={band === 0 ? '#F5C242' : '#4A3A22'}
            strokeWidth={band === 0 ? 2 : 1.4}
            opacity={0.4 - band * 0.08}
          />
        </g>
      );
    })}
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  大圣火焰 / 逆流碎石                                                        */
/* -------------------------------------------------------------------------- */

/** 分叉火舌：主舌 + 侧舌，避免读出"花瓣"。 */
const flameD = (x: number, base: number, h: number, w: number, sway: number): string => {
  const tip = base - h;
  return [
    `M ${f(x - w)} ${f(base)}`,
    `C ${f(x - w * 1.05)} ${f(base - h * 0.3)} ${f(x - w * 0.4 + sway)} ${f(base - h * 0.58)} ${f(x + sway)} ${f(tip)}`,
    `C ${f(x + w * 0.35 + sway)} ${f(base - h * 0.6)} ${f(x + w * 0.9)} ${f(base - h * 0.35)} ${f(x + w)} ${f(base)}`,
    'Z',
    `M ${f(x + w * 0.2)} ${f(base)}`,
    `C ${f(x + w * 0.3)} ${f(base - h * 0.24)} ${f(x + w * 1.1 + sway * 0.6)} ${f(base - h * 0.42)} ${f(x + w * 1.5 + sway * 0.5)} ${f(base - h * 0.72)}`,
    `C ${f(x + w * 1.1)} ${f(base - h * 0.42)} ${f(x + w * 0.8)} ${f(base - h * 0.2)} ${f(x + w * 0.9)} ${f(base)}`,
    'Z',
  ].join(' ');
};

const FlameAura: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const flames = useMemo(
    () =>
      Array.from({length: 16}, (_, index) => ({
        x: 690 + hash(4400, index) * 400,
        base: 908 + hash(4401, index) * 40,
        height: 120 + hash(4402, index) * 160,
        width: 5 + hash(4403, index) * 9,
        phase: hash(4404, index) * Math.PI * 2,
        speed: 4 + hash(4405, index) * 5,
        tone: index % 3,
      })),
    [],
  );
  const embers = useMemo(
    () =>
      Array.from({length: 30}, (_, index) => ({
        x: 700 + hash(4500, index) * 420,
        y: 620 + hash(4501, index) * 430,
        speed: 60 + hash(4502, index) * 120,
        size: 1 + hash(4503, index) * 3,
        phase: hash(4504, index) * Math.PI * 2,
      })),
    [],
  );

  return (
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4}}>
      <g style={{mixBlendMode: 'screen'}}>
        {flames.map((flame, index) => {
          const flicker = 0.72 + Math.sin(time * flame.speed + flame.phase) * 0.28;
          const h = flame.height * flicker;
          const x = flame.x + Math.sin(time * 2.2 + flame.phase) * 8;
          const colour = flame.tone === 0 ? '#F5C242' : flame.tone === 1 ? '#C8281E' : '#FFE9A8';
          const sway = Math.sin(time * 2.4 + index) * 8;
          return (
            <g key={`flame-${index}`} opacity={(0.24 + (index % 4) * 0.06) * (0.7 + pulse * 0.5)}>
              <path d={flameD(x, flame.base, h, flame.width, sway)} fill={colour} />
              <path
                d={flameD(x + sway * 0.3, flame.base, h * 0.62, flame.width * 0.52, sway * 0.6)}
                fill={index % 2 === 0 ? '#FFF3D1' : '#FFE08A'}
                opacity="0.42"
              />
            </g>
          );
        })}
        {embers.map((ember, index) => {
          const travel = (time * ember.speed + ember.phase * 30) % 430;
          const x = ember.x + Math.sin(time * 2.6 + ember.phase) * 16;
          const y = ember.y - travel;
          return <circle key={`ember-${index}`} cx={f(x)} cy={f(y)} r={f(ember.size)} fill={index % 3 === 0 ? '#FFF3D1' : '#F5C242'} opacity={0.55 * (1 - travel / 430)} />;
        })}
      </g>
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  镇压力场 / 落石 / 前景火舌                                                */
/* -------------------------------------------------------------------------- */

const PressureRings: React.FC<{time: number; pulse: number}> = ({time, pulse}) => (
  <svg
    viewBox="0 0 1920 1080"
    width="1920"
    height="1080"
    style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, mixBlendMode: 'screen', opacity: 0.9}}
  >
    <ellipse cx={832} cy={1040} rx={238} ry={38} fill="rgba(200,40,30,0.14)" />
    {[0, 1, 2].map((index) => {
      const phase = (time * 0.7 + index * 0.33) % 1;
      const rx = 150 + phase * 280;
      const ry = 20 + phase * 30;
      return (
        <ellipse
          key={`pressure-ring-${index}`}
          cx={832}
          cy={1040}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={index === 1 ? '#C8281E' : '#F5C242'}
          strokeWidth={3.4 - index * 0.6}
          opacity={(1 - phase) * (0.36 + pulse * 0.22)}
        />
      );
    })}
  </svg>
);

const FallingDebris: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const pieces = useMemo(
    () =>
      Array.from({length: 22}, (_, index) => ({
        x: 140 + hash(4700, index) * 1640,
        size: 3 + hash(4701, index) * 12,
        speed: 90 + hash(4702, index) * 160,
        phase: hash(4703, index) * 1100,
        rot: hash(4704, index) * 180,
        tone: index % 3,
      })),
    [],
  );
  return (
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5}}>
      {pieces.map((piece, index) => {
        const y = ((piece.phase + time * piece.speed) % 1160) - 40;
        const x = piece.x + Math.sin(time * 1.6 + index) * 18;
        return (
          <g key={`falling-${index}`} transform={`translate(${f(x)} ${f(y)}) rotate(${f(piece.rot + time * 40)})`} opacity={0.5 + (index % 3) * 0.12}>
            <line x1="0" y1={-piece.size * 2.6} x2="0" y2="0" stroke="#F5C242" strokeWidth="1.2" opacity={0.28 + pulse * 0.2} />
            <path
              d={`M 0 ${-piece.size} L ${piece.size * 0.8} ${piece.size * 0.2} L ${-piece.size * 0.5} ${piece.size} L ${-piece.size * 0.9} ${-piece.size * 0.2} Z`}
              fill={piece.tone === 0 ? '#0B090A' : piece.tone === 1 ? '#2A1A16' : '#171214'}
              stroke="#F5C242"
              strokeWidth="1.1"
            />
          </g>
        );
      })}
    </svg>
  );
};

const FlameFront: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const flames = useMemo(
    () =>
      Array.from({length: 10}, (_, index) => ({
        /* 分列大圣左右两侧，不在他下巴正下方排成一排"花瓣" */
        x: index < 5 ? 656 + hash(4800, index) * 104 : 1004 + hash(4800, index) * 104,
        base: 936 + hash(4801, index) * 50,
        height: 90 + hash(4802, index) * 120,
        width: 5 + hash(4803, index) * 8,
        phase: hash(4804, index) * Math.PI * 2,
        speed: 5 + hash(4805, index) * 5,
      })),
    [],
  );
  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8, mixBlendMode: 'screen'}}
    >
      {flames.map((flame, index) => {
        const flicker = 0.7 + Math.sin(time * flame.speed + flame.phase) * 0.3;
        const h = flame.height * flicker;
        const x = flame.x + Math.sin(time * 2.4 + flame.phase) * 7;
        const sway = Math.sin(time * 3.4 + index) * 7;
        return (
          <g key={`front-flame-${index}`} opacity={(0.2 + (index % 4) * 0.05) * (0.7 + pulse * 0.5)}>
            <path d={flameD(x, flame.base, h, flame.width, sway)} fill={index % 3 === 0 ? '#FFF3D1' : index % 3 === 1 ? '#F5C242' : '#C8281E'} />
            <path d={flameD(x + sway * 0.3, flame.base, h * 0.58, flame.width * 0.5, sway * 0.5)} fill="#FFF3D1" opacity="0.35" />
          </g>
        );
      })}
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

export const MountainCleft: React.FC<MountainCleftProps> = ({
  time,
  start,
  end,
  rockDrops,
  kneelAt,
  chains,
  ofuda = [],
  pulse = 0,
  insertLayer,
}) => {
  const local = time - start;
  const kneel = clamp01((time - (kneelAt - 0.2)) / 0.26);
  const press = easeOutCubic(clamp01(local / 0.27));
  const squeeze = easeOutCubic(clamp01(local / 2.2));
  const lightPulse = 0.88 + Math.sin(local * 3.1) * 0.05 + pulse * 0.12;
  const pressureShake = (1 - press) * Math.sin(time * 86) * 5;
  const tremble = 2.2 + Math.sin(local * 2.4) * 1.2;
  const imageScale = 1.24 - 0.24 * press + Math.sin(local * 1.7) * 0.003;
  const imageY = -120 * (1 - press);

  return (
    <AbsoluteFill style={{backgroundColor: '#080506', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${f(pressureShake)}px, ${f(pressureShake * 0.45)}px)`,
        }}
      >
        {/* 1. 山体：压降 + 低频震动 */}
        <Img
          src={staticFile(CLIMAX_ASSETS.mountain.file)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '50% 48%',
            transform: `scale(${f(imageScale)}) translateY(${f(imageY)}px)`,
            transformOrigin: '50% 42%',
            filter: 'contrast(1.05) brightness(0.96)',
          }}
        />
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 36% 28% at 50% 70%, rgba(255,215,155,${0.34 * lightPulse}) 0%, rgba(255,215,155,0) 72%)`,
            mixBlendMode: 'screen',
          }}
        />
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `linear-gradient(180deg, rgba(255,215,155,0) 34%, rgba(255,205,140,0.2) 72%, rgba(255,205,140,0) 100%)`,
            clipPath: 'polygon(41% 0, 59% 0, 82% 100%, 18% 100%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* 2. 流动鎏金经文 + 压力网 */}
        <div style={{position: 'absolute', inset: 0, zIndex: 2}}>
          <FlowingSutra time={time} start={start} intensity={press} />
        </div>

        {/* 3. 前景黑岩向中心挤压 */}
        <ForegroundRock side={-1} squeeze={squeeze} time={time} pulse={pulse} />
        <ForegroundRock side={1} squeeze={squeeze} time={time} pulse={pulse} />

        {/* 4. 六道 X 形铁索：在角色之后 */}
        {chains.map((chain) => {
          const progress = clamp01((time - chain.arriveAt) / 0.22);
          if (progress <= 0) return null;
          return (
            <svg
              key={chain.id}
              viewBox="0 0 1920 1080"
              width="1920"
              height="1080"
              style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.92, zIndex: 5}}
            >
              <IronChain
                x1={chain.x1}
                y1={chain.y1}
                x2={chain.x2}
                y2={chain.y2}
                sag={chain.sag}
                progress={progress}
                linkLen={27}
                glow={0.16}
                runeText=""
                runeStep={9}
              />
            </svg>
          );
        })}

        {/* 5. 镇压力场 + 逆流落石 + 角色背后的暗场 */}
        <PressureRings time={time} pulse={pulse} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 5,
            background: 'radial-gradient(ellipse 26% 40% at 43% 74%, rgba(8,5,7,0.62) 0%, rgba(8,5,7,0.26) 48%, rgba(8,5,7,0) 76%)',
            mixBlendMode: 'multiply',
          }}
        />
        <FallingDebris time={time} pulse={pulse} />
        <FlameAura time={time} pulse={pulse} />

        {/* 6. 大圣：高频发力震颤 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 6,
            clipPath: `inset(${f((1 - easeOutCubic(kneel)) * 100)}% 0 0 0)`,
            transform: `translate(${f(Math.sin(time * 94.2) * tremble)}px, ${f(Math.cos(time * 83.7) * tremble * 0.7)}px) rotate(${f(Math.sin(time * 61.3) * 0.42)}deg)`,
            transformOrigin: '43% 88%',
          }}
        >
          <ClimaxAsset asset="trapped" height={760} x={830} baseline={1092} echo={0.2} rim={0.2} />
        </div>

        {/*
          V8 Blender 层：离线烘焙的透明 3D 巨岩 + 八条实体铁索。
          压在大圣之上、火舌/符咒之下（z 6.5）——落石与索链必须真的"从头顶砸下来"，
          但又不能盖掉符咒与题笺。3D 构图刻意把画面中下部留空给角色。
        */}
        {insertLayer ? (
          <div style={{position: 'absolute', inset: 0, zIndex: 6.5, pointerEvents: 'none'}}>{insertLayer}</div>
        ) : null}

        {/* 7. 火底辉光 + 前景火舌 + 底部黑云河：压在角色脚边 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 250,
            zIndex: 7,
            pointerEvents: 'none',
            background:
              'linear-gradient(0deg, rgba(200,40,30,0.42) 0%, rgba(245,194,66,0.2) 42%, rgba(200,40,30,0.05) 72%, rgba(0,0,0,0) 100%)',
            mixBlendMode: 'screen',
            opacity: 0.8 + pulse * 0.2,
          }}
        />
        <FlameFront time={time} pulse={pulse} />
        <BlackCloudRiver time={time} pulse={pulse} />

        {/* 六张复合符咒：钉在 X 网交汇处，必须在前景岩石之上 */}
        {ofuda.map((slot) => {
          const reveal = clamp01((time - slot.revealAt) / 0.24);
          if (reveal <= 0) return null;
          const shake = (1 - easeOutCubic(reveal)) * 16;
          return (
            <ComplexOfudaTalisman
              key={slot.id}
              text={slot.text}
              angle={slot.rotate}
              width={slot.width}
              height={slot.height}
              reveal={reveal}
              shakeX={Math.sin(reveal * 44 + slot.x) * shake}
              shakeY={Math.cos(reveal * 37 + slot.y) * shake * 0.6}
              style={{left: slot.x - slot.width / 2, top: slot.y - slot.height / 2, zIndex: 9}}
            />
          );
        })}

        <InkSpecks count={28} seed={8555} time={time} color="#F5E6C8" spread={0.55} />

        {/* 上下压边，给符咒与角色留局部对比 */}
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `linear-gradient(180deg, rgba(8,5,6,0.55) 0%, rgba(8,5,6,0) 18%, rgba(8,5,6,0) 78%, rgba(8,5,6,0.62) 100%)`,
          }}
        />

        {/* 符咒落定时的朱砂火星 */}
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10}}>
          {ofuda.map((slot, index) => {
            const age = time - slot.revealAt;
            if (age < 0 || age > 0.5) return null;
            const p = age / 0.5;
            return Array.from({length: 7}, (_, spark) => {
              const angle = (spark / 7) * Math.PI * 2;
              const distance = 40 + p * (110 + spark * 14);
              return (
                <circle
                  key={`${slot.id}-spark-${spark}`}
                  cx={f(slot.x + Math.cos(angle) * distance)}
                  cy={f(slot.y + Math.sin(angle) * distance * 0.82)}
                  r={f(1.6 + (spark % 3) * 1.4)}
                  fill={spark % 3 === 0 ? SENBON.paper : index % 2 === 0 ? SENBON.gold : SENBON.cinnabar}
                  opacity={(1 - p) * 0.9}
                />
              );
            });
          })}
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export default MountainCleft;
