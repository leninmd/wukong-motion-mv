/* =========================================================================
   engine/v4/inkbrush.js — 笔墨工具箱（V4）
   唯一职责：把"几何线框 / 点云 / 多边形"翻译成"毛笔、金石、界画、皴法"。
   全部算子由 (seed, i) 纯函数驱动，无 Math.random、无 ctx.filter 循环。

     inkStroke        单笔：起笔顿挫 / 中段收锋 / 飞白尾迹
     ribbon           多段变宽笔画（檐口、衣袂、轮廓）
     cunStrokes       皴法：脊线向下的干笔皴擦（山无脚）
     hallSilhouette   界画木构：剪影斗拱 + 飞檐三笔 + 朱砂灯火
     rubbingStele     金石碑拓：扑墨黑体 + 石花崩茬 + 阴刻白文
     fewFigure        减笔人物：3~5 道墨迹立骨
     cinnabarRule     朱丝栏：古籍边栏（替代数码 HUD）
     annotation       双行小字夹注
     halo             文字消光晕圈（可读性护罩）
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V4 = DFS.V4 || {};
  const V4 = DFS.V4;
  const { W, H, clamp, lerp, hash, rng, fbm, Ease } = DFS;

  /* ===================== 0. 内部：确定性噪声 ===================== */
  const n1 = (seed, i) => hash(seed, i) * 2 - 1;

  /* ===================== 1. 单笔 =====================
     起笔顿挫（粗）→ 中段略收（细）→ 收笔回锋
     dry 越大，笔道两侧飞白越碎。
     ------------------------------------------------------ */
  V4.inkStroke = function (ctx, x1, y1, x2, y2, o) {
    o = o || {};
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.8) return;
    const w = o.w ?? 3;
    if (w < 0.16) return;
    const alpha = o.alpha ?? 0.9;
    if (alpha < 0.004) return;
    const color = o.color || '26,19,9';
    const dry = clamp(o.dry ?? 0.25);
    const seed = o.seed ?? 1;
    const wob = (o.wob ?? 0.55) * clamp(w / 4, 0.35, 2.2);
    const press = o.press ?? 1;
    const n = clamp(Math.round(len / 14), 3, 14);

    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    // 变宽包络：头 12% 起笔顿、中段收、尾 20% 回锋
    const halfAt = (u) => {
      const head = clamp(u / 0.12);
      const tail = clamp((1 - u) / 0.22);
      const mid = 0.56 + 0.30 * Math.sin(Math.PI * u);
      const k = Math.min(1, head * 0.75 + 0.25) * Math.min(1, tail * 0.8 + 0.2) * mid;
      return w * 0.5 * (0.32 + 0.68 * k) * press;
    };

    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const wobble = n1(seed, i) * wob * Math.sin(Math.PI * u);
      const cx = x1 + dx * u + nx * wobble;
      const cy = y1 + dy * u + ny * wobble;
      const hw = halfAt(u) * (1 + n1(seed + 77, i) * 0.14 * dry);
      L.push([cx + nx * hw, cy + ny * hw]);
      R.push([cx - nx * hw, cy - ny * hw]);
    }
    ctx.save();
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(' + color + ',' + (alpha * 0.55).toFixed(3) + ')');
    g.addColorStop(0.16, 'rgba(' + color + ',' + alpha.toFixed(3) + ')');
    g.addColorStop(0.78, 'rgba(' + color + ',' + (alpha * 0.90).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + color + ',' + (alpha * 0.22).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    ctx.fill();

    // 干笔飞白：笔道一侧的断续细丝（只在笔足够粗时出现）
    if (dry > 0.42 && w > 2.4) {
      const k = 2 + Math.round(dry * 2);
      ctx.lineCap = 'round';
      for (let b = 0; b < k; b++) {
        const off = (hash(seed + 13, b) - 0.5) * w * 0.9;
        const u0 = 0.10 + hash(seed + 31, b) * 0.34;
        const u1 = 0.62 + hash(seed + 57, b) * 0.36;
        const sx = x1 + dx * u0 + nx * off, sy = y1 + dy * u0 + ny * off;
        const ex = x1 + dx * u1 + nx * off * 1.3, ey = y1 + dy * u1 + ny * off * 1.3;
        ctx.strokeStyle = 'rgba(' + color + ',' + (alpha * (0.10 + hash(seed + 71, b) * 0.16)).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.4, w * (0.06 + hash(seed + 91, b) * 0.10));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(lerp(sx, ex, 0.5) + nx * off * 0.4, lerp(sy, ey, 0.5) + ny * off * 0.4, ex, ey);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  /* ===================== 2. 多段变宽笔画（檐口 / 衣袂 / 轮廓） ===================== */
  V4.ribbon = function (ctx, pts, o) {
    o = o || {};
    if (!pts || pts.length < 2) return;
    const w = o.w ?? 6;
    const alpha = o.alpha ?? 0.9;
    if (alpha < 0.004 || w < 0.2) return;
    const color = o.color || '26,19,9';
    const dry = clamp(o.dry ?? 0.3);
    const seed = o.seed ?? 3;
    const taper = o.taper ?? 0.62;   // 1 = 粗细均匀
    const n = pts.length;
    const Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(n - 1, i + 1)];
      let tx = pb[0] - pa[0], ty = pb[1] - pa[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const u = i / (n - 1);
      const env = Math.min(1, u / 0.10) * Math.min(1, (1 - u) / 0.16);
      const hw = w * 0.5 * (taper + (1 - taper) * Math.sin(Math.PI * u)) * (0.30 + 0.70 * env)
        * (1 + n1(seed, i) * 0.10 * dry);
      Lp.push([p[0] - ty * hw, p[1] + tx * hw]);
      Rp.push([p[0] + ty * hw, p[1] - tx * hw]);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(' + color + ',' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < n; i++) {
      const mx = (Lp[i][0] + Lp[i - 1][0]) * 0.5, my = (Lp[i][1] + Lp[i - 1][1]) * 0.5;
      ctx.quadraticCurveTo(Lp[i - 1][0], Lp[i - 1][1], mx, my);
    }
    ctx.lineTo(Lp[n - 1][0], Lp[n - 1][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
    ctx.closePath();
    ctx.fill();
    // 枯笔：笔道一侧叠两道更淡的擦痕（不改背景，绝不 destination-out）
    if (dry > 0.40) {
      ctx.globalAlpha = 0.5 * dry;
      for (let k = 0; k < 2; k++) {
        const off = (hash(seed + 5, k) - 0.5) * w * 0.55;
        ctx.strokeStyle = 'rgba(' + color + ',' + (alpha * (0.16 + hash(seed + 9, k) * 0.22)).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.5, w * (0.07 + hash(seed + 7, k) * 0.09));
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const px = pts[i][0] + off * Math.cos(i * 0.7);
          const py = pts[i][1] + off;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  /* ===================== 3. 皴法山峦 =====================
     tops: [{x, y, h}]（屏幕坐标；h = 该列山体的可视高度）
     从脊线向下打干笔皴，密度随深度衰减；到底部自然透明 → 山无脚。
     ------------------------------------------------------ */
  V4.cunStrokes = function (ctx, tops, o) {
    o = o || {};
    const color = o.color || '26,19,9';
    const alpha = o.alpha ?? 0.9;
    if (alpha < 0.006 || tops.length < 2) return;
    const seed = o.seed ?? 7;
    const dry = clamp(o.dry ?? 0.55);
    const buckets = [0.55, 0.34, 0.18];
    ctx.save();
    ctx.lineCap = 'round';
    for (let b = 0; b < buckets.length; b++) {
      ctx.strokeStyle = 'rgba(' + color + ',' + (alpha * buckets[b]).toFixed(3) + ')';
      const lw = [1.9, 1.25, 0.75][b];
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i < tops.length; i++) {
        const t = tops[i];
        if (t == null || t.h <= 1) continue;
        const colDensity = 1 + Math.floor(hash(seed + b * 17, i) * 2);
        for (let k = 0; k < colDensity; k++) {
          const r1 = hash(seed + b * 31 + k * 7, i);
          const r2 = hash(seed + b * 53 + k * 11, i);
          const r3 = hash(seed + b * 97 + k * 13, i);
          // 起点：紧贴脊线（0.5%~12%）—— 皴从脊生
          const sy = t.y + t.h * (0.005 + Math.pow(r1, 1.8) * 0.14);
          const sx = t.x + (r2 - 0.5) * 11;
          // 长度：随深度快速衰减（越往下越短、越淡 → 山无脚）
          const len = t.h * (0.055 + r3 * 0.20) * (1 - b * 0.22);
          if (len < 2.0) continue;
          // 皴向：斜向披麻，向山脚外撇
          const lean = (r2 - 0.5) * 0.95 + (t.x < W * 0.5 ? -0.26 : 0.26);
          const ex = sx + Math.sin(lean) * len * 0.55;
          const ey = sy + len;
          // 越往下 alpha 越低（由笔色到纸色）
          const fade = 1 - clamp((sy - t.y) / Math.max(1, t.h));
          const mx = (sx + ex) * 0.5 + (r3 - 0.5) * len * 0.24;
          if (fade < 0.10) continue;
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(mx, (sy + ey) * 0.5, ex, ey);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ===================== 4. 界画木构（剪影斗拱 + 飞檐） =====================
     x,y = 台基中心；w,h = 总体尺寸
     ------------------------------------------------------ */
  V4.hallSilhouette = function (ctx, o) {
    if (o.a < 0.006 || o.w < 5) return;
    const { x, y, w, h } = o;
    const a = clamp(o.a);
    const color = o.color || '20,16,10';
    const seed = o.seed ?? 5;
    const hw = w * 0.5;
    const eaveY = y - h * 0.50;
    const upY = y - h * 0.76;
    const ridgeY = y - h * 0.96;
    const lift = h * 0.13;

    ctx.save();
    const g = ctx.createLinearGradient(x, ridgeY, x, y + h * 0.12);
    g.addColorStop(0, 'rgba(' + color + ',' + (a * 0.97).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(' + color + ',' + (a * 0.84).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + color + ',' + (a * 0.42).toFixed(3) + ')');
    ctx.fillStyle = g;

    // ——— 台基 ———
    ctx.beginPath();
    ctx.moveTo(x - hw * 1.00, y);
    ctx.lineTo(x - hw * 0.86, y + h * 0.11);
    ctx.lineTo(x + hw * 0.86, y + h * 0.11);
    ctx.lineTo(x + hw * 1.00, y);
    ctx.closePath();
    ctx.fill();

    // ——— 柱与墙（实心剪影） ———
    ctx.beginPath();
    ctx.rect(x - hw * 0.76, eaveY, hw * 1.52, y - eaveY);
    ctx.fill();

    // ——— 屋檐：唐式凹曲（反宇）———
    const roofEdge = (yEdge, span, liftAmt, curve) => {
      const pts = [];
      const N = 18;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const uu = u * 2 - 1;                       // -1 .. 1
        const droop = liftAmt * (Math.pow(Math.abs(uu), 2.3));  // 两端上翘
        const sag = curve * Math.sin(Math.PI * u);   // 中段下凹
        pts.push([x + uu * span, yEdge + sag - droop]);
      }
      return pts;
    };
    const drawRoof = (yEdge, span, liftAmt, sagAmt) => {
      const top = roofEdge(yEdge - h * 0.13, span, liftAmt, sagAmt);
      const bot = roofEdge(yEdge, span * 0.985, liftAmt * 0.86, sagAmt * 0.82);
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath();
      ctx.fill();
      return { top, bot };
    };
    const lower = drawRoof(eaveY, hw * 1.16, lift, h * 0.045);
    drawRoof(upY, hw * 0.94, lift * 0.82, h * 0.032);

    // ——— 正脊 + 鸱吻 ———
    ctx.beginPath();
    ctx.rect(x - hw * 0.34, ridgeY - h * 0.02, hw * 0.68, h * 0.035);
    ctx.fill();
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(x + s * hw * 0.34, ridgeY);
      ctx.quadraticCurveTo(x + s * hw * 0.42, ridgeY - h * 0.07, x + s * hw * 0.33, ridgeY - h * 0.10);
      ctx.quadraticCurveTo(x + s * hw * 0.30, ridgeY - h * 0.05, x + s * hw * 0.34, ridgeY);
      ctx.fill();
    });

    // ——— 斗拱（檐下一排短块，用填充而非线框） ———
    if (w > 18) {
      const m = Math.max(3, Math.round(w / 16));
      const bw = (hw * 1.72) / m;
      const bh = h * 0.055;
      for (let i = 0; i < m; i++) {
        const cx = x - hw * 0.86 + bw * (i + 0.5);
        ctx.beginPath();
        ctx.rect(cx - bw * 0.26, eaveY - bh * 1.5, bw * 0.52, bh * 1.5);
        ctx.fill();
      }
    }

    // ——— 飞檐三笔（毛笔勾边，绝不 1px 死线） ———
    const seedOff = seed * 13;
    V4.ribbon(ctx, lower.top, {
      w: clamp(h * 0.040, 1.1, 5.0),
      alpha: a * 0.95,
      color: o.strokeColor || '12,10,6',
      dry: 0.55, taper: 0.45, seed: seedOff
    });
    V4.ribbon(ctx, lower.bot, {
      w: clamp(h * 0.045, 1.4, 5.0),
      alpha: a * 0.85,
      color: o.strokeColor || '12,10,6',
      dry: 0.6, taper: 0.8, seed: seedOff + 3
    });
    // 戗脊（两条垂脊）
    if (w > 24) {
      V4.inkStroke(ctx, lower.top[0][0], lower.top[0][1], x - hw * 0.32, ridgeY,
        { w: clamp(h * 0.02, 0.9, 2.4), alpha: a * 0.7, color: o.strokeColor || '12,10,6', dry: 0.5, seed: seedOff + 7 });
      V4.inkStroke(ctx, lower.top[lower.top.length - 1][0], lower.top[lower.top.length - 1][1], x + hw * 0.32, ridgeY,
        { w: clamp(h * 0.02, 0.9, 2.4), alpha: a * 0.7, color: o.strokeColor || '12,10,6', dry: 0.5, seed: seedOff + 9 });
    }

    // ——— 朱砂灯火：檐下一点暖 ———
    if (o.lamp && w > 40) {
      const lx = x + (o.lampX ?? 0) * hw * 0.5;
      const ly = y - h * 0.24;
      const lr = Math.max(6, w * 0.16);
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, 'rgba(255,206,132,' + (0.55 * a).toFixed(3) + ')');
      lg.addColorStop(0.42, 'rgba(214,110,54,' + (0.20 * a).toFixed(3) + ')');
      lg.addColorStop(1, 'rgba(214,110,54,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ===================== 5. 金石碑拓 =====================
     pts: 归一化多边形；1 单位 = (w/2, h/2)
     ------------------------------------------------------ */
  V4.rubbingStele = function (ctx, o) {
    const { w, h, pts } = o;
    const a = clamp(o.alpha ?? 1);
    if (a < 0.006 || w < 6) return;
    const seed = o.seed ?? 11;
    const cw = w * 0.5, ch = h * 0.5;

    ctx.save();
    // ——— 碑体：厚重扑墨黑 ———
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const X = pts[i][0] * cw, Y = pts[i][1] * ch;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(-cw, -ch, cw, ch);
    g.addColorStop(0, 'rgba(30,29,26,' + (0.97 * a).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(22,22,20,' + (0.99 * a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(14,14,13,' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fill();

    // ——— 石花崩茬：沿边缘凿出的斑驳白边 ———
    ctx.save();
    ctx.clip();
    const edgePts = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
      const seg = Math.max(2, Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 10));
      for (let k = 0; k < seg; k++) {
        const u = k / seg;
        edgePts.push([
          (p0[0] + (p1[0] - p0[0]) * u) * cw,
          (p0[1] + (p1[1] - p0[1]) * u) * ch
        ]);
      }
    }
    ctx.fillStyle = 'rgba(214,208,190,' + (0.5 * a).toFixed(3) + ')';
    for (let i = 0; i < edgePts.length; i++) {
      const e = edgePts[i];
      const cnt = 1 + Math.floor(hash(seed + 3, i) * 3);
      for (let k = 0; k < cnt; k++) {
        const r1 = hash(seed + 11 + k, i * 5 + 1);
        const r2 = hash(seed + 23 + k, i * 5 + 2);
        const r3 = hash(seed + 37 + k, i * 5 + 3);
        const inward = 1.2 + r1 * (w > 120 ? 5.2 : 2.4);
        const px = e[0] * (1 - inward / Math.max(1, cw) * 0.6) + (r2 - 0.5) * 2.2;
        const py = e[1] * (1 - inward / Math.max(1, ch) * 0.6) + (r3 - 0.5) * 2.2;
        const sz = 0.5 + r2 * 1.8;
        ctx.globalAlpha = (0.18 + r3 * 0.42) * a;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ——— 碑面石理：竖向擦痕 ———
    ctx.strokeStyle = 'rgba(190,184,166,' + (0.07 * a).toFixed(3) + ')';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const x0 = (hash(seed + 61, i) - 0.5) * w * 0.9;
      const y0 = (hash(seed + 67, i) - 0.5) * h * 0.9;
      const len = h * (0.06 + hash(seed + 71, i) * 0.18);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (hash(seed + 73, i) - 0.5) * 5, y0 + len);
    }
    ctx.stroke();
    ctx.restore();

    // ——— 阴刻白文（阳底阴字，字口带崩茬） ———
    if (o.text && w > 30) {
      const chars = Array.from(o.text);
      const step = (h * 0.86) / Math.max(1, chars.length);
      const fs = Math.min(o.fontSize || step * 0.92, step * 0.92);
      ctx.font = DFS.font(fs, 600, DFS.THEME.fonts.serif);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const r = rng(seed * 7717 + 5);
      chars.forEach((c, k) => {
        const yy = -ch * 0.86 + step * (k + 0.5);
        // 字口阴影（凿下去的侧壁）
        ctx.fillStyle = 'rgba(0,0,0,' + (0.75 * a).toFixed(3) + ')';
        ctx.fillText(c, 1.5, yy + 1.6);
        // 白文正面
        ctx.fillStyle = 'rgba(226,220,202,' + (0.92 * a).toFixed(3) + ')';
        ctx.fillText(c, 0, yy);
        // 崩茬：字口边缘的细碎缺口
        if (r() > 0.35) {
          ctx.fillStyle = 'rgba(10,10,9,' + (0.5 * a).toFixed(3) + ')';
          const n = 2 + Math.floor(r() * 4);
          for (let i = 0; i < n; i++) {
            const nx = (r() - 0.5) * fs * 0.92;
            const ny = yy + (r() - 0.5) * fs * 0.92;
            ctx.fillRect(nx, ny, 0.9 + r() * 1.6, 0.9 + r() * 1.6);
          }
        }
      });
    }
    ctx.restore();
  };

  /* ===================== 6. 减笔人物（梁楷式写意） =====================
     3~5 道气象万千的墨迹：宽袍、斗笠、双袖、竹杖。
     ------------------------------------------------------ */
  V4.fewFigure = function (ctx, x, y, s, o) {
    o = o || {};
    const alpha = o.alpha ?? 1;
    if (alpha < 0.006) return;
    const color = o.color || '14,12,8';
    const t = o.t || 0;
    const wind = o.wind ?? 0.6;
    const seed = o.seed ?? 21;
    const sway = Math.sin(t * 1.15) * wind;
    const flutter = Math.sin(t * 2.37 + 1.1) * 0.5 + Math.sin(t * 1.07) * 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(t * 0.9) * 0.004 * wind);

    // ① 宽袍主干：从肩到地的一条宽墨（被风吹出弧度）
    const hemX = sway * 26 * wind;
    const robe = [
      [-13, -62], [-17, -46], [-16, -26], [-15, -8], [hemX - 26, 8],
      [hemX + 3, 12], [hemX + 26, 5], [16, -10], [15, -30], [13, -50], [8, -63]
    ];
    V4.ribbon(ctx, robe, {
      w: 30, alpha: alpha * 0.96, color, dry: 0.30, taper: 0.9, seed
    });

    // ② 斗笠：一道扁弧（不是圆）
    V4.ribbon(ctx, [
      [-26, -70], [-12, -80], [4, -84], [18, -80], [27, -71]
    ], { w: 13, alpha: alpha * 0.98, color, dry: 0.22, taper: 0.7, seed: seed + 1 });

    // ③ 左袖：迎风扬起的一道飞白
    V4.ribbon(ctx, [
      [-12, -58], [-26, -50], [-36 - sway * 9, -34 * (0.7 + flutter * 0.3)]
    ], { w: 14, alpha: alpha * 0.86, color, dry: 0.62, taper: 0.32, seed: seed + 2 });

    // ④ 右袖（贴体）
    V4.ribbon(ctx, [
      [11, -57], [22, -44], [24 + sway * 4, -26]
    ], { w: 11, alpha: alpha * 0.8, color, dry: 0.5, taper: 0.36, seed: seed + 3 });

    // ⑤ 竹杖 / 手杖
    if (o.staff !== false) {
      V4.inkStroke(ctx, 20, -54, 27, 6, {
        w: 3.0, alpha: alpha * 0.92, color, dry: 0.45, seed: seed + 4
      });
    }
    ctx.restore();
  };

  /* ===================== 7. 朱丝栏（古籍边栏） =====================
     竖线 + 界格，落在版心线内；淡朱砂、微微断续。
     ------------------------------------------------------ */
  V4.cinnabarRule = function (ctx, o) {
    const a = o.alpha ?? 0.5;
    if (a < 0.004) return;
    const color = o.color || '168,58,40';
    const seed = o.seed ?? 9;
    ctx.save();
    // 主栏线（左右各一）
    (o.lines || []).forEach((ln, li) => {
      const N = Math.max(6, Math.round((ln.y1 - ln.y0) / 16));
      ctx.strokeStyle = 'rgba(' + color + ',' + (a * 0.72).toFixed(3) + ')';
      ctx.lineCap = 'butt';
      for (let i = 0; i < N; i++) {
        const yA = ln.y0 + (ln.y1 - ln.y0) * (i / N);
        const yB = ln.y0 + (ln.y1 - ln.y0) * ((i + 0.82) / N);
        const wob = (hash(seed + li * 31, i) - 0.5) * 1.5;
        ctx.lineWidth = (ln.w ?? 1.1) * (0.82 + hash(seed + li * 17, i) * 0.4);
        ctx.beginPath();
        ctx.moveTo(ln.x + wob, yA);
        ctx.lineTo(ln.x + wob * 0.6, yB);
        ctx.stroke();
      }
    });
    // 界格（栏内横线，很淡）
    if (o.ticks) {
      ctx.strokeStyle = 'rgba(' + color + ',' + (a * 0.28).toFixed(3) + ')';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      o.ticks.forEach(([x0, x1, y]) => { ctx.moveTo(x0, y); ctx.lineTo(x1, y); });
      ctx.stroke();
    }
    ctx.restore();
  };

  /* ===================== 8. 双行小字夹注 =====================
     竖排、单列或双列，淡墨、字距紧。
     ------------------------------------------------------ */
  V4.annotation = function (ctx, text, o) {
    const a = o.alpha ?? 0.6;
    if (a < 0.004) return 0;
    const size = o.size ?? 22;
    const chars = Array.from(text);
    const step = size * (o.gap ?? 1.06);
    const color = o.color || '90,80,62';
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = DFS.font(size, o.weight ?? 400, o.family || DFS.THEME.fonts.kai);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(' + color + ')';
    const colH = Math.floor((o.h || chars.length * step) / step);
    const nCols = Math.max(1, Math.ceil(chars.length / colH));
    for (let i = 0; i < chars.length; i++) {
      const col = Math.floor(i / colH);
      const row = i % colH;
      const cx = o.x - (nCols - 1) * step * 0.55 + (nCols - 1 - col) * step * 0.92;
      const cy = o.y + row * step;
      ctx.fillText(chars[i], cx, cy);
    }
    ctx.restore();
    return nCols;
  };

  /* ===================== 9. 文字消光护罩 =====================
     在文字包围盒下垫一层柔和晕圈：亮字垫暗、暗字垫亮。
     只作用于局部椭圆，绝不整屏压暗。
     ------------------------------------------------------ */
  V4.halo = function (ctx, cx, cy, w, h, o) {
    o = o || {};
    const a = o.alpha ?? 0.6;
    if (a < 0.004 || w < 4 || h < 4) return;
    const dark = o.dark !== false;
    const rgb = dark ? '3,4,4' : '247,241,226';
    const rx = w * 0.5 + (o.pad ?? 26);
    const ry = h * 0.5 + (o.padY ?? 18);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(' + rgb + ',' + (a * 0.72).toFixed(3) + ')');
    g.addColorStop(0.86, 'rgba(' + rgb + ',' + (a * 0.20).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* ===================== 10. 干笔擦痕（通用肌理） ===================== */
  V4.dryWipe = function (ctx, x, y, w, h, o) {
    o = o || {};
    const a = o.alpha ?? 0.14;
    if (a < 0.004) return;
    const color = o.color || '26,19,9';
    const seed = o.seed ?? 13;
    const n = o.count ?? 40;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(' + color + ',' + a.toFixed(3) + ')';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass === 0 ? 1 : 0.55;
      ctx.lineWidth = pass === 0 ? 1.35 : 0.7;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = x + (hash(seed + pass * 5, i) - 0.5) * w;
        const py = y + (hash(seed + pass * 7, i) - 0.5) * h;
        const len = w * (0.04 + hash(seed + pass * 11, i) * 0.14);
        const ang = (hash(seed + pass * 13, i) - 0.5) * 0.5;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

})(window.DFS);
