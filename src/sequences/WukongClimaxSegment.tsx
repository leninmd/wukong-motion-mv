import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CLIMAX_VOCAL_REFERENCE,
  useStemEnergy,
  type StemEnergy,
} from '../audio/spectrum';
import {CLIMAX, PALETTE} from '../config/theme';
import {clamp, hash, lerp} from '../utils/math';
import {BoulderCage} from '../primitives/senbon_style/BoulderCage';
import {ComicPanels} from '../primitives/senbon_style/ComicPanels';
import {ComplexOfudaTalisman} from '../primitives/senbon_style/ComplexOfudaTalisman';
import {CourtSky} from '../primitives/senbon_style/CourtSky';
import {CrumblingPalace3D} from '../primitives/senbon_style/CrumblingPalace3D';
import {EyeCutBand} from '../primitives/senbon_style/EyeCutBand';
import {GiantSlashArc} from '../primitives/senbon_style/GiantSlashArc';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {OrnateSealStamp} from '../primitives/senbon_style/OrnateSealStamp';
import {SiegeCharge} from '../primitives/senbon_style/SiegeCharge';
import {SiegeFog} from '../primitives/senbon_style/SiegeFog';
import {StaffShield} from '../primitives/senbon_style/StaffShield';
import {SuspendedTags} from '../primitives/senbon_style/SuspendedTags';
import {UnbreakableBanner} from '../primitives/senbon_style/UnbreakableBanner';
import {WukongFaceCloseup} from '../primitives/senbon_style/WukongFaceCloseup';
import {WukongRig} from '../primitives/senbon_style/WukongRig';
import {SENBON, easeOutCubic, f, overshoot} from '../primitives/senbon_style/style';
import {fallbackEnergy} from './climaxPlan';
import {
  BOULDERS,
  CHAINS,
  CUE,
  HERO_TAGS,
  JUMP_SCALES,
  OFUDA,
  PANELS,
  SEALS,
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
  s1a: {x: 960, y: 540},
  s1b: {x: 900, y: 560},
  s2a: {x: 960, y: 432},
  s2b: {x: 380, y: 760},
  s3a: {x: 960, y: 700},
  s3b: {x: 960, y: 560},
  s4a: {x: 960, y: 480},
  s4b: {x: 960, y: 500},
  s5: {x: 960, y: 540},
};

/* -------------------------------------------------------------------------- */
/*  Sub1A — 四分屏微缩画卷                                                    */
/* -------------------------------------------------------------------------- */

const Shot1A: React.FC<{time: number; frame: number; pulse: number}> = ({time, frame, pulse}) => (
  <ComicPanels
    time={time}
    frame={frame}
    panels={PANELS}
    exitAt={CUE.panelExit}
    goneAt={CUE.panelGone}
    pulse={pulse}
  />
);

/* -------------------------------------------------------------------------- */
/*  Sub1B — 侧面旋风棍盾 + 三层视差合围                                        */
/* -------------------------------------------------------------------------- */

const SHIELD = {cx: 894, cy: 578, radius: 228};

