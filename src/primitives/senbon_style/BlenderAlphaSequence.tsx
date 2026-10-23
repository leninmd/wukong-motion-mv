import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';

/**
 * `<BlenderAlphaSequence />` —— Blender 透明镜头的逐帧位图（无损 WebP）合成入口。
 *
 * 为什么不是 `<OffthreadVideo transparent />`：
 *   本机 ffmpeg 7.1 的 webm muxer 会丢 VP8/VP9 的 alpha（yuva420p → yuv420p，
 *   实测），ProRes 4444 虽然写出 yuva444p12le，但 Remotion 合成器解出来是噪点。
 *   逐帧位图是唯一能保真传递 alpha 的通道：无损、逐帧确定、不受解码器差异影响。
 *   Blender 直出 PNG RGBA（`out/blender_frames/`，gitignore），落库前用 PIL 转
 *   **无损 WebP**（像素完全一致，体积 ≈1/3），运行时按帧号读 `.webp`。
 *   代价是素材体积（1B 45 帧 ≈ 12 MB、3A 75 帧 ≈ 57 MB），只用于这两段短镜头；
 *   整屏不透明镜头（2B/4A/4B）仍然走 `<OffthreadVideo />` + `.mp4`。
 *
 * 帧号规则：`from` 是这段素材第 1 帧对应的 Composition 帧；
 * 文件名固定 `s1_0001.webp … s1_0045.webp`（Blender 的 `frame_start=1`）。
 */
export interface BlenderAlphaSequenceProps {
  /** public/blender_renders/ 下的子目录，例如 `shot1_frames`。 */
  dir: string;
  /** 文件名前缀，例如 `s1`。 */
  prefix: string;
  /** Composition 帧号：素材第 1 帧从这一帧开始播。 */
  from: number;
  /** 素材总帧数。 */
  length: number;
  fit?: 'cover' | 'contain';
  style?: React.CSSProperties;
}

export const BlenderAlphaSequence: React.FC<BlenderAlphaSequenceProps> = ({
  dir,
  prefix,
  from,
  length,
  fit = 'cover',
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0 || local >= length) return null;
  const index = String(local + 1).padStart(4, '0');
  return (
    <Img
      src={staticFile(`blender_renders/${dir}/${prefix}_${index}.webp`)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: fit,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};

export default BlenderAlphaSequence;
