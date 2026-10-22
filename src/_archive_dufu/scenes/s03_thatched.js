/* =========================================================================
   scenes/s03_thatched.js — 24.1–38.3s「荣枯咫尺」（L = 0 .. 14.2）
   青绿山水一帧之内被战火吃掉，铜门合拢，微距→雪下手→拉起旷野，两极静帧。

     0.00–1.90  24.1–26.0  宋代麻纸 + 青绿山水（RidgeCloud 16000 点，平视横移）+ 山脚云海
     1.90–2.25  26.0–26.35 一帧蚀变：黑红焦土自四边向中心 multiply 吃掉；点云插值到 #1B1512
     2.25–4.90  26.35–29.0 铜铸宫门合拢 → 28.0 闪白 + 震屏 + 600 颗火星
     4.90–6.10  29.0–30.2 微距：倾覆镏金银杯 / 酒浆沿冰裂流开
     6.10–7.30  30.2–31.4 下摇：雪层下的一只小手
     7.30–8.90  31.4–33.0 猛烈拉起：黑白暴风雪旷野 + 烽火台毒烟
     8.90–14.2  33.0–38.3 两极对立静帧（金 / 雪白 / 米白）
   全部确定性：只用 DFS.hash / DFS.rng；无 Math.random / Date.now / 大范围 ctx.filter
   屏上文字只取自 DFS.STORY.texts，无一字杜撰。
   ========================================================================= */
