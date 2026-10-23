import React from 'react';
import {Img, staticFile} from 'remotion';
import {WASHI} from './PaperStage';

/**
 * `<ClimaxAsset />` —— 真实造型资产的唯一入口（V6）。
 *
 * V5 的剪影是「纯 #120D14 填死」，内部铠甲/五官/披风 100% 丢失；V5 的 colour
 * 版本又保留了生图自带的白色贴纸边。V6 起四个姿态统一换成
 * `scripts/build_wukong_assets.py` 烘焙出来的**黑金朱砂四色套版木刻**：
 *
 *   · 外轮廓 = rembg 抠底 + 白边剥离 + erode，边界恒为 #120D14 墨线；
 *   · 内部 = 鎏金甲胄线 #F5C242、朱砂披风 #C8281E、宣纸留白 #EAE0CE。
 *
 * 运行期只做“摆放 / 翻转 / 残影 / 逆光”，不再给剪影描荧光边。
 */

export interface ClimaxAssetInfo {
  file: string;
  width: number;
  height: number;
  kind: 'woodblock' | 'print';
}

export const CLIMAX_ASSETS = {
  spin: {file: 'wukong_assets/woodblock_spin.png', width: 1240, height: 1800, kind: 'woodblock'},
  charge: {file: 'wukong_assets/woodblock_charge.png', width: 1355, height: 1800, kind: 'woodblock'},
  slash: {file: 'wukong_assets/woodblock_slash.png', width: 1876, height: 2048, kind: 'woodblock'},
  trapped: {file: 'wukong_assets/woodblock_trapped.png', width: 1239, height: 1800, kind: 'woodblock'},
  raise: {file: 'wukong_assets/woodblock_raise.png', width: 1463, height: 1800, kind: 'woodblock'},
  panel4: {file: 'wukong_assets/woodblock_panel4.png', width: 1355, height: 1800, kind: 'woodblock'},
  face: {file: 'wukong_assets/face_glare_woodblock.png', width: 2048, height: 2048, kind: 'print'},
  eyes: {file: 'wukong_assets/eyes_closeup_woodblock.png', width: 2200, height: 356, kind: 'print'},
  gate: {file: 'wukong_assets/gate_woodblock.png', width: 1400, height: 2087, kind: 'print'},
  palace: {file: 'wukong_assets/palace_woodblock.png', width: 1400, height: 2100, kind: 'print'},
  army: {file: 'wukong_assets/army_silhouette.png', width: 2390, height: 1102, kind: 'print'},
  halberds: {file: 'wukong_assets/halberds_woodblock.png', width: 1400, height: 2110, kind: 'print'},
  mountain: {file: 'wukong_assets/five_finger_mountain_woodblock.png', width: 2048, height: 1130, kind: 'print'},
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
  /** 染色（把角色整体染成某色，用于黑底上的反白剪影）。 */
  tint?: string;
  style?: React.CSSProperties;
}

const ECHO_LAYERS: Array<{color: string; dx: number; dy: number; scale: number}> = [
  {color: WASHI.cinnabar, dx: -14, dy: 4, scale: 1.006},
  {color: '#2E5F63', dx: 12, dy: -5, scale: 0.995},
  {color: WASHI.ochre, dx: -6, dy: -8, scale: 1.0},
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
                opacity: echo * (index === 0 ? 0.42 : index === 1 ? 0.28 : 0.24),
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
            filter: rim > 0 ? `drop-shadow(0 0 ${1 + rim * 2}px rgba(244,236,214,${0.18 + rim * 0.22}))` : undefined,
          }}
        />
      )}
    </div>
  );
};

