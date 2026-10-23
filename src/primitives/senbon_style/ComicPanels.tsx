import React, {useId, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp, hash} from '../../utils/math';
import {WukongRig} from './WukongRig';
import {OrnateSealStamp} from './OrnateSealStamp';
import {SERIF_STACK, SENBON, easeInCubic, f, overshoot} from './style';

/**
 * Shot 1A —— 《千本樱》00:30 同款四分屏微缩画卷。
 *
 * 硬约束：屏幕严格四等分，每格 480px，卡片左右各留 20px 安全边距，
 * 最右卡片右缘 = 1920 − 20 = 1900，**绝不越界**。整板不做旋转（V3 的
 * −5° 整板旋转正是第四面被裁掉一半的根因），倾斜只发生在分格内部装饰线上。
 *
 * 每格 = 独立微缩场景 + 编号印章（OrnateSealStamp）+ 顶部题签 + 底部小字。
 * 微缩场景分别：南天门巨柱 / 凌霄殿飞檐满月 / 银白长戈森林 / 大圣侧面挥棒残影。
 */

export type PanelSceneKind = 'gate' | 'palace' | 'spear' | 'hero';

export interface ComicPanelSlot {
  id: string;
  seal: string;
  subText: string;
  indexLabel: string;
  title: string;
  caption: string;
  scene: PanelSceneKind;
  dropAt: number;
  accent: 'gold' | 'cinnabar';
}

export interface ComicPanelsProps {
  time: number;
  frame: number;
  panels: readonly ComicPanelSlot[];
  exitAt: number;
  goneAt: number;
  pulse?: number;
}

const COLUMN = 480;
const PAD = 20;
const CARD = COLUMN - PAD * 2; // 440
const BOARD_TOP = 20;
const BOARD_HEIGHT = 1040;

/* -------------------------------------------------------------------------- */
/*  微缩场景                                                                  */
/* -------------------------------------------------------------------------- */

const useScreenId = (prefix: string) => {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (suffix: string) => `${prefix}-${raw}-${suffix}`;
};

const HalftoneRect: React.FC<{patternId: string; opacity?: number}> = ({patternId, opacity = 0.5}) => (
  <rect x="0" y="0" width="400" height="640" fill={`url(#${patternId})`} opacity={opacity} />
);

