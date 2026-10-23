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
import {ChainCurtain, MountainSmash, SlashCrack, slashLineY} from '../primitives/senbon_style/DiegeticWipes';
import {EyeWoodblockShot} from '../primitives/senbon_style/EyeWoodblockShot';
import {ForegroundDebris} from '../primitives/senbon_style/ForegroundDebris';
import {FourPaperPanels, heroPanelWindow} from '../primitives/senbon_style/FourPaperPanels';
import {HalftoneOverlay} from '../primitives/senbon_style/HalftoneOverlay';
import {MoonSpinShot} from '../primitives/senbon_style/MoonSpinShot';
import {MountainCleft} from '../primitives/senbon_style/MountainCleft';
import {SenbonStageFrame} from '../primitives/senbon_style/SenbonStageFrame';
import {ShojiGate} from '../primitives/senbon_style/ShojiGate';
import {SuspendedTags} from '../primitives/senbon_style/SuspendedTags';
import {WASHI} from '../primitives/senbon_style/PaperStage';
import {WoodblockJumpCuts} from '../primitives/senbon_style/WoodblockJumpCuts';
import {SENBON, SERIF_STACK, clamp01, easeInCubic, f} from '../primitives/senbon_style/style';
import {fallbackEnergy} from './climaxPlan';
import {
  CHAINS,
  CUE,
  HERO_TAGS,
  JUMP_CUTS,
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
  const offset = 16 * cut;
  const textBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 26,
    fontFamily: SERIF_STACK,
    fontSize: 124,
    fontWeight: 900,
    letterSpacing: 10,
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
        height: 300,
        zIndex: 60,
        opacity: appear,
        transform: `scale(${f(1.08 - appear * 0.08)})`,
        transformOrigin: '100% 50%',
        pointerEvents: 'none',
      }}
    >
      {/* 墨底斜切牌：局部对比护罩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, rgba(8,5,7,0) 0%, rgba(8,5,7,0.62) 13%, rgba(8,5,7,0.9) 100%)',
          clipPath: 'polygon(5% 0, 100% 6%, 100% 94%, 0 100%)',
          border: '1px solid rgba(252,201,52,0.28)',
        }}
      />
      <div style={{position: 'absolute', left: '6%', right: '3%', top: 16, height: 2, backgroundColor: SENBON.gold, opacity: 0.55}} />
      <div style={{position: 'absolute', left: '6%', right: '3%', bottom: 16, height: 2, backgroundColor: SENBON.gold, opacity: 0.55}} />

      {/*
        字：V7 的上下两半在父容器里被裁掉上半截，只剩"半截金字"。
        V8 用三层保证任何情况下都能读到完整的四个字：
          ① 完整底色字（0.22 透明度）—— 兜底，不会被裁空；
          ② 上半（宣纸白）+ 下半（鎏金）互补斜切，各自横向错开 16px；
          ③ 父容器有确定 240px 高度，clip-path 只用内联百分比。
      */}
      <div style={{position: 'absolute', left: 30, right: 22, top: 30, height: 240}}>
        <div style={{...textBase, color: '#F5C242', opacity: 0.38}}>无坚不摧</div>
        {/* 上下两半在 58–66% 处**重叠**，不留缺口；错位 16px 读出刀劈感 */}
        <div
          style={{
            ...textBase,
            color: '#FFF7DA',
            clipPath: 'polygon(0 0, 100% 0, 100% 58%, 0 66%)',
            transform: `translateX(${f(offset)}px)`,
          }}
        >
          无坚不摧
        </div>
        <div
          style={{
            ...textBase,
            color: SENBON.gold,
            clipPath: 'polygon(0 66%, 100% 58%, 100% 100%, 0 100%)',
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
            top: '62%',
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
/*  Sub2B 左前景：蓄力 → 腾空劈斩的双动作帧                                    */
/* -------------------------------------------------------------------------- */

const RushingWukong: React.FC<{time: number; switchAt: number; cutAt: number}> = ({time, switchAt, cutAt}) => {
  const striking = time >= switchAt;
  const strikeAge = Math.max(0, time - switchAt);
  const burst = clamp01(strikeAge / 0.28);
  const windup = 1 + clamp01((time - (switchAt - 0.4)) / 0.4) * 0.06;
  const scale = striking ? 1.12 + 0.34 * (1 - (1 - burst) ** 3) : windup;
  const swing = striking ? -5 + Math.sin(strikeAge * 20) * 3.2 : -2 + Math.sin(time * 9) * 1.2;
  const wind = striking ? 5 + Math.sin(time * 17) * 3.2 : 2.6;
  const heroX = striking ? 336 : 300;
  const heroH = striking ? 760 : 700;

  return (
    <>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <defs>
          <filter id="v8-wind" x="-14%" y="-14%" width="128%" height="128%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.016" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={f(wind)} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* 刀光 / 风带：只在斩击后出现 */}
      {striking ? (
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3}}>
          <defs>
            <linearGradient id="v8-strike-arc" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,247,218,0)" />
              <stop offset="22%" stopColor="#FFF7DA" />
              <stop offset="58%" stopColor="#F5C242" />
              <stop offset="100%" stopColor="rgba(200,40,30,0)" />
            </linearGradient>
          </defs>
          <path
            d="M -60 980 Q 420 760 760 380 Q 900 210 1180 130"
            fill="none"
            stroke="#C8281E"
            strokeWidth={42 - burst * 24}
            opacity={(1 - burst) * 0.4}
            strokeLinecap="round"
          />
          <path
            d="M -60 980 Q 420 760 760 380 Q 900 210 1180 130"
            fill="none"
            stroke="url(#v8-strike-arc)"
            strokeWidth={24 - burst * 14}
            opacity={(1 - burst) * 0.95}
            strokeLinecap="round"
          />
          <path
            d="M -20 1010 Q 380 820 700 470"
            fill="none"
            stroke="#F5C242"
            strokeWidth={6}
            opacity={(1 - burst) * 0.6}
            strokeLinecap="round"
          />
          {Array.from({length: 20}, (_, index) => {
            const p = index / 20;
            const x = -60 + p * 1220;
            const y = 960 - p * 780 + Math.sin(index * 1.7) * 45;
            return (
              <circle
                key={`strike-spark-${index}`}
                cx={f(x + burst * 160)}
                cy={f(y - burst * 90)}
                r={f(2 + (index % 4) * 2.2)}
                fill={index % 3 === 0 ? '#FFF7DA' : index % 3 === 1 ? '#F5C242' : '#C8281E'}
                opacity={(1 - burst) * 0.9}
              />
            );
          })}
        </svg>
      ) : null}

      {/* 披风 / 翎子的风场可见形状 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2}}>
        {Array.from({length: striking ? 10 : 4}, (_, index) => {
          const phase = time * (striking ? 13 : 7) + index * 1.7;
          const baseX = heroX + 70 + (index - 5) * 26;
          const baseY = 640 + (index % 3) * 58;
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
              opacity={0.24 + (index % 4) * 0.08}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          transform: `translate(${f(Math.sin(time * 17) * (striking ? 7 : 3))}px, ${f(Math.cos(time * 19) * (striking ? 9 : 4))}px) scale(${f(scale)}) rotate(${f(swing)}deg)`,
          transformOrigin: '22% 86%',
          filter: striking ? 'url(#v8-wind)' : undefined,
        }}
      >
        <ClimaxAsset
          asset={striking ? 'panel4' : 'spin'}
          height={heroH}
          x={heroX}
          baseline={striking ? 1140 : 1150}
          echo={striking ? 0.36 + burst * 0.1 : 0.12}
          rim={0.12}
        />
      </div>

      {/* 动作帧切换的 2 帧白闪 */}
      {striking && strikeAge < 0.07 ? (
        <AbsoluteFill style={{background: '#FFF7DA', opacity: (1 - strikeAge / 0.07) * 0.42, mixBlendMode: 'screen', zIndex: 6}} />
      ) : null}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  Sub2B 全景                                                                */