(function (DFS) {
  'use strict';

  const { W, H, clamp, lerp, Ease, smoothstep, hash, FPS } = DFS;
  const V3 = DFS.V3;
  const HUB = DFS.HUB;
  const T = DFS.THEME;
  const TAU = Math.PI * 2;
  const h = hash;

  const SCENE_START = 16.0;          // V4 章节起点（t = L + 16.0）

  /* ---------------- 场景内时间轴（秒） ---------------- */
  const TL = {
    light: 0.42,      // 24.52 右上冷光
    rot: 1.90,        // 26.00 蚀变起点
    rotEnd: 2.25,     // 26.35 蚀变完成
    gateIn: 2.25,     // 26.35 铜门起
    hit: 3.90,        // 28.00 相撞
    macro: 4.90,      // 29.00 微距
    pan: 6.10,        // 30.20 下摇
    pull: 7.30,       // 31.40 拉起
    hold: 8.90        // 33.00 静帧
  };

  /* ---------------- 色板 ---------------- */
  const JADE = [62, 86, 74];          // 青绿点云（契约色）
  const CHAR = [27, 21, 18];          // #1B1512 焦黑
  const BRONZE_HI = '#6B5A3A';
  const BRONZE_LO = '#2A2118';
  const SPARK = '232,163,74';         // #E8A34A
  const GOLD = '#C59B27';
  const SNOWTXT = '#F4EFE6';

  /* ---------------- 小工具 ---------------- */
  const mixRGB = (a, b, p) => [
    Math.round(lerp(a[0], b[0], p)),
    Math.round(lerp(a[1], b[1], p)),
    Math.round(lerp(a[2], b[2], p))
  ];
  const cs = (c) => `${c[0]},${c[1]},${c[2]}`;

  function softEllipse(c, x, y, rx, ry, color, a, mid = 0.5) {
    if (a <= 0.002 || rx <= 0.5 || ry <= 0.5) return;
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(mid, `rgba(${color},${a * 0.42})`);
    g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, TAU);
    c.fill();
    c.restore();
  }

  function vGrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    for (const s of stops) g.addColorStop(s[0], s[1]);
    return g;
  }

  /** 可旋转的柔光团（光柱 / 反光都用它，边缘没有直边） */
  function softBlob(c, x, y, rx, ry, rot, color, a, mid = 0.5) {
    if (a <= 0.002 || rx <= 0.5 || ry <= 0.5) return;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(mid, `rgba(${color},${a * 0.42})`);
    g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, TAU);
    c.fill();
    c.restore();
  }

  const bez2 = (a, b, d, u) => {
    const iu = 1 - u;
    return [iu * iu * a[0] + 2 * iu * u * b[0] + u * u * d[0],
            iu * iu * a[1] + 2 * iu * u * b[1] + u * u * d[1]];
  };
  const bez3 = (a, b, d, e, u) => {
    const iu = 1 - u;
    return [
      iu * iu * iu * a[0] + 3 * iu * iu * u * b[0] + 3 * iu * u * u * d[0] + u * u * u * e[0],
      iu * iu * iu * a[1] + 3 * iu * iu * u * b[1] + 3 * iu * u * u * d[1] + u * u * u * e[1]
    ];
  };

  /** 沿一条三次贝塞尔扫出一条「由窄到宽（或反之）」的带子 */
  function taper3(c, a, b, d, e, w0, w1, fill, N = 56) {
    const Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = bez3(a, b, d, e, u);
      const p2 = bez3(a, b, d, e, Math.min(1, u + 0.01));
      let tx = p2[0] - p[0], ty = p2[1] - p[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const w = lerp(w0, w1, Math.pow(u, 0.85)) * 0.5;
      Lp.push([p[0] - ty * w, p[1] + tx * w]);
      Rp.push([p[0] + ty * w, p[1] - tx * w]);
    }
    c.beginPath();
    c.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < Lp.length; i++) c.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = Rp.length - 1; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  /** 沿二次贝塞尔扫出一条两端都收的细带（手指） */
  function taper2(c, a, b, d, w0, w1, fill, N = 22) {
    const Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = bez2(a, b, d, u);
      const p2 = bez2(a, b, d, Math.min(1, u + 0.02));
      let tx = p2[0] - p[0], ty = p2[1] - p[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      const w = lerp(w0, w1, u) * 0.5;
      Lp.push([p[0] - ty * w, p[1] + tx * w]);
      Rp.push([p[0] + ty * w, p[1] - tx * w]);
    }
    c.beginPath();
    c.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < Lp.length; i++) c.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = Rp.length - 1; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.beginPath();
    c.arc(d[0], d[1], Math.max(1.2, w1 * 0.5), 0, TAU);
    c.fill();
  }

  DFS.sceneRegistry['s03'] = class Scene03RongKu {
    constructor() {
      /* ---------- 青绿山水：一万六千点 ---------- */
      this.ridge = new DFS.RidgeCloud({ seed: 7207, count: 16000, width: 30, depth: 7.4, height: 6.4 });
      this.cam = new DFS.Camera({ pos: { x: 0, y: 4.34, z: -13.9 }, yaw: 0, pitch: 0 });
      this._ridgePts = this.ridge.pts.length;

      /* ---------- 确定性烘焙 ---------- */
      this.strokes = this._bakeStrokes(940);
      this.moss = this._bakeMoss(360);
      this.sparks = this._bakeSparks(600);
      this.embers = this._bakeEmbers(96);
      this.blizzard = this._bakeBlizzard();
      this.glitter = this._bakeGlitter(230);
      this.cracks = this._bakeCracks();
      this.windStrokes = this._bakeWindStrokes(210);
      this.drift = this._bakeSnowDrift();
      this.frost = this._bakeFrost(40);
    }

    /* =====================================================================
       烘焙
       ===================================================================== */
    _bakeStrokes(n) {
      const out = [];
      const R = this.ridge;
      for (let i = 0; i < n; i++) {
        const layer = i % 3 === 0 ? 2 : (i % 2 === 0 ? 1 : 0);
        const x = (h(3121, i * 6 + 1) - 0.5) * R.width * 0.9;
        const u = Math.pow(h(3121, i * 6 + 2), 0.62);
        const y = Math.max(0, R._ridge(x, layer) * R.height * (0.62 + 0.19 * layer)) * u;
        out.push({
          layer, x, y,
          len: 5 + h(3121, i * 6 + 3) * 22,
          w: 1.4 + h(3121, i * 6 + 4) * 2.6,
          a: 0.06 + h(3121, i * 6 + 5) * 0.14,
          dx: (h(3121, i * 6 + 6) - 0.5) * 0.30
        });
      }
      return out;
    }

    _bakeMoss(n) {
      const out = [];
      const R = this.ridge;
      for (let i = 0; i < n; i++) {
        const layer = 2;                       // 只长在最前一层脊线上，位置才不会"飘"
        const x = (h(5171, i * 5 + 1) - 0.5) * R.width * 0.95;
        const y = Math.max(0, R._ridge(x, layer) * R.height * (0.62 + 0.19 * layer)) *
                  (0.94 + h(5171, i * 5 + 2) * 0.08);
        out.push({
          layer, x, y,
          r: 1.1 + h(5171, i * 5 + 3) * 2.2,
          a: 0.08 + h(5171, i * 5 + 4) * 0.16
        });
      }
      return out;
    }

    _bakeSparks(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const r1 = h(9211, i * 7 + 1), r2 = h(9211, i * 7 + 2), r3 = h(9211, i * 7 + 3);
        const r4 = h(9211, i * 7 + 4), r5 = h(9211, i * 7 + 5), r6 = h(9211, i * 7 + 6);
        out.push({
          y0: -30 + r1 * (H + 60),
          dir: r2 < 0.5 ? -1 : 1,
          vx: 150 + r3 * 860,
          vy: -(110 + r4 * 560),
          life: 0.52 + r5 * 0.98,
          size: 1 + r6 * 2,              // 1–3 px
          hot: r3 > 0.7,
          ph: r4 * TAU
        });
      }
      return out;
    }

    _bakeEmbers(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push({
          x: h(4513, i * 5 + 1) * W,
          y: h(4513, i * 5 + 2) * H,
          r: 0.8 + h(4513, i * 5 + 3) * 2.2,
          sp: 8 + h(4513, i * 5 + 4) * 26,
          a: 0.18 + h(4513, i * 5 + 5) * 0.55,
          ph: h(4513, i * 5 + 2) * TAU
        });
      }
      return out;
    }

    _bakeBlizzard() {
      const layers = [
        { n: 240, spd: 0.26, len: [40, 170], a: [0.08, 0.22], w: [0.9, 1.8] },
        { n: 110, spd: 0.48, len: [110, 340], a: [0.10, 0.26], w: [1.2, 2.6] },
        { n: 46, spd: 0.84, len: [220, 600], a: [0.06, 0.16], w: [2.2, 4.2] }
      ];
      let k = 0;
      return layers.map((ly) => {
        const items = [];
        for (let i = 0; i < ly.n; i++, k++) {
          items.push({
            x0: h(6111, k * 4 + 1) * 1.4,
            y: h(6111, k * 4 + 2),
            len: lerp(ly.len[0], ly.len[1], h(6111, k * 4 + 3)),
            a: lerp(ly.a[0], ly.a[1], h(6111, k * 4 + 4)),
            w: lerp(ly.w[0], ly.w[1], h(6111, k * 4 + 1)),
            slope: -0.04 - h(6111, k * 4 + 2) * 0.06,
            ph: h(6111, k * 4 + 3) * TAU
          });
        }
        return { spd: ly.spd, items };
      });
    }

    _bakeGlitter(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push({
          x: 300 + h(3319, i * 5 + 1) * 1260,
          y: 1210 + h(3319, i * 5 + 2) * 600,
          r: 0.7 + h(3319, i * 5 + 3) * 2.1,
          a: 0.25 + h(3319, i * 5 + 4) * 0.6,
          ph: h(3319, i * 5 + 5) * TAU
        });
      }
      return out;
    }

    /** 冰裂：短促、分叉、低反差 */
    _bakeCracks() {
      const r = DFS.rng(5519);
      const out = [];
      for (let i = 0; i < 26; i++) {
        let x = 180 + r() * 1600;
        let y = 240 + r() * 860;
        let ang = (r() - 0.5) * 1.6;
        const pts = [[x, y]];
        const seg = 2 + Math.floor(r() * 3);
        for (let k = 0; k < seg; k++) {
          ang += (r() - 0.5) * 0.9;
          const l = 22 + r() * 58;
          x += Math.cos(ang) * l;
          y += Math.sin(ang) * l * 0.45;
          pts.push([x, y]);
        }
        out.push({ pts, w: 0.5 + r() * 0.8, a: 0.05 + r() * 0.09 });
        if (r() > 0.4) {
          const b = pts[1 + Math.floor(r() * Math.max(1, pts.length - 2))];
          let bx = b[0], by = b[1];
          let ba = ang + (r() > 0.5 ? 1 : -1) * (0.7 + r() * 0.5);
          const bp = [[bx, by]];
          for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
            ba += (r() - 0.5) * 0.8;
            const l = 16 + r() * 44;
            bx += Math.cos(ba) * l;
            by += Math.sin(ba) * l * 0.45;
            bp.push([bx, by]);
          }
          out.push({ pts: bp, w: 0.4 + r() * 0.6, a: 0.04 + r() * 0.07 });
        }
      }
      return out;
    }

    _bakeWindStrokes(n) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const k = h(8171, i * 5 + 1);
        const band = Math.pow(k, 1.5);
        out.push({
          x: -300 + h(8171, i * 5 + 2) * (W + 600),
          y: H * 0.605 + 8 + band * H * 0.40,
          len: 46 + band * 300 + h(8171, i * 5 + 3) * 140,
          a: 0.05 + h(8171, i * 5 + 4) * 0.15,
          w: 0.9 + band * 2.4,
          ph: h(8171, i * 5 + 5) * TAU
        });
      }
      return out;
    }

    _bakeSnowDrift() {
      const r = DFS.rng(6637);
      const blobs = [];
      for (let i = 0; i < 10; i++) {
        blobs.push({
          x: 260 + r() * 1400,
          y: 1290 + r() * 420,
          rx: 190 + r() * 330,
          ry: 52 + r() * 96,
          a: 0.30 + r() * 0.34
        });
      }
      return blobs;
    }

    _bakeFrost(n) {
      const r = DFS.rng(7741);
      const out = [];
      for (let i = 0; i < n; i++) {
        out.push({
          x: 200 + r() * 1520,
          y: 380 + r() * 940,
          len: 8 + r() * 30,
          ang: r() * TAU,
          a: 0.06 + r() * 0.12
        });
      }
      return out;
    }

    /* =====================================================================
       山水：三层剪影 + 一万六千点 + 皴 + 苔点
       ===================================================================== */
    _ridgePath(c, layer) {
      const R = this.ridge;
      const cam = this.cam;
      const zc = (layer - 1) * R.depth * 0.52;
      const hMax = R.height * (0.62 + 0.19 * layer);
      const N = 150;
      const span = R.width * 0.92;            // 远超出两侧画框
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = lerp(-span, span, i / N);
        const y = Math.max(0, R._ridge(x, layer) * hMax);
        const p = cam.project({ x, y, z: zc });
        if (p) pts.push([p.x, p.y]);
      }
      if (pts.length < 3) return false;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineTo(pts[pts.length - 1][0], H + 400);
      c.lineTo(pts[0][0], H + 400);
      c.closePath();
      return true;
    }

    _mountains(c, L, t, pan, rotP) {
      const cam = this.cam;
      cam.pos.x = pan;

      // V4：远山化进纸里、近山压到焦墨 —— 拉开黑白张力
      const fills = [
        mixRGB([150, 176, 164], [52, 44, 36], rotP),
        mixRGB([62, 102, 88], [28, 24, 20], rotP),
        mixRGB([16, 26, 22], [10, 9, 8], rotP)
      ];
      const alphas = [0.13, 0.42, 0.80];

      for (let i = 0; i < 3; i++) {
        if (!this._ridgePath(c, i)) continue;
        c.fillStyle = `rgba(${cs(fills[i])},${(alphas[i] * (1 - rotP * 0.25)).toFixed(3)})`;
        c.fill();
      }

      // 皴笔
      c.save();
      c.lineCap = 'round';
      const ink = mixRGB([26, 44, 38], [12, 9, 8], rotP);
      for (const s of this.strokes) {
        const zc = (s.layer - 1) * this.ridge.depth * 0.52;
        const p = cam.project({ x: s.x, y: s.y, z: zc });
        if (!p || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
        c.globalAlpha = s.a * (1 - rotP * 0.4);
        c.strokeStyle = `rgba(${cs(ink)},1)`;
        c.lineWidth = s.w;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x + s.len * s.dx, p.y + s.len);
        c.stroke();
      }
      c.restore();

      // 一万六千点
      const pc = mixRGB(JADE, CHAR, rotP);
      this.ridge.draw(c, cam, t, {
        alpha: 0.92, color: cs(pc), size: 1.34 + rotP * 0.30
      });

      // 脊线苔点
      c.save();
      const mossInk = mixRGB([20, 34, 30], [10, 8, 7], rotP);
      for (const m of this.moss) {
        const zc = (m.layer - 1) * this.ridge.depth * 0.52;
        const p = cam.project({ x: m.x, y: m.y, z: zc });
        if (!p || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
        c.globalAlpha = m.a * (1 - rotP * 0.35);
        c.fillStyle = `rgba(${cs(mossInk)},1)`;
        c.beginPath();
        c.arc(p.x, p.y, m.r, 0, TAU);
        c.fill();
      }
      c.restore();
    }

    /** 山脚化进云里（单条连续渐变，不留接缝） */
    _mist(c, rotP) {
      const paper = mixRGB([246, 241, 229], [92, 70, 54], rotP);
      const g = vGrad(c, H * 0.58, H, [
        [0, `rgba(${cs(paper)},0)`],
        [0.36, `rgba(${cs(paper)},0.36)`],
        [0.62, `rgba(${cs(paper)},0.62)`],
        [1, `rgba(${cs(paper)},0.92)`]
      ]);
      c.fillStyle = g;
      c.fillRect(0, H * 0.58, W, H * 0.42);
    }

    /** 云海：几道横雾带 + 背光，才不是一片白 */
    _mistBands(c, rotP) {
      const lit = mixRGB([251, 248, 240], [96, 72, 56], rotP);
      const shade = mixRGB([172, 182, 176], [48, 36, 28], rotP);
      const r = DFS.rng(5171);
      for (let i = 0; i < 7; i++) {
        const y = H * 0.705 + i * H * 0.040 + r() * 16;
        const w = 520 + r() * 720;
        const x = (i % 2 ? 0.62 : 0.34) * W + (r() - 0.5) * 320 + Math.sin(i * 1.7) * 60;
        softEllipse(c, x, y, w, 30 + r() * 26, cs(lit), 0.30, 0.5);
        softEllipse(c, x + 46, y + 24 + r() * 12, w * 0.86, 16 + r() * 14, cs(shade), 0.12, 0.5);
      }
    }

    _cloudSea(c, t, rotP) {
      const lit = mixRGB([252, 249, 240], [78, 58, 46], rotP);
      const shade = mixRGB([150, 162, 156], [36, 27, 21], rotP);
      V3.cloudBank(c, t, {
        count: 24, alpha: 0.16 * (1 - rotP * 0.3), color: cs(shade),
        y0: H * 0.75, y1: H * 0.98
      });
      V3.cloudBank(c, t, {
        count: 32, alpha: 0.30 * (1 - rotP * 0.3), color: cs(lit),
        y0: H * 0.69, y1: H * 0.96
      });
      V3.cloudBank(c, t, {
        count: 12, alpha: 0.12, color: cs(lit),
        y0: H * 0.60, y1: H * 0.72
      });
    }

    /** 右上那一斜冷光：一道，用一串柔光团堆出来，边缘不带直线 */
    _lightShaft(c, L, a) {
      if (a <= 0.004) return;
      const x0 = 1812, y0 = -80, x1 = 946, y1 = 792;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 13; i++) {
        const u = i / 12;
        const x = lerp(x0, x1, u);
        const y = lerp(y0, y1, u);
        const rx = lerp(150, 300, u);
        const ry = lerp(20, 62, u);
        const al = (0.075 - u * 0.045) * a;
        softBlob(c, x, y, rx, ry, ang, '206,230,244', al, 0.46);
      }
      // 内芯：更细更亮
      for (let i = 0; i < 11; i++) {
        const u = i / 10;
        const x = lerp(1816, 1052, u);
        const y = lerp(-70, 686, u);
        const al = (0.075 - u * 0.055) * a;
        softBlob(c, x, y, lerp(80, 150, u), lerp(7, 16, u), ang, '248,253,255', al, 0.42);
      }
      c.restore();
    }

    /* =====================================================================
       镜头 1 / 2 — 青绿山水（可带蚀变）
       ===================================================================== */
    shotLandscape(ctx, L, t, rotP) {
      const pan = lerp(-3.0, 3.15, smoothstep(0, TL.rotEnd, L));
      const lightA = clamp((L - TL.light) / 0.55);

      V3.eight(ctx, t, {
        l1: (c) => {
          V3.paper(c, { zoom: 1.05 });
          c.save();
          c.globalCompositeOperation = 'soft-light';
          const g = c.createLinearGradient(0, 0, 0, H);
          g.addColorStop(0, 'rgba(88,144,158,0.66)');
          g.addColorStop(0.38, 'rgba(60,112,102,0.46)');
          g.addColorStop(0.70, 'rgba(88,114,88,0.28)');
          g.addColorStop(1, 'rgba(126,114,88,0.18)');
          c.fillStyle = g;
          c.fillRect(0, 0, W, H);
          c.restore();
          softEllipse(c, 1500, 236, 560, 480, '255,247,216', 0.32);
          softEllipse(c, 620, 450, 800, 260, '228,238,234', 0.18);
        },
        l2: (c) => {
          this._mountains(c, L, t, pan, rotP);
          this._mist(c, rotP);
          this._cloudSea(c, t, rotP);
          this._mistBands(c, rotP);
        },
        l3: (c) => {
          if (lightA > 0.002) {
            V3.volumetricLight(c, t, {
              count: 7, alpha: 0.028 * lightA, color: '208,226,236', seed: 14
            });
          }
        },
        l5: (c) => this._lightShaft(c, L, lightA),
        grade: 'cold',
        dust: true,
        dustAlpha: 0.28 + rotP * 0.34,
        dustOpts: {
          count: 150,
          color: rotP > 0.25 ? '190,76,42' : '228,206,158',
          seed: 4711
        },
        grain: 0.34,
        vignette: 0.26,
        vignetteMid: 0.04
      });

      if (rotP > 0) this._corrosion(ctx, L, rotP);
    }

    _corrosion(c, L, rotP) {
      const q = rotP;
      const cx = W * 0.50, cy = H * 0.47;
      const R = lerp(W * 1.06, 14, Math.pow(q, 0.92));

      c.save();
      c.globalCompositeOperation = 'multiply';

      const g = c.createRadialGradient(cx, cy, Math.max(0.5, R * 0.26), cx, cy, Math.max(1, R));
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.50, 'rgba(150,56,30,0.10)');
      g.addColorStop(0.78, 'rgba(78,28,16,0.52)');
      g.addColorStop(0.92, 'rgba(36,17,12,0.90)');
      g.addColorStop(1, 'rgba(16,10,8,0.99)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);

      const n = 96;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + h(6613, i * 3 + 1) * 0.28;
        const rr = R * (0.84 + h(6613, i * 3 + 2) * 0.26);
        const bx = cx + Math.cos(a) * rr;
        const by = cy + Math.sin(a) * rr * 0.76;
        const br = 18 + h(6613, i * 3 + 3) * 96;
        const bg = c.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, 'rgba(10,7,6,0.95)');
        bg.addColorStop(0.62, 'rgba(26,14,10,0.50)');
        bg.addColorStop(1, 'rgba(44,24,14,0)');
        c.fillStyle = bg;
        c.beginPath();
        c.arc(bx, by, br, 0, TAU);
        c.fill();
      }

      if (q > 0.55) {
        c.globalAlpha = Math.pow(clamp((q - 0.55) / 0.45), 1.7) * 0.92;
        c.fillStyle = '#150F0C';
        c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
      }
      c.restore();

      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 52; i++) {
        const a = (i / 52) * TAU + h(7741, i * 3 + 1) * 0.3;
        const rr = R * (0.88 + h(7741, i * 3 + 2) * 0.16);
        const bx = cx + Math.cos(a) * rr;
        const by = cy + Math.sin(a) * rr * 0.76;
        const s = 1.2 + h(7741, i * 3 + 3) * 3.2;
        c.globalAlpha = (1 - q * 0.45) * (0.35 + h(7741, i * 3 + 2) * 0.5);
        c.fillStyle = 'rgba(232,128,62,1)';
        c.fillRect(bx, by, s, s);
      }
      c.restore();
    }

    /* =====================================================================
       镜头 3 — 铜铸宫门（26.35–29.0）
       ===================================================================== */
    _charredBackdrop(c, L, t) {
      const g = vGrad(c, 0, H, [
        [0, '#090705'],
        [0.42, '#0E0B09'],
        [0.72, '#0B0806'],
        [1, '#050403']
      ]);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);

      this.cam.pos.x = 3.15;
      for (let i = 0; i < 3; i++) {
        if (!this._ridgePath(c, i)) continue;
        c.fillStyle = `rgba(${cs(mixRGB([112, 150, 138], [54, 42, 34], 1))},${(0.14 + i * 0.06).toFixed(3)})`;
        c.fill();
      }
      softEllipse(c, W * 0.52, H * 0.60, W * 0.66, H * 0.28, '168,60,30', 0.15);
      const gl = vGrad(c, H * 0.82, H, [
        [0, 'rgba(120,42,20,0)'],
        [1, 'rgba(150,58,26,0.18)']
      ]);
      c.fillStyle = gl;
      c.fillRect(0, H * 0.82, W, H * 0.18);

      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const em of this.embers) {
        const y = ((em.y - t * em.sp) % H + H) % H;
        const x = em.x + Math.sin(t * 0.6 + em.ph) * 14;
        c.globalAlpha = em.a * (0.5 + 0.5 * Math.sin(t * 2.1 + em.ph));
        c.fillStyle = 'rgba(226,118,54,1)';
        c.fillRect(x, y, em.r, em.r);
      }
      c.restore();
    }

    /* =====================================================================
       镜头 3 — 铜门合拢（V4：界画铜门 + 大片黑留白）
       铜门只占画面中央 62%，四周是纯黑深渊 —— 留白本身就是压迫感。
       ===================================================================== */
    _doorLeaf(c, side, gapHalf, e, t) {
      // side: -1 左扇 / +1 右扇；gapHalf: 中缝半宽
      const xInner = W * 0.5 + side * gapHalf;
      const xOuter = side < 0 ? xInner - W * 0.31 : xInner + W * 0.31;
      const y0 = H * 0.08, y1 = H * 0.96;
      const xa = Math.min(xInner, xOuter), xb = Math.max(xInner, xOuter);

      // ——— 门板：暗铜色，横向由内向外渐深 ———
      const g = c.createLinearGradient(xInner, 0, xOuter, 0);
      g.addColorStop(0, 'rgba(52,36,17,1)');
      g.addColorStop(0.22, 'rgba(22,16,9,1)');
      g.addColorStop(0.55, 'rgba(12,9,5,1)');
      g.addColorStop(1, 'rgba(4,3,2,1)');
      c.fillStyle = g;
      c.fillRect(xa, y0, xb - xa, y1 - y0);

      // ——— 三道门带（横向铜条）———
      for (let k = 0; k < 3; k++) {
        const yy = y0 + (y1 - y0) * (0.18 + k * 0.32);
        const bg = c.createLinearGradient(xInner, 0, xOuter, 0);
        bg.addColorStop(0, 'rgba(206,158,84,0.92)');
        bg.addColorStop(0.35, 'rgba(120,88,40,0.7)');
        bg.addColorStop(1, 'rgba(26,20,10,0.5)');
        c.fillStyle = bg;
        c.fillRect(xa, yy, xb - xa, 7);
      }

      // ——— 门钉：三排，少而大（不再是一整片铆钉阵）———
      const V4 = DFS.V4;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const nx = side < 0
            ? xInner - (W * 0.31) * (0.20 + col * 0.24)
            : xInner + (W * 0.31) * (0.20 + col * 0.24);
          const ny = y0 + (y1 - y0) * (0.30 + row * 0.21);
          const rr = 13 - col * 1.4;
          const rg = c.createRadialGradient(nx - rr * 0.35, ny - rr * 0.4, 1, nx, ny, rr);
          rg.addColorStop(0, 'rgba(212,168,96,0.95)');
          rg.addColorStop(0.6, 'rgba(140,102,48,0.95)');
          rg.addColorStop(1, 'rgba(40,28,14,0.95)');
          c.fillStyle = rg;
          c.beginPath();
          c.arc(nx, ny, rr, 0, Math.PI * 2);
          c.fill();
        }
      }

      // ——— 铺首衔环（每扇一个）———
      const px = side < 0 ? xInner - W * 0.09 : xInner + W * 0.09;
      const py = H * 0.60;
      if (V4) {
        V4.inkStroke(c, px - 26, py - 22, px + 26, py - 20, { w: 9, alpha: 0.85, color: '196,150,80', dry: 0.3, seed: 71 });
        V4.inkStroke(c, px - 26, py + 22, px + 26, py + 20, { w: 9, alpha: 0.85, color: '196,150,80', dry: 0.3, seed: 73 });
      }
      c.strokeStyle = 'rgba(206,162,92,0.92)';
      c.lineWidth = 7;
      c.beginPath();
      c.arc(px, py + 46, 34, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(60,42,20,0.7)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(px, py + 46, 34, 0, Math.PI * 2);
      c.stroke();

      // ——— 内缘金边（迎光的那一侧）———
      const eg = c.createLinearGradient(xInner - side * 30, 0, xInner, 0);
      eg.addColorStop(0, 'rgba(255,226,168,0)');
      eg.addColorStop(1, 'rgba(255,226,168,0.85)');
      c.fillStyle = eg;
      c.fillRect(xInner - side * 30, y0, side * 30, y1 - y0);
    }

    _gateSparks(c, dt) {
      if (dt < -0.35 || dt > 1.6) return;
      const p = clamp((dt + 0.35) / 1.95);
      const r = DFS.rng(6120);
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 180; i++) {
        const a0 = r() * Math.PI * 2;
        const spd = 260 + r() * 900;
        const life = 0.4 + r() * 0.9;
        const tt = clamp(p / life);
        if (tt > 1) continue;
        const px = W * 0.5 + Math.cos(a0) * spd * tt * 0.55;
        const py = H * 0.52 + Math.sin(a0) * spd * tt * 0.42 + 420 * tt * tt;
        const alpha = (1 - tt) * (0.25 + r() * 0.65);
        c.fillStyle = 'rgba(255,' + Math.round(150 + r() * 70) + ',' + Math.round(60 + r() * 60) + ',' + alpha.toFixed(3) + ')';
        const sz = 1 + r() * 2.6;
        c.beginPath();
        c.arc(px, py, sz, 0, 6.28318);
        c.fill();
      }
      c.restore();
    }

    shotGates(ctx, L, t) {
      const closeP = clamp((L - TL.gateIn) / (TL.hit - TL.gateIn));
      const e = Math.pow(closeP, 1.75);
      const dt = L - TL.hit;
      const absFrame = Math.round(t * FPS);
      const shake = dt >= -0.001
        ? HUB.cameraShake(absFrame, { amp: 11, decay: 7, startFrame: Math.round((SCENE_START + TL.hit) * FPS), seed: 13 })
        : { x: 0, y: 0, rot: 0 };
      const gapHalf = lerp(210, 4, e);
      const flash = dt >= 0 && dt < 0.22 ? (1 - dt / 0.22) : 0;

      HUB.applyCameraShake(ctx, shake);

      V3.eight(ctx, t, {
        void: true,
        voidInner: '#171208', voidMid: '#0A0805', voidOuter: '#020202',
        grade: 'warm',
        grain: 0.30, vignette: 0.30, vignetteMid: 0.03,
        dustAlpha: 0.18,
        dustOpts: { count: 40, color: '236,206,150', seed: 4109 },
        l2: (c) => {
          // 门缝里的光（合拢前）
          if (gapHalf > 6) {
            const lg = c.createLinearGradient(W * 0.5 - gapHalf, 0, W * 0.5 + gapHalf, 0);
            lg.addColorStop(0, 'rgba(255,206,130,0)');
            lg.addColorStop(0.5, 'rgba(255,226,164,0.55)');
            lg.addColorStop(1, 'rgba(255,206,130,0)');
            c.fillStyle = lg;
            c.fillRect(W * 0.5 - gapHalf, 0, gapHalf * 2, H);
          }
          this._doorLeaf(c, -1, gapHalf, e, t);
          this._doorLeaf(c, +1, gapHalf, e, t);
        },
        l3: (c) => {
          const g = c.createRadialGradient(W * 0.5, H * 0.5, 20, W * 0.5, H * 0.5, H * 0.86);
          const a = 0.10 + 0.42 * Math.pow(e, 2.2);
          g.addColorStop(0, 'rgba(255,198,116,' + (a * 0.9).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(255,198,116,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, W, H);
        },
        l4: (c) => {
          this._gateSparks(c, dt);
        }
      });

      if (flash > 0.01) {
        ctx.save();
        ctx.globalAlpha = flash * 0.85;
        ctx.fillStyle = '#FFF6E2';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    /* =====================================================================
       镜头 4 — 微距：倾覆的镏金樽与朱砂酒渍（V4：水墨 + 大留白）
       纸面占 65%，一只倒在纸上的杯子，酒浆沿纸纹漫开。
       ===================================================================== */
    _wineStain(c, L, t, cx, cy) {
      const grow = clamp((L - TL.macro + 0.35) / 1.5);
      if (grow <= 0.001) return;
      const e = DFS.Ease.outCubic(grow);
      const r = DFS.rng(3341);
      c.save();
      // 主体：多层不规则椭圆叠出毛细边缘
      for (let k = 0; k < 7; k++) {
        const a = 1 - k * 0.11;
        const rx = (60 + k * 26) * e * (0.8 + r() * 0.5);
        const ry = (38 + k * 15) * e * (0.8 + r() * 0.5);
        const ox = cx - 120 * e + (r() - 0.5) * 90 * e;
        const oy = cy + 26 + (r() - 0.5) * 60 * e;
        const g = c.createRadialGradient(ox, oy, 0, ox, oy, Math.max(rx, ry));
        g.addColorStop(0, 'rgba(96,14,10,' + (0.55 * a * e).toFixed(3) + ')');
        g.addColorStop(0.62, 'rgba(78,10,8,' + (0.34 * a * e).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(70,8,6,0)');
        c.fillStyle = g;
        c.save();
        c.translate(ox, oy);
        c.scale(1, ry / Math.max(1, rx));
        c.beginPath();
        c.arc(0, 0, rx, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      // 湿边：边缘的一道深色沉淀
      c.strokeStyle = 'rgba(58,6,5,' + (0.34 * e).toFixed(3) + ')';
      c.lineWidth = 3.2;
      const N = 64;
      c.beginPath();
      for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const wob = 1 + 0.16 * Math.sin(ang * 3 + 1.2) + 0.10 * Math.sin(ang * 7 + 0.4);
        const px = cx - 118 * e + Math.cos(ang) * 232 * e * wob;
        const py = cy + 26 + Math.sin(ang) * 136 * e * wob;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      // 飞溅的几滴
      for (let i = 0; i < 14; i++) {
        const ang = r() * Math.PI * 2;
        const d = 200 + r() * 260;
        const px = cx - 118 * e + Math.cos(ang) * d * e;
        const py = cy + 26 + Math.sin(ang) * d * 0.6 * e;
        const rr = (2 + r() * 9) * e;
        c.fillStyle = 'rgba(84,12,10,' + (0.30 * e).toFixed(3) + ')';
        c.beginPath();
        c.ellipse(px, py, rr, rr * (0.6 + r() * 0.6), ang, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }

    _cupInk(c, L, t, cx, cy, s) {
      const V4 = DFS.V4;
      c.save();
      c.translate(cx, cy);
      c.rotate(-0.30);
      c.scale(s, s);

      // 杯身：倒放的镏金樽（墨胎 + 金口）
      const body = c.createLinearGradient(-40, -80, 130, 96);
      body.addColorStop(0, 'rgba(52,40,24,0.97)');
      body.addColorStop(0.50, 'rgba(26,20,12,0.99)');
      body.addColorStop(1, 'rgba(10,8,6,1)');
      c.fillStyle = body;
      c.beginPath();
      c.ellipse(34, 0, 104, 76, 0.04, 0, Math.PI * 2);
      c.fill();

      // 口沿（倾倒的一侧朝向左边）
      c.beginPath();
      c.ellipse(-64, -10, 40, 66, 0.24, 0, Math.PI * 2);
      c.fillStyle = 'rgba(6,5,3,0.99)';
      c.fill();
      c.strokeStyle = 'rgba(232,188,110,0.96)';
      c.lineWidth = 8;
      c.stroke();
      c.strokeStyle = 'rgba(120,84,38,0.7)';
      c.lineWidth = 2.4;
      c.stroke();

      // 圈足（右侧的小环）
      c.beginPath();
      c.ellipse(116, 12, 17, 31, -0.18, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(214,170,98,0.88)';
      c.lineWidth = 5.5;
      c.stroke();

      // 器身金线（一道枯笔勾出的高光，不是 CG 高光）
      if (V4) {
        V4.inkStroke(c, -34, -58, 96, 30, {
          w: 7.5, alpha: 0.30, color: '246,228,190', dry: 0.82, seed: 9
        });
        V4.inkStroke(c, -50, 42, 104, 52, {
          w: 3.2, alpha: 0.18, color: '246,228,190', dry: 0.86, seed: 11
        });
      }
      c.restore();
    }

    shotMacro(ctx, L, t) {
      const k = clamp((L - TL.macro) / (TL.pull - TL.macro));
      const panY = DFS.Ease.inOutCubic(k) * 130;
      const push = 1.0 + 0.045 * k;
      const cx = W * 0.58, cy = H * 0.46;

      V3.eight(ctx, t, {
        grade: 'warm',
        grain: 0.24, vignette: 0.20, vignetteMid: 0.02,
        dustAlpha: 0.16,
        dustOpts: { count: 36, color: '226,198,138', seed: 4111 },
        l2: (c) => {
          c.save();
          c.translate(W * 0.5, H * 0.5);
          c.scale(push, push);
          c.translate(-W * 0.5, -H * 0.5 + panY);
          // 朱砂酒渍（先于杯子）
          this._wineStain(c, L, t, cx - 120, cy + 90);
          // 金樽
          this._cupInk(c, L, t, cx, cy, 1.0);
          // 几粒金粉
          const r = DFS.rng(8821);
          c.save();
          c.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 40; i++) {
            const px = cx + (r() - 0.5) * 700 - 60;
            const py = cy + (r() - 0.5) * 460 + 60;
            c.globalAlpha = 0.10 + r() * 0.34;
            c.fillStyle = 'rgba(246,214,150,1)';
            c.fillRect(px, py, 1 + r() * 2.4, 1 + r() * 2.4);
          }
          c.restore();
          c.restore();
        },
        l5: (c) => {
          // 微距里只留一行极小的考据小字（竖排夹注）
          const a = clamp((L - TL.macro - 0.5) / 0.9);
          if (a > 0.01 && DFS.V4) {
            DFS.V4.annotation(c, (DFS.STORY.texts.s03_b || ''), {
              x: W - 150, y: 250, size: 22, gap: 1.16, color: '120,104,80',
              alpha: a * 0.55, family: T.fonts.kai
            });
          }
        }
      });
    }


    /* =====================================================================
       镜头 5 — 猛烈拉起：黑白暴风雪旷野（31.4–33.0）+ 静帧（33.0–38.3）
       ===================================================================== */
    _wasteWorld(c, L, t, rush) {
      const hz = H * 0.605;

      // V4：雪原压到真正的墨黑，只在地平线留一道雪光 —— 黑白张力
      const g = vGrad(c, hz, H * 1.42, [
        [0.00, '#9AA3A9'],
        [0.055, '#59646B'],
        [0.15, '#232A30'],
        [0.30, '#0C1013'],
        [0.55, '#050708'],
        [1.00, '#010202']
      ]);
      c.fillStyle = g;
      c.fillRect(-W * 0.7, hz, W * 2.4, H * 1.0);

      // 地平线上被风刮起的雪雾
      const rr = DFS.rng(4417);
      for (let i = 0; i < 14; i++) {
        const x = -120 + i * 165 + rr() * 110;
        softEllipse(c, x, hz - 10 + rr() * 34, 250 + rr() * 210, 26 + rr() * 40,
          '206,214,222', 0.12 + rr() * 0.20);
      }

      // 雪面风纹
      c.save();
      c.lineCap = 'round';
      for (const s of this.windStrokes) {
        const y = s.y + Math.sin(t * 0.6 + s.ph) * 2.4;
        c.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(t * 1.4 + s.ph));
        c.strokeStyle = 'rgba(228,234,240,1)';
        c.lineWidth = s.w;
        c.beginPath();
        c.moveTo(s.x - rush * 90, y);
        c.lineTo(s.x - rush * 90 + s.len, y + 2.2);
        c.stroke();
      }
      c.restore();

      softEllipse(c, 380, hz + 46, 470, 44, '132,142,150', 0.12);
      softEllipse(c, 1520, hz + 64, 570, 50, '132,142,150', 0.09);

      // ---- 烽火台：梯形剪影 ----
      const bx = W * 0.5, by = hz + 6;
      const botH = 100, topH = 64, topY = by - 198;
      c.save();
      c.fillStyle = 'rgba(8,10,11,0.97)';
      c.beginPath();
      c.moveTo(bx - botH, by);
      c.lineTo(bx - topH, topY);
      c.lineTo(bx + topH, topY);
      c.lineTo(bx + botH, by);
      c.closePath();
      c.fill();
      for (let i = -1; i <= 1; i++) {
        c.fillRect(bx + i * 40 - 16, topY - 18, 32, 20);
      }
      c.strokeStyle = 'rgba(196,206,214,0.30)';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(bx + botH, by);
      c.lineTo(bx + topH, topY);
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.26 + 0.12 * Math.sin(t * 2.1);
      c.fillStyle = 'rgba(206,116,58,1)';
      c.fillRect(bx - 6, topY - 30, 12, 10);
      c.restore();

      // ---- 三团深灰毒烟：沿上升轴排开的软团，被风吹向左 ----
      const rise = Math.max(0, L - TL.pull);
      for (let k = 0; k < 3; k++) {
        const baseY = topY - 24 - k * 44;
        const cy = baseY - rise * (11 + k * 4);
        const cx = bx + Math.sin(L * 0.24 + k * 2.4) * (12 + k * 10);
        for (let j = 0; j < 6; j++) {
          const u = j / 5;
          const r1 = h(3313, k * 23 + j * 3 + 1);
          const r2 = h(3313, k * 23 + j * 3 + 2);
          const r3 = h(3313, k * 23 + j * 3 + 3);
          const px = cx - 46 * u + (r1 - 0.5) * 54;
          const py = cy - u * 104 + (r2 - 0.5) * 26;
          const rad = (30 + u * 46) * (0.82 + r3 * 0.40);
          softEllipse(c, px, py, rad, rad * 0.84, '132,138,144', 0.15 * (1 - u * 0.30), 0.45);
          softEllipse(c, px + 5, py + 5, rad * 0.52, rad * 0.46, '54,58,62', 0.22 * (1 - u * 0.22), 0.45);
        }
      }

      // 前景压角
      const fg = vGrad(c, H * 0.88, H * 1.1, [
        [0, 'rgba(10,12,14,0)'],
        [1, 'rgba(10,12,14,0.90)']
      ]);
      c.fillStyle = fg;
      c.fillRect(-W * 0.7, H * 0.88, W * 2.4, H * 0.22);
    }

    _blizzard(c, L, t, rush) {
      c.save();
      c.lineCap = 'round';
      for (const ly of this.blizzard) {
        for (const s of ly.items) {
          const x = ((s.x0 + t * ly.spd) % 1.4) * W - W * 0.2;
          const y = s.y * H + Math.sin(t * 0.8 + s.ph) * 7;
          const len = s.len * (1 + rush * 0.7);
          c.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * 2.3 + s.ph));
          c.strokeStyle = 'rgba(240,245,250,1)';
          c.lineWidth = s.w;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + len, y + len * s.slope);
          c.stroke();
        }
      }
      // 近景的雪雾团（让风有"团"的感觉）
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.27 + t * 0.05) % 1.3) * W - W * 0.1;
        const y = H * (0.30 + 0.12 * i) + Math.sin(t * 0.5 + i) * 12;
        softEllipse(c, x, y, 220, 70, '235,241,246', 0.05 + 0.03 * Math.sin(t * 0.9 + i), 0.5);
      }
      c.restore();
    }

    _wasteSky(c, L, t) {
      // V4：黑天 + 雪原的强对比（中灰带太宽就会"发灰发脏"）
      const g = vGrad(c, 0, H, [
        [0, '#07090B'],
        [0.30, '#0C0F12'],
        [0.52, '#151A1E'],
        [0.605, '#101316'],
        [0.615, '#2A3036'],
        [0.66, '#8E979C'],
        [0.78, '#C9D0D2'],
        [1, '#7C8489']
      ]);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      softEllipse(c, W * 0.5, H * 0.60, W * 0.66, H * 0.10, '226,232,234', 0.10);
    }

    /* =====================================================================
       排版：两极对立静帧
       ===================================================================== */
    _texts(ctx, L, t) {
      const st = DFS.STORY.texts;

      const V4 = DFS.V4;
      const scrimA = clamp((L - 8.85) / 0.8) * 0.66;
      if (scrimA > 0.01) {
        softEllipse(ctx, W * 0.5, 802, 780, 210, '6,7,8', scrimA, 0.55);
      }

      const br = HUB.idleMicroMotion(t, 2.3, 0.55);

      const line = (id, text, o) => {
        if (V4) {
          const m = V4.chantLine(ctx, text, {
            id, L, x: o.x, y: o.y, size: o.size, weight: o.weight || 900,
            family: o.family || T.fonts.heavy, color: o.color, tracking: o.tracking || 6,
            seed: o.seed || 5, halo: o.halo === undefined ? 0.42 : o.halo
          });
          if (m) DFS.dbgBox(id, m.x, m.y, m.x + m.w, m.y + m.h);
          return m;
        }
        return V3.inkText(ctx, text, {
          x: o.x, y: o.y, size: o.size, weight: o.weight || 900,
          family: o.family || T.fonts.heavy, color: o.color, tracking: o.tracking || 6, seed: o.seed || 5
        });
      };

      /* ---- 左：朱门酒肉臭（金漆）——史笔刀刻 ---- */
      const mL = line('s03_left', st.s03_left, {
        x: 460, y: 300 + br.dy * 0.35, size: 84, color: GOLD, tracking: 8, seed: 5
      });
      if (mL) {
        const a = clamp(L - 8.10 > 0 ? 1 : 0);
        ctx.save();
        ctx.globalAlpha = a * 0.55;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(460 - 232, 384);
        ctx.lineTo(460 + 232, 384);
        ctx.stroke();
        ctx.restore();
      }

      /* ---- 右：路有冻死骨（雪白）---- */
      const mR = line('s03_right', st.s03_right, {
        x: 1460, y: 300 - br.dy * 0.35, size: 84, color: SNOWTXT, tracking: 8, seed: 7
      });
      if (mR) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = SNOWTXT;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(1460 - 232, 384);
        ctx.lineTo(1460 + 232, 384);
        ctx.stroke();
        ctx.restore();
      }

      /* ---- 中央下方两行（米白）——墓志碑拓：由淡及浓洇出 ---- */
      line('s03_a', st.s03_a, {
        x: W * 0.5, y: 760, size: 46, weight: 500, family: T.fonts.serif,
        color: 'rgba(244,239,230,0.94)', tracking: 2, seed: 11, halo: 0.46
      });
      line('s03_b', st.s03_b, {
        x: W * 0.5, y: 840, size: 46, weight: 500, family: T.fonts.serif,
        color: 'rgba(238,232,220,0.90)', tracking: 2, seed: 13, halo: 0.46
      });
    }

    shotWide(ctx, L, t) {
      const p = clamp((L - TL.pull) / 1.15);
      const e = Ease.outQuint(p);
      const zoom = lerp(2.02, 1.0, e);
      const ty = lerp(-780, 0, e);
      const rush = 1 - e;

      V3.eight(ctx, t, {
        l1: (c) => this._wasteSky(c, L, t),
        l2: (c) => {
          c.save();
          c.translate(W / 2, H * 0.605);
          c.scale(zoom, zoom);
          c.translate(-W / 2, -H * 0.605 + ty);
          this._wasteWorld(c, L, t, rush);
          c.restore();
        },
        l4: (c) => this._blizzard(c, L, t, rush),
        grade: 'ash',
        dust: true,
        dustAlpha: 0.26,
        dustOpts: { count: 140, color: '212,218,224', seed: 4127 },
        grain: 0.46,
        vignette: 0.34,
        vignetteMid: 0.06
      });

      this._texts(ctx, L, t);
    }

    /* =====================================================================
       主绘制
       ===================================================================== */
    draw(ctx, L, t) {
      if (L < TL.rot) {
        this.shotLandscape(ctx, L, t, 0);
      } else if (L < TL.gateIn) {
        this.shotLandscape(ctx, L, t, clamp((L - TL.rot) / (TL.rotEnd - TL.rot)));
      } else if (L < TL.macro) {
        this.shotGates(ctx, L, t);
      } else if (L < TL.pull) {
        this.shotMacro(ctx, L, t);
      } else {
        this.shotWide(ctx, L, t);
      }
      DFS.dbg({
        s03Ridge: this._ridgePts,
        s03Sparks: this.sparks.length
      });
    }

    hudDark(L) { return L > 1.92; }
  };
})(window.DFS);
