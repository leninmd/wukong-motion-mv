/* =========================================================================
   water.js — 江面 / 夜海 / 月与月光柱
   参考片 30–46s：极简横向水纹 + 中央月光倒影；条带式绘制，确定性。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease, rng, fbm } = DFS;

  DFS.Sea = class Sea {
    constructor(o = {}) {
      this.horizon = o.horizon ?? 0.46;      // 地平线（画面高度比例）
      this.dark = o.dark ?? true;
      this.palette = o.palette || (this.dark
        ? { skyTop: '#0B0C08', skyBot: '#20211A', seaTop: '#1B1C15', seaBot: '#0A0B07', glint: '232,226,204', streak: '210,204,182' }
        : { skyTop: '#EDE3CF', skyBot: '#E2D6BC', seaTop: '#CFC4AC', seaBot: '#B7AB93', glint: '255,250,236', streak: '90,84,66' });
      this.seed = o.seed ?? 4242;
      this.rows = o.rows ?? 150;
    }

    // 天空 + 月亮
    drawSky(ctx, t, o = {}) {
      const hz = H * this.horizon;
      const g = ctx.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, this.palette.skyTop);
      g.addColorStop(1, this.palette.skyBot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, hz + 2);
      if (o.moon) this.drawMoon(ctx, o.moon, t);
      if (o.clouds) this.drawClouds(ctx, t, o.clouds);
    }

    drawMoon(ctx, m, t) {
      const { x = W * 0.5, y = H * 0.2, r = 46, glow = 1 } = m;
      ctx.save();
      // 光晕
      const hg = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 6);
      hg.addColorStop(0, `rgba(255,250,226,${0.30 * glow})`);
      hg.addColorStop(0.35, `rgba(255,246,214,${0.10 * glow})`);
      hg.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      // 月盘
      const mc = ctx.createRadialGradient(x - r * 0.25, y - r * 0.28, r * 0.1, x, y, r);
      mc.addColorStop(0, '#FFFDF2');
      mc.addColorStop(0.7, '#F3EDD6');
      mc.addColorStop(1, '#DED6BB');
      ctx.fillStyle = mc;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // 月面环形山（确定性噪点）
      const rd = rng(77);
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#8A836C';
      for (let i = 0; i < 26; i++) {
        const a = rd() * Math.PI * 2, d = Math.sqrt(rd()) * r * 0.86;
        const rr = r * (0.04 + rd() * 0.12);
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawClouds(ctx, t, c = {}) {
      const { y = H * 0.24, alpha = 0.55, color = '18,18,14', drift = 1 } = c;
      const r = rng(31);
      ctx.save();
      ctx.globalCompositeOperation = this.dark ? 'source-over' : 'multiply';
      for (let i = 0; i < 46; i++) {
        const baseX = r() * 1.6 - 0.3;
        const baseY = (r() - 0.5) * 0.5;
        const w = 120 + r() * 460;
        const h = 14 + r() * 46;
        const x = ((baseX + t * 0.004 * drift * (0.3 + r())) % 1.7 - 0.2) * W;
        const yy = y + baseY * H * 0.34;
        const g = ctx.createRadialGradient(x, yy, 0, x, yy, w * 0.5);
        g.addColorStop(0, `rgba(${color},${alpha * (0.10 + r() * 0.18)})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(x, yy);
        ctx.scale(1, h / (w * 0.5) * 1.5);
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 水面
    drawSea(ctx, t, o = {}) {
      const hz = H * this.horizon;
      const g = ctx.createLinearGradient(0, hz, 0, H);
      g.addColorStop(0, this.palette.seaTop);
      g.addColorStop(1, this.palette.seaBot);
      ctx.fillStyle = g;
      ctx.fillRect(0, hz, W, H - hz);

      const rows = this.rows;
      const rr = rng(this.seed);
      ctx.save();
      ctx.globalCompositeOperation = this.dark ? 'lighter' : 'multiply';
      for (let i = 0; i < rows; i++) {
        const k = i / (rows - 1);
        const y = hz + Math.pow(k, 1.85) * (H - hz);
        // 透视：越近越稀越亮
        const spacing = lerp(1.2, 16, k);
        const count = Math.round(lerp(150, 26, k));
        const len = lerp(6, 64, k) * (0.6 + 0.8 * (0.5 + 0.5 * Math.sin(i * 1.7)));
        const alpha = (this.dark ? 0.055 : 0.045) * (0.5 + 0.5 * Math.sin(i * 2.3 + t * 0.35));
        for (let j = 0; j < count; j++) {
          const x = ((j + rr() * 0.9) / count) * W;
          const wob = Math.sin(t * 0.9 + j * 0.35 + i * 0.2) * spacing * 0.6;
          ctx.strokeStyle = `rgba(${this.palette.streak},${alpha * (0.4 + rr() * 0.9)})`;
          ctx.lineWidth = lerp(0.5, 1.8, k);
          ctx.beginPath();
          ctx.moveTo(x, y + wob);
          ctx.lineTo(x + len, y + wob * 0.8);
          ctx.stroke();
        }
      }
      ctx.restore();

      if (o.moonPath) this.drawMoonPath(ctx, t, o.moonPath);
    }

    // 月光柱：竖直倒影
    drawMoonPath(ctx, t, m) {
      const hz = H * this.horizon;
      const { x = W * 0.5, width = 70, alpha = 1 } = m;
      const rr = rng(918);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i++) {
        const k = rr();
        const y = hz + Math.pow(k, 1.25) * (H - hz) * 0.98;
        const w = lerp(2, width * 1.5, k) * (0.5 + rr() * 0.9);
        const jx = Math.sin(t * 0.7 + i * 0.9) * (2 + k * 22);
        const a = alpha * (0.045 + rr() * 0.10) * (1 - k * 0.35);
        const g = ctx.createLinearGradient(x - w / 2 + jx, 0, x + w / 2 + jx, 0);
        g.addColorStop(0, `rgba(255,248,226,0)`);
        g.addColorStop(0.5, `rgba(255,248,226,${a})`);
        g.addColorStop(1, `rgba(255,248,226,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - w / 2 + jx, y, w, lerp(1.4, 3.6, k));
      }
      ctx.restore();
    }

    // 极简"纸上水"：浅水面的横向细线（参考片 30–32s）
    drawPaperSea(ctx, t, o = {}) {
      const hz = H * this.horizon;
      const g = ctx.createLinearGradient(0, hz - 40, 0, H);
      g.addColorStop(0, 'rgba(206,196,174,0)');
      g.addColorStop(0.10, 'rgba(206,196,174,0.42)');
      g.addColorStop(0.45, 'rgba(196,185,162,0.72)');
      g.addColorStop(1, 'rgba(176,164,141,0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(0, hz - 40, W, H - hz + 40);
      const rr = rng(511);
      ctx.save();
      for (let i = 0; i < 130; i++) {
        const k = i / 130;
        const y = hz + Math.pow(k, 1.7) * (H - hz);
        const count = Math.round(lerp(120, 16, k));
        for (let j = 0; j < count; j++) {
          const x = ((j + rr() * 0.9) / count) * W;
          const len = lerp(8, 70, k) * (0.5 + rr());
          const a = 0.05 + rr() * 0.05;
          ctx.strokeStyle = `rgba(120,110,88,${a})`;
          ctx.lineWidth = 0.8 + k * 1.2;
          ctx.beginPath();
          ctx.moveTo(x, y + Math.sin(t * 0.6 + j) * 1.5);
          ctx.lineTo(x + len, y + Math.sin(t * 0.6 + j) * 1.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };

})(window.DFS);
