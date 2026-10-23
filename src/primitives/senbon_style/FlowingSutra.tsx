import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {hash} from '../../utils/math';
import {SERIF_STACK, clamp01, f} from './style';

/**
 * `<FlowingSutra />` —— V8 的五指山"流动镇压网"。
 *
 * V7 的 `five_finger_mountain_woodblock.png` 是一张死图，山上的金色梵文
 * 永远不动，2.5 秒里整座山像壁纸。V8 在岩面上叠 12 列**竖向流动的鎏金经文
 * 瀑布**：每列一个文本节点（遵守 AGENTS.md §9.2，绝不逐字拆 DOM），按不同
 * 速度向下滚动，带发光与两端渐隐遮罩。
 *
 * 列只落在左右岩壁上（x 80–560 / 1360–1840），不压中央裂谷里的大圣。
 */

export interface FlowingSutraProps {
  time: number;
  /** 起播秒数（五指山落定后）。 */
  start: number;
  opacity?: number;
  /** 0–1，随山体压降一起增强。 */
  intensity?: number;
}

interface ColumnSpec {
  x: number;
  top: number;
  width: number;
  fontSize: number;
  speed: number;
  phase: number;
  opacity: number;
  tone: 'gold' | 'paper' | 'cinnabar';
}

const MANTRA = '唵嘛呢叭咪吽鎮壓封敕令';
const COLUMN_TEXT = `${MANTRA}${MANTRA}${MANTRA}${MANTRA}`;

export const FlowingSutra: React.FC<FlowingSutraProps> = ({time, start, opacity = 1, intensity = 0}) => {
  const local = Math.max(0, time - start);
  const columns = useMemo<ColumnSpec[]>(() => {
    const left = Array.from({length: 6}, (_, index) => ({
      x: 54 + index * 94 + (hash(6100, index) - 0.5) * 26,
      top: -360 - hash(6101, index) * 220,
      width: 84,
      fontSize: 26 + hash(6102, index) * 16,
      speed: 26 + hash(6103, index) * 52,
      phase: hash(6104, index) * 900,
      opacity: 0.22 + hash(6105, index) * 0.3,
      tone: (index % 3 === 0 ? 'paper' : index % 5 === 0 ? 'cinnabar' : 'gold') as ColumnSpec['tone'],
    }));
    const right = Array.from({length: 6}, (_, index) => ({
      x: 1370 + index * 94 + (hash(6110, index) - 0.5) * 26,
      top: -360 - hash(6111, index) * 220,
      width: 84,
      fontSize: 26 + hash(6112, index) * 16,
      speed: 30 + hash(6113, index) * 56,
      phase: hash(6114, index) * 900,
      opacity: 0.2 + hash(6115, index) * 0.32,
      tone: (index % 4 === 0 ? 'paper' : index % 6 === 0 ? 'cinnabar' : 'gold') as ColumnSpec['tone'],
    }));
    return [...left, ...right];
  }, []);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden', opacity}}>
      {columns.map((column, index) => {
        const travel = (local * column.speed + column.phase) % 760;
        const top = column.top + travel;
        const colour = column.tone === 'paper' ? '#F4EFE6' : column.tone === 'cinnabar' ? '#D93025' : '#F5C242';
        return (
          <div
            key={`sutra-${index}`}
            style={{
              position: 'absolute',
              left: column.x,
              top,
              width: column.width,
              writingMode: 'vertical-rl',
              fontFamily: SERIF_STACK,
              fontSize: column.fontSize,
              fontWeight: 700,
              lineHeight: 1.42,
              letterSpacing: 10,
              color: colour,
              opacity: column.opacity * clamp01(0.55 + intensity * 0.6),
              whiteSpace: 'nowrap',
              mixBlendMode: 'screen',
              textShadow: `0 0 ${12 + intensity * 10}px rgba(245,194,66,0.55), 0 0 2px rgba(255,243,209,0.8)`,
              WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 12%, #000 82%, transparent 100%)',
              maskImage: 'linear-gradient(180deg, transparent 0%, #000 12%, #000 82%, transparent 100%)',
            }}
          >
            {COLUMN_TEXT}
          </div>
        );
      })}

      {/* 山体表面的金色压力网：横向流动的细光带，与竖列形成网格 */}
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0, opacity: 0.36 + intensity * 0.3, mixBlendMode: 'screen'}}>
        {Array.from({length: 7}, (_, index) => {
          const y = 120 + index * 132 + Math.sin(local * 1.6 + index) * 8;
          const shift = (local * (22 + index * 9)) % 260;
          return (
            <g key={`pressure-${index}`}>
              <path
                d={`M -240 ${f(y)} Q 160 ${f(y - 18)} 520 ${f(y + 8)} T 1080 ${f(y - 6)} T 1600 ${f(y + 10)} T 2160 ${f(y - 4)}`}
                fill="none"
                stroke={index % 3 === 0 ? '#D93025' : '#F5C242'}
                strokeWidth={1.4 + (index % 3) * 0.8}
                strokeDasharray="22 30"
                strokeDashoffset={f(-shift)}
                opacity={0.24 + (index % 4) * 0.1}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export default FlowingSutra;
