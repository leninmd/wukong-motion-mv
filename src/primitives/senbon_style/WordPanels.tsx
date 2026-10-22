import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {clamp} from '../../utils/math';
import {SERIF_STACK, SENBON, easeInCubic, easeOutCubic, f, overshoot} from './style';

/**
 * Shot 1 开场：复刻《千本樱》00:30 的四分屏快闪卡点。
 *
 * 四条倾斜 5° 的漫画分格竖屏，随前四个音节依次从上方高速砸落，黑底金边红字
 * 战幡；第 28 帧整体向左右两侧急速拉开，**不允许停留挡住后续画面**。
 *
 * 文本：每格整串汉字放在**一个**文本节点里（writing-mode: vertical-rl），
 * 不拆单字 DOM（AGENTS.md §2）。
 */

export interface WordPanel {
  id: string;
  text: string;
  dropAt: number;
  column: number;
  /** -1 向左出画，+1 向右出画。 */
  exit: -1 | 1;
  fontSize: number;
  accent: 'gold' | 'cinnabar';
}

export interface WordPanelsProps {
  time: number;
  panels: readonly WordPanel[];
  tilt: number;
  exitAt: number;
  goneAt: number;
  dropDuration?: number;
}

const COLUMN_COUNT = 4;

export const WordPanels: React.FC<WordPanelsProps> = ({
  time,
  panels,
  tilt,
  exitAt,
  goneAt,
  dropDuration = 0.13,
}) => {
  /* 分格从音节前 0.1s 就开始进入：落点仍在音节那一帧，但验收帧 20 已经能看到第四面 */
  const LEAD = 0.1;
  const {width, height} = useVideoConfig();
  const exitProgress = clamp((time - exitAt) / Math.max(0.001, goneAt - exitAt));
  if (exitProgress >= 1) return null;

  const columnWidth = width / COLUMN_COUNT;
  /* 竖屏比画框更高：整体斜切 5° 后仍然铺满上下边，缺口只露成黑色分格沟。 */
  const boardHeight = height * 1.34;
  const boardTop = (height - boardHeight) / 2;

  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {/* 分格沟底色：出画时同步淡出，否则会在 28–35 帧把后面的大圣一起盖黑 */}
      <AbsoluteFill style={{backgroundColor: '#000000', opacity: clamp(1 - exitProgress * 2.4)}} />
      <AbsoluteFill
        style={{
          transform: `rotate(${-tilt}deg)`,
          transformOrigin: '50% 50%',
        }}
      >
        {panels.map((panel) => {
          const local = clamp((time - panel.dropAt + LEAD) / dropDuration);
          if (local <= 0) return null;
          const drop = overshoot(local, 7.2, 7.6);
          const settle = easeOutCubic(local);
          const slide = easeInCubic(exitProgress) * 1780 * panel.exit;
          const flash = local < 1 ? 1 - local : 0;
          const accent = panel.accent === 'gold' ? SENBON.gold : SENBON.cinnabar;
          const accentSoft = panel.accent === 'gold' ? SENBON.goldLight : SENBON.paper;

          return (
            <div
              key={panel.id}
              style={{
                position: 'absolute',
                left: panel.column * columnWidth,
                top: boardTop - (1 - settle) * (height * 0.62),
                width: columnWidth,
                height: boardHeight,
                transform: `translate3d(${f(slide)}px, ${f((drop - 1) * -420)}px, 0)`,
                opacity: clamp(1.4 - exitProgress * 2.2),
              }}
            >
              {/* 分格黑底 + 金边 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 14,
                  backgroundColor: SENBON.ink,
                  border: `4px solid ${SENBON.gold}`,
                  boxShadow: `0 0 ${18 + flash * 30}px rgba(252,201,52,${0.32 + flash * 0.5}), inset 0 0 0 2px rgba(217,48,37,0.55)`,
                }}
              />
              {/* 网点质感 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 14,
                  backgroundImage:
                    'radial-gradient(circle, rgba(244,239,230,0.10) 1px, rgba(244,239,230,0) 1.4px)',
                  backgroundSize: '8px 8px',
                  mixBlendMode: 'screen',
                  opacity: 0.5,
                }}
              />
              {/* 上下金条 */}
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  right: 14,
                  top: 14,
                  height: 16,
                  background: `linear-gradient(90deg, ${SENBON.goldDeep}, ${SENBON.goldLight}, ${SENBON.goldDeep})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  right: 14,
                  bottom: 14,
                  height: 10,
                  background: `linear-gradient(90deg, ${SENBON.cinnabar}, ${SENBON.gold}, ${SENBON.cinnabar})`,
                }}
              />
              {/* 竖排战幡文字：单节点 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SERIF_STACK,
                  fontWeight: 900,
                  fontSize: panel.fontSize,
                  lineHeight: 1.02,
                  letterSpacing: '0.08em',
                  color: accent,
                  writingMode: 'vertical-rl',
                  textShadow: `0 0 18px ${accentSoft}, 0 0 4px ${SENBON.paper}, 0 3px 0 rgba(0,0,0,0.6)`,
                  WebkitTextStroke: `1px ${accentSoft}`,
                }}
              >
                {panel.text}
              </div>

              {/* 砸落红闪 */}
              {flash > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 14,
                    backgroundColor: SENBON.cinnabar,
                    opacity: flash * 0.32,
                    mixBlendMode: 'screen',
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* 整体黑遮罩：出画时压掉残影 */}
      <AbsoluteFill
        style={{backgroundColor: SENBON.ink, opacity: exitProgress * 0.35, pointerEvents: 'none'}}
      />
    </AbsoluteFill>
  );
};

export default WordPanels;
