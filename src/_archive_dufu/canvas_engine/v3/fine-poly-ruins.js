/* =========================================================================
   V4 / fine-poly-ruins.js — 金石断碑（多边形网格 → 传世碑拓）
   · 碑体 = 扑墨黑 + 石花崩茬白边（高频噪声凿出的凿口）
   · 碑文 = 阴刻白文（阳底阴字，字口带石刻崩茬）
   · 崩裂 = 石屑与墨块，带飞白尾迹，不再是规则多边形
   物理仍用 HUB.PrebakedCollapse 预烘焙（确定性、可乱序渲染）。
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V3 = DFS.V3 || {};
  const V3 = DFS.V3;
  const V4 = DFS.V4;
  const { W, H, clamp, rng, hash } = DFS;

  V3.FinePolyRuins = class FinePolyRuins {
    constructor(o) {
      o = o || {};
      this.seed = o.seed || 9091;
      this.floorY = o.floorY || 1052;
      this.items = [];
      this.sim = new DFS.HUB.PrebakedCollapse({
        gravity: o.gravity || 3400,
        floorY: this.floorY,
        restitution: 0.10,
        friction: 0.86
      });
    }

    /** 加一块碑：text 竖排刻字，w/h 为碰撞盒 */
    add(o) {
      const r = rng(this.seed + this.items.length * 31);
      // 沿矩形周界取点：碑是"板"，不是"卵石"；边缘带崩口
      const pts = [];
      const perim = [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]];
      const per = 6 + Math.floor(r() * 3);
      for (let i = 0; i < 4; i++) {
        const e = perim[i];
        for (let k = 0; k < per; k++) {
          const u = (k + 0.15 + r() * 0.7) / per;
          const nx = e[0] + (e[2] - e[0]) * u;
          const ny = e[1] + (e[3] - e[1]) * u;
          // 崩口：沿法线内外凿出 2%~9% 的缺口（碑拓的不规则边缘）
          const jitter = (r() - 0.5) * 0.15;
          pts.push([nx + jitter, ny + (r() - 0.5) * 0.15]);
        }
      }
      const item = {
        id: this.items.length,
        text: o.text || '',
        x: o.x, y: o.y, w: o.w, h: o.h,
        fontSize: o.fontSize || 30,
        pts,
        releaseFrame: o.releaseFrame || 0,
        seed: this.seed + this.items.length * 137
      };
      this.items.push(item);
      this.sim.add({
        char: '', x: o.x, y: o.y, w: o.w, h: o.h, fontSize: 1,
        releaseFrame: item.releaseFrame,
        vx: o.vx || 0, vy: o.vy || 0, av: o.av || 0
      });
      return this;
    }

    bake(frames, fps) {
      this.sim.bake(frames, fps || 60);
      // 碑是"立"的：把落地后的残余旋转压掉，保证碑文可读
      this.sim.table.forEach((snap) => snap.forEach((st) => { st.angle *= 0.10; }));
      this.releaseFrames = this.items.map((it) => it.releaseFrame);
      return this;
    }

    /* 崩裂石屑：带飞白尾迹的石粉与墨块 */
    _shards(ctx, it, snap, f) {
      const since = f - it.releaseFrame;
      if (since < 0 || since > 44) return;
      const p = clamp(since / 44);
      const e = DFS.Ease.outExpo(clamp(p * 1.6));
      const fade = 1 - Math.pow(p, 1.7);
      if (fade < 0.02) return;
      const r = rng(it.seed);
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const a0 = r() * Math.PI * 2;
        const spd = 90 + r() * 520;
        const life = 0.35 + r() * 0.65;
        const tt = clamp(since / 60 / life);
        if (tt > 1) continue;
        const px = it.x + Math.cos(a0) * spd * e * life;
        const py = it.y + Math.sin(a0) * spd * e * life * 0.7 + 620 * e * e * life;
        const alpha = fade * (0.16 + r() * 0.5);
        const sz = 0.8 + r() * 3.0;
        // 飞白尾迹
        const tx = px - Math.cos(a0) * (14 + r() * 44) * e;
        const ty = py - Math.sin(a0) * (10 + r() * 30) * e;
        ctx.strokeStyle = 'rgba(198,192,174,' + (alpha * 0.30).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.4, sz * 0.55);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();
        // 石屑本体
        ctx.fillStyle = 'rgba(214,208,190,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    draw(ctx, frame, offsetFrame, o) {
      o = o || {};
      const f = clamp(Math.round(frame - (offsetFrame || 0)), 0, this.sim.table.length - 1);
      const snap = this.sim.table[f];
      ctx.save();
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const s = snap[i];
        if (!s) continue;
        const w = it.w, h = it.h;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);

        // 地面阴影（越接近地面越实）
        const near = clamp((s.y - 300) / 700);
        ctx.save();
        ctx.globalAlpha = 0.26 * near;
        const sg = ctx.createRadialGradient(0, h * 0.5 + 10, 2, 0, h * 0.5 + 10, w * 0.80);
        sg.addColorStop(0, 'rgba(0,0,0,0.72)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.ellipse(0, h * 0.5 + 10, w * 0.80, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ——— 碑体：金石碑拓 ———
        if (V4 && V4.rubbingStele) {
          V4.rubbingStele(ctx, {
            w, h, pts: it.pts, text: it.text, fontSize: it.fontSize,
            alpha: o.alpha === undefined ? 1 : o.alpha, seed: it.seed
          });
        }
        ctx.restore();

        // ——— 崩裂石屑 ———
        this._shards(ctx, it, s, f);
      }
      ctx.restore();
    }
  };

  /* ---------------- 微尘气溶胶（V4 大幅收敛，默认 48 粒） ----------------
     注意：eight-layer 会在排版之前调用它，故它永远不会盖在文字上。
     ---------------------------------------------------------------- */
  V3.aerosol = function (ctx, t, o) {
    o = o || {};
    const n = o.count || 48;
    const color = o.color || '226,198,138';
    const alpha = o.alpha || 0.5;
    const seed = o.seed || 4211;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const r1 = hash(seed, i * 5 + 1);
      const r2 = hash(seed, i * 5 + 2);
      const r3 = hash(seed, i * 5 + 3);
      const r4 = hash(seed, i * 5 + 4);
      const x = ((r1 + Math.sin(t * (0.05 + r4 * 0.08) + i) * 0.02
        + Math.sin(t * 0.017 + i * 2.3) * 0.03) % 1 + 1) % 1 * W;
      const y = ((r2 - t * (0.004 + r3 * 0.010) + Math.sin(t * 0.09 + i * 1.7) * 0.012) % 1 + 1) % 1 * H;
      const sz = 0.7 + r3 * 1.9;
      const a = alpha * (0.22 + r4 * 0.7) * (0.6 + 0.4 * Math.sin(t * 0.7 + i));
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 3.0);
      g.addColorStop(0, 'rgba(' + color + ',1)');
      g.addColorStop(0.35, 'rgba(' + color + ',0.32)');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, sz * 3.0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

})(window.DFS);
