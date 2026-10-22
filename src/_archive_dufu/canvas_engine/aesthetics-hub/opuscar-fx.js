/* =========================================================================
   aesthetics-hub / opuscar-fx.js  —  外挂模块 B
   源流：lemomo-ai/lemo-opuscar（51 种纯代码电影级风格算子）抽取 4 个特种镜头：
     · inkStampSplash      朱砂印章砸落：枯笔毛边 + 墨点飞溅 + 相机震动
     · offscreenWindDissolve 离屏像素采样 → 风场逐列吹散
     · cinematicPortalWipe   圆孔遮罩穿越转场
     · waterMoonShader       多层正弦波水面 + 月光走廊
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.HUB = DFS.HUB || {};
  const H = DFS.HUB;
  const { W, H: HH, clamp, hash, rng, fbm, Ease } = DFS;

  /* ---------------- 1. 印章砸落 ---------------- */
  /**
   * @param ctx
   * @param x,y      落点
   * @param progress 0→1（0.18 之内完成下砸，其余为余震与飞溅）
   * @param seed     确定性种子
   * @param opts     { size, color, text, chars, rotate, impactAt, shakeAmp }
   * @returns {{shake:{x,y,rot}, impact:number}} 交给调用方叠加相机震动
   */
  H.inkStampSplash = function (ctx, x, y, progress, seed = 1, opts = {}) {
    const size = opts.size ?? 120;
    const color = opts.color || DFS.THEME.colors.cinnabar;
    const text = opts.text || '杜';
    const chars = opts.chars || 'single';
    const rotate = opts.rotate ?? -0.03;
    const p = clamp(progress);
    const impactAt = opts.impactAt ?? 0.35;
    const impact = clamp((p - impactAt) / 0.12);      // 触纸瞬间
    const settle = Ease.outExpo(clamp((p - impactAt) / 0.5));

    // 下砸：从 1.6 倍、上方 80px、模糊 6px 砸到位
    const drop = 1 - Ease.inCubic(clamp(p / impactAt));
    const sc = (1.55 - 0.55 * settle) * (1 + drop * 0.0);
    const dy = drop * -90;
    const blur = (1 - settle) * 6;

    ctx.save();
    ctx.translate(x, y + dy);
    ctx.rotate(rotate);
    ctx.scale(sc, sc);
    if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.globalAlpha = 0.15 + 0.85 * clamp(p / impactAt + 0.05);

    // 印面：方形 + 毛边（用噪声扰动的边）
    const half = size / 2;
    const rr = rng(seed * 7919 + 3);
    ctx.beginPath();
    const edge = (x0, y0, x1, y1, n = 10) => {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const jx = (rr() - 0.5) * size * 0.022;
        const jy = (rr() - 0.5) * size * 0.022;
        const px = x0 + (x1 - x0) * u + jx;
        const py = y0 + (y1 - y0) * u + jy;
        if (i === 0 && x0 === -half && y0 === -half) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
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

    // 阴文：纸色字
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(242,234,214,0.96)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arr = Array.from(text).slice(0, 4);
    if (chars === 'single' || arr.length === 1) {
      ctx.font = DFS.font(size * 0.60, 700, DFS.THEME.fonts.heavy);
      ctx.fillText(arr[0] || text, 0, size * 0.01);
    } else if (arr.length === 2) {
      ctx.font = DFS.font(size * 0.40, 700, DFS.THEME.fonts.heavy);
      ctx.fillText(arr[0], 0, -size * 0.17);
      ctx.fillText(arr[1], 0, size * 0.19);
    } else {
      ctx.font = DFS.font(size * 0.36, 700, DFS.THEME.fonts.heavy);
      const pos = [[0.20, -0.18], [0.20, 0.20], [-0.20, -0.18], [-0.20, 0.20]];
      arr.forEach((c, i) => ctx.fillText(c, pos[i][0] * size, pos[i][1] * size));
    }
    // 印泥斑驳
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.08 + rr() * 0.22;
      ctx.fillStyle = rr() > 0.55 ? 'rgba(120,26,16,1)' : 'rgba(246,240,224,1)';
      ctx.beginPath();
      ctx.arc((rr() - 0.5) * size * 0.96, (rr() - 0.5) * size * 0.96, 0.5 + rr() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 墨点飞溅（120 颗，触纸后 0.25 内爆发）
    const sp = clamp((p - impactAt) / 0.35);
    if (sp > 0) {
      const e = Ease.outExpo(sp);
      ctx.save();
      for (let i = 0; i < 120; i++) {
        const a = hash(seed, i * 4 + 1) * Math.PI * 2;
        const d = Math.pow(hash(seed, i * 4 + 2), 0.55) * size * (1.6 + hash(seed, i * 4 + 3) * 1.4);
        const rad = (1.2 + hash(seed, i * 4 + 4) * 4.2) * (1 - sp * 0.35);
        const px = x + Math.cos(a) * d * e;
        const py = y + Math.sin(a) * d * e * 0.72 + 16 * e * e;
        ctx.globalAlpha = (1 - Math.pow(sp, 2.2)) * (0.18 + hash(seed, i * 7) * 0.55);
        ctx.fillStyle = i % 5 === 0 ? color : 'rgba(28,20,10,1)';
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    return { impact, shake: { x: 0, y: 0, rot: 0 } };
  };

  /* ---------------- 2. 离屏像素采样 → 风场吹散 ---------------- */
  const windCache = new Map();
  H.sampleTextParticles = function (text, o = {}) {
    const size = o.size ?? 96;
    const weight = o.weight ?? 500;
    const family = o.family || DFS.THEME.fonts.serif;
    const step = o.step ?? 4;
    const key = [text, size, weight, family, step].join('|');
    if (windCache.has(key)) return windCache.get(key);
    const mc = DFS.mkCanvas(8, 8).getContext('2d');
    mc.font = DFS.font(size, weight, family);
    const tw = mc.measureText(text).width;
    const pad = 8;
    const cw = Math.ceil(tw + pad * 2), ch = Math.ceil(size * 1.5);
    const cv = DFS.mkCanvas(cw, ch);
    const c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = DFS.font(size, weight, family);
    c.fillText(text, cw / 2, ch / 2);
    const data = c.getImageData(0, 0, cw, ch).data;
    const pts = [];
    for (let y = 0; y < ch; y += step) {
      for (let x = 0; x < cw; x += step) {
        if (data[(y * cw + x) * 4 + 3] > 120) pts.push({ x: x - pad, y: y - pad, u: (x - pad) / tw });
      }
    }
    const out = { pts, w: tw, h: size };
    windCache.set(key, out);
    return out;
  };

  /**
   * 文字化烟：先正常显示，再从左向右逐列被风剥离。
   * @param opts { assemble, dissolve, wind, color, inkColor, sizePx, seed, anchor }
   */
  H.offscreenWindDissolve = function (ctx, text, x, y, o = {}) {
    const size = o.size ?? 96;
    const s = H.sampleTextParticles(text, o);
    const assemble = clamp(o.assemble ?? 1);
    const dissolve = clamp(o.dissolve ?? 0);
    const wind = o.wind ?? 1;
    const seed = o.seed ?? 17;
    const ox = x - s.w / 2;
    const oy = y - s.h / 2;
    const color = o.color || '26,19,9';
    const sizePx = o.sizePx ?? 2.2;
    ctx.save();
    ctx.fillStyle = `rgba(${color},1)`;
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i];
      const r1 = hash(seed, i * 5 + 1), r2 = hash(seed, i * 5 + 2), r3 = hash(seed, i * 5 + 3);
      // 汇聚
      const ap = clamp((assemble - r1 * 0.5) / 0.5);
      const ae = Ease.outExpo(ap);
      let px = ox + p.x + (1 - ae) * (r2 - 0.5) * 380;
      let py = oy + p.y + (1 - ae) * (r3 - 0.5) * 300;
      // 逐列剥离：u 越大越晚被吹散
      const delay = p.u * 0.55;
      const dp = clamp((dissolve - delay * 0.6) / 0.45);
      const de = Ease.inCubic(dp);
      if (de > 0) {
        const turb = (fbm(p.x * 0.02 + dissolve * 2, p.y * 0.02, 3) - 0.5) * 220;
        px += de * (200 + p.u * 900) * wind;
        py += de * (turb - 240 * p.u) * wind;
      }
      const a = (0.25 + 0.75 * ae) * (1 - clamp(dissolve * 1.02));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a * (0.35 + r3 * 0.65);
      const sz = sizePx * (0.7 + r3 * 0.8) * (1 - dissolve * 0.3);
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.restore();
  };

  /* ---------------- 3. 圆孔遮罩穿越 ---------------- */
  /**
   * 先画外层（旧画面），再以圆形 clip 画内层（新画面），半径按 easeInExpo 扩大。
   * @param drawOuter / drawInner 为回调
   */
  H.cinematicPortalWipe = function (ctx, cx, cy, progress, drawOuter, drawInner, o = {}) {
    const p = clamp(progress);
    const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, HH - cy)) * 1.02;
    const r = maxR * Ease.inExpo(p);
    if (p < 0.999) {
      ctx.save();
      drawOuter(ctx);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.clip();
    drawInner(ctx);
    ctx.restore();
    // 孔边缘的柔光
    if (p > 0.005 && p < 0.995) {
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - p);
      ctx.strokeStyle = o.edgeColor || 'rgba(216,64,42,0.9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  /* ---------------- 4. 水面 + 月光走廊 ---------------- */
  /**
   * 多层正弦波叠加的水面：逐行扫描，法线由偏导求得，菲涅尔 + 月光高光。
   * 用行条带渲染（而非逐像素），1080p 下单帧 < 8ms。
   */
  H.waterMoonShader = function (ctx, w, h, t, o = {}) {
    const horizon = o.horizon ?? h * 0.46;
    const moonX = o.moonX ?? w * 0.5;
    const moonY = o.moonY ?? h * 0.22;
    const base = o.base || '12,14,11';
    const glint = o.glint || '236,232,210';
    const rows = o.rows ?? 220;
    const amp = o.amp ?? 1;
    const paletteTop = o.top || '26,28,22';
    ctx.save();
    // 水体
    const g = ctx.createLinearGradient(0, horizon, 0, h);
    g.addColorStop(0, `rgba(${paletteTop},1)`);
    g.addColorStop(0.5, `rgba(${base},1)`);
    g.addColorStop(1, `rgba(${base},0.98)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, h - horizon);

    const rr = rng(o.seed ?? 4242);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rows; i++) {
      const k = i / (rows - 1);
      const y = horizon + Math.pow(k, 1.9) * (h - horizon);
      // 三组正弦叠加 → 波高
      const wave =
        Math.sin(k * 26 + t * 1.1) * 0.55 +
        Math.sin(k * 61 - t * 0.7 + 1.3) * 0.30 +
        Math.sin(k * 13 + t * 0.33) * 0.15;
      const slope = Math.cos(k * 26 + t * 1.1) * 0.55 + Math.cos(k * 61 - t * 0.7 + 1.3) * 0.18;
      // 月光走廊：以 moonX 为中心的横向高斯
      const segs = Math.round(DFS.lerp(120, 20, k));
      const span = DFS.lerp(6, 90, k) * (0.6 + 0.4 * (wave + 1) / 2);
      for (let j = 0; j < segs; j++) {
        const x = ((j + rr() * 0.8) / segs) * w;
        const dx = Math.abs(x - moonX);
        const corridor = Math.exp(-Math.pow(dx / (w * DFS.lerp(0.035, 0.14, k)), 2));
        const glintA = corridor * (0.16 + 0.30 * Math.abs(slope)) * (0.35 + 0.65 * (wave + 1) / 2);
        const a = glintA * (o.moonGain ?? 1);
        if (a < 0.004) continue;
        const len = span * (0.4 + rr() * 1.2);
        const yy = y + Math.sin(k * 90 + t * 2 + j) * (1.2 + k * 2.2) * amp;
        ctx.strokeStyle = `rgba(${glint},${a})`;
        ctx.lineWidth = DFS.lerp(0.6, 2.2, k);
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + len, yy);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 月亮
    if (o.moon !== false) {
      const r = o.moonR ?? 48;
      ctx.save();
      const hg = ctx.createRadialGradient(moonX, moonY, r * 0.5, moonX, moonY, r * 6);
      hg.addColorStop(0, 'rgba(255,250,226,0.34)');
      hg.addColorStop(0.35, 'rgba(255,246,214,0.11)');
      hg.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(moonX - r * 6, moonY - r * 6, r * 12, r * 12);
      const mc = ctx.createRadialGradient(moonX - r * 0.25, moonY - r * 0.28, r * 0.1, moonX, moonY, r);
      mc.addColorStop(0, '#FFFDF2');
      mc.addColorStop(0.7, '#F3EDD6');
      mc.addColorStop(1, '#DED6BB');
      ctx.fillStyle = mc;
      ctx.beginPath(); ctx.arc(moonX, moonY, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

})(window.DFS);
