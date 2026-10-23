import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {hash} from '../../utils/math';
import {createCamera, diveOrbit, type Vec3} from '../../utils/threeDCamera';
import {SENBON} from './style';

/**
 * `<CelestialCollapse3D />` —— 真三维透视的凌霄殿崩裂（Sub2B）。
 *
 * 与 V4 的区别：V4 在 2D 斜网格上画了 36 个矩形，本质是平面装饰；这里是
 * **真投影**——每根柱子有 8 边形截面、16 个三维顶点、真实法线明暗；相机沿
 * 螺旋轨道从 18 单位高空俯冲进 4.5 单位半径，FOV、倾角、roll 逐帧变化；
 * 碎裂后每块体积按 `p = p0 + v·t + ½g·t²` 解析求解，**不做逐帧积分**，
 * 所以任意乱序抽帧都能复现同一画面（Remotion 并发渲染的前提）。
 *
 * 场景元素：
 *   · 36 根八棱巨柱（盘龙金边 + 墨黑柱身），按 Z 排序后手绘 8 个侧面
 *   · 3000 颗暗金水墨粒子（切镜后沿刀光方向爆散）
 *   · 地面 3D 透视网格 + 刀光落点三圈扩散波纹
 *   · 500 颗高亮粒子组成的赤金刀光波前
 */

export interface CelestialCollapse3DProps {
  /** 绝对秒。 */
  time: number;
  start: number;
  end: number;
  /** 刀光切点（绝对秒）。 */
  cutAt: number;
  pulse?: number;
}

interface Particle {
  base: Vec3;
  vel: Vec3;
  size: number;
  tone: 0 | 1 | 2;
  phase: number;
  drift: number;
}

interface Column {
  x: number;
  z: number;
  height: number;
  radius: number;
  seed: number;
  tilt: number;
  tone: number;
}

interface Chunk {
  column: Column;
  y0: number;
  y1: number;
  offset: number;
  vel: Vec3;
  spin: Vec3;
  delay: number;
}

const G = -26;

const buildParticles = (count: number): Particle[] =>
  Array.from({length: count}, (_, index) => {
    const angle = hash(5100, index) * Math.PI * 2;
    const radius = 1.4 + hash(5101, index) ** 0.62 * 19;
    return {
      base: {
        x: Math.cos(angle) * radius,
        y: 0.4 + hash(5102, index) * 15.5,
        z: Math.sin(angle) * radius,
      },
      vel: {
        x: (hash(5103, index) - 0.5) * 9 + Math.cos(angle) * 3.2,
        y: 1.6 + hash(5104, index) * 7.5,
        z: (hash(5105, index) - 0.5) * 9 + Math.sin(angle) * 3.2,
      },
      size: 0.018 + hash(5106, index) ** 2 * 0.075,
      tone: (index % 7 === 0 ? 1 : index % 11 === 0 ? 2 : 0) as 0 | 1 | 2,
      phase: hash(5107, index) * Math.PI * 2,
      drift: 0.16 + hash(5108, index) * 0.55,
    };
  });

const buildColumns = (count: number): Column[] => {
  const side = Math.ceil(Math.sqrt(count));
  const gap = 4.7;
  const list: Column[] = [];
  for (let index = 0; index < count; index += 1) {
    const ix = index % side;
    const iz = Math.floor(index / side);
    const seed = 700 + index * 13;
    const jitterX = (hash(seed, 1) - 0.5) * 1.1;
    const jitterZ = (hash(seed, 2) - 0.5) * 1.1;
    list.push({
      x: (ix - (side - 1) / 2) * gap + jitterX,
      z: (iz - (side - 1) / 2) * gap + jitterZ,
      height: 8.2 + hash(seed, 3) * 4.2,
      radius: 0.82 + hash(seed, 4) * 0.22,
      seed,
      tilt: (hash(seed, 5) - 0.5) * 0.05,
      tone: index % 3,
    });
  }
  return list;
};

