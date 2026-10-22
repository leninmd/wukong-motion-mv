/* =========================================================================
   V4 / celestial-lattice.js — 「安得广厦千万间」（科技线框 → 毛笔界画）
   · 黄金分割螺旋排布（i × 137.5°）与透视投影全部保留
   · 但渲染方式改为**界画木构剪影**：台基 / 柱 / 反宇飞檐 / 鸱吻 / 斗拱
   · 每一座殿宇 = 一块实心墨形 + 三笔飞檐勾边 + 一点朱砂灯火
   · 越远越淡（大气透视），越近越焦墨 —— 连绵不绝，而不是 CAD 线框
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V3 = DFS.V3 || {};
  const V3 = DFS.V3;
  const V4 = DFS.V4;
  const { W, H, clamp, lerp, hash } = DFS;

  /* 兼容旧接口：单座殿宇的"界画" */
  V3.hallInk = function (ctx, o) {
    if (!V4 || !V4.hallSilhouette) return;
    V4.hallSilhouette(ctx, {
      x: o.x, y: o.y, w: o.w, h: o.h,
      a: o.a, color: o.color || '16,13,9',
      strokeColor: o.strokeColor || '8,7,4',
      seed: o.seed || 1,
      lamp: o.lamp !== false,
      lampX: o.lampX || 0
    });
  };

  V3.CelestialLattice = class CelestialLattice {
    constructor(o) {
      o = o || {};
      this.seed = o.seed || 2024;
      this.count = o.count || 46;
      this.spread = o.spread || 26;
      this.baseY = o.baseY === undefined ? 6.0 : o.baseY;
      this.build();
    }

    build() {
      const items = [];
      for (let i = 0; i < this.count; i++) {
        const ang = i * 2.399963;                 // 黄金角
        const r = this.spread * Math.sqrt(i / this.count);
        const ring = i / this.count;              // 0=中心 1=外圈
        items.push({
          x: Math.cos(ang) * r,
          z: Math.sin(ang) * r - 4,
          y: this.baseY + Math.pow(ring, 1.6) * 5.5 + hash(this.seed, i) * 0.8,
          scale: 2.6 + (1 - ring) * 4.4,
          ring,
          phase: hash(this.seed + 5, i),
          rot: ang,
          lamp: hash(this.seed + 11, i) > 0.30,
          lampX: hash(this.seed + 13, i) * 1.4 - 0.7
        });
      }
      this.items = items;
    }

    /**
     * @param progress 0→1 生长进度（按 ring 由内向外、由下向上逐座"筑"起）
     */
    draw(ctx, cam, t, o) {
      o = o || {};
      const progress = clamp(o.progress === undefined ? 1 : o.progress);
      const alpha = o.alpha === undefined ? 1 : o.alpha;
      const list = [];
      for (const it of this.items) {
        const grow = clamp((progress * 1.25 - it.ring * 0.9) / 0.35);
        if (grow <= 0.001) continue;
        const p = cam.project({ x: it.x, y: it.y, z: it.z });
        if (!p) continue;
        const w = p.px(it.scale);
        if (w < 4) continue;
        list.push({ it, p, w, grow });
      }
      list.sort((a, b) => b.p.z - a.p.z);
      // 先把"天光"铺在殿宇背後：否则纯黑剪影会沉进纯黑夜底，看不见广厦
      for (const item of list) {
        const it = item.it, p = item.p, w = item.w, grow = item.grow;
        if (w < 24) continue;
        const depthFade = clamp(1 - p.z / 70);
        const haloR = w * (0.95 + it.ring * 0.5);
        const hy = p.y - w * 0.42;
        const hg = ctx.createRadialGradient(p.x, hy, 0, p.x, hy, haloR);
        const ha = (0.055 + 0.055 * depthFade) * grow * alpha;
        hg.addColorStop(0, 'rgba(255,232,184,' + (ha * 1.25).toFixed(4) + ')');
        hg.addColorStop(0.5, 'rgba(240,198,132,' + (ha * 0.45).toFixed(4) + ')');
        hg.addColorStop(1, 'rgba(240,198,132,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(p.x - haloR, hy - haloR, haloR * 2, haloR * 2);
      }
      for (const item of list) {
        const it = item.it, p = item.p, w = item.w, grow = item.grow;
        const depthFade = clamp(1 - p.z / 70);
        const a = alpha * (0.22 + 0.78 * depthFade) * grow * (0.55 + 0.45 * (1 - it.ring));
        // 越远越淡（大气透视 → 山无脚的同一套逻辑）；但近处不能死在纯黑里
        const shade = Math.round(lerp(52, 22, depthFade));
        V3.hallInk(ctx, {
          x: p.x, y: p.y, w, h: w * 0.86, a,
          color: shade + ',' + Math.round(shade * 0.86) + ',' + Math.round(shade * 0.66),
          strokeColor: '246,226,186',
          seed: 101 + it.ring * 977,
          lamp: it.lamp && w > 40,
          lampX: it.lampX
        });
      }
      return list.length;
    }

    /** 檐下泄光：从檐口向下的极淡金色（已由 BUDGET 再打一次折） */
    lightShafts(ctx, cam, t, o) {
      o = o || {};
      const n = o.count || 10;
      const gain = (o.alpha === undefined ? 1 : o.alpha) * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const it = this.items[(i * 7) % this.items.length];
        const p = cam.project({ x: it.x, y: it.y, z: it.z });
        if (!p) continue;
        const w = p.px(it.scale) * 0.5;
        if (w < 14) continue;
        const g = ctx.createLinearGradient(p.x, p.y, p.x, H);
        const a = 0.045 * gain * clamp(1 - p.z / 70);
        g.addColorStop(0, 'rgba(255,222,150,' + a.toFixed(4) + ')');
        g.addColorStop(1, 'rgba(255,222,150,0)');
        ctx.fillStyle = g;
        const sway = Math.sin(t * 0.3 + i) * w * 0.06;
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.20, p.y);
        ctx.lineTo(p.x + w * 0.20, p.y);
        ctx.lineTo(p.x + w * 0.36 + sway, H);
        ctx.lineTo(p.x - w * 0.36 + sway, H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  };

  /* 兼容旧调用：V3.hallWire 仍可用，但已改为界画剪影 */
  V3.hallWire = function (ctx, o) {
    V3.hallInk(ctx, o);
  };

})(window.DFS);
