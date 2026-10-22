/* =========================================================================
   V4 / eight-layer.js — 「减法手术」后的五层渲染管线
   （文件名沿用历史命名，层数已从 8 层收敛到 5 层）

     L1 宣纸基质 / 深渊
     L2 环境资产（山水 / 木构 / 水）
     L3 大气（体积光 ×0.30）
     L4 微尘（气溶胶 ×0.28，48 粒，且排在排版之前）
     L5 排版（墨渗字 + 局部消光护罩）
     L6 调色（×0.60，废除全屏降饱和）
     L7 颗粒 + 暗角（×0.40）

   设计铁律：任何一帧都必须保住 35% 以上的"纯净纸纹"或"深邃纯墨"。
   凡全屏混合的层一律先打折；凡会盖住文字的层一律排到排版之前。
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V3 = DFS.V3 || {};
  const V3 = DFS.V3;
  const { W, H, clamp } = DFS;

  /* 全局预算：一层一层往下砍 */
  V3.BUDGET = {
    volumetric: 0.30,   // 体积光：−70%
    aerosol: 0.28,      // 气溶胶：−72%
    aerosolCount: 48,   // 160 → 48
    grade: 0.60,        // 调色：−40%
    grain: 0.42,        // 颗粒：−58%
    vignette: 0.62      // 暗角：−38%
  };

  V3.eight = function (ctx, t, p) {
    p = p || {};
    const frame = Math.round(t * DFS.FPS);
    const B = V3.BUDGET;

    /* ---------------- L1 宣纸基质 / 深渊 ---------------- */
    ctx.save();
    if (p.l1) p.l1(ctx);
    else if (p.void) {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 60, W * 0.5, H * 0.5, H * 1.12);
      g.addColorStop(0, p.voidInner || '#141410');
      g.addColorStop(0.6, p.voidMid || '#0A0A08');
      g.addColorStop(1, p.voidOuter || '#030302');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else {
      V3.paper(ctx, p.paperOpts || {});
    }
    ctx.restore();

    /* ---------------- L2 环境资产 ---------------- */
    if (p.l2) { ctx.save(); p.l2(ctx); ctx.restore(); }

    /* ---------------- L3 大气：打折 ---------------- */
    if (p.l3) {
      ctx.save();
      ctx.globalCompositeOperation = p.l3Blend || 'lighter';
      ctx.globalAlpha = B.volumetric * (p.l3Gain || 1);
      p.l3(ctx);
      ctx.restore();
    }

    /* ---------------- L4 微尘（移到排版之前，永不盖字） ---------------- */
    if (p.dust !== false) {
      ctx.save();
      V3.aerosol(ctx, t, Object.assign({
        count: B.aerosolCount,
        alpha: (p.dustAlpha || 0.30) * B.aerosol
      }, p.dustOpts || {}));
      ctx.restore();
    }

    /* ---------------- L4b 物理与特效 ---------------- */
    if (p.l4) { ctx.save(); p.l4(ctx); ctx.restore(); }

    /* ---------------- L5 排版 ---------------- */
    if (p.l5) { ctx.save(); p.l5(ctx); ctx.restore(); }

    /* ---------------- L6 调色（打折，禁 saturation 洗灰） ---------------- */
    ctx.save();
    ctx.globalAlpha = B.grade;
    if (p.l7) p.l7(ctx);
    else if (p.grade === 'warm') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#F0D9A8';
      ctx.fillRect(0, 0, W, H);
    } else if (p.grade === 'cold') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha *= 0.50;
      ctx.fillStyle = '#6E86A0';
      ctx.fillRect(0, 0, W, H);
    } else if (p.grade === 'ash') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha *= 0.14;
      ctx.fillStyle = '#C8CCCC';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    /* ---------------- L7 颗粒 + 暗角（收敛） ---------------- */
    DFS.drawGrainVignette(ctx, frame, {
      grain: (p.grain || 0.30) * B.grain,
      vig: (p.vignette || 0.22) * B.vignette,
      vigMid: (p.vignetteMid || 0.03) * B.vignette
    });
  };

  /* ---------------- 常用：墨色雨幕（S04） ---------------- */
  V3.spearRain = function (ctx, t, o) {
    o = o || {};
    const n = o.count || 900;
    const speed = o.speed || 1180;
    const slant = o.slant === undefined ? -0.26 : o.slant;
    const alpha = o.alpha || 0.5;
    const scale = o.timeScale || 1;
    const color = o.color || '206,208,200';
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const r1 = DFS.hash(o.seed || 88, i * 4 + 1);
      const r2 = DFS.hash(o.seed || 88, i * 4 + 2);
      const r3 = DFS.hash(o.seed || 88, i * 4 + 3);
      const sp = speed * (0.75 + r3 * 0.55) * scale;
      const y = ((r2 * H * 1.5 + t * sp) % (H * 1.5)) - H * 0.25;
      const x = r1 * W * 1.3 - W * 0.15 + y * slant * 0.4;
      const len = sp * 0.028 * (0.7 + r3 * 0.7);
      ctx.strokeStyle = 'rgba(' + color + ',' + (alpha * (0.3 + r3 * 0.7)).toFixed(3) + ')';
      ctx.lineWidth = 0.8 + r3 * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * slant, y + len);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ---------------- 常用：体积光柱（已由 BUDGET 打折，调用方无需改） ---------------- */
  V3.volumetricLight = function (ctx, t, o) {
    o = o || {};
    const n = o.count || 5;
    const alpha = (o.alpha || 0.16) * 0.55;
    const color = o.color || '236,214,166';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x0 = W * (0.10 + 0.80 * (i / Math.max(1, n - 1)));
      const sway = Math.sin(t * 0.19 + i * 1.7) * W * 0.018;
      const wTop = W * (0.016 + 0.024 * DFS.hash(o.seed || 3, i));
      const wBot = wTop * (2.4 + DFS.hash(o.seed || 4, i) * 2.2);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.86);
      g.addColorStop(0, 'rgba(' + color + ',' + (alpha * 0.9).toFixed(4) + ')');
      g.addColorStop(0.45, 'rgba(' + color + ',' + (alpha * 0.30).toFixed(4) + ')');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - wTop + sway, -40);
      ctx.lineTo(x0 + wTop + sway, -40);
      ctx.lineTo(x0 + wBot + sway * 2, H * 0.86);
      ctx.lineTo(x0 - wBot + sway * 2, H * 0.86);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------- 常用：云雾（层数减半、透明度压低） ---------------- */
  V3.cloudBank = function (ctx, t, o) {
    o = o || {};
    const n = Math.max(1, Math.round((o.count || 12) * 0.55));
    const color = o.color || '232,226,208';
    const alpha = (o.alpha || 0.12) * 0.62;
    const y0 = o.y0 === undefined ? H * 0.2 : o.y0;
    const y1 = o.y1 === undefined ? H * 0.55 : o.y1;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const r = DFS.rng(700 + i * 13);
      const drift = ((r() + t * (0.004 + r() * 0.008)) % 1.4 - 0.2) * W;
      const y = y0 + (y1 - y0) * r();
      const w = W * (0.22 + r() * 0.5);
      const h = 40 + r() * 130;
      const g = ctx.createRadialGradient(drift, y, 0, drift, y, w * 0.5);
      g.addColorStop(0, 'rgba(' + color + ',' + (alpha * (0.4 + r() * 0.6)).toFixed(4) + ')');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(drift, y);
      ctx.scale(1, h / (w * 0.5) * 1.6);
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

})(window.DFS);
