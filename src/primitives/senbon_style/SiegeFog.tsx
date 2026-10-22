import React, {useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {hash} from '../../utils/math';
import {blob} from './geometry';
import {SENBON, f} from './style';

/**
 * Shot 1 中段：翻涌的多层浓雾 + 前景虚焦天兵。
 *
 * - 三层云雾（远 / 中 / 近）横向漂移，越近越快、越暗，制造合围的推进感。
 * - 前景左右各一组巨大天兵头盔与长戈，`blur(6px)` 虚焦掠过画面边缘，
 *   复刻原视频 00:10 的十面埋伏景深。
 */

export interface SiegeFogProps {
  time: number;
  /** 0–1：合围压迫值，推动云雾向内收并加快。 */
  pressure: number;
  pulse?: number;
  /** 'clouds' 只画雾层（垫在角色之后），'foreground' 只画虚焦天兵（压在角色之前）。 */
  part?: 'clouds' | 'foreground';
}

interface CloudShape {
  id: string;
  shape: string;
  seed: number;
}

const makeCloud = (seed: number): string => {
  const count = 7 + Math.floor(hash(seed, 0) * 4);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = 92 + hash(seed, index + 1) * 78;
    points.push({
      x: Math.cos(angle) * radius * 1.6,
      y: Math.sin(angle) * radius * 0.52,
    });
  }
  return blob(points, 0.6);
};

const LAYERS = [
  {id: 'far', baseline: 760, speed: 26, scale: 1.15, count: 9, spacing: 360, opacity: 0.4, tone: '#2A2024', blur: 0},
  {id: 'mid', baseline: 880, speed: 54, scale: 1.5, count: 8, spacing: 420, opacity: 0.62, tone: '#1A1416', blur: 0.6},
  {id: 'near', baseline: 1000, speed: 96, scale: 2.1, count: 7, spacing: 480, opacity: 0.85, tone: '#0F0B0C', blur: 1.6},
] as const;

export const SiegeFog: React.FC<SiegeFogProps> = ({time, pressure, pulse = 0, part = 'clouds'}) => {
  const {width, height} = useVideoConfig();
  const rush = 1 + pressure * 1.5;

  const layers = useMemo(
    () =>
      LAYERS.map((layer, layerIndex) => ({
        ...layer,
        clouds: Array.from({length: layer.count}, (_, index) => ({
          id: `${layer.id}-${index}`,
          shape: makeCloud(9100 + layerIndex * 71 + index),
          seed: index,
        })),
      })),
    [],
  );

  if (part === 'foreground') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
        <ForegroundSiege time={time} pressure={pressure} width={width} height={height} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {layers.map((layer, layerIndex) => {
        const wrap = layer.spacing * layer.count;
        return (
          <svg
            key={layer.id}
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            style={{position: 'absolute', inset: 0, filter: layer.blur > 0 ? `blur(${layer.blur}px)` : undefined}}
          >
            <g opacity={layer.opacity}>
              {layer.clouds.map((cloud) => {
                const drift = (time * layer.speed * rush + cloud.seed * layer.spacing) % wrap;
                const x = drift - layer.spacing;
                const y =
                  layer.baseline -
                  pressure * (layerIndex === 2 ? 150 : layerIndex === 1 ? 96 : 60) +
                  Math.sin(time * 0.9 + cloud.seed * 1.7) * (10 + layerIndex * 8);
                return (
                  <g key={cloud.id} transform={`translate(${f(x)} ${f(y)}) scale(${f(layer.scale)})`}>
                    <path
                      d={cloud.shape}
                      fill={layer.tone}
                      stroke={SENBON.gold}
                      strokeOpacity={0.1 + layerIndex * 0.05 + pulse * 0.06}
                      strokeWidth={layerIndex === 2 ? 3.4 : 2}
                    />
                    <path
                      d={cloud.shape}
                      fill="none"
                      stroke={SENBON.paper}
                      strokeOpacity={0.05}
                      strokeWidth={1.2}
                      transform="translate(0 -6)"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        );
      })}

      {/* 底部镇场的墨黑带 */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(11,9,10,0) 58%, rgba(11,9,10,${0.5 + pressure * 0.2}) 84%, ${SENBON.ink} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** 前景虚焦天兵：巨大头盔 + 长戈，从两侧边缘高速掠过。 */
const ForegroundSiege: React.FC<{
  time: number;
  pressure: number;
  width: number;
  height: number;
}> = ({time, pressure, width, height}) => {
  const passes = [
    {side: -1, phase: 0, y: 0.82, scale: 2.6, blur: 7, opacity: 0.72},
    {side: -1, phase: 0.55, y: 0.3, scale: 1.9, blur: 6, opacity: 0.5},
    {side: 1, phase: 0.28, y: 0.88, scale: 2.9, blur: 7, opacity: 0.66},
    {side: 1, phase: 0.78, y: 0.34, scale: 2.1, blur: 6, opacity: 0.46},
  ];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {passes.map((pass, index) => {
        const cycle = (time * (0.5 + pressure * 0.6) + pass.phase) % 1;
        const enter = cycle < 0.74 ? cycle / 0.74 : (1 - cycle) / 0.26;
        const depth = Math.sin(Math.PI * Math.min(1, Math.max(0, enter)));
        const x = pass.side === -1 ? -240 + depth * 340 : width + 240 - depth * 340;
        const y = height * pass.y + Math.sin(cycle * Math.PI * 2) * 22;
        const scale = pass.scale * (0.72 + depth * 0.4);
        return (
          <svg
            key={`fg-${index}`}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{
              position: 'absolute',
              inset: 0,
              filter: `blur(${pass.blur}px)`,
              opacity: pass.opacity * depth,
            }}
          >
            <g transform={`translate(${f(x)} ${f(y)}) scale(${f(scale * (pass.side === -1 ? 1 : -1))})`}>
              {/* 长戈 */}
              <rect
                x={-26}
                y={-360}
                width={9}
                height={520}
                fill={SENBON.ink}
                stroke={SENBON.silverDim}
                strokeOpacity={0.5}
                strokeWidth={2}
              />
              <polygon points="4,-404 -18,-344 4,-356 26,-346" fill={SENBON.silver} opacity={0.35} />
              {/* 盔顶 */}
              <polygon
                points="-84,0 84,0 96,44 66,86 -66,86 -96,44"
                fill={SENBON.ink}
                stroke={SENBON.gold}
                strokeOpacity={0.34}
                strokeWidth={2}
              />
              {/* 顿项（护颈） */}
              <polygon points="-92,70 92,70 116,140 -116,140" fill={SENBON.inkEdge} />
              <polygon
                points="-104,96 104,96 112,124 -112,124"
                fill="none"
                stroke={SENBON.gold}
                strokeOpacity={0.24}
                strokeWidth={2}
              />
              {/* 面甲 */}
              <polygon points="-70,16 70,16 58,64 -58,64" fill={SENBON.cinnabarDeep} opacity={0.55} />
              <line x1={-58} y1={42} x2={58} y2={42} stroke={SENBON.gold} strokeOpacity={0.3} strokeWidth={3} />
              {/* 盔缨 */}
              <polygon points="-10,-4 -2,-88 22,-6" fill={SENBON.cinnabar} opacity={0.6} />
            </g>
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

export default SiegeFog;
