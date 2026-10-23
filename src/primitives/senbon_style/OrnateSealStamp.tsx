import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, SERIF_STACK, f} from './style';

/**
 * `<OrnateSealStamp />` —— 复刻《千本樱》传统编号印章的五层复合图元。
 *
 * 铁律（AGENTS.md §12）：禁止用单个 rect + 单个 text 冒充印章。本组件的
 * 五层分别是：
 *   ① 玄黑卡片底 + 和纸纤维噪点        —— 让印章有纸上压印的载体
 *   ② 外粗内细双层描金框              —— 6px 外框 + 1.5px 内框
 *   ③ 四角传统回纹角花                —— 四段旋转 90° 的回纹 path
 *   ④ 朱砂印泥底 + 斑驳飞白 + 八卦暗纹  —— 不是纯色块
 *   ⑤ 核心书法大字 + 左侧竖排副标题 + 朱文小印
 *
 * 所有随机纹理都由 `hash(seed, i)` 生成，没有 Math.random，保证逐帧可复现。
 */
export interface OrnateSealStampProps {
  /** 中央大字，例如「壹」「不」。 */
  text: string;
  /** 左侧竖排副标题，例如「玉境」「合围」。 */
  subText?: string;
  /** 边长（px）。 */
  size?: number;
  rotate?: number;
  /** 金框主色 / 朱砂主色。 */
  tone?: 'cinnabar' | 'gold';
  /** 战损：刀痕裂纹 + 缺口。 */
  crack?: boolean;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CORNER_PATH =
  'M 22 56 L 22 22 L 56 22 L 56 35 L 35 35 L 35 45 L 46 45 L 46 56 Z';

/** 朱砂印泥块的缺角轮廓（不是完美矩形）。 */
const PLATE: Array<[number, number]> = [
  [35, 30],
  [205, 33],
  [208, 61],
  [204, 84],
  [209, 106],
  [207, 205],
  [181, 208],
  [162, 204],
  [140, 210],
  [118, 206],
  [96, 210],
  [74, 206],
  [52, 210],
  [32, 207],
  [30, 184],
  [34, 163],
  [30, 142],
  [34, 120],
  [30, 98],
  [34, 76],
  [30, 54],
];

const polygon = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

const trigrams = (cx: number, cy: number, radius: number): React.ReactNode =>
  Array.from({length: 8}, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const deg = (angle * 180) / Math.PI + 90;
    return (
      <g key={`tg-${index}`} transform={`translate(${f(x)} ${f(y)}) rotate(${f(deg)})`}>
        {[0, 1, 2].map((bar) => {
          const broken = index % 3 === bar;
          const width = 26;
          return broken ? (
            <g key={`bar-${bar}`}>
              <rect x={-width / 2} y={-5 + bar * 6} width={width * 0.38} height={2.2} fill={SENBON.cinnabarDeep} />
              <rect x={width * 0.12} y={-5 + bar * 6} width={width * 0.38} height={2.2} fill={SENBON.cinnabarDeep} />
            </g>
          ) : (
            <rect
              key={`bar-${bar}`}
              x={-width / 2}
              y={-5 + bar * 6}
              width={width}
              height={2.2}
              fill={SENBON.cinnabarDeep}
            />
          );
        })}
      </g>
    );
  });

