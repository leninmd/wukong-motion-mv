import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {clamp01, easeOutExpo, SENBON} from './style';

export interface NandamenDoorsProps {
  /** 0–1 开合进度（由场景按时间换算，组件不读时钟）。 */
  progress: number;
  /** 0–1 撞击余震。 */
  impact?: number;
}

const PANEL_W = 960;
const PANEL_H = 1080;

interface PanelProps {
  side: 'left' | 'right';
  open: number;
  idPrefix: string;
}

const DoorPanel: React.FC<PanelProps> = ({side, open, idPrefix}) => {
  const flip = side === 'right';
  const id = (suffix: string) => `${idPrefix}-${side}-${suffix}`;

  const studs = useMemo(() => {
    const rows = 7;
    const cols = 7;
    return Array.from({length: rows * cols}, (_, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        x: 108 + col * 116,
        y: 196 + row * 104,
        r: 17 + hash(771, index) * 2.4,
      };
    });
  }, []);

  const scratches = useMemo(
    () =>
      Array.from({length: 26}, (_, index) => ({
        x: 40 + hash(1201, index) * 880,
        y: 60 + hash(1301, index) * 960,
        len: 20 + hash(1409, index) * 130,
        angle: (hash(1511, index) - 0.5) * 0.6,
        alpha: 0.04 + hash(1601, index) * 0.1,
      })),
    [],
  );

  return (
    <svg
      viewBox={`0 0 ${PANEL_W} ${PANEL_H}`}
      width={PANEL_W}
      height={PANEL_H}
      style={{
        position: 'absolute',
        left: flip ? PANEL_W : 0,
        top: 0,
        transform: `translateX(${(flip ? 1 : -1) * open * 1040}px) rotateY(${(flip ? -1 : 1) * open * 16}deg)`,
        transformOrigin: flip ? '0% 50%' : '100% 50%',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
        overflow: 'visible',
      }}
    >
      <defs>
        <linearGradient id={id('lacquer')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#241413" />
          <stop offset="38%" stopColor="#170F10" />
          <stop offset="100%" stopColor="#0C090A" />
        </linearGradient>
        <radialGradient id={id('stud')} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="45%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.goldShadow} />
        </radialGradient>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SENBON.goldLight} />
          <stop offset="46%" stopColor={SENBON.gold} />
          <stop offset="100%" stopColor={SENBON.goldDeep} />
        </linearGradient>
        <linearGradient id={id('redPanel')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A1712" />
          <stop offset="100%" stopColor="#2A0D0C" />
        </linearGradient>
        <pattern id={id('grain')} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 0 24 C 8 16 16 16 24 8" fill="none" stroke={SENBON.gold} strokeWidth="0.6" opacity="0.16" />
        </pattern>
        <pattern id={id('dots')} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <circle cx="2.4" cy="2.4" r="1.2" fill={SENBON.gold} opacity="0.14" />
        </pattern>
      </defs>

      {/* 门板底 */}
      <rect width={PANEL_W} height={PANEL_H} fill={`url(#${id('lacquer')})`} />
      <rect width={PANEL_W} height={PANEL_H} fill={`url(#${id('grain')})`} />
      <rect width={PANEL_W} height={PANEL_H} fill={`url(#${id('dots')})`} />

      {/* 外框：三重金线 */}
      <rect x="24" y="24" width={PANEL_W - 48} height={PANEL_H - 48} fill="none" stroke={SENBON.goldDeep} strokeWidth="16" />
      <rect x="34" y="34" width={PANEL_W - 68} height={PANEL_H - 68} fill="none" stroke={SENBON.gold} strokeWidth="4" />
      <rect x="56" y="56" width={PANEL_W - 112} height={PANEL_H - 112} fill="none" stroke={SENBON.gold} strokeWidth="1.6" opacity="0.6" />
      <rect x="70" y="70" width={PANEL_W - 140} height={PANEL_H - 140} fill={`url(#${id('redPanel')})`} opacity="0.34" />

      {/* 门钉阵列 */}
      {studs.map((stud, index) => (
        <g key={`stud-${index}`}>
          <circle cx={stud.x} cy={stud.y} r={stud.r + 4} fill={SENBON.inkEdge} opacity="0.8" />
          <circle cx={stud.x} cy={stud.y} r={stud.r} fill={`url(#${id('stud')})`} />
          <circle cx={stud.x - stud.r * 0.3} cy={stud.y - stud.r * 0.34} r={stud.r * 0.24} fill={SENBON.goldPale} opacity="0.8" />
        </g>
      ))}

      {/* 中央云纹圆盘 */}
      <g transform="translate(480 520)" opacity="0.9">
        <circle r="236" fill={SENBON.inkEdge} opacity="0.5" stroke={SENBON.gold} strokeWidth="2.4" strokeOpacity="0.55" />
        <circle r="204" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.6" strokeOpacity="0.45" strokeDasharray="6 10" />
        {Array.from({length: 12}, (_, index) => {
          const angle = (index / 12) * Math.PI * 2;
          return (
            <g key={`cloud-${index}`} transform={`rotate(${(angle * 180) / Math.PI})`}>
              <path
                d="M 0 -204 C -22 -232 -4 -258 22 -252 C 46 -246 44 -216 22 -208 C 36 -196 44 -176 30 -162"
                fill="none"
                stroke={SENBON.gold}
                strokeWidth="2"
                strokeOpacity="0.42"
              />
            </g>
          );
        })}
        <circle r="132" fill="none" stroke={SENBON.goldDeep} strokeWidth="8" opacity="0.7" />
        <circle r="112" fill={`url(#${id('lacquer')})`} stroke={SENBON.gold} strokeWidth="2" />
        <path
          d="M -30 30 C -70 -6 -34 -66 18 -58 C 68 -50 78 12 40 44 C 18 64 -8 58 -16 40 C -24 22 -10 6 6 10"
          fill="none"
          stroke={SENBON.goldLight}
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle r="10" fill={SENBON.cinnabar} stroke={SENBON.goldLight} strokeWidth="2.4" />
      </g>

      {/* 铺首衔环（贴在内侧门缝） */}
      <g transform={`translate(${PANEL_W - 92} 640)`}>
        <circle r="86" fill={SENBON.inkEdge} opacity="0.55" />
        <path
          d="M -78 -12 C -70 -66 -30 -98 0 -96 C 30 -98 70 -66 78 -12 C 56 -26 34 -32 0 -32 C -34 -32 -56 -26 -78 -12 Z"
          fill={`url(#${id('ring')})`}
          stroke={SENBON.goldShadow}
          strokeWidth="2"
        />
        <path d="M -44 -36 C -34 -60 -14 -74 0 -74 C 14 -74 34 -60 44 -36" fill="none" stroke={SENBON.goldShadow} strokeWidth="3" opacity="0.6" />
        <circle cx="-24" cy="-44" r="8" fill={SENBON.ink} />
        <circle cx="24" cy="-44" r="8" fill={SENBON.ink} />
        <circle cx="-24" cy="-44" r="3.4" fill={SENBON.cinnabar} />
        <circle cx="24" cy="-44" r="3.4" fill={SENBON.cinnabar} />
        <path d="M -16 -6 L -20 30 L 0 44 L 20 30 L 16 -6 Z" fill={SENBON.ink} opacity="0.8" />
        <path d="M -10 34 L -6 58 L 0 66 L 6 58 L 10 34" fill="none" stroke={SENBON.paper} strokeWidth="4" opacity="0.8" />
        {/* 环 */}
        <g transform="translate(0 96)">
          <circle r="64" fill="none" stroke={SENBON.goldShadow} strokeWidth="17" opacity="0.55" />
          <circle
            r="64"
            fill="none"
            stroke={`url(#${id('ring')})`}
            strokeWidth="13"
            strokeDasharray="330 72"
            strokeDashoffset={open * 20}
          />
          <circle r="64" fill="none" stroke={SENBON.goldLight} strokeWidth="3" opacity="0.55" />
        </g>
      </g>

      {/* 朱砂描金内缝 */}
      <rect x={PANEL_W - 18} y="0" width="18" height={PANEL_H} fill={SENBON.cinnabarDeep} opacity="0.8" />
      <rect x={PANEL_W - 15} y="0" width="4" height={PANEL_H} fill={SENBON.gold} opacity="0.8" />

      {/* 风化划痕 */}
      {scratches.map((scratch, index) => (
        <line
          key={`scratch-${index}`}
          x1={scratch.x}
          y1={scratch.y}
          x2={scratch.x + Math.cos(scratch.angle) * scratch.len}
          y2={scratch.y + Math.sin(scratch.angle) * scratch.len}
          stroke={SENBON.paper}
          strokeWidth="0.8"
          opacity={scratch.alpha}
        />
      ))}
    </svg>
  );
};

