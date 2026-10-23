import React from 'react';
import {SERIF_STACK} from './style';

/**
 * `<HeavySeal />` —— V7 的实心破壁巨印。
 *
 * V6 的四角印是透明细红框 + 细字，叠在红白条纹上完全看不见。V7 改为：
 * 实心墨黑或朱砂底、8px 鎏金外框、2px 内框、160px 纯白/鎏金狂草字、
 * 四角金钉与刀劈裂纹。字体仍是单文本节点（AGENTS.md §2 / §9.2）。
 */

export interface HeavySealProps {
  text: string;
  size?: number;
  tone?: 'ink' | 'cinnabar';
}

export const HeavySeal: React.FC<HeavySealProps> = ({text, size = 270, tone = 'ink'}) => {
  const background = tone === 'ink' ? '#120D14' : '#B81D13';
  const textColour = tone === 'ink' ? '#F4EFE6' : '#FFF3D1';
  const bevel = 'polygon(4% 0, 96% 0, 100% 4%, 100% 96%, 96% 100%, 4% 100%, 0 96%, 0 4%)';
  return (
    <div style={{position: 'relative', width: size, height: size, filter: 'drop-shadow(0 18px 28px rgba(0,0,0,0.68))'}}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: background, clipPath: bevel}} />
      <div style={{position: 'absolute', inset: 4, border: '8px solid #F5C242', clipPath: bevel, boxShadow: 'inset 0 0 0 1px #4A2A0A'}} />
      <div style={{position: 'absolute', inset: 16, border: '2px solid rgba(255,243,209,0.8)'}} />
      <div style={{position: 'absolute', inset: 23, border: '1px solid rgba(200,40,30,0.7)'}} />

      {/* 印刷纸纹 / 墨屑 */}
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{position: 'absolute', inset: 0, opacity: 0.5}}>
        {Array.from({length: 26}, (_, index) => (
          <line
            key={`fibre-${index}`}
            x1={14 + ((index * 37) % (size - 28))}
            y1={12 + ((index * 53) % (size - 24))}
            x2={14 + ((index * 37) % (size - 28)) + 12 + (index % 5) * 8}
            y2={12 + ((index * 53) % (size - 24)) + 2}
            stroke="#F5C242"
            strokeWidth="0.6"
            opacity="0.18"
          />
        ))}
      </svg>

      {/* 四角金钉 */}
      {[
        [10, 10],
        [size - 22, 10],
        [10, size - 22],
        [size - 22, size - 22],
      ].map(([x, y], index) => (
        <div
          key={`nail-${index}`}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 12,
            height: 12,
            backgroundColor: '#F5C242',
            boxShadow: 'inset 0 0 0 2px #4A2A0A',
          }}
        />
      ))}

      {/* 单文本节点：160px 狂草大字 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF_STACK,
          fontSize: 160,
          fontWeight: 900,
          color: textColour,
          WebkitTextStroke: tone === 'ink' ? '2px #F5C242' : '2px #120D14',
          textShadow: '0 6px 0 rgba(0,0,0,0.55)',
        }}
      >
        {text}
      </div>

      {/* 刀劈裂纹 */}
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <polyline points={`0,${size * 0.32} ${size * 0.18},${size * 0.38} ${size * 0.1},${size * 0.55}`} fill="none" stroke="#F5C242" strokeWidth="2.4" opacity="0.65" />
        <polyline points={`${size},${size * 0.68} ${size * 0.82},${size * 0.62} ${size * 0.9},${size * 0.45}`} fill="none" stroke="#F5C242" strokeWidth="2.2" opacity="0.55" />
        <polyline points={`${size * 0.4},0 ${size * 0.46},${size * 0.12} ${size * 0.36},${size * 0.18}`} fill="none" stroke="#120D14" strokeWidth="1.8" opacity="0.8" />
      </svg>
    </div>
  );
};

export default HeavySeal;
