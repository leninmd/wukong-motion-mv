import React, {useId} from 'react';
import {SERIF_STACK} from './style';

/**
 * `<VerticalCartouche />` —— V7 的竖幅题笺（Cartouche）。
 *
 * 1B 的【十万天兵合围】在 V6 里是黑字直接压在黑天兵上，“合围”二字隐形。
 * V7 复刻《千本樱》的题笺：深墨底 + 双层鎏金框 + 顶部朱砂云头 +
 * 四角金云纹 + 鎏金竖排书法 + 底部朱文小印，保证 100% 可读。
 */

export interface VerticalCartoucheProps {
  text: string;
  subtitle?: string;
  /** 0–1，砸入/淡入。 */
  reveal?: number;
  style?: React.CSSProperties;
}

export const VerticalCartouche: React.FC<VerticalCartoucheProps> = ({text, subtitle = '天兵', reveal = 1, style}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const patternId = `cartouche-${rawId}`;
  const clip = 'polygon(0 2.5%, 4% 0, 96% 0, 100% 2.5%, 100% 97.5%, 96% 100%, 4% 100%, 0 97.5%)';
  return (
    <div
      style={{
        position: 'absolute',
        width: 220,
        height: 704,
        opacity: reveal,
        transform: `translateY(${(1 - reveal) * -26}px)`,
        filter: 'drop-shadow(0 26px 40px rgba(0,0,0,0.62))',
        ...style,
      }}
    >
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#080506', clipPath: clip}} />
      <div
        style={{
          position: 'absolute',
          inset: 4,
          background: 'linear-gradient(180deg, #1E1115 0%, #0D080A 55%, #170C10 100%)',
          clipPath: clip,
        }}
      />

      {/* 内层纸纹 / 墨屑 */}
      <svg viewBox="0 0 220 704" width="220" height="704" style={{position: 'absolute', inset: 0, opacity: 0.5}}>
        <defs>
          <pattern id={patternId} width="18" height="22" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="5" r="0.7" fill="#F5C242" opacity="0.18" />
            <path d="M 0 16 L 18 12" stroke="#F5C242" strokeWidth="0.4" opacity="0.08" />
          </pattern>
        </defs>
        <rect x="12" y="12" width="196" height="680" fill={`url(#${patternId})`} />
        {Array.from({length: 14}, (_, index) => (
          <circle key={`fiber-${index}`} cx={16 + (index * 47) % 188} cy={30 + (index * 91) % 640} r={1 + (index % 3) * 0.7} fill="#F5C242" opacity="0.12" />
        ))}
      </svg>

      {/* 双层鎏金外框 + 朱砂内线 */}
      <div style={{position: 'absolute', inset: 8, border: '4px solid #F5C242', boxShadow: '0 0 0 1px #4A2A0A, inset 0 0 0 1px #4A2A0A'}} />
      <div style={{position: 'absolute', inset: 16, border: '1px solid rgba(245,194,66,0.72)'}} />
      <div style={{position: 'absolute', inset: 22, border: '1px solid rgba(200,40,30,0.38)'}} />

      {/* 顶部朱砂云头 + 鎏金描边 */}
      <svg viewBox="0 0 120 46" width="120" height="46" style={{position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)'}}>
        <path
          d="M 8 38 Q 18 12 34 24 Q 42 2 60 16 Q 78 2 86 24 Q 102 12 112 38 Q 92 32 80 40 Q 60 30 40 40 Q 28 32 8 38 Z"
          fill="#C8281E"
          stroke="#F5C242"
          strokeWidth="1.8"
        />
        <circle cx="60" cy="26" r="3.2" fill="#F5C242" />
      </svg>

      {/* 四角金云纹 */}
      <svg viewBox="0 0 220 704" width="220" height="704" style={{position: 'absolute', inset: 0}}>
        {[
          [18, 64, 1, 1],
          [202, 64, -1, 1],
          [18, 640, 1, -1],
          [202, 640, -1, -1],
        ].map(([x, y, sx, sy], index) => (
          <g key={`cloud-${index}`} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} opacity="0.85">
            <path d="M 0 0 Q 18 -4 26 8 Q 34 2 44 10" fill="none" stroke="#F5C242" strokeWidth="1.6" />
            <path d="M 2 8 Q 14 4 22 14" fill="none" stroke="#C8281E" strokeWidth="1" />
          </g>
        ))}
      </svg>

      {/*
        竖排书法：单文本节点。
        V7 用 flex 垂直居中，6 个字的总高超过容器，首个"十"被顶到云头下面，
        题笺变成"万天兵合围"。V8 改为从 top 起排；V8.1 再下移 36px（100 → 136）：
        云头占 6–52px，52px 字号的实际字形上缘比行盒高约 10px，100px 起排时
        "十"的顶横仍会贴住云头下缘。136px 起排后，云头与首字之间留出 ≥70px 净空。
      */}
      <div
        style={{
          position: 'absolute',
          top: 136,
          left: '50%',
          width: 76,
          marginLeft: -38,
          writingMode: 'vertical-rl',
          fontFamily: SERIF_STACK,
          fontSize: 52,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: 2,
          color: '#F5C242',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          textShadow: '0 0 22px rgba(245,194,66,0.34), 0 3px 0 rgba(0,0,0,0.85)',
          WebkitTextStroke: '1px #0B0709',
        }}
      >
        {text}
      </div>

      {/* 底部朱文小印 */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          marginLeft: -21,
          width: 42,
          height: 42,
          backgroundColor: '#C8281E',
          border: '2px solid #F5C242',
          color: '#FFF3D1',
          fontFamily: SERIF_STACK,
          fontSize: 13,
          fontWeight: 800,
          lineHeight: '19px',
          textAlign: 'center',
          letterSpacing: 0,
          boxShadow: '0 0 0 1px #4A2A0A',
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

export default VerticalCartouche;
