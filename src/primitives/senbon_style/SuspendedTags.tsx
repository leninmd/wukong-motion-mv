import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {IronChain} from './IronChain';
import {SERIF_STACK, SENBON, easeOutCubic, f} from './style';

/**
 * Shot 4A —— 纯黑深渊悬签阵。
 *
 * 背景是 **#050404 纯黑**，不铺任何会把黑场抬灰的大面积渐变，更不允许残留
 * 上一幕的大圣（V3 在 225–256 帧背景里露出一截猴子剪影，是严重穿帮）。
 *
 * 层级：
 *   · 顶部三道实体铁索（IronChain，带环扣与铭文）
 *   · 远 / 中 / 近三层惨白罪状木牌，各自随风扇动
 *   · 一束游走的聚光灯扫过前景三块主牌，依次翻面亮出【罪名】【是】【老孙】
 *   · 金色火星缓缓坠落
 */
export interface HeroTagSpec {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  revealAt: number;
}

export interface SuspendedTagsProps {
  time: number;
  frame: number;
  heroes: readonly HeroTagSpec[];
  pulse?: number;
}

const FILLER = ['罪', '名', '欺', '天', '妄', '言', '犯', '上', '狂', '徒', '逆', '天', '不', '臣', '妖', '猴', '当', '诛', '天', '条'];

interface TagData {
  id: string;
  text: string;
  x: number;
  top: number;
  width: number;
  height: number;
  depth: 0 | 1 | 2;
  phase: number;
  amp: number;
  cordY: number;
  opacity: number;
  blur: number;
}

