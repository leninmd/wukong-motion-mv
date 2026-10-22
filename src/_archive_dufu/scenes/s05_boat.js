/* =========================================================================
   s05_boat.js — 54.1–68.3s（L 0–14.2s）夔门峡江 · 落木 · 怒
   L 0.00–1.50  从黑场里用圆孔穿越打开夔门峡江（绝壁黑如玄铁）
   L 0.90–7.90  峡江：深色江面浮沫白线 + 两侧巨大黑色多边形绝壁（上缘参差、崖头挑出）
                + 江心一叶孤舟（船头小灯）→ 58.0s 起 260 片深褐枯叶像黑蝶砸落江面，
                触水激起 3px 小白环
   L 7.90–14.2  静帧 Hold：右起竖排「无边落木萧萧下 / 不尽长江滚滚来」＋下方小字
   屏幕文字全部取自 storyboard.v3.json 的 texts（原典），无一字杜撰。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease, hash } = DFS;
  const V3 = DFS.V3;
  const HUB = DFS.HUB;
  const T = DFS.THEME;

  const CX = 960;
  const HZ = H * 0.545;               // 水面（峡江）
  const LAND = HZ + 26;               // 枯叶触水线
  const B_X0 = 980, B_X1 = 900;       // 孤舟漂移
  const B_Y = H * 0.72;
  const B_S = 0.62;
  const T_LEAF = 3.90;                // 58.0s
  const T_HOLD = 7.90;                // 62.0s
  const LEAF_T = 0.72;                // 枯叶时间压缩（落得更从容）
  const RING_LIFE = 0.55;
  const INK = '#F4EFE6';

  let MEAS = null;
  const meas = () => (MEAS || (MEAS = DFS.mkCanvas(8, 8).getContext('2d')));
  const mir = (pts) => pts.map(([x, y]) => [1920 - x, y]);

  /* ---------------- 绝壁轮廓（手写参差上缘 + 挑出的崖头） ---------------- */
  const NEAR_L = [[-60, 1080], [-60, 96], [30, 70], [120, 132], [214, 78], [300, 138],
    [386, 88], [470, 150], [540, 100], [604, 164], [660, 112], [706, 186],
    [690, 286], [706, 352], [664, 420], [676, 502], [622, 596], [634, 690],
    [578, 790], [556, 880], [568, 960], [528, 1080]];
  const NEAR_R = mir(NEAR_L);
  const EDGE_L = [[706, 186], [690, 286], [706, 352], [664, 420], [676, 502], [622, 596],
    [634, 690], [578, 790], [556, 880], [568, 960], [528, 1080]];
  const EDGE_R = mir(EDGE_L);
  // 远处：江道尽头的一道低山（纵深）
  const FAR_RIDGE = [[556, 524], [628, 492], [700, 476], [772, 462], [844, 474], [916, 452],
    [990, 468], [1064, 450], [1140, 472], [1216, 486], [1290, 506], [1352, 524]];

  DFS.sceneRegistry['s05'] = class Scene05V3 {
    constructor() {
      this.leaves = new DFS.Leaves({
        n: 260, seed: 5813, color: '58,42,26', alpha: 0.92, size: 1.4, speed: 0.9
      });
      this._buildLeafLandings();
    }

    /* 预解每片枯叶越过落水线的相位（与 DFS.Leaves 内部公式一致） */
    _buildLeafLandings() {
      const L = this.leaves;
      const span = H * 1.5;
      const U0 = LAND + H * 0.3;
      const out = [];
      for (let i = 0; i < L.n; i++) {
        const r1 = hash(L.seed, i * 6 + 1);
        const r2 = hash(L.seed, i * 6 + 2);
        const r3 = hash(L.seed, i * 6 + 3);
        const r4 = hash(L.seed, i * 6 + 4);
        const sp = (110 + r4 * 190) * L.speed;      // px/s（叶子时间）
        const P = span / sp;
        let a = ((U0 - r2 * span) / sp) % P;
        if (a < 0) a += P;
        out.push({
          i, P, a,
          xb: r1 * W * 1.1 - W * 0.05,
          dx: 18 + r3 * 40,
          r1
        });
      }
      this.leafLand = out;
    }

    /* ---------------- 路径工具 ---------------- */
    _poly(c, pts) {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
    }
    /* 平滑多边形：中点二次曲线 —— 山脊不能是折线 */
    _polySmooth(c, pts) {
      const n = pts.length;
      if (n < 3) { this._poly(c, pts); return; }
      c.beginPath();
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const m0 = mid(pts[n - 1], pts[0]);
      c.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % n]);
        c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
      }
      c.closePath();
    }
    _polyAdd(c, pts) {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
    }
    _edge(c, pts) {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    }

    /* ---------------- 黑场（孔外） ---------------- */
    _black(c) {
      c.fillStyle = '#050604';
      c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(CX, H * 0.5, 40, CX, H * 0.5, H * 1.05);
      g.addColorStop(0, 'rgba(14,16,13,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0.95)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    /* ---------------- 天：峡口一线冷光 ---------------- */
    _sky(c) {
      const g = c.createLinearGradient(0, 0, 0, HZ + 10);
      g.addColorStop(0, '#080A09');
      g.addColorStop(0.40, '#141A16');
      g.addColorStop(0.74, '#2A342D');
      g.addColorStop(1, '#3B463C');
      c.fillStyle = g;
      c.fillRect(0, 0, W, HZ + 10);
      // 峡口的强光（让黑壁立起来）
      const gl = c.createRadialGradient(CX, HZ - 110, 30, CX, HZ - 110, 660);
      gl.addColorStop(0, 'rgba(212,224,212,0.34)');
      gl.addColorStop(0.42, 'rgba(190,204,190,0.12)');
      gl.addColorStop(1, 'rgba(188,202,188,0)');
      c.fillStyle = gl;
      c.fillRect(0, 0, W, HZ + 10);
      // 峡口里翻涌的云气
      for (let i = 0; i < 6; i++) {
        const y = HZ - 40 - i * 52;
        const w = 460 + i * 100;
        const a = 0.05 + i * 0.008;
        const cxx = CX + Math.sin(i * 2.1) * 110;
        const cg = c.createRadialGradient(cxx, y, 0, cxx, y, w);
        cg.addColorStop(0, `rgba(214,222,210,${a})`);
        cg.addColorStop(1, 'rgba(214,222,210,0)');
        c.fillStyle = cg;
        c.save();
        c.translate(cxx, y);
        c.scale(1, 0.20);
        c.beginPath();
        c.arc(0, 0, w, 0, 6.28318);
        c.fill();
        c.restore();
      }
    }

    /* ---------------- 远山（只在江道尽头露头） ---------------- */
    _farWalls(c) {
      // 更远的一层：淡影
      c.save();
      c.globalAlpha = 0.55;
      this._polySmooth(c, FAR_RIDGE);
      const g0 = c.createLinearGradient(0, 420, 0, 540);
      g0.addColorStop(0, '#2A362E');
      g0.addColorStop(1, '#39473C');
      c.fillStyle = g0;
      c.fill();
      c.restore();

      // 近一层：略深，压在水线上
      const ridge2 = FAR_RIDGE.map(([x, y]) => [x, y + 46]);
      this._polySmooth(c, ridge2);
      const g = c.createLinearGradient(0, 470, 0, HZ);
      g.addColorStop(0, '#131A15');
      g.addColorStop(0.55, '#1B241D');
      g.addColorStop(1, '#28332B');
      c.fillStyle = g;
      c.fill();
      // 山脚的雾（软边，无硬框）
      c.save();
      c.translate(CX, HZ - 6);
      c.scale(1, 0.17);
      const mg = c.createRadialGradient(0, 0, 0, 0, 0, 520);
      mg.addColorStop(0, 'rgba(178,194,178,0.30)');
      mg.addColorStop(1, 'rgba(178,194,178,0)');
      c.fillStyle = mg;
      c.beginPath();
      c.arc(0, 0, 520, 0, 6.28318);
      c.fill();
      c.restore();
    }

    /* ---------------- 江面 ---------------- */
    _water(c, tw) {
      HUB.waterMoonShader(c, W, H, tw, {
        horizon: HZ, moonX: CX, moonY: 300, moon: false,
        base: '11,14,13', top: '20,25,21', glint: '222,230,216',
        rows: 140, seed: 5113, moonGain: 0.85, amp: 1.9
      });
      this._current(c, tw);
      this._foam(c, tw);
      this._swell(c, tw);
      this._churn(c, tw);
      // 近岸的暗（把江心留亮，水面向下压深）
      const dk = c.createLinearGradient(0, H - 260, 0, H);
      dk.addColorStop(0, 'rgba(3,4,4,0)');
      dk.addColorStop(1, 'rgba(3,4,4,0.42)');
      c.fillStyle = dk;
      c.fillRect(0, H - 260, W, 260);
    }

    /* 江流的收束线：从江心消失在画面底部（滚滚来的透视） */
    _current(c, tw) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (let i = 0; i < 44; i++) {
        const h1 = hash(6107, i * 5 + 1);
        const h2 = hash(6107, i * 5 + 2);
        const h3 = hash(6107, i * 5 + 3);
        const bx = CX + (h1 * 2 - 1) * 1250;
        const ph = (tw * (0.09 + h2 * 0.15) + h3) % 1;
        for (let k = 0; k < 3; k++) {
          const u0 = (ph + k / 3) % 1;
          if (u0 < 0.06) continue;
          const u1 = Math.min(1, u0 + 0.045 + h2 * 0.07);
          const e0 = Math.pow(u0, 1.75), e1 = Math.pow(u1, 1.75);
          const x0 = lerp(CX, bx, e0), y0 = HZ + (H + 60 - HZ) * e0;
          const x1 = lerp(CX, bx, e1), y1 = HZ + (H + 60 - HZ) * e1;
          const a = (0.10 + 0.16 * h2) * (1 - u0 * 0.35) * (0.35 + 0.65 * Math.abs(bx - CX) / 1250);
          c.globalAlpha = a;
          c.strokeStyle = 'rgba(228,236,222,1)';
          c.lineWidth = 0.8 + e0 * 3.2;
          c.beginPath();
          c.moveTo(x0, y0);
          c.lineTo(x1, y1);
          c.stroke();
        }
      }
      c.restore();
    }

    /* 浮沫白线：顺着江流向右疾走 */
    _foam(c, tw) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (let i = 0; i < 92; i++) {
        const k = hash(7101, i * 5 + 1);
        const y = HZ + 10 + Math.pow(k, 1.55) * (H - HZ - 10);
        const dep = (y - HZ) / (H - HZ);
        const sp = 26 + dep * 230;
        const x0 = hash(7101, i * 5 + 2) * (W + 520);
        const x = (x0 + tw * sp) % (W + 520) - 260;
        const len = (26 + dep * 170) * (0.5 + hash(7101, i * 5 + 3));
        const a = (0.09 + 0.34 * hash(7101, i * 5 + 4)) * (0.35 + dep * 0.65);
        const wob = Math.sin(tw * 2.3 + i) * (1 + dep * 4);
        c.globalAlpha = 1;
        c.strokeStyle = `rgba(230,236,224,${a})`;
        c.lineWidth = 0.9 + dep * 3.4;
        c.beginPath();
        c.moveTo(x, y + wob);
        c.lineTo(x + len, y + wob + Math.sin(tw * 1.6 + i * 0.7) * 1.8);
        c.stroke();
        if (i % 3 === 0) {
          c.globalAlpha = 0.7;
          c.fillStyle = `rgba(240,244,236,${a * 0.9})`;
          c.beginPath();
          c.arc(x + len + 6, y + wob, 0.9 + dep * 2.4, 0, 6.28318);
          c.fill();
        }
      }
      c.restore();
    }

    /* 近景的碎浪（江水的"怒"） */
    _swell(c, tw) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const y0 = H * (0.76 + i * 0.055);
        const amp = 9 + i * 5;
        const ph = tw * (1.5 - i * 0.16) + i * 2.1;
        const n = 34;
        for (let j = 0; j < n; j++) {
          const h1 = hash(9311, i * 61 + j * 3 + 1);
          const h2 = hash(9311, i * 61 + j * 3 + 2);
          const x = ((j + h1 * 0.8) / n) * (W + 300) - 150 + ((tw * (70 + i * 26)) % 70);
          const yy = y0 + Math.sin(x * 0.0072 + ph) * amp + Math.sin(x * 0.019 - ph * 1.3) * amp * 0.4;
          const len = (16 + h2 * 54) * (0.6 + i * 0.14);
          const a = (0.10 + 0.26 * h2) * (0.7 + i * 0.1);
          c.globalAlpha = a;
          c.strokeStyle = 'rgba(234,240,230,1)';
          c.lineWidth = 1.1 + i * 0.7;
          c.beginPath();
          c.moveTo(x, yy);
          c.lineTo(x + len, yy + Math.sin(x * 0.0072 + ph) * 2.2);
          c.stroke();
        }
      }
      c.restore();
    }

    /* 崖脚的撞水白花 + 水雾 */
    _churn(c, tw) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let side = 0; side < 2; side++) {
        const bx = side ? 500 : 1420;
        const dir = side ? 1 : -1;
        for (let i = 0; i < 26; i++) {
          const u = hash(8207, i * 4 + side * 97 + 1);
          const y = HZ + 30 + u * (H - HZ - 60);
          const pulse = 0.5 + 0.5 * Math.sin(tw * (1.4 + u * 2.2) + i * 1.7 + side);
          const w = (18 + u * 62) * (0.5 + pulse * 0.95);
          const x = bx + dir * (10 + u * 110 + Math.sin(tw * 1.8 + i) * 14);
          const a = 0.10 + 0.26 * pulse;
          const g = c.createRadialGradient(x, y, 0, x, y, w);
          g.addColorStop(0, `rgba(238,244,234,${a})`);
          g.addColorStop(1, 'rgba(238,244,234,0)');
          c.fillStyle = g;
          c.save();
          c.translate(x, y);
          c.scale(1, 0.30);
          c.beginPath();
          c.arc(0, 0, w, 0, 6.28318);
          c.fill();
          c.restore();
        }
        // 贴水的水雾
        const mg = c.createLinearGradient(0, HZ - 30, 0, HZ + 150);
        mg.addColorStop(0, 'rgba(206,216,204,0)');
        mg.addColorStop(0.5, 'rgba(206,216,204,0.13)');
        mg.addColorStop(1, 'rgba(206,216,204,0)');
        c.fillStyle = mg;
        c.fillRect(side ? 1400 : 300, HZ - 30, 220, 180);
      }
      c.restore();
    }

    /* ---------------- 近壁（黑如玄铁） ---------------- */
    _nearWalls(c, tw) {
      const pairs = [[NEAR_L, EDGE_L, 6101], [NEAR_R, EDGE_R, 6103]];
      for (const [pts, edge, seed] of pairs) {
        this._poly(c, pts);
        const g = c.createLinearGradient(0, 60, 0, H);
        g.addColorStop(0, '#0A0D10');
        g.addColorStop(0.22, '#06090B');
        g.addColorStop(0.62, '#030507');
        g.addColorStop(1, '#010102');
        c.fillStyle = g;
        c.fill();

        c.save();
        this._poly(c, pts);
        c.clip();
        const r = DFS.rng(seed);
        // 玄铁的暗反光：不规则的折面（绝不再是大矩形补丁）
        for (let i = 0; i < 9; i++) {
          const x = -60 + r() * 860;
          const y = 40 + r() * 360;
          const w2 = 60 + r() * 230, h2 = 140 + r() * 460;
          c.globalAlpha = 0.05 + r() * 0.10;
          c.fillStyle = r() > 0.45 ? 'rgba(30,40,46,1)' : 'rgba(6,8,10,1)';
          c.beginPath();
          const j = () => (r() - 0.5) * 46;
          c.moveTo(x + j(), y + j() * 0.6);
          c.quadraticCurveTo(x + w2 * 0.6, y - 24 + j(), x + w2 + j(), y + h2 * 0.32 + j());
          c.quadraticCurveTo(x + w2 * 0.72, y + h2 * 0.72 + j(), x + w2 * 0.34, y + h2 + j());
          c.quadraticCurveTo(x - w2 * 0.08, y + h2 * 0.62 + j(), x - w2 * 0.05, y + h2 * 0.24);
          c.closePath();
          c.fill();
        }
        // 崖面：枯笔皴擦（不是均匀的竖向划痕）
        const V4L = DFS.V4;
        for (let i = 0; i < 44; i++) {
          const x = -60 + r() * 900;
          const y = 60 + r() * 1000;
          const h2 = 40 + r() * 170;
          const light = r() > 0.55;
          if (V4L) {
            V4L.inkStroke(c, x, y, x + (r() - 0.5) * 46, y + h2, {
              w: 1.4 + r() * 5.2,
              alpha: (light ? 0.10 : 0.16) + r() * 0.16,
              color: light ? '96,116,110' : '2,4,5',
              dry: 0.72, seed: 400 + i
            });
          } else {
            c.globalAlpha = 0.05 + r() * 0.10;
            c.strokeStyle = light ? 'rgba(92,110,106,1)' : 'rgba(4,6,8,1)';
            c.lineWidth = 1.2 + r() * 7;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + (r() - 0.5) * 30, y + h2);
            c.stroke();
          }
        }
        // 石裂
        for (let i = 0; i < 8; i++) {
          let x = -60 + r() * 760, y = 80 + r() * 900;
          c.globalAlpha = 0.03 + r() * 0.05;
          c.strokeStyle = 'rgba(140,160,152,1)';
          c.lineWidth = 0.9 + r() * 1.6;
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (r() - 0.5) * 46;
            y += 24 + r() * 60;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        c.restore();

        // 内缘冷边光（把黑壁从黑天里分出来）
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.lineJoin = 'round';
        c.globalAlpha = 0.55;
        c.strokeStyle = 'rgba(150,170,164,0.26)';
        c.lineWidth = 2.4;
        this._edge(c, edge);
        c.stroke();
        c.globalAlpha = 0.20 * (0.85 + 0.15 * Math.sin(tw * 0.7));
        c.strokeStyle = 'rgba(196,212,204,0.6)';
        c.lineWidth = 7;
        this._edge(c, edge);
        c.stroke();
        c.restore();
      }
      // 崖脚贴水的一层黑雾
      const g = c.createLinearGradient(0, H - 190, 0, H);
      g.addColorStop(0, 'rgba(2,3,3,0)');
      g.addColorStop(1, 'rgba(2,3,3,0.58)');
      c.fillStyle = g;
      c.fillRect(0, H - 190, W, 190);
    }

    /* ---------------- 天光：峡口的水汽光（无硬边） ---------------- */
    _light(c, tw) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const cx2 = CX + (i - 1) * 160 + Math.sin(tw * 0.20 + i * 1.6) * 34;
        const cy2 = 300 + i * 60;
        const rx = 150 + i * 60;
        c.save();
        c.translate(cx2, cy2);
        c.scale(1, 2.9);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(216,228,214,${0.085 - i * 0.018})`);
        g.addColorStop(0.55, `rgba(210,222,208,${0.030 - i * 0.006})`);
        g.addColorStop(1, 'rgba(210,222,208,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, rx, 0, 6.28318);
        c.fill();
        c.restore();
      }
      // 江道尽头的一团亮水汽（长江在此转弯）
      c.save();
      c.translate(CX, HZ + 6);
      c.scale(1, 0.20);
      const gg = c.createRadialGradient(0, 0, 0, 0, 0, 520);
      gg.addColorStop(0, 'rgba(214,226,212,0.20)');
      gg.addColorStop(0.5, 'rgba(206,218,204,0.07)');
      gg.addColorStop(1, 'rgba(206,218,204,0)');
      c.fillStyle = gg;
      c.beginPath();
      c.arc(0, 0, 520, 0, 6.28318);
      c.fill();
      c.restore();
      c.restore();
    }

    /* ---------------- 落木 + 触水白环 ---------------- */
    _leaves(c, L, tw) {
      const f = clamp((L - T_LEAF) / 0.75);
      if (f <= 0.01) return;
      const a = 0.92 * f * (1 - 0.34 * clamp((L - T_HOLD) / 0.9));
      const lt = L * LEAF_T;

      c.save();
      c.beginPath();
      c.rect(0, -20, W, LAND + 18);
      c.clip();
      this.leaves.alpha = a;
      this.leaves.draw(c, lt, {});
      c.restore();

      // 触水：3px 小白环
      c.save();
      c.lineCap = 'round';
      for (const d of this.leafLand) {
        const k = Math.floor((lt - d.a) / d.P);
        const tc = d.a + k * d.P;
        const age = lt - tc;
        if (age < 0 || age > RING_LIFE) continue;
        const x = d.xb + tc * d.dx + Math.sin(tc * 1.1 + d.i) * 40 * (0.4 + d.r1);
        if (x < 516 || x > 1404) continue;
        const u = age / RING_LIFE;
        const rr = 1.2 + u * 2.4;
        const al = 0.55 * (1 - u) * a;
        if (al <= 0.01) continue;
        const y = LAND + Math.sin(x * 0.012) * 2;
        c.strokeStyle = `rgba(240,246,238,${al})`;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(x, y, rr, rr * 0.46, 0, 0, 6.28318);
        c.stroke();
        if (u < 0.18) {
          c.fillStyle = `rgba(248,252,246,${0.5 * (1 - u / 0.18)})`;
          c.beginPath();
          c.arc(x, y, 1.3, 0, 6.28318);
          c.fill();
        }
      }
      c.restore();
    }

    /* ---------------- 孤舟 + 船头小灯 ---------------- */
    _boat(c, tw) {
      const inP = clamp((tw - 0.55) / 1.3);
      if (inP <= 0.01) return;
      const a = Ease.outCubic(inP);
      const bx = lerp(B_X0, B_X1, Ease.inOutCubic(clamp(tw / 9.5)));
      const by = B_Y + Math.sin(tw * 1.15) * 4.2 + Math.sin(tw * 2.4) * 1.6;

      c.save();
      c.globalAlpha = a;
      const dg = c.createRadialGradient(bx, by + 6, 4, bx, by + 6, 150);
      dg.addColorStop(0, 'rgba(3,4,4,0.60)');
      dg.addColorStop(1, 'rgba(3,4,4,0)');
      c.fillStyle = dg;
      c.beginPath();
      c.ellipse(bx, by + 10, 152, 30, 0, 0, 6.28318);
      c.fill();

      DFS.boat(c, bx - 2.6, by - 2.2, B_S, {
        color: '176,190,180', alpha: 0.34, t: tw, figure: true, figureColor: '170,184,174'
      });
      DFS.boat(c, bx, by, B_S, {
        color: '5,6,7', alpha: 0.98, t: tw, figure: true, figureColor: '4,5,6'
      });

      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = 'rgba(220,228,216,1)';
      for (let k = 0; k < 4; k++) {
        const d = 44 + k * 26;
        const yy = by + 13 + Math.sin(tw * 1.5 + k) * 2.4;
        c.globalAlpha = a * (0.24 - k * 0.045);
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(bx - d, yy);
        c.lineTo(bx - d - 30 - k * 12, yy + 1.8);
        c.stroke();
      }

      // 船头一盏小灯（暖黄 3px + 12px 光晕），随浪起伏而位置稳定
      const bob = Math.sin(tw * 1.5) * 1.6;
      const lx = bx + 70 * B_S;
      const ly = by + (-8 + bob) * B_S;
      const flick = 0.84 + 0.16 * Math.sin(tw * 5.2) * Math.sin(tw * 1.7 + 1.1);
      c.globalAlpha = a * flick;
      c.globalCompositeOperation = 'lighter';
      const hg = c.createRadialGradient(lx, ly, 0, lx, ly, 12);
      hg.addColorStop(0, 'rgba(255,214,150,0.62)');
      hg.addColorStop(0.35, 'rgba(255,196,120,0.26)');
      hg.addColorStop(1, 'rgba(255,190,110,0)');
      c.fillStyle = hg;
      c.beginPath();
      c.arc(lx, ly, 12, 0, 6.28318);
      c.fill();
      c.fillStyle = 'rgba(255,236,196,0.95)';
      c.beginPath();
      c.arc(lx, ly, 1.7, 0, 6.28318);
      c.fill();
      c.globalAlpha = a * 0.34 * flick;
      c.strokeStyle = 'rgba(255,206,140,1)';
      c.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) {
        const yy = by + 12 + k * 7 + Math.sin(tw * 2 + k) * 1.4;
        const w = 8 - k * 1.2;
        c.beginPath();
        c.moveTo(lx - w, yy);
        c.lineTo(lx + w, yy);
        c.stroke();
      }
      c.restore();
    }

    /* ---------------- 竖排大字（句读律动：杜诗吟诵） ---------------- */
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
          { duration: 0.80, rise: 26, scaleFrom: 0.98 });
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

    /* ---------------- 下方居中一句 ---------------- */
    _noteText(c, text, o) {
      const V4 = DFS.V4;
      if (V4 && V4.cue(o.id)) {
        const m = V4.chantLine(c, text, {
          id: o.id, L: o.L, x: CX, y: o.y, size: o.size, weight: o.weight || 500,
          family: T.fonts.serif, color: o.color, tracking: 3,
          seed: o.seed || 5, alpha: o.alpha === undefined ? 1 : o.alpha, halo: 0.5
        });
        if (m) DFS.dbgBox(o.id, m.x - 6, m.y, m.x + m.w + 6, m.y + m.h);
        return;
      }
      const e = HUB.multiEntrance(o.L, o.start, { duration: 0.85, rise: 18, scaleFrom: 0.99 });
      if (e.alpha <= 0.008) return;
      const chars = Array.from(text);
      const size = o.size;
      const tracking = 3;
      const m = meas();
      m.font = DFS.font(size, o.weight ?? 500, T.fonts.serif);
      let total = tracking * (chars.length - 1);
      for (const ch of chars) total += m.measureText(ch).width;
      let cursor = CX - total / 2;
      const mm = HUB.idleMicroMotion(o.t, 4.4);
      for (let i = 0; i < chars.length; i++) {
        const w = m.measureText(chars[i]).width;
        const ee = HUB.multiEntrance(o.L, o.start + i * 0.018, { duration: 0.7, rise: 12 });
        if (ee.alpha > 0.008) {
          V3.inkText(c, chars[i], {
            x: cursor + w / 2,
            y: o.y + e.dy * 0.6 + mm.dy * 0.3,
            size, weight: o.weight ?? 500, family: T.fonts.serif,
            color: o.color, alpha: ee.alpha * (o.alpha ?? 1), seed: (o.seed ?? 5) + i
          });
        }
        cursor += w + tracking;
      }
      DFS.dbgBox(o.id, CX - total / 2 - 6, o.y - size * 0.7, CX + total / 2 + 6, o.y + size * 0.7);
    }

    /* ---------------- 排版层 ---------------- */
    _text(c, L, t) {
      const st = DFS.STORY.texts;
      const e0 = HUB.multiEntrance(L, 6.90, { duration: 0.8, rise: 0 });
      if (e0.alpha > 0.01) {
        c.save();
        c.translate(CX, 930);
        c.scale(1, 0.22);
        const vg = c.createRadialGradient(0, 0, 30, 0, 0, 430);
        vg.addColorStop(0, `rgba(3,4,4,${0.60 * e0.alpha})`);
        vg.addColorStop(1, 'rgba(3,4,4,0)');
        c.fillStyle = vg;
        c.beginPath();
        c.arc(0, 0, 430, 0, 6.28318);
        c.fill();
        c.restore();
      }
      this._colText(c, st.s05_a, {
        id: 's05_a', x: 1700, top: 198, size: 78, gap: 1.10, start: 5.60, L, t, color: INK, seed: 21
      });
      this._colText(c, st.s05_b, {
        id: 's05_b', x: 1600, top: 214, size: 78, gap: 1.10, start: 6.50, L, t, color: INK, seed: 37
      });
      this._noteText(c, st.s05_note, {
        id: 's05_note', y: 930, size: 34, start: 6.90, L, t,
        color: 'rgba(244,239,230,0.86)', weight: 500, seed: 11
      });
    }

    /* ---------------- 峡江全幅 ---------------- */
    _gorge(ctx, L, t) {
      const tw = L <= T_HOLD ? L : T_HOLD + (L - T_HOLD) * 0.35;
      const zin = 1 + 0.085 * (1 - Ease.outCubic(clamp(L / 2.4)));
      ctx.save();
      ctx.translate(CX, H * 0.56);
      ctx.scale(zin, zin);
      ctx.translate(-CX, -H * 0.56);

      V3.eight(ctx, t, {
        l1: (c) => this._sky(c),
        grade: 'cold', grain: 0.50, vignette: 0.36, vignetteMid: 0.05,
        dustAlpha: 0.16, dustOpts: { count: 80, color: '200,208,196', seed: 6141 },
        l2: (c) => {
          this._farWalls(c);
          this._water(c, tw);
          this._light(c, tw);
          this._nearWalls(c, tw);
        },
        l4: (c) => {
          this._leaves(c, L, tw);
          this._boat(c, tw);
        },
        l5: (c) => this._text(c, L, t)
      });
      ctx.restore();
    }

    draw(ctx, L, t) {
      DFS.dbg({ leafParticles: 260 });
      const portal = clamp(L / 1.50);
      if (portal < 0.999) {
        // cinematicPortalWipe 内部是 easeInExpo，这里反解，让圆孔匀速张开
        const want = Ease.inOutCubic(portal);
        const fed = clamp(1 + Math.log2(Math.max(1e-7, want)) / 10, 0, 1);
        HUB.cinematicPortalWipe(ctx, CX, H * 0.5, fed,
          (c) => this._black(c),
          (c) => this._gorge(c, L, t),
          { edgeColor: 'rgba(214,222,208,0.55)' });
      } else {
        this._gorge(ctx, L, t);
      }
    }

    hudDark() { return true; }
  };
})(window.DFS);
