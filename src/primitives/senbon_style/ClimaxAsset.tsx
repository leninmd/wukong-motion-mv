import React from 'react';
import {Img, staticFile} from 'remotion';
import {WASHI} from './PaperStage';

/**
 * `<ClimaxAsset />` —— 真实造型资产的唯一入口。
 *
 * V5 起，孙悟空不再由代码画：所有形象来自 `public/wukong_assets/` 里由
 * `scripts/build_wukong_assets.py` 烘焙出来的真实素材（参考片帧的木刻套色、
 * 立绘抠底后的纯黑剪影）。本组件只负责摆放、翻转、残影和逆光边缘。
 *
 * 残影（Echo Trail）复刻《千本樱》00:28：朱砂 / 青 / 金三层，用 CSS mask
 * 把同一张剪影染成三色后错位叠加，**不再给剪影描荧光线**。
 */

export interface ClimaxAssetInfo {
  file: string;
  width: number;
  height: number;
  kind: 'silhouette' | 'print';
}

export const CLIMAX_ASSETS = {
  spin: {file: 'wukong_assets/silhouette_spin_staff.png', width: 1049, height: 1500, kind: 'silhouette'},
  slash: {file: 'wukong_assets/silhouette_side_slash.png', width: 1830, height: 1500, kind: 'silhouette'},
  trapped: {file: 'wukong_assets/silhouette_trapped.png', width: 1062, height: 1500, kind: 'silhouette'},
  raise: {file: 'wukong_assets/silhouette_raise_staff.png', width: 1215, height: 1500, kind: 'silhouette'},
  spinColour: {file: 'wukong_assets/colour_spin_staff.png', width: 1049, height: 1500, kind: 'print'},
  slashColour: {file: 'wukong_assets/colour_side_slash.png', width: 1830, height: 1500, kind: 'print'},
  trappedColour: {file: 'wukong_assets/colour_trapped.png', width: 1062, height: 1500, kind: 'print'},
  raiseColour: {file: 'wukong_assets/colour_raise_staff.png', width: 1215, height: 1500, kind: 'print'},
  face: {file: 'wukong_assets/face_glare_woodblock.png', width: 1280, height: 1200, kind: 'print'},
  eyes: {file: 'wukong_assets/eyes_closeup_woodblock.png', width: 1920, height: 660, kind: 'print'},
  trappedPrint: {file: 'wukong_assets/trapped_print.png', width: 1400, height: 900, kind: 'print'},
} as const satisfies Record<string, ClimaxAssetInfo>;

export type ClimaxAssetKey = keyof typeof CLIMAX_ASSETS;

export interface ClimaxAssetProps {
  asset: ClimaxAssetKey;
  /** 目标高度（px）；宽度按原图比例推。 */
  height: number;
  /** 剪影中心 X（px）。 */
  x: number;
  /** 底边 Y（px）。 */
  baseline: number;
  /** 0–1：朱砂 / 青 / 金三层错位残影强度。 */
  echo?: number;
  /** 整体倾角（度）。 */
  rotate?: number;
  opacity?: number;
  flip?: boolean;
  /** 逆光边缘：极细的宣纸色光，不是荧光描边。 */
  rim?: number;
  zIndex?: number;
  /** 染色（把剪影整体染成某色，用于黑底上的反白剪影）。 */
  tint?: string;
  style?: React.CSSProperties;
}

const ECHO_LAYERS: Array<{color: string; dx: number; dy: number; scale: number}> = [
  {color: WASHI.cinnabar, dx: -16, dy: 4, scale: 1.006},
  {color: '#2E5F63', dx: 14, dy: -5, scale: 0.995},
  {color: WASHI.ochre, dx: -7, dy: -9, scale: 1.0},
];

export const ClimaxAsset: React.FC<ClimaxAssetProps> = ({
  asset,
  height,
  x,
  baseline,
  echo = 0,
  rotate = 0,
  opacity = 1,
  flip = false,
  rim = 0,
  zIndex = 1,
  tint,
  style,
}) => {
  const info = CLIMAX_ASSETS[asset];
  const width = (info.width / info.height) * height;
  const src = staticFile(info.file);
  const left = x - width / 2;
  const top = baseline - height;
  const transform = `${flip ? 'scaleX(-1)' : ''} rotate(${rotate}deg)`;

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        transform,
        transformOrigin: '50% 100%',
        opacity,
        zIndex,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {echo > 0.01
        ? ECHO_LAYERS.map((layer, index) => (
            <div
              key={`echo-${index}`}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: layer.color,
                opacity: echo * (index === 0 ? 0.55 : index === 1 ? 0.4 : 0.32),
                transform: `translate(${layer.dx * echo}px, ${layer.dy * echo}px) scale(${layer.scale})`,
                transformOrigin: '50% 100%',
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                mixBlendMode: 'multiply',
              }}
            />
          ))
        : null}

      {tint ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: tint,
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        />
      ) : (
        <Img
          src={src}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            filter: rim > 0 ? `drop-shadow(0 0 ${2 + rim * 3}px rgba(244,236,214,${0.35 + rim * 0.4}))` : undefined,
          }}
        />
      )}
    </div>
  );
};
