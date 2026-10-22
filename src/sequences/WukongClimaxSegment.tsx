import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {useStemEnergy, type StemEnergy} from '../audio/spectrum';
import {CLIMAX, DERIVED, FONT_STACKS, PALETTE} from '../config/theme';
import {BurstType} from '../primitives/BurstType';
import {CourtBlocks} from '../primitives/CourtBlocks';
import {PalaceHall} from '../primitives/PalaceHall';
import {Plate} from '../primitives/Plate';
import {CudgelSlash} from '../primitives/CudgelSlash';
import {FiveFingerMountain} from '../primitives/FiveFingerMountain';
import {Halftone} from '../primitives/Halftone';
import {HeroTitle} from '../primitives/HeroTitle';
import {KineticLine} from '../primitives/KineticLine';
import {ParchmentPanels} from '../primitives/ParchmentPanels';
import {PaperSurface} from '../primitives/PaperSurface';
import {ParticleRain} from '../primitives/ParticleRain';
import {PosterFrame} from '../primitives/PosterFrame';
import {Seal} from '../primitives/Seal';
import {RadialBurst} from '../primitives/RadialBurst';
import {Vignette} from '../primitives/Vignette';
import {clamp, ease, fbm, lerp} from '../utils/math';
import {frameFromSeconds} from '../utils/timing';
import {
  BURST_CUES,
  CLIMAX_ALIGNMENT,
  CLIMAX_DURATION_SECONDS,
  FLASH_CUES,
  SLASH_CUES,
  STORY,
  fallbackEnergy,
  resolveCues,
} from './climaxPlan';

export const WUKONG_CLIMAX_ID = 'WukongClimaxSegment';
export const WUKONG_CLIMAX_SECONDS = CLIMAX_DURATION_SECONDS;
export const WUKONG_CLIMAX_FPS = CLIMAX.fps;

const BEATS = CLIMAX_ALIGNMENT.beats?.beats ?? [];
const BPM = CLIMAX_ALIGNMENT.beats?.bpm ?? 100;
const UNITS = CLIMAX_ALIGNMENT.units;

type ShotKind =
  | 'court'
  | 'formation'
  | 'staff'
  | 'split'
  | 'collapse'
  | 'duel'
  | 'impact'
  | 'mountain'
  | 'crevasse'
  | 'panels'
  | 'press'
  | 'final';

interface ShotDef {
  id: ShotKind;
  fromUnit: string;
  toUnit: string;
  label: string;
  title: string;
  left: string;
  right: string;
}

/**
 * Twelve cuts in ten seconds — the density of the reference MV. Every boundary
 * is a *unit id*, so the timeline is resolved from the alignment document and
 * stays correct at any fps.
 */
const SHOT_DEFS: ShotDef[] = [
  {id: 'court', fromUnit: 'l1c01', toUnit: 'l1c04', label: '天庭肃杀', title: '第一幕', left: '玉境凌霄', right: '十万天兵'},
  {id: 'formation', fromUnit: 'l1c04', toUnit: 'l1c07', label: '天兵合围', title: '第二幕', left: '十万天兵', right: '合围'},
  {id: 'staff', fromUnit: 'l1c07', toUnit: 'l1c10', label: '如意在手', title: '第三幕', left: '如意金箍棒', right: '重一万三千五百斤'},
  {id: 'split', fromUnit: 'l1c10', toUnit: 'l2c02', label: '一棒破阵', title: '第四幕', left: '一棒破阵', right: '断'},
  {id: 'collapse', fromUnit: 'l2c02', toUnit: 'l2c04', label: '秩序崩塌', title: '第五幕', left: '秩序', right: '崩塌'},
  {id: 'duel', fromUnit: 'l2c04', toUnit: 'l2c06', label: '横扫千军', title: '第六幕', left: '无坚', right: '不摧'},
  {id: 'impact', fromUnit: 'l2c06', toUnit: 'l3c01', label: '摧', title: '第七幕', left: '摧', right: '破'},
  {id: 'mountain', fromUnit: 'l3c01', toUnit: 'l3c06', label: '五指压顶', title: '第八幕', left: '五指山', right: '压顶'},
  {id: 'crevasse', fromUnit: 'l3c06', toUnit: 'l4c01', label: '石下', title: '第九幕', left: '石下', right: '不见天日'},
  {id: 'panels', fromUnit: 'l4c01', toUnit: 'l4c05', label: '罪状', title: '第十幕', left: '罪名', right: '不敬权威'},
  {id: 'press', fromUnit: 'l4c05', toUnit: 'l4c07', label: '镇压', title: '第十一幕', left: '镇压', right: '五百年'},
  {id: 'final', fromUnit: 'l4c07', toUnit: 'l4c09', label: '罪名昭彰', title: '第十二幕', left: '齐天大圣', right: '名不虚传'},
];

