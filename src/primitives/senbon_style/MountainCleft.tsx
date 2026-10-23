import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {ComplexOfudaTalisman} from './ComplexOfudaTalisman';
import {IronChain} from './IronChain';
import {InkSpecks} from './PaperStage';
import {SENBON, clamp01, easeOutCubic, f} from './style';

/**
 * `<MountainCleft />` —— V7 的 Sub3A/3B：满屏五指山巨岩 + X 形铁索网。
 *
 * V6 的“窗帘山”只有顶部一条薄棕色多边形，大圣像跪在空旷渐变里举着一根
 * 晾衣绳。V7：
 *   · 背景换成生图网关的 2K 木刻 `five_finger_mountain_woodblock.png`，
 *     左右与顶部 75% 都是刻满金色梵文的巨岩，只在下方留一道暖金裂谷；
 *   · 铁索全部前置到角色之前（背景层），改成大倾角 X 网，不再穿过手掌；
 *   · 删除左下角灰色小字幕“五指山下 · 偿自由的罪”。
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

export const MountainCleft: React.FC<MountainCleftProps> = ({
  time,
  start,
  end,
  kneelAt,
  chains,
  ofuda = [],
  pulse = 0,
}) => {
  const local = time - start;
  const kneel = clamp01((time - (kneelAt - 0.2)) / 0.26);
  const lightPulse = 0.88 + Math.sin(local * 3.1) * 0.05 + pulse * 0.12;
  const zoom = 1.035 - 0.035 * clamp01(local / 2.2);

  return (
    <AbsoluteFill style={{backgroundColor: '#080506', overflow: 'hidden'}}>
      <Img
        src={staticFile(CLIMAX_ASSETS.mountain.file)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: '50% 48%',
          transform: `scale(${f(zoom)})`,
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

      {/* 背景层铁索：大倾角 X 网，全部在角色之后，不再穿过手掌 */}
      {chains.map((chain) => {
        const progress = clamp01((time - chain.arriveAt) / 0.22);
        if (progress <= 0) return null;
        return (
          <svg
            key={chain.id}
            viewBox="0 0 1920 1080"
            width="1920"
            height="1080"
            style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.92}}
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

      {/* 大圣：跪撑在裂谷底部 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${f((1 - easeOutCubic(kneel)) * 100)}% 0 0 0)`,
        }}
      >
        <ClimaxAsset asset="trapped" height={760} x={830} baseline={1092} echo={0.2} rim={0.2} rotate={Math.sin(local * 1.6) * 0.35} />
      </div>

      {/* 六张复合符咒：钉在 X 网交汇处 */}
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

      <InkSpecks count={28} seed={8555} time={time} color="#F5E6C8" spread={0.55} />

      {/* 上下压边，给符咒与角色留局部对比 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(8,5,6,0.55) 0%, rgba(8,5,6,0) 18%, rgba(8,5,6,0) 78%, rgba(8,5,6,0.62) 100%)`,
        }}
      />

      {/* 符咒落定时的朱砂火星 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
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
