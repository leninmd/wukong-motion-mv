import React from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {ClimaxAsset} from './ClimaxAsset';
import {ComplexOfudaTalisman} from './ComplexOfudaTalisman';
import {IronChain} from './IronChain';
import {InkSpecks} from './PaperStage';
import {SERIF_STACK, SENBON, clamp01, easeOutCubic, f, overshoot} from './style';

/**
 * `<MountainCleft />` —— Sub3A / 3B：五指山下的明暗裂谷。
 *
 * 复刻《千本樱》00:17 的上下明暗分割 + 01:06 的铁笼：
 *   · 上半屏压着一整块纯黑山体，底部是被砸碎的不规则下沿；
 *   · 山体下缘与地面之间裂开一道暖白缺口，光从缺口里涌出来；
 *   · 大圣的真实跪撑剪影跪在这片光里，被逆光咬出边缘；
 *   · 前景铁索交叉锁死岩壁，六张五层复合符咒钉在两侧山体上。
 *
 * 岩石是 #0E0A0B，靠**朝光下沿的一线赭金**读体积；人物用自下而上的擦除
 * 入场，避免半透明时发灰。
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
}

const ROCK = '#0E0A0B';
const ROCK_EDGE = '#8A5A2E';

const ridgeY = (x: number, seedOffset = 0): number => {
  const centre = Math.exp(-((x - 960) ** 2) / (2 * 330 ** 2));
  const wobble = (hash(9100 + seedOffset, Math.round(x / 24)) - 0.5) * 46;
  return 470 - centre * 150 + wobble;
};

/** 山体：铺满顶部，下沿中间掏空（压在他头顶上方）。 */
const mountainPath = (): string => {
  const pts: Array<[number, number]> = [
    [-60, -60],
    [1980, -60],
    [1980, 480],
  ];
  for (let x = 1980; x >= -60; x -= 110) {
    pts.push([x, ridgeY(x)]);
  }
  pts.push([-60, -60]);
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p[0])} ${f(p[1])}`).join(' ') + ' Z';
};

/** 下沿受光边线。 */
const edgePath = (): string => {
  const pts: Array<[number, number]> = [];
  for (let x = 1980; x >= -60; x -= 55) {
    pts.push([x, ridgeY(x)]);
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p[0])} ${f(p[1])}`).join(' ');
};

export const MountainCleft: React.FC<MountainCleftProps> = ({
  time,
  start,
  end,
  rockDrops,
  kneelAt,
  chains,
  ofuda = [],
  pulse = 0,
}) => {
  const local = time - start;
  const width = 1920;
  const height = 1080;

  const kneel = clamp01((time - (kneelAt - 0.2)) / 0.26);
  const lightPulse = 0.88 + Math.sin(local * 3.1) * 0.05 + pulse * 0.12;
  // 山体在切镜前就开始落下：切进来时必须已经压在头顶，不能出现空镜
  const mountainDrop = overshoot(clamp01((time - ((rockDrops[0] ?? start) - 0.42)) / 0.3), 11, 7);
  const mountainY = -460 * (1 - mountainDrop);

  return (
    <AbsoluteFill style={{backgroundColor: '#0A0708', overflow: 'hidden'}}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id="cave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4A2418" />
            <stop offset="34%" stopColor="#7A4527" />
            <stop offset="66%" stopColor="#C08A50" />
            <stop offset="100%" stopColor="#F3CE96" />
          </linearGradient>
          <linearGradient id="rift" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#FFFDF3" />
            <stop offset="60%" stopColor="#F6E3BE" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C08E58" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={width} height={height} fill="url(#cave)" />
        <ellipse cx={960} cy={880} rx={520} ry={330} fill="#FFD79B" opacity={0.3 * lightPulse} />

        {Array.from({length: 44}, (_, index) => {
          const x = 320 + hash(8400, index) * 1280;
          const y = (hash(8401, index) * 1080 + local * (22 + (index % 5) * 14)) % 1080;
          return (
            <circle
              key={`mote-${index}`}
              cx={f(x + Math.sin(local + index) * 14)}
              cy={f(y)}
              r={f(0.9 + (index % 3) * 1.2)}
              fill="#FFF4D8"
              opacity={0.22 + (index % 4) * 0.1}
            />
          );
        })}
      </svg>

      {/* 大圣：跪撑，逆光。自下而上擦除入场 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${f((1 - easeOutCubic(kneel)) * 100)}% 0 0 0)`,
        }}
      >
        <ClimaxAsset
          asset="trapped"
          height={724}
          x={764}
          baseline={1082}
          echo={0.16}
          rim={0.18}
          rotate={Math.sin(local * 1.6) * 0.4}
        />
      </div>

      {/* 山体 */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
      >
        <g transform={`translate(0 ${f(mountainY)})`}>
          <path d={mountainPath()} fill={ROCK} />
          <path d={edgePath()} fill="none" stroke={ROCK_EDGE} strokeWidth={3} opacity={0.6} />
          <path d={edgePath()} fill="none" stroke="#D8A15C" strokeWidth={1.3} opacity={0.42} />
          {Array.from({length: 46}, (_, index) => {
            const x = hash(9200, index) * 1920;
            const y = hash(9201, index) * 400;
            const len = 40 + hash(9202, index) * 150;
            return (
              <line
                key={`cun-${index}`}
                x1={f(x)}
                y1={f(y)}
                x2={f(x + len * 0.4)}
                y2={f(y + len)}
                stroke="#3B2C29"
                strokeWidth={1.5}
                opacity={0.75}
              />
            );
          })}
        </g>
      </svg>

      <InkSpecks count={30} seed={8555} time={time} color="#F5E6C8" spread={0.6} />

      {/* 铁索 */}
      {chains.map((chain) => {
        const progress = clamp01((time - chain.arriveAt) / 0.2);
        if (progress <= 0) return null;
        return (
          <svg
            key={chain.id}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}
          >
            <IronChain
              x1={chain.x1}
              y1={chain.y1}
              x2={chain.x2}
              y2={chain.y2}
              sag={chain.sag}
              progress={progress}
              linkLen={24}
              glow={0.12}
              runeText=""
              runeStep={9}
            />
          </svg>
        );
      })}

      {/* 六张复合符咒 */}
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
            style={{left: slot.x - slot.width / 2, top: slot.y - slot.height / 2}}
          />
        );
      })}

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(9,6,7,0.9) 0%, rgba(9,6,7,0) 26%, rgba(9,6,7,0) 74%, rgba(9,6,7,0.6) 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 92,
          bottom: 52,
          textAlign: 'left',
          fontFamily: SERIF_STACK,
          fontSize: 25,
          letterSpacing: 14,
          color: '#E8D9BC',
          opacity: 0.7 * kneel,
        }}
      >
        五指山下 · 偿自由的罪
      </div>

      {/* 符咒落定时的朱砂火星 */}
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
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

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: '#080507',
          opacity: Math.max(0, clamp01((time - (end - 0.2)) / 0.2)) * 0.85,
        }}
      />
    </AbsoluteFill>
  );
};

export default MountainCleft;
