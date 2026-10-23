import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {ClimaxAsset} from './ClimaxAsset';
import {CloudBank, MoonDisc, WASHI} from './PaperStage';
import {SENBON, SERIF_STACK, clamp01, f} from './style';

/**
 * `<MoonSpinShot />` —— Sub1B：满月逆光下的真剪影旋棍。
 *
 * 构图照《千本樱》00:02 / 01:38：一轮占画面近半屏的暖白满月偏左后方升起，
 * 米白与浅灰的浮世绘云海压在底部，大圣的**真实剪影**落在 X=35% 的黄金位，
 * 前后是高速旋棍卷起的水墨旋风——不是给小人描黄边，而是让背后的亮月把
 * 纯黑轮廓"咬"出来。
 *
 * 敌人只以**成片的黑**出现：右侧一整面由兜鍪、肩甲与枪尖叠成的天兵墙，
 * 空中是被棍风掀翻的碎影与箭雨。不画任何能看清五官的小人。
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

export const MoonSpinShot: React.FC<MoonSpinShotProps> = ({time, start, progress, pulse = 0, high = 0}) => {
  const local = Math.max(0, time - start);
  const spin = local * 5.2;

  /** 棍影盘：三层椭圆 + 短弧，绕棍心旋转。 */
  const discs = useMemo(
    () =>
      Array.from({length: 3}, (_, index) => ({
        rx: 292 + index * 58,
        ry: 86 + index * 26,
        tilt: -18 + index * 9,
        width: 30 - index * 7,
        opacity: 0.3 - index * 0.07,
        spin: 1.6 + index * 0.7,
      })),
    [],
  );

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

      {/* 右侧天兵墙：兜鍪 + 肩甲 + 枪尖叠成的一整片黑 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g fill="#120D14">
          {Array.from({length: 18}, (_, index) => {
            const x = 1580 + (index % 9) * 44;
            const y = 520 + Math.floor(index / 9) * 62 + hash(7600, index) * 22;
            return (
              <g key={`helm-${index}`}>
                <circle cx={x} cy={y} r={20 + hash(7601, index) * 4} />
                <path d={`M ${x - 26} ${y + 16} l 52 0 l 12 170 l -76 0 Z`} />
              </g>
            );
          })}
        </g>
        {/* 枪林 */}
        <g stroke={WASHI.ink} strokeWidth="4">
          {Array.from({length: 26}, (_, index) => {
            const x = 1520 + index * 17;
            const top = 300 + ((index * 47) % 180);
            return <line key={`spear-${index}`} x1={x} y1={top} x2={x + 120} y2={1080} strokeWidth={3} />;
          })}
        </g>
        <g fill={WASHI.ink}>
          {Array.from({length: 26}, (_, index) => {
            const x = 1520 + index * 17;
            const top = 300 + ((index * 47) % 180);
            return <path key={`spear-head-${index}`} d={`M ${x} ${top} l -6 -32 l 8 6 l -3 -22 l 8 22 l 7 -6 Z`} />;
          })}
        </g>
      </svg>

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

      {/* 棍影盘：三圈虚线椭圆 + 短弧，旋转读作高速旋棍的残影 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g transform={`translate(${HERO_X} 700)`}>
          {discs.map((disc, index) => (
            <ellipse
              key={`disc-${index}`}
              rx={disc.rx}
              ry={disc.ry}
              fill="none"
              stroke={index === 1 ? SENBON.cinnabar : index === 2 ? WASHI.ink : SENBON.gold}
              strokeWidth={disc.width * 0.6}
              opacity={disc.opacity + pulse * 0.06}
              strokeDasharray={`${f(34 + index * 22)} ${f(20 + index * 12)}`}
              strokeDashoffset={f(-spin * (70 + index * 40))}
              transform={`rotate(${f(disc.tilt)} 0 0)`}
              style={{filter: 'blur(5px)'}}
            />
          ))}
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
                    ? `rgba(217,48,37,${0.62 + pulse * 0.2})`
                    : blade.tone === 1
                      ? `rgba(18,13,20,${0.72 + high * 0.2})`
                      : `rgba(232,176,75,${0.84 + pulse * 0.14})`
                }
                strokeWidth={blade.width * 1.5}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </g>
      </svg>

      {/* 大圣：真实剪影，X=35% */}
      <ClimaxAsset
        asset="spin"
        height={912}
        x={HERO_X}
        baseline={HERO_BASELINE}
        echo={0.42 + pulse * 0.12}
        rim={0.45}
        rotate={-1.6 + Math.sin(local * 8) * 0.9}
      />

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

      <div
        style={{
          position: 'absolute',
          left: 78,
          top: 112,
          writingMode: 'vertical-rl',
          fontFamily: SERIF_STACK,
          fontSize: 30,
          letterSpacing: 12,
          color: WASHI.ink,
          opacity: 0.74 * clamp01(progress * 2.4),
        }}
      >
        十万天兵合围
      </div>
    </AbsoluteFill>
  );
};

export default MoonSpinShot;
