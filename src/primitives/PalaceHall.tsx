import React, {useLayoutEffect, useRef} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, hash, lerp} from '../utils/math';

export interface PalaceHallProps {
  /** 0–1 drum accent. */
  pulse?: number;
  /** Camera dolly: world z travelled per second. */
  dolly?: number;
  /** Lateral camera drift in world units per second. */
  pan?: number;
  opacity?: number;
  mood?: 'gold' | 'red';
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}

const W = 1920;
const H = 1080;
const VP = {x: 960, y: 546};
const FOCAL = 880;

const GOLD = (a: number) => `rgba(252,201,52,${a.toFixed(3)})`;
const PAPER = (a: number) => `rgba(244,239,230,${a.toFixed(3)})`;
const RED = (a: number) => `rgba(217,48,37,${a.toFixed(3)})`;

/** One-point projection. z grows into the frame. */
const project = (x: number, y: number, z: number) => {
  const s = FOCAL / Math.max(1, FOCAL + z);
  return {x: VP.x + x * s, y: VP.y + y * s, s};
};

/** Atmospheric fade: far geometry sinks into the ink. */
const depthAlpha = (z: number, near = 0.95, far = 0.12) =>
  lerp(near, far, clamp(z / 3600));

const COLUMNS_X = 430;
const CEIL_Y = -560;
const FLOOR_Y = 300;

/**
 * 凌霄殿 · 一点透视长殿.
 *
 * 之前几版像 PPT，根因是"没有透视、没有遮挡、没有光"。这一版把整场建成一个
 * 一点透视的长殿：地面网格、两列立柱、藻井横梁、悬挂幡、门洞后的月光、地面积水，
 * 全部由同一套 project() 画出来，所以镜头一推，整个空间一起走。
 */
