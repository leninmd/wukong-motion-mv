import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';

/**
 * `<BlenderPlate />` —— Blender 离线烘焙视频的合成入口。
 *
 * 铁律（AGENTS.md §4）：复杂 3D、碎裂、铁索、粒子一律在 Blender 里离线渲染，
 * Remotion 运行时只做解码与摆放，不在浏览器里跑 WebGL 物理。
 *
 * 两种资产：
 *  · `alpha` = true  → ProRes 4444 `.mov`（yuva444p12le），带真 Alpha，
 *    用 `<OffthreadVideo transparent />` 叠在立绘/场景之上；
 *  · `alpha` = false → H.264 `.mp4`（不透明），作为整屏底片。
 *
 * 编码说明：本机 ffmpeg 7.1 的 webm muxer 会丢弃 VP9 alpha（实测
 * yuva420p → yuv420p），所以透明通道走 ProRes；`.webm` 同名文件保留给
 * 剪辑软件归档。这一条已登记在 docs/EXPLORATION_LOG.md。
 */
export interface BlenderPlateProps {
  /** 文件名，位于 public/blender_renders/，例如 `b_shot2_lingxiao_collapse.mp4`。 */
  file: string;
  /** 是否需要透明通道（.mov）。 */
  alpha?: boolean;
  opacity?: number;
  blendMode?: React.CSSProperties['mixBlendMode'];
  fit?: 'cover' | 'contain';
  /** 从第几帧开始播放（仅当需要跳帧时使用）。 */
  startFrom?: number;
  style?: React.CSSProperties;
}

export const BlenderPlate: React.FC<BlenderPlateProps> = ({
  file,
  alpha = false,
  opacity = 1,
  blendMode,
  fit = 'cover',
  startFrom,
  style,
}) => (
  <OffthreadVideo
    src={staticFile(`blender_renders/${file}`)}
    muted
    transparent={alpha}
    startFrom={startFrom}
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: fit,
      opacity,
      mixBlendMode: blendMode,
      pointerEvents: 'none',
      ...style,
    }}
  />
);

export default BlenderPlate;