const Tag: React.FC<{tag: TagData; time: number; pulse: number}> = ({tag, time, pulse}) => {
  const swing = Math.sin(time * (0.72 + tag.depth * 0.22) + tag.phase) * tag.amp;
  const fontSize = Math.min(tag.width * 0.62, tag.height * 0.21);
  return (
    <div
      style={{
        position: 'absolute',
        left: tag.x - tag.width / 2,
        top: tag.top,
        width: tag.width,
        height: tag.height,
        transformOrigin: '50% 0%',
        transform: `rotate(${f(swing)}deg)`,
        opacity: tag.opacity,
        filter: tag.blur > 0 ? `blur(${f(tag.blur)}px)` : undefined,
      }}
    >
      {/* 吊绳 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: -tag.cordY,
          width: 2,
          height: tag.cordY,
          backgroundColor: 'rgba(207,200,186,0.34)',
          transform: 'translateX(-50%)',
        }}
      />
      {/* 木牌 / 纸签 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: tag.depth === 2 ? '#E9E1D2' : SENBON.paperDim,
          border: `2px solid ${SENBON.paperShade}`,
          boxShadow: '0 18px 34px rgba(0,0,0,0.82), inset 0 0 22px rgba(120,104,78,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* 纸纹 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(120,104,78,0.08) 0px, rgba(120,104,78,0.08) 0.6px, transparent 0.6px, transparent 4px)',
            opacity: 0.7,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(110,92,64,0.12) 0.8px, rgba(110,92,64,0) 1.2px)',
            backgroundSize: '7px 7px',
            opacity: 0.55,
          }}
        />
        {/* 顶部钉眼 */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 10,
            width: 9,
            height: 9,
            borderRadius: '50%',
            backgroundColor: '#2A2118',
            transform: 'translateX(-50%)',
            boxShadow: 'inset 0 0 2px #000',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '8%',
            bottom: '7%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            width: '100%',
            fontFamily: SERIF_STACK,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.02,
            letterSpacing: '0.08em',
            color: '#141011',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          {tag.text}
        </div>
        {/* 朱砂押印 */}
        {tag.depth === 2 ? (
          <div
            style={{
              position: 'absolute',
              right: '12%',
              bottom: '5%',
              width: '24%',
              aspectRatio: '1 / 1',
              backgroundColor: SENBON.cinnabar,
              border: '1px solid #8E1A13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SERIF_STACK,
              fontWeight: 900,
              fontSize: fontSize * 0.34,
              color: SENBON.paper,
              opacity: 0.86,
            }}
          >
            押
          </div>
        ) : null}
      </div>
      {pulse > 0.5 && tag.depth === 2 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 30%, rgba(255,247,218,${(pulse - 0.5) * 0.3}) 0%, rgba(255,247,218,0) 70%)`,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </div>
  );
};

const HeroTag: React.FC<{tag: HeroTagSpec; time: number; pulse: number}> = ({tag, time, pulse}) => {
  const local = clamp((time - tag.revealAt) / 0.28);
  const swing = Math.sin(time * 0.9 + tag.x * 0.01) * 1.6;
  const flip = easeOutCubic(local) * 180;
  const flash = local > 0 && local < 0.45 ? 1 - local / 0.45 : 0;
  const fontSize = Math.min(tag.width * 0.62, tag.height * 0.2);

  return (
    <div
      style={{
        position: 'absolute',
        left: tag.x - tag.width / 2,
        top: tag.y,
        width: tag.width,
        height: tag.height,
        perspective: 1400,
        transformOrigin: '50% 0%',
        transform: `rotate(${f(swing)}deg)`,
      }}
    >
      {/* 吊绳 */}
      <div style={{position: 'absolute', left: '50%', top: -tag.y, width: 3, height: tag.y, backgroundColor: 'rgba(207,200,186,0.4)', transform: 'translateX(-50%)'}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateY(${f(flip)}deg)`,
        }}
      >
        {/* 正面：空白罪签 + 三道朱砂划痕 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            backgroundColor: '#E7DFD0',
            border: `2px solid ${SENBON.paperShade}`,
            boxShadow: '0 22px 46px rgba(0,0,0,0.85), inset 0 0 28px rgba(120,104,78,0.34)',
            overflow: 'hidden',
          }}
        >
          <div style={{position: 'absolute', left: '50%', top: 12, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2A2118', transform: 'translateX(-50%)'}} />
          {[0, 1, 2].map((index) => (
            <div
              key={`tally-${index}`}
              style={{
                position: 'absolute',
                left: `${30 + index * 20}%`,
                top: '16%',
                width: 5,
                height: '16%',
                backgroundColor: 'rgba(217,48,37,0.36)',
                transform: `rotate(${index % 2 === 0 ? 6 : -5}deg)`,
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '46%',
              transform: 'translate(-50%, -50%)',
              fontFamily: SERIF_STACK,
              fontSize: fontSize * 0.28,
              letterSpacing: '0.2em',
              color: 'rgba(60,48,34,0.34)',
              whiteSpace: 'nowrap',
            }}
          >
            待 判
          </div>
        </div>
        {/* 背面：罪名 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: '#F0E9DC',
            border: `2px solid ${SENBON.paperShade}`,
            boxShadow: '0 22px 46px rgba(0,0,0,0.85), inset 0 0 30px rgba(120,104,78,0.32)',
            overflow: 'hidden',
          }}
        >
          <div style={{position: 'absolute', inset: 10, border: `1px solid rgba(142,26,19,0.42)`}} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '7%',
              bottom: '10%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              writingMode: 'vertical-rl',
              width: '100%',
              fontFamily: SERIF_STACK,
              fontWeight: 900,
              fontSize,
              lineHeight: 1.02,
              letterSpacing: '0.06em',
              color: '#141011',
              whiteSpace: 'nowrap',
              textShadow: '0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            {tag.text}
          </div>
          <div
            style={{
              position: 'absolute',
              right: '10%',
              bottom: '4.5%',
              width: '23%',
              aspectRatio: '1 / 1',
              backgroundColor: SENBON.cinnabar,
              border: '1px solid #8E1A13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: SERIF_STACK,
              fontWeight: 900,
              fontSize: fontSize * 0.3,
              color: SENBON.paper,
            }}
          >
            罪
          </div>
        </div>
      </div>
      {/* 翻面白闪 */}
      {flash > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: -18,
            background: `radial-gradient(circle, rgba(255,247,218,${flash * 0.55}) 0%, rgba(255,247,218,0) 68%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 落定后的聚光 */}
      {local > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(115deg, rgba(255,247,218,0) 20%, rgba(255,247,218,${0.12 + pulse * 0.06}) 48%, rgba(255,247,218,0) 72%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};

export const SuspendedTags: React.FC<SuspendedTagsProps> = ({time, frame, heroes, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `tags-${rawId}-${suffix}`;

  const tags = useMemo<TagData[]>(() => {
    const far: TagData[] = Array.from({length: 12}, (_, index) => ({
      id: `far-${index}`,
      text: FILLER[index % FILLER.length]!,
      x: 92 + index * 156,
      top: 108 + (index % 3) * 26,
      width: 58 + (index % 4) * 4,
      height: 214 + (index % 5) * 20,
      depth: 0,
      phase: index * 0.83,
      amp: 1.2,
      cordY: 108 + (index % 3) * 26,
      opacity: 0.22,
      blur: 1.8,
    }));
    const mid: TagData[] = Array.from({length: 8}, (_, index) => ({
      id: `mid-${index}`,
      text: FILLER[(index + 5) % FILLER.length]!,
      x: 170 + index * 228,
      top: 176 + (index % 2) * 32,
      width: 92 + (index % 3) * 8,
      height: 324 + (index % 4) * 24,
      depth: 1,
      phase: index * 1.27 + 0.6,
      amp: 2.3,
      cordY: 176 + (index % 2) * 32,
      opacity: 0.48,
      blur: 0.8,
    }));
    const edges: TagData[] = [
      {id: 'edge-l', text: '天条', x: 52, top: 236, width: 132, height: 470, depth: 2, phase: 1.8, amp: 2.8, cordY: 236, opacity: 0.78, blur: 2.6},
      {id: 'edge-r', text: '当诛', x: 1872, top: 252, width: 132, height: 470, depth: 2, phase: 3.2, amp: 2.6, cordY: 252, opacity: 0.76, blur: 2.8},
    ];
    return [...far, ...mid, ...edges];
  }, []);

  const embers = useMemo(
    () =>
      Array.from({length: 40}, (_, index) => ({
        x: hash(7101, index) * 1920,
        y: hash(7102, index) * 1080,
        speed: 12 + hash(7103, index) * 42,
        size: 1.2 + hash(7104, index) * 3.6,
        phase: hash(7105, index) * Math.PI * 2,
      })),
    [],
  );

  const spotlightX = 260 + ((time * 420) % 1520);

  return (
    <AbsoluteFill style={{backgroundColor: '#050404', overflow: 'hidden'}}>
      {/* 顶部极轻的冷光，不能把黑场抬灰 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 280,
          background: 'linear-gradient(180deg, rgba(244,239,230,0.045) 0%, rgba(5,4,4,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 三道实体铁索 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id={id('dots')} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <circle cx="2" cy="2" r="0.9" fill={SENBON.paper} opacity="0.12" />
          </pattern>
        </defs>
        <IronChain x1={-80} y1={42} x2={2000} y2={42} sag={54} linkLen={26} glow={0.22} runeText="唵嘛呢叭咪吽" runeStep={9} opacity={0.5} seed={3} />
        <IronChain x1={-80} y1={104} x2={2000} y2={104} sag={62} linkLen={28} glow={0.2} runeText="唵嘛呢叭咪吽" runeStep={11} opacity={0.4} seed={7} />
        <IronChain x1={-80} y1={170} x2={2000} y2={170} sag={70} linkLen={30} glow={0.18} runeText="唵嘛呢叭咪吽" runeStep={13} opacity={0.32} seed={11} />
      </svg>

      {/* 三层罪状木牌 */}
      {tags.map((tag) => (
        <Tag key={tag.id} tag={tag} time={time} pulse={pulse} />
      ))}

      {/* 前景三块主牌 */}
      {heroes.map((hero) => (
        <HeroTag key={hero.id} tag={hero} time={time} pulse={pulse} />
      ))}

      {/* 游走聚光灯：从顶部打下的锥形光 */}
      <div
        style={{
          position: 'absolute',
          left: spotlightX - 260,
          top: -200,
          width: 520,
          height: 1320,
          background:
            'linear-gradient(180deg, rgba(255,247,218,0.1) 0%, rgba(255,247,218,0.05) 38%, rgba(255,247,218,0.012) 72%, rgba(255,247,218,0) 100%)',
          clipPath: 'polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: spotlightX - 220,
          top: 640,
          width: 440,
          height: 300,
          background: 'radial-gradient(ellipse at 50% 40%, rgba(255,247,218,0.055) 0%, rgba(255,247,218,0) 70%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* 金色火星 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
        {embers.map((ember, index) => {
          const y = ((ember.y + time * ember.speed) % 1120) - 20;
          const x = ember.x + Math.sin(time * 0.7 + ember.phase) * 16;
          const flicker = 0.4 + Math.abs(Math.sin(time * 3 + ember.phase)) * 0.6;
          return (
            <g key={`ember-${index}`} opacity={flicker * 0.8}>
              <circle cx={f(x)} cy={f(y)} r={f(ember.size)} fill={index % 4 === 0 ? SENBON.cinnabar : SENBON.gold} />
              <circle cx={f(x)} cy={f(y)} r={f(ember.size * 3)} fill={SENBON.gold} opacity="0.1" />
            </g>
          );
        })}
      </svg>

      {/* 暗角 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 74% at 50% 52%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 帧驱动的极轻纸纹浮动（不改变黑底）；用 CSS 网点而不是 SVG pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(244,239,230,0.10) 0.7px, rgba(244,239,230,0) 1.1px)',
          backgroundSize: '9px 9px',
          opacity: 0.12 + ((frame % 60) / 60) * 0.02,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

export default SuspendedTags;
