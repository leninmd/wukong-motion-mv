import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SENBON, SERIF_STACK, clamp01, f} from './style';

/**
 * `<ShojiGate />` —— V8 的物理遮罩转场 1/5：天宫障子门。
 *
 * 复刻《千本樱》00:01 的"推拉门"开场：第 0 帧两扇玄黑描金障子门完全闭合，
 * 随前 9 帧向左右两侧猛烈滑开，露出 1A 四分屏。门不是一张黑图：
 *   1. 玄黑漆底 + 竖向和纸纤维 + 横向木纹；
 *   2. 外粗内细双层鎏金框 + 朱砂内线；
 *   3. 上部格栅（鎏金细棂 + 背光纸面）；
 *   4. 中央圆形团花（仙鹤穿云 / 蟠桃枝），左右门各半；
 *   5. 门钉、包角、门槛金线。
 *
 * 转场本身遵守"物理遮罩"原则：门是场景里的建筑构件，不是淡入淡出的
 * 全屏色块；门开到 100% 时组件卸载，不会污染后续镜头。
 */

export interface ShojiGateProps {
  time: number;
  start: number;
  end: number;
}

const DOOR_W = 960;
const DOOR_H = 1080;

const easeInOutCubic = (t: number): number => {
  const v = clamp01(t);
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
};