/* -------------------------------------------------------------------------- */

const Shot2B: React.FC<{time: number; start: number; end: number; pulse: number}> = ({time, start, end, pulse}) => (
  <>
    <CelestialThrone3D time={time} start={start} end={end} cutAt={CUE.slash.cut} pulse={pulse} />

    {/* 左下角：朱砂逆光底 */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 34% 48% at 20% 82%, rgba(200,40,30,0.32) 0%, rgba(200,40,30,0) 72%)',
      }}
    />

    <RushingWukong time={time} switchAt={CUE.actionSwitch} cutAt={CUE.slash.cut} />

    <ForegroundDebris time={time} at={CUE.slash.cut} duration={0.62} />

    {/* 刀光落点的余烬 */}
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 5}}>
      {Array.from({length: 30}, (_, index) => {
        const age = time - CUE.slash.cut;
        const seed = index * 13;
        const x = 980 + ((seed * 29) % 760) + Math.sin(age * 2 + index) * 20;
        const y = 680 - (age > 0 ? age * (120 + index * 9) : 0) + ((seed * 7) % 240);
        return (
          <circle
            key={`ember-${index}`}
            cx={f(x)}
            cy={f(y)}
            r={f(1.2 + (index % 4) * 1.4)}
            fill={index % 3 === 0 ? SENBON.paper : SENBON.gold}
            opacity={age > 0 ? Math.max(0, 0.7 - age * 0.45) : 0}
          />
        );
      })}
    </svg>

    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(8,5,7,0) 76%, rgba(8,5,7,0.62) 100%)`,
      }}
    />
  </>
);

/* -------------------------------------------------------------------------- */
/*  1B → 2A 的裂屏：两半 1B 分开后露出 2A                                      */
/* -------------------------------------------------------------------------- */

const SplitStage: React.FC<{progress: number; children: React.ReactNode}> = ({progress, children}) => {
  const yLeft = slashLineY(0);
  const yRight = slashLineY(1920);
  const topClip = `polygon(0px 0px, 1920px 0px, 1920px ${f(yRight)}px, 0px ${f(yLeft)}px)`;
  const bottomClip = `polygon(0px ${f(yLeft)}px, 1920px ${f(yRight)}px, 1920px 1080px, 0px 1080px)`;
  /* 前半段必须是两块**实心**画面被劈开，不能半透明叠在 2A 上；
     到 72% 之后再快速淡出，避免"双重曝光"。 */
  const shift = 260 * easeInCubic(clamp01(progress));
  const opacity = progress < 0.72 ? 1 : clamp01(1 - (progress - 0.72) / 0.28);
  return (
    <>
      <div style={{position: 'absolute', inset: 0, clipPath: topClip, transform: `translateY(${f(-shift)}px)`, opacity}}>{children}</div>
      <div style={{position: 'absolute', inset: 0, clipPath: bottomClip, transform: `translateY(${f(shift)}px)`, opacity}}>{children}</div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  主组件                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 《孙悟空：金猴奋起千钧棒》— 10 秒高潮复刻段 **V8**（300 帧 @ 30 fps）。
 *
 * V8 只解决一件事：把 V7 的"七张高清静态壁纸"变成一部**连续的电影**。
 *
 *   · 五处物理遮罩转场（障子门 / 画格撑开 / 刀光裂屏 / 山云合拢 / 铁索黑幕）
 *     让镜头之间不再有硬切；
 *   · 1B 的合十立牌换成侧身战姿 + 斜向椭圆棍盘 + 双手覆盖层；
 *   · 2B 的 36 根孤柱外加 120 座实例化天宫，角色从蓄力硬切到腾空劈斩；
 *   · 3A/3B 的山体压降、前景岩挤压、十二列流动经文、大圣震颤与逆流火焰；
 *   · 4B 的四次跳切改成 1.05→1.42→1.95→1.25 的跨量级轰炸。
 *
 * 场景渲染窗口比 `SHOTS` 更宽：例如 1A 画到 34 帧、1B 从 26 帧就在后面
 * 待命，转场期间两个镜头同时存在。所有窗口都从 `CUE.wipe` 读取，不在场景
 * 里硬编码帧号。
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
      ? 1 + shotProgress * 0.08
      : shot.id === 's3a' || shot.id === 's3b'
        ? 1 + shotProgress * 0.04
        : 1;

  /* 291–300 帧纯黑硬切，只剩余音 */
  if (time >= CUE.blackout) {
    return (
      <AbsoluteFill style={{backgroundColor: '#000000'}}>
        <Audio src={staticFile('audio/climax_real_vocal.wav')} />
      </AbsoluteFill>
    );
  }

  /* 跨镜渲染窗口：转场期间两个镜头同时在场 */
  const show = {
    s1a: time < CUE.wipe.expand.end,
    s1b: time >= CUE.wipe.expand.start && time < CUE.wipe.split.end,
    s2a: time >= CUE.wipe.split.start && time < CUE.eyeBand.end,
    s2b: time >= CUE.palace.start && time < CUE.palace.end,
    s3a: time >= CUE.wipe.smash.start && time < CUE.mountain.mid,
    s3b: time >= CUE.mountain.mid && time < CUE.mountain.end,
    s4a: time >= CUE.wipe.chain.start && time < CUE.jumpCuts[0]!,
    s4b: time >= CUE.jumpCuts[0]! && time < CUE.blackout,
  };
  const shieldProgress = clamp01((time - CUE.shield.start) / Math.max(0.001, CUE.shield.end - CUE.shield.start));
  const expandProgress = clamp01(
    (time - CUE.wipe.expand.start) / Math.max(0.001, CUE.wipe.expand.end - CUE.wipe.expand.start),
  );
  const expanding = time >= CUE.wipe.expand.start && time < CUE.wipe.expand.end;
  const heroWindow = heroPanelWindow(expandProgress);
  const splitProgress = clamp01((time - CUE.wipe.split.start) / Math.max(0.001, CUE.wipe.split.end - CUE.wipe.split.start));
  const splitting = time >= CUE.wipe.split.start && splitProgress < 1;

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
      ? {x: 644, y: 470}
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
        {/* ---------- 后景：转场期间先画"接进来"的镜头 ---------- */}

        {show.s2a ? (
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

        {show.s3a ? (
          <MountainCleft
            time={time}
            start={CUE.mountainPress.start}
            end={CUE.palace.end + 1.67}
            rockDrops={CUE.rockDrops}
            kneelAt={CUE.kneelReveal}
            chains={CHAINS}
            pulse={pulse}
          />
        ) : null}

        {show.s4a ? <SuspendedTags time={time} frame={frame} heroes={HERO_TAGS} pulse={pulse} /> : null}

        {/* ---------- 1B ---------- */}

        {show.s1b ? (
          splitting ? (
            <SplitStage progress={splitProgress}>
              <MoonSpinShot
                time={time}
                start={CUE.shield.start}
                progress={shieldProgress}
                pulse={pulse}
                high={energy.high}
              />
            </SplitStage>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                /* 26–34 帧：1B 只存在于正在撑开的第 4 格里，窗外仍是册页纸底 */
                clipPath: expanding
                  ? `inset(${f(heroWindow.top)}px ${f(1920 - heroWindow.left - heroWindow.width)}px ${f(1080 - heroWindow.top - heroWindow.height)}px ${f(heroWindow.left)}px)`
                  : undefined,
              }}
            >
              <MoonSpinShot
                time={time}
                start={CUE.shield.start}
                progress={shieldProgress}
                pulse={pulse}
                high={energy.high}
              />
            </div>
          )
        ) : null}

        {/* ---------- 1A：画格必须压在 1B 之上，撑开的第 4 格才是 1B 的窗口 ---------- */}
        {show.s1a ? (
          <FourPaperPanels
            time={time}
            frame={frame}
            panels={PANELS}
            exitAt={CUE.panelExit}
            goneAt={CUE.panelGone}
            pulse={pulse}
          />
        ) : null}

        {/* ---------- 2B ---------- */}
        {show.s2b ? <Shot2B time={time} start={CUE.palace.start} end={CUE.palace.end} pulse={pulse} /> : null}

        {/* ---------- 3B ---------- */}
        {show.s3b ? (
          <MountainCleft
            time={time}
            start={CUE.mountainPress.start}
            end={CUE.chamber}
            rockDrops={CUE.rockDrops}
            kneelAt={CUE.kneelReveal}
            chains={CHAINS}
            ofuda={OFUDA}
            pulse={pulse}
          />
        ) : null}

        {/* ---------- 4B ---------- */}
        {show.s4b ? (
          <WoodblockJumpCuts
            time={time}
            cuts={CUE.jumpCuts}
            specs={JUMP_CUTS}
            seals={SEALS}
            whiteFlash={CUE.whiteFlash}
            pulse={pulse}
            high={energy.high}
          />
        ) : null}

        {/* ---------- 物理遮罩转场 ---------- */}
        {splitting ? <SlashCrack time={time} start={CUE.wipe.split.start} end={CUE.wipe.split.end} /> : null}
        {time >= CUE.wipe.smash.start && time < CUE.wipe.smash.end ? (
          <MountainSmash time={time} start={CUE.wipe.smash.start} end={CUE.wipe.smash.end} />
        ) : null}
        {time >= CUE.wipe.chain.start && time < CUE.wipe.chain.end ? (
          <ChainCurtain time={time} start={CUE.wipe.chain.start} end={CUE.wipe.chain.end} />
        ) : null}
        {time < CUE.wipe.doors.end ? <ShojiGate time={time} start={CUE.wipe.doors.start} end={CUE.wipe.doors.end} /> : null}
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

      <SenbonStageFrame time={time} />

      {shot.id === 's2b' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            pointerEvents: 'none',
            opacity: time < CUE.wipe.smash.start ? 1 : clamp01(1 - (time - CUE.wipe.smash.start) / 0.07),
          }}
        >
          <SlashType time={time} revealAt={CUE.slash.reveal} cutAt={CUE.slash.cut} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export default WukongClimaxSegment;
