import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ClimaxAsset} from './ClimaxAsset';
import {WASHI} from './PaperStage';
import {OrnateSealStamp} from './OrnateSealStamp';
import {SENBON, SERIF_STACK, clamp01, easeOutCubic, f} from './style';

/**
 * `<FourPaperPanels />` —— Sub1A：四道竖幅和纸画格。
 *
 * 复刻《千本樱》00:30 的四分屏：**每格自带一种底色**（米白 / 深绯 / 深黛 /
 * 泥金），而不是四块一样的黑牌。四格分别是南天门、凌霄殿飞檐与满月、银戈
 * 之林、大圣剪影；编号印（壹贰叁肆）跨在格子边框上砸下。
 *
 * 格子里的建筑都是"景"，可以代码画；**只有大圣本人**必须是真实资产。
 */

export interface PaperPanel {
  id: string;
  seal: string;
  indexLabel: string;
  title: string;
  caption: string;
  tone: string;
  scene: 'gate' | 'palace' | 'spear' | 'hero';
  dropAt: number;
}

export interface FourPaperPanelsProps {
  time: number;
  frame: number;
  panels: readonly PaperPanel[];
  exitAt: number;
  goneAt: number;
  pulse?: number;
}

const PANEL_W = 424;
const GAP = 30;
const TOP = 76;
const PANEL_H = 860;

const GateScene: React.FC<{accent: string}> = ({accent}) => (
  <svg viewBox="0 0 424 860" width="424" height="860" style={{position: 'absolute', inset: 0}} preserveAspectRatio="none">
    <rect width="424" height="860" fill={WASHI.paper} />
    <g fill={WASHI.ink}>
      <rect x="20" y="560" width="384" height="300" />
      <rect x="44" y="250" width="46" height="330" />
      <rect x="334" y="250" width="46" height="330" />
      <rect x="170" y="250" width="84" height="330" />
      <rect x="16" y="206" width="392" height="58" />
      <rect x="60" y="150" width="304" height="46" />
      <path d="M 92 150 L 212 76 L 332 150 Z" />
    </g>
    <g fill={accent}>
      <rect x="20" y="196" width="384" height="8" />
      <rect x="92" y="146" width="240" height="5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`step-${i}`} x={20 + i * 8} y={812 + i * 10} width={384 - i * 16} height={6} />
      ))}
    </g>
    <g stroke={WASHI.ink} strokeWidth="2" opacity="0.32">
      {Array.from({length: 12}, (_, i) => (
        <line key={`rain-${i}`} x1={i * 38} y1="0" x2={i * 38 - 40} y2="206" />
      ))}
    </g>
  </svg>
);

const PalaceScene: React.FC<{accent: string}> = ({accent}) => (
  <svg viewBox="0 0 424 860" width="424" height="860" style={{position: 'absolute', inset: 0}} preserveAspectRatio="none">
    <rect width="424" height="860" fill={WASHI.crimson} />
    <circle cx="300" cy="238" r="132" fill={WASHI.moon} />
    <circle cx="300" cy="238" r="132" fill="none" stroke="#F6DFA6" strokeWidth="2" opacity="0.55" />
    <g fill={WASHI.ink}>
      <path d="M -10 604 L 434 604 L 434 620 L -10 620 Z" />
      <path d="M 26 620 L 398 620 L 372 700 L 52 700 Z" />
      <path d="M 60 700 L 364 700 L 364 860 L 60 860 Z" />
      <path d="M -40 604 C 60 540 120 536 212 556 C 304 536 364 540 464 604 L 464 604 L -40 604 Z" />
      <path d="M 132 700 L 292 700 L 292 860 L 132 860 Z" fill={accent} opacity="0.55" />
    </g>
    <g fill={WASHI.ink}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={`eave-${i}`} x={64 + i * 50} y={590 - (i % 2) * 14} width="10" height="26" />
      ))}
    </g>
    <g stroke={WASHI.moon} strokeWidth="3" opacity="0.75">
      <line x1="26" y1="640" x2="398" y2="640" />
    </g>
  </svg>
);

const SpearScene: React.FC<{accent: string}> = ({accent}) => (
  <svg viewBox="0 0 424 860" width="424" height="860" style={{position: 'absolute', inset: 0}} preserveAspectRatio="none">
    <rect width="424" height="860" fill={WASHI.purple} />
    {Array.from({length: 26}, (_, i) => {
      const x = 8 + i * 16.4;
      const top = 120 + ((i * 37) % 150);
      return (
        <g key={`spear-${i}`} opacity={0.55 + (i % 3) * 0.15}>
          <line x1={x} y1={top} x2={x + 42} y2={860} stroke={i % 4 === 0 ? accent : ECHO_SILVER} strokeWidth={i % 4 === 0 ? 3 : 1.6} />
          <path d={`M ${x} ${top} l -7 -34 l 13 6 l -6 -26 l 12 28 l 8 -10 z`} fill={i % 4 === 0 ? accent : ECHO_SILVER} opacity="0.9" />
        </g>
      );
    })}
    <rect y="640" width="424" height="220" fill={WASHI.ink} opacity="0.55" />
    <g fill={WASHI.ink}>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={`helm-${i}`} cx={48 + i * 82} cy={786 + (i % 2) * 20} r="26" />
      ))}
    </g>
  </svg>
);

const ECHO_SILVER = '#C9C2B4';

