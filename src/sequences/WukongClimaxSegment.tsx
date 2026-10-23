import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CLIMAX_VOCAL_REFERENCE,
  useStemEnergy,
  type StemEnergy,
} from '../audio/spectrum';
import {CLIMAX} from '../config/theme';
import {clamp} from '../utils/math';
import {CelestialCollapse3D} from '../primitives/senbon_style/CelestialCollapse3D';
import {ClimaxAsset} from '../primitives/senbon_style/ClimaxAsset';
import {EyeWoodblockShot} from '../primitives/senbon_style/EyeWoodblockShot';
import {FourPaperPanels} from '../primitives/senbon_style/FourPaperPanels';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {MoonSpinShot} from '../primitives/senbon_style/MoonSpinShot';
import {MountainCleft} from '../primitives/senbon_style/MountainCleft';
import {SuspendedTags} from '../primitives/senbon_style/SuspendedTags';
import {WASHI} from '../primitives/senbon_style/PaperStage';
import {WoodblockJumpCuts} from '../primitives/senbon_style/WoodblockJumpCuts';
import {SENBON, SERIF_STACK, clamp01, f, overshoot} from '../primitives/senbon_style/style';
import {fallbackEnergy} from './climaxPlan';
import {
  CHAINS,
  CUE,
  HERO_TAGS,
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

/* -------------------------------------------------------------------------- */
/*  Sub2B 的斜切大字                                                          */
/* -------------------------------------------------------------------------- */

const SlashType: React.FC<{time: number; revealAt: number; cutAt: number}> = ({time, revealAt, cutAt}) => {
  const appear = clamp01((time - revealAt) / 0.18);
  if (appear <= 0) return null;
  const cut = clamp01((time - cutAt) / 0.05);
  const offset = 12 * cut;
  const base = {
    position: 'absolute' as const,
    right: 118,
    top: 132,
    width: 760,
    fontFamily: SERIF_STACK,
    fontSize: 118,
    fontWeight: 900,
    letterSpacing: 10,
    lineHeight: 1.08,
    textAlign: 'right' as const,
    transform: `scale(${f(1.12 - appear * 0.12)})`,
    transformOrigin: '100% 0%',
    opacity: appear,
  };
  return (
    <div style={base}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          color: '#FFEFC4',
          clipPath: 'inset(0 0 51% 0)',
          transform: `translateX(${f(offset)}px)`,
        }}
      >
        无坚不摧
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          color: SENBON.cinnabar,
          clipPath: 'inset(49% 0 0 0)',
          transform: `translateX(${f(-offset)}px)`,
        }}
      >
        无坚不摧
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: -18, height: 3, backgroundColor: SENBON.gold, opacity: 0.7}} />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub2B 全景                                                                */
/* -------------------------------------------------------------------------- */