const Shot1B: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => {
  const start = CUE.shield.start;
  const siege = clamp((time - start) / 2.2);
  const pan = -120 * (time - start);
  return (
    <>
      <CourtSky time={time} pan={pan} pressure={0.35 + siege * 0.5} pulse={pulse} impact={pulse * 0.5} />
      <SiegeFog time={time} pressure={0.35 + siege * 0.4} pulse={pulse} part="clouds" />

      {/* 压暗满月，让棍盾成为唯一亮源 */}
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 60,
          width: 820,
          height: 820,
          background: 'radial-gradient(circle, rgba(11,9,10,0.78) 0%, rgba(11,9,10,0.4) 42%, rgba(11,9,10,0) 72%)',
          pointerEvents: 'none',
        }}
      />

      {/* 中景：40 名天兵从右向左冲锋 + 弹飞的箭矢 */}
      <SiegeCharge time={time} frame={frame} shield={SHIELD} pressure={0.5 + siege * 0.5} pulse={pulse} />

      {/* 人物身后的侧逆光，把侧影从后景里拔出来 */}
      <div
        style={{
          position: 'absolute',
          left: 260,
          top: 210,
          width: 820,
          height: 820,
          background: `radial-gradient(circle, rgba(252,201,52,${0.14 + pulse * 0.08}) 0%, rgba(217,48,37,0.1) 38%, rgba(11,9,10,0) 72%)`,
          mixBlendMode: 'screen',
        }}
      />

      {/* 前景：多层同心圆棍盾 */}
      <StaffShield
        cx={SHIELD.cx}
        cy={SHIELD.cy}
        radius={SHIELD.radius}
        time={time}
        frame={frame}
        intensity={0.62 + siege * 0.3}
        high={energy.high}
      />

      {/* 大圣：侧面弓步，位于 X = 35%（672px） */}
      <div
        style={{
          position: 'absolute',
          left: 172,
          top: 0,
          width: 1000,
          height: 1080,
          filter: 'drop-shadow(0 0 10px rgba(252,201,52,0.22))',
        }}
      >
        <WukongRig
          pose="side_lunge"
          frame={frame}
          glow={1.04}
          high={energy.high}
          wind={1.15 + siege * 0.35}
          spinDegPerFrame={0}
          staffAngle={0.06}
          eyeBurst={0.34 + pulse * 0.4}
        />
      </div>

      {/* 前景压边 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(90deg, rgba(11,9,10,0.86) 0%, rgba(11,9,10,0.4) 9%, rgba(11,9,10,0) 22%, rgba(11,9,10,0) 86%, rgba(11,9,10,0.66) 100%), linear-gradient(180deg, rgba(11,9,10,0.34) 0%, rgba(11,9,10,0) 18%, rgba(11,9,10,0) 76%, rgba(11,9,10,0.62) 100%)`,
        }}
      />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub2A — 眼部斜切横条                                                      */
/* -------------------------------------------------------------------------- */

const Shot2A: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => (
  <EyeCutBand
    time={time}
    frame={frame}
    start={CUE.eyeBand.start}
    openAt={CUE.eyeBand.open}
    end={CUE.eyeBand.end}
    wordTimes={CUE.eyeWords}
    words={['怎', '敌', '我']}
    pulse={pulse}
    high={energy.high}
  />
);

/* -------------------------------------------------------------------------- */
/*  Sub2B — 左下角俯瞰 3D 崩裂 + 劈字                                          */
/* -------------------------------------------------------------------------- */

const Shot2B: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => {
  const slashProgress = clamp((time - (CUE.slash.cut - 0.12)) / 0.14);
  return (
    <>
      <CrumblingPalace3D
        time={time}
        start={CUE.palace.start}
        end={CUE.palace.end}
        breakAt={CUE.slash.cut}
        pulse={pulse}
      />

      {/* 左下前景的暖侧光 */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 470,
          width: 760,
          height: 700,
          background: `radial-gradient(ellipse at 45% 55%, rgba(252,201,52,${0.15 + pulse * 0.08}) 0%, rgba(217,48,37,0.1) 40%, rgba(11,9,10,0) 74%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* 横贯全屏的 18° 赤金半调刀光 */}
      <GiantSlashArc progress={slashProgress} pulse={pulse} from={[380, 900]} to={[1780, 420]} maxWidth={192} />

      {/* 大圣：左下角前景，背影俯瞰，X = 20%, Y ≈ 76% */}
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: 300,
          width: 760,
          height: 1040,
          filter: 'drop-shadow(0 0 22px rgba(252,201,52,0.22))',
        }}
      >
        <WukongRig
          pose="back_overlook"
          frame={frame}
          glow={1.12}
          high={energy.high}
          wind={1.25}
          spinDegPerFrame={0}
          staffAngle={0.78}
          eyeBurst={0.18 + pulse * 0.18}
        />
      </div>

      {/* 右上角描金书法 */}
      <UnbreakableBanner text="无坚不摧" time={time} revealAt={CUE.slash.reveal} cutAt={CUE.slash.cut} pulse={pulse} />

      {/* 3D 前景的金色浮尘 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
        {Array.from({length: 34}, (_, index) => {
          const x = (hash(9101, index) * 1920 + time * (40 + (index % 5) * 26)) % 1920;
          const y = hash(9102, index) * 1080;
          return (
            <circle
              key={`ember-${index}`}
              cx={f(x)}
              cy={f(y)}
              r={f(0.8 + (index % 3) * 1.2)}
              fill={index % 4 === 0 ? SENBON.cinnabar : SENBON.gold}
              opacity={0.22 + (index % 5) * 0.08}
            />
          );
        })}
      </svg>

      {/* 底边压暗，保证书法可读 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(11,9,10,0) 74%, rgba(11,9,10,0.5) 100%)`,
        }}
      />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub3A / 3B — 巨岩铁索 + 复合符咒                                          */
/* -------------------------------------------------------------------------- */

const Shot3A: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => (
  <BoulderCage
    time={time}
    frame={frame}
    boulders={BOULDERS}
    chains={CHAINS}
    kneelAt={CUE.kneelReveal}
    pulse={pulse}
    high={energy.high}
  />
);

const Shot3B: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => (
  <>
    <Shot3A time={time} frame={frame} pulse={pulse} energy={energy} />

    {OFUDA.map((slot) => {
      const local = clamp((time - slot.revealAt) / 0.24);
      if (local <= 0) return null;
      const shake = (1 - local) * 18;
      return (
        <ComplexOfudaTalisman
          key={slot.id}
          text={slot.text}
          angle={slot.rotate}
          width={slot.width}
          height={slot.height}
          reveal={local}
          shakeX={Math.sin(local * 52 + slot.x) * shake}
          shakeY={Math.cos(local * 44 + slot.y) * shake * 0.7}
          style={{left: slot.x - slot.width / 2, top: slot.y - slot.height / 2}}
        />
      );
    })}

    {/* 符咒落定时的金粉 */}
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
      {OFUDA.map((slot, index) => {
        const age = time - slot.revealAt;
        if (age < 0 || age > 0.55) return null;
        const p = age / 0.55;
        return Array.from({length: 8}, (_, spark) => {
          const angle = (spark / 8) * Math.PI * 2;
          const distance = 40 + p * (90 + spark * 12);
          return (
            <circle
              key={`${slot.id}-spark-${spark}`}
              cx={f(slot.x + Math.cos(angle) * distance)}
              cy={f(slot.y + Math.sin(angle) * distance * 0.8)}
              r={f(1.6 + (spark % 3) * 1.4)}
              fill={spark % 3 === 0 ? SENBON.paper : index % 2 === 0 ? SENBON.gold : SENBON.cinnabar}
              opacity={(1 - p) * 0.9}
            />
          );
        });
      })}
    </svg>
  </>
);

/* -------------------------------------------------------------------------- */
/*  Sub4A — 纯黑悬签阵                                                        */
/* -------------------------------------------------------------------------- */

const Shot4A: React.FC<{time: number; frame: number; pulse: number}> = ({time, frame, pulse}) => (
  <SuspendedTags time={time} frame={frame} heroes={HERO_TAGS} pulse={pulse} />
);

/* -------------------------------------------------------------------------- */
/*  Sub4B — 四连跳切脸谱破壁                                                  */
/* -------------------------------------------------------------------------- */

const CrackSlash: React.FC<{age: number; index: number}> = ({age, index}) => {
  if (age < 0 || age > 0.26) return null;
  const fade = 1 - age / 0.26;
  const slope = index % 2 === 0 ? 0.34 : -0.42;
  const midY = 540 + (index - 1.5) * 80;
  const leftY = midY - 960 * slope;
  const rightY = midY + 960 * slope;
  const branches = Array.from({length: 7}, (_, branch) => {
    const t = (branch + 1) / 8;
    const x = 1920 * t;
    const y = leftY + (rightY - leftY) * t;
    return {
      x,
      y,
      dx: (branch % 2 === 0 ? 1 : -1) * (30 + branch * 16),
      dy: (branch % 3 === 0 ? -1 : 1) * (50 + branch * 12),
    };
  });
  return (
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
      <line x1="0" y1={f(leftY)} x2="1920" y2={f(rightY)} stroke={SENBON.gold} strokeWidth={3 + fade * 4} opacity={fade * 0.95} />
      <line x1="0" y1={f(leftY)} x2="1920" y2={f(rightY)} stroke={SENBON.goldPale} strokeWidth={1.2} opacity={fade * 0.7} />
      <line x1="0" y1={f(leftY)} x2="1920" y2={f(rightY)} stroke={SENBON.gold} strokeWidth={18} opacity={fade * 0.3} style={{filter: 'blur(12px)'}} />
      {branches.map((branch, branchIndex) => (
        <g key={`branch-${branchIndex}`}>
          <line x1={f(branch.x)} y1={f(branch.y)} x2={f(branch.x + branch.dx)} y2={f(branch.y + branch.dy)} stroke={SENBON.goldLight} strokeWidth="2.2" opacity={fade * 0.8} />
          <line
            x1={f(branch.x)}
            y1={f(branch.y)}
            x2={f(branch.x + branch.dx * 0.6)}
            y2={f(branch.y + branch.dy * 0.6)}
            stroke={SENBON.paper}
            strokeWidth="1"
            opacity={fade * 0.7}
          />
        </g>
      ))}
      {Array.from({length: 10}, (_, shard) => {
        const x = 120 + shard * 180 + (index % 2) * 40;
        const y = 120 + ((shard * 137) % 760);
        const size = 12 + (shard % 4) * 10;
        return (
          <polygon
            key={`shard-${shard}`}
            points={`${x},${y} ${x + size},${y + size * 0.4} ${x + size * 0.3},${y + size}`}
            fill={shard % 3 === 0 ? SENBON.cinnabar : SENBON.gold}
            opacity={fade * 0.6}
          />
        );
      })}
    </svg>
  );
};

const Shot4B: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => {
  let scale = 1;
  let cutIndex = -1;
  let cutAge = -1;
  for (let index = CUE.jumpCuts.length - 1; index >= 0; index -= 1) {
    const cut = CUE.jumpCuts[index]!;
    if (time >= cut) {
      cutIndex = index;
      cutAge = time - cut;
      const from = index === 0 ? 1 : (JUMP_SCALES[index - 1] ?? 1);
      const to = JUMP_SCALES[index] ?? 1;
      scale = lerp(from, to, easeOutCubic(clamp(cutAge / 0.08)));
      break;
    }
  }
  const damage = clamp(0.16 + Math.max(0, cutIndex) * 0.2);
  const burst = clamp(0.34 + pulse * 0.4 + Math.max(0, cutIndex) * 0.08);

  return (
    <AbsoluteFill style={{backgroundColor: '#040304', overflow: 'hidden'}}>
      {/* 放射金线 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
        {Array.from({length: 46}, (_, index) => {
          const angle = (index / 46) * Math.PI * 2 + time * 0.08;
          const inner = 260 + (index % 5) * 26;
          const outer = 1200 + (index % 7) * 90;
          return (
            <line
              key={`ray-${index}`}
              x1={f(960 + Math.cos(angle) * inner)}
              y1={f(540 + Math.sin(angle) * inner)}
              x2={f(960 + Math.cos(angle) * outer)}
              y2={f(540 + Math.sin(angle) * outer)}
              stroke={index % 4 === 0 ? SENBON.cinnabar : SENBON.gold}
              strokeWidth={index % 4 === 0 ? 3 : 1}
              opacity={0.08 + (index % 5) * 0.03 + pulse * 0.05}
            />
          );
        })}
      </svg>

      {/* 高精度脸谱 */}
      <div
        style={{
          position: 'absolute',
          left: 160,
          top: -260,
          width: 1600,
          height: 1600,
          transform: `scale(${f(scale)})`,
          transformOrigin: '50% 50%',
          filter: 'drop-shadow(0 0 40px rgba(252,201,52,0.14))',
        }}
      >
        <WukongFaceCloseup
          frame={frame}
          variant="full"
          intensity={0.82 + pulse * 0.18}
          high={energy.high}
          damage={damage}
          eyeBurst={burst}
          gaze={Math.sin(time * 7) * 2}
        />
      </div>

      {/* 每次跳切的金色裂屏刀光 */}
      <CrackSlash age={cutAge} index={Math.max(0, cutIndex)} />

      {/* 四枚带刀痕的巨型印章 */}
      {SEALS.map((seal) => {
        const age = time - seal.landAt;
        if (age < 0) return null;
        const slam = overshoot(clamp(age / 0.16), 8.6, 8.4);
        const factor = 1.8 - slam * 0.8;
        return (
          <div
            key={seal.id}
            style={{
              position: 'absolute',
              left: seal.x - (seal.size * factor) / 2,
              top: seal.y - (seal.size * factor) / 2,
              width: seal.size * factor,
              height: seal.size * factor,
              opacity: clamp(age / 0.06) * 0.94,
            }}
          >
            <OrnateSealStamp
              text={seal.text}
              subText={seal.text === '不' ? '逆' : seal.text === '敬' ? '天' : seal.text === '权' ? '犯' : '上'}
              size={seal.size * factor}
              rotate={seal.rotate}
              crack
            />
          </div>
        );
      })}

      {/* 底噪与暗角 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 62% 58% at 50% 50%, rgba(0,0,0,0) 34%, rgba(0,0,0,${0.35 + Math.max(0, cutIndex) * 0.12}) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: SENBON.gold,
          opacity: 0.018 + pulse * 0.02,
          mixBlendMode: 'screen',
        }}
      />

      {/* 290 帧白光 */}
      {time >= CUE.whiteFlash ? (
        <AbsoluteFill
          style={{
            backgroundColor: SENBON.paper,
            opacity: clamp(1 - (time - CUE.whiteFlash) / 0.055),
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 《孙悟空：金猴奋起千钧棒》— 10 秒高潮复刻段 V4（300 帧 @ 30 fps）。
 *
 * 八个微切镜 + 0.9 秒黑场留白：
 *   s1a 0–30    四分屏微缩画卷（4×480px，20px 安全边距）
 *   s1b 30–75   侧面旋风棍盾，X=35%，三层视差
 *   s2a 75–98   眼部斜切横条 +【怎】【敌】【我】
 *   s2b 98–150  左下角俯瞰 3D 崩裂 +【无坚不摧】劈字
 *   s3a 150–175 五道巨岩 + 六道实体铁索 + 侧面跪撑
 *   s3b 175–225 六张五层复合符咒
 *   s4a 225–256 纯黑悬签阵（无任何猴子残留）
 *   s4b 256–291 四连跳切高精度脸谱 + 四印 + 290 白闪
 *   s5 291–300  纯黑留白
 *
 * 音源 = 参考视频 09.000–19.200 s 的真实摇滚唱段；画面能量由它的 32 桶频谱
 * 驱动（`useStemEnergy` → `visualizeAudio`，numberOfSamples 32 / speed）。
 */
export const WukongClimaxSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;

  const stem = useStemEnergy({
    src: staticFile('audio/climax_real_vocal.wav'),
    bandReference: CLIMAX_VOCAL_REFERENCE,
  });
  const energy: StemEnergy = stem ?? fallbackEnergy(time);
  const beat = beatPulse(time);
  const pulse = clamp(energy.low * 0.55 + beat * 0.4 + energy.high * 0.35);

  const shot = shotAt(time);
  const shake = shakeAt(time);
  const flash = flashAt(time);
  const invert = invertAt(frame, fps);
  const shotProgress = clamp((time - shot.start) / Math.max(0.001, shot.end - shot.start));
  const push =
    shot.id === 's1b'
      ? 1 + shotProgress * 0.025
      : shot.id === 's3a' || shot.id === 's3b'
        ? 1 + shotProgress * 0.04
        : shot.id === 's4a'
          ? 1 + shotProgress * 0.015
          : 1;
  const glow = SHOT_GLOW[shot.id];

  /* 291–300 帧纯黑硬切，只剩余音 */
  if (time >= CUE.blackout) {
    return (
      <AbsoluteFill style={{backgroundColor: '#000000'}}>
        <Audio src={staticFile('audio/climax_real_vocal.wav')} />
      </AbsoluteFill>
    );
  }

  const halftoneOpacity =
    shot.id === 's1a'
      ? 0.34
      : shot.id === 's1b'
        ? 0.58
        : shot.id === 's2a'
          ? 0.2
          : shot.id === 's2b'
            ? 0.42
            : shot.id === 's3a'
              ? 0.3
              : shot.id === 's3b'
                ? 0.34
                : shot.id === 's4a'
                  ? 0.08
                  : 0.16;

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink, overflow: 'hidden'}}>
      <Audio src={staticFile('audio/climax_real_vocal.wav')} />

      <AbsoluteFill
        style={{
          transformOrigin: '50% 54%',
          transform: `translate3d(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px, 0) rotate(${shake.rotate.toFixed(3)}deg) scale(${(push + shake.scale).toFixed(4)})`,
        }}
      >
        {shot.id === 's1a' ? <Shot1A time={time} frame={frame} pulse={pulse} /> : null}
        {shot.id === 's1b' ? <Shot1B time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's2a' ? <Shot2A time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's2b' ? <Shot2B time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's3a' ? <Shot3A time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's3b' ? <Shot3B time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's4a' ? <Shot4A time={time} frame={frame} pulse={pulse} /> : null}
        {shot.id === 's4b' ? <Shot4B time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
      </AbsoluteFill>

      <HalftoneOverlay
        opacity={halftoneOpacity}
        glowX={glow.x}
        glowY={glow.y}
        intensity={clamp(flash * 0.6 + pulse * 0.4)}
        grain={shot.id === 's4a' || shot.id === 's4b' ? 0.5 : 0.9}
        vignette={shot.id !== 's4a'}
      />

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: PALETTE.paper,
          opacity: flash * 0.18,
          mixBlendMode: 'screen',
        }}
      />

      {invert ? (
        <AbsoluteFill
          style={{pointerEvents: 'none', backgroundColor: '#FFFFFF', mixBlendMode: 'difference'}}
        />
      ) : null}

      {shot.id !== 's4a' ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 78% 72% at 50% 50%, rgba(11,9,10,0) 60%, rgba(11,9,10,0.3) 86%, rgba(11,9,10,0.58) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
