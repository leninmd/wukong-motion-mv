import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {InkPointCloud} from '../primitives/InkPointCloud';
import {PaperSurface} from '../primitives/PaperSurface';
import {ParticleRain} from '../primitives/ParticleRain';
import {Seal} from '../primitives/Seal';
import {Typewriter} from '../primitives/Typewriter';
import {Vignette} from '../primitives/Vignette';
import {DERIVED, FONT_STACKS, PALETTE, SAFE_ZONE} from '../config/theme';
import {durationInFrames, frameFromSeconds} from '../utils/timing';

/**
 * The first foundation plate for 《孙悟空：金猴奋起千钧棒》.
 *
 * This is not a lyric scene and has no hard cuts. It is the visual proof that
 * the extracted Remotion primitives — paper, particles, point cloud, seal,
 * typewriter — hold together at 1920×1080 / 60 fps. Every beat below is
 * expressed in seconds and resolved through the composition fps.
 */
export const WUKONG_PROLOGUE_SECONDS = 10;
export const WUKONG_PROLOGUE_ID = 'WukongPrologue';

const TITLE = {
  first: '金猴奋起',
  second: '千钧棒',
  firstStart: 1.42,
  firstEnd: 3.05,
  secondStart: 3.12,
  secondEnd: 4.28,
  sealAt: 2.35,
  ruleAt: 4.18,
  subAt: 4.9,
  metaAt: 5.6,
  secondSealAt: 6.25,
  fadeAt: 8.9,
};

const secondsToFrame = (seconds: number, fps: number): number =>
  frameFromSeconds(seconds, fps);

