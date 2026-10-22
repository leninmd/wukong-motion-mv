/* =========================================================================
   s06_timeline.js — 68.1–82.3s（L 0–14.2s）平野星垂 · 沙鸥 · 空
   L 0.00–0.90  峡江瞬息归于死寂平湖：巨浪高度衰减到 0，画面压暗成墨玉色
   L 1.90–7.90  夜：上半屏深空星斗倒悬（260 颗）＋江心一轮倒映的孤月（压扁的倒影 +
                竖向碎光柱）；72.0s 起 160 颗冷白微粒自小舟尾部振翅掠起（翼形 +
                正弦扑动），0.8 景深划过平野直入孤月，75.2s 散成 40 点星屑
   L 7.90–14.2  静帧 Hold：一江、一月、一舟（鸟已入月）；竖排两句 ＋ 朱砂一句
   屏幕文字全部取自 storyboard.v3.json 的 texts（原典），无一字杜撰。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease, hash } = DFS;
  const V3 = DFS.V3;
  const HUB = DFS.HUB;
  const T = DFS.THEME;

  const CX = 960;
  const HZ0 = H * 0.545;            // 起：峡江水面
  const HZ1 = H * 0.500;            // 落：平野
  const MY = H * 0.620;             // 江心孤月（倒影心）
  const MR = 70;                    // 半径
  const BOAT = { x: 660, y: H * 0.80, s: 0.5 };
  const BIRD_S = 0.8 * 0.72;        // 0.8 景深
  const FLAP = 6 / BIRD_S;          // 屏上 ±6px
  const T_FLY = 3.90, T_HIT = 7.10;
  const T_A = 5.40, T_B = 6.20, T_NOTE = 7.20;
  const JADE = [11, 14, 12];        // #0B0E0C
  const INK = '#F4EFE6';

  let MEAS = null;
  const meas = () => (MEAS || (MEAS = DFS.mkCanvas(8, 8).getContext('2d')));
  const mix = (a, b, p) => `${Math.round(lerp(a[0], b[0], p))},${Math.round(lerp(a[1], b[1], p))},${Math.round(lerp(a[2], b[2], p))}`;
  const bez2 = (p0, p1, p2, u) => {
    const v = 1 - u;
    return {
      x: v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x,
      y: v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y
    };
  };

  // 峡江两壁（起手一瞬的残形，随即被死寂吞掉）
  const CLIFF_L = [[-60, 1080], [-60, 196], [58, 210], [196, 206], [344, 204], [486, 210],
    [566, 246], [548, 352], [558, 470], [536, 590], [546, 712], [520, 842], [532, 964], [508, 1080]];
  const CLIFF_R = [[1980, 1080], [1980, 214], [1852, 226], [1712, 222], [1568, 220], [1430, 226],
    [1352, 262], [1372, 368], [1358, 486], [1382, 602], [1360, 724], [1388, 848], [1364, 972], [1390, 1080]];

  DFS.sceneRegistry['s06'] = class Scene06V3 {
    constructor() {
      const r = DFS.rng(5511);
      // 星斗 260（亮度按 hash 抖动）
      this.stars = Array.from({ length: 260 }, (_, i) => ({
        x: 24 + r() * (W - 48),
        y: 26 + Math.pow(r(), 0.86) * (HZ1 - 60),
        s: 1 + Math.round(hash(3313, i * 3 + 1)) * 1,
        a: 0.16 + Math.pow(hash(3313, i * 3 + 2), 1.6) * 0.80,
        ph: r() * 6.283,
        sp: 0.5 + r() * 1.5
      }));
      // 倒悬：水里的星（压得很淡）
      this.wStars = Array.from({ length: 100 }, () => ({
        x: r() * W,
        y: HZ1 + 26 + Math.pow(r(), 1.5) * (H * 0.96 - HZ1 - 26),
        s: 1 + (r() > 0.6 ? 1 : 0),
        a: 0.06 + r() * 0.20,
        ph: r() * 6.283
      }));
      this.gull = this._buildGull();
      this.crumbs = Array.from({ length: 40 }, (_, i) => ({
        a: hash(9203, i * 4 + 1) * 6.283,
        d: 16 + hash(9203, i * 4 + 2) * 96,
        s: 0.9 + hash(9203, i * 4 + 3) * 1.7,
        br: 0.35 + hash(9203, i * 4 + 4) * 0.65
      }));
    }

    /* ================= 160 颗冷白微粒：双翼 + 身体 + 头尾 ================= */
    _buildGull() {
      const rnd = DFS.rng(6613);
      const pts = [];
      this.wingPoly = {};
      for (const sgn of [-1, 1]) {
        const k = sgn > 0 ? 1 : 0.8;             // 远翼 0.8 透视
        const up = [{ x: 4 * sgn * k, y: -4 }, { x: 60 * sgn * k, y: -70 }, { x: 158 * sgn * k, y: -92 }];
        const lo = [{ x: -2 * sgn * k, y: 24 }, { x: 56 * sgn * k, y: 14 }, { x: 144 * sgn * k, y: -58 }];
        for (let i = 0; i < 56; i++) {
          const u = clamp((i + 0.5 + (rnd() - 0.5) * 0.8) / 56);
          const edge = (i % 9) < 3;
          const v = edge ? (rnd() < 0.5 ? 0.02 + rnd() * 0.10 : 0.86 + rnd() * 0.12) : 0.05 + rnd() * 0.9;
          const a1 = bez2(up[0], up[1], up[2], u);
          const b1 = bez2(lo[0], lo[1], lo[2], u);
          pts.push({
            wing: sgn, u,
            x: lerp(b1.x, a1.x, v),
            y: lerp(b1.y, a1.y, v) + Math.sin(Math.PI * u) * 4,
            s: 0.9 + rnd() * 1.5, ph: rnd() * 6.283, br: 0.42 + 0.58 * v
          });
        }
        const poly = [];
        for (let i = 0; i <= 13; i++) poly.push(bez2(up[0], up[1], up[2], i / 13));
        for (let i = 13; i >= 0; i--) poly.push(bez2(lo[0], lo[1], lo[2], i / 13));
        this.wingPoly[sgn] = poly;
      }
      // 身 30
      for (let i = 0; i < 30; i++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd());
        pts.push({
          wing: 0, u: 0, x: -4 + Math.cos(a) * 32 * d, y: Math.sin(a) * 11 * d,
          s: 1.0 + rnd() * 1.3, ph: rnd() * 6.283, br: 0.82 + rnd() * 0.18
        });
      }
      // 头 10
      for (let i = 0; i < 10; i++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd());
        pts.push({
          wing: 0, u: 0, x: 38 + Math.cos(a) * 9 * d, y: -7 + Math.sin(a) * 6 * d,
          s: 1.1 + rnd() * 1.2, ph: rnd() * 6.283, br: 1
        });
      }
      // 尾 8
      for (let i = 0; i < 8; i++) {
        pts.push({
          wing: 0, u: 0, x: -38 - rnd() * 20, y: -3 + rnd() * 13,
          s: 0.9 + rnd() * 0.9, ph: rnd() * 6.283, br: 0.45 + rnd() * 0.3
        });
      }
      return pts;
    }

    /* ================= 起手：峡江残形 + 巨浪 ================= */
    _morphAssets(c, L, ez, HZ) {
      const fade = 1 - ez;
      if (fade > 0.01) {
        c.save();
        c.globalAlpha = fade;
        const shift = 130 * ez;
        c.translate(-shift, 0);
        c.beginPath();
        c.moveTo(CLIFF_L[0][0], CLIFF_L[0][1]);
        for (let i = 1; i < CLIFF_L.length; i++) c.lineTo(CLIFF_L[i][0], CLIFF_L[i][1]);
        c.closePath();
        c.fillStyle = '#030406';
        c.fill();
        c.restore();
        c.save();
        c.globalAlpha = fade;
        c.translate(shift, 0);
        c.beginPath();
        c.moveTo(CLIFF_R[0][0], CLIFF_R[0][1]);
        for (let i = 1; i < CLIFF_R.length; i++) c.lineTo(CLIFF_R[i][0], CLIFF_R[i][1]);
        c.closePath();
        c.fillStyle = '#030406';
        c.fill();
        c.restore();
      }
      // 巨浪：高度衰减到 0
      if (fade > 0.01) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const y0 = HZ + 26 + i * 62;
          const amp = (24 - i * 5) * fade;
          const phase = L * (1.1 + i * 0.4) + i * 1.7;
          c.globalAlpha = fade * (0.16 - i * 0.028);
          c.strokeStyle = 'rgba(214,224,216,1)';
          c.lineWidth = 1.4 + i * 0.9;
          c.beginPath();
          for (let x = -20; x <= W + 20; x += 26) {
            const yy = y0 + Math.sin(x * 0.0056 + phase) * amp + Math.sin(x * 0.013 - phase * 1.4) * amp * 0.4;
            if (x === -20) c.moveTo(x, yy); else c.lineTo(x, yy);
          }
          c.stroke();
        }
        c.restore();
      }
    }

    /* ================= 平野 + 水 ================= */
    _land(c, HZ) {
      // 远处平野：一条极低的暗带
      const g = c.createLinearGradient(0, HZ - 34, 0, HZ + 6);
      g.addColorStop(0, 'rgba(6,8,8,0)');
      g.addColorStop(0.6, 'rgba(5,7,7,0.72)');
      g.addColorStop(1, 'rgba(5,7,7,0.92)');
      c.fillStyle = g;
      c.fillRect(0, HZ - 34, W, 40);
      // 地平线上的一线冷雾
      const hg = c.createLinearGradient(0, HZ - 90, 0, HZ + 40);
      hg.addColorStop(0, 'rgba(178,196,198,0)');
      hg.addColorStop(0.58, 'rgba(178,196,198,0.075)');
      hg.addColorStop(1, 'rgba(178,196,198,0)');
      c.fillStyle = hg;
      c.fillRect(0, HZ - 90, W, 130);
    }

    _water(c, tw, HZ, amp, ez) {
      HUB.waterMoonShader(c, W, H, tw, {
        horizon: HZ, moonX: CX, moonY: MY, moon: false,
        base: mix([9, 12, 11], JADE, ez),
        top: mix([17, 21, 18], [14, 18, 16], ez),
        glint: '206,218,222',
        rows: 52, seed: 8901, moonGain: 0.8, amp
      });
    }

    /* ================= 星（深空 + 倒悬） ================= */
    _stars(c, t, sa) {
      if (sa <= 0.01) return;
      c.save();
      for (const s of this.stars) {
        const a = sa * s.a * (0.62 + 0.38 * Math.sin(t * s.sp * 2.2 + s.ph));
        if (a <= 0.012) continue;
        c.globalAlpha = a;
        c.fillStyle = 'rgba(232,240,242,1)';
        c.fillRect(s.x, s.y, s.s, s.s);
        if (s.s > 1.4) {
          c.globalAlpha = a * 0.22;
          c.fillRect(s.x - 2, s.y + 0.5, 5, 0.8);
          c.fillRect(s.x + 0.5, s.y - 2, 0.8, 5);
        }
      }
      // 水里的星（倒悬）
      c.globalAlpha = 1;
      for (const s of this.wStars) {
        const a = sa * s.a * (0.55 + 0.45 * Math.sin(t * 1.1 + s.ph));
        if (a <= 0.012) continue;
        c.globalAlpha = a;
        c.fillStyle = 'rgba(206,220,224,1)';
        c.fillRect(s.x, s.y, s.s, Math.max(0.8, s.s * 0.6));
      }
      c.restore();
    }

    /* ================= 江心孤月（倒影） ================= */
    _moon(c, t, L) {
      const pin = clamp((L - 1.90) / 1.30);
      if (pin <= 0.01) return;
      const e = Ease.outCubic(pin);
      const rise = (1 - e) * 18;
      const my = MY + rise;
      const br = 0.94 + 0.06 * Math.sin(t * 0.85);
      c.save();
      c.globalCompositeOperation = 'lighter';

      // 水面上方的天光回照
      const spill = c.createRadialGradient(CX, my - 40, 10, CX, my - 40, 420);
      spill.addColorStop(0, `rgba(196,212,220,${0.10 * e})`);
      spill.addColorStop(1, 'rgba(196,212,220,0)');
      c.fillStyle = spill;
      c.fillRect(CX - 420, my - 460, 840, 840);

      // 大光晕
      const hg = c.createRadialGradient(CX, my, MR * 0.35, CX, my, MR * 4.4);
      hg.addColorStop(0, `rgba(236,246,248,${0.34 * e * br})`);
      hg.addColorStop(0.30, `rgba(214,230,236,${0.13 * e * br})`);
      hg.addColorStop(1, 'rgba(206,222,230,0)');
      c.save();
      c.translate(CX, my);
      c.scale(1, 0.62);
      c.fillStyle = hg;
      c.fillRect(-MR * 4.4, -MR * 4.4, MR * 8.8, MR * 8.8);
      c.restore();

      // 压扁的倒影
      c.save();
      c.translate(CX, my);
      c.scale(1, 0.42);
      const g = c.createRadialGradient(-MR * 0.18, -MR * 0.22, MR * 0.08, 0, 0, MR);
      g.addColorStop(0, `rgba(255,255,252,${0.96 * e})`);
      g.addColorStop(0.52, `rgba(242,248,250,${0.92 * e})`);
      g.addColorStop(0.84, `rgba(214,230,238,${0.58 * e})`);
      g.addColorStop(1, 'rgba(198,216,228,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, MR, 0, 6.28318);
      c.fill();
      // 月面的暗斑（不让它变成一块白饼）
      const mr = DFS.rng(4477);
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 9; i++) {
        const a2 = mr() * 6.283, d2 = Math.sqrt(mr()) * MR * 0.78;
        c.globalAlpha = e * (0.10 + mr() * 0.14);
        c.fillStyle = 'rgba(150,170,182,1)';
        c.beginPath();
        c.ellipse(Math.cos(a2) * d2, Math.sin(a2) * d2, MR * (0.10 + mr() * 0.20), MR * (0.08 + mr() * 0.14), 0, 0, 6.28318);
        c.fill();
      }
      c.restore();

      // 竖向碎光柱
      const rr = DFS.rng(9021);
      for (let i = 0; i < 54; i++) {
        const k = i / 54;
        const y = my + 10 + Math.pow(k, 1.12) * (H - my - 18);
        const w = (8 + 112 * k) * (0.35 + rr() * 0.95);
        const jx = Math.sin(t * 0.55 + i * 0.9) * (1.2 + k * 12);
        const a = e * (0.10 + rr() * 0.24) * (1 - k * 0.46) * br;
        if (a <= 0.004) continue;
        const lg = c.createLinearGradient(CX - w / 2 + jx, 0, CX + w / 2 + jx, 0);
        lg.addColorStop(0, 'rgba(232,242,246,0)');
        lg.addColorStop(0.5, `rgba(244,250,252,${a})`);
        lg.addColorStop(1, 'rgba(232,242,246,0)');
        c.fillStyle = lg;
        c.fillRect(CX - w / 2 + jx, y, w, 1.4 + k * 3.0);
      }
      c.restore();
    }

    /* 水面把倒影切断的暗纹（让月亮"在水里"） */
    _moonTear(c, t, L, HZ) {
      const pin = clamp((L - 1.90) / 1.30);
      if (pin <= 0.01) return;
      const my = MY + (1 - Ease.outCubic(pin)) * 18;
      c.save();
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const y = my - MR * 0.16 + u * (MR * 0.62);
        const w = MR * (1.7 - Math.abs(u - 0.5) * 0.9);
        const jx = Math.sin(t * 0.7 + i * 1.3) * 7;
        c.globalAlpha = 0.16 + Math.abs(u - 0.5) * 0.34;
        c.fillStyle = 'rgba(9,13,12,1)';
        c.fillRect(CX - w / 2 + jx, y, w, 1.8 + (i % 2) * 1.4);
      }
      // 光柱根部的两刀
      for (let i = 0; i < 2; i++) {
        const y = my + MR * 0.46 + i * (16 + i * 10);
        c.globalAlpha = 0.22;
        c.fillStyle = 'rgba(9,13,12,1)';
        c.fillRect(CX - MR * 0.7, y, MR * 1.4, 2.6);
      }
      c.restore();
    }

    /* ================= 舟 ================= */
    _boat(c, tw, L) {
      const a = clamp((L - 1.5) / 1.2);
      if (a <= 0.01) return;
      const bx = BOAT.x + Math.sin(tw * 0.42) * 3.0;
      const by = BOAT.y + Math.sin(tw * 0.9) * 1.6;
      c.save();
      c.globalAlpha = a;
      // 舟下的暗
      const dg = c.createRadialGradient(bx, by + 6, 3, bx, by + 6, 130);
      dg.addColorStop(0, 'rgba(4,6,6,0.62)');
      dg.addColorStop(1, 'rgba(4,6,6,0)');
      c.fillStyle = dg;
      c.beginPath();
      c.ellipse(bx, by + 10, 132, 26, 0, 0, 6.28318);
      c.fill();
      DFS.boat(c, bx - 2, by - 2, BOAT.s, {
        color: '150,170,176', alpha: 0.30 * a, t: tw, figure: true, figureColor: '160,178,184'
      });
      DFS.boat(c, bx, by, BOAT.s, {
        color: '4,5,6', alpha: 0.97 * a, t: tw, figure: true, figureColor: '3,4,5'
      });
      // 船头一点暖灯（与上一场同一盏，远得只剩一点）
      const bob = Math.sin(tw * 1.5) * 1.6;
      const lx = bx + 70 * BOAT.s;
      const ly = by + (-8 + bob) * BOAT.s;
      c.globalCompositeOperation = 'lighter';
      const hg = c.createRadialGradient(lx, ly, 0, lx, ly, 9);
      hg.addColorStop(0, `rgba(255,214,150,${0.42 * a})`);
      hg.addColorStop(1, 'rgba(255,196,120,0)');
      c.fillStyle = hg;
      c.beginPath();
      c.arc(lx, ly, 9, 0, 6.28318);
      c.fill();
      c.fillStyle = `rgba(255,236,196,${0.9 * a})`;
      c.beginPath();
      c.arc(lx, ly, 1.3, 0, 6.28318);
      c.fill();
      c.restore();
    }

    /* ================= 160 微粒沙鸥 ================= */
    _gullPath(u) {
      const P0 = { x: 700, y: 796 }, P1 = { x: 806, y: 596 }, P2 = { x: CX - 2, y: MY + 4 };
      return bez2(P0, P1, P2, u);
    }

    _drawGull(c, L, t) {
      const p = clamp((L - T_FLY) / (T_HIT - T_FLY));
      if (p <= 0.001) return;
      const u = Ease.inOutCubic(p);
      const pos = this._gullPath(u);
      const nxt = this._gullPath(Math.min(1, u + 0.02));
      const rot = Math.atan2(nxt.y - pos.y, nxt.x - pos.x) * 0.45 - 0.10;
      const flap = Math.sin(t * 7.0);
      const sIn = clamp(p * 4.2);
      const sOut = 1 - clamp((u - 0.780) / 0.105);
      const fade = sIn * sOut;
      if (fade <= 0.01) return;

      // 尾迹（只取已经飞过的部分，避免贝塞尔外推出画面）
      c.save();
      c.globalCompositeOperation = 'lighter';
      const trailK = clamp(u * 9);
      for (let k = 1; k < 20; k++) {
        const uq = u - k * 0.011;
        if (uq <= 0) break;
        const q = this._gullPath(uq);
        const al = Math.pow(1 - k / 20, 2.2) * 0.22 * fade * trailK;
        if (al <= 0.008) continue;
        c.globalAlpha = al;
        c.fillStyle = 'rgba(214,232,240,1)';
        c.beginPath();
        c.arc(q.x, q.y, 1.5 * (1 - k / 20) + 0.4, 0, 6.28318);
        c.fill();
      }
      c.restore();

      c.save();
      c.translate(pos.x, pos.y);
      c.rotate(rot);
      c.scale(BIRD_S, BIRD_S);

      // 翼膜（极淡的衬底，让剪影成立）
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = fade * 0.62;
      c.fillStyle = 'rgba(196,220,236,0.10)';
      for (const key of [-1, 1]) {
        const poly = this.wingPoly[key];
        c.beginPath();
        c.moveTo(poly[0].x, poly[0].y + flap * FLAP * 0.10);
        for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y + flap * FLAP * 0.10);
        c.closePath();
        c.fill();
      }
      c.beginPath();
      c.ellipse(-4, 1, 34, 12, 0, 0, 6.28318);
      c.fill();
      // 翼前缘的一线亮（把翼形勾出来）
      c.globalAlpha = fade * 0.42;
      c.strokeStyle = 'rgba(226,242,250,1)';
      c.lineWidth = 1.6;
      c.lineJoin = 'round';
      for (const key of [-1, 1]) {
        const poly = this.wingPoly[key];
        c.beginPath();
        c.moveTo(poly[0].x, poly[0].y + flap * FLAP * 0.10);
        for (let i = 1; i <= 13; i++) c.lineTo(poly[i].x, poly[i].y + flap * FLAP * 0.10);
        c.stroke();
      }
      const bg = c.createRadialGradient(0, 0, 2, 0, 0, 54);
      bg.addColorStop(0, 'rgba(226,240,248,0.26)');
      bg.addColorStop(1, 'rgba(226,240,248,0)');
      c.fillStyle = bg;
      c.beginPath();
      c.arc(0, 0, 54, 0, 6.28318);
      c.fill();

      // 160 颗冷白微粒（双翼正弦扑动 ±6px）
      for (const pt of this.gull) {
        let px = pt.x, py = pt.y;
        if (pt.wing) {
          const amp = flap * FLAP * Math.pow(pt.u, 1.15);
          py += amp;
          px -= amp * 0.22 * pt.wing;
        }
        const tw = 0.80 + 0.20 * Math.sin(t * 5.4 + pt.ph);
        c.globalAlpha = fade * 0.10 * pt.br;
        c.fillStyle = 'rgba(206,228,240,1)';
        c.beginPath();
        c.arc(px, py, pt.s * 4.0, 0, 6.28318);
        c.fill();
        c.globalAlpha = fade * (0.55 + 0.45 * pt.br) * tw;
        c.fillStyle = 'rgba(250,253,255,1)';
        const sz = pt.s * 1.35;
        c.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      c.restore();
    }

    /* 入月：40 点星屑 */
    _drawCrumbs(c, L, t) {
      const dt = L - T_HIT;
      if (dt < 0 || dt > 0.95) return;
      const e = Ease.outCubic(clamp(dt / 0.85));
      const fade = 1 - clamp(dt / 0.95);
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const cr of this.crumbs) {
        const d = cr.d * 1.5 * e;
        const x = CX + Math.cos(cr.a) * d;
        const y = MY + Math.sin(cr.a) * d * 0.58;
        const a = fade * cr.br * 1.05;
        if (a <= 0.01) continue;
        c.globalAlpha = a * 0.14;
        c.fillStyle = 'rgba(220,238,246,1)';
        c.beginPath();
        c.arc(x, y, cr.s * 3.4, 0, 6.28318);
        c.fill();
        c.globalAlpha = a;
        c.fillStyle = 'rgba(252,254,255,1)';
        c.fillRect(x - cr.s * 0.55, y - cr.s * 0.55, cr.s * 1.1, cr.s * 1.1);
        c.globalAlpha = a * 0.5;
        c.fillRect(x - cr.s * 2.8, y - 0.5, cr.s * 5.6, 1);
        c.fillRect(x - 0.5, y - cr.s * 2.8, 1, cr.s * 5.6);
      }
      c.restore();
    }

    /* ================= 排版（句读律动） ================= */
    _colText(c, text, o) {
      const V4 = DFS.V4;
      if (V4 && V4.cue(o.id)) {
        const m = V4.chantColumn(c, text, {
          id: o.id, L: o.L, x: o.x, top: o.top, size: o.size, gap: o.gap || 1.10,
          weight: o.weight || 900, family: o.family, color: o.color,
          seed: o.seed || 21, alpha: o.alpha === undefined ? 1 : o.alpha, halo: 0.44
        });
        if (m) DFS.dbgBox(o.id, m.x - m.w * 0.5, m.top - m.w * 0.5, m.x + m.w * 0.5, m.top + m.h);
        return;
      }
      const chars = Array.from(text);
      const size = o.size;
      const step = size * (o.gap ?? 1.10);
      const mm = HUB.idleMicroMotion(o.t, o.x * 0.013);
      let any = false;
      for (let i = 0; i < chars.length; i++) {
        const e = HUB.multiEntrance(o.L, o.start + i * 0.055,
          { duration: 0.82, rise: 24, scaleFrom: 0.98 });
        if (e.alpha <= 0.008) continue;
        any = true;
        V3.inkText(c, chars[i], {
          x: o.x + mm.dx * 0.30,
          y: o.top + i * step + e.dy + mm.dy * 0.35,
          size, weight: o.weight ?? 900, family: o.family || T.fonts.heavy,
          color: o.color, alpha: e.alpha * (o.alpha ?? 1), seed: (o.seed ?? 1) + i * 3
        });
      }
      if (any) {
        DFS.dbgBox(o.id,
          o.x - size * 0.62, o.top - size * 0.62,
          o.x + size * 0.62, o.top + (chars.length - 1) * step + size * 0.62);
      }
    }

    _noteText(c, text, o) {
      const V4 = DFS.V4;
      if (V4 && V4.cue(o.id)) {
        const m = V4.chantLine(c, text, {
          id: o.id, L: o.L, x: CX, y: o.y, size: o.size, weight: o.weight || 500,
          family: T.fonts.serif, color: o.color, tracking: 4,
          seed: o.seed || 5, alpha: o.alpha === undefined ? 1 : o.alpha, halo: 0.5
        });
        if (m) DFS.dbgBox(o.id, m.x - 6, m.y, m.x + m.w + 6, m.y + m.h);
        return;
      }
      const e = HUB.multiEntrance(o.L, o.start, { duration: 0.9, rise: 14, scaleFrom: 0.99 });
      if (e.alpha <= 0.008) return;
      const chars = Array.from(text);
      const size = o.size;
      const tracking = 4;
      const m = meas();
      m.font = DFS.font(size, o.weight ?? 500, T.fonts.serif);
      let total = tracking * (chars.length - 1);
      for (const ch of chars) total += m.measureText(ch).width;
      let cursor = CX - total / 2;
      const mm = HUB.idleMicroMotion(o.t, 5.1);
      for (let i = 0; i < chars.length; i++) {
        const w = m.measureText(chars[i]).width;
        const ee = HUB.multiEntrance(o.L, o.start + i * 0.020, { duration: 0.72, rise: 10 });
        if (ee.alpha > 0.008) {
          V3.inkText(c, chars[i], {
            x: cursor + w / 2,
            y: o.y + e.dy * 0.6 + mm.dy * 0.25,
            size, weight: o.weight ?? 500, family: T.fonts.serif,
            color: o.color, alpha: ee.alpha * (o.alpha ?? 1), seed: (o.seed ?? 5) + i
          });
        }
        cursor += w + tracking;
      }
      DFS.dbgBox(o.id, CX - total / 2 - 6, o.y - size * 0.72, CX + total / 2 + 6, o.y + size * 0.72);
    }

    _text(c, L, t) {
      const st = DFS.STORY.texts;
      this._colText(c, st.s06_a, {
        id: 's06_a', x: 420, top: 236, size: 76, gap: 1.10, start: T_A, L, t, color: INK, seed: 51
      });
      this._colText(c, st.s06_b, {
        id: 's06_b', x: 330, top: 268, size: 76, gap: 1.10, start: T_B, L, t, color: INK, seed: 67
      });
      this._noteText(c, st.s06_note, {
        id: 's06_note', y: 940, size: 40, start: T_NOTE, L, t,
        color: 'rgba(217,56,30,0.85)', weight: 600, seed: 13
      });
    }

    /* ================= 主绘制 ================= */
    draw(ctx, L, t) {
      DFS.dbg({ gullParticles: this.gull.length });
      const p = clamp(L / 0.90);
      const ez = Ease.inOutCubic(p);
      const HZ = lerp(HZ0, HZ1, ez);
      const tw = L <= T_A ? L : T_A + (L - T_A) * 0.45;
      const amp = lerp(1.75, 0.10, ez);
      const sa = clamp((L - 1.10) / 0.90);

      V3.eight(ctx, t, {
        l1: (c) => {
          const g = c.createLinearGradient(0, 0, 0, HZ + 8);
          g.addColorStop(0, '#040607');
          g.addColorStop(0.55, '#070A0C');
          g.addColorStop(1, '#101615');
          c.fillStyle = g;
          c.fillRect(0, 0, W, HZ + 8);
          c.fillStyle = '#0B0E0C';
          c.fillRect(0, HZ, W, H - HZ + 2);
        },
        grade: 'cold', grain: 0.46, vignette: 0.40, vignetteMid: 0.06,
        dustAlpha: 0.10, dustOpts: { count: 60, color: '206,220,226', seed: 7711 },
        l2: (c) => {
          this._morphAssets(c, L, ez, HZ);
          this._land(c, HZ);
          this._water(c, tw, HZ, amp, ez);
          this._stars(c, t, sa);
        },
        l3: (c) => this._moon(c, t, L),
        l4: (c) => {
          this._moonTear(c, t, L, HZ);
          this._boat(c, tw, L);
          this._drawGull(c, L, t);
          this._drawCrumbs(c, L, t);
        },
        l5: (c) => this._text(c, L, t)
      });

      // 死寂：过渡里的一口"黑"
      const dip = 0.52 * Math.sin(Math.PI * p) * (1 - p * 0.35);
      if (dip > 0.004) {
        ctx.save();
        ctx.globalAlpha = dip;
        ctx.fillStyle = '#0B0E0C';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    hudDark() { return true; }
  };
})(window.DFS);