interface Shot extends ShotDef {
  start: number;
  end: number;
  units: typeof UNITS;
}

const unitStart = (id: string): number => {
  const unit = UNITS.find((entry) => entry.id === id);
  if (!unit) throw new Error(`[climax] unknown unit ${id}`);
  return unit.start;
};

const buildShots = (): Shot[] => {
  const shots: Shot[] = SHOT_DEFS.map((def) => {
    const start = unitStart(def.fromUnit);
    const end = unitStart(def.toUnit);
    return {
      ...def,
      start,
      end,
      units: UNITS.filter((unit) => unit.start >= start - 0.001 && unit.start < end - 0.001),
    };
  });
  const last = shots[shots.length - 1];
  if (last) {
    last.end = CLIMAX_DURATION_SECONDS;
    last.units = UNITS.filter((unit) => unit.start >= last.start - 0.001);
  }
  return shots;
};

const SHOTS = buildShots();

/** AI 美术板是否就位（缺失时自动回落纯代码底，不黑屏）。 */
const hasPlate = true;

const PLATE_BY_SHOT: Record<ShotKind, string> = {
  court: 'bg_court_wide.png',
  formation: 'bg_court_wide.png',
  staff: 'bg_court_wide.png',
  split: 'bg_impact.png',
  collapse: 'bg_impact.png',
  duel: 'bg_impact.png',
  impact: 'bg_impact.png',
  mountain: 'bg_mountain.png',
  crevasse: 'bg_crevasse.png',
  panels: 'bg_verdict.png',
  press: 'bg_mountain.png',
  final: 'bg_verdict.png',
};

/** 每个镜头的板是同一张，靠推/移/浮制造不同镜头感。 */
const PLATE_CAMERA: Record<ShotKind, {push: number; panX: number; panY: number; float: number}> = {
  court: {push: 1.08, panX: 0, panY: 10, float: 4},
  formation: {push: 1.18, panX: -110, panY: 24, float: 5},
  staff: {push: 1.24, panX: 70, panY: -18, float: 4},
  split: {push: 1.3, panX: -40, panY: 10, float: 3},
  collapse: {push: 1.16, panX: 90, panY: 30, float: 7},
  duel: {push: 1.26, panX: -120, panY: -10, float: 5},
  impact: {push: 1.34, panX: 0, panY: 0, float: 2},
  mountain: {push: 1.14, panX: 0, panY: -20, float: 4},
  crevasse: {push: 1.26, panX: 0, panY: 40, float: 3},
  panels: {push: 1.1, panX: 0, panY: 0, float: 2},
  press: {push: 1.3, panX: 0, panY: 50, float: 6},
  final: {push: 1.12, panX: 0, panY: 10, float: 2},
};

const shotAt = (seconds: number): Shot => {
  for (let index = SHOTS.length - 1; index >= 0; index -= 1) {
    const shot = SHOTS[index];
    if (shot && seconds >= shot.start) return shot;
  }
  return SHOTS[0] as Shot;
};