/** 单扇门：`side=-1` 左门，`side=1` 右门（用 scaleX 镜像共用同一套纹样）。 */
const Door: React.FC<{side: -1 | 1; open: number}> = ({side, open}) => {
  const rawId = side < 0 ? 'l' : 'r';
  return (
    <div
      style={{
        position: 'absolute',
        left: side < 0 ? 0 : DOOR_W,
        top: 0,
        width: DOOR_W,
        height: DOOR_H,
        transform: `translateX(${f(side * open * DOOR_W)}px)`,
        willChange: 'transform',
      }}
    >
      {/* 右门整体镜像，让两扇门的仙鹤/蟠桃纹样左右对称 */}
      <div style={{position: 'absolute', inset: 0, transform: side > 0 ? 'scaleX(-1)' : undefined}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #171114 0%, #0B090A 42%, #120C0F 100%)',
          borderRight: side < 0 ? 'none' : undefined,
          borderLeft: side > 0 ? 'none' : undefined,
          boxShadow: side < 0 ? 'inset -26px 0 44px rgba(0,0,0,0.72)' : 'inset 26px 0 44px rgba(0,0,0,0.72)',
        }}
      />

      {/* 和纸纤维 + 木纹：竖向细线，避免大面积死黑 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(244,239,230,0.045) 0px, rgba(244,239,230,0.045) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 7px), repeating-linear-gradient(0deg, rgba(245,194,66,0.035) 0px, rgba(245,194,66,0.035) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 26px)',
          opacity: 0.85,
        }}
      />

      {/* 上部格栅：鎏金细棂 + 背后透出的暖纸光 */}
      <div style={{position: 'absolute', left: 64, right: 64, top: 74, height: 380}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(245,194,66,0.14) 0%, rgba(255,243,209,0.07) 46%, rgba(12,8,10,0.2) 100%)',
            boxShadow: 'inset 0 0 42px rgba(245,194,66,0.18)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(245,194,66,0.72) 0px, rgba(245,194,66,0.72) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 60px), repeating-linear-gradient(0deg, rgba(245,194,66,0.6) 0px, rgba(245,194,66,0.6) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 58px)',
            opacity: 0.8,
          }}
        />
        <div style={{position: 'absolute', inset: -8, border: '3px solid rgba(245,194,66,0.72)', boxShadow: '0 0 0 1px #3A2408'}} />
        <div style={{position: 'absolute', inset: 4, border: '1px solid rgba(200,40,30,0.5)'}} />
      </div>

      {/* 中央团花：仙鹤 + 云纹 + 蟠桃枝。整幅只用代码画纹样，不写字。 */}
      <svg viewBox="0 0 960 1080" width={960} height={1080} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id={`${rawId}-crest`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4A1410" stopOpacity="0.95" />
            <stop offset="62%" stopColor="#1A0E10" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#0B090A" stopOpacity="0.4" />
          </radialGradient>
        </defs>

        {/* 圆形团花底 */}
        <circle cx={480} cy={700} r={242} fill={`url(#${rawId}-crest)`} stroke="#F5C242" strokeWidth={4} opacity="0.95" />
        <circle cx={480} cy={700} r={220} fill="none" stroke="#C8281E" strokeWidth={2} opacity="0.7" />
        <circle cx={480} cy={700} r={196} fill="none" stroke="#F5C242" strokeWidth={1.2} opacity="0.5" strokeDasharray="10 12" />

        {/* 云纹环 */}
        {Array.from({length: 12}, (_, index) => {
          const angle = (index / 12) * Math.PI * 2;
          return (
            <path
              key={`cloud-${index}`}
              d="M -34 0 Q -24 -16 -8 -8 Q 0 -22 16 -10 Q 30 -18 38 0"
              fill="none"
              stroke="#F5C242"
              strokeWidth={2.2}
              opacity="0.55"
              transform={`translate(${480 + Math.cos(angle) * 268} ${700 + Math.sin(angle) * 268}) rotate(${(angle * 180) / Math.PI + 90})`}
            />
          );
        })}

        {/* 仙鹤：长颈、展翼、细腿，压在团花里 */}
        <g transform="translate(480 700)" opacity="0.94">
          <path d="M -96 34 Q -70 -6 -26 -18 Q 10 -32 40 -8 Q 12 8 -4 34 Q -34 54 -96 34 Z" fill="#F4EFE6" stroke="#0B090A" strokeWidth={3} />
          <path d="M -24 -14 Q 2 -54 44 -62 Q 56 -50 40 -40 Q 18 -30 4 -10 Z" fill="#F4EFE6" stroke="#0B090A" strokeWidth={3} />
          <circle cx={50} cy={-60} r={9} fill="#C8281E" stroke="#0B090A" strokeWidth={2} />
          <path d="M 57 -60 L 78 -54 L 58 -50 Z" fill="#F5C242" stroke="#0B090A" strokeWidth={1.6} />
          <path d="M 22 -52 Q 34 -40 42 -30" fill="none" stroke="#C8281E" strokeWidth={2.4} />
          <path d="M -74 34 L -108 74 M -42 44 L -58 88" stroke="#0B090A" strokeWidth={3.4} />
          <path d="M -108 74 L -124 84 M -58 88 L -72 98" stroke="#F5C242" strokeWidth={2.4} />
          <path d="M -6 18 Q 20 26 46 12" fill="none" stroke="#F5C242" strokeWidth={2.6} opacity="0.9" />
          <path d="M -14 30 Q 18 42 52 26" fill="none" stroke="#F5C242" strokeWidth={1.8} opacity="0.7" />
        </g>

        {/* 蟠桃枝：从团花底部伸向两侧 */}
        <g opacity="0.92">
          <path d="M 480 944 Q 420 900 350 918 Q 296 934 268 884" fill="none" stroke="#F5C242" strokeWidth={5} />
          <path d="M 480 944 Q 552 906 622 926 Q 692 948 722 900" fill="none" stroke="#F5C242" strokeWidth={5} />
          <path d="M 350 918 Q 330 878 302 866" fill="none" stroke="#C8281E" strokeWidth={3} />
          <path d="M 622 926 Q 648 884 678 874" fill="none" stroke="#C8281E" strokeWidth={3} />
          {[
            {x: 300, y: 872, r: 34},
            {x: 672, y: 882, r: 30},
            {x: 402, y: 966, r: 24},
            {x: 566, y: 980, r: 22},
          ].map((peach, index) => (
            <g key={`peach-${index}`}>
              <path
                d={`M ${peach.x - peach.r} ${peach.y} Q ${peach.x - peach.r * 0.6} ${peach.y - peach.r * 1.3} ${peach.x} ${peach.y - peach.r * 0.9} Q ${peach.x + peach.r * 0.6} ${peach.y - peach.r * 1.3} ${peach.x + peach.r} ${peach.y} Q ${peach.x + peach.r * 0.5} ${peach.y + peach.r * 1.1} ${peach.x} ${peach.y + peach.r * 0.86} Q ${peach.x - peach.r * 0.5} ${peach.y + peach.r * 1.1} ${peach.x - peach.r} ${peach.y} Z`}
                fill="#C8281E"
                stroke="#F5C242"
                strokeWidth={2.4}
              />
              <path d={`M ${peach.x} ${peach.y - peach.r * 0.9} Q ${peach.x + 10} ${peach.y - peach.r * 1.5} ${peach.x + 26} ${peach.y - peach.r * 1.7}`} fill="none" stroke="#F5C242" strokeWidth={2.4} />
              <path d={`M ${peach.x - peach.r * 0.4} ${peach.y + peach.r * 0.1} Q ${peach.x} ${peach.y + peach.r * 0.5} ${peach.x + peach.r * 0.42} ${peach.y + peach.r * 0.12}`} fill="none" stroke="#F5C242" strokeWidth={1.2} opacity="0.5" />
            </g>
          ))}
        </g>

        {/* 门钉 + 包角 */}
        {Array.from({length: 9}, (_, index) => (
          <circle key={`stud-${index}`} cx={side < 0 ? 900 : 60} cy={120 + index * 108} r={11} fill="#F5C242" stroke="#3A2408" strokeWidth={2} opacity="0.9" />
        ))}
        <path
          d={side < 0 ? 'M 0 0 L 190 0 L 0 190 Z' : 'M 960 0 L 770 0 L 960 190 Z'}
          fill="#C8281E"
          opacity="0.24"
        />
        <path
          d={side < 0 ? 'M 18 18 L 168 18 L 18 168 Z' : 'M 942 18 L 792 18 L 942 168 Z'}
          fill="none"
          stroke="#F5C242"
          strokeWidth={2.2}
          opacity="0.8"
        />
      </svg>

      {/* 双层框：外粗内细，中间留暗缝 */}
      <div style={{position: 'absolute', inset: 14, border: '5px solid #F5C242', boxShadow: '0 0 0 1px #3A2408, inset 0 0 0 1px #3A2408'}} />
      <div style={{position: 'absolute', inset: 28, border: '1px solid rgba(245,194,66,0.7)'}} />
      <div style={{position: 'absolute', inset: 36, border: '1px solid rgba(200,40,30,0.42)'}} />

      {/* 门缝侧的高光边 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 8,
          [side < 0 ? 'right' : 'left']: 0,
          background: 'linear-gradient(90deg, rgba(255,243,209,0) 0%, rgba(255,243,209,0.55) 50%, rgba(255,243,209,0) 100%)',
          mixBlendMode: 'screen',
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: side < 0 ? 62 : 40,
          right: side < 0 ? 40 : 62,
          height: 3,
          background: 'linear-gradient(90deg, rgba(245,194,66,0), #F5C242 30%, #FFF3D1 50%, #F5C242 70%, rgba(245,194,66,0))',
          opacity: 0.7,
        }}
      />
      </div>
    </div>
  );
};

export const ShojiGate: React.FC<ShojiGateProps> = ({time, start, end}) => {
  const progress = clamp01((time - start) / Math.max(0.001, end - start));
  if (progress >= 1) return null;
  const open = easeInOutCubic(progress);
  const seam = Math.max(0, 1 - progress * 2.6);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 80, overflow: 'hidden'}}>
      <Door side={-1} open={open} />
      <Door side={1} open={open} />

      {/* 中缝：门未开时是一条暖金天光；门一开就变成一道扫过的光 */}
      <div
        style={{
          position: 'absolute',
          left: 956,
          top: 0,
          width: 8,
          height: 1080,
          background: 'linear-gradient(180deg, rgba(255,243,209,0.05) 0%, rgba(255,243,209,0.9) 28%, rgba(245,194,66,0.9) 72%, rgba(255,243,209,0.05) 100%)',
          boxShadow: '0 0 42px rgba(245,194,66,0.85)',
          opacity: seam,
          mixBlendMode: 'screen',
        }}
      />

      {/* 门楣：横向鎏金匾额，给开场一个"这是天宫"的信号 */}
      <div
        style={{
          position: 'absolute',
          left: 600,
          width: 720,
          top: 34,
          height: 66,
          opacity: 1 - progress * 2.2,
          transform: `translateY(${f(-18 * progress)}px)`,
          background: 'linear-gradient(180deg, #1E1115 0%, #0B0709 100%)',
          border: '3px solid #F5C242',
          boxShadow: '0 0 0 1px #3A2408, 0 10px 28px rgba(0,0,0,0.7)',
          clipPath: 'polygon(10px 0, 710px 0, 720px 50%, 710px 66px, 10px 66px, 0 50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: SERIF_STACK,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: 18,
            color: SENBON.gold,
            textShadow: '0 0 18px rgba(245,194,66,0.55), 0 2px 0 #000',
          }}
        >
          天宫禁门
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ShojiGate;