const Shot2B: React.FC<{time: number; start: number; end: number; pulse: number}> = ({time, start, end, pulse}) => (
  <>
    <CelestialCollapse3D time={time} start={start} end={end} cutAt={CUE.slash.cut} pulse={pulse} />

    {/* 左下角前景：真实立绘侧影（三层残影），不描荧光边 */}
    <div style={{position: 'absolute', inset: 0, opacity: 0.96}}>
      <ClimaxAsset
        asset="slashColour"
        height={644}
        x={352}
        baseline={1104}
        echo={0.5}
        rotate={-2}
        rim={0.35}
        style={{filter: 'brightness(0.86) saturate(0.94)'}}
      />
    </div>

    <SlashType time={time} revealAt={CUE.slash.reveal} cutAt={CUE.slash.cut} />

    {/* 右下角：刀光落点的余烬 */}
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
      {Array.from({length: 26}, (_, index) => {
        const age = time - CUE.slash.cut;
        const seed = index * 13;
        const x = 1080 + ((seed * 29) % 700) + Math.sin(age * 2 + index) * 20;
        const y = 700 - (age > 0 ? age * (120 + index * 9) : 0) + ((seed * 7) % 240);
        return (
          <circle
            key={`ember-${index}`}
            cx={f(x)}
            cy={f(y)}
            r={f(1.2 + (index % 4) * 1.3)}
            fill={index % 3 === 0 ? SENBON.paper : SENBON.gold}
            opacity={age > 0 ? Math.max(0, 0.7 - age * 0.5) : 0}
          />
        );
      })}
    </svg>

    {/* 底边压边，压住前景人物的脚 */}
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(8,5,7,0) 76%, rgba(8,5,7,0.62) 100%)`,
      }}
    />
  </>
);

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 《孙悟空：金猴奋起千钧棒》— 10 秒高潮复刻段 **V5**（300 帧 @ 30 fps）。
 *
 * V5 与 V4 的根本差别不是"多画几根线"，而是换了三件底层东西：
 *   1. **角色不再由代码画**：`public/wukong_assets/` 里的真实造型资产
 *      （参考片帧的木刻套色 + 立绘抠底的纯黑剪影），运行期只贴图。
 *   2. **真三维**：Sub2B 用移植自 `_archive_dufu/world3d.js` 的透视投影，
 *      36 根八棱巨柱 + 3000 颗粒子 + 螺旋俯冲相机，不是 2D 斜网格。
 *   3. **和纸反色**：全片在"四色和纸 → 满月逆光 → 宣纸白底 → 暗金崩裂 →
 *      明暗裂谷 → 红黑版画"之间来回翻转，不再一黑到底。
 *
 * 九个切片（八微切 + 黑场）：
 *   s1a 0–30    四分屏和纸画格（米白 / 深绯 / 深黛 / 泥金）
 *   s1b 30–75   满月逆光 + 真实剪影旋棍 + 天兵弹飞
 *   s2a 75–98   宣纸白底眼部横切（真帧木刻）
 *   s2b 98–150  真三维凌霄崩裂 + 【无坚不摧】斜切
 *   s3a 150–175 五指山裂谷 + 跪撑剪影 + 铁索
 *   s3b 175–225 六张五层复合符咒
 *   s4a 225–256 纯黑悬签阵
 *   s4b 256–291 红黑版画四连跳切 + 290 白闪
 *   s5  291–300 纯黑留白
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
      ? 1 + shotProgress * 0.018
      : shot.id === 's3a' || shot.id === 's3b'
        ? 1 + shotProgress * 0.035
        : 1;

  /* 291–300 帧纯黑硬切，只剩余音 */
  if (time >= CUE.blackout) {
    return (
      <AbsoluteFill style={{backgroundColor: '#000000'}}>
        <Audio src={staticFile('audio/climax_real_vocal.wav')} />
      </AbsoluteFill>
    );
  }

  const halftone: Record<ShotId, number> = {
    s1a: 0.2,
    s1b: 0.16,
    s2a: 0.14,
    s2b: 0.34,
    s3a: 0.26,
    s3b: 0.28,
    s4a: 0.1,
    s4b: 0.2,
    s5: 0,
  };
  const darkShot = shot.id === 's2b' || shot.id === 's3a' || shot.id === 's3b' || shot.id === 's4a' || shot.id === 's4b';
  const glow =
    shot.id === 's1b'
      ? {x: 596, y: 452}
      : shot.id === 's3a' || shot.id === 's3b'
        ? {x: 960, y: 760}
        : shot.id === 's2b'
          ? {x: 1200, y: 620}
          : {x: 960, y: 500};

  return (
    <AbsoluteFill style={{backgroundColor: darkShot ? '#000000' : WASHI.paperBright, overflow: 'hidden'}}>
      <Audio src={staticFile('audio/climax_real_vocal.wav')} />

      <AbsoluteFill
        style={{
          transformOrigin: '50% 54%',
          transform: `translate3d(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px, 0) rotate(${shake.rotate.toFixed(3)}deg) scale(${(push + shake.scale).toFixed(4)})`,
        }}
      >
        {shot.id === 's1a' ? (
          <FourPaperPanels
            time={time}
            frame={frame}
            panels={PANELS}
            exitAt={CUE.panelExit}
            goneAt={CUE.panelGone}
            pulse={pulse}
          />
        ) : null}

        {shot.id === 's1b' ? (
          <MoonSpinShot
            time={time}
            start={CUE.shield.start}
            progress={shotProgress}
            pulse={pulse}
            high={energy.high}
          />
        ) : null}

        {shot.id === 's2a' ? (
          <EyeWoodblockShot
            time={time}
            start={CUE.eyeBand.start}
            openAt={CUE.eyeBand.open}
            end={CUE.eyeBand.end}
            wordTimes={CUE.eyeWords}
            words={['怎', '敌', '我']}
            pulse={pulse}
          />
        ) : null}

        {shot.id === 's2b' ? <Shot2B time={time} start={CUE.palace.start} end={CUE.palace.end} pulse={pulse} /> : null}

        {shot.id === 's3a' ? (
          <MountainCleft
            time={time}
            start={CUE.rockDrops[0]!}
            end={shot.end}
            rockDrops={CUE.rockDrops}
            kneelAt={CUE.kneelReveal}
            chains={CHAINS}
            pulse={pulse}
          />
        ) : null}

        {shot.id === 's3b' ? (
          <MountainCleft
            time={time}
            start={shot.start}
            end={shot.end}
            rockDrops={CUE.rockDrops}
            kneelAt={CUE.kneelReveal}
            chains={CHAINS}
            ofuda={OFUDA}
            pulse={pulse}
          />
        ) : null}

        {shot.id === 's4a' ? <SuspendedTags time={time} frame={frame} heroes={HERO_TAGS} pulse={pulse} /> : null}

        {shot.id === 's4b' ? (
          <WoodblockJumpCuts
            time={time}
            cuts={CUE.jumpCuts}
            seals={SEALS}
            whiteFlash={CUE.whiteFlash}
            pulse={pulse}
            high={energy.high}
          />
        ) : null}
      </AbsoluteFill>

      <HalftoneOverlay
        opacity={halftone[shot.id]}
        glowX={glow.x}
        glowY={glow.y}
        intensity={clamp(flash * 0.6 + pulse * 0.4)}
        grain={darkShot ? 0.85 : 0.6}
        vignette={darkShot}
      />

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: WASHI.moon,
          opacity: flash * 0.16,
          mixBlendMode: 'screen',
        }}
      />

      {invert ? (
        <AbsoluteFill style={{pointerEvents: 'none', backgroundColor: '#FFFFFF', mixBlendMode: 'difference'}} />
      ) : null}

      {darkShot ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 78% 72% at 50% 50%, rgba(8,5,7,0) 58%, rgba(8,5,7,0.34) 86%, rgba(8,5,7,0.6) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
