import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACKS, PALETTE} from '../config/theme';
import {clamp, ease, springPhysics} from '../utils/math';

export interface ParchmentPanel {
  /** Vertical headline, 2–4 glyphs. */
  text: string;
  /** Small seal glyphs at the foot of the panel. */
  seal: string;
  /** Horizontal lane centre in px. */
  y: number;
  /** Final x in px. */
  x: number;
  rotate?: number;
  width?: number;
  height?: number;
}

export interface ParchmentPanelsProps {
  panels: ParchmentPanel[];
  /** Seconds when the first sheet slams in. */
  startSeconds: number;
  /** Seconds each sheet holds before the wipe. */
  holdSeconds?: number;
  /** Seconds between sheets. */
  staggerSeconds?: number;
  opacity?: number;
  /** true = 只排字与印，不画纸面（AI 板上已有卷轴）。 */
  bare?: boolean;
}

/**
 * 罪状告示.
 *
 * Cream parchment sheets slam in one after another and then wipe away, exactly
 * like the printed notices in the reference MV. One DOM text node per sheet:
 * the writing is vertical (HTML `writing-mode`), not one span per glyph.
 */
export const ParchmentPanels: React.FC<ParchmentPanelsProps> = ({
  panels,
  startSeconds,
  holdSeconds = 1.1,
  staggerSeconds = 0.07,
  opacity = 1,
  bare = false,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const time = frame / fps;

  return (
    <div aria-hidden="true" style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity}}>
      {panels.map((panel, index) => {
        const enterStart = startSeconds + index * staggerSeconds;
        const local = time - enterStart;
        if (local < -0.05 || local > holdSeconds + 0.5) return null;
        const slam = springPhysics(clamp((local + 0.02) / 0.26), {
          stiffness: 420,
          damping: 15,
          mass: 0.7,
          duration: 0.26,
        });
        const exit = ease.inCubic(clamp((local - holdSeconds) / 0.34));
        const x = panel.x + (1 - slam) * 620 - exit * 1500;
        const width = panel.width ?? 236;
        const height = panel.height ?? 620;
        const rotate = (panel.rotate ?? 0) + (1 - slam) * 5 - exit * 3;

        return (
          <div
            key={`${panel.text}-${index}`}
            style={{
              position: 'absolute',
              left: x - width / 2,
              top: panel.y - height / 2,
              width,
              height,
              transform: `rotate(${rotate.toFixed(2)}deg)`,
              transformOrigin: '50% 90%',
              backgroundColor: bare ? 'transparent' : PALETTE.paper,
              border: bare ? 'none' : `2px solid ${PALETTE.ink}`,
              boxShadow: bare ? 'none' : '0 24px 60px rgba(0,0,0,0.55)',
              opacity: 1 - exit,
              overflow: 'hidden',
            }}
          >
            {/* inner double rule */}
            {bare ? null : (
              <>
                <div style={{position: 'absolute', inset: 9, border: '1px solid rgba(11,9,10,0.55)'}} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'radial-gradient(ellipse at 30% 20%, rgba(252,201,52,0.16) 0%, rgba(244,239,230,0) 55%), radial-gradient(ellipse at 75% 80%, rgba(217,48,37,0.1) 0%, rgba(244,239,230,0) 60%)',
                  }}
                />
              </>
            )}
            {/* vertical headline */}
            <div
              style={{
                position: 'absolute',
                top: 34,
                left: 0,
                width: '100%',
                writingMode: 'vertical-rl',
                textOrientation: 'upright',
                fontFamily: FONT_STACKS.heavy,
                fontWeight: 900,
                fontSize: 96,
                letterSpacing: '0.16em',
                lineHeight: 1.02,
                color: PALETTE.ink,
                textAlign: 'center',
              }}
            >
              {panel.text}
            </div>
            {/* seal */}
            <div
              style={{
                position: 'absolute',
                bottom: 22,
                left: '50%',
                transform: 'translateX(-50%) rotate(-3deg)',
                width: 54,
                height: 54,
                backgroundColor: PALETTE.cinnabar,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT_STACKS.heavy,
                fontWeight: 900,
                fontSize: 26,
                letterSpacing: 0,
                color: PALETTE.paper,
                writingMode: 'vertical-rl',
              }}
            >
              {panel.seal}
            </div>
          </div>
        );
      })}
    </div>
  );
};
