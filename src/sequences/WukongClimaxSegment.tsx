import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CLIMAX_VOCAL_REFERENCE,
  useStemEnergy,
  type StemEnergy,
} from '../audio/spectrum';
import {CLIMAX} from '../config/theme';
import {clamp} from '../utils/math';
import {CelestialThrone3D} from '../primitives/senbon_style/CelestialThrone3D';
import {ClimaxAsset} from '../primitives/senbon_style/ClimaxAsset';
import {EyeWoodblockShot} from '../primitives/senbon_style/EyeWoodblockShot';
import {FourPaperPanels} from '../primitives/senbon_style/FourPaperPanels';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {MoonSpinShot} from '../primitives/senbon_style/MoonSpinShot';
import {MountainCleft} from '../primitives/senbon_style/MountainCleft';
import {SuspendedTags} from '../primitives/senbon_style/SuspendedTags';
import {SenbonStageFrame} from '../primitives/senbon_style/SenbonStageFrame';
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
  const cut = clamp01((time - cutAt) / 0.06);
  const offset = 14 * cut;
  const textBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 26,
    fontFamily: SERIF_STACK,
    fontSize: 128,
    fontWeight: 900,
    letterSpacing: 14,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    WebkitTextStroke: '3px #120D14',
    textShadow: '0 6px 0 rgba(6,4,6,0.55)',
  };
  return (
    <div
      style={{
        position: 'absolute',
        right: 62,
        top: 92,
        width: 900,
        height: 264,
        zIndex: 60,
        opacity: appear,
        transform: `scale(${f(1.08 - appear * 0.08)})`,
        transformOrigin: '100% 50%',
        pointerEvents: 'none',
      }}
    >
      {/* 墨底斜切牌：给大字一个确定的局部对比护罩，不靠整屏压暗 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, rgba(8,5,7,0) 0%, rgba(8,5,7,0.62) 13%, rgba(8,5,7,0.88) 100%)',
          clipPath: 'polygon(5% 0, 100% 6%, 100% 94%, 0 100%)',
          border: '1px solid rgba(252,201,52,0.28)',
        }}
      />
      <div style={{position: 'absolute', left: '6%', right: '3%', top: 16, height: 2, backgroundColor: SENBON.gold, opacity: 0.55}} />
      <div style={{position: 'absolute', left: '6%', right: '3%', bottom: 16, height: 2, backgroundColor: SENBON.gold, opacity: 0.55}} />

      {/* 字：上下两半互补斜切，父容器有确定高度，clip-path 绝不会退化成零高 */}
      <div style={{position: 'absolute', left: 30, right: 22, top: 34, height: 196}}>
        <div
          style={{
            ...textBase,
            color: '#FFF3D1',
            clipPath: 'polygon(0 0, 100% 0, 100% 42%, 0 60%)',
            transform: `translateX(${f(offset)}px)`,
          }}
        >
          无坚不摧
        </div>
        <div
          style={{
            ...textBase,
            color: SENBON.gold,
            clipPath: 'polygon(0 60%, 100% 42%, 100% 100%, 0 100%)',
            transform: `translateX(${f(-offset)}px)`,
          }}
        >
          无坚不摧
        </div>
        <div
          style={{
            position: 'absolute',
            left: -18,
            right: -18,
            top: '50%',
            height: 4,
            backgroundColor: SENBON.gold,
            opacity: 0.4 + cut * 0.6,
            transform: 'rotate(-2.4deg)',
            boxShadow: cut > 0.2 ? '0 0 22px rgba(252,201,52,0.85)' : undefined,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 2,
            bottom: -2,
            width: 46,
            height: 46,
            border: `2px solid ${SENBON.cinnabar}`,
            color: SENBON.cinnabar,
            fontFamily: SERIF_STACK,
            fontSize: 22,
            lineHeight: '30px',
            textAlign: 'center',
            opacity: 0.92,
          }}
        >
          破
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub2B 左前景：随刀光爆发的活化大圣                                          */
/* -------------------------------------------------------------------------- */

const RushingWukong: React.FC<{time: number; cutAt: number}> = ({time, cutAt}) => {
  const burst = clamp01((time - cutAt + 0.12) / 0.3);
  const scale = 1.15 + 0.3 * (1 - (1 - burst) ** 3);
  const swing = Math.sin(time * 21) * 2.6;
  const wind = 4.5 + Math.sin(time * 17) * 3.2;
  return (
    <>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <defs>
          <filter id="v7-wind" x="-14%" y="-14%" width="128%" height="128%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.016" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={wind} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* 披风 / 雉鸡翎的正弦波：画在角色之后，作为风的可读形状 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        {Array.from({length: 10}, (_, index) => {
          const phase = time * 13 + index * 1.7;
          const baseX = 390 + (index - 5) * 26;
          const baseY = 610 + (index % 3) * 58;
          const dx = 120 + (index % 4) * 70;
          const dy = 40 + Math.sin(phase) * 44;
          const colour = index % 3 === 0 ? '#C8281E' : index % 3 === 1 ? '#F5C242' : '#2E5F63';
          return (
            <path
              key={`wind-${index}`}
              d={`M ${baseX} ${baseY} C ${baseX - dx * 0.4} ${baseY - dy} ${baseX - dx * 0.8} ${baseY + dy * 0.8} ${baseX - dx} ${baseY + Math.sin(phase * 1.4) * 34}`}
              fill="none"
              stroke={colour}
              strokeWidth={5 + (index % 3) * 4}
              strokeLinecap="round"
              opacity={0.28 + (index % 4) * 0.08}
            />
          );
        })}
        {Array.from({length: 5}, (_, index) => {
          const phase = time * 17 + index * 2.2;
          return (
            <path
              key={`feather-${index}`}
              d={`M ${402 + index * 9} ${520} Q ${330 - index * 12} ${420 + Math.sin(phase) * 26} ${250 - index * 14} ${350 + Math.cos(phase) * 34}`}
              fill="none"
              stroke={index % 2 === 0 ? '#C8281E' : '#F5C242'}
              strokeWidth={7 - index * 0.7}
              strokeLinecap="round"
              opacity={0.42}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${f(Math.sin(time * 17) * 7)}px, ${f(Math.cos(time * 19) * 9)}px) scale(${f(scale)}) rotate(${f(swing)}deg)`,
          transformOrigin: '22% 86%',
          filter: 'url(#v7-wind)',
        }}
      >
        <ClimaxAsset asset="slash" height={700} x={344} baseline={1128} echo={0.36} rim={0} />
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub2B 全景                                                                */
/* -------------------------------------------------------------------------- */

const Shot2B: React.FC<{time: number; start: number; end: number; pulse: number}> = ({time, start, end, pulse}) => (
  <>
    <CelestialThrone3D time={time} start={start} end={end} cutAt={CUE.slash.cut} pulse={pulse} />

    {/* 左下角：朱砂逆光底，把四色套版立绘从暗殿里托出来 */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 34% 48% at 20% 82%, rgba(200,40,30,0.26) 0%, rgba(200,40,30,0) 72%)',
      }}
    />

    <RushingWukong time={time} cutAt={CUE.slash.cut} />

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
    s2b: 0.18,
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

      {/* V7 全片统一画框 + 金火 / 残旗粒子，把八个微切镜粘成一部片 */}
      <SenbonStageFrame time={time} />

      {/*
        【无坚不摧】必须画在所有叠加层之后。
        V5 的根因是父容器只有绝对定位子节点 → height:0 → clip-path: inset(...%)
        把两半文字全裁掉，只剩底边那条金线。V6 给父容器确定高度 + 内联
        polygon 互补斜切，不再依赖任何外部 SVG clipPath ID。
      */}
      {shot.id === 's2b' ? <SlashType time={time} revealAt={CUE.slash.reveal} cutAt={CUE.slash.cut} /> : null}
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