const GateScene: React.FC<{frame: number; pulse: number}> = ({frame, pulse}) => {
  const id = useScreenId('gate');
  const motes = useMemo(
    () =>
      Array.from({length: 26}, (_, index) => ({
        x: hash(2201, index) * 400,
        y: hash(2202, index) * 640,
        r: 0.8 + hash(2203, index) * 2.2,
        p: hash(2204, index) * Math.PI * 2,
      })),
    [],
  );
  return (
    <svg viewBox="0 0 400 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id={id('sky')} cx="50%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#3A1A16" />
          <stop offset="52%" stopColor="#1A0E0E" />
          <stop offset="100%" stopColor="#0B090A" />
        </radialGradient>
        <radialGradient id={id('moon')} cx="44%" cy="38%" r="58%">
          <stop offset="0%" stopColor="#FFF7DA" />
          <stop offset="48%" stopColor="#FCC934" />
          <stop offset="100%" stopColor="#9A6A0D" />
        </radialGradient>
        <linearGradient id={id('pillar')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0E0A0B" />
          <stop offset="34%" stopColor="#3A2220" />
          <stop offset="62%" stopColor="#241615" />
          <stop offset="100%" stopColor="#080607" />
        </linearGradient>
        <linearGradient id={id('rail')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9A6A0D" />
          <stop offset="46%" stopColor="#FFF7DA" />
          <stop offset="100%" stopColor="#9A6A0D" />
        </linearGradient>
        <pattern id={id('dots')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(21)">
          <circle cx="2" cy="2" r="0.85" fill={SENBON.gold} opacity="0.24" />
        </pattern>
        <pattern id={id('tiles')} width="18" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 9 Q9 2 18 9" fill="none" stroke={SENBON.gold} strokeWidth="0.8" opacity="0.3" />
        </pattern>
        <linearGradient id={id('fog')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SENBON.ink} stopOpacity="0" />
          <stop offset="100%" stopColor={SENBON.ink} stopOpacity="0.92" />
        </linearGradient>
      </defs>

      <rect width="400" height="640" fill={`url(#${id('sky')})`} />
      <circle cx="200" cy="140" r="150" fill={SENBON.cinnabar} opacity={0.08 + pulse * 0.04} />
      <circle cx="200" cy="140" r="86" fill={`url(#${id('moon')})`} opacity="0.92" />
      <circle cx="200" cy="140" r="86" fill={`url(#${id('dots')})`} opacity="0.55" />
      <circle cx="200" cy="140" r="99" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.4" strokeDasharray="2 11" opacity="0.5" />

      {/* 南天门三根巨柱 */}
      {[64, 200, 336].map((cx, index) => (
        <g key={`pillar-${index}`}>
          {/* 柱础 */}
          <rect x={cx - 48} y="556" width="96" height="30" fill="#171011" stroke={SENBON.gold} strokeWidth="1.4" opacity="0.9" />
          <rect x={cx - 42} y="540" width="84" height="18" fill="#241818" stroke={SENBON.goldDeep} strokeWidth="1" />
          {/* 柱身 */}
          <rect x={cx - 30} y="118" width="60" height="424" fill={`url(#${id('pillar')})`} stroke="#080506" strokeWidth="2" />
          <rect x={cx - 30} y="118" width="60" height="424" fill={`url(#${id('tiles')})`} opacity="0.5" />
          <line x1={cx - 20} y1="126" x2={cx - 20} y2="534" stroke={SENBON.gold} strokeWidth="1.6" opacity="0.5" />
          <line x1={cx + 20} y1="126" x2={cx + 20} y2="534" stroke={SENBON.gold} strokeWidth="1.6" opacity="0.5" />
          {/* 盘龙金环 */}
          {[176, 248, 320, 392, 464].map((y, ring) => (
            <g key={`coil-${ring}`}>
              <ellipse cx={cx} cy={y} rx="34" ry="7" fill="none" stroke={SENBON.gold} strokeWidth="3" opacity={0.5 - ring * 0.04} />
              <path d={`M ${cx - 28} ${y - 10} C ${cx - 10} ${y - 20} ${cx + 18} ${y + 4} ${cx + 30} ${y - 8}`} fill="none" stroke={SENBON.goldPale} strokeWidth="1.2" opacity="0.42" />
            </g>
          ))}
          {/* 柱头斗拱 */}
          <rect x={cx - 48} y="86" width="96" height="34" fill="#1D1314" stroke={SENBON.gold} strokeWidth="2" />
          <rect x={cx - 60} y="70" width="120" height="18" fill="#261A1A" stroke={SENBON.gold} strokeWidth="1.4" />
          {[-36, -12, 12, 36].map((dx) => (
            <rect key={`bracket-${cx}-${dx}`} x={cx + dx - 5} y="102" width="10" height="18" fill={SENBON.goldDeep} opacity="0.75" />
          ))}
        </g>
      ))}

      {/* 门楣与飞檐 */}
      <path
        d="M -10 88 C 70 52 150 44 200 44 C 250 44 330 52 410 88 L 410 68 C 330 28 250 20 200 20 C 150 20 70 28 -10 68 Z"
        fill="#1A1011"
        stroke={SENBON.gold}
        strokeWidth="2.4"
      />
      <rect x="-10" y="88" width="420" height="30" fill="#120C0D" stroke={SENBON.gold} strokeWidth="1.6" />
      <rect x="-10" y="90" width="420" height="4" fill={`url(#${id('rail')})`} opacity="0.9" />
      <text
        x="200"
        y="72"
        textAnchor="middle"
        fontFamily={SERIF_STACK}
        fontWeight={900}
        fontSize="24"
        letterSpacing="8"
        fill={SENBON.goldPale}
        opacity="0.9"
      >
        南天门
      </text>

      {/* 宫灯 */}
      {[118, 282].map((x, index) => (
        <g key={`lantern-${index}`} opacity="0.95">
          <line x1={x} y1="118" x2={x} y2="164" stroke={SENBON.gold} strokeWidth="1.2" opacity="0.6" />
          <rect x={x - 13} y="164" width="26" height="38" rx="9" fill={SENBON.cinnabar} stroke={SENBON.goldPale} strokeWidth="1.4" />
          <line x1={x} y1="170" x2={x} y2="196" stroke={SENBON.goldPale} strokeWidth="1" opacity="0.8" />
          <line x1={x} y1="202" x2={x} y2="216" stroke={SENBON.cinnabar} strokeWidth="2.4" />
          <circle cx={x} cy="183" r="22" fill={SENBON.gold} opacity={0.09 + pulse * 0.05} />
        </g>
      ))}

      {/* 云带 */}
      {[92, 462, 506].map((y, index) => (
        <path
          key={`cloud-${index}`}
          d={`M -20 ${y} C 40 ${y - 22} 96 ${y + 14} 150 ${y - 6} C 210 ${y - 28} 270 ${y + 16} 330 ${y - 4} C 360 ${y - 14} 388 ${y - 4} 420 ${y - 10}`}
          fill="none"
          stroke={SENBON.gold}
          strokeWidth={index === 0 ? 2.2 : 1.4}
          opacity={index === 0 ? 0.4 : 0.24}
        />
      ))}

      {/* 台阶 */}
      {[0, 1, 2, 3, 4].map((step) => (
        <rect
          key={`step-${step}`}
          x={-20 + step * 18}
          y={586 + step * 12}
          width={440 - step * 36}
          height="10"
          fill={step % 2 === 0 ? '#170F10' : '#211718'}
          stroke={SENBON.goldDeep}
          strokeWidth="0.8"
          opacity="0.9"
        />
      ))}

      {/* 金色浮尘 */}
      {motes.map((mote, index) => (
        <circle
          key={`mote-${index}`}
          cx={f(mote.x)}
          cy={f((mote.y + frame * (0.3 + (index % 5) * 0.12)) % 640)}
          r={f(mote.r)}
          fill={index % 4 === 0 ? SENBON.paper : SENBON.gold}
          opacity={0.2 + (index % 3) * 0.14}
        />
      ))}

      <HalftoneRect patternId={id('dots')} opacity={0.5} />
      <rect width="400" height="640" fill={`url(#${id('fog')})`} opacity="0.5" />
      <rect width="400" height="640" fill="none" stroke={SENBON.gold} strokeWidth="1" opacity="0.25" />
    </svg>
  );
};

const PalaceScene: React.FC<{frame: number; pulse: number}> = ({frame, pulse}) => {
  const id = useScreenId('palace');
  const roofs = [
    {y: 300, w: 190, h: 74, scale: 1},
    {y: 392, w: 220, h: 84, scale: 1},
    {y: 492, w: 250, h: 96, scale: 1},
  ];
  return (
    <svg viewBox="0 0 400 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id={id('sky')} cx="62%" cy="26%" r="70%">
          <stop offset="0%" stopColor="#2A1513" />
          <stop offset="54%" stopColor="#150D0E" />
          <stop offset="100%" stopColor="#0B090A" />
        </radialGradient>
        <radialGradient id={id('moon')} cx="42%" cy="36%" r="60%">
          <stop offset="0%" stopColor="#FFF7DA" />
          <stop offset="44%" stopColor="#FCC934" />
          <stop offset="78%" stopColor="#C98A11" />
          <stop offset="100%" stopColor="#6B3F06" />
        </radialGradient>
        <pattern id={id('moonDots')} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <circle cx="2" cy="2" r="1.15" fill="#5C3E06" opacity="0.5" />
        </pattern>
        <pattern id={id('dots')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <circle cx="2" cy="2" r="0.8" fill={SENBON.gold} opacity="0.2" />
        </pattern>
        <linearGradient id={id('roof')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C1A18" />
          <stop offset="56%" stopColor="#150E0F" />
          <stop offset="100%" stopColor="#0B090A" />
        </linearGradient>
        <clipPath id={id('moonClip')}>
          <circle cx="286" cy="148" r="112" />
        </clipPath>
      </defs>
      <rect width="400" height="640" fill={`url(#${id('sky')})`} />

      {/* 赤金满月 */}
      <circle cx="286" cy="148" r="168" fill={SENBON.cinnabar} opacity={0.08 + pulse * 0.05} />
      <circle cx="286" cy="148" r="112" fill={`url(#${id('moon')})`} />
      <g clipPath={`url(#${id('moonClip')})`}>
        <circle cx="286" cy="148" r="112" fill={`url(#${id('moonDots')})`} opacity="0.7" />
        {[
          [252, 112, 26],
          [318, 176, 34],
          [300, 106, 14],
          [250, 198, 18],
          [338, 120, 12],
        ].map(([cx, cy, r], index) => (
          <circle key={`crater-${index}`} cx={cx} cy={cy} r={r} fill="#7A4F08" opacity="0.14" />
        ))}
        <path d="M 188 180 L 250 200 L 286 160 L 352 196" fill="none" stroke="#6B3F06" strokeWidth="3" opacity="0.22" />
      </g>
      <circle cx="286" cy="148" r="112" fill="none" stroke={SENBON.goldPale} strokeWidth="2.2" opacity="0.85" />
      <circle cx="286" cy="148" r="123" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.4" opacity="0.55" />
      <circle cx="286" cy="148" r="136" fill="none" stroke={SENBON.gold} strokeWidth="0.8" strokeDasharray="2 10" opacity="0.4" />

      {/* 三层飞檐 */}
      {roofs.map((roof, index) => {
        const {y, w} = roof;
        return (
          <g key={`roof-${index}`}>
            {/* 屋顶曲线 */}
            <path
              d={`M ${200 - w} ${y} C ${200 - w * 0.62} ${y - 44} ${200 - w * 0.3} ${y - 58} 200 ${y - 60} C ${
                200 + w * 0.3
              } ${y - 58} ${200 + w * 0.62} ${y - 44} ${200 + w} ${y} C ${200 + w * 0.56} ${y + 24} ${200 + w * 0.26} ${
                y + 30
              } 200 ${y + 30} C ${200 - w * 0.26} ${y + 30} ${200 - w * 0.56} ${y + 24} ${200 - w} ${y} Z`}
              fill={`url(#${id('roof')})`}
              stroke={SENBON.gold}
              strokeWidth="2.2"
            />
            {/* 正脊 */}
            <path
              d={`M ${200 - w * 0.28} ${y - 58} L ${200 + w * 0.28} ${y - 58} L ${200 + w * 0.24} ${y - 68} L ${200 - w * 0.24} ${y - 68} Z`}
              fill="#1C1213"
              stroke={SENBON.gold}
              strokeWidth="1.6"
            />
            {/* 鸱吻 */}
            <path d={`M ${200 - w * 0.28} ${y - 58} C ${200 - w * 0.34} ${y - 82} ${200 - w * 0.24} ${y - 90} ${200 - w * 0.2} ${y - 76}`} fill="none" stroke={SENBON.gold} strokeWidth="2.6" />
            <path d={`M ${200 + w * 0.28} ${y - 58} C ${200 + w * 0.34} ${y - 82} ${200 + w * 0.24} ${y - 90} ${200 + w * 0.2} ${y - 76}`} fill="none" stroke={SENBON.gold} strokeWidth="2.6" />
            {/* 瓦垄 */}
            {Array.from({length: 13}, (_, tile) => {
              const t = (tile - 6) / 6;
              return (
                <path
                  key={`tile-${index}-${tile}`}
                  d={`M ${200 + t * w * 0.86} ${y - 4} C ${200 + t * w * 0.6} ${y - 26} ${200 + t * w * 0.3} ${y - 48} ${200 + t * w * 0.1} ${y - 58}`}
                  fill="none"
                  stroke={SENBON.gold}
                  strokeWidth="0.9"
                  opacity="0.32"
                />
              );
            })}
            {/* 斗拱 */}
            {Array.from({length: 9}, (_, bracket) => {
              const bx = 200 - w * 0.7 + (bracket / 8) * w * 1.4;
              return (
                <rect
                  key={`bracket-${index}-${bracket}`}
                  x={f(bx - 5)}
                  y={y + 28}
                  width="10"
                  height={14 + (bracket % 2) * 6}
                  fill="#241819"
                  stroke={SENBON.gold}
                  strokeWidth="0.8"
                  opacity="0.8"
                />
              );
            })}
            {/* 殿身 */}
            <rect x={200 - w * 0.78} y={y + 44} width={w * 1.56} height={92} fill="#120C0D" stroke={SENBON.goldDeep} strokeWidth="1" />
            {Array.from({length: 6}, (_, col) => {
              const cx = 200 - w * 0.62 + (col / 5) * w * 1.24;
              return (
                <g key={`win-${index}-${col}`}>
                  <rect x={f(cx - 8)} y={y + 62} width="16" height="52" fill="#2A1A12" stroke={SENBON.gold} strokeWidth="1" opacity="0.85" />
                  <rect x={f(cx - 6)} y={y + 66} width="12" height="20" fill={SENBON.gold} opacity="0.3" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* 月下云海 */}
      {[420, 474, 530, 590].map((y, index) => (
        <path
          key={`cloud-${index}`}
          d={`M -30 ${y} C 40 ${y - 22} 92 ${y + 12} 150 ${y - 8} C 214 ${y - 30} 268 ${y + 16} 330 ${y - 4} C 368 ${y - 16} 396 ${y - 6} 430 ${y - 12}`}
          fill="none"
          stroke={SENBON.gold}
          strokeWidth={1.8 - index * 0.22}
          opacity={0.36 - index * 0.06}
        />
      ))}

      {/* 烟花/金尘 */}
      {Array.from({length: 22}, (_, index) => (
        <circle
          key={`spark-${index}`}
          cx={f(hash(3301, index) * 400)}
          cy={f((hash(3302, index) * 640 + frame * (0.2 + (index % 4) * 0.1)) % 640)}
          r={f(0.8 + hash(3303, index) * 1.6)}
          fill={index % 3 === 0 ? SENBON.paper : SENBON.gold}
          opacity={0.2 + hash(3304, index) * 0.4}
        />
      ))}

      <HalftoneRect patternId={id('dots')} opacity={0.55} />
      <rect width="400" height="640" fill="none" stroke={SENBON.gold} strokeWidth="1" opacity="0.25" />
    </svg>
  );
};

const SpearScene: React.FC<{frame: number; pulse: number}> = ({frame, pulse}) => {
  const id = useScreenId('spear');
  const spears = useMemo(
    () =>
      Array.from({length: 29}, (_, index) => ({
        x: 6 + index * 13.6 + (hash(4401, index) - 0.5) * 5,
        top: 54 + hash(4402, index) * 132,
        tilt: (hash(4403, index) - 0.5) * 5,
        shade: hash(4404, index),
      })),
    [],
  );
  return (
    <svg viewBox="0 0 400 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id={id('sky')} cx="50%" cy="42%" r="76%">
          <stop offset="0%" stopColor="#331512" />
          <stop offset="50%" stopColor="#170D0E" />
          <stop offset="100%" stopColor="#0B090A" />
        </radialGradient>
        <linearGradient id={id('spear')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6B6157" />
          <stop offset="45%" stopColor="#F4EFE6" />
          <stop offset="100%" stopColor="#8C8478" />
        </linearGradient>
        <linearGradient id={id('fog')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SENBON.ink} stopOpacity="0" />
          <stop offset="72%" stopColor={SENBON.ink} stopOpacity="0.2" />
          <stop offset="100%" stopColor={SENBON.ink} stopOpacity="0.95" />
        </linearGradient>
        <pattern id={id('dots')} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
          <circle cx="2" cy="2" r="0.9" fill={SENBON.silver} opacity="0.2" />
        </pattern>
      </defs>
      <rect width="400" height="640" fill={`url(#${id('sky')})`} />
      <circle cx="200" cy="210" r="180" fill={SENBON.cinnabar} opacity={0.06 + pulse * 0.03} />

      {/* 长戈森林 */}
      {spears.map((spear, index) => (
        <g key={`spear-${index}`} transform={`rotate(${f(spear.tilt)} ${f(spear.x)} 560)`}>
          <line x1={f(spear.x)} y1="560" x2={f(spear.x)} y2={f(spear.top + 46)} stroke={`url(#${id('spear')})`} strokeWidth={index % 4 === 0 ? 3.4 : 2.2} opacity={0.62 + spear.shade * 0.3} />
          {/* 戈尖 */}
          <path
            d={`M ${f(spear.x)} ${f(spear.top)} L ${f(spear.x + 10)} ${f(spear.top + 26)} L ${f(spear.x)} ${f(spear.top + 44)} L ${f(spear.x - 10)} ${f(spear.top + 26)} Z`}
            fill={SENBON.silver}
            stroke={SENBON.paper}
            strokeWidth="1"
          />
          <line x1={f(spear.x)} y1={f(spear.top + 6)} x2={f(spear.x)} y2={f(spear.top + 40)} stroke={SENBON.paper} strokeWidth="0.8" opacity="0.8" />
          {/* 红缨 */}
          <path
            d={`M ${f(spear.x)} ${f(spear.top + 40)} C ${f(spear.x - 10)} ${f(spear.top + 54)} ${f(spear.x - 6)} ${f(spear.top + 66)} ${f(spear.x - 14)} ${f(spear.top + 78)}`}
            fill="none"
            stroke={SENBON.cinnabar}
            strokeWidth="3.4"
            strokeLinecap="round"
            opacity="0.78"
          />
        </g>
      ))}

      {/* 天兵头盔剪影 */}
      {Array.from({length: 13}, (_, index) => {
        const x = 10 + index * 32 + (hash(5501, index) - 0.5) * 8;
        const y = 502 + (index % 3) * 18;
        const bob = Math.sin(frame * 0.18 + index) * 1.4;
        return (
          <g key={`helm-${index}`} transform={`translate(${f(x)} ${f(y + bob)})`}>
            <path d="M -20 0 C -26 -24 -12 -40 0 -40 C 12 -40 26 -24 20 0 Z" fill="#0D090A" stroke={SENBON.gold} strokeWidth="1.2" opacity="0.95" />
            <path d="M -17 -4 L 17 -4" stroke={SENBON.cinnabar} strokeWidth="2.2" opacity="0.8" />
            <path d="M 0 -40 C -4 -54 5 -64 1 -78" fill="none" stroke={SENBON.cinnabar} strokeWidth="3.4" strokeLinecap="round" opacity="0.8" />
            <rect x="-26" y="0" width="52" height="12" fill="#0B090A" stroke={SENBON.goldDeep} strokeWidth="0.8" opacity="0.7" />
          </g>
        );
      })}

      {/* 前景枪影：虚焦粗杆 */}
      {[70, 336].map((x, index) => (
        <g key={`fg-spear-${index}`} opacity="0.5" style={{filter: 'blur(1.6px)'}}>
          <line x1={x} y1="680" x2={x + 12} y2="330" stroke={SENBON.silverDim} strokeWidth="13" />
          <line x1={x} y1="680" x2={x + 12} y2="330" stroke={SENBON.paper} strokeWidth="4" opacity="0.4" />
        </g>
      ))}

      {Array.from({length: 26}, (_, index) => (
        <line
          key={`speed-${index}`}
          x1={hash(6601, index) * 400}
          y1={hash(6602, index) * 640}
          x2={hash(6601, index) * 400 - 40 - hash(6603, index) * 90}
          y2={hash(6602, index) * 640 + (hash(6604, index) - 0.5) * 20}
          stroke={index % 4 === 0 ? SENBON.gold : SENBON.silverDim}
          strokeWidth={index % 4 === 0 ? 1.6 : 0.8}
          opacity={0.1 + hash(6605, index) * 0.22}
        />
      ))}

      <HalftoneRect patternId={id('dots')} opacity={0.6} />
      <rect width="400" height="640" fill={`url(#${id('fog')})`} />
      <rect width="400" height="640" fill="none" stroke={SENBON.gold} strokeWidth="1" opacity="0.25" />
    </svg>
  );
};

const HeroScene: React.FC<{frame: number; pulse: number}> = ({frame, pulse}) => {
  const id = useScreenId('hero');
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg viewBox="0 0 400 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id={id('sky')} cx="58%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#2E1814" />
            <stop offset="52%" stopColor="#150D0E" />
            <stop offset="100%" stopColor="#0B090A" />
          </radialGradient>
          <radialGradient id={id('moon')} cx="44%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#FFF7DA" />
            <stop offset="46%" stopColor="#FCC934" />
            <stop offset="100%" stopColor="#8C5F0A" />
          </radialGradient>
          <pattern id={id('dots')} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
            <circle cx="2" cy="2" r="0.85" fill={SENBON.gold} opacity="0.22" />
          </pattern>
          <linearGradient id={id('arc')} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="38%" stopColor={SENBON.goldLight} stopOpacity="0.8" />
            <stop offset="72%" stopColor={SENBON.gold} stopOpacity="0.9" />
            <stop offset="100%" stopColor={SENBON.paper} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="400" height="640" fill={`url(#${id('sky')})`} />
        <circle cx="252" cy="160" r="146" fill={SENBON.cinnabar} opacity={0.09 + pulse * 0.04} />
        <circle cx="252" cy="160" r="104" fill={`url(#${id('moon')})`} />
        <circle cx="252" cy="160" r="104" fill={`url(#${id('dots')})`} opacity="0.6" />
        <circle cx="252" cy="160" r="114" fill="none" stroke={SENBON.cinnabar} strokeWidth="1.2" strokeDasharray="2 12" opacity="0.5" />

        {/* 挥棒残影弧 */}
        {[0, 1, 2, 3].map((index) => (
          <path
            key={`arc-${index}`}
            d={`M ${34 + index * 6} ${548 - index * 10} A ${250 - index * 8} ${250 - index * 8} 0 0 1 ${384 - index * 5} ${
              210 + index * 9
            }`}
            fill="none"
            stroke={`url(#${id('arc')})`}
            strokeWidth={22 - index * 4.6}
            opacity={0.46 - index * 0.1}
            strokeLinecap="round"
          />
        ))}
        <path d="M 30 560 A 262 262 0 0 1 390 196" fill="none" stroke={SENBON.paper} strokeWidth="1.4" opacity="0.55" />

        {/* 速度线 */}
        {Array.from({length: 18}, (_, index) => (
          <line
            key={`line-${index}`}
            x1={hash(7701, index) * 400}
            y1={hash(7702, index) * 640}
            x2={hash(7701, index) * 400 + 90 + hash(7703, index) * 120}
            y2={hash(7702, index) * 640 - 60 - hash(7704, index) * 80}
            stroke={index % 3 === 0 ? SENBON.gold : SENBON.paperDim}
            strokeWidth={index % 3 === 0 ? 1.4 : 0.7}
            opacity={0.08 + hash(7705, index) * 0.24}
          />
        ))}

        {/* 地面 */}
        <path d="M -20 586 C 90 566 300 566 420 590 L 420 660 L -20 660 Z" fill="#0B090A" />
        <path d="M -20 586 C 90 566 300 566 420 590" fill="none" stroke={SENBON.gold} strokeWidth="1.6" opacity="0.4" />
        <HalftoneRect patternId={id('dots')} opacity={0.55} />
        <rect width="400" height="640" fill="none" stroke={SENBON.gold} strokeWidth="1" opacity="0.25" />
      </svg>

      {/* 大圣侧面剪影 */}
      <div
        style={{
          position: 'absolute',
          left: -26,
          top: 116,
          width: 400,
          height: 512,
          filter: 'drop-shadow(0 0 8px rgba(252,201,52,0.35))',
        }}
      >
        <WukongRig
          pose="side_lunge"
          frame={frame}
          glow={0.9}
          high={0.2}
          wind={1.1}
          spinDegPerFrame={0}
          staffAngle={-0.58}
          eyeBurst={0.35 + pulse * 0.3}
        />
      </div>
    </div>
  );
};

const MicroScene: React.FC<{kind: PanelSceneKind; frame: number; pulse: number}> = ({kind, frame, pulse}) => {
  switch (kind) {
    case 'gate':
      return <GateScene frame={frame} pulse={pulse} />;
    case 'palace':
      return <PalaceScene frame={frame} pulse={pulse} />;
    case 'spear':
      return <SpearScene frame={frame} pulse={pulse} />;
    case 'hero':
    default:
      return <HeroScene frame={frame} pulse={pulse} />;
  }
};

const PanelCorners: React.FC<{color: string}> = ({color}) => {
  const d = 'M 4 48 L 4 4 L 48 4 L 48 16 L 16 16 L 16 32 L 32 32 L 32 48 Z';
  return (
    <svg viewBox="0 0 440 1040" width="100%" height="100%" style={{position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1}}>
      <g fill="none" stroke={color} strokeWidth="2.6" opacity="0.8">
        <path d={d} />
        <path d={d} transform="translate(440 0) scale(-1 1)" />
        <path d={d} transform="translate(0 1040) scale(1 -1)" />
        <path d={d} transform="translate(440 1040) scale(-1 -1)" />
      </g>
    </svg>
  );
};

const Panel: React.FC<{
  panel: ComicPanelSlot;
  index: number;
  time: number;
  frame: number;
  pulse: number;
  exitProgress: number;
}> = ({panel, index, time, frame, pulse, exitProgress}) => {
  const LEAD = 0.1;
  const local = clamp((time - panel.dropAt + LEAD) / 0.2);
  if (local <= 0) return null;
  const settle = overshoot(local, 7.6, 7.8);
  const fromTop = index % 2 === 0;
  const slideY = (1 - settle) * (fromTop ? -1240 : 1240);
  const exitDir = index < 2 ? -1 : 1;
  const slideX = easeInCubic(exitProgress) * 1500 * exitDir;
  const flash = local < 0.85 ? 1 - local / 0.85 : 0;
  const accent = panel.accent === 'gold' ? SENBON.gold : SENBON.cinnabar;

  return (
    <div
      style={{
        position: 'absolute',
        left: index * COLUMN + PAD,
        top: BOARD_TOP,
        width: CARD,
        height: BOARD_HEIGHT,
        transform: `translate3d(${f(slideX)}px, ${f(slideY)}px, 0)`,
        opacity: clamp(1 - exitProgress * 1.1),
        backgroundColor: '#0A0809',
        border: `2px solid ${SENBON.gold}`,
        boxShadow: `inset 0 0 0 3px #0A0809, inset 0 0 0 4.5px ${SENBON.cinnabar}, 0 24px 60px rgba(0,0,0,0.85)`,
        overflow: 'hidden',
      }}
    >
      {/* 和纸/网点肌理 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(244,239,230,0.10) 0.9px, rgba(244,239,230,0) 1.3px)',
          backgroundSize: '8px 8px',
          opacity: 0.4,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(217,48,37,0.2) 0%, rgba(11,9,10,0) 24%, rgba(11,9,10,0) 72%, rgba(11,9,10,0.9) 100%)`,
        }}
      />

      {/* 顶部题签 */}
      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: 14,
          height: 72,
          paddingRight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid rgba(252,201,52,0.45)`,
          fontFamily: SERIF_STACK,
          color: SENBON.goldPale,
          zIndex: 3,
        }}
      >
        <span style={{fontSize: 25, letterSpacing: '0.14em', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0}}>{panel.title}</span>
        <span
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            fontSize: 15,
            letterSpacing: '0.18em',
            color: accent,
            border: `1px solid ${accent}`,
            padding: '4px 7px',
            whiteSpace: 'nowrap',
            zIndex: 4,
          }}
        >
          {panel.indexLabel}
        </span>
      </div>

      {/* 微缩场景 */}
      <div style={{position: 'absolute', left: 12, right: 12, top: 96, height: 620, overflow: 'hidden', backgroundColor: SENBON.ink}}>
        <MicroScene kind={panel.scene} frame={frame} pulse={pulse} />
        {/* 场景内暗角 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 70% 62% at 50% 48%, rgba(11,9,10,0) 54%, rgba(11,9,10,0.55) 100%)',
          }}
        />
      </div>

      {/* 编号印章 */}
      <div style={{position: 'absolute', left: (CARD - 158) / 2, top: 738}}>
        <OrnateSealStamp text={panel.seal} subText={panel.subText} size={158} tone={panel.accent} rotate={index % 2 === 0 ? -2.5 : 2.5} />
      </div>

      {/* 底部说明 */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 20,
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid rgba(252,201,52,0.32)',
          fontFamily: SERIF_STACK,
          fontSize: 17,
          letterSpacing: '0.16em',
          color: 'rgba(244,239,230,0.72)',
          whiteSpace: 'nowrap',
        }}
      >
        {panel.caption}
      </div>

      <PanelCorners color={SENBON.goldPale} />

      {/* 砸落金闪 */}
      {flash > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: index % 2 === 0 ? SENBON.gold : SENBON.cinnabar,
            opacity: flash * 0.26,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </div>
  );
};

export const ComicPanels: React.FC<ComicPanelsProps> = ({time, frame, panels, exitAt, goneAt, pulse = 0}) => {
  const exitProgress = clamp((time - exitAt) / Math.max(0.001, goneAt - exitAt));
  if (exitProgress >= 1) return null;

  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none', backgroundColor: '#070506'}}>
      {/* 全屏金色横轨 + 分格立柱：参考片 00:30 的分屏骨架 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <rect x="0" y="6" width="1920" height="8" fill={SENBON.gold} opacity="0.85" />
        <rect x="0" y="1066" width="1920" height="8" fill={SENBON.gold} opacity="0.85" />
        <rect x="0" y="6" width="1920" height="2" fill={SENBON.goldPale} opacity="0.8" />
        {[0, 480, 960, 1440, 1920].map((x) => (
          <rect key={`pole-${x}`} x={x - 2} y="0" width="4" height="1080" fill={SENBON.gold} opacity="0.7" />
        ))}
        {[0, 480, 960, 1440, 1920].map((x) => (
          <g key={`cap-${x}`}>
            <rect x={x - 12} y="2" width="24" height="16" fill={SENBON.gold} />
            <rect x={x - 12} y="1062" width="24" height="16" fill={SENBON.gold} />
          </g>
        ))}
      </svg>

      {panels.map((panel, index) => (
        <Panel key={panel.id} panel={panel} index={index} time={time} frame={frame} pulse={pulse} exitProgress={exitProgress} />
      ))}

    </AbsoluteFill>
  );
};

export default ComicPanels;