export const OrnateSealStamp: React.FC<OrnateSealStampProps> = ({
  text,
  subText,
  size = 168,
  rotate = 0,
  tone = 'cinnabar',
  crack = false,
  opacity = 1,
  className,
  style,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `seal-${rawId}-${suffix}`;
  const accent = tone === 'gold' ? SENBON.gold : SENBON.cinnabar;

  const flecks = useMemo(
    () =>
      Array.from({length: 46}, (_, index) => ({
        x: 34 + hash(9011, index) * 172,
        y: 34 + hash(9012, index) * 172,
        w: 1.4 + hash(9013, index) * 9,
        h: 1 + hash(9014, index) * 4.2,
        a: 0.1 + hash(9015, index) * 0.38,
        light: hash(9016, index) > 0.62,
      })),
    [],
  );

  const cracks = useMemo(
    () => [
      'M 40 52 L 78 96 L 66 138 L 102 176 L 94 204',
      'M 198 44 L 156 92 L 174 128 L 136 168',
      'M 44 180 L 82 156 L 108 190',
      'M 196 164 L 164 148 L 178 112',
    ],
    [],
  );

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        transform: `rotate(${f(rotate)}deg)`,
        opacity,
        filter: 'drop-shadow(0 12px 22px rgba(0,0,0,0.72))',
        flex: '0 0 auto',
        ...style,
      }}
    >
      <svg viewBox="0 0 240 240" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <defs>
          <linearGradient id={id('gold')} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={SENBON.goldPale} />
            <stop offset="42%" stopColor={SENBON.gold} />
            <stop offset="100%" stopColor={SENBON.goldDeep} />
          </linearGradient>
          <linearGradient id={id('plate')} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#E8443A" />
            <stop offset="46%" stopColor={SENBON.cinnabar} />
            <stop offset="100%" stopColor="#A21F17" />
          </linearGradient>
          <radialGradient id={id('paste')} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#FF6A5B" stopOpacity="0.5" />
            <stop offset="48%" stopColor={SENBON.cinnabar} stopOpacity="0.08" />
            <stop offset="100%" stopColor="#5C0D08" stopOpacity="0.45" />
          </radialGradient>
          <pattern id={id('fibre')} width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 4H18" stroke={SENBON.paper} strokeWidth="0.4" opacity="0.06" />
            <path d="M0 13H18" stroke={SENBON.paper} strokeWidth="0.3" opacity="0.04" />
          </pattern>
          <pattern id={id('dots')} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
            <circle cx="2" cy="2" r="0.85" fill={SENBON.paper} opacity="0.16" />
            <circle cx="6.4" cy="6.2" r="0.55" fill={SENBON.goldPale} opacity="0.13" />
          </pattern>
          <clipPath id={id('plateClip')}>
            <polygon points={polygon(PLATE)} />
          </clipPath>
        </defs>

        {/* ① 玄黑载体 + 纸纤维 */}
        <rect x="3" y="3" width="234" height="234" fill={SENBON.ink} />
        <rect x="3" y="3" width="234" height="234" fill={`url(#${id('fibre')})`} />
        <rect x="3" y="3" width="234" height="234" fill={`url(#${id('dots')})`} opacity="0.5" />

        {/* ② 外层粗金框 + 内层细金框 */}
        <rect
          x="9"
          y="9"
          width="222"
          height="222"
          fill="none"
          stroke={`url(#${id('gold')})`}
          strokeWidth="6.4"
        />
        <rect
          x="17.6"
          y="17.6"
          width="204.8"
          height="204.8"
          fill="none"
          stroke={SENBON.goldLight}
          strokeWidth="1.5"
          opacity="0.86"
        />
        <rect x="17.6" y="17.6" width="204.8" height="204.8" fill="none" stroke={SENBON.ink} strokeWidth="3.4" />

        {/* ③ 四角回纹角花 */}
        <g fill="none" stroke={`url(#${id('gold')})`} strokeWidth="3.1" strokeLinejoin="miter">
          <path d={CORNER_PATH} />
          <path d={CORNER_PATH} transform="rotate(90 120 120)" />
          <path d={CORNER_PATH} transform="rotate(180 120 120)" />
          <path d={CORNER_PATH} transform="rotate(270 120 120)" />
        </g>
        <g fill={SENBON.goldLight} opacity="0.9">
          <rect x="18" y="18" width="7" height="7" />
          <rect x="215" y="18" width="7" height="7" />
          <rect x="18" y="215" width="7" height="7" />
          <rect x="215" y="215" width="7" height="7" />
        </g>

        {/* ④ 朱砂印泥底：缺角轮廓 + 斑驳飞白 + 八卦暗纹 */}
        <g clipPath={`url(#${id('plateClip')})`}>
          <rect x="28" y="28" width="184" height="184" fill={`url(#${id('plate')})`} />
          <rect x="28" y="28" width="184" height="184" fill={`url(#${id('paste')})`} />
          <rect x="28" y="28" width="184" height="184" fill={`url(#${id('dots')})`} opacity="0.8" />
          {/* 八卦：8 组三爻 */}
          <g opacity="0.3">{trigrams(120, 120, 66)}</g>
          <circle cx="120" cy="120" r="49" fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="1.6" opacity="0.35" />
          {/* 云纹暗印 */}
          <g fill="none" stroke={SENBON.cinnabarDeep} strokeWidth="2.4" opacity="0.28">
            <path d="M 54 74 C 66 58 88 58 96 72 C 104 86 92 98 80 90 C 72 84 76 72 86 74" />
            <path d="M 186 74 C 174 58 152 58 144 72 C 136 86 148 98 160 90 C 168 84 164 72 154 74" />
            <path d="M 54 172 C 66 188 88 188 96 174 C 104 160 92 148 80 156 C 72 162 76 174 86 172" />
            <path d="M 186 172 C 174 188 152 188 144 174 C 136 160 148 148 160 156 C 168 162 164 174 154 172" />
          </g>
          {/* 斑驳飞白 */}
          {flecks.map((fleck, index) => (
            <rect
              key={`fleck-${index}`}
              x={f(fleck.x)}
              y={f(fleck.y)}
              width={f(fleck.w)}
              height={f(fleck.h)}
              fill={fleck.light ? SENBON.paper : '#4A0B07'}
              opacity={f(fleck.a)}
            />
          ))}
          {/* 印泥边缘积墨 */}
          <polygon points={polygon(PLATE)} fill="none" stroke="#4A0B07" strokeWidth="4" opacity="0.42" />
          <polygon points={polygon(PLATE)} fill="none" stroke={SENBON.goldLight} strokeWidth="0.9" opacity="0.3" />
        </g>

        {/* 战损裂纹 */}
        {crack ? (
          <g>
            {cracks.map((d, index) => (
              <g key={`crack-${index}`}>
                <path d={d} fill="none" stroke="#2A0604" strokeWidth={4.2 - index * 0.5} opacity="0.82" />
                <path d={d} fill="none" stroke={SENBON.goldLight} strokeWidth="1" opacity="0.3" transform="translate(1.6 1.2)" />
              </g>
            ))}
            <polygon points="28,28 52,30 40,46 30,42" fill={SENBON.ink} opacity="0.9" />
            <polygon points="212,190 196,212 208,212 212,202" fill={SENBON.ink} opacity="0.9" />
          </g>
        ) : null}

        {/* 顶部朱文小印的挂绳孔 */}
        <circle cx="120" cy="14.5" r="3.2" fill={SENBON.ink} stroke={SENBON.gold} strokeWidth="1.2" />
      </svg>

      {/* ⑤ 左侧竖排副标题 */}
      {subText ? (
        <div
          style={{
            position: 'absolute',
            left: '5.2%',
            top: '22%',
            width: '12%',
            height: '54%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            writingMode: 'vertical-rl',
            fontFamily: SERIF_STACK,
            fontWeight: 700,
            fontSize: Math.max(9, size * (subText.length > 3 ? 0.066 : 0.082)),
            letterSpacing: '0.2em',
            lineHeight: 1.05,
            color: 'rgba(244,239,230,0.94)',
            textShadow: '0 1px 2px rgba(0,0,0,0.65)',
            borderRight: `1px solid ${accent === SENBON.gold ? SENBON.gold : 'rgba(252,201,52,0.7)'}`,
            paddingRight: size * 0.012,
          }}
        >
          {subText}
        </div>
      ) : null}

      {/* ⑤ 中央书法大字（单文本节点） */}
      <div
        style={{
          position: 'absolute',
          left: '15%',
          right: '5%',
          top: '12%',
          bottom: '10%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF_STACK,
          fontWeight: 900,
          fontSize: size * (text.length > 1 ? 0.3 : 0.47),
          lineHeight: 1,
          letterSpacing: text.length > 1 ? '0.04em' : '0',
          color: 'rgba(244,239,230,0.97)',
          WebkitTextStroke: '0.6px rgba(11,9,10,0.32)',
          textShadow:
            '0 2px 0 rgba(74,11,7,0.85), 0 0 12px rgba(255,106,91,0.32), 0 6px 14px rgba(0,0,0,0.45)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>

      {/* ⑤ 朱文小印 */}
      {size >= 96 ? (
        <div
          style={{
            position: 'absolute',
            right: '7.5%',
            bottom: '7%',
            width: '17%',
            height: '17%',
            backgroundColor: SENBON.cinnabar,
            border: '1.2px solid rgba(244,239,230,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SERIF_STACK,
            fontWeight: 800,
            fontSize: size * 0.105,
            color: SENBON.paper,
            boxShadow: 'inset 0 0 6px rgba(74,11,7,0.6)',
            lineHeight: 1,
          }}
        >
          印
        </div>
      ) : null}
    </div>
  );
};

export default OrnateSealStamp;
