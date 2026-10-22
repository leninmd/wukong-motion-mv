import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, ease, hash} from '../utils/math';

export interface PlateProps {
  /** File name inside public/ai/. */
  file: string;
  /** Seconds the shot starts (drives the camera push). */
  startSeconds: number;
  /** Shot length in seconds. */
  durationSeconds: number;
  /** Push-in amount over the shot (1 = none). */
  push?: number;
  /** Lateral drift in px over the shot. */
  panX?: number;
  /** Vertical drift in px over the shot. */
  panY?: number;
  /** Slow float so the plate never sits still. */
  float?: number;
  /** Grade strength 0–1. */
  grade?: number;
  /** 0–1 drum accent. */
  pulse?: number;
  opacity?: number;
  /** Optional parallax offset direction for foreground plates. */
  parallax?: number;
}

/**
 * AI 美术板合成层.
 *
 * 板负责"画得像画"，这一层负责"像镜头"：推轨 / 横移 / 呼吸式浮动 / 调色 / 暗角。
 * 板缺失时返回 null，场景自动回落到纯代码底。
 *
 * 板的规格见 assets.manifest.json 与 public/ai/README.md（1920×1080 PNG，必要时带 alpha）。
 */
export const Plate: React.FC<PlateProps> = ({
  file,
  startSeconds,
  durationSeconds,
  push = 1.12,
  panX = 0,
  panY = 0,
  float = 6,
  grade = 1,
  pulse = 0,
  opacity = 1,
  parallax = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = clamp((frame / fps - startSeconds) / Math.max(0.001, durationSeconds));
  const eased = ease.outCubic(local);
  const scale = 1 + (push - 1) * eased + pulse * 0.006;
  const x = panX * eased + Math.sin(local * Math.PI * 1.2) * float + parallax;
  const y = panY * eased + Math.cos(local * Math.PI * 0.9) * float * 0.6;

  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity, backgroundColor: '#0B090A'}}>
      <Img
        src={staticFile(`ai/${file}`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(4)})`,
          filter: `contrast(${(1 + 0.06 * grade).toFixed(3)}) saturate(${(1 + 0.04 * grade).toFixed(3)})`,
        }}
      />
      {/* 统一色调：把 AI 板压回四色体系 */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(11,9,10,0.42) 0%, rgba(11,9,10,0.08) 34%, rgba(217,48,37,0.1) 72%, rgba(11,9,10,0.72) 100%)',
          mixBlendMode: 'multiply',
          opacity: grade,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 62% 52% at 50% 42%, rgba(252,201,52,0.1) 0%, rgba(11,9,10,0) 62%)',
          mixBlendMode: 'screen',
          opacity: grade,
        }}
      />
      {/* 极轻的印刷颗粒，和代码层的网点对齐 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(rgba(244,239,230,0.06) 0.6px, transparent 0.7px)',
          backgroundSize: '5px 5px',
          mixBlendMode: 'screen',
          opacity: 0.5 * grade,
        }}
      />
    </AbsoluteFill>
  );
};

void hash;