export const PalaceHall: React.FC<PalaceHallProps> = ({
  pulse = 0,
  dolly = 0,
  pan = 0,
  opacity = 1,
  mood = 'gold',
  width = W,
  height = H,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = frame / fps;
  const accent = clamp(pulse);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, width, height);
    if (opacity <= 0.002) return;

    const isRed = mood === 'red';
    const camZ = dolly * t;
    const camX = pan * t;
    const P = (x: number, y: number, z: number) => project(x - camX, y, z + camZ);

    // ---------- 0. 夜色底 ----------
    const sky = c.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, isRed ? '#2A0A0E' : '#191430');
    sky.addColorStop(0.42, isRed ? '#1B070A' : '#12101F');
    sky.addColorStop(1, '#050406');
    c.fillStyle = sky;
    c.fillRect(0, 0, width, height);

    // ---------- 1. 门洞与月 ----------
    const gate = P(0, 0, 3600);
    c.save();
    // 门洞后的光
    const glow = c.createRadialGradient(gate.x, gate.y, 10, gate.x, gate.y, 520);
    glow.addColorStop(0, GOLD(0.5 + accent * 0.16));
    glow.addColorStop(0.35, GOLD(0.16));
    glow.addColorStop(1, 'rgba(252,201,52,0)');
    c.fillStyle = glow;
    c.fillRect(gate.x - 560, gate.y - 560, 1120, 1120);
    // 月
    const moonR = 76 * gate.s * 3.4;
    const moon = c.createRadialGradient(gate.x - moonR * 0.3, gate.y - moonR * 0.4, 4, gate.x, gate.y, moonR);
    moon.addColorStop(0, '#FFF6DC');
    moon.addColorStop(0.62, '#F1D693');
    moon.addColorStop(1, '#CDA43F');
    c.fillStyle = moon;
    c.beginPath();
    c.arc(gate.x, gate.y - moonR * 0.2, moonR, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // 门框
    const gateHalf = 220;
    const gTop = P(0, CEIL_Y + 90, 3600);
    const gLeft = P(-gateHalf, FLOOR_Y, 3600);
    const gRight = P(gateHalf, FLOOR_Y, 3600);
    c.fillStyle = isRed ? '#0B0305' : '#07060A';
    c.fillRect(gLeft.x - 90 * gate.s * 3, gTop.y - 30 * gate.s * 3, (gRight.x - gLeft.x) + 180 * gate.s * 3, (gLeft.y - gTop.y) + 40 * gate.s * 3);
    c.strokeStyle = GOLD(0.5 + accent * 0.2);
    c.lineWidth = 2.4;
    c.strokeRect(gLeft.x - 90 * gate.s * 3, gTop.y - 30 * gate.s * 3, (gRight.x - gLeft.x) + 180 * gate.s * 3, (gLeft.y - gTop.y) + 40 * gate.s * 3);
    // 匾额
    const plaque = P(0, CEIL_Y + 150, 3560);
    c.fillStyle = RED(0.9);
    c.fillRect(plaque.x - 64 * plaque.s * 3, plaque.y - 22 * plaque.s * 3, 128 * plaque.s * 3, 44 * plaque.s * 3);
    c.strokeStyle = GOLD(0.85);
    c.lineWidth = 2;
    c.strokeRect(plaque.x - 64 * plaque.s * 3, plaque.y - 22 * plaque.s * 3, 128 * plaque.s * 3, 44 * plaque.s * 3);
    c.fillStyle = PAPER(0.95);
    c.font = `900 ${Math.round(26 * plaque.s * 3)}px "Source Han Serif SC Heavy","Noto Serif SC",serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('凌霄', plaque.x, plaque.y + plaque.s * 2);

    // ---------- 1.5 侧墙与格窗 ----------
    for (const side of [-1, 1] as const) {
      const inner = P(side * COLUMNS_X, CEIL_Y, 3400);
      const outer = P(side * 1500, CEIL_Y, -200);
      const wallTop = c.createLinearGradient(0, 0, 0, height);
      wallTop.addColorStop(0, isRed ? '#1A0709' : '#141228');
      wallTop.addColorStop(1, isRed ? '#0C0406' : '#090811');
      c.fillStyle = wallTop;
      c.beginPath();
      c.moveTo(inner.x, inner.y);
      c.lineTo(side < 0 ? -60 : width + 60, 120);
      c.lineTo(side < 0 ? -60 : width + 60, height);
      c.lineTo(outer.x, outer.y + 520);
      c.closePath();
      c.fill();
      // 格窗：三重回纹
      for (let k = 0; k < 7; k += 1) {
        const z = 3200 - k * 430;
        const p0 = P(side * 620, CEIL_Y + 120, z);
        const p1 = P(side * 620, FLOOR_Y - 40, z);
        const wBar = 8 * p0.s * 2.4;
        const a = depthAlpha(z, 0.5, 0.06);
        c.strokeStyle = GOLD(a);
        c.lineWidth = 1.2;
        c.strokeRect(p0.x, p0.y, wBar * 5, p1.y - p0.y);
        for (let g = 1; g < 4; g += 1) {
          c.beginPath();
          c.moveTo(p0.x, p0.y + ((p1.y - p0.y) * g) / 4);
          c.lineTo(p0.x + wBar * 5, p0.y + ((p1.y - p0.y) * g) / 4);
          c.stroke();
        }
      }
    }

    // ---------- 2. 地面：透视网格 + 积水 ----------
    const floorFar = P(0, FLOOR_Y, 3600);
    const floorNear = P(0, FLOOR_Y, -240);
    const floorGrad = c.createLinearGradient(0, floorFar.y, 0, floorNear.y);
    floorGrad.addColorStop(0, isRed ? '#12060A' : '#0B0A12');
    floorGrad.addColorStop(0.55, '#08070C');
    floorGrad.addColorStop(1, '#040304');
    c.fillStyle = floorGrad;
    c.beginPath();
    c.moveTo(-40, height + 40);
    c.lineTo(floorFar.x - 760, floorFar.y);
    c.lineTo(floorFar.x + 760, floorFar.y);
    c.lineTo(width + 40, height + 40);
    c.closePath();
    c.fill();
    // 网格
    for (let i = -6; i <= 6; i += 1) {
      const x = i * 150;
      const a = P(x, FLOOR_Y, 3400);
      const b = P(x, FLOOR_Y, -200);
      c.strokeStyle = GOLD(0.06 + accent * 0.04);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    for (let z = 0; z <= 3400; z += 400) {
      const a = P(-900, FLOOR_Y, z);
      const b = P(900, FLOOR_Y, z);
      c.strokeStyle = GOLD(depthAlpha(z, 0.16, 0.05) + accent * 0.03);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    // 积水倒影
    const reflect = c.createLinearGradient(0, floorFar.y, 0, floorNear.y);
    reflect.addColorStop(0, GOLD(0.22 + accent * 0.1));
    reflect.addColorStop(0.4, GOLD(0.05));
    reflect.addColorStop(1, 'rgba(252,201,52,0)');
    c.fillStyle = reflect;
    c.fillRect(VP.x - 320, floorFar.y, 640, floorNear.y - floorFar.y);

    // ---------- 3. 两列立柱（由远及近） ----------
    const zSteps = [3400, 2900, 2400, 1900, 1400, 900, 400, -100];
    for (const z of zSteps) {
      for (const side of [-1, 1] as const) {
        const foot = P(side * COLUMNS_X, FLOOR_Y, z);
        const top = P(side * COLUMNS_X, CEIL_Y, z);
        const pw = 52 * foot.s * 2.2;
        const alpha = depthAlpha(z, 1, 0.25);
        c.fillStyle = isRed ? `rgba(14,6,8,${alpha})` : `rgba(9,8,13,${alpha})`;
        c.fillRect(foot.x - pw / 2, top.y, pw, foot.y - top.y);
        // 受光边（靠中轴一侧）
        const rim = c.createLinearGradient(foot.x - side * pw * 0.5, 0, foot.x + side * pw * 0.5, 0);
        rim.addColorStop(0, GOLD(0.55 * alpha));
        rim.addColorStop(0.4, GOLD(0.1 * alpha));
        rim.addColorStop(1, 'rgba(252,201,52,0)');
        c.fillStyle = rim;
        c.fillRect(foot.x - pw / 2, top.y, pw, foot.y - top.y);
        // 柱础 / 柱头
        c.fillStyle = GOLD(0.34 * alpha);
        c.fillRect(foot.x - pw * 0.72, top.y, pw * 1.44, 10 * foot.s * 2);
        c.fillRect(foot.x - pw * 0.66, foot.y - 12 * foot.s * 2, pw * 1.32, 12 * foot.s * 2);
      }
    }

    // ---------- 4. 藻井横梁 + 悬幡 ----------
    for (const z of [3300, 2700, 2100, 1500, 900, 300]) {
      const l = P(-COLUMNS_X, CEIL_Y + 26, z);
      const r = P(COLUMNS_X, CEIL_Y + 26, z);
      c.strokeStyle = GOLD(depthAlpha(z, 0.4, 0.08) + accent * 0.05);
      c.lineWidth = 2 + 2 * l.s;
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(r.x, r.y);
      c.stroke();
    }
    // 藻井与斗拱
    for (const z of [3300, 2950, 2600, 2250, 1900, 1550, 1200, 850, 500, 150]) {
      const a = depthAlpha(z, 0.34, 0.06);
      for (const side of [-1, 1] as const) {
        const base = P(side * COLUMNS_X, CEIL_Y + 26, z);
        const w = 34 * base.s * 2.4;
        const h = 20 * base.s * 2.4;
        for (let b = 0; b < 3; b += 1) {
          c.fillStyle = GOLD(a * (1 - b * 0.25));
          c.fillRect(base.x - (side < 0 ? w : 0) - b * w * 0.35, base.y - b * h * 0.7, w, h * 0.5);
        }
      }
      const l = P(-COLUMNS_X, CEIL_Y + 8, z);
      const r = P(COLUMNS_X, CEIL_Y + 8, z);
      c.strokeStyle = GOLD(a * 0.8);
      c.lineWidth = 1 + l.s;
      c.beginPath();
      c.moveTo(l.x, l.y);
      c.lineTo(r.x, r.y);
      c.stroke();
    }

    // 悬幡
    const bannerGlyphs = ['天', '兵', '合', '围', '将'];
    for (let bi = 0; bi < 5; bi += 1) {
      const z = [3000, 2400, 1800, 1200, 600][bi] as number;
      for (const side of [-1, 1] as const) {
        const anchor = P(side * 300, CEIL_Y + 30, z);
        const len = 210 * anchor.s * 2.2;
        const sway = Math.sin(t * 1.4 + z * 0.01 + side) * 4 * anchor.s * 2;
        const w = 46 * anchor.s * 2.2;
        const alpha = depthAlpha(z, 0.92, 0.2);
        c.save();
        c.translate(anchor.x, anchor.y);
        c.rotate((sway / 100) * 0.3);
        c.beginPath();
        c.moveTo(-w / 2, 0);
        c.lineTo(w / 2, 0);
        c.lineTo(w * 0.42, len);
        c.lineTo(0, len + 16 * anchor.s * 2);
        c.lineTo(-w * 0.42, len);
        c.closePath();
        const cloth = c.createLinearGradient(0, 0, 0, len);
        cloth.addColorStop(0, RED(0.95 * alpha));
        cloth.addColorStop(0.6, RED(0.7 * alpha));
        cloth.addColorStop(1, RED(0.35 * alpha));
        c.fillStyle = cloth;
        c.fill();
        c.strokeStyle = GOLD(0.5 * alpha);
        c.lineWidth = 1.2;
        c.stroke();
        c.fillStyle = PAPER(0.9 * alpha);
        c.font = `900 ${Math.round(w * 0.7)}px "Source Han Serif SC Heavy","Noto Serif SC",serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(bannerGlyphs[bi] ?? '天', 0, len * 0.52);
        c.fillStyle = GOLD(0.55 * alpha);
        c.fillRect(-w * 0.62, -4, w * 1.24, 4);
        c.restore();
      }
    }

    // ---------- 5. 灯 ----------
    for (const z of [3100, 2600, 2100, 1600, 1100, 600, 100]) {
      for (const side of [-1, 1] as const) {
        const p = P(side * 300, CEIL_Y + 96, z);
        const r = 15 * p.s * 2.4;
        const swing = Math.sin(t * 1.7 + z * 0.01 + side * 2) * 3 * p.s;
        const bloom = c.createRadialGradient(p.x + swing, p.y, 1, p.x + swing, p.y, r * 6);
        bloom.addColorStop(0, GOLD((0.3 + accent * 0.24) * depthAlpha(z, 1, 0.3)));
        bloom.addColorStop(1, 'rgba(252,201,52,0)');
        c.fillStyle = bloom;
        c.beginPath();
        c.arc(p.x + swing, p.y, r * 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = GOLD(depthAlpha(z, 0.95, 0.3));
        c.beginPath();
        c.ellipse(p.x + swing, p.y, r * 0.8, r, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = RED(0.9 * depthAlpha(z, 1, 0.3));
        c.fillRect(p.x + swing - r * 0.8, p.y - r * 0.16, r * 1.6, r * 0.28);
      }
    }

    // ---------- 6. 人海：三层，越远越淡越密 ----------
    for (const [z, count, scale] of [
      [2600, 70, 0.55],
      [1700, 60, 0.8],
      [900, 46, 1.15],
      [240, 26, 1.6],
    ] as const) {
      const alpha = depthAlpha(z, 1, 0.18);
      for (let i = 0; i < count; i += 1) {
        const wx = -620 + (i / (count - 1)) * 1240;
        const p = P(wx, FLOOR_Y, z);
        const h = 92 * p.s * 2.0 * scale;
        const bob = Math.sin(t * 2.2 + hash(z, i) * 6.28) * 1.6 * p.s;
        c.fillStyle = `rgba(6,5,8,${alpha})`;
        c.beginPath();
        c.moveTo(p.x - h * 0.2, p.y - bob);
        c.lineTo(p.x - h * 0.13, p.y - h * 0.58 - bob);
        c.lineTo(p.x + h * 0.13, p.y - h * 0.58 - bob);
        c.lineTo(p.x + h * 0.2, p.y - bob);
        c.closePath();
        c.fill();
        c.beginPath();
        c.arc(p.x, p.y - h * 0.7 - bob, h * 0.13, 0, Math.PI * 2);
        c.fill();
        if (i % 3 === 0) {
          c.strokeStyle = GOLD((0.2 + accent * 0.14) * alpha);
          c.lineWidth = 1.1;
          c.beginPath();
          c.moveTo(p.x + h * 0.22, p.y);
          c.lineTo(p.x + h * 0.3, p.y - h * 1.9);
          c.stroke();
        }
      }
    }

    // ---------- 7. 体积雾（三层横带） ----------
    const fog = (y: number, h: number, a: number, off: number) => {
      const g = c.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, 'rgba(244,239,230,0)');
      g.addColorStop(0.5, PAPER(a));
      g.addColorStop(1, 'rgba(244,239,230,0)');
      c.save();
      c.filter = 'blur(18px)';
      c.fillStyle = g;
      c.fillRect(-200 + off, y - h, W + 400, h * 2);
      c.restore();
    };
    fog(VP.y + 160, 46, 0.06, -t * 22);
    fog(VP.y + 300, 60, 0.08, t * 18);

    // ---------- 7.5 前景虚化柱（把画面压住） ----------
    for (const side of [-1, 1] as const) {
      c.save();
      c.filter = 'blur(7px)';
      c.fillStyle = 'rgba(4,3,6,0.96)';
      c.fillRect(side < 0 ? -40 : width - 150, -40, 190, height + 80);
      c.fillStyle = GOLD(0.16 + accent * 0.08);
      c.fillRect(side < 0 ? 128 : width - 172, -40, 22, height + 80);
      c.restore();
    }

    // ---------- 7.6 地面花瓣 ----------
    for (let i = 0; i < 40; i += 1) {
      const z = 200 + hash(9201, i) * 2800;
      const x = -520 + hash(9201, i + 30) * 1040;
      const p = P(x, FLOOR_Y, z);
      const r = (3 + hash(9201, i + 60) * 6) * p.s * 2;
      c.fillStyle = i % 3 === 0 ? PAPER(0.5 * p.s) : RED(0.42 * p.s);
      c.beginPath();
      c.ellipse(p.x, p.y, r, r * 0.5, hash(9201, i) * 3, 0, Math.PI * 2);
      c.fill();
    }

    // ---------- 8. 金尘 ----------
    for (let i = 0; i < 80; i += 1) {
      const depth = hash(1201, i + 200);
      const sp = 20 + hash(1201, i) * 50;
      const py = ((hash(1201, i + 40) * height + t * sp) % (height + 60)) - 30;
      const px = (hash(1201, i + 80) * width + Math.sin(t * 0.5 + i) * 24 - camX * 0.4 + width * 2) % width;
      c.globalAlpha = 0.14 + depth * 0.5;
      c.fillStyle = i % 4 === 0 ? PAPER(0.6) : GOLD(0.5);
      c.beginPath();
      c.ellipse(px, py, 1 + depth * 2.4, (1 + depth * 2.4) * 1.8, t * 0.5 + i, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // ---------- 9. 暗角 ----------
    const vig = c.createRadialGradient(VP.x, VP.y + 80, 420, VP.x, VP.y + 80, 1180);
    vig.addColorStop(0, 'rgba(5,4,7,0)');
    vig.addColorStop(0.6, 'rgba(5,4,7,0.3)');
    vig.addColorStop(1, 'rgba(5,4,7,0.82)');
    c.fillStyle = vig;
    c.fillRect(0, 0, width, height);
  }, [accent, dolly, fps, frame, height, mood, opacity, pan, t, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        opacity,
        ...style,
      }}
    />
  );
};
