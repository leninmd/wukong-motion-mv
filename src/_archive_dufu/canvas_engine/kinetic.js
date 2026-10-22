/* =========================================================================
   kinetic.js — 文字动力学基元
   铁律：多属性复合入场 / 3–6 帧错落 / 快出慢入 / 呼吸微动
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const T = DFS.THEME;

  /* ---------- 1. 逐字入场（支持对齐、字距、错落） ---------- */
  DFS.textIn = function (ctx, text, o) {
    const {
      x = W / 2, y = H / 2, size = 100, weight = 400, family = T.fonts.serif,
      color = T.colors.ink, align = 'center', tracking = 0,
      t = 0, start = 0, dur = 0.55, stagger = 0.045,
      rise = 28, from = 0.94, blur = 5, alpha = 1,
      breathe = 0, seed = 0
    } = o;
    const chars = Array.from(text);
    const baseA = ctx.globalAlpha;
    ctx.save();
    ctx.font = DFS.font(size, weight, family);
    ctx.textBaseline = 'middle';
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;

    chars.forEach((ch, i) => {
      const st = start + i * stagger;
      const p = Ease.outExpo(clamp((t - st) / dur));
      const br = breathe ? DFS.breathe(t, seed + i * 0.7, breathe) : null;
      const w = widths[i];
      if (p > 0.001) {
        const cx = cursor + w / 2 + (br ? br.x : 0);
        const cy = y + (1 - p) * rise + (br ? br.y : 0);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(from + (1 - from) * p, from + (1 - from) * p);
        ctx.rotate(br ? br.rot : 0);
        ctx.globalAlpha = baseA * alpha * clamp(p * 1.15);
        if (blur > 0 && p < 0.98) ctx.filter = `blur(${((1 - p) * blur).toFixed(2)}px)`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      cursor += w + tracking;
    });
    ctx.restore();
  };

  /* ---------- 2. 竖排文字（右起、自上而下） ---------- */
  DFS.verticalIn = function (ctx, text, o) {
    const {
      x = W / 2, y = 80, size = 64, weight = 400, family = T.fonts.serif,
      color = T.colors.ink, gap = 1.06, t = 0, start = 0, dur = 0.5,
      stagger = 0.075, alpha = 1, breathe = 0, seed = 0, align = 'top'
    } = o;
    const chars = Array.from(text);
    const baseA = ctx.globalAlpha;
    const step = size * gap;
    const totalH = step * chars.length;
    let cy = align === 'center' ? y - totalH / 2 : y;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const st = start + i * stagger;
      const p = Ease.outExpo(clamp((t - st) / dur));
      if (p > 0.001) {
        const br = breathe ? DFS.breathe(t, seed + i, breathe) : { x: 0, y: 0, rot: 0 };
        ctx.save();
        ctx.translate(x + br.x, cy + step / 2 + (1 - p) * 18 + br.y);
        ctx.rotate(br.rot);
        ctx.globalAlpha = baseA * alpha * clamp(p * 1.2);
        if (p < 0.98) ctx.filter = `blur(${((1 - p) * 4).toFixed(2)}px)`;
        ctx.font = DFS.font(size, weight, family);
        ctx.fillStyle = color;
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      cy += step;
    });
    ctx.restore();
  };

  /* ---------- 3. 粒子文字（离屏采样 → 聚散） ---------- */
  const pCache = new Map();
  DFS.sampleParticles = function (text, size, weight, family, step = 4, vertical = false, gap = 1.0) {
    const key = [text, size, weight, family, step, vertical, gap].join('|');
    if (pCache.has(key)) return pCache.get(key);
    const measure = DFS.mkCanvas(8, 8).getContext('2d');
    measure.font = DFS.font(size, weight, family);
    let w, h;
    if (vertical) {
      w = size * 1.4; h = size * gap * Array.from(text).length + size * 0.4;
    } else {
      w = measure.measureText(text).width + size * 0.4;
      h = size * 1.45;
    }
    const pad = 6;
    const cw = Math.ceil(w + pad * 2), chh = Math.ceil(h + pad * 2);
    const c = DFS.mkCanvas(cw, chh);
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.font = DFS.font(size, weight, family);
    if (vertical) {
      const chars = Array.from(text);
      let cy = pad + size * 0.7;
      chars.forEach((ch) => { cx.fillText(ch, cw / 2, cy); cy += size * gap; });
    } else {
      cx.fillText(text, cw / 2, chh / 2);
    }
    const data = cx.getImageData(0, 0, cw, chh).data;
    const pts = [];
    for (let y = 0; y < chh; y += step) {
      for (let x = 0; x < cw; x += step) {
        const a = data[(y * cw + x) * 4 + 3];
        if (a > 120) pts.push({ x: x - pad, y: y - pad, a: a / 255 });
      }
    }
    const out = { pts, w: cw - pad * 2, h: chh - pad * 2, cw, chh };
    pCache.set(key, out);
    return out;
  };

  /* 粒子文字：assemble(0→1) / dissolve(0→1) / wind 风场 */
  DFS.particleText = function (ctx, text, o) {
    const {
      x = W / 2, y = H / 2, size = 120, weight = 500, family = T.fonts.serif,
      step = 4, vertical = false, gap = 1.0, seed = 7,
      assemble = 1, dissolve = 0, wind = 0, color = '26,19,9',
      alpha = 1, jitter = 1, sizePx = 1.7, breathe = 0, t = 0
    } = o;
    const s = DFS.sampleParticles(text, size, weight, family, step, vertical, gap);
    const ox = x - s.w / 2, oy = y - s.h / 2;
    const r = DFS.rng(seed);
    const n = s.pts.length;
    ctx.save();
    ctx.fillStyle = `rgba(${color},1)`;
    for (let i = 0; i < n; i++) {
      const p = s.pts[i];
      const r1 = r(), r2 = r(), r3 = r(), r4 = r();
      // 组装：从远处飞入
      const delay = (r1 * 0.55) * (1 - assemble);
      const pa = clamp((assemble - r1 * 0.55) / 0.45);
      const ease = Ease.outExpo(pa);
      let px = ox + p.x + (1 - ease) * (r2 - 0.5) * 520 * jitter;
      let py = oy + p.y + (1 - ease) * (r3 - 0.5) * 420 * jitter;
      // 消散：向上/侧向被风带走
      if (dissolve > 0) {
        const pd = clamp((dissolve - r2 * 0.4) / 0.6);
        const e2 = Ease.inCubic(pd);
        px += e2 * (r3 - 0.35) * 680 * (0.4 + wind);
        py += e2 * (-120 - r4 * 420) * (0.35 + wind * 0.9);
      }
      const a = p.a * alpha * (0.35 + 0.65 * ease) * (1 - clamp(dissolve * 1.05));
      if (a <= 0.01) continue;
      const rs = sizePx * (0.75 + r4 * 0.7) * (1 - dissolve * 0.35);
      ctx.globalAlpha = a;
      ctx.fillRect(px, py, rs, rs);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return { w: s.w, h: s.h };
  };

  /* ---------- 4. 描边字（参考片 25s 的细线年份） ---------- */
  DFS.outlineText = function (ctx, text, o) {
    const {
      x = W / 2, y = H / 2, size = 220, weight = 200, family = T.fonts.serif,
      color = T.colors.ink, lw = 2.2, alpha = 1, tracking = 8, align = 'center',
      scale = 1, rotate = 0
    } = o;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotate);
    ctx.scale(scale, scale);
    ctx.font = DFS.font(size, weight, family);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    // 手写字距
    const chars = Array.from(text);
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cx = align === 'center' ? -total / 2 : align === 'right' ? -total : 0;
    chars.forEach((ch, i) => {
      ctx.strokeText(ch, cx + widths[i] / 2, 0);
      cx += widths[i] + tracking;
    });
    ctx.restore();
  };

  /* ---------- 5. 朱印（风干边缘 + 斑驳） ---------- */
  DFS.seal = function (ctx, o) {
    const {
      x = W / 2, y = H / 2, size = 96, text = '杜', color = T.colors.cinnabar,
      alpha = 1, rotate = -0.02, chars = 'single', seed = 3
    } = o;
    const s = size;
    const arr = Array.from(text).slice(0, 4);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotate);
    ctx.globalAlpha = alpha;
    // 印面：略微不规则的红块
    const r = DFS.rng(seed);
    // 方形印面（四边带微小抖动）
    const half = s * 0.5;
    ctx.beginPath();
    const edge = (x0, y0, x1, y1) => {
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const jx = (r() - 0.5) * s * 0.014, jy = (r() - 0.5) * s * 0.014;
        const px = lerp(x0, x1, u) + jx, py = lerp(y0, y1, u) + jy;
        if (i === 0 && x0 === -half && y0 === -half) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    };
    ctx.moveTo(-half, -half);
    edge(-half, -half, half, -half);
    edge(half, -half, half, half);
    edge(half, half, -half, half);
    edge(-half, half, -half, -half);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // 边框（留白细线）
    ctx.strokeStyle = 'rgba(240,232,214,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.018);
    ctx.strokeRect(-s * 0.40, -s * 0.40, s * 0.80, s * 0.80);
    // 字（阴文：纸色）
    ctx.fillStyle = 'rgba(242,234,214,0.96)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (chars === 'single' || arr.length === 1) {
      ctx.font = DFS.font(s * 0.60, 600, T.fonts.heavy);
      ctx.fillText(arr[0] || text, 0, s * 0.01);
    } else if (arr.length === 2) {
      ctx.font = DFS.font(s * 0.40, 600, T.fonts.heavy);
      ctx.fillText(arr[0], 0, -s * 0.17);
      ctx.fillText(arr[1], 0, s * 0.19);
    } else {
      ctx.font = DFS.font(s * 0.35, 600, T.fonts.heavy);
      // 右上 → 右下 → 左上 → 左下
      const pos = [[0.20, -0.18], [0.20, 0.20], [-0.20, -0.18], [-0.20, 0.20]];
      arr.forEach((c, i) => {
        ctx.fillText(c, pos[i][0] * s, pos[i][1] * s);
      });
    }
    // 斑驳：叠几笔红/纸色的小噪点
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = alpha * (0.10 + r() * 0.22);
      ctx.fillStyle = r() > 0.5 ? 'rgba(120,26,16,1)' : 'rgba(246,240,224,1)';
      ctx.beginPath();
      ctx.arc((r() - 0.5) * s * 0.95, (r() - 0.5) * s * 0.95, 0.5 + r() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- 6. 手绘红圈（参考片 12s/63s 的"圈出"动作） ---------- */
  DFS.handCircle = function (ctx, o) {
    const { x = W / 2, y = H / 2, rx = 200, ry = 90, progress = 1, color = '#C9362A', lw = 5, seed = 11, rotate = 0 } = o;
    const p = clamp(progress);
    if (p <= 0) return;
    const r = DFS.rng(seed);
    const N = 120;
    const wob = [];
    for (let i = 0; i < N; i++) wob.push(0.9 + r() * 0.18);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotate);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const a0 = -Math.PI * 0.62;
    const span = Math.PI * 2 * 1.06 * p;
    ctx.beginPath();
    for (let i = 0; i <= N * p; i++) {
      const a = a0 + (i / N) * span;
      const k = wob[(i + 3) % N];
      const px = Math.cos(a) * rx * k;
      const py = Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.globalAlpha = 0.92;
    ctx.stroke();
    // 第二圈（手绘的重描）
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    for (let i = 0; i <= N * p * 0.9; i++) {
      const a = a0 + 0.12 + (i / N) * span * 0.96;
      const k = wob[(i + 40) % N];
      const px = Math.cos(a) * rx * k * 1.03;
      const py = Math.sin(a) * ry * k * 1.06;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };

  /* ---------- 7. 朱色字牌（参考片 7s 的活字红牌） ---------- */
  DFS.redTile = function (ctx, o) {
    const {
      x, y, size = 110, ch = '名', depth = 0.16, rot = 0,
      alpha = 1, scale = 1, color = T.colors.cinnabar, seed = 1, shade = 0
    } = o;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    const h = size / 2;
    const dz = size * depth;
    // 侧面（3D 厚度）
    ctx.fillStyle = 'rgba(120,32,18,' + (0.85 - shade * 0.3) + ')';
    ctx.beginPath();
    ctx.moveTo(-h, h); ctx.lineTo(h, h); ctx.lineTo(h + dz * 0.6, h + dz); ctx.lineTo(-h + dz * 0.6, h + dz);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(h, -h); ctx.lineTo(h, h); ctx.lineTo(h + dz * 0.6, h + dz); ctx.lineTo(h + dz * 0.6, -h + dz);
    ctx.closePath(); ctx.fill();
    // 顶面
    const g = ctx.createLinearGradient(-h, -h, h, h);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(196,58,34,1)');
    ctx.fillStyle = g;
    ctx.fillRect(-h, -h, size, size);
    // 纸面肌理
    ctx.globalAlpha = alpha * 0.10;
    ctx.fillStyle = '#fff';
    const rr = DFS.rng(seed);
    for (let i = 0; i < 40; i++) ctx.fillRect(-h + rr() * size, -h + rr() * size, 1.4, 1.4);
    // 字
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(247,238,220,0.96)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = size * 0.66;
    ctx.font = DFS.font(fs, 500, T.fonts.serif);
    ctx.fillText(ch, 0, size * 0.02);
    ctx.restore();
  };

  /* ---------- 8. 卡片（翻牌） ---------- */
  DFS.card = function (ctx, o) {
    const {
      x, y, w = 150, h = 260, rotY = 0, front = true, alpha = 1,
      frontColor = '#F7F1E2', backColor = '#1A1710', label = '', sub = '',
      labelColor = T.colors.cinnabar, seed = 1, textSize = 34, chars
    } = o;
    const sc = Math.abs(Math.cos(rotY));
    if (sc < 0.02) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.scale(sc, 1);
    // 阴影
    ctx.shadowColor = 'rgba(40,28,12,0.30)';
    ctx.shadowBlur = 26 * sc;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = front ? frontColor : backColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    // 边缘
    ctx.strokeStyle = front ? 'rgba(120,104,78,0.35)' : 'rgba(255,240,210,0.18)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    if (!front) {
      // 背面：朱色字条
      const arr = chars || Array.from(label);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = labelColor;
      const fs = Math.min(textSize, w * 0.34);
      ctx.font = DFS.font(fs, 500, T.fonts.serif);
      const step = h / (arr.length + 1);
      arr.forEach((c, i) => ctx.fillText(c, 0, -h / 2 + step * (i + 1)));
    } else {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(40,30,18,0.88)';
      ctx.font = DFS.font(Math.min(textSize * 0.82, w * 0.26), 500, T.fonts.serif);
      const arr = Array.from(label);
      const step = (h - h * 0.3) / Math.max(1, arr.length);
      arr.forEach((c, i) => ctx.fillText(c, 0, -h / 2 + h * 0.16 + step * (i + 0.5)));
      if (sub) {
        ctx.font = DFS.font(w * 0.13, 400, T.fonts.kai);
        ctx.fillStyle = 'rgba(80,64,44,0.62)';
        ctx.fillText(sub, 0, h / 2 - h * 0.10);
      }
    }
    ctx.restore();
  };

  /* ---------- 9. 木刻/活字质感文字（在字面内打孔做纸纹与墨斑） ---------- */
  const grainCache = new Map();
  DFS.grainText = function (ctx, text, o) {
    const {
      x = W / 2, y = H / 2, size = 200, weight = 700, family = T.fonts.heavy,
      color = T.colors.ink, alpha = 1, rough = 0.55, seed = 5, tracking = 0
    } = o;
    const key = [text, size, weight, family, rough, seed, tracking].join('|');
    let cv = grainCache.get(key);
    if (!cv) {
      const m = DFS.mkCanvas(8, 8).getContext('2d');
      m.font = DFS.font(size, weight, family);
      const chars = Array.from(text);
      const ws = chars.map((c) => m.measureText(c).width);
      const totalW = ws.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
      const w = Math.ceil(totalW + size * 0.5);
      const h = Math.ceil(size * 1.55);
      cv = DFS.mkCanvas(w, h);
      const c = cv.getContext('2d');
      c.fillStyle = '#fff';
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.font = DFS.font(size, weight, family);
      let cx = size * 0.25;
      chars.forEach((ch, i) => { c.fillText(ch, cx, h / 2); cx += ws[i] + tracking; });
      // 打孔：模拟木刻版的墨色不均与纤维缺墨
      c.globalCompositeOperation = 'destination-out';
      const r = DFS.rng(seed * 977 + 11);
      const n = Math.floor(totalW * size / 900 * rough);
      for (let i = 0; i < n; i++) {
        const px = r() * w, py = r() * h;
        const rr = 0.35 + r() * (size * 0.012);
        c.globalAlpha = 0.12 + r() * 0.5;
        c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2); c.fill();
      }
      // 边缘细微崩口
      c.globalAlpha = 0.5;
      for (let i = 0; i < n * 0.12; i++) {
        const px = r() * w, py = r() * h;
        c.fillRect(px, py, 1 + r() * 2.2, 1 + r() * 2.2);
      }
      c.globalCompositeOperation = 'source-over';
      // 染成墨色
      const tmp = DFS.mkCanvas(w, h);
      const tc = tmp.getContext('2d');
      tc.drawImage(cv, 0, 0);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = color;
      tc.fillRect(0, 0, w, h);
      cv = tmp;
      grainCache.set(key, cv);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, x - cv.width / 2, y - cv.height / 2);
    ctx.restore();
    return { w: cv.width, h: cv.height };
  };

})(window.DFS);