const buildChunks = (columns: Column[]): Chunk[] =>
  columns.flatMap((column, columnIndex) => {
    const pieces = 5;
    return Array.from({length: pieces}, (_, piece): Chunk => {
      const y0 = (column.height / pieces) * piece;
      const y1 = (column.height / pieces) * (piece + 1);
      const seed = column.seed * 7 + piece;
      return {
        column,
        y0,
        y1,
        offset: (hash(seed, 9) - 0.5) * 0.5,
        vel: {
          x: (hash(seed, 10) - 0.5) * 12 + column.x * 0.55,
          y: 2.2 + hash(seed, 11) * 5.5 + piece * 0.6,
          z: 3.4 + hash(seed, 12) * 6.5 + Math.abs(column.z) * 0.35,
        },
        spin: {
          x: (hash(seed, 13) - 0.5) * 3.4,
          y: (hash(seed, 14) - 0.5) * 2.2,
          z: (hash(seed, 15) - 0.5) * 3.4,
        },
        delay: 0.02 + Math.abs(column.x) * 0.009 + piece * 0.012 + (columnIndex % 4) * 0.01,
      };
    });
  });

const shade = (base: string, factor: number): string => {
  // 只对十六进制色做明度缩放，避免引入新的调色逻辑
  const value = base.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (c: number) => Math.round(Math.min(255, Math.max(0, c * factor)));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
};

const rotate = (point: Vec3, spin: Vec3, pivot: Vec3): Vec3 => {
  let {x, y, z} = point;
  x -= pivot.x;
  y -= pivot.y;
  z -= pivot.z;
  const cx = Math.cos(spin.x);
  const sx = Math.sin(spin.x);
  const cy = Math.cos(spin.y);
  const sy = Math.sin(spin.y);
  const cz = Math.cos(spin.z);
  const sz = Math.sin(spin.z);
  // X → Y → Z
  let ty = y * cx - z * sx;
  let tz = y * sx + z * cx;
  y = ty;
  z = tz;
  let tx = x * cy + z * sy;
  tz = -x * sy + z * cy;
  x = tx;
  z = tz;
  tx = x * cz - y * sz;
  ty = x * sz + y * cz;
  x = tx;
  y = ty;
  return {x: x + pivot.x, y: y + pivot.y, z: z + pivot.z};
};

