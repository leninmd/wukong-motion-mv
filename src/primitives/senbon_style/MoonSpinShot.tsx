import React, {useMemo} from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Trail} from '@remotion/motion-blur';
import {hash} from '../../utils/math';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {CloudBank, MoonDisc, WASHI} from './PaperStage';
import {SENBON, SERIF_STACK, clamp01, f} from './style';

/**
 * `<MoonSpinShot />` —— Sub1B：满月逆光下的真剪影旋棍。
 *
 * V5 的两个败笔在 V6 被换掉：
 *   1. 右侧的「十万天兵」是一块平移的黑色大方块 → 换成生图网关的
 *      `army_silhouette.png`（2400px，vtracer 矢量化，白底软抠），
 *      兜鍪/长戈/战马/朱砂战旗全部是可读的细节。
 *   2. 棍影是两条 `strokeDasharray` 虚线椭圆 → 换成真正旋转的金箍棒图层，
 *      外面套 `@remotion/motion-blur` 的 `<Trail layers={8} lagInFrames={0.25}>`，
 *      每一层冻结在过去 0.25 帧，形成真实的光学残影。
 *
 * 左上角小得看不见的“十万天兵合围”改成右侧上方的 82px 竖排浓墨大字。
 */

export interface MoonSpinShotProps {
  time: number;
  start: number;
  progress: number;
  pulse?: number;
  high?: number;
}

const HERO_X = 672;
const HERO_BASELINE = 1168;

