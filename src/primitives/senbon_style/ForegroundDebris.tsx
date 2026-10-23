import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, easeOutCubic, f} from './style';

/**
 * `<ForegroundDebris />` —— V8 的 2B 镜头冲击层：让碎石**贴着镜头**飞过去。
 *
 * V8 第一版把 13 块碎片做到 136px × 3.6 倍，结果满屏都是"霓虹金边六边形"，
 * 把 3D 崩裂和大圣全遮住了。第二版收紧为：
 *   · 18 块 7–49px 的不规则黑岩，最大放大 2.1 倍，金边只作为 1px 受光；
 *   · 只有 4 块带运动模糊，避免整屏发虚；
 *   · 速度线 / 冲击波保留，但透明度降一档。
 *
 * 全部屏幕空间绘制，不参与 WebGL，也不会拖慢三维渲染。
 */

export interface ForegroundDebrisProps {
  time: number;
  at: number;
  /** 持续秒数，默认 0.62。 */
  duration?: number;
}

interface Shard {
  angle: number;
  distance: number;
  size: number;
  spin: number;
  delay: number;
  tone: number;
  blur: boolean;
}

export const ForegroundDebris: React.FC<ForegroundDebrisProps> = ({time, at, duration = 0.62}) => {
  const local = time - at;
  if (local < 0 || local > duration) return null;
  const age = local / duration;

  const shards = useMemo<Shard[]>(
    () =>
      Array.from({length: 18}, (_, index) => ({
        angle: hash(5900, index) * Math.PI * 2,
        distance: 170 + hash(5901, index) * 430,
        size: 7 + hash(5902, index) ** 1.8 * 42,
        spin: (hash(5903, index) - 0.5) * 720,
        delay: hash(5904, index) * 0.18,
        tone: index % 4,
        blur: index % 5 === 0,
      })),
    [],
  );

  const streaks = useMemo(
    () =>
      Array.from({length: 18}, (_, index) => ({
        angle: hash(5950, index) * Math.PI * 2,
        inner: 240 + hash(5951, index) * 240,
        outer: 680 + hash(5952, index) * 380,
        width: 0.8 + hash(5953, index) * 2.6,
        tone: index % 4,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 55, overflow: 'hidden'}}>
      {/* 速度线 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity: (1 - age) * 0.4, mixBlendMode: 'screen'}}>
        {streaks.map((streak, index) => {
          const grow = easeOutCubic(clamp01(age * 2.4));
          return (
            <line
              key={`streak-${index}`}
              x1={f(960 + Math.cos(streak.angle) * streak.inner)}
              y1={f(540 + Math.sin(streak.angle) * streak.inner * 0.78)}
              x2={f(960 + Math.cos(streak.angle) * (streak.inner + (streak.outer - streak.inner) * grow))}
              y2={f(540 + Math.sin(streak.angle) * (streak.inner + (streak.outer - streak.inner) * grow) * 0.78)}
              stroke={streak.tone === 0 ? '#FFF7DA' : streak.tone === 1 ? '#F5C242' : streak.tone === 2 ? '#C8281E' : '#F4EFE6'}
              strokeWidth={f(streak.width)}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* 碎石：屏幕空间假透视，越靠外越大 */}
      {shards.map((shard, index) => {
        const shardAge = clamp01((age - shard.delay) / (1 - shard.delay));
        const eased = easeOutCubic(shardAge);
        const distance = shard.distance + eased * (350 + shard.distance * 0.5);
        const x = 960 + Math.cos(shard.angle) * distance;
        const y = 540 + Math.sin(shard.angle) * distance * 0.78;
        const scale = 1 + eased * 2.1;
        const opacity = clamp01(1 - shardAge * 1.18);
        const size = shard.size;
        const colour = shard.tone === 0 ? '#0B090A' : shard.tone === 1 ? '#171214' : shard.tone === 2 ? '#2A1A16' : '#120D14';
        return (
          <div
            key={`shard-${index}`}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              transform: `rotate(${f(shard.spin * eased)}deg) scale(${f(scale)})`,
              opacity,
              filter: shard.blur ? 'blur(1.4px)' : undefined,
            }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <path d="M 4 28 L 38 5 L 82 14 L 96 48 L 72 92 L 26 86 L 8 58 Z" fill={colour} stroke="#3A2A16" strokeWidth="2.2" />
              <path d="M 4 28 L 38 5 L 46 41 L 18 54 Z" fill="rgba(255,243,209,0.1)" />
              <path d="M 96 48 L 72 92 L 60 60 L 84 44 Z" fill="rgba(200,40,30,0.28)" />
              <path d="M 38 5 L 82 14" fill="none" stroke="rgba(245,194,66,0.55)" strokeWidth="1.2" />
              <path d="M 18 54 L 46 41 L 60 60 L 26 86" fill="none" stroke="rgba(245,194,66,0.22)" strokeWidth="1" />
            </svg>
          </div>
        );
      })}

      {/* 三道横向冲击波残影 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity: (1 - age) * 0.3, mixBlendMode: 'screen'}}>
        {[0, 1, 2].map((index) => {
          const radius = 120 + easeOutCubic(clamp01(age * 1.4)) * (640 + index * 150);
          return (
            <ellipse
              key={`shock-${index}`}
              cx="960"
              cy="540"
              rx={f(radius)}
              ry={f(radius * 0.52)}
              fill="none"
              stroke={index === 2 ? '#C8281E' : '#F5C242'}
              strokeWidth={f(6 - index * 1.5)}
              opacity={0.6 - index * 0.14}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default ForegroundDebris;