export const CelestialCollapse3D: React.FC<CelestialCollapse3DProps> = ({time, start, end, cutAt, pulse = 0}) => {
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const particles = useMemo(() => buildParticles(3000), []);
  const columns = useMemo(() => buildColumns(36), []);
  const chunks = useMemo(() => buildChunks(columns), []);
  const ticks = useMemo(() => {
    const list: number[] = [];
    for (let v = -26; v <= 26; v += 2.6) list.push(v);
    return list;
  }, []);

  const duration = Math.max(0.001, end - start);
  const t = Math.min(duration, Math.max(0, time - start));
  const prog = Math.min(1, t / duration);
  const cutT = Math.max(0, cutAt - start);
  const age = t - cutT;

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    /* ---- 天幕：从墨黑升到暗赤，给金线一个深的底 ---- */
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0B0609');
    sky.addColorStop(0.52, '#1A0B10');
    sky.addColorStop(1, '#38100F');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    /* ---- 相机：切点前后两段，同一函数求值，保证连续性 ---- */
    const camT = Math.min(1, Math.max(0, prog));
    const orbit = diveOrbit(camT, {
      radius: age > 0 ? [20, 4.2] : [21, 7.4],
      height: age > 0 ? [17.5, 2.1] : [17.5, 4.6],
      angle: [-1.35, 0.55],
      targetY: 4.4,
    });
    const shake = age > 0 ? Math.exp(-age * 4.2) * 0.9 : 0;
    const camera = createCamera({
      position: {
        x: orbit.x + Math.sin(t * 31) * shake * 0.4,
        y: orbit.y + Math.sin(t * 27) * shake * 0.25,
        z: orbit.z + Math.cos(t * 23) * shake * 0.4,
      },
      target: {x: 0, y: 4.2 - age * 1.2, z: 0},
      fov: 1.12 + prog * 0.22,
      width,
      height,
      roll: -0.16 + prog * 0.3 + (age > 0 ? Math.exp(-age * 5) * 0.1 : 0),
    });

    const items: Array<{z: number; draw: () => void}> = [];

    /* ---- 地面网格：3D 透视线 ---- */
    items.push({
      z: 999,
      draw: () => {
        ctx.save();
        ctx.lineWidth = 1;
        for (const v of ticks) {
          for (const axis of [0, 1] as const) {
            const a = axis === 0 ? {x: v, y: 0, z: -26} : {x: -26, y: 0, z: v};
            const b = axis === 0 ? {x: v, y: 0, z: 26} : {x: 26, y: 0, z: v};
            const pa = camera.project(a);
            const pb = camera.project(b);
            if (!pa || !pb) continue;
            const depth = (pa.z + pb.z) / 2;
            const alpha = Math.max(0, 0.36 - depth * 0.012);
            if (alpha <= 0.01) continue;
            ctx.strokeStyle = `rgba(232,176,75,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
        ctx.restore();
      },
    });

    /* ---- 立柱 / 碎块 ---- */
    const oct = Array.from({length: 8}, (_, index) => {
      const a = (index / 8) * Math.PI * 2 + Math.PI / 8;
      return {c: Math.cos(a), s: Math.sin(a)};
    });

    for (const chunk of chunks) {
      const localAge = age - chunk.delay;
      const broken = localAge > 0;
      const pivot: Vec3 = {
        x: chunk.column.x,
        y: (chunk.y0 + chunk.y1) / 2,
        z: chunk.column.z,
      };
      const move: Vec3 = broken
        ? {
            x: chunk.vel.x * localAge,
            y: chunk.vel.y * localAge + 0.5 * G * localAge * localAge,
            z: chunk.vel.z * localAge,
          }
        : {x: 0, y: 0, z: 0};
      const spin: Vec3 = broken
        ? {
            x: chunk.spin.x * localAge,
            y: chunk.spin.y * localAge,
            z: chunk.spin.z * localAge,
          }
        : {x: 0, y: 0, z: 0};

      const centre = camera.project({
        x: pivot.x + move.x,
        y: pivot.y + move.y,
        z: pivot.z + move.z,
      });
      if (!centre) continue;

      items.push({
        z: centre.z,
        draw: () => {
          const radius = chunk.column.radius;
          const bottom = oct.map((o) =>
            rotate(
              {
                x: pivot.x + o.c * radius + chunk.offset,
                y: chunk.y0,
                z: pivot.z + o.s * radius,
              },
              spin,
              pivot,
            ),
          ).map((p) => camera.project({x: p.x + move.x, y: p.y + move.y, z: p.z + move.z}));
          const top = oct.map((o) =>
            rotate(
              {
                x: pivot.x + o.c * radius + chunk.offset,
                y: chunk.y1,
                z: pivot.z + o.s * radius,
              },
              spin,
              pivot,
            ),
          ).map((p) => camera.project({x: p.x + move.x, y: p.y + move.y, z: p.z + move.z}));

          for (let i = 0; i < 8; i += 1) {
            const j = (i + 1) % 8;
            const quad = [bottom[i], bottom[j], top[j], top[i]];
            if (quad.some((p) => !p)) continue;
            const face = oct[i]!.c;
            const lit = 0.34 + 0.66 * Math.max(0, face);
            const tone = chunk.column.tone;
            // 石材：冷灰的墨（不是棕色的纸筒）；受光面偏暖，背光面几乎全黑
            const base = tone === 1 ? '#2B2226' : tone === 2 ? '#241E23' : '#1E1A20';
            ctx.fillStyle = shade(base, 0.55 + lit * 0.95);
            ctx.beginPath();
            const pts = quad as Array<{x: number; y: number}>;
            ctx.moveTo(pts[0]!.x, pts[0]!.y);
            for (let k = 1; k < 4; k += 1) ctx.lineTo(pts[k]!.x, pts[k]!.y);
            ctx.closePath();
            ctx.fill();
            // 受光面才有一条极细的暖金反光（不是给每根柱子描边）
            if (lit > 0.82) {
              ctx.strokeStyle = `rgba(231,170,86,${0.14 + lit * 0.2})`;
              ctx.lineWidth = Math.max(0.5, centre.scale * 0.008);
              ctx.stroke();
            }
          }
          // 柱础：底段脚下加一圈外扩石座
          const isBottom = chunk.y0 < 0.001;
          if (isBottom) {
            const baseR = radius * 1.35;
            const bTop = oct.map((o) =>
              rotate({x: pivot.x + o.c * baseR, y: chunk.y0 + 0.45, z: pivot.z + o.s * baseR}, spin, pivot),
            ).map((q) => camera.project({x: q.x + move.x, y: q.y + move.y, z: q.z + move.z}));
            const bBottom = oct.map((o) =>
              rotate({x: pivot.x + o.c * baseR, y: chunk.y0, z: pivot.z + o.s * baseR}, spin, pivot),
            ).map((q) => camera.project({x: q.x + move.x, y: q.y + move.y, z: q.z + move.z}));
            for (let i = 0; i < 8; i += 1) {
              const j = (i + 1) % 8;
              const quad = [bBottom[i], bBottom[j], bTop[j], bTop[i]];
              if (quad.some((q) => !q)) continue;
              const lit = 0.3 + 0.7 * Math.max(0, oct[i]!.c);
              ctx.fillStyle = shade('#241E23', 0.55 + lit * 0.85);
              ctx.beginPath();
              const pts = quad as Array<{x: number; y: number}>;
              ctx.moveTo(pts[0]!.x, pts[0]!.y);
              for (let k = 1; k < 4; k += 1) ctx.lineTo(pts[k]!.x, pts[k]!.y);
              ctx.closePath();
              ctx.fill();
            }
          }

          // 顶部斗拱：一块外挑的厚石板，让它读成"殿柱"而不是"管子"
          const isTop = Math.abs(chunk.y1 - chunk.column.height) < 0.001;
          if (isTop) {
            const capR = radius * 1.55;
            const capBottom = oct.map((o) =>
              rotate({x: pivot.x + o.c * capR, y: chunk.y1, z: pivot.z + o.s * capR}, spin, pivot),
            ).map((p) => camera.project({x: p.x + move.x, y: p.y + move.y, z: p.z + move.z}));
            const capTop = oct.map((o) =>
              rotate({x: pivot.x + o.c * capR, y: chunk.y1 + 0.55, z: pivot.z + o.s * capR}, spin, pivot),
            ).map((p) => camera.project({x: p.x + move.x, y: p.y + move.y + 0.55, z: p.z + move.z}));
            for (let i = 0; i < 8; i += 1) {
              const j = (i + 1) % 8;
              const quad = [capBottom[i], capBottom[j], capTop[j], capTop[i]];
              if (quad.some((q) => !q)) continue;
              const lit = 0.3 + 0.7 * Math.max(0, oct[i]!.c);
              ctx.fillStyle = shade('#2A2429', 0.6 + lit * 1.0);
              ctx.beginPath();
              const pts = quad as Array<{x: number; y: number}>;
              ctx.moveTo(pts[0]!.x, pts[0]!.y);
              for (let k = 1; k < 4; k += 1) ctx.lineTo(pts[k]!.x, pts[k]!.y);
              ctx.closePath();
              ctx.fill();
            }
          }

          // 断口：焦黑的顶面 + 一线余烬
          const cap = top.filter(Boolean) as Array<{x: number; y: number}>;
          if (cap.length === 8 && !isTop) {
            ctx.fillStyle = 'rgba(58,48,54,0.96)';
            ctx.beginPath();
            ctx.moveTo(cap[0]!.x, cap[0]!.y);
            for (let k = 1; k < 8; k += 1) ctx.lineTo(cap[k]!.x, cap[k]!.y);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(231,170,86,0.35)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            if (broken) {
              ctx.strokeStyle = `rgba(255,214,120,${Math.min(0.8, 0.18 + localAge * 0.4)})`;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        },
      });
    }

    /* ---- 粒子 ---- */
    for (let index = 0; index < particles.length; index += 1) {
      const p = particles[index]!;
      const bounce = Math.sin(t * p.drift * 6 + p.phase) * 0.06;
      const burst = age > 0 ? age : 0;
      const pos: Vec3 = {
        x: p.base.x + p.vel.x * burst + bounce,
        y: p.base.y + p.vel.y * burst + 0.5 * G * 0.55 * burst * burst,
        z: p.base.z + p.vel.z * burst,
      };
      const proj = camera.project(pos);
      if (!proj) continue;
      const size = Math.max(0.7, p.size * proj.scale);
      if (size < 0.55) continue;
      const depthFade = Math.max(0, Math.min(1, 1.18 - proj.z * 0.028));
      const blast = age > 0 ? 0.35 : 0;
      items.push({
        z: proj.z,
        draw: () => {
          ctx.globalAlpha = Math.min(1, 0.14 + depthFade * 0.4 + blast * 0.8);
          ctx.fillStyle = p.tone === 0 ? SENBON.gold : p.tone === 1 ? SENBON.cinnabar : SENBON.paper;
          if (size > 1.8) {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(proj.x - size / 2, proj.y - size / 2, size, size);
          }
          ctx.globalAlpha = 1;
        },
      });
    }

    items.sort((a, b) => b.z - a.z);
    for (const item of items) item.draw();

    /* ---- 三圈地面波纹 ---- */
    if (age > 0) {
      for (let ring = 0; ring < 3; ring += 1) {
        const ringAge = age - ring * 0.07;
        if (ringAge <= 0) continue;
        const radius = 1.4 + ringAge * 17;
        const alpha = Math.max(0, 0.6 - ringAge * 1.05) * (ring === 0 ? 1 : 0.7);
        if (alpha <= 0.01) continue;
        const points: Array<{x: number; y: number}> = [];
        for (let i = 0; i <= 56; i += 1) {
          const a = (i / 56) * Math.PI * 2;
          const proj = camera.project({x: Math.cos(a) * radius, y: 0.03, z: Math.sin(a) * radius});
          if (proj) points.push(proj);
        }
        if (points.length < 8) continue;
        ctx.save();
        ctx.strokeStyle = `rgba(255,242,210,${alpha})`;
        ctx.lineWidth = 2.4 + (1 - ringAge) * 6;
        ctx.beginPath();
        ctx.moveTo(points[0]!.x, points[0]!.y);
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ---- 刀光：500 颗高亮粒子 + 一道横向光刃 ---- */
    if (age > 0) {
      const sweep = Math.min(1, age / 0.26);
      const front = -16 + sweep * 40;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let index = 0; index < 500; index += 1) {
        const spread = hash(8800, index) - 0.5;
        const pos: Vec3 = {
          x: front + spread * 5.5,
          y: 5.2 + (hash(8801, index) - 0.5) * 4.2 + age * 1.4,
          z: (hash(8802, index) - 0.5) * 15,
        };
        const proj = camera.project(pos);
        if (!proj) continue;
        const fade = Math.max(0, 1 - age / 0.62);
        if (fade <= 0.01) continue;
        const size = 1.2 + hash(8803, index) * 3.6;
        ctx.fillStyle = index % 5 === 0 ? `rgba(255,246,214,${fade})` : `rgba(232,140,54,${fade * 0.9})`;
        ctx.fillRect(proj.x - size / 2, proj.y - size / 2, size, size);
      }
      ctx.restore();

      // 透视光刃：一条横贯全场的四边面片
      const fade = Math.max(0, 1 - age / 0.34);
      if (fade > 0.01) {
        const quad = [
          {x: front - 14, y: 5.0, z: -13},
          {x: front + 14, y: 5.6, z: -13},
          {x: front + 14, y: 6.4, z: 13},
          {x: front - 14, y: 5.8, z: 13},
        ]
          .map((p) => camera.project(p))
          .filter(Boolean) as Array<{x: number; y: number}>;
        if (quad.length === 4) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const grad = ctx.createLinearGradient(quad[0]!.x, quad[0]!.y, quad[1]!.x, quad[1]!.y);
          grad.addColorStop(0, `rgba(255,220,150,0)`);
          grad.addColorStop(0.5, `rgba(255,236,190,${fade})`);
          grad.addColorStop(1, `rgba(217,72,37,${fade})`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(quad[0]!.x, quad[0]!.y);
          for (let i = 1; i < 4; i += 1) ctx.lineTo(quad[i]!.x, quad[i]!.y);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    /* ---- 冲击白光 ---- */
    if (age > 0 && age < 0.14) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,240,206,${(1 - age / 0.14) * 0.35})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    /* ---- 暗角 ---- */
    const vignette = ctx.createRadialGradient(width / 2, height * 0.55, height * 0.2, width / 2, height * 0.55, height * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    if (pulse > 0) {
      ctx.fillStyle = `rgba(252,201,52,${pulse * 0.02})`;
      ctx.fillRect(0, 0, width, height);
    }
  }, [age, chunks, cutT, duration, height, particles, prog, pulse, t, ticks, width]);

  return (
    <AbsoluteFill style={{backgroundColor: '#0B0609'}}>
      <canvas ref={ref} width={width} height={height} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};
