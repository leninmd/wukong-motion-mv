import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CLIMAX_ASSETS} from './ClimaxAsset';
import {InkSpecks, PaperField, WASHI} from './PaperStage';
import {HeavySeal} from './HeavySeal';
import {SERIF_STACK, SENBON, clamp01, easeOutCubic, f, overshoot} from './style';

/**
 * `<WoodblockJumpCuts />` —— V8 的 Sub4B：四连跨量级跳切。
 *
 * V7 的 `SCALES = [1.0, 1.02, 1.04, 1.0]` 是"蚊子腿"：2% 的缩放肉眼不可见，
 * 256–290 帧看起来像视频卡住。V8 的每一次跳切都是构图与色彩的双重断裂：
 *
 *   不 1.05× / 0°   宣纸木刻     —— 正面怒视
 *   敬 1.42× / −6°  黑金红双色   —— 面部中景
 *   权 1.95× / +5°  红底黑线冲击 —— 燃烧双眼极近特写
 *   威 1.25× / 0°   宣纸木刻     —— 回弹，四印同震
 *
 * 取景不再是"居中贴图 + FACE_SHIFT 盲移"，而是把素材的**双眼中心**
 * (675, 592) 换算成 `transform-origin`，缩放/旋转都绕眼睛发生，因此四个
 * 倍率下双眼始终钉在画面 45% 高度。
 */

export interface SealSpec {
  id: string;
  text: string;
  landAt: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
}

export interface JumpCutSpec {
  scale: number;
  rotate: number;
  tone: 'paper' | 'duotone' | 'impact';
  text: string;
  sealIndex: number;
}

export interface WoodblockJumpCutsProps {
  time: number;
  cuts: readonly number[];
  specs: readonly JumpCutSpec[];
  seals: readonly SealSpec[];
  whiteFlash: number;
  pulse?: number;
  high?: number;
}

const FACE_SIZE = 2048;
/*
 * 素材双眼中心：用橙色虹膜的连通域量出来是 (836, 714)，不是凭肉眼估的
 * (678, 612)。V8 第一版按错误锚点对齐，结果双眼整体偏右下 160px，
 * 嘴部被裁掉。现在 1.05× 就能同时看到双眼和怒吼的嘴。
 */
const EYE_X = 836;
const EYE_Y = 714;
const TARGET_X = 960;
const TARGET_Y = 486;