/** 旋转金箍棒：必须读取 useCurrentFrame，Trail 的 Freeze 才能真正拿到过去帧。 */
const SpinningCudgel: React.FC<{start: number}> = ({start}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;
  const angle = 24 + Math.max(0, time - start) * 470;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: HERO_X,
          top: 620,
          width: 0,
          height: 0,
          transform: `scaleY(0.55) rotate(${f(angle)}deg)`,
          transformOrigin: '0 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -500,
            top: -15,
            width: 1000,
            height: 30,
            borderRadius: 15,
            border: `3px solid ${WASHI.ink}`,
            background: `linear-gradient(90deg, ${SENBON.gold} 0%, ${SENBON.cinnabar} 6%, ${SENBON.gold} 12%, ${SENBON.gold} 88%, ${SENBON.cinnabar} 94%, ${SENBON.gold} 100%)`,
            boxShadow: `0 0 30px rgba(252,201,52,0.55)`,
            opacity: 0.9,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const MoonSpinShot: React.FC<MoonSpinShotProps> = ({time, start, progress, pulse = 0, high = 0}) => {
  const local = Math.max(0, time - start);
  const spin = local * 5.2;

  const blades = useMemo(
    () =>
      Array.from({length: 14}, (_, index) => ({
        radius: 250 + hash(7350, index) * 190,
        squash: 0.24 + hash(7351, index) * 0.16,
        offset: hash(7352, index) * Math.PI * 2,
        speed: 1.2 + hash(7353, index) * 2.3,
        width: 1.6 + hash(7354, index) * 4.2,
        tone: index % 4,
        arc: 0.5 + hash(7355, index) * 0.7,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{backgroundColor: WASHI.paperBright, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, #F8F0DE 0%, #F1E5CC 46%, #E4D4B8 100%)`}} />

      <MoonDisc cx={566} cy={430} radius={388} halo={1.36} opacity={1} seed={9082} />

      {/* 十万天兵压境：2K 版画层，右缘起势，随镜头缓缓左移 */}
      <Img
        src={staticFile(CLIMAX_ASSETS.army.file)}
        style={{
          position: 'absolute',
          right: -80,
          top: 580,
          width: 1000,
          height: 560,
          objectFit: 'cover',
          objectPosition: '35% 75%',
          opacity: 0.95,
          transform: `translateX(${f(-progress * 22)}px)`,
          filter: 'contrast(1.06) saturate(1.02)',
        }}
      />

      {/* 箭雨：从右向左的细线 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 22}, (_, index) => {
          const y = 250 + hash(7800, index) * 640;
          const speed = 900 + hash(7801, index) * 700;
          const x = 1500 - ((local * speed + hash(7802, index) * 1600) % 1700);
          return (
            <g key={`arrow-${index}`} opacity={0.5 + (index % 3) * 0.16}>
              <line x1={f(x)} y1={f(y)} x2={f(x + 92)} y2={f(y + 16)} stroke={WASHI.ink} strokeWidth={1.6} />
              <path d={`M ${f(x)} ${f(y)} l 14 -5 l 0 12 Z`} fill={SENBON.cinnabar} />
            </g>
          );
        })}
      </svg>

      {/* 真实残影：8 层 Trail 冻结在过去帧，外层再叠 2px 光学模糊，读成旋棍残影而不是一把扇子 */}
      <div style={{position: 'absolute', inset: 0, filter: 'blur(2.4px)', opacity: 0.9}}>
        <Trail layers={8} lagInFrames={0.25} trailOpacity={0.6}>
          <SpinningCudgel start={start} />
        </Trail>
      </div>

      {/* 棍风短弧：只在棍心周围，不再是虚线椭圆 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g transform={`translate(${HERO_X} 700)`}>
          {blades.map((blade, index) => {
            const angle = spin * blade.speed + blade.offset;
            const x = Math.cos(angle) * blade.radius;
            const y = Math.sin(angle) * blade.radius * blade.squash;
            const x2 = Math.cos(angle + blade.arc) * blade.radius;
            const y2 = Math.sin(angle + blade.arc) * blade.radius * blade.squash;
            return (
              <path
                key={`blade-${index}`}
                d={`M ${f(x)} ${f(y)} A ${f(blade.radius)} ${f(blade.radius * blade.squash)} 0 0 1 ${f(x2)} ${f(y2)}`}
                stroke={
                  blade.tone === 0
                    ? `rgba(217,48,37,${0.5 + pulse * 0.2})`
                    : blade.tone === 1
                      ? `rgba(18,13,20,${0.62 + high * 0.18})`
                      : `rgba(232,176,75,${0.74 + pulse * 0.14})`
                }
                strokeWidth={blade.width * 1.3}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </g>
      </svg>

      {/* 大圣：四色套版木刻立绘，X=35% */}
      <ClimaxAsset asset="spin" height={912} x={HERO_X} baseline={HERO_BASELINE} echo={0.2 + pulse * 0.08} rim={0} rotate={-1.6 + Math.sin(local * 8) * 0.8} />

      {/* 云海：盖住脚踝 */}
      <CloudBank y={828} height={250} color="#FCF4E1" shade="#E5D5B7" time={local} amp={20} opacity={1} />
      <CloudBank y={918} height={280} color="#F7ECD5" shade="#D9C4A1" time={local * 1.4} amp={16} opacity={0.96} />
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d={`M -40 1006 q 180 ${-28 - pulse * 10} 360 2 q 200 38 380 -4 q 190 -42 400 6 q 190 38 420 -6 l 0 180 l -1560 0 Z`}
          fill="#FBF2DE"
          opacity="0.82"
        />
        <path
          d={`M -40 1042 q 220 ${-24 - pulse * 8} 420 4 q 210 30 400 -6 q 200 -36 420 8 q 200 36 400 -4 l 0 136 l -1640 0 Z`}
          fill="#F1E4CA"
          opacity="0.86"
        />
      </svg>

      {/* 竖幅墨边 */}
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9}} />
      <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 26, backgroundColor: WASHI.ink, opacity: 0.9}} />

      {/* 右侧上方：82px 竖排浓墨大字 */}
      <div
        style={{
          position: 'absolute',
          right: 96,
          top: 64,
          writingMode: 'vertical-rl',
          fontFamily: SERIF_STACK,
          fontSize: 74,
          fontWeight: 900,
          lineHeight: 1.06,
          letterSpacing: 14,
          color: WASHI.ink,
          whiteSpace: 'nowrap',
          opacity: 0.92 * clamp01(progress * 3.2),
          textShadow: '0 0 22px rgba(250,243,226,0.92), 0 0 6px rgba(250,243,226,0.92)',
          transform: `translateY(${f((1 - clamp01(progress * 3.2)) * -26)}px)`,
        }}
      >
        十万天兵合围
      </div>

      {/* 左下角：朱砂小印，平衡右上的大字 */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 92,
          width: 54,
          height: 54,
          border: `2px solid ${WASHI.cinnabar}`,
          color: WASHI.cinnabar,
          fontFamily: SERIF_STACK,
          fontSize: 17,
          lineHeight: '23px',
          textAlign: 'center',
          letterSpacing: 0,
          opacity: 0.76 * clamp01(progress * 2.4),
        }}
      >
        天兵
      </div>
    </AbsoluteFill>
  );
};

export default MoonSpinShot;

