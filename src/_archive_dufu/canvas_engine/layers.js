/* =========================================================================
   layers.js — 五层视觉堆栈的底层：宣纸 / 颗粒 / 暗角 / 调色 / 墨韵
   铁律第 5 条：任何场景都必须由 渐变网格 + 资产 + 排版 + 调色 + 颗粒暗角 组成
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, rng, fbm, clamp } = DFS;
  const T = DFS.THEME;

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  DFS.mkCanvas = mkCanvas;

  /* ============ 宣纸纹理（一次性生成，全局复用） ============ */
  let paperCanvas = null;
  DFS.getPaper = function () {
    if (paperCanvas) return paperCanvas;
    const base = mkCanvas(W, H);
    const ctx = base.getContext('2d');

    // 1) 底色：暖白 + 四角轻微压暗
    const g = ctx.createRadialGradient(W * 0.5, H * 0.46, H * 0.15, W * 0.5, H * 0.5, H * 0.95);
    g.addColorStop(0, '#EBDCC1');
    g.addColorStop(0.55, '#E3D4B8');
    g.addColorStop(1, '#D8C9AD');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 2) 云状纤维（半分辨率 fbm → 放大，避免逐像素过慢）
    const sw = 480, sh = 270;
    const small = mkCanvas(sw, sh);
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(sw, sh);
    const d = img.data;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const n1 = fbm(x * 0.045, y * 0.045, 4, 2.1, 0.55);
        const n2 = fbm(x * 0.22 + 31.7, y * 0.22 + 8.3, 3, 2.0, 0.5);
        let v = (n1 - 0.5) * 26 + (n2 - 0.5) * 12;
        d[i] = 120 + v; d[i + 1] = 104 + v; d[i + 2] = 82 + v * 0.9; d[i + 3] = 255;
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.38;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, W, H);
    ctx.restore();

    // 3) 纸纤维：细横向短线
    const r = rng(9137);
    ctx.save();
    for (let i = 0; i < 2600; i++) {
      const x = r() * W, y = r() * H;
      const len = 6 + r() * 42;
      const a = 0.012 + r() * 0.03;
      ctx.strokeStyle = r() > 0.45 ? `rgba(94,78,54,${a})` : `rgba(255,250,235,${a * 1.5})`;
      ctx.lineWidth = 0.6 + r() * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (r() - 0.5) * 2.2);
      ctx.stroke();
    }
    // 4) 杂质点
    for (let i = 0; i < 1500; i++) {
      const x = r() * W, y = r() * H;
      ctx.fillStyle = `rgba(80,62,40,${0.02 + r() * 0.05})`;
      ctx.fillRect(x, y, 0.8 + r() * 1.6, 0.8 + r() * 1.6);
    }
    ctx.restore();

    // 5) 纸面的长折痕（参考片中隐约的横向暗带）
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 3; i++) {
      const y0 = H * (0.18 + i * 0.32) + (r() - 0.5) * 60;
      const lg = ctx.createLinearGradient(0, y0 - 26, 0, y0 + 26);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(150,132,104,' + (0.022 + r() * 0.018) + ')');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, y0 - 26, W, 52);
    }
    ctx.restore();

    paperCanvas = base;
    return base;
  };

  /* ============ 颗粒纹理（多张 tile，逐帧抖动） ============ */
  let grainTiles = null;
  DFS.getGrain = function () {
    if (grainTiles) return grainTiles;
    const tiles = [];
    for (let k = 0; k < 4; k++) {
      const c = mkCanvas(640, 360);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(640, 360);
      const d = img.data;
      const r = rng(500 + k * 17);
      for (let i = 0; i < d.length; i += 4) {
        const v = (r() * 255) | 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 26;
      }
      ctx.putImageData(img, 0, 0);
      tiles.push(c);
    }
    grainTiles = tiles;
    return tiles;
  };

  /* ============ 通用绘制：纸上底 ============ */
  DFS.drawPaper = function (ctx, opts = {}) {
    const zoom = opts.zoom || 1, ox = opts.ox || 0, oy = opts.oy || 0;
    ctx.save();
    ctx.drawImage(DFS.getPaper(), -(W * (zoom - 1)) / 2 + ox, -(H * (zoom - 1)) / 2 + oy, W * zoom, H * zoom);
    if (opts.tint) {
      ctx.globalCompositeOperation = opts.tintMode || 'multiply';
      ctx.globalAlpha = opts.tintAlpha ?? 0.16;
      ctx.fillStyle = opts.tint;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  /* ============ 通用绘制：深色底（夜/黑场） ============ */
  DFS.drawNight = function (ctx, opts = {}) {
    const g = ctx.createRadialGradient(W * (opts.cx ?? 0.5), H * (opts.cy ?? 0.42), 40,
      W * (opts.cx ?? 0.5), H * (opts.cy ?? 0.45), H * 1.15);
    g.addColorStop(0, opts.inner || '#23241B');
    g.addColorStop(0.45, opts.mid || '#181910');
    g.addColorStop(1, opts.outer || '#0A0B07');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };

  /* ============ 通用绘制：漂移渐变网格（第一层） ============ */
  DFS.drawGradientMesh = function (ctx, t, opts = {}) {
    const c1 = opts.c1 || 'rgba(255,246,224,0.55)';
    const c2 = opts.c2 || 'rgba(120,104,80,0.16)';
    const a1 = opts.a1 ?? 1, a2 = opts.a2 ?? 1;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const x1 = W * (0.32 + 0.06 * Math.sin(t * 0.11));
    const y1 = H * (0.30 + 0.05 * Math.cos(t * 0.09));
    let g = ctx.createRadialGradient(x1, y1, 0, x1, y1, H * 0.92);
    g.addColorStop(0, c1); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.75 * a1;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const x2 = W * (0.72 + 0.05 * Math.cos(t * 0.08 + 2));
    const y2 = H * (0.72 + 0.04 * Math.sin(t * 0.1 + 1));
    g = ctx.createRadialGradient(x2, y2, 0, x2, y2, H * 0.8);
    g.addColorStop(0, c2); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.9 * a2;
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  /* ============ 通用绘制：胶片颗粒 + 暗角（第五层，全片统一） ============
     V4：颗粒从 0.5 收到 0.18 量级。两张 tile 叠化在暗部会糊成"雾霾"，
     所以淡颗粒只铺一张；只有需要粗颗粒时才两张。
     ------------------------------------------------------------------ */
  DFS.drawGrainVignette = function (ctx, frame, opts = {}) {
    const tiles = DFS.getGrain();
    const r = rng(frame * 7919 + 13);
    const grain = opts.grain ?? 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = grain;
    const passes = grain > 0.28 ? 2 : 1;
    for (let i = 0; i < passes; i++) {
      const tile = tiles[(frame + i) % tiles.length];
      const ox = -r() * 320, oy = -r() * 180;
      ctx.drawImage(tile, ox, oy, W * 1.22, H * 1.22);
    }
    ctx.restore();

    // 暗角
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.92);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.72, `rgba(0,0,0,${(opts.vigMid ?? 0.10)})`);
    g.addColorStop(1, `rgba(0,0,0,${(opts.vig ?? 0.38)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 极轻的色差/温度（第四层调色）
    if (opts.warm) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = opts.warm;
      ctx.fillStyle = '#F6E2C0';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

  /* ============ 墨韵/烟云（可复用的确定性墨块） ============ */
  DFS.drawInkWash = function (ctx, opts) {
    const { x, y, r, seed = 1, alpha = 0.5, color = '18,14,8', softness = 1 } = opts;
    const rnd = rng(seed);
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const ang = rnd() * Math.PI * 2, dist = rnd() * r * 0.7;
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist;
      const pr = r * (0.35 + rnd() * 0.75) * softness;
      const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, `rgba(${color},${alpha * (0.5 + rnd() * 0.5)})`);
      g.addColorStop(0.55, `rgba(${color},${alpha * 0.28})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* ============ 转场：墨染遮罩 ============ */
  DFS.inkWipe = function (ctx, progress, dir = 1) {
    const p = clamp(progress);
    if (p <= 0 || p >= 1) return;
    const r = rng(4411);
    ctx.save();
    // 从右向左推进的不规则墨边
    ctx.beginPath();
    ctx.moveTo(W, 0);
    const edge = W * (1 - p * 1.35) + dir * 0;
    ctx.lineTo(edge, 0);
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const y = H * i / steps;
      const wob = (fbm(i * 0.35, p * 3, 3) - 0.5) * 120 * Math.sin(Math.PI * p);
      ctx.lineTo(edge + wob, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = T.colors.ink;
    ctx.fill();
    ctx.restore();
  };

})(window.DFS);