/**
 * 南天门推拉门。
 *
 * 0–12 帧的两扇玄黑描金门板从中心向左右撕开：先内收蓄力，再猛烈崩开，
 * 带一点 3D 旋转、门钉/铺首/门环细节和门缝金光。
 */
export const NandamenDoors: React.FC<NandamenDoorsProps> = ({progress, impact = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = clamp01(progress);
  if (p >= 0.999) return null;

  const windup = Math.sin(Math.min(1, p / 0.16) * Math.PI) * 0.02;
  const open = easeOutExpo(clamp01((p - 0.12) / 0.88)) + windup;
  const seam = 3 + open * 54;
  const plaqueFade = clamp01(1 - p * 2.6);

  return (
    <AbsoluteFill style={{perspective: 1800, overflow: 'hidden', backgroundColor: SENBON.ink}}>
      <DoorPanel side="left" open={open} idPrefix={rawId} />
      <DoorPanel side="right" open={open} idPrefix={rawId} />

      {/* 门缝金光 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - seam / 2,
          top: 0,
          width: seam,
          height: 1080,
          background: `linear-gradient(180deg, rgba(255,247,218,0) 0%, ${SENBON.goldPale} 24%, ${SENBON.gold} 52%, ${SENBON.cinnabar} 78%, rgba(217,48,37,0) 100%)`,
          boxShadow: `0 0 ${60 + open * 160}px ${20 + open * 60}px rgba(252,201,52,${0.35 + open * 0.2})`,
          opacity: 0.5 + open * 0.5,
        }}
      />

      {/* 门环锁：崩开时两半飞走 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 620,
          width: 240,
          height: 240,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {[-1, 1].map((side) => (
          <svg
            key={`lock-${side}`}
            viewBox="0 0 120 240"
            width="120"
            height="240"
            style={{
              position: 'absolute',
              left: side < 0 ? 0 : 120,
              top: 0,
              transform: `translate(${side * open * 360}px, ${open * open * 220}px) rotate(${side * open * 74}deg)`,
              opacity: 1 - clamp01((p - 0.6) / 0.4),
            }}
          >
            <path
              d={
                side < 0
                  ? 'M 112 26 L 18 44 C 8 46 4 56 10 64 L 104 118 C 112 122 118 116 118 108 L 118 34 C 118 28 116 25 112 26 Z'
                  : 'M 8 26 L 102 44 C 112 46 116 56 110 64 L 16 118 C 8 122 2 116 2 108 L 2 34 C 2 28 4 25 8 26 Z'
              }
              fill={SENBON.goldDeep}
              stroke={SENBON.goldLight}
              strokeWidth="3"
            />
            <circle cx={side < 0 ? 64 : 56} cy="76" r="30" fill={SENBON.ink} stroke={SENBON.gold} strokeWidth="5" />
            <circle cx={side < 0 ? 64 : 56} cy="76" r="15" fill="none" stroke={SENBON.cinnabar} strokeWidth="6" />
          </svg>
        ))}
      </div>

      {/* 门匾：南天门 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 108,
          transform: `translate(-50%, ${(-open * 40).toFixed(2)}px)`,
          opacity: plaqueFade,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 470,
            height: 150,
            background: 'linear-gradient(180deg, #1E1211 0%, #0B090A 100%)',
            border: `5px solid ${SENBON.gold}`,
            boxShadow: `inset 0 0 0 3px ${SENBON.cinnabarDeep}, 0 12px 40px rgba(0,0,0,0.7)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"Source Han Serif SC Heavy", "Noto Serif SC", "Songti SC", serif',
              fontWeight: 900,
              fontSize: 96,
              letterSpacing: '0.24em',
              color: SENBON.goldLight,
              textShadow: `0 0 24px rgba(252,201,52,${0.45 + impact * 0.4}), 0 4px 0 ${SENBON.goldShadow}`,
              lineHeight: 1,
              paddingLeft: '0.24em',
            }}
          >
            南天门
          </div>
          {[-1, 1].map((side) => (
            <div
              key={`plaque-cap-${side}`}
              style={{
                position: 'absolute',
                top: -22,
                left: side < 0 ? -22 : undefined,
                right: side > 0 ? -22 : undefined,
                width: 30,
                height: 30,
                border: `4px solid ${SENBON.gold}`,
                transform: 'rotate(45deg)',
                background: SENBON.ink,
              }}
            />
          ))}
        </div>
      </div>

      {/* 门缝扬尘 */}
      {open > 0.05
        ? Array.from({length: 26}, (_, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const spread = open * (180 + hash(5501, index) * 640);
            const y = 760 + hash(5507, index) * 280;
            return (
              <div
                key={`dust-${index}`}
                style={{
                  position: 'absolute',
                  left: 960 + side * spread,
                  top: y,
                  width: 4 + hash(5511, index) * 12,
                  height: 4 + hash(5513, index) * 12,
                  borderRadius: '50%',
                  background: index % 4 === 0 ? SENBON.gold : SENBON.paperDim,
                  opacity: clamp01(open * 1.4 - 0.15) * (0.25 + hash(5519, index) * 0.5),
                }}
              />
            );
          })
        : null}
    </AbsoluteFill>
  );
};
