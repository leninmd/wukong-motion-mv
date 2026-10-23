import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CLIMAX_ASSETS, ClimaxAsset} from './ClimaxAsset';
import {WASHI} from './PaperStage';
import {OrnateSealStamp} from './OrnateSealStamp';
import {SENBON, SERIF_STACK, clamp01, easeOutCubic, f} from './style';

/**
 * `<FourPaperPanels />` —— Sub1A：四道竖幅和纸画格。
 *
 * V5 的南天门是 4 个 <rect> 顶 1 个三角形、凌霄殿是两块黑梯形。V6 把这两格
 * 换成生图网关产出的 2K 浮世绘版画（`gate_woodblock.png` /
 * `palace_woodblock.png`，经 vtracer + resvg 矢量化），银戈林用
 * `army_silhouette.png` 的天兵压境局部，大圣用四色套版立绘。
 *
 * 四分屏的编号、标题、说明、宋体印仍由代码叠在画心上。
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

/**
 * 第 4 格（大圣格）在 `expand` 进度下的屏幕窗口。
 *
 * 主序列用它把后面的 1B 裁到同一个窗口里：这样撑开的确实是"画格"，
 * 而不是一条黑边在已经满屏的 1B 上滑动。窗口公式与组件内部完全同源，
 * 两边不会漂移。
 */
export const heroPanelWindow = (expand: number): {left: number; top: number; width: number; height: number} => {
  const push = easeOutCubic(clamp01(expand));
  const totalW = 4 * PANEL_W + 3 * GAP;
  const startX = 960 - totalW / 2;
  const heroX = startX + 3 * (PANEL_W + GAP);
  return {
    left: heroX * (1 - push),
    top: TOP * (1 - push),
    width: PANEL_W + (1920 - PANEL_W) * push,
    height: PANEL_H + (1080 - PANEL_H) * push,
  };
};

const PanelPlate: React.FC<{
  asset: 'gate' | 'palace' | 'army';
  objectPosition: string;
  filter?: string;
}> = ({asset, objectPosition, filter}) => (
  <Img
    src={staticFile(CLIMAX_ASSETS[asset].file)}
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition,
      filter,
    }}
  />
);

const SpearScene: React.FC = () => (
  <>
    <Img
      src={staticFile(CLIMAX_ASSETS.halberds.file)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: '50% 46%',
        transform: 'scale(1.03)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(18,13,20,0.12) 0%, rgba(18,13,20,0) 36%, rgba(18,13,20,0.58) 100%)',
      }}
    />
  </>
);

const HeroScene: React.FC = () => (
  <>
    <svg viewBox="0 0 424 860" width="424" height="860" style={{position: 'absolute', inset: 0}} preserveAspectRatio="none">
      <rect width="424" height="860" fill={WASHI.ochre} />
      <g opacity="0.24" stroke={WASHI.ink} strokeWidth="10">
        {Array.from({length: 9}, (_, i) => (
          <circle key={`ring-${i}`} cx="212" cy="600" r={40 + i * 46} fill="none" />
        ))}
      </g>
      <path d="M -20 700 Q 110 640 212 690 Q 320 742 444 676 L 444 880 L -20 880 Z" fill={WASHI.ink} opacity="0.18" />
    </svg>
    <ClimaxAsset asset="panel4" height={660} x={212} baseline={864} echo={0.2} rotate={-1} rim={0} />
  </>
);

