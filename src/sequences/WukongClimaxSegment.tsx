import React from 'react';
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  CLIMAX_VOCAL_REFERENCE,
  useStemEnergy,
  type StemEnergy,
} from '../audio/spectrum';
import {CLIMAX, PALETTE} from '../config/theme';
import {clamp} from '../utils/math';
import {AbyssMountain} from '../primitives/senbon_style/AbyssMountain';
import {CelestialArmy} from '../primitives/senbon_style/CelestialArmy';
import {CourtSky} from '../primitives/senbon_style/CourtSky';
import {EyeBand} from '../primitives/senbon_style/EyeBand';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {SiegeFog} from '../primitives/senbon_style/SiegeFog';
import {SENBON, easeOutCubic} from '../primitives/senbon_style/style';
import {ThronePalace3D} from '../primitives/senbon_style/ThronePalace3D';
import {UnbreakableType} from '../primitives/senbon_style/UnbreakableType';
import {VerdictChamber} from '../primitives/senbon_style/VerdictChamber';
import {WukongRig} from '../primitives/senbon_style/WukongRig';
import {WordPanels} from '../primitives/senbon_style/WordPanels';
import {fallbackEnergy} from './climaxPlan';
import {
  BANNERS,
  CHAINS,
  CUE,
  JUMP_SCALES,
  PANEL_TILT,
  ROCKS,
  SEALS,
  SHOTS,
  TAG_SLOTS as TAGS,
  TALISMANS,
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
  s1: {x: 960, y: 380},
  s2: {x: 960, y: 520},
  s3: {x: 960, y: 620},
  s4: {x: 960, y: 520},
};

/* -------------------------------------------------------------------------- */
/*  Shot 1 — 玉境凌霄十万天兵合围                                             */
/* -------------------------------------------------------------------------- */

