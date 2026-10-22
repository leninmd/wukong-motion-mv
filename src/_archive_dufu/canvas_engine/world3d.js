/* =========================================================================
   world3d.js — 极简确定性 3D：透视投影 / 活字方阵 / 点云群山
   全部由 (t, seed) 纯函数驱动，可乱序逐帧渲染。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease, rng, fbm } = DFS;
  const T = DFS.THEME;
  const FOV = 1.15;

  /* ---------------- 相机 ---------------- */
  DFS.Camera = class Camera {
    constructor(o = {}) {
      this.pos = o.pos || { x: 0, y: 2.2, z: 6 };
      this.yaw = o.yaw ?? 0;
      this.pitch = o.pitch ?? -0.06;
      this.fov = o.fov ?? FOV;
      this.cx = W / 2; this.cy = H * 0.52;
      this.f = (H / 2) / Math.tan(this.fov / 2);
    }
    project(p) {
      const dx = p.x - this.pos.x, dy = p.y - this.pos.y, dz = p.z - this.pos.z;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      let x = dx * cy - dz * sy;
      let z = dx * sy + dz * cy;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      let y = dy * cp - z * sp;
      z = dy * sp + z * cp;
      if (z <= 0.05) return null;
      const s = this.f / z;
      return {
        x: this.cx + x * s,
        y: this.cy - y * s,       // 世界 y 向上 → 屏幕 y 向下
        s,
        z,
        // 世界单位 → 屏幕像素比例
        px: (v) => v * s
      };
    }
  };

  /* ---------------- 活字方阵（Instanced blocks on a floor） ----------------
     参考片 4s/7s：方块立于地面上，向灭点密集退去，带透视雾。
     ------------------------------------------------------------------ */
  DFS.TypeField = class TypeField {
    constructor(o = {}) {
      this.seed = o.seed ?? 16350;
      this.rows = o.rows ?? 26;
      this.cols = o.cols ?? 26;
      this.spacing = o.spacing ?? 1.55;
      this.blockW = o.blockW ?? 1.15;
      this.blockH = o.blockH ?? 1.35;
      this.blockD = o.blockD ?? 0.16;
      this.text = o.text || '国破山河在城春草木深感时花溅泪恨别鸟惊心烽火连三月家书抵万金白头搔更短浑欲不胜簪';
      this.colors = o.colors || { face: '#100E08', side: '#1B1710', ink: 'rgba(233,222,199,0.92)' };
      this.gap = o.gap ?? 0;              // 中央走廊宽度（列）
      this.build();
    }
    build() {
      const r = rng(this.seed);
      const items = [];
      const halfC = (this.cols - 1) / 2;
      const halfR = (this.rows - 1) / 2;
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (this.gap > 0 && Math.abs(j - halfC) < this.gap) continue;
          const ch = this.text[Math.floor(r() * this.text.length)];
          items.push({
            x: (j - halfC) * this.spacing + (r() - 0.5) * 0.12,
            z: (i - halfR) * this.spacing + (r() - 0.5) * 0.12,
            rot: (r() - 0.5) * 0.06,
            yOff: r() * 0.02,
            ch,
            hgt: this.blockH * (0.92 + r() * 0.16),
            // 用于"坍塌/升起"动画的相位
            phase: r()
          });
        }
      }
      this.items = items;
    }
    draw(ctx, cam, t, opts = {}) {
      const { rise = 1, sink = 0, alphaMul = 1, fogNear = 5, fogFar = 42, tint = null, tintChat = null } = opts;
      const items = this.items;
      const proj = new Array(items.length);
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        // 升起/下落：按距离错峰（从地面以下升起到位）
        const rt = clamp(rise * 1.5 - it.phase * 0.5);
        const dy = -(1 - Ease.outExpo(rt)) * 2.6 - sink * (it.phase * 1.2 + 0.2);
        const p = cam.project({ x: it.x, y: dy, z: it.z });
        proj[k] = p ? { p, it } : null;
      }      // 远→近排序
      const vis = proj.filter(Boolean).sort((a, b) => b.p.z - a.p.z);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const { p, it } of vis) {
        const w = p.px(this.blockW);
        const h = p.px(it.hgt);
        if (w < 0.8) continue;
        const left = p.x - w / 2, top = p.y - h;
        if (left > W + 40 || left + w < -40 || top > H + 40 || top + h < -40) continue;
        const fog = clamp((p.z - fogNear) / (fogFar - fogNear));
        const a = (1 - fog * 0.92) * alphaMul;
        if (a < 0.02) continue;
        // 侧面厚度
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = this.colors.side;
        const d = w * this.blockD / this.blockW;
        ctx.beginPath();
        ctx.moveTo(left + w, top);
        ctx.lineTo(left + w + d, top + h * 0.06);
        ctx.lineTo(left + w + d, top + h + h * 0.06);
        ctx.lineTo(left + w, top + h);
        ctx.closePath();
        ctx.fill();
        // 正面
        ctx.globalAlpha = a;
        ctx.fillStyle = tint || this.colors.face;
        ctx.fillRect(left, top, w, h);
        // 字
        if (w > 3.2) {
          ctx.globalAlpha = a;
          ctx.fillStyle = tintChat || this.colors.ink;
          const fs = h * 0.62;
          ctx.font = DFS.font(fs, 500, T.fonts.serif);
          ctx.fillText(it.ch, left + w / 2, top + h * 0.52);
        }
      }
      ctx.restore();
    }

    /* ---- 平铺在地面的"活字版面"：四角投影 + 仿射贴字 ---- */
    drawFlat(ctx, cam, t, opts = {}) {
      const {
        alphaMul = 1, fogNear = 3, fogFar = 26, inkColor = 'rgba(20,16,9,0.86)',
        fade = 0, lift = 0, cellText = true
      } = opts;
      const items = this.items;
      const hw = this.blockW * 0.46, hd = this.spacing * 0.44;
      const list = [];
      for (const it of items) {
        const y = lift * (0.2 + it.phase * 0.5);
        const p0 = cam.project({ x: it.x - hw, y, z: it.z - hd });
        const p1 = cam.project({ x: it.x + hw, y, z: it.z - hd });
        const p2 = cam.project({ x: it.x + hw, y, z: it.z + hd });
        const p3 = cam.project({ x: it.x - hw, y, z: it.z + hd });
        if (!p0 || !p1 || !p2 || !p3) continue;
        if (p0.z > fogFar) continue;
        const minY = Math.min(p0.y, p1.y), maxY = Math.max(p2.y, p3.y);
        const minX = Math.min(p0.x, p3.x), maxX = Math.max(p1.x, p2.x);
        if (maxX < -60 || minX > W + 60 || maxY < -60 || minY > H + 60) continue;
        list.push({ it, p0, p1, p2, p3, z: (p0.z + p2.z) / 2 });
      }
      list.sort((a, b) => b.z - a.z);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const { it, p0, p1, p2, p3, z } of list) {
        const fog = clamp((z - fogNear) / (fogFar - fogNear));
        const a = Math.pow(1 - fog, 1.6) * alphaMul * (1 - fade);
        if (a < 0.02) continue;
        const ax = p1.x - p0.x, ay = p1.y - p0.y;
        const bx = p3.x - p0.x, by = p3.y - p0.y;
        const size = Math.hypot(ax, ay);
        ctx.save();
        ctx.globalAlpha = a * 0.9;
        ctx.setTransform(ax, ay, bx, by, p0.x, p0.y);
        ctx.fillStyle = 'rgba(28,22,12,0.06)';
        ctx.fillRect(0, 0, 1, 1);
        if (cellText && size > 3.2) {
          const det = ax * by - ay * bx;
          if (det < 0) {
            // 基底为负（贴字朝下）→ 在局部做一次 Y 翻转，避免字形镜像
            ctx.translate(0.5, 0.5);
            ctx.scale(1, -1);
            ctx.fillStyle = inkColor;
            ctx.font = DFS.font(0.82, 500, T.fonts.serif);
            ctx.fillText(it.ch, 0, 0.04);
          } else {
            ctx.fillStyle = inkColor;
            ctx.font = DFS.font(0.82, 500, T.fonts.serif);
            ctx.fillText(it.ch, 0.5, 0.54);
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }
  };

  /* ---------------- 皴法层峦（望岳） ----------------
     V4：3D 投影坐标计算全部保留，但废除"画散点（fillRect）"——
     山体内部改为干笔皴擦：从脊线向下，密度与墨色随坡度衰减，
     山脚自然消融在留白云气里（山无脚）。

     三层山脊体量 + 相机方位角旋转 → 视平面从多峰收束为孤峰。
     focus: 0 = 群峰并列，1 = 收束成孤峰
     ---------------------------------------------------- */
  DFS.RidgeCloud = class RidgeCloud {
    constructor(o) {
      o = o || {};
      this.seed = o.seed === undefined ? 7028 : o.seed;
      this.count = o.count || 12000;        // 兼容旧参数：现用于决定皴笔密度
      this.width = o.width || 34;
      this.depth = o.depth || 9;
      this.height = o.height || 7.0;
      this.build();
    }
    // 单条山脉的高度场（0..1）
    _ridge(x, layer) {
      const cfg = [
        { peaks: [[-11, 4.2, 1.0], [-2.5, 3.0, 0.82], [7, 4.6, 1.05], [15, 2.6, 0.6]], base: 0.12 },
        { peaks: [[-7, 5.0, 0.86], [3, 4.2, 1.0], [12, 3.2, 0.7]], base: 0.08 },
        { peaks: [[-1.5, 3.4, 1.0], [1.5, 2.2, 0.72]], base: 0.05 }
      ][layer];
      let h = cfg.base;
      for (let i = 0; i < cfg.peaks.length; i++) {
        const c = cfg.peaks[i];
        h += c[2] * Math.exp(-Math.pow((x - c[0]) / c[1], 2));
      }
      h += (DFS.fbm(x * 0.28 + layer * 7.3, layer * 3.1, 4) - 0.5) * 0.34;
      return Math.max(0.02, h);
    }
    build() {
      // 保留 pts 数组（外部有 .pts.length 的引用），但改为"脊线采样列"
      const pts = [];
      const N = 96;
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i <= N; i++) {
          const x = (i / N - 0.5) * this.width;
          pts.push({ x, layer, h: this._ridge(x, layer) });
        }
      }
      this.pts = pts;
      this.columns = N;
    }
    /**
     * 皴笔层：只画"肌理"，不画轮廓（轮廓由各分镜的实心山体负责）
     * opts: alpha / color / focus / ridgeFn / seed / dry / strokeScale
     */
    draw(ctx, cam, t, opts) {
      opts = opts || {};
      const V4 = DFS.V4;
      if (!V4 || !V4.cunStrokes) return;
      const alpha = opts.alpha === undefined ? 1 : opts.alpha;
      const color = opts.color || '26,19,9';
      const focus = opts.focus || 0;
      const squeeze = 1 - focus * 0.62;
      const ridgeFn = opts.ridgeFn || ((x, layer) => this._ridge(x, layer));
      const density = clamp(Math.round((this.count / 12000) * 96), 56, 132);

      ctx.save();
      for (let layer = 2; layer >= 0; layer--) {
        const zc = (layer - 1) * this.depth * 0.52 + focus * 2.2;
        const hMax = this.height * (0.62 + 0.19 * layer);
        const tops = [];
        for (let i = 0; i <= density; i++) {
          const xr = (i / density - 0.5) * this.width;
          const h = ridgeFn(xr, layer);
          const y = h * hMax * (1 + focus * (0.55 - Math.min(0.5, Math.abs(xr) / 16)));
          const x = xr * squeeze;
          const pt = cam.project({ x, y, z: zc });
          const pb = cam.project({ x, y: 0, z: zc });
          if (!pt || !pb) { tops.push(null); continue; }
          const hpx = pb.y - pt.y;
          tops.push({ x: pt.x, y: pt.y, h: Math.max(0, hpx) });
        }
        // 远山淡、近山浓（大气透视）
        const layerK = [0.50, 0.74, 1.0][layer];
        V4.cunStrokes(ctx, tops, {
          color,
          alpha: clamp(alpha * layerK * 0.95),
          seed: this.seed + layer * 131,
          dry: 0.55 + layer * 0.10
        });
      }
      ctx.restore();
    }
  };


  /* ---------------- 通用：3D 场景的雾 ---------------- */
  DFS.depthFog = function (ctx, cam, opts = {}) {
    const { color = '231,218,194', near = 6, far = 44 } = opts;
    // 简单的地平线雾带
    const g = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.72);
    g.addColorStop(0, `rgba(${color},0.92)`);
    g.addColorStop(0.55, `rgba(${color},0.55)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.30, W, H * 0.42);
  };

})(window.DFS);
