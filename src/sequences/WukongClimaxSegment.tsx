import React from 'react';
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {useStemEnergy, type StemEnergy} from '../audio/spectrum';
import {CLIMAX, PALETTE} from '../config/theme';
import {clamp} from '../utils/math';
import {CelestialArmy} from '../primitives/senbon_style/CelestialArmy';
import {CourtSky} from '../primitives/senbon_style/CourtSky';
import {CudgelImpact3D} from '../primitives/senbon_style/CudgelImpact3D';
import {EyeCut} from '../primitives/senbon_style/EyeCut';
import {FinalSeals} from '../primitives/senbon_style/FinalSeals';
import {ForegroundMotion} from '../primitives/senbon_style/ForegroundMotion';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {MountainCage} from '../primitives/senbon_style/MountainCage';
import {NandamenDoors} from '../primitives/senbon_style/NandamenDoors';
import {SplitType} from '../primitives/senbon_style/SplitType';
import {Talismans} from '../primitives/senbon_style/Talismans';
import {VerdictTags} from '../primitives/senbon_style/VerdictTags';
import {WarBanners} from '../primitives/senbon_style/WarBanners';
import {WukongSilhouette} from '../primitives/senbon_style/WukongSilhouette';
import {easeOutCubic, SENBON} from '../primitives/senbon_style/style';
import {fallbackEnergy} from './climaxPlan';
import {
  CUE,
  SHOTS,
  beatPulse,
  flashAt,
  invertAt,
  shakeAt,
  shotAt,
  type ShotId,
} from './senbonPlan';

export const WUKONG_CLIMAX_ID = 'WukongClimaxSegment';
export const WUKONG_CLIMAX_SECONDS = CLIMAX.durationInSeconds;
export const WUKONG_CLIMAX_FPS = CLIMAX.fps;

const SHOT_GLOW: Record<ShotId, {x: number; y: number}> = {
  s1: {x: 960, y: 360},
  s2: {x: 960, y: 520},
  s3: {x: 960, y: 760},
  s4: {x: 960, y: 520},
};

/* -------------------------------------------------------------------------- */
/*  Shot 1 — 玉境凌霄十万天兵合围                                             */
/* -------------------------------------------------------------------------- */

const Shot1: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const span = SHOTS[0]!.end - SHOTS[0]!.start;
  const progress = clamp((time - SHOTS[0]!.start) / span);
  const doorProgress = clamp(
    (time - CUE.doorOpen.start) / Math.max(0.001, CUE.doorOpen.end - CUE.doorOpen.start),
  );
  const pressure = clamp(
    (time - CUE.armyConverge.start) /
      Math.max(0.001, CUE.armyConverge.end - CUE.armyConverge.start),
  );
  const pan = easeOutCubic(progress) * 210;

  return (
    <>
      <CourtSky time={time} pan={pan} pressure={pressure} pulse={pulse} />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(252,201,52,0) 54%, rgba(154,106,13,${0.16 + pressure * 0.06}) 72%, rgba(217,48,37,0.1) 86%, rgba(11,9,10,0) 100%)`,
          mixBlendMode: 'screen',
        }}
      />
      <CelestialArmy time={time} pressure={pressure} pulse={pulse} />

      {/* 大圣背后的月轮光 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 560,
          width: 980,
          height: 980,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(252,201,52,${0.16 + pulse * 0.1}) 0%, rgba(217,48,37,0.1) 38%, rgba(11,9,10,0) 68%)`,
        }}
      />

      {/* 中央主体：大圣立姿（比四幡更靠前，头部压在满月上） */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 410,
          top: 24,
          width: 820,
          height: 1120,
          opacity: clamp(progress * 6),
        }}
      >
        <WukongSilhouette
          pose="stand"
          width={820}
          height={1120}
          wind={0.9 + progress * 0.5}
          glow={0.9}
          aura={0.6}
          staffAngle={-36 + Math.sin(time * 0.8) * 2}
        />
      </div>

      {/* 地面前景暗影，压住脚 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -10,
          height: 220,
          background: `linear-gradient(180deg, rgba(11,9,10,0) 0%, rgba(11,9,10,0.66) 62%, ${SENBON.ink} 100%)`,
        }}
      />

      <WarBanners time={time} pulse={pulse} />
      <ForegroundMotion time={time} rush={progress} pulse={pulse} />
      <NandamenDoors progress={doorProgress} impact={pulse} />

      {/* 合围收束：中心越来越亮，形成切镜前的高压 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 34% 26% at 50% 42%, rgba(255,247,218,${Math.pow(clamp((progress - 0.55) / 0.45), 2) * 0.22}) 0%, rgba(11,9,10,0) 76%)`,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shot 2 — 怎敌我无坚不摧                                                   */
/* -------------------------------------------------------------------------- */

const Shot2: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const eyeActive = time < CUE.threeD.start;
  const threeLocal = clamp(
    (time - CUE.threeD.start) / Math.max(0.001, CUE.threeD.end - CUE.threeD.start),
  );

  return (
    <>
      {eyeActive ? (
        <EyeCut
          time={time}
          start={CUE.eyeCut.start}
          end={CUE.eyeCut.end}
          titleAt={CUE.eyeCut.start + 0.18}
          burstAt={CUE.eyeBurst}
          pulse={pulse}
        />
      ) : (
        <>
          <CudgelImpact3D
            time={time}
            start={CUE.threeD.start}
            impactAt={CUE.staffImpact}
            end={CUE.threeD.end}
            pulse={pulse}
          />
          <SplitType
            time={time}
            revealAt={CUE.splitType.reveal}
            slashAt={CUE.splitType.slash}
            pulse={pulse}
          />
          {/* 冲击后飞散的纸屑 */}
          {time >= CUE.staffImpact ? (
            <PaperDebris time={time} start={CUE.staffImpact} />
          ) : null}
          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              background: `linear-gradient(180deg, ${SENBON.ink} 0%, rgba(11,9,10,0) 18%, rgba(11,9,10,0) 82%, ${SENBON.ink} 100%)`,
              opacity: 0.4 + threeLocal * 0.2,
            }}
          />
        </>
      )}
    </>
  );
};

