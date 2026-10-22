import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FONT_STACKS, PALETTE} from '../config/theme';
import {clamp, hash, springPhysics} from '../utils/math';

export interface BurstTypeProps {
  text: string;
  /** Cue time in seconds, straight from the alignment unit. */
  startSeconds: number;
  holdSeconds: number;
  /** Centre in canvas pixels. */
  x: number;
  y: number;
  size?: number;
  rotate?: number;
  /** 0–1, drives the splatter and the hot frame. */
  power?: number;
  seed?: number;
}

/**
 * 爆破字.
 *
 * 按宪法 §9.2：整字在**单个 canvas** 里绘制，DOM 里只有一个 canvas 节点，
 * 不存在"每个汉字一个 span 再单独做 transform"的结构。绘制管线：
 * 墨色厚描边 → 朱砂描边 → 鎏金渐变填充 → 冲击白热帧 → 朱砂飞溅。
 */
export const BurstType: React.FC<BurstTypeProps> = ({
  text,
  startSeconds,
  holdSeconds,
  x,
  y,
  size = 184,
  rotate = 0,
  power = 1,
  seed = 313,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const time = frame / fps;
  const local = time - startSeconds;

  const active = local >= -0.01 && local <= holdSeconds + 0.3;
  const pop = springPhysics(clamp((local + 0.012) / 0.26), {
    stiffness: 360,
    damping: 13.5,
    mass: 0.7,
    duration: 0.26,
  });
  const scale = 0.48 + pop * 0.64;
  const exit = local > holdSeconds ? clamp((local - holdSeconds) / 0.3) : 0;
  const fadeIn = clamp(local / 0.05);
  const opacity = fadeIn * (1 - exit);
  const hot = Math.max(0, 1 - local / 0.11);
  const blur = (1 - clamp(local / 0.1)) * 6;
  const jitter = (hash(seed, Math.round(frame)) - 0.5) * 4 * hot;

  const pad = Math.round(size * 0.42);
  const cw = Math.round(size * 1.6 + pad * 2);
  const ch = Math.round(size * 1.25 + pad * 2);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, cw, ch);
    if (!active || opacity <= 0.002) return;

    const cx = cw / 2;
    const cy = ch / 2;
    c.save();
    c.font = `900 ${size}px ${FONT_STACKS.heavy}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';

    // 墨色厚描边：把字从任何底图上切出来
    c.lineWidth = size * 0.17;
    c.strokeStyle = PALETTE.ink;
    c.strokeText(text, cx, cy);

    // 朱砂描边
    c.lineWidth = size * 0.055;
    c.strokeStyle = PALETTE.cinnabar;
    c.strokeText(text, cx, cy);

    // 鎏金渐变填充
    const grad = c.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.5);
    grad.addColorStop(0, '#F4EFE6');
    grad.addColorStop(0.34, PALETTE.gold);
    grad.addColorStop(0.62, '#E4AE28');
    grad.addColorStop(1, PALETTE.gold);
    c.fillStyle = grad;
    c.fillText(text, cx, cy);

    // 冲击白热帧
    if (hot > 0.01) {
      c.globalAlpha = hot * 0.9;
      c.fillStyle = PALETTE.paper;
      c.fillText(text, cx, cy);
      c.globalAlpha = 1;
    }

    // 朱砂飞溅（确定性）
    if (power > 0.5) {
      for (let i = 0; i < 14; i += 1) {
        const a = hash(seed, i * 3) * Math.PI * 2;
        const r = size * (0.52 + hash(seed, i * 3 + 1) * 0.4) * (0.6 + pop * 0.5);
        c.globalAlpha = 0.16 * power * (1 - exit);
        c.fillStyle = PALETTE.cinnabar;
        c.beginPath();
        c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1.6 + hash(seed, i + 5) * 3.2, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    c.restore();
  }, [active, ch, cw, exit, hot, opacity, pop, power, seed, size, text]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      width={cw}
      height={ch}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: cw,
        height: ch,
        transform: `translate(${-cw / 2 + jitter}px, ${-ch / 2 - jitter * 0.6}px) rotate(${rotate}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: '50% 50%',
        opacity,
        filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        pointerEvents: 'none',
      }}
    />
  );
};
