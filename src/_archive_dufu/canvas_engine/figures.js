/* =========================================================================
   figures.js — 程序化图形资产：雨 / 茅草 / 竹 / 人影 / 舟 / 落木 / 飞鸟 / 墨点
   全部由 (seed, i, t) 纯函数决定，零素材依赖。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, rng, hash, fbm, Ease } = DFS;

  /* ---------------- 雨 ---------------- */
  DFS.Rain = class Rain {
    constructor(o = {}) {
      this.n = o.n ?? 320;
      this.seed = o.seed ?? 808;
      this.speed = o.speed ?? 2400;
      this.slant = o.slant ?? -0.16;
      this.lenK = o.lenK ?? 0.030;
      this.alpha = o.alpha ?? 0.5;
      this.color = o.color || '236,232,214';
      this.layer = o.layer ?? 1;     // 0 远 1 中 2 近（影响线宽/长度/速度）
      this.beads = o.beads ?? false;
    }
    draw(ctx, t, o = {}) {
      const spanX = W * 1.25, spanY = H * 1.3;
      const layerK = [0.55, 1, 1.5][this.layer] || 1;
      const speed = this.speed * layerK * (o.timeScale ?? 1);
      const alpha = this.alpha * (o.alphaMul ?? 1);
      const slant = this.slant;
      ctx.save();
      ctx.strokeStyle = `rgba(${this.color},${alpha})`;
      ctx.lineCap = 'round';
      for (let i = 0; i < this.n; i++) {
        const rx = hash(this.seed, i * 3 + 1);
        const ry = hash(this.seed, i * 3 + 2);
        const rv = hash(this.seed, i * 3 + 3);
        const sp = speed * (0.75 + rv * 0.6);
        const y = ((ry * spanY + t * sp) % spanY) - H * 0.15;
        const x = rx * spanX - W * 0.12 + y * slant * 0.35;
        const len = sp * this.lenK * (0.7 + rv * 0.6);
        if (this.beads) {
          // 子弹时间：雨滴变成带高光的圆珠
          const r = 2.2 + rv * 2.6;
          ctx.globalAlpha = alpha * (0.6 + rv * 0.4);
          ctx.fillStyle = `rgba(${this.color},${alpha})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
          ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.42, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.globalAlpha = alpha * (0.35 + rv * 0.75);
          ctx.lineWidth = (0.7 + rv * 1.1) * layerK;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + len * slant, y + len);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };

  /* ---------------- 茅草 / 芦苇（风场） ---------------- */
  DFS.Reeds = class Reeds {
    constructor(o = {}) {
      this.n = o.n ?? 90;
      this.seed = o.seed ?? 606;
      this.color = o.color || '22,20,14';
      this.alpha = o.alpha ?? 0.9;
      this.hMin = o.hMin ?? 0.35;
      this.hMax = o.hMax ?? 0.95;
      this.blur = o.blur ?? 0;
      this.width = o.width ?? 2.2;
      this.yBase = o.yBase ?? 1.02;
      this.wind = o.wind ?? 1;
      this.leaf = o.leaf ?? true;
    }
    draw(ctx, t, o = {}) {
      ctx.save();
      // 注意：不要用 ctx.filter blur —— 它会对每条 path 单独做软件模糊，单帧可达 20s。
      // 用 alpha / 线宽 / 叠加雾层来模拟远景色散。
      const depthFade = this.blur > 0.2 ? Math.max(0.25, 1 - this.blur * 0.12) : 1;
      ctx.globalAlpha = depthFade;
      ctx.strokeStyle = `rgba(${this.color},${this.alpha})`;
      ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
      ctx.lineCap = 'round';
      for (let i = 0; i < this.n; i++) {
        const r1 = hash(this.seed, i * 7 + 1);
        const r2 = hash(this.seed, i * 7 + 2);
        const r3 = hash(this.seed, i * 7 + 3);
        const r4 = hash(this.seed, i * 7 + 4);
        const r5 = hash(this.seed, i * 7 + 5);
        const r6 = hash(this.seed, i * 7 + 6);
        // 成簇分布：每 3 根共用一簇中心
        const clump = Math.floor(i / 3);
        const cx = (hash(this.seed + 7, clump * 3 + 1) * 1.08 - 0.04) * W;
        const x = cx + (r1 - 0.5) * 46;
        const hh = H * lerp(this.hMin, this.hMax, r2) * (0.85 + r5 * 0.3);
        const baseY = H * this.yBase + (r3 - 0.5) * 10;
        const gust = Math.sin(t * 1.7 + x * 0.002) * 0.5 + Math.sin(t * 0.53 + i) * 0.5;
        const bend = (0.10 + 0.20 * this.wind) * (gust * 0.6 + 0.55) * (0.7 + r4 * 0.6);
        const tipX = x + Math.sin(t * 1.1 + i * 0.6) * 7 * this.wind + bend * hh * 0.5;
        const tipY = baseY - hh;
        const midX = x + bend * hh * 0.12;
        // 秆：根部粗、梢部细（叠两笔）
        const w0 = this.width * (0.55 + r4 * 0.7);
        ctx.lineWidth = w0;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(midX, baseY - hh * 0.55, tipX, tipY);
        ctx.stroke();
        ctx.lineWidth = w0 * 1.35;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(midX, baseY - hh * 0.42, lerp(x, tipX, 0.45), lerp(baseY, tipY, 0.45));
        ctx.stroke();
        ctx.globalAlpha = 1;
        // 叶片：填充的细长刀形
        const leaves = 2 + Math.floor(r6 * 3);
        for (let k = 0; k < leaves; k++) {
          const u = 0.42 + (k / leaves) * 0.55;
          const ux = lerp(lerp(x, midX, u * 1.6), tipX, u * u);
          const uy = lerp(baseY, tipY, u);
          const ang = -Math.PI * 0.62 + (r6 - 0.5) * 1.3 + bend * 2.6 + Math.sin(t * 1.4 + i + k) * 0.1;
          const ll = (24 + hash(this.seed, i * 13 + k) * 62) * (this.width / 4.5);
          const wd = ll * 0.16;
          ctx.beginPath();
          ctx.moveTo(ux, uy);
          ctx.quadraticCurveTo(
            ux + Math.cos(ang) * ll * 0.45 - Math.sin(ang) * wd,
            uy + Math.sin(ang) * ll * 0.45 + Math.cos(ang) * wd,
            ux + Math.cos(ang) * ll,
            uy + Math.sin(ang) * ll
          );
          ctx.quadraticCurveTo(
            ux + Math.cos(ang) * ll * 0.45 + Math.sin(ang) * wd * 0.6,
            uy + Math.sin(ang) * ll * 0.45 - Math.cos(ang) * wd * 0.6,
            ux, uy
          );
          ctx.fill();
        }
        // 草穗（顶端）
        if (r5 > 0.55) {
          ctx.lineWidth = w0 * 0.5;
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI * 0.5 + (k - 2) * 0.14 + bend * 2;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX + Math.cos(a) * 9 * (1 + k * 0.2), tipY + Math.sin(a) * 16 * (1 + k * 0.1));
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  };

  /* ---------------- 竹 ---------------- */
  DFS.Bamboo = class Bamboo {
    constructor(o = {}) {
      this.n = o.n ?? 26;
      this.seed = o.seed ?? 512;
      this.color = o.color || '20,19,15';
      this.alpha = o.alpha ?? 0.9;
      this.blur = o.blur ?? 0;
      this.width = o.width ?? 6;
      this.wind = o.wind ?? 0.6;
      this.dark = o.dark ?? false;
    }
    draw(ctx, t, o = {}) {
      ctx.save();
      if (this.blur > 0.2) ctx.filter = `blur(${this.blur}px)`;
      for (let i = 0; i < this.n; i++) {
        const r1 = hash(this.seed, i * 7 + 1);
        const r2 = hash(this.seed, i * 7 + 2);
        const r3 = hash(this.seed, i * 7 + 3);
        const r4 = hash(this.seed, i * 7 + 4);
        const x = (r1 * 1.12 - 0.06) * W;
        const baseY = H * 1.05;
        const hh = H * (0.55 + r2 * 0.75);
        const gust = Math.sin(t * 0.9 + x * 0.0016) * 0.6 + Math.sin(t * 1.42 + i * 0.8) * 0.4;
        const bend = (0.04 + 0.09 * this.wind) * (0.6 + gust * 0.5) * (0.7 + r3 * 0.7);
        const tipX = x + bend * hh * 0.9;
        const w = this.width * (0.55 + r4 * 0.8);
        ctx.strokeStyle = `rgba(${this.color},${this.alpha * (0.55 + r3 * 0.45)})`;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + bend * hh * 0.18, baseY - hh * 0.55, tipX, baseY - hh);
        ctx.stroke();
        // 竹节
        const nodes = 4 + Math.floor(r2 * 4);
        for (let k = 1; k < nodes; k++) {
          const p = k / nodes;
          const nx = lerp(x, tipX, p * p * 0.9 + p * 0.1);
          const ny = baseY - hh * p;
          ctx.lineWidth = w * 1.35;
          ctx.beginPath();
          ctx.moveTo(nx - w * 0.7, ny);
          ctx.lineTo(nx + w * 0.7, ny);
          ctx.stroke();
        }
        // 竹叶
        const leaves = 3 + Math.floor(r4 * 4);
        for (let k = 0; k < leaves; k++) {
          const p = 0.45 + (k / leaves) * 0.55;
          const nx = lerp(x, tipX, p);
          const ny = baseY - hh * p;
          const ang = -Math.PI * 0.5 + (r1 - 0.5) * 2.4 + Math.sin(t * 1.3 + k + i) * 0.12;
          const ll = 70 + hash(this.seed, i * 31 + k) * 110;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.quadraticCurveTo(
            nx + Math.cos(ang) * ll * 0.5, ny + Math.sin(ang) * ll * 0.5 - 10,
            nx + Math.cos(ang) * ll, ny + Math.sin(ang) * ll + 18
          );
          ctx.lineWidth = 1.2 + hash(this.seed, i * 17 + k) * 1.6;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };

  /* ---------------- 人影：写意减笔（梁楷泼墨仙人式） ----------------
     严禁火柴人 / 几何块拼接。只用 3~5 道极具张力的墨迹：
       ① 宽袍主干（一道飞白大笔，随风吹出弧度）
       ② 斗笠（一道扁弧）
       ③ 迎风扬起的外袖
       ④ 贴体的内袖
       ⑤ 竹杖
     wind 越大，下摆与袖口飘得越开。
     ------------------------------------------------------------ */
  DFS.figure = function (ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '14,12,8';
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    const t = o.t || 0;
    const staff = o.staff !== false;
    const wind = o.wind === undefined ? (o.breath || 1) * 0.7 : o.wind;
    const V4 = DFS.V4;
    if (V4 && V4.fewFigure) {
      V4.fewFigure(ctx, x, y, s, { color, alpha, t, wind, staff, seed: o.seed || 21 });
      return;
    }
    // 兜底（未加载 V4 时）
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(' + color + ',1)';
    ctx.beginPath();
    ctx.moveTo(-12, -62); ctx.lineTo(12, -62);
    ctx.quadraticCurveTo(20, -30, 22, 0);
    ctx.quadraticCurveTo(0, 6, -22, 0);
    ctx.quadraticCurveTo(-20, -30, -12, -62);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };


  /* ---------------- 舟 ---------------- */
  DFS.boat = function (ctx, x, y, s, o = {}) {
    const { color = '10,10,7', alpha = 1, t = 0, figure = true, figureColor = '8,8,6' } = o;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    const bob = Math.sin(t * 1.5) * 1.6;
    ctx.translate(0, bob);
    ctx.fillStyle = `rgba(${color},1)`;
    // 船身
    ctx.beginPath();
    ctx.moveTo(-62, -6);
    ctx.quadraticCurveTo(-40, 14, 10, 12);
    ctx.quadraticCurveTo(54, 10, 70, -8);
    ctx.quadraticCurveTo(30, 0, -62, -6);
    ctx.closePath();
    ctx.fill();
    // 篷
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(-2, -34, 20, -6);
    ctx.closePath();
    ctx.fill();
    if (figure) {
      ctx.save();
      ctx.translate(40, -8);
      DFS.figure(ctx, 0, 0, 0.42, { color: figureColor, t });
      ctx.restore();
    }
    ctx.restore();
  };

  /* ---------------- 落木 ---------------- */
  DFS.Leaves = class Leaves {
    constructor(o = {}) {
      this.n = o.n ?? 70;
      this.seed = o.seed ?? 3301;
      this.color = o.color || '30,24,14';
      this.alpha = o.alpha ?? 0.85;
      this.size = o.size ?? 1;
      this.speed = o.speed ?? 1;
    }
    draw(ctx, t, o = {}) {
      ctx.save();
      ctx.strokeStyle = `rgba(${this.color},${this.alpha})`;
      ctx.fillStyle = `rgba(${this.color},${this.alpha})`;
      for (let i = 0; i < this.n; i++) {
        const r1 = hash(this.seed, i * 6 + 1);
        const r2 = hash(this.seed, i * 6 + 2);
        const r3 = hash(this.seed, i * 6 + 3);
        const r4 = hash(this.seed, i * 6 + 4);
        const sp = (110 + r4 * 190) * this.speed;
        const y = ((r2 * (H * 1.5) + t * sp) % (H * 1.5)) - H * 0.3;
        const drift = Math.sin(t * 1.1 + i) * 40 * (0.4 + r1);
        const x = r1 * W * 1.1 - W * 0.05 + t * (18 + r3 * 40) + drift;
        const rot = t * (0.6 + r3 * 2.4) + i;
        const s = (10 + r3 * 22) * this.size;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.globalAlpha = this.alpha * (0.35 + r4 * 0.65);
        // 叶形
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.quadraticCurveTo(s * 0.42, 0, 0, s * 0.5);
        ctx.quadraticCurveTo(-s * 0.42, 0, 0, -s * 0.5);
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(0, s * 0.55); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  };

  /* ---------------- 飞鸟（两笔水墨） ---------------- */
  DFS.bird = function (ctx, x, y, s, t, o = {}) {
    const { color = '26,20,12', alpha = 1, flap = 1 } = o;
    const w = Math.sin(t * 6.2) * 0.5 * flap;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(${color},1)`;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16, w * 6);
    ctx.quadraticCurveTo(-8, -6 - w * 4, 0, 0);
    ctx.quadraticCurveTo(8, -6 - w * 4, 16, w * 6);
    ctx.stroke();
    ctx.restore();
  };

  /* ---------------- 墨点飞溅（结尾爆发） ---------------- */
  DFS.splatter = function (ctx, x, y, o = {}) {
    const { n = 460, radius = 260, progress = 1, seed = 909, color = '20,14,7', alpha = 1, spread = 1 } = o;
    const p = clamp(progress);
    if (p <= 0) return;
    const e = Ease.outExpo(p);
    ctx.save();
    ctx.fillStyle = `rgba(${color},1)`;
    for (let i = 0; i < n; i++) {
      const a = hash(seed, i * 4 + 1) * Math.PI * 2;
      const d = Math.pow(hash(seed, i * 4 + 2), 0.55) * radius * spread;
      const rr = (1 + hash(seed, i * 4 + 3) * 3.4) * (1 - p * 0.25);
      const px = x + Math.cos(a) * d * e;
      const py = y + Math.sin(a) * d * e * 0.62;
      ctx.globalAlpha = alpha * (0.25 + hash(seed, i * 4 + 4) * 0.75) * (1 - Math.pow(p, 3));
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ---------------- 重复文字墙（焦虑章节） ---------------- */
  DFS.textWall = function (ctx, o) {
    const {
      text = '无法改变环境，无法改变自己，每天都很焦虑。', x = 0, y = 0, w = W, h = H,
      size = 30, alpha = 0.1, color = '230,226,212', lineH = 1.9, tracking = 6, rot = 0, fade = 1
    } = o;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = DFS.font(size, 400, DFS.THEME.fonts.serif);
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const chars = Array.from(text);
    const cw = size + tracking;
    const cols = Math.ceil(w / cw) + 1;
    const rows = Math.ceil(h / (size * lineH)) + 1;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const ch = chars[(rx + ry * 3) % chars.length];
        const ox = rx * cw;
        const oy = ry * size * lineH;
        ctx.globalAlpha = alpha * fade * (1 - clamp(ox / w) * 0.35 - clamp(oy / h) * 0.25);
        ctx.fillText(ch, ox, oy);
      }
    }
    ctx.restore();
  };

  /* ---------------- 烟雨/雾（多层飘移） ---------------- */
  DFS.mist = function (ctx, t, o = {}) {
    const { count = 5, color = '236,230,214', alpha = 0.5, y0 = H * 0.62, y1 = H * 0.95, speed = 1 } = o;
    ctx.save();
    for (let i = 0; i < count; i++) {
      const r = rng(1200 + i);
      const x = ((r() * 1.4 - 0.2) + Math.sin(t * 0.06 * speed + i) * 0.08) * W;
      const y = lerp(y0, y1, r());
      const w = W * (0.45 + r() * 0.5);
      const h = 90 + r() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.5);
      g.addColorStop(0, `rgba(${color},${alpha * (0.10 + r() * 0.10)})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, h / (w * 0.5));
      ctx.beginPath(); ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

})(window.DFS);