export const WukongPrologue: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const intro = interpolate(frame, [0, durationInFrames(0.9, fps)], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outro = interpolate(
    frame,
    [
      secondsToFrame(TITLE.fadeAt, fps),
      secondsToFrame(TITLE.fadeAt + 1.0, fps),
    ],
    [1, 0],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const titleIn = interpolate(
    frame,
    [
      secondsToFrame(TITLE.firstStart - 0.4, fps),
      secondsToFrame(TITLE.firstStart + 0.4, fps),
    ],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const sealProgress = interpolate(
    frame,
    [
      secondsToFrame(TITLE.sealAt, fps),
      secondsToFrame(TITLE.sealAt + 0.5, fps),
    ],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const secondSealProgress = interpolate(
    frame,
    [
      secondsToFrame(TITLE.secondSealAt, fps),
      secondsToFrame(TITLE.secondSealAt + 0.5, fps),
    ],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const ruleProgress = interpolate(
    frame,
    [
      secondsToFrame(TITLE.ruleAt, fps),
      secondsToFrame(TITLE.ruleAt + 1.15, fps),
    ],
    [0, 1],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const supporting = interpolate(
    frame,
    [
      secondsToFrame(TITLE.subAt, fps),
      secondsToFrame(TITLE.subAt + 0.8, fps),
    ],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const metadata = interpolate(
    frame,
    [
      secondsToFrame(TITLE.metaAt, fps),
      secondsToFrame(TITLE.metaAt + 0.8, fps),
    ],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );
  const timeSeconds = frame / fps;
  const masterOpacity = intro * outro;
  const breath = 1 + Math.sin(timeSeconds * 0.42) * 0.012;

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink, color: PALETTE.paper}}>
      <AbsoluteFill style={{opacity: masterOpacity}}>
        <PaperSurface variant="ink" seed={83017} />

        {/* Gold eclipse. A single slow-breathing hero light keeps the frame from
            becoming a noisy wall of particles. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '44.5%',
            width: 900,
            height: 900,
            transform: `translate(-50%, -50%) scale(${breath.toFixed(4)})`,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 50% 50%, rgba(252,201,52,0.16) 0%, rgba(252,201,52,0.075) 35%, rgba(217,48,37,0.04) 57%, rgba(11,9,10,0) 72%)',
            boxShadow:
              '0 0 220px 20px rgba(252,201,52,0.035), inset 0 0 90px rgba(252,201,52,0.04)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '44.5%',
            width: 630,
            height: 630,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `1px solid ${DERIVED.gold18}`,
            opacity: 0.55,
          }}
        />

        <InkPointCloud
          count={2900}
          seed={60613}
          spread={3.8}
          flatten={0.68}
          arms={3}
          color={PALETTE.paper}
          accentColor={PALETTE.gold}
          opacity={0.8}
        />
        <ParticleRain
          variant="ash"
          count={190}
          seed={4401}
          speed={0.36}
          opacity={0.42}
        />
        <ParticleRain
          variant="ember"
          count={260}
          seed={8801}
          speed={0.68}
          opacity={0.7}
        />

        {/* Local contrast shield: never dim the whole frame just to make text
            legible. This ellipse protects the hero type only. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '49%',
            width: 1180,
            height: 670,
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(11,9,10,0.52) 0%, rgba(11,9,10,0.32) 48%, rgba(11,9,10,0) 74%)',
          }}
        />

        {/* Left cinnabar rule + vertical colophon */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_ZONE.left,
            top: 140,
            bottom: 128,
            width: 2,
            background: `linear-gradient(180deg, ${DERIVED.cinnabar78} 0%, ${DERIVED.cinnabar34} 58%, rgba(217,48,37,0) 100%)`,
            opacity: 0.74 * intro,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: SAFE_ZONE.left + 24,
            top: 170,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontFamily: FONT_STACKS.kai,
            fontSize: 21,
            letterSpacing: '0.3em',
            color: DERIVED.paper42,
            lineHeight: 1.8,
            opacity: intro * 0.9,
          }}
        >
          玄黑为骨 · 宣纸为息 · 朱砂为印 · 鎏金为火
        </div>

        {/* Upper-left slate */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_ZONE.left + 46,
            top: 78,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontFamily: FONT_STACKS.mono,
            fontSize: 13,
            letterSpacing: '0.32em',
            color: DERIVED.paper42,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: PALETTE.cinnabar,
              boxShadow: `0 0 16px ${PALETTE.cinnabar}`,
            }}
          />
          <span>WUKONG / MOTION STUDY 00</span>
        </div>

        {/* Right annotation: source text, not lyric */}
        <div
          style={{
            position: 'absolute',
            right: SAFE_ZONE.left - 10,
            top: 208,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 18,
            opacity: metadata,
          }}
        >
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 22}}>
            <div
              style={{
                width: 1,
                height: 212,
                background: `linear-gradient(180deg, ${DERIVED.gold45}, rgba(252,201,52,0))`,
                transform: 'translateY(4px)',
              }}
            />
            <div
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontFamily: FONT_STACKS.kai,
                fontSize: 20,
                letterSpacing: '0.24em',
                lineHeight: 1.65,
                color: DERIVED.paper70,
              }}
            >
              如意金箍棒
            </div>
            <div
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontFamily: FONT_STACKS.kai,
                fontSize: 16,
                letterSpacing: '0.2em',
                lineHeight: 1.6,
                color: DERIVED.paper42,
              }}
            >
              重一万三千五百斤
            </div>
          </div>
          <div
            style={{
              fontFamily: FONT_STACKS.mono,
              fontSize: 10,
              letterSpacing: '0.28em',
              color: DERIVED.gold45,
            }}
          >
            THE GOLDEN CUDGEL
          </div>
        </div>

        {/* Hero block */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '39.2%',
            transform: `translate(-50%, ${(1 - titleIn) * 26}px)`,
            width: 1080,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            opacity: titleIn,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACKS.heavy,
              fontWeight: 900,
              fontSize: 176,
              lineHeight: 0.92,
              letterSpacing: '0.055em',
              color: PALETTE.paper,
              textShadow:
                '0 2px 32px rgba(252,201,52,0.16), 0 24px 72px rgba(0,0,0,0.72)',
            }}
          >
            <div>
              <Typewriter
                text={TITLE.first}
                startFrame={secondsToFrame(TITLE.firstStart, fps)}
                endFrame={secondsToFrame(TITLE.firstEnd, fps)}
                showCursor={false}
              />
            </div>
            <div style={{color: PALETTE.gold}}>
              <Typewriter
                text={TITLE.second}
                startFrame={secondsToFrame(TITLE.secondStart, fps)}
                endFrame={secondsToFrame(TITLE.secondEnd, fps)}
                showCursor
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 34,
              width: 720,
              height: 2,
              transform: `scaleX(${ruleProgress})`,
              transformOrigin: '50% 50%',
              background: `linear-gradient(90deg, rgba(217,48,37,0) 0%, ${PALETTE.cinnabar} 26%, ${PALETTE.gold} 66%, rgba(252,201,52,0) 100%)`,
              opacity: 0.86,
            }}
          />

          <div
            style={{
              marginTop: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              opacity: supporting,
              transform: `translateY(${(1 - supporting) * 10}px)`,
            }}
          >
            <span
              style={{
                fontFamily: FONT_STACKS.kai,
                fontSize: 28,
                letterSpacing: '0.28em',
                color: DERIVED.paper70,
              }}
            >
              一棒破天 · 万象归火
            </span>
            <span
              style={{
                width: 1,
                height: 26,
                backgroundColor: DERIVED.cinnabar34,
              }}
            />
            <span
              style={{
                fontFamily: FONT_STACKS.mono,
                fontSize: 12,
                letterSpacing: '0.3em',
                color: DERIVED.gold45,
              }}
            >
              FOUNDATION PLATE
            </span>
          </div>
        </div>

        {/* Seal: right shoulder of the hero type */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(50% + 390px)',
            top: 286,
          }}
        >
          <Seal
            text="齐天大圣"
            size={200}
            progress={sealProgress}
            seed={23}
            rotate={-4.5}
          />
        </div>

        {/* Small counter-seal, placed in the empty lower-left field */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_ZONE.left + 276,
            top: 742,
          }}
        >
          <Seal
            text="如意"
            size={104}
            progress={secondSealProgress}
            seed={81}
            rotate={5.5}
            color={PALETTE.cinnabar}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_ZONE.left + 46,
            right: SAFE_ZONE.left - 10,
            bottom: 72,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderTop: `1px solid ${DERIVED.paper16}`,
            paddingTop: 18,
            opacity: metadata * 0.86,
          }}
        >
          <span
            style={{
              fontFamily: FONT_STACKS.mono,
              fontSize: 11,
              letterSpacing: '0.28em',
              color: DERIVED.paper42,
            }}
          >
            DETERMINISTIC CODE / 1920 × 1080 / 60 FPS
          </span>
          <span
            style={{
              fontFamily: FONT_STACKS.kai,
              fontSize: 18,
              letterSpacing: '0.24em',
              color: DERIVED.paper42,
            }}
          >
            序 · 工程底片
          </span>
        </div>

        <Vignette strength={0.72} grainOpacity={0.18} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