const Shot1: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => {
  const span = SHOTS[0]!.end - SHOTS[0]!.start;
  const progress = clamp((time - SHOTS[0]!.start) / span);
  const siege = clamp(
    (time - CUE.siege.start) / Math.max(0.001, CUE.siege.end - CUE.siege.start),
  );
  const pan = easeOutCubic(progress) * 260;
  const rigIn = clamp((time - CUE.panelDrop[3]! - 0.1) / 0.4);

  return (
    <>
      <CourtSky time={time} pan={pan} pressure={siege} pulse={pulse} impact={pulse * 0.5} />

      {/* 半调网点赤金满月：垫在大圣身后 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 430,
          width: 980,
          height: 980,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(252,201,52,${0.2 + pulse * 0.14}) 0%, rgba(217,48,37,0.14) 42%, rgba(11,9,10,0) 68%)`,
          mixBlendMode: 'screen',
        }}
      />

      <SiegeFog time={time} pressure={siege} pulse={pulse} part="clouds" />

      <CelestialArmy time={time} pressure={siege} pulse={pulse} />

      {/* 大圣：高速转棍，金箍棒每帧 45° 成金色风车 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 460,
          top: 40,
          width: 920,
          height: 1080,
          opacity: rigIn,
        }}
      >
        <WukongRig
          pose="spin_staff"
          frame={frame}
          glow={1 + energy.high * 0.5}
          high={energy.high}
          wind={0.9 + siege * 0.6}
          spinDegPerFrame={45}
          eyeBurst={siege > 0.7 ? (siege - 0.7) * 1.2 : 0}
        />
      </div>

      <SiegeFog time={time} pressure={siege} pulse={pulse} part="foreground" />

      {/* 合围收束 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 36% 30% at 50% 44%, rgba(255,247,218,${Math.pow(clamp((progress - 0.6) / 0.4), 2) * 0.2}) 0%, rgba(11,9,10,0) 74%)`,
          mixBlendMode: 'screen',
        }}
      />

      {time < CUE.panelGone ? (
        <WordPanels
          time={time}
          panels={BANNERS}
          tilt={PANEL_TILT}
          exitAt={CUE.panelExit}
          goneAt={CUE.panelGone}
        />
      ) : null}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shot 2 — 怎敌我无坚不摧                                                   */
/* -------------------------------------------------------------------------- */

const Shot2: React.FC<{time: number; frame: number; pulse: number; energy: StemEnergy}> = ({
  time,
  frame,
  pulse,
  energy,
}) => {
  const eyePhase = time < CUE.eyeBand.end;
  const palace = clamp((time - CUE.palace.start) / Math.max(0.001, CUE.palace.end - CUE.palace.start));
  const slashIn = clamp((time - CUE.slash.reveal) / 0.24);

  return (
    <>
      {eyePhase ? (
        <EyeBand
          time={time}
          start={CUE.eyeBand.start}
          openAt={CUE.eyeBand.open}
          end={CUE.eyeBand.end}
          wordTimes={CUE.eyeWords}
          words={['怎', '敌', '我']}
          pulse={pulse}
          frame={frame}
          high={energy.high}
        />
      ) : (
        <>
          <ThronePalace3D
            time={time}
            start={CUE.palace.start}
            sweepAt={CUE.staffSweep}
            end={CUE.palace.end}
            pulse={pulse}
          />

          {/* 大圣横扫：三层残影 + 金箍棒 */}
          <div
            style={{
              position: 'absolute',
              left: 960 - 620,
              top: 60,
              width: 1240,
              height: 1080,
              opacity: slashIn,
            }}
          >
            <WukongRig
              pose="slash_horizontally"
              frame={frame}
              glow={1.05}
              high={energy.high}
              wind={1.3}
              echo={clamp((time - CUE.slash.reveal) / 0.3)}
              spinDegPerFrame={0}
              staffAngle={0.04}
              eyeBurst={0.25 + pulse * 0.3}
            />
          </div>

          <UnbreakableType
            text="无坚不摧"
            time={time}
            revealAt={CUE.slash.reveal}
            cutAt={CUE.slash.cut}
            pulse={pulse}
          />

          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              background: `linear-gradient(180deg, ${SENBON.ink} 0%, rgba(11,9,10,0) 16%, rgba(11,9,10,0) 84%, ${SENBON.ink} 100%)`,
              opacity: 0.4 + palace * 0.2,
            }}
          />
        </>
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 《孙悟空：金猴奋起千钧棒》— 10 秒高潮复刻段 V3（300 帧 @ 30 fps）。
 *
 * 主音源 = 参考视频 09.000–19.200 s 的真实摇滚唱段
 * `public/audio/climax_real_vocal.wav`；画面能量直接由它的 32 桶频谱驱动
 * （`useStemEnergy` → `visualizeAudio`，numberOfSamples 32 / speed）。
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
  const slowPush = 1.02 + shotProgress * 0.05;
  const glow = SHOT_GLOW[shot.id];

  /* 290 帧白光 → 291–300 帧纯黑硬切，只剩余音 */
  if (time >= CUE.blackout) {
    return (
      <AbsoluteFill style={{backgroundColor: '#000000'}}>
        <Audio src={staticFile('audio/climax_real_vocal.wav')} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink, overflow: 'hidden'}}>
      <Audio src={staticFile('audio/climax_real_vocal.wav')} />

      <AbsoluteFill
        style={{
          transformOrigin: '50% 54%',
          transform: `translate3d(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px, 0) rotate(${shake.rotate.toFixed(3)}deg) scale(${(slowPush + shake.scale).toFixed(4)})`,
        }}
      >
        {shot.id === 's1' ? <Shot1 time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's2' ? <Shot2 time={time} frame={frame} pulse={pulse} energy={energy} /> : null}
        {shot.id === 's3' ? (
          <AbyssMountain
            time={time}
            frame={frame}
            rocks={ROCKS}
            chains={CHAINS}
            talismans={TALISMANS}
            trappedAt={CUE.trappedReveal}
            pulse={pulse}
            high={energy.high}
          />
        ) : null}
        {shot.id === 's4' ? (
          <VerdictChamber
            time={time}
            frame={frame}
            tags={TAGS}
            seals={SEALS}
            jumpCuts={CUE.jumpCuts}
            jumpScales={JUMP_SCALES}
            chamberAt={CUE.chamber}
            whiteFlashAt={CUE.whiteFlash}
            blackoutAt={CUE.blackout}
            pulse={pulse}
            high={energy.high}
          />
        ) : null}
      </AbsoluteFill>

      <HalftoneOverlay
        opacity={shot.id === 's1' ? 0.86 : shot.id === 's2' ? 0.5 : shot.id === 's3' ? 0.56 : 0.3}
        glowX={glow.x}
        glowY={glow.y}
        intensity={clamp(flash * 0.6 + pulse * 0.4)}
        grain={0.9}
        vignette
      />

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: PALETTE.paper,
          opacity: flash * 0.3,
          mixBlendMode: 'screen',
        }}
      />

      {invert ? (
        <AbsoluteFill
          style={{pointerEvents: 'none', backgroundColor: '#FFFFFF', mixBlendMode: 'difference'}}
        />
      ) : null}

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 78% 72% at 50% 50%, rgba(11,9,10,0) 60%, rgba(11,9,10,0.3) 86%, rgba(11,9,10,0.58) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