export const FourPaperPanels: React.FC<FourPaperPanelsProps> = ({time, frame, panels, exitAt, goneAt, pulse = 0}) => {
  /* V8：exitAt→goneAt 不再是"整组抽走"，而是第 4 格横向撑满 1920px。
     撑开结束后，1B（本组件之后渲染）已经在下面待命。 */
  const expand = clamp01((time - exitAt) / Math.max(0.001, goneAt - exitAt));
  const push = easeOutCubic(expand);
  const totalW = panels.length * PANEL_W + (panels.length - 1) * GAP;
  const startX = 960 - totalW / 2;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {panels.map((panel, index) => {
        const local = clamp01((time - panel.dropAt) / 0.22);
        if (local <= 0) return null;
        const drop = easeOutCubic(local);
        const slide = Math.sin(drop * Math.PI * 0.5);
        const yOff = -120 * (1 - drop);
        const x = startX + index * (PANEL_W + GAP);
        const isHero = index === panels.length - 1;

        /* 大圣格：边框与画窗一起从 424×860 长到 1920×1080；
           前 3 格被高速推出画面左侧。 */
        const left = isHero ? x + (0 - x) * push : x - 1520 * push;
        const top = isHero ? TOP + yOff + (0 - TOP - yOff) * push : TOP + yOff;
        const width = isHero ? PANEL_W + (1920 - PANEL_W) * push : PANEL_W;
        const height = isHero ? PANEL_H + (1080 - PANEL_H) * push : PANEL_H;
        const frameFade = isHero ? 1 - clamp01((expand - 0.72) / 0.28) : 1;
        /* 第 4 格的画心先快速淡出，让撑开的窗直接露出后面的 1B。 */
        const contentFade = isHero ? 1 - clamp01(expand / 0.22) : 1 - push;
        const chromeFade = isHero ? 1 - clamp01(expand / 0.3) : 1 - push;

        return (
          <div
            key={panel.id}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              zIndex: isHero ? 22 : 12,
              transform: isHero ? undefined : `translateX(${f(-120 * push)}px) scaleX(${f(1 - 0.22 * push)})`,
              transformOrigin: '0% 50%',
              opacity: isHero ? 1 : 1 - push * 0.94,
              boxShadow: `0 ${18 + index * 2}px ${26}px rgba(40,26,16,${0.26 * slide * (1 - push)})`,
              backgroundColor: isHero ? undefined : panel.tone,
              overflow: 'hidden',
            }}
          >
            {/* 画心：第 4 格撑开后画心退场，把窗口让给 1B */}
            <div style={{position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, opacity: contentFade}}>
              {panel.scene === 'gate' ? <PanelPlate asset="gate" objectPosition="50% 46%" /> : null}
              {panel.scene === 'palace' ? <PanelPlate asset="palace" objectPosition="50% 42%" /> : null}
              {panel.scene === 'spear' ? <SpearScene /> : null}
              {panel.scene === 'hero' ? <HeroScene /> : null}
            </div>

            {/* 撑开时给窗口补一层暖光，避免露出 1B 的瞬间黑一下 */}
            {isHero && expand > 0.02 && expand < 0.98 ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                  background:
                    'radial-gradient(ellipse 70% 70% at 50% 55%, rgba(255,243,209,0.28) 0%, rgba(245,194,66,0.1) 46%, rgba(0,0,0,0) 76%)',
                  mixBlendMode: 'screen',
                  opacity: 1 - Math.abs(expand - 0.5) * 1.6,
                }}
              />
            ) : null}

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
                opacity: chromeFade,
              }}
            >
              <span style={{fontFamily: SERIF_STACK, fontSize: 19, letterSpacing: 4, color: SENBON.goldLight, flexShrink: 0}}>
                {panel.indexLabel}
              </span>
              <span style={{fontFamily: SERIF_STACK, fontSize: 25, fontWeight: 800, letterSpacing: 6, color: SENBON.paper, whiteSpace: 'nowrap'}}>
                {panel.title}
              </span>
            </div>

            {/* 底部说明 */}
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
                opacity: chromeFade,
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
                opacity: clamp01(local * 1.6) * chromeFade,
                transform: `rotate(${index % 2 === 0 ? -7 : 6}deg) scale(${0.72 + drop * 0.28 + pulse * 0.03})`,
                zIndex: 40,
              }}
            >
              <OrnateSealStamp text={panel.seal} subText={panel.caption.slice(0, 2)} size={118} rotate={0} tone={index % 2 === 0 ? 'cinnabar' : 'gold'} />
            </div>

            {/* 格子内框：外粗内细。第 4 格撑满后边框也淡出。 */}
            <div style={{position: 'absolute', inset: 0, border: `3px solid ${WASHI.ink}`, opacity: 0.82 * frameFade, zIndex: 2, pointerEvents: 'none'}} />
            <div style={{position: 'absolute', inset: 7, border: `1px solid ${WASHI.ink}`, opacity: 0.45 * frameFade, zIndex: 2, pointerEvents: 'none'}} />

            {/* 撑开时的金属包边高光 */}
            {isHero && expand > 0.05 ? (
              <>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, rgba(245,194,66,0), #F5C242 30%, #FFF3D1 50%, #F5C242 70%, rgba(245,194,66,0))', opacity: 0.8 * frameFade, zIndex: 3}} />
                <div style={{position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, rgba(245,194,66,0), #F5C242 30%, #FFF3D1 50%, #F5C242 70%, rgba(245,194,66,0))', opacity: 0.8 * frameFade, zIndex: 3}} />
              </>
            ) : null}
          </div>
        );
      })}

      {/* 顶部与底部压边：撑开时一起退场，不能挡住 1B */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: TOP, backgroundColor: WASHI.paperBright, opacity: 1 - push}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 1080 - TOP - PANEL_H, backgroundColor: WASHI.paperBright, opacity: 1 - push}} />
      <div style={{position: 'absolute', left: 60, right: 60, top: TOP - 10, height: 2, backgroundColor: WASHI.ink, opacity: 0.5 * (1 - push)}} />
      <div style={{position: 'absolute', left: 60, right: 60, top: TOP + PANEL_H + 8, height: 2, backgroundColor: WASHI.ink, opacity: 0.5 * (1 - push)}} />
    </AbsoluteFill>
  );
};

export default FourPaperPanels;
