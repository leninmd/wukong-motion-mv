/* =========================================================================
   aesthetics-hub / remonster-physics.js  —  外挂模块 C
   源流：Monet-AI-Editor/Monet（Remotion + Matter.js + MCP）与 Remonster
         确定性物理预烘焙 & 基于短边的自适应排版
     · scaleByShortEdge(px, w, h)
     · measureFit(ctx, text, maxW, size, weight, family)   渲染前测量，杜绝溢出
     · H.PrebakedCollapse   离线跑完整条时间轴的刚体碰撞，逐帧只读查表
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.HUB = DFS.HUB || {};
  const H = DFS.HUB;
  const { W, H: HH, clamp } = DFS;

  /* ---------------- 短边自适应 ---------------- */
  H.scaleByShortEdge = (px, w = W, h = HH) => px * (Math.min(w, h) / 1080);

  /* ---------------- 文本宽度自检 ---------------- */
  H.measureFit = function (ctx, text, maxW, startSize, weight = 400, family) {
    family = family || DFS.THEME.fonts.serif;
    let size = startSize;
    for (let i = 0; i < 60; i++) {
      ctx.font = DFS.font(size, weight, family);
      if (ctx.measureText(text).width <= maxW) break;
      size *= 0.95;
    }
    return size;
  };

  /* ---------------- 预烘焙刚体坍塌 ----------------
     纯确定性：固定步长、无随机、无挂钟。
     一次 bake() 把整段动画算完，渲染时 O(1) 查表。
     --------------------------------------------------- */
  H.PrebakedCollapse = class PrebakedCollapse {
    constructor(o = {}) {
      this.gravity = o.gravity ?? 2600;      // px/s²
      this.floorY = o.floorY ?? 1040;
      this.restitution = o.restitution ?? 0.25;
      this.friction = o.friction ?? 0.65;
      this.wallL = o.wallL ?? 40;
      this.wallR = o.wallR ?? W - 40;
      this.dt = o.dt ?? 1 / 60;              // 物理步长；bake 时按 fps 累积
      this.bodies = [];
      this.table = null;
    }

    /** 添加一个字块（初始为静态，等到 releaseFrame 才解除锁定） */
    add(o) {
      this.bodies.push({
        id: this.bodies.length,
        char: o.char,
        x: o.x, y: o.y,
        w: o.w, h: o.h,
        fontSize: o.fontSize ?? o.h * 1.05,
        weight: o.weight ?? 700,
        family: o.family,
        color: o.color || 'rgba(236,232,220,0.92)',
        angle: o.angle ?? 0,
        vx: (o.vx ?? 0), vy: (o.vy ?? 0), av: (o.av ?? 0),
        releaseFrame: o.releaseFrame ?? 0,
        restitution: o.restitution ?? this.restitution,
        isStatic: true,
        asleep: false
      });
      return this;
    }

    /** 预烘焙 frames 帧（fps 默认 60） */
    bake(frames, fps = 60) {
      const dt = 1 / fps;
      const n = this.bodies.length;
      const table = new Array(frames);
      const st = this.bodies.map((b) => ({
        x: b.x, y: b.y, angle: b.angle, vx: 0, vy: 0, av: 0,
        w: b.w, h: b.h, static: true, asleep: false
      }));

      for (let f = 0; f < frames; f++) {
        // 解除静态
        for (let i = 0; i < n; i++) {
          if (this.bodies[i].releaseFrame <= f && st[i].static) {
            st[i].static = false;
            st[i].vy = this.bodies[i].vy;
            st[i].vx = this.bodies[i].vx;
            st[i].av = this.bodies[i].av;
          }
        }
        // 积分
        for (let i = 0; i < n; i++) {
          const b = st[i];
          if (b.static || b.asleep) continue;
          b.vy += this.gravity * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.angle += b.av * dt;
          b.vx *= 0.999;
          b.av *= 0.995;
        }
        // 地面与侧墙
        for (let i = 0; i < n; i++) {
          const b = st[i];
          if (b.static) continue;
          const halfH = b.h / 2, halfW = b.w / 2;
          if (b.y + halfH > this.floorY) {
            b.y = this.floorY - halfH;
            if (b.vy > 0) {
              b.vy = -b.vy * this.bodies[i].restitution;
              if (Math.abs(b.vy) < 60) b.vy = 0;
            }
            b.vx *= this.friction;
            b.av *= 0.72;
            if (Math.abs(b.vx) < 4) b.vx = 0;
          }
          if (b.x - halfW < this.wallL) { b.x = this.wallL + halfW; b.vx = Math.abs(b.vx) * 0.35; }
          if (b.x + halfW > this.wallR) { b.x = this.wallR - halfW; b.vx = -Math.abs(b.vx) * 0.35; }
          if (Math.abs(b.vx) + Math.abs(b.vy) < 8 && b.y + halfH > this.floorY - 2) b.asleep = true;
        }
        // 两两碰撞（AABB + 最小穿透轴分离 + 冲量）
        for (let a = 0; a < n; a++) {
          const A = st[a];
          if (A.static) continue;
          for (let c = a + 1; c < n; c++) {
            const B = st[c];
            if (B.static) continue;
            const dx = B.x - A.x, dy = B.y - A.y;
            const ox = (A.w + B.w) / 2 - Math.abs(dx);
            const oy = (A.h + B.h) / 2 - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            if (ox < oy) {
              const dir = dx < 0 ? -1 : 1;
              const push = ox * 0.55;
              A.x -= dir * push; B.x += dir * push;
              const rel = B.vx - A.vx;
              const imp = -rel * 0.5 * (1 + this.restitution);
              A.vx -= imp; B.vx += imp;
              A.av += dir * 0.6; B.av -= dir * 0.6;
            } else {
              const dir = dy < 0 ? -1 : 1;
              const push = oy * 0.55;
              A.y -= dir * push; B.y += dir * push;
              const rel = B.vy - A.vy;
              if (rel < 0) {
                const imp = -rel * 0.5 * (1 + this.restitution);
                A.vy -= imp; B.vy += imp;
                A.vx *= 0.92; B.vx *= 0.92;
              }
            }
            A.asleep = false; B.asleep = false;
          }
        }
        // 记录
        const snap = new Array(n);
        for (let i = 0; i < n; i++) {
          snap[i] = { x: st[i].x, y: st[i].y, angle: st[i].angle };
        }
        table[f] = snap;
      }
      this.table = table;
      this.frames = frames;
      return this;
    }

    /** 渲染：frame 为全局帧号，offsetFrame 为分镜起点帧 */
    draw(ctx, frame, offsetFrame = 0, o = {}) {
      if (!this.table) return;
      const f = clamp(Math.round(frame - offsetFrame), 0, this.table.length - 1);
      const snap = this.table[f];
      const alpha = o.alpha ?? 1;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < this.bodies.length; i++) {
        const b = this.bodies[i];
        const s = snap[i];
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.globalAlpha = alpha * (o.perAlpha ? o.perAlpha(i) : 1);
        ctx.font = DFS.font(b.fontSize, b.weight, b.family || DFS.THEME.fonts.serif);
        ctx.fillStyle = b.color;
        ctx.fillText(b.char, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    /** 某帧的包围盒（QA 用：检查底部是否有堆叠） */
    bboxAt(frame) {
      if (!this.table) return null;
      const snap = this.table[clamp(Math.round(frame), 0, this.table.length - 1)];
      let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
      snap.forEach((s, i) => {
        const b = this.bodies[i];
        top = Math.min(top, s.y - b.h / 2);
        bottom = Math.max(bottom, s.y + b.h / 2);
        left = Math.min(left, s.x - b.w / 2);
        right = Math.max(right, s.x + b.w / 2);
      });
      return { top, bottom, left, right };
    }
  };

})(window.DFS);