/** 3D 冲击后横飞的纸屑/金石碎块。 */
const PaperDebris: React.FC<{time: number; start: number}> = ({time, start}) => {
  const age = time - start;
  if (age < 0) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}} aria-hidden="true">
      {Array.from({length: 20}, (_, index) => {
        const travel = easeOutCubic(clamp(age / 1.2));
        const angle = (index / 20) * Math.PI * 2 + index * 0.7;
        const radius = 120 + ((index * 97) % 620);
        const x = 960 + Math.cos(angle) * radius * travel;
        const y = 560 + Math.sin(angle) * radius * 0.5 * travel - age * 90;
        return (
          <span
            key={`debris-${index}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 6 + (index % 5) * 4,
              height: 2 + (index % 3) * 3,
              background: index % 6 === 0 ? SENBON.gold : index % 9 === 0 ? SENBON.cinnabar : '#E8DCC2',
              transform: `rotate(${age * (120 + index * 9)}deg)`,
              opacity: clamp(1 - age / 1.4) * 0.8,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shot 3 — 五指山下偿自由的罪                                               */
/* -------------------------------------------------------------------------- */

const Shot3: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const pressure = clamp(
    (time - CUE.cage.start) / Math.max(0.001, CUE.talismanWindow.end - CUE.cage.start),
  );
  const push = easeOutCubic(pressure) * 0.06;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${(1 + push).toFixed(4)})`,
          transformOrigin: '50% 62%',
        }}
      >
        <MountainCage
          time={time}
          peakTimes={CUE.peakDrops}
          pressure={pressure}
          pulse={pulse}
        />
      </div>
      <Talismans time={time} pulse={pulse} />
      {/* 石缝里落下的金尘 */}
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        {Array.from({length: 26}, (_, index) => {
          const y = ((time * (80 + (index % 7) * 34) + index * 61) % 1200) - 80;
          const x = 300 + ((index * 173) % 1300) + Math.sin(time * 0.9 + index) * 18;
          return (
            <span
              key={`ash-${index}`}
              style={{
                position: 'absolute',
                left: x,
                top: 1100 - y,
                width: 2 + (index % 3),
                height: 2 + (index % 4),
                background: index % 4 === 0 ? SENBON.gold : '#C9B791',
                opacity: 0.12 + (index % 5) * 0.08,
              }}
            />
          );
        })}
      </AbsoluteFill>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shot 4 — 罪名是老孙不敬权威                                               */
/* -------------------------------------------------------------------------- */

const Shot4: React.FC<{time: number; pulse: number}> = ({time, pulse}) => {
  const finale = clamp((time - CUE.finale.start) / 0.9);
  const tagBreak = CUE.tagBreak;
  return (
    <>
      <VerdictTags time={time} breakAt={tagBreak} finale={finale} pulse={pulse} />
      <FinalSeals time={time} finale={finale} pulse={pulse} />

      {/* 破壁时的冲击波 */}
      {time >= tagBreak ? <BreakShock time={time} at={tagBreak} /> : null}

      {/* 终局整体压边 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 58% 54% at 50% 50%, rgba(11,9,10,0) 42%, rgba(11,9,10,0.55) 76%, rgba(11,9,10,0.92) 100%)`,
        }}
      />
    </>
  );
};

const BreakShock: React.FC<{time: number; at: number}> = ({time, at}) => {
  const age = time - at;
  if (age < 0 || age > 0.72) return null;
  const p = clamp(age / 1.1);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}} aria-hidden="true">
      {[0, 0.08, 0.16].map((delay, index) => {
        const local = clamp((age - delay) / 0.9);
        if (age < delay) return null;
        const size = 200 + local * 2400;
        return (
          <div
            key={`break-wave-${index}`}
            style={{
              position: 'absolute',
              left: 960 - size / 2,
              top: 540 - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              border: `${2 + (1 - local) * 8}px solid ${index === 1 ? SENBON.cinnabar : SENBON.gold}`,
              opacity: (1 - local) ** 2 * 0.45,
              filter: `blur(${local * 3}px)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 52%, rgba(255,247,218,${(1 - p) * 0.18}) 0%, rgba(252,201,52,0) 54%)`,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 《孙悟空：金猴奋起千钧棒》— 10 秒高潮复刻段（300 帧 @ 30 fps）。
 *
 * 纯代码方案：不引用任何 AI 生成位图，不使用杜甫母版的章节框 / BPM 仪表盘 /
 * 常驻印章 / 底部 KTV 字幕条。四镜全部由 SVG / Canvas 2D / Three.js 几何体
 * 构成，歌词作为战幡、符咒、罪状牌与印章进入画面。
 *
 * 时间来源只有两处：`public/alignment/climax_words.json` 与
 * `src/sequences/senbonPlan.ts` 的分镜秒表；能量来源是鼓组频谱。
 */
export const WukongClimaxSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;

  const stem = useStemEnergy({src: staticFile('audio/drums_stem.wav')});
  const energy: StemEnergy = stem ?? fallbackEnergy(time);
  const beat = beatPulse(time);
  const pulse = clamp(energy.low * 0.62 + beat * 0.42 + energy.mid * 0.2);

  const shot = shotAt(time);
  const shake = shakeAt(time);
  const flash = flashAt(time);
  const invert = invertAt(frame, fps);
  const shotProgress = clamp(
    (time - shot.start) / Math.max(0.001, shot.end - shot.start),
  );
  const slowPush = 1.02 + shotProgress * 0.045;

  const glow = SHOT_GLOW[shot.id];

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink, overflow: 'hidden'}}>
      {/* 鼓组是唯一的图像能量来源；混音只做听觉。 */}
      <Audio src={staticFile('audio/climax_mix.wav')} />

      {/* 相机：慢推 + 冲击震屏 */}
      <AbsoluteFill
        style={{
          transformOrigin: '50% 54%',
          transform: `translate3d(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px, 0) rotate(${shake.rotate.toFixed(3)}deg) scale(${(slowPush + shake.scale).toFixed(4)})`,
        }}
      >
        {shot.id === 's1' ? <Shot1 time={time} pulse={pulse} /> : null}
        {shot.id === 's2' ? <Shot2 time={time} pulse={pulse} /> : null}
        {shot.id === 's3' ? <Shot3 time={time} pulse={pulse} /> : null}
        {shot.id === 's4' ? <Shot4 time={time} pulse={pulse} /> : null}
      </AbsoluteFill>

      {/* 印刷层：半调网点 + 纸纹（在画面之上、反色之下） */}
      <HalftoneOverlay
        opacity={0.9}
        glowX={glow.x}
        glowY={glow.y}
        intensity={clamp(flash * 0.6 + pulse * 0.4)}
        grain={0.9}
        vignette
      />

      {/* 冲击白闪 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: PALETTE.paper,
          opacity: flash * 0.32,
          mixBlendMode: 'screen',
        }}
      />

      {/* 第 118–119 帧的全屏黑白反色冲击帧 */}
      {invert ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            backgroundColor: '#FFFFFF',
            mixBlendMode: 'difference',
          }}
        />
      ) : null}

      {/* 暗角收边：最轻的一层，不压灰暗场 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 76% 70% at 50% 50%, rgba(11,9,10,0) 58%, rgba(11,9,10,0.34) 86%, rgba(11,9,10,0.62) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
