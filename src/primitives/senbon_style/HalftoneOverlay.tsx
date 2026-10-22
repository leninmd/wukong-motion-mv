import React, {useId, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {hash} from '../../utils/math';
import {ALPHA, SENBON} from './style';

export interface HalftoneOverlayProps {
  /** 整体不透明度。 */
  opacity?: number;
  /** 光晕中心（画布 px），默认金色满月的位置。 */
  glowX?: number;
  glowY?: number;
  /** 0–1，冲击时网点会短暂变亮、变密。 */
  intensity?: number;
  /** 暗金宣纸噪点的强度。 */
  grain?: number;
  /** 是否叠加暗角。 */
  vignette?: boolean;
  seed?: number;
}

/**
 * 浮世绘半调网点 + 和纸肌理层。
 *
 * 三层都是纯 SVG：
 *  1. `<pattern>` 细网点（宣纸印刷网屏），用径向渐变 mask 做成中心亮、四周收；
 *  2. `<pattern>` 粗网点（烫金箔点），只在光源附近出现；
 *  3. 固定种子生成的纸屑/纤维点阵 pattern（暗金噪点），替代昂贵的 feTurbulence。
 * 所有 pattern 的位移只跟 frame 有关，保证确定性。
 */
export const HalftoneOverlay: React.FC<HalftoneOverlayProps> = ({
  opacity = 1,
  glowX = 960,
  glowY = 420,
  intensity = 0,
  grain = 1,
  vignette = true,
  seed = 20250921,
}) => {
  const frame = useCurrentFrame();
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `ht-${rawId}-${suffix}`;

  const drift = (frame * 0.22) % 16;
  const flicker = 0.86 + Math.sin(frame * 0.11) * 0.06 + intensity * 0.22;

  const flecks = useMemo(
    () =>
      Array.from({length: 190}, (_, index) => ({
        x: hash(seed, index) * 160,
        y: hash(seed + 11, index) * 160,
        r: 0.28 + hash(seed + 23, index) * 0.9,
        alpha: 0.1 + hash(seed + 37, index) * 0.42,
        gold: hash(seed + 51, index) > 0.62,
      })),
    [seed],
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}} aria-hidden="true">
      <svg
        viewBox="0 0 1920 1080"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{position: 'absolute', inset: 0, display: 'block'}}
      >
        <defs>
          <pattern
            id={id('fine')}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(24) translate(${drift.toFixed(2)} ${(drift * 0.62).toFixed(2)})`}
          >
            <circle cx="2" cy="2" r="1.05" fill={SENBON.paper} opacity="0.55" />
            <circle cx="6" cy="6" r="0.72" fill={SENBON.gold} opacity="0.35" />
          </pattern>

          <pattern
            id={id('coarse')}
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(-12) translate(${(drift * 0.4).toFixed(2)} 0)`}
          >
            <circle cx="6" cy="6" r="3.4" fill={SENBON.gold} opacity="0.7" />
            <circle cx="19" cy="19" r="2.1" fill={SENBON.goldDeep} opacity="0.5" />
          </pattern>

          <pattern id={id('grain')} width="160" height="160" patternUnits="userSpaceOnUse">
            {flecks.map((fleck, index) => (
              <circle
                key={`fleck-${index}`}
                cx={fleck.x}
                cy={fleck.y}
                r={fleck.r}
                fill={fleck.gold ? SENBON.gold : SENBON.paperDim}
                opacity={fleck.alpha * 0.5}
              />
            ))}
          </pattern>

          <radialGradient id={id('core')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.goldLight} stopOpacity="0.34" />
            <stop offset="30%" stopColor={SENBON.gold} stopOpacity="0.16" />
            <stop offset="62%" stopColor={SENBON.cinnabar} stopOpacity="0.08" />
            <stop offset="100%" stopColor={SENBON.ink} stopOpacity="0" />
          </radialGradient>

          <radialGradient id={id('edge')} cx="50%" cy="50%" r="72%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="66%" stopColor="#000000" stopOpacity="0.12" />
            <stop offset="88%" stopColor="#000000" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.82" />
          </radialGradient>

          <mask id={id('glowMask')}>
            <rect
              width="1920"
              height="1080"
              fill={`url(#${id('core')})`}
              transform={`translate(${glowX - 960} ${glowY - 540})`}
            />
          </mask>
        </defs>

        {/* 金色光晕：径向渐变，模拟月光穿过纸面。 */}
        <ellipse
          cx={glowX}
          cy={glowY}
          rx={760}
          ry={600}
          fill={`url(#${id('halo')})`}
          opacity={0.18 + intensity * 0.22}
        />

        {/* 细网点：整屏，中心强四周弱，随帧极慢漂移。 */}
        <rect width="1920" height="1080" fill={`url(#${id('fine')})`} opacity={0.12 * flicker} />

        {/* 粗网点：只在光晕附近。 */}
        <rect
          width="1920"
          height="1080"
          fill={`url(#${id('coarse')})`}
          opacity={0.16 * flicker}
          mask={`url(#${id('glowMask')})`}
        />

        {/* 暗金宣纸噪点。 */}
        <rect
          width="1920"
          height="1080"
          fill={`url(#${id('grain')})`}
          opacity={0.28 * grain}
          style={{mixBlendMode: 'soft-light'}}
        />

        {/* 网点光斑：漫画式的一圈环状网点。 */}
        <g opacity={0.35 + intensity * 0.4} mask={`url(#${id('glowMask')})`}>
          {[0, 1, 2].map((ring) => (
            <circle
              key={`ring-${ring}`}
              cx={glowX}
              cy={glowY}
              r={220 + ring * 138}
              fill="none"
              stroke={SENBON.gold}
              strokeWidth={0.7}
              strokeDasharray="2 9"
              opacity={0.5 - ring * 0.12}
            />
          ))}
        </g>

        {/* 暗角。 */}
        {vignette ? (
          <rect width="1920" height="1080" fill={`url(#${id('edge')})`} opacity={0.78} />
        ) : null}
      </svg>

      {/* 和纸纤维：极轻的横向丝缕，用 CSS 渐变而非 canvas，零光栅成本。 */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, ${ALPHA.paper12} 0px, ${ALPHA.paper12} 0.5px, transparent 0.5px, transparent 3.5px)`,
          opacity: 0.08 * grain,
          mixBlendMode: 'soft-light',
        }}
      />
    </AbsoluteFill>
  );
};