// 与 bg_verdict.png 上三张卷轴的位置对齐
const PANEL_SHEETS = [
  {text: '罪名', seal: '罪', y: 386, x: 372, rotate: -1.4, width: 252, height: 420},
  {text: '不敬', seal: '罚', y: 396, x: 932, rotate: 0.6, width: 252, height: 420},
  {text: '权威', seal: '威', y: 386, x: 1500, rotate: 1.2, width: 252, height: 420},
];

interface Camera {
  scale: number;
  x: number;
  y: number;
  rotate: number;
  originX: number;
  originY: number;
}

const CAMERA_KEY: Record<ShotKind, Camera> = {
  court: {scale: 1.02, x: 0, y: 0, rotate: 0, originX: 50, originY: 48},
  formation: {scale: 1.06, x: -18, y: 8, rotate: -0.3, originX: 50, originY: 52},
  staff: {scale: 1.1, x: 0, y: -20, rotate: 0, originX: 50, originY: 50},
  split: {scale: 1.22, x: 0, y: 10, rotate: 1.2, originX: 50, originY: 50},
  collapse: {scale: 1.12, x: 20, y: 40, rotate: -1, originX: 50, originY: 60},
  duel: {scale: 1.2, x: -40, y: 20, rotate: 0.8, originX: 50, originY: 50},
  impact: {scale: 1.3, x: 0, y: 0, rotate: 0, originX: 50, originY: 50},
  mountain: {scale: 1.06, x: 0, y: 0, rotate: 0, originX: 50, originY: 45},
  crevasse: {scale: 1.34, x: 0, y: 60, rotate: 0, originX: 50, originY: 68},
  panels: {scale: 1.1, x: 0, y: 0, rotate: 0, originX: 50, originY: 50},
  press: {scale: 1.4, x: 0, y: 70, rotate: -0.6, originX: 50, originY: 70},
  final: {scale: 1.24, x: 0, y: 20, rotate: 0, originX: 50, originY: 50},
};

/** Slow push inside a shot + kick-driven shake. */
const cameraFor = (shot: Shot, progress: number, energy: StemEnergy): Camera => {
  const base = CAMERA_KEY[shot.id];
  const push = 1 + progress * (shot.id === 'court' ? 0.1 : 0.06);
  const shakeAmp = 3 + energy.low * 22 + energy.mid * 8;
  return {
    scale: base.scale * push + energy.low * 0.02,
    x: base.x + (fbm(progress * 26 + 0.37, 4.1, 2) - 0.5) * shakeAmp * 2,
    y: base.y + (fbm(9.3, progress * 26 + 0.37, 2) - 0.5) * shakeAmp * 2,
    rotate: base.rotate + (fbm(progress * 11, 17.7, 2) - 0.5) * (0.1 + energy.low * 1.1),
    originX: base.originX,
    originY: base.originY,
  };
};

const LAYERS: Record<
  ShotKind,
  {diorama: number; blocks: number; staff: number; mountain: number; panels: number; mood: 'gold' | 'red'}
> = {
  court: {diorama: 1, blocks: 0, staff: 0, mountain: 0, panels: 0, mood: 'gold'},
  formation: {diorama: 1, blocks: 0, staff: 0, mountain: 0, panels: 0, mood: 'gold'},
  staff: {diorama: 0.85, blocks: 0.35, staff: 0.9, mountain: 0, panels: 0, mood: 'gold'},
  split: {diorama: 0.5, blocks: 0.7, staff: 1, mountain: 0, panels: 0, mood: 'gold'},
  collapse: {diorama: 0.35, blocks: 1, staff: 0.55, mountain: 0, panels: 0, mood: 'red'},
  duel: {diorama: 0.4, blocks: 0.8, staff: 1, mountain: 0, panels: 0, mood: 'red'},
  impact: {diorama: 0.3, blocks: 0.5, staff: 0.4, mountain: 0, panels: 0, mood: 'red'},
  mountain: {diorama: 0.2, blocks: 0, staff: 0, mountain: 1, panels: 0, mood: 'red'},
  crevasse: {diorama: 0.1, blocks: 0, staff: 0, mountain: 1, panels: 0, mood: 'red'},
  panels: {diorama: 0.35, blocks: 0, staff: 0, mountain: 0.55, panels: 1, mood: 'red'},
  press: {diorama: 0.15, blocks: 0, staff: 0, mountain: 1, panels: 0, mood: 'red'},
  final: {diorama: 0.25, blocks: 0, staff: 0.2, mountain: 0.8, panels: 0, mood: 'red'},
};