const HeroScene: React.FC = () => (
  <>
    <svg viewBox="0 0 424 860" width="424" height="860" style={{position: 'absolute', inset: 0}} preserveAspectRatio="none">
      <rect width="424" height="860" fill={WASHI.ochre} />
      <g opacity="0.22" stroke={WASHI.ink} strokeWidth="10">
        {Array.from({length: 9}, (_, i) => (
          <circle key={`ring-${i}`} cx="212" cy="600" r={40 + i * 46} fill="none" />
        ))}
      </g>
    </svg>
    <ClimaxAsset asset="raise" height={548} x={212} baseline={856} echo={0.26} rim={0.4} />
  </>
);

export const FourPaperPanels: React.FC<FourPaperPanelsProps> = ({time, frame, panels, exitAt, goneAt, pulse = 0}) => {
  const exit = clamp01((time - exitAt) / Math.max(0.001, goneAt - exitAt));
  const totalW = panels.length * PANEL_W + (panels.length - 1) * GAP;
  const startX = 960 - totalW / 2;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {panels.map((panel, index) => {
        const local = clamp01((time - panel.dropAt) / 0.34);
        if (local <= 0) return null;
        const drop = easeOutCubic(local);
        const slide = Math.sin(drop * Math.PI * 0.5);
        const yOff = -120 * (1 - drop);
        const collapse = exit > 0 ? exit * (1 - Math.abs(index - 1.5) / 1.5) : 0;
        const scaleX = 1 - collapse * 0.72;
        const x = startX + index * (PANEL_W + GAP);
        return (
          <div
            key={panel.id}
            style={{
              position: 'absolute',
              left: x,
              top: TOP + yOff,
              width: PANEL_W,
              height: PANEL_H,
              transform: `scaleX(${f(scaleX)})`,
              transformOrigin: '50% 50%',
              opacity: 1 - collapse * 0.9,
              boxShadow: `0 ${18 + index * 2}px ${26}px rgba(40,26,16,${0.26 * slide})`,
              backgroundColor: panel.tone,
            }}
          >
            <div style={{position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0}}>
              {panel.scene === 'gate' ? <GateScene accent={WASHI.ochre} /> : null}
              {panel.scene === 'palace' ? <PalaceScene accent={WASHI.ochre} /> : null}
              {panel.scene === 'spear' ? <SpearScene accent={WASHI.cinnabar} /> : null}
              {panel.scene === 'hero' ? <HeroScene /> : null}
            </div>

            {/* 分格牌头：编号 + 标题 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 16,
                paddingRight: 12,
                background: `linear-gradient(180deg, rgba(18,13,20,0.92) 0%, rgba(18,13,20,0.62) 100%)`,
                zIndex: 30,
              }}
            >
              <span
                style={{
                  fontFamily: SERIF_STACK,
                  fontSize: 19,
                  letterSpacing: 4,
                  color: SENBON.goldLight,
                  flexShrink: 0,
                }}
              >
                {panel.indexLabel}
              </span>
              <span
                style={{
                  fontFamily: SERIF_STACK,
                  fontSize: 25,
                  fontWeight: 800,
                  letterSpacing: 6,
                  color: SENBON.paper,
                  whiteSpace: 'nowrap',
                }}
              >
                {panel.title}
              </span>
            </div>

            {/* 底部说明：一格一句，字号小、留给画面 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '10px 16px 12px',
                background: `linear-gradient(0deg, rgba(18,13,20,0.9) 0%, rgba(18,13,20,0.0) 100%)`,
                fontFamily: SERIF_STACK,
                fontSize: 16,
                letterSpacing: 2,
                color: 'rgba(244,236,214,0.92)',
                textAlign: 'right',
                zIndex: 30,
              }}
            >
              {panel.caption}
            </div>

            {/* 编号朱印跨出格子边框 */}
            <div
              style={{
                position: 'absolute',
                left: -26,
                bottom: 64,
                width: 118,
                height: 118,
                opacity: clamp01(local * 1.6) * (1 - collapse),
                transform: `rotate(${index % 2 === 0 ? -7 : 6}deg) scale(${0.72 + drop * 0.28 + pulse * 0.03})`,
                zIndex: 40,
              }}
            >
              <OrnateSealStamp
                text={panel.seal}
                subText={panel.caption.slice(0, 2)}
                size={118}
                rotate={0}
                tone={index % 2 === 0 ? 'cinnabar' : 'gold'}
              />
            </div>

            {/* 格子内框：外粗内细 */}
            <div style={{position: 'absolute', inset: 0, border: `3px solid ${WASHI.ink}`, opacity: 0.82, zIndex: 2}} />
            <div style={{position: 'absolute', inset: 7, border: `1px solid ${WASHI.ink}`, opacity: 0.45, zIndex: 2}} />
          </div>
        );
      })}

      {/* 顶部与底部压边，让四格像一张摊开的册页 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: TOP, backgroundColor: WASHI.paperBright}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 1080 - TOP - PANEL_H, backgroundColor: WASHI.paperBright}} />
      <div style={{position: 'absolute', left: 60, right: 60, top: TOP - 10, height: 2, backgroundColor: WASHI.ink, opacity: 0.5}} />
      <div style={{position: 'absolute', left: 60, right: 60, top: TOP + PANEL_H + 8, height: 2, backgroundColor: WASHI.ink, opacity: 0.5}} />
    </AbsoluteFill>
  );
};

export default FourPaperPanels;
