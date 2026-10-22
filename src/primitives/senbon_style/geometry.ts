/**
 * 纯代码图形的几何工具。
 *
 * 所有函数都是确定性的纯函数：同样的入参永远得到同样的 path 字符串，
 * 不读取时间、随机数或 DOM。
 */

import {f} from './style';

export interface Pt {
  x: number;
  y: number;
}

export const pt = (x: number, y: number): Pt => ({x, y});

export const polar = (cx: number, cy: number, radius: number, angle: number): Pt => ({
  x: cx + Math.cos(angle) * radius,
  y: cy + Math.sin(angle) * radius,
});

/** 折线 → SVG path。 */
export const polyline = (points: readonly Pt[], close = false): string => {
  if (!points.length) return '';
  const [head, ...rest] = points;
  let d = `M${f(head!.x)} ${f(head!.y)}`;
  for (const p of rest) d += ` L${f(p.x)} ${f(p.y)}`;
  return close ? `${d} Z` : d;
};

/** Catmull-Rom → 三次贝塞尔，开放曲线。 */
export const catmullRom = (points: readonly Pt[], tension = 0.5): string => {
  if (points.length < 2) return '';
  const k = tension / 6;
  let d = `M${f(points[0]!.x)} ${f(points[0]!.y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = {x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k};
    const c2 = {x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k};
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
};

/** 闭合的 Catmull-Rom 形变轮廓（云、岩石、披风）。 */
export const blob = (points: readonly Pt[], tension = 0.5): string => {
  if (points.length < 3) return '';
  const list = [...points];
  const n = list.length;
  const k = tension / 6;
  let d = `M${f(list[0]!.x)} ${f(list[0]!.y)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = list[(i - 1 + n) % n]!;
    const p1 = list[i]!;
    const p2 = list[(i + 1) % n]!;
    const p3 = list[(i + 2) % n]!;
    const c1 = {x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k};
    const c2 = {x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k};
    d += ` C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d} Z`;
};

/**
 * 变宽飘带：给定中心线与每点半宽，左右偏移合成闭合多边形。
 * 雉鸡翎、披风破布、闪电丝带都用它。
 */
export const ribbon = (
  center: readonly Pt[],
  halfWidths: readonly number[],
): string => {
  if (center.length < 2) return '';
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < center.length; i += 1) {
    const previous = center[Math.max(0, i - 1)]!;
    const next = center[Math.min(center.length - 1, i + 1)]!;
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = halfWidths[Math.min(i, halfWidths.length - 1)] ?? 0;
    left.push({x: center[i]!.x + nx * w, y: center[i]!.y + ny * w});
    right.push({x: center[i]!.x - nx * w, y: center[i]!.y - ny * w});
  }
  const outline = [...left, ...right.reverse()];
  return blob(outline, 0.34);
};

/** 圆弧路径（含扇形闭合选项）。 */
export const arc = (
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
  close = false,
): string => {
  const p0 = polar(cx, cy, radius, start);
  const p1 = polar(cx, cy, radius, end);
  const large = Math.abs(end - start) > Math.PI ? 1 : 0;
  const sweep = end > start ? 1 : 0;
  const body = `M${f(p0.x)} ${f(p0.y)} A${f(radius)} ${f(radius)} 0 ${large} ${sweep} ${f(p1.x)} ${f(p1.y)}`;
  return close ? `${body} Z` : body;
};

/** 齿轮状/锯齿状圆环（法轮、旋涡、岩石断面）。 */
export const spikedRing = (
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  spikes: number,
  phase = 0,
): string => {
  const points: Pt[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const angle = phase + (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    points.push(polar(cx, cy, r, angle));
  }
  return polyline(points, true);
};

/** 给定 t ∈ [0,1]，返回二次贝塞尔上的点。 */
export const quadPoint = (a: Pt, control: Pt, b: Pt, t: number): Pt => {
  const s = 1 - t;
  return {
    x: s * s * a.x + 2 * s * t * control.x + t * t * b.x,
    y: s * s * a.y + 2 * s * t * control.y + t * t * b.y,
  };
};

/** 给定 t，返回三次贝塞尔上的点。 */
export const cubicPoint = (a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt => {
  const s = 1 - t;
  return {
    x: s ** 3 * a.x + 3 * s * s * t * c1.x + 3 * s * t * t * c2.x + t ** 3 * b.x,
    y: s ** 3 * a.y + 3 * s * s * t * c1.y + 3 * s * t * t * c2.y + t ** 3 * b.y,
  };
};

/** 用固定采样数把任意曲线离散成点列，便于做变宽飘带。 */
export const sampleCubic = (
  a: Pt,
  c1: Pt,
  c2: Pt,
  b: Pt,
  steps = 24,
): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(cubicPoint(a, c1, c2, b, i / steps));
  return out;
};

/** 朝向外侧的锯齿边缘（纸符撕裂、破旗下摆）。 */
export const tornEdge = (
  from: Pt,
  to: Pt,
  segments: number,
  amplitude: number,
  seedFn: (index: number) => number,
): Pt[] => {
  const points: Pt[] = [from];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    if (i === segments) break;
    const wobble = (seedFn(i) - 0.5) * 2 * amplitude;
    points.push({
      x: from.x + dx * t + nx * wobble,
      y: from.y + dy * t + ny * wobble,
    });
  }
  points.push(to);
  return points;
};