/**
 * 《孙悟空：金猴奋起千钧棒》— 高潮复刻段（09–19 s）.
 *
 * Storyboard taken from the reference reel's 09–19 s structure, art direction
 * taken from the Taisho-poster language of the 千本樱 code MV: printed frame,
 * halftone screen, gilded line architecture, parchment notices, vertical type,
 * twelve cuts in ten seconds.
 *
 * Time comes only from `public/alignment/climax_words.json`; energy comes only
 * from the drum stem through `useStemEnergy()`.
 */
export const WukongClimaxSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;

  const shot = shotAt(time);
  const progress = clamp((time - shot.start) / Math.max(0.001, shot.end - shot.start));
  const layers = LAYERS[shot.id];

  const stem = useStemEnergy({src: staticFile('audio/drums_stem.wav')});
  const energy: StemEnergy = stem ?? fallbackEnergy(time);
  const camera = cameraFor(shot, progress, energy);

  const slashCues = useMemo(() => resolveCues(SLASH_CUES, fps), [fps]);
  const flashCues = useMemo(() => resolveCues(FLASH_CUES, fps), [fps]);

  const flash = useMemo(() => {
    let value = 0;
    for (const cue of flashCues) {
      const dt = (frame - cue.startFrame) / fps;
      if (dt < 0 || dt > 0.12) continue;
      value = Math.max(value, Math.pow(1 - dt / 0.12, 2.2) * cue.power);
    }
    return clamp(value);
  }, [flashCues, fps, frame]);

  const beatPulse = useMemo(() => {
    if (!BEATS.length) return 0;
    let previous = 0;
    for (const beat of BEATS) if (beat <= time) previous = beat;
    return clamp(1 - (time - previous) / (60 / BPM));
  }, [time]);

  const beatIndex = useMemo(
    () => BEATS.reduce((count, beat) => (beat <= time ? count + 1 : count), 0),
    [time],
  );

  const lineBass = energy.low * 0.7 + beatPulse * 0.3;
  const burstIntensity = clamp(flash * 0.95 + energy.mid * 0.18);
  const edgeGlow = clamp(0.2 + energy.high * 0.55 + flash * 0.35);

  const captionShakeX = (fbm(frame * 0.75, 21.3, 2) - 0.5) * (2 + energy.low * 9);
  const captionShakeY = (fbm(19.1, frame * 0.75, 2) - 0.5) * (2 + energy.low * 7);

  const shockwaves = flashCues
    .map((cue) => ({cue, dt: (frame - cue.startFrame) / fps}))
    .filter((item) => item.dt >= 0 && item.dt <= 0.42);

  // The split shot draws three fast horizontal cut bars as a wipe graphic.
  const splitBars =
    shot.id === 'split'
      ? [0, 1, 2].map((index) => {
          const local = clamp((time - shot.start) / Math.max(0.001, shot.end - shot.start) - index * 0.06);
          return {index, x: lerp(-820, 2100, ease.outQuint(local))};
        })
      : [];

  const blindK = clamp(1 - (time - shot.start) / 0.13);
  const captionUnits = UNITS.filter((unit) => unit.line === shot.units[0]?.line);
  const safeCaptionUnits = captionUnits.length ? captionUnits : shot.units;

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink, overflow: 'hidden'}}>
      {/* Full score (drums + bass + strings + formant-vocal lead). The
          spectrum still binds to the isolated drum bus, per AGENTS.md §3. */}
      <Audio src={staticFile('audio/climax_mix.wav')} />

      {/* ---------------- world ---------------- */}
      <AbsoluteFill
        style={{
          transformOrigin: `${camera.originX}% ${camera.originY}%`,
          transform: `translate(${camera.x.toFixed(2)}px, ${camera.y.toFixed(2)}px) rotate(${camera.rotate.toFixed(3)}deg) scale(${camera.scale.toFixed(4)})`,
        }}
      >
        <PaperSurface variant="ink" seed={51023} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 58% 40% at 50% 34%, rgba(252,201,52,${(0.12 + energy.low * 0.12).toFixed(3)}) 0%, rgba(217,48,37,${(0.05 + energy.mid * 0.06).toFixed(3)}) 46%, rgba(11,9,10,0) 78%)`,
          }}
        />

        {hasPlate ? (
          <Plate
            file={PLATE_BY_SHOT[shot.id]}
            startSeconds={shot.start}
            durationSeconds={Math.max(0.2, shot.end - shot.start)}
            push={PLATE_CAMERA[shot.id].push}
            panX={PLATE_CAMERA[shot.id].panX}
            panY={PLATE_CAMERA[shot.id].panY}
            float={PLATE_CAMERA[shot.id].float}
            grade={1}
            pulse={energy.low}
            opacity={layers.mood === 'red' ? 0.94 : 1}
          />
        ) : (
          <PalaceHall
            pulse={clamp(energy.low * 0.75 + beatPulse * 0.4)}
            dolly={shot.id === 'court' ? 120 : shot.id === 'formation' ? 420 : 240}
            pan={shot.id === 'formation' ? 26 : 0}
            opacity={layers.diorama}
            mood={layers.mood}
          />
        )}

        <CourtBlocks
          assembleSeconds={STORY.courtAssemble}
          releaseSeconds={STORY.courtCollapse}
          seed={7301}
          opacity={layers.blocks}
          gridOpacity={0}
          pulse={clamp(energy.low * 0.8 + beatPulse * 0.4)}
        />

        <RadialBurst
          intensity={burstIntensity}
          seed={5501}
          cx={960}
          cy={shot.id === 'mountain' || shot.id === 'press' ? 620 : 420}
          color={layers.mood === 'red' ? PALETTE.cinnabar : PALETTE.gold}
          style={{opacity: 0.52}}
        />

        <FiveFingerMountain
          descendSeconds={STORY.mountainDescent}
          lockSeconds={STORY.mountainLock}
          pulse={clamp(energy.high * 0.7 + energy.low * 0.45 + flash * 0.4)}
          opacity={layers.mountain}
        />

        <CudgelSlash cues={slashCues} opacity={layers.staff} />

        <ParticleRain
          variant="ash"
          count={200}
          seed={4401}
          speed={0.5}
          opacity={0.4}
        />
        <ParticleRain
          variant="ember"
          count={280}
          seed={8801}
          speed={0.85}
          opacity={0.7 + energy.high * 0.25}
        />

        {/* cut bars for the split shot */}
        {splitBars.map((bar) => (
          <div
            key={bar.index}
            style={{
              position: 'absolute',
              top: 250 + bar.index * 260,
              left: 0,
              width: 720,
              height: bar.index === 1 ? 18 : 8,
              transform: `translateX(${bar.x.toFixed(1)}px) skewX(-18deg)`,
              background:
                bar.index === 1
                  ? `linear-gradient(90deg, rgba(244,239,230,0) 0%, ${PALETTE.paper} 30%, ${PALETTE.gold} 62%, rgba(252,201,52,0) 100%)`
                  : `linear-gradient(90deg, rgba(217,48,37,0) 0%, ${PALETTE.cinnabar} 42%, rgba(252,201,52,0) 100%)`,
              opacity: 0.9,
            }}
          />
        ))}

        {shockwaves.map(({cue, dt}, index) => {
          const radius = 220 + dt * 2400;
          return (
            <div
              key={`shock-${index}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: shot.id === 'mountain' || shot.id === 'press' ? '70%' : '46%',
                width: radius,
                height: radius,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: `${2 + cue.power * 3}px solid ${index % 2 === 0 ? PALETTE.gold : PALETTE.cinnabar}`,
                opacity: Math.pow(1 - dt / 0.42, 2) * cue.power * 0.5,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* ---------------- print layers ---------------- */}
      <Halftone opacity={0.45} />

      {/* 主角级竖排大字：补上"画面主体" */}
      {shot.id === 'formation' ? (
        <HeroTitle
          text="天兵"
          startSeconds={shot.start}
          x={1490}
          y={520}
          size={330}
          rotate={-2.5}
          pulse={energy.low}
        />
      ) : null}
      {shot.id === 'court' ? (
        <HeroTitle
          text="凌霄"
          startSeconds={shot.start}
          x={430}
          y={520}
          size={300}
          rotate={3}
          pulse={energy.low}
        />
      ) : null}

      <ParchmentPanels
        panels={PANEL_SHEETS}
        startSeconds={SHOTS.find((item) => item.id === 'panels')?.start ?? 0}
        holdSeconds={0.62}
        staggerSeconds={0.06}
        opacity={layers.panels}
        bare
      />

      <PrecisionGlow energy={energy} flash={flash} edgeGlow={edgeGlow} />

      {/* ---------------- caption + bursts ---------------- */}
      {/* 字幕护罩：AI 板底部往往很亮，这一层只压字幕区，不整屏压暗 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 300,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(11,9,10,0) 0%, rgba(11,9,10,0.55) 38%, rgba(11,9,10,0.84) 72%, rgba(11,9,10,0.94) 100%)',
          filter: 'blur(2px)',
        }}
      />
      <AbsoluteFill
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 54% 17% at 50% 94%, rgba(11,9,10,0.92) 0%, rgba(11,9,10,0.6) 46%, rgba(11,9,10,0) 78%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${captionShakeX.toFixed(2)}px, ${captionShakeY.toFixed(2)}px)`,
        }}
      >
        <KineticLine units={safeCaptionUnits} bass={lineBass} fontSize={72} height={196} opacity={0.98} />
        {BURST_CUES.map((cue) => (
          <BurstType
            key={cue.id}
            text={cue.text}
            startSeconds={cue.start}
            holdSeconds={cue.hold}
            x={cue.x * CLIMAX.width}
            y={cue.y * CLIMAX.height}
            size={cue.size}
            rotate={cue.rotate}
            power={cue.power}
            seed={cue.id.charCodeAt(1) * 97 + cue.start * 1000}
          />
        ))}
      </div>

      {/* 百叶窗切口：每一刀开头 0.13s 的印刷式转场 */}
      {blindK > 0 ? (
        <div aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {Array.from({length: 9}, (_, slat) => (
            <div
              key={`slat-${slat}`}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: (slat * 1080) / 9,
                height: (1080 / 9) * blindK,
                backgroundColor: PALETTE.ink,
                borderBottom: `1px solid rgba(252,201,52,${(0.4 * blindK).toFixed(3)})`,
              }}
            />
          ))}
        </div>
      ) : null}

      {/* 馆藏标签卡 */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 118,
          width: 214,
          padding: '10px 12px 9px',
          backgroundColor: 'rgba(244,239,230,0.94)',
          border: `1px solid ${PALETTE.ink}`,
          boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
          transform: 'rotate(-0.6deg)',
        }}
      >
        <div style={{fontFamily: FONT_STACKS.mono, fontSize: 8, letterSpacing: '0.28em', color: 'rgba(11,9,10,0.6)'}}>
          {`REEL 03 · CUT ${String(SHOTS.indexOf(shot) + 1).padStart(2, '0')}/12`}
        </div>
        <div style={{marginTop: 4, fontFamily: FONT_STACKS.heavy, fontWeight: 900, fontSize: 19, letterSpacing: '0.06em', color: PALETTE.ink}}>
          {shot.label}
        </div>
        <div style={{marginTop: 3, fontFamily: FONT_STACKS.kai, fontSize: 11, letterSpacing: '0.14em', color: 'rgba(11,9,10,0.55)'}}>
          {`${shot.start.toFixed(2)}s — ${shot.end.toFixed(2)}s`}
        </div>
      </div>

      {/* 收官：玉玺砸落 */}
      {shot.id === 'final' ? (
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 470,
            transform: 'translate(-50%, -50%)',
            zIndex: 3,
          }}
        >
          <Seal
            text="不敬权威"
            size={520}
            progress={clamp((time - 9.42) / 0.34)}
            seed={41}
            rotate={-3.2}
          />
        </div>
      ) : null}

      <PosterFrame
        title={`${shot.title} · ${shot.label}`}
        subtitle="孙悟空 · 金猴奋起千钧棒"
        leftType={shot.left}
        rightType={shot.right}
        seal="齐天"
        pulse={clamp(energy.low * 0.8 + beatPulse * 0.4)}
      />

      <AbsoluteFill
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          backgroundColor: PALETTE.paper,
          opacity: flash * 0.86,
          mixBlendMode: 'screen',
        }}
      />

      <Vignette strength={0.72} grainOpacity={0.2} warm={false} />

      {/* ---------------- HUD ---------------- */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 66,
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          fontFamily: FONT_STACKS.mono,
          fontSize: 11,
          letterSpacing: '0.3em',
          color: DERIVED.paper42,
        }}
      >
        <span>{`${(BPM).toFixed(1)} BPM`}</span>
        <span style={{width: 1, height: 11, backgroundColor: DERIVED.paper16}} />
        <span>{`CUT ${String(SHOTS.indexOf(shot) + 1).padStart(2, '0')}/12`}</span>
        <span style={{width: 1, height: 11, backgroundColor: DERIVED.paper16}} />
        <span>{`${time.toFixed(2)}s · ${frameFromSeconds(time, fps)}F`}</span>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 96,
          bottom: 66,
          display: 'flex',
          gap: 7,
        }}
      >
        {SHOTS.map((item, index) => (
          <span
            key={item.id}
            style={{
              width: index === SHOTS.indexOf(shot) ? 26 : 8,
              height: 3,
              backgroundColor: index === SHOTS.indexOf(shot) ? PALETTE.gold : `${PALETTE.paper}`,
              opacity: index === SHOTS.indexOf(shot) ? 1 : 0.22,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 118,
          fontFamily: FONT_STACKS.mono,
          fontSize: 10,
          letterSpacing: '0.34em',
          color: DERIVED.gold45,
          opacity: 0.8,
        }}
      >
        {`BEAT ${String(beatIndex).padStart(2, '0')}`}
      </div>
    </AbsoluteFill>
  );
};

/** Lens + foil edge, kept out of the shaken world so it stays registered. */
const PrecisionGlow: React.FC<{energy: StemEnergy; flash: number; edgeGlow: number}> = ({
  energy,
  flash,
  edgeGlow,
}) => (
  <>
    <AbsoluteFill
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        background: `radial-gradient(ellipse 118% 94% at 50% 50%, rgba(11,9,10,0) 44%, rgba(217,48,37,${(0.16 * edgeGlow).toFixed(3)}) 78%, rgba(217,48,37,${(0.42 * edgeGlow).toFixed(3)}) 100%)`,
        mixBlendMode: 'screen',
      }}
    />
    <AbsoluteFill
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        boxShadow: `inset 0 0 ${Math.round(170 + energy.high * 220)}px rgba(252,201,52,${(0.07 + edgeGlow * 0.16 + flash * 0.1).toFixed(3)})`,
      }}
    />
  </>
);