export const WoodblockJumpCuts: React.FC<WoodblockJumpCutsProps> = ({
  time,
  cuts,
  specs,
  seals,
  whiteFlash,
  pulse = 0,
  high = 0,
}) => {
  let index = -1;
  let age = 0;
  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    if (time >= (cuts[i] ?? Infinity)) {
      index = i;
      age = time - (cuts[i] ?? time);
      break;
    }
  }
  if (index < 0) return null;
  index = Math.min(index, specs.length - 1);
  const spec = specs[index]!;
  const slam = clamp01(age / 0.035);
  const drift = clamp01(age / 0.267);
  const scale = spec.scale * (1 + (index === 3 ? drift * 0.02 : drift * 0.012));
  const tone = spec.tone;
  const isImpact = tone === 'impact';
  const isDuotone = tone === 'duotone';

  const faceFilter = isImpact
    ? 'grayscale(1) contrast(1.7) brightness(1.72)'
    : isDuotone
      ? 'grayscale(1) contrast(1.34) brightness(1.02)'
      : `contrast(1.1) saturate(1.05) brightness(${1 + pulse * 0.05})`;

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: isImpact ? '#B3261E' : '#0B090A'}}>
      {/* 底色 */}
      {isImpact ? (
        <AbsoluteFill>
          <AbsoluteFill
            style={{
              background:
                'radial-gradient(ellipse 76% 72% at 50% 46%, #E03A24 0%, #B3261E 40%, #6A0E0B 74%, #2A0504 100%)',
            }}
          />
          <AbsoluteFill
            style={{
              background: 'repeating-linear-gradient(0deg, rgba(30,3,3,0.22) 0px, rgba(30,3,3,0.22) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)',
              mixBlendMode: 'multiply',
            }}
          />
        </AbsoluteFill>
      ) : isDuotone ? (
        <AbsoluteFill>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 74% at 50% 48%, #2A1A10 0%, #140C0B 56%, #080506 100%)'}} />
          <AbsoluteFill
            style={{
              background: 'linear-gradient(128deg, rgba(217,48,37,0.85) 0%, rgba(120,24,16,0.5) 44%, rgba(252,201,52,0.5) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
        </AbsoluteFill>
      ) : (
        <PaperField tone={WASHI.paperBright} seed={9331} vignette={0.18}>
          <InkSpecks count={64} seed={9447} time={time} color={WASHI.ink} spread={1.1} />
        </PaperField>
      )}

      {/* 真实版画怒颜：绕双眼中心缩放/旋转 */}
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute',
            left: TARGET_X - EYE_X,
            top: TARGET_Y - EYE_Y,
            width: FACE_SIZE,
            height: FACE_SIZE,
            transform: `rotate(${f(spec.rotate)}deg) scale(${f(scale)})`,
            transformOrigin: `${EYE_X}px ${EYE_Y}px`,
            filter: faceFilter,
            mixBlendMode: isImpact ? 'multiply' : 'normal',
            opacity: 0.98,
            willChange: 'transform',
          }}
        >
          <Img
            src={staticFile(CLIMAX_ASSETS.face.file)}
            style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </div>
      </AbsoluteFill>

      {/* 双色调：黑金红版画。`color` 混合保留灰度脸的明度，只换上朱砂/鎏金的色相 */}
      {isDuotone ? (
        <>
          <AbsoluteFill
            style={{
              background: 'linear-gradient(120deg, #FF6A4A 0%, #D93025 38%, #8E1A13 62%, #F5C242 100%)',
              mixBlendMode: 'multiply',
              opacity: 0.92,
            }}
          />
          <AbsoluteFill
            style={{
              background: 'repeating-linear-gradient(0deg, rgba(20,8,6,0.26) 0px, rgba(20,8,6,0.26) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)',
              mixBlendMode: 'multiply',
            }}
          />
          <AbsoluteFill
            style={{
              background: 'radial-gradient(ellipse 56% 50% at 50% 42%, rgba(255,236,170,0.2) 0%, rgba(255,236,170,0) 70%)',
              mixBlendMode: 'screen',
            }}
          />
        </>
      ) : null}

      {isImpact ? (
        <>
          {/* 红底黑线：灰度脸先提亮再 multiply，亮部变朱砂、墨线保留 */}
          <AbsoluteFill
            style={{
              background: 'linear-gradient(180deg, rgba(255,96,56,0.18) 0%, rgba(170,24,16,0.18) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
          {/* 只留一圈极淡的中心鎏金辉光，避免在眼睛位置糊出两个大圆 */}
          <AbsoluteFill
            style={{
              background: 'radial-gradient(ellipse 34% 26% at 50% 44%, rgba(255,214,110,0.2) 0%, rgba(255,214,110,0) 72%)',
              mixBlendMode: 'screen',
            }}
          />
        </>
      ) : null}

      {/* 双色/反色印张里的火眼金睛补充光：按实测眼距与倍率算出两只眼的位置 */}
      {(isDuotone || isImpact) && (() => {
        const eyeScale = spec.scale;
        const left = {x: 960 - 288 * eyeScale, y: 486 + 42 * eyeScale};
        const right = {x: 960 + 288 * eyeScale, y: 486 - 42 * eyeScale};
        return (
          <svg
            viewBox="0 0 1920 1080"
            width="1920"
            height="1080"
            style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', opacity: isImpact ? 0.95 : 0.7}}
          >
            <defs>
              <radialGradient id="v8-eye-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF7DA" stopOpacity="0.95" />
                <stop offset="28%" stopColor="#FFD34D" stopOpacity="0.72" />
                <stop offset="62%" stopColor="#C8281E" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#C8281E" stopOpacity="0" />
              </radialGradient>
            </defs>
            {[left, right].map((eye, index) => (
              <g key={`eye-glow-${index}`}>
                <ellipse cx={f(eye.x)} cy={f(eye.y)} rx={f(150 * (eyeScale / 1.6))} ry={f(104 * (eyeScale / 1.6))} fill="url(#v8-eye-glow)" />
                <ellipse cx={f(eye.x)} cy={f(eye.y)} rx={f(46 * (eyeScale / 1.6))} ry={f(24 * (eyeScale / 1.6))} fill="#FFF7DA" opacity="0.45" />
              </g>
            ))}
          </svg>
        );
      })()}

      {/* 跳切时的斜向刀光：每个 cut 的第一帧最长 */}
      {age < 0.18 ? (
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen'}}>
          {[0, 1].map((layer) => (
            <line
              key={`cut-slash-${layer}`}
              x1={-80}
              y1={f(940 - index * 120 - layer * 26)}
              x2={2020}
              y2={f(180 + index * 90 - layer * 20)}
              stroke={layer === 0 ? SENBON.goldPale : SENBON.cinnabar}
              strokeWidth={layer === 0 ? 9 : 26}
              opacity={(1 - age / 0.18) * (layer === 0 ? 0.55 : 0.2)}
            />
          ))}
          {Array.from({length: 16}, (_, spark) => {
            const t = spark / 16;
            const x = -80 + t * 2100;
            const y = 940 - index * 120 - t * 760;
            const spread = age * 160;
            return (
              <circle
                key={`cut-spark-${spark}`}
                cx={f(x + Math.sin(spark * 2.1 + index) * spread)}
                cy={f(y + Math.cos(spark * 1.7 + index) * spread * 0.7)}
                r={f(1.4 + (spark % 4) * 1.6)}
                fill={spark % 3 === 0 ? '#FFF7DA' : spark % 3 === 1 ? '#F5C242' : '#C8281E'}
                opacity={(1 - age / 0.18) * 0.9}
              />
            );
          })}
        </svg>
      ) : null}

      {/* 左侧竖排巨字：半出画，只做构图，不挡眼 */}
      <div
        style={{
          position: 'absolute',
          left: -26,
          bottom: 48,
          fontFamily: SERIF_STACK,
          fontSize: 176,
          lineHeight: 0.86,
          fontWeight: 900,
          color: isImpact ? '#F5C242' : isDuotone ? '#F5C242' : WASHI.ink,
          opacity: clamp01(age / 0.02) * (isImpact ? 0.5 : 0.3),
          transform: `translateY(${f((1 - easeOutCubic(slam)) * 26)}px)`,
          textShadow: isImpact ? '0 0 24px rgba(245,194,66,0.4)' : '4px 4px 0 rgba(217,48,37,0.14)',
          zIndex: 2,
        }}
      >
        {spec.text}
      </div>

      {/* 四角实心破壁巨印 */}
      {seals.map((seal, sealIndex) => {
        const sealAge = time - seal.landAt;
        if (sealAge < 0) return null;
        const drop = overshoot(clamp01(sealAge / 0.14), 9, 8);
        const factor = 2.1 - drop * 1.1;
        const quake = index === 3 && sealAge > 0 ? Math.sin(time * 88 + sealIndex) * 6 : 0;
        return (
          <div
            key={seal.id}
            style={{
              position: 'absolute',
              left: seal.x - seal.size / 2 + quake,
              top: seal.y - seal.size / 2 + Math.cos(time * 71 + sealIndex) * 3,
              width: seal.size,
              height: seal.size,
              transform: `rotate(${seal.rotate}deg) scale(${f(factor)})`,
              transformOrigin: '50% 50%',
              opacity: clamp01(sealAge / 0.04) * 0.98,
              zIndex: 6,
            }}
          >
            <HeavySeal text={seal.text} size={seal.size} tone={sealIndex % 2 === 0 ? 'ink' : 'cinnabar'} />
          </div>
        );
      })}

      {/* 290 帧白光 */}
      {time >= whiteFlash ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#FFF8E6',
            opacity: clamp01(1 - (time - whiteFlash) / 0.075),
            mixBlendMode: 'screen',
            zIndex: 8,
          }}
        />
      ) : null}

      {/* 金粉闪点 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', zIndex: 5}}>
        {Array.from({length: 34}, (_, spark) => {
          const angle = (spark / 34) * Math.PI * 2 + index;
          const radius = 220 + ((spark * 53) % 520) + high * 120 + age * 80;
          return (
            <circle
              key={`flash-spark-${spark}`}
              cx={f(960 + Math.cos(angle) * radius)}
              cy={f(486 + Math.sin(angle) * radius * 0.72)}
              r={f(1.4 + (spark % 4) * 1.5)}
              fill={spark % 3 === 0 ? SENBON.cinnabar : SENBON.gold}
              opacity={0.18 + (spark % 5) * 0.08}
            />
          );
        })}
      </svg>

      {/* 画面裂纹：每一次跳切整体外扩 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4}}>
        {Array.from({length: 9}, (_, branch) => {
          const corner = branch % 4;
          const ox = corner === 0 || corner === 3 ? 0 : 1920;
          const oy = corner < 2 ? 0 : 1080;
          const len = 160 + ((branch * 37) % 200) + age * 180;
          const angle = (corner * Math.PI) / 2 + Math.PI / 4 + ((branch % 3) - 1) * 0.24;
          const mx = ox + Math.cos(angle) * len * 0.55;
          const my = oy + Math.sin(angle) * len * 0.55;
          const ex = ox + Math.cos(angle) * len;
          const ey = oy + Math.sin(angle) * len;
          return (
            <polyline
              key={`crack-${branch}`}
              points={`${ox},${oy} ${f(mx)},${f(my)} ${f(ex)},${f(ey)}`}
              fill="none"
              stroke={isImpact ? '#1B0708' : isDuotone ? '#F5C242' : WASHI.ink}
              strokeWidth={2.6}
              opacity={0.5}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default WoodblockJumpCuts;
