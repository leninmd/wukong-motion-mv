/* =========================================================================
   s02_typeworld.js — 10.2–24.3s（L 0..14.1）· 绝顶
   0.0–2.8   两组点云群山自对数螺旋升腾：远山青绿 #3E5147 / 近山墨黑 #1A1A18
             cam.z −14 → −8，focus 0.15 → 0.35，yaw 缓转；底色 paper → 叠 30% 冷雾
   2.8–4.5   45° 俯角沿山脊高速下压 → 猛烈上摇拉起（pitch −0.55 → −0.02，pos.y 8 → 2.2）
             山脊细墨线作运动参照，三重复本拉出残影
   4.6–6.4   拉起完成：孤石 + 背对镜头的人影（竹杖）+ 云海；群峰缩成脚下墨点
   7.8–14.1  静帧 Hold：75% 留白
   文字全部取自 storyboard.v3.json：s02_a / s02_b / s02_note / s02_year，逐字照抄。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const T = DFS.THEME;
  const HUB = DFS.HUB;
  const V3 = DFS.V3;

  /* ---------- 群山 ---------- */
  const RIDGE_W = 34, RIDGE_H = 7.2;
  // 与 RidgeCloud 同一套山形，才让"实心山体 + 点云"重合
  const PEAKS = [
    [[-11, 4.2, 1.00], [-2.5, 3.0, 0.82], [7, 4.6, 1.05], [15, 2.6, 0.60]],
    [[-7, 5.0, 0.86], [3, 4.2, 1.00], [12, 3.2, 0.70]],
    [[-1.5, 3.4, 1.00], [1.5, 2.2, 0.72]]
  ];
  const RIDGE_BASE = [0.12, 0.08, 0.05];

  /* ---------- 诗（右侧竖排，右起） ---------- */
  const POEM_SIZE = 82, POEM_GAP = 1.18;
  const POEM_CY = 428;                       // 竖排块中心 → 首字顶 ≈ 190
  const POEM_A_X = 1700, POEM_B_X = 1595;
  const POEM_H = POEM_SIZE * POEM_GAP * 5 + POEM_SIZE * 0.6;

  /* ---------- 落款 / 纪年 ---------- */
  const NOTE_SIZE = 26, YEAR_SIZE = 20;
  const NOTE_R = 1745, NOTE_Y = 754, YEAR_Y = 794;
  const T_NOTE = 8.90, T_YEAR = 9.10;

  /* ---------- 孤石 ---------- */
  const ROCK_X = 700, ROCK_Y = 770, ROCK_W = 280, ROCK_H = 90;

  DFS.sceneRegistry['s02'] = class Scene02V3 {
    constructor() {
      this.far = new DFS.RidgeCloud({ count: 12000, width: RIDGE_W, height: RIDGE_H, depth: 11, seed: 7028 });
      this.near = new DFS.RidgeCloud({ count: 28000, width: RIDGE_W, height: RIDGE_H, depth: 9, seed: 5121 });
      this.cam = new DFS.Camera({ pos: { x: 0, y: 8, z: -14 }, yaw: 0.10, pitch: -0.46 });
      this.camFar = new DFS.Camera({ pos: { x: 8, y: 46, z: -44 }, yaw: 0.02, pitch: -0.34 });
      const texts = (DFS.STORY && DFS.STORY.texts) || {};
      this.a = texts.s02_a || '';
      this.b = texts.s02_b || '';
      this.note = texts.s02_note || '';
      this.year = texts.s02_year || '';
      this._ridge = this._buildRidge();
      this._rock = this._buildRock();
    }

    /* 山脊线（运动参照）：一条主脊 + 三处峰，归一化高度 0..1.3 */
    _buildRidge() {
      const r = DFS.rng(9142);
      const pts = [];
      const N = 72;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = -90 + u * (W + 180);
        const h = 0.42 * Math.exp(-Math.pow((u - 0.17) / 0.085, 2))
          + 0.95 * Math.exp(-Math.pow((u - 0.46) / 0.095, 2))
          + 0.60 * Math.exp(-Math.pow((u - 0.73) / 0.075, 2))
          + 0.30 * Math.exp(-Math.pow((u - 0.91) / 0.065, 2))
          + 0.025 * (r() - 0.5);
        pts.push({ x, h: Math.max(0.02, h) });
      }
      return pts;
    }

    /* 孤石：宽顶、陡壁、崩积底缘（px，相对中心；下半沉进云海） */
    _buildRock() {
      return [
        [-140, -22], [-118, -34], [-86, -27], [-58, -38], [-20, -30],
        [14, -39], [46, -30], [82, -36], [112, -24], [140, -16],
        [147, 6], [136, 28], [118, 46],
        [96, 68], [64, 86], [28, 104], [2, 122],
        [-30, 98], [-58, 80], [-84, 62],
        [-112, 44], [-132, 22], [-147, 2]
      ];
    }

    /* 山体高度场（0..1.2），与 RidgeCloud 的 _ridge 同形 */
    _rh(x, layer) {
      const ps = PEAKS[layer];
      let h = RIDGE_BASE[layer];
      for (let i = 0; i < ps.length; i++) {
        h += ps[i][2] * Math.exp(-Math.pow((x - ps[i][0]) / ps[i][1], 2));
      }
      h += (DFS.fbm(x * 0.22 + layer * 7.3, layer * 3.1, 3) - 0.5) * 0.13;
      return Math.max(0.02, h);
    }

    /* 实心山体：同形轮廓 → 山才立得住；点云再压在表面做颗粒 */
    _mass(c, cam, o) {
      const N = 200;
      const base = o.base ?? -45;          // 底缘沉到画外，避免半透明层的内部接缝
      const squeeze = 1 - o.focus * 0.62;
      for (let layer = 2; layer >= 0; layer--) {
        const zc = (layer - 1) * o.depth * 0.52;
        const hMax = o.height * (0.62 + 0.19 * layer);
        const top = [], bot = [];
        let ok = 0;
        for (let i = 0; i <= N; i++) {
          const xr = -o.width / 2 + (i / N) * o.width;
          const h = this._rh(xr, layer);
          const y = h * hMax * (1 + o.focus * (0.55 - Math.min(0.5, Math.abs(xr) / 16)));
          const x = xr * squeeze;
          const pt = cam.project({ x, y, z: zc });
          const pb = cam.project({ x, y: base, z: zc });
          top.push(pt); bot.push(pb);
          if (pt) ok++;
        }
        if (ok < 2) continue;
        c.beginPath();
        let started = false;
        for (let i = 0; i <= N; i++) {
          const p = top[i];
          if (!p) continue;
          if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y);
        }
        for (let i = N; i >= 0; i--) {
          const p = bot[i];
          if (p) c.lineTo(p.x, p.y);
        }
        c.closePath();
        const aTop = clamp(o.alpha * (0.92 + 0.06 * (2 - layer)));
        let yMin = Infinity, yMax = -Infinity;
        for (let i = 0; i <= N; i++) {
          if (top[i]) { if (top[i].y < yMin) yMin = top[i].y; if (top[i].y > yMax) yMax = top[i].y; }
          if (bot[i]) { if (bot[i].y > yMax) yMax = bot[i].y; }
        }
        if (!isFinite(yMin)) { yMin = 0; yMax = H; }
        const gy0 = yMin, gy1 = Math.max(yMin + 40, Math.min(H * 1.05, yMax));
        const grad = c.createLinearGradient(0, gy0, 0, gy1);
        grad.addColorStop(0, 'rgba(' + o.color + ',' + aTop.toFixed(3) + ')');
        grad.addColorStop(0.30, 'rgba(' + o.color + ',' + (aTop * 0.97).toFixed(3) + ')');
        grad.addColorStop(0.58, 'rgba(' + o.color + ',' + (aTop * 0.88).toFixed(3) + ')');
        grad.addColorStop(0.80, 'rgba(' + o.color + ',' + (aTop * 0.42).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(' + o.color + ',0)');
        c.fillStyle = grad;
        c.fill();
      }
    }

    /* 山脊线基准高度：镜头下压时整条脊线被抬出画面上方，猛拉时又迅速落回 */
    _ridgeBase(LL) {
      if (LL <= 2.90) return 905 + 12 * Math.sin(LL * 0.6);
      const pD = clamp((LL - 2.90) / 1.10);
      const pU = clamp((LL - 3.98) / 0.52);
      return 905 - 720 * Ease.inCubic(pD) + 580 * Ease.outExpo(pU);
    }

    /* 远望的群峰：缩成淡墨山影（绝不再用硬边三角形 —— 那是"廉价屏保"） */
    _peakDots(c, alpha) {
      const V4 = DFS.V4;
      const r = DFS.rng(3357);
      c.save();
      for (let i = 0; i < 30; i++) {
        const x = 40 + r() * (W - 80);
        const y = 862 + r() * 44;
        const h = 6 + r() * 22;
        const w = h * (4.2 + r() * 5.0);
        const a = alpha * (0.07 + r() * 0.20);
        // 山体：上浓下无 —— 山无脚
        const g = c.createLinearGradient(0, y - h, 0, y + 8);
        g.addColorStop(0, 'rgba(28,28,24,' + (a * 1.25).toFixed(4) + ')');
        g.addColorStop(0.55, 'rgba(28,28,24,' + (a * 0.55).toFixed(4) + ')');
        g.addColorStop(1, 'rgba(28,28,24,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - w * 0.5, y + 6);
        c.quadraticCurveTo(x - w * 0.26, y - h * 0.72, x + w * 0.02, y - h * 0.92);
        c.quadraticCurveTo(x + w * 0.30, y - h * 0.50, x + w * 0.5, y + 6);
        c.closePath();
        c.fill();
        // 脊线：一笔淡墨
        if (V4 && h > 14) {
          V4.inkStroke(c, x - w * 0.46, y + 2, x + w * 0.04, y - h * 0.98, {
            w: 1.6 + h * 0.03, alpha: a * 1.4, color: '22,22,19', dry: 0.6, seed: 300 + i
          });
        }
      }
      c.restore();
    }

    /* 三重复本 → 运动残影：贴得近、越淡，才像被速度拉出来的一道烟 */
    _ridgeTrail(c, baseY, dY, alpha) {
      const off0 = clamp(-dY * 0.34, -120, 120);
      const layers = [[0, 0.90, 2.2], [1, 0.46, 1.6], [2, 0.20, 1.1]];
      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (let k = 0; k < layers.length; k++) {
        const off = off0 * layers[k][0];
        c.strokeStyle = 'rgba(22,20,16,' + (alpha * layers[k][1]).toFixed(3) + ')';
        c.lineWidth = layers[k][2];
        c.beginPath();
        for (let i = 0; i < this._ridge.length; i++) {
          const p = this._ridge[i];
          const y = baseY + off - p.h * 300;
          if (i === 0) c.moveTo(p.x, y); else c.lineTo(p.x, y);
        }
        c.stroke();
      }
      c.restore();
    }

    draw(ctx, L, t) {
      /* ---------- 相机 ---------- */
      const pIn = Ease.inOutCubic(clamp(L / 2.8));            // 10.2–13.0 升腾
      const diveP = clamp((L - 2.8) / 1.2);                    // 13.0–14.2 下压
      const whipP = clamp((L - 3.95) / 0.50);                  // 13.95–14.45 猛拉

      const camY = L < 2.8 ? 8.0 : lerp(8.0, 2.2, Ease.inCubic(diveP));
      const camZ = L < 2.8
        ? lerp(-14, -8, pIn)
        : lerp(-8, -6.6, Ease.inOutCubic(clamp((L - 2.8) / 1.6)));
      let pitch = L < 2.8 ? lerp(-0.46, -0.55, pIn) : lerp(-0.55, -0.02, Ease.outExpo(whipP));
      // 拉起后的阻尼余摆（连续，不跳变）
      if (L > 4.42) pitch += Math.exp(-(L - 4.42) * 4.2) * Math.sin((L - 4.42) * 9.0) * 0.020;
      pitch += 0.0016 * Math.sin(L * 0.62);
      const yaw = lerp(0.10, -0.02, pIn) + 0.006 * Math.sin(L * 0.30);

      this.cam.pos = { x: 0.10 * Math.sin(L * 0.22), y: camY, z: camZ };
      this.cam.pitch = pitch;
      this.cam.yaw = yaw;

      /* ---------- 时间线 ---------- */
      const focus = lerp(0.15, 0.35, clamp(L / 5.0));
      const nearA = clamp(L / 1.20) * (1 - clamp((L - 4.00) / 0.45));   // 近山在猛拉中散尽
      const dotA = Ease.inOutCubic(clamp((L - 4.55) / 1.15));           // 群峰缩成墨点
      const cloudA = Ease.inOutCubic(clamp((L - 4.20) / 1.55));         // 云海
      const rockP = HUB.multiEntrance(L, 4.95, { duration: 0.85, rise: 26, scaleFrom: 0.97 });
      const ridgeA = (1 - clamp((L - 4.55) / 0.55)) * clamp((L - 2.55) / 0.35);

      // 俯冲时涌入的白云：遮住山体明暗切换，也把"跌进云海"演出来
      let mistA = 0;
      if (L > 2.9 && L <= 4.15) mistA = 0.72 * Ease.inOutCubic(clamp((L - 2.9) / 1.25));
      else if (L > 4.15) mistA = 0.72 * (1 - Ease.inOutCubic(clamp((L - 4.15) / 1.15)));

      // 升腾：外层旋进 + 放大，收束到静止（对数螺旋感）
      const swirl = 1 - Ease.outCubic(clamp(L / 2.6));

      const poemA = { alpha: 1, dy: 0 };
      const poemB = { alpha: 1, dy: 0 };
      const noteE = HUB.multiEntrance(L, T_NOTE, { duration: 0.70, rise: 10 });
      const yearE = HUB.multiEntrance(L, T_YEAR, { duration: 0.70, rise: 8 });

      // 底色：paper → 30% 冷雾；登顶后空气转清
      const fogBase = 0.30 * Ease.inOutCubic(clamp(L / 2.8))
        * (1 - 0.42 * Ease.inOutCubic(clamp((L - 5.6) / 1.6)));

      V3.eight(ctx, t, {
        grade: 'cold',
        grain: 0.36,
        vignette: 0.24,
        vignetteMid: 0.03,
        dustAlpha: 0.30,
        dustOpts: { color: '226,214,186' },

        /* ---- L1 纸 → 冷雾 ---- */
        l1: (c) => {
          V3.paper(c, {
            zoom: 1.035 + 0.008 * Math.sin(L * 0.09),
            ox: 10 * Math.sin(L * 0.07),
            oy: 6 * Math.cos(L * 0.06)
          });
          if (fogBase > 0.002) {
            const g = c.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, 'rgba(150,164,162,' + (fogBase * 1.02).toFixed(3) + ')');
            g.addColorStop(0.55, 'rgba(156,168,166,' + (fogBase * 0.78).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(140,150,146,' + (fogBase * 0.95).toFixed(3) + ')');
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
          }
          // 顶部留白的微亮（绝顶天光）
          const w2 = c.createLinearGradient(0, 0, 0, H * 0.66);
          w2.addColorStop(0, 'rgba(255,252,242,0.28)');
          w2.addColorStop(1, 'rgba(255,252,242,0)');
          c.fillStyle = w2;
          c.fillRect(0, 0, W, H * 0.66);
        },

        /* ---- L2 山水云 ---- */
        l2: (c) => {
          if (nearA > 0.012) {
            c.save();
            // 对数螺旋升腾：旋进 + 放大 → 落定
            c.translate(W * 0.52, H * 0.66);
            c.rotate(-0.13 * swirl);
            c.scale(1 + 0.20 * swirl, 1 + 0.20 * swirl);
            c.translate(-W * 0.52, -H * 0.66);

            // 远山（青绿）→ 近山（墨黑）：实心山体 + 点云颗粒
            this._mass(c, this.cam, {
              depth: 14, height: RIDGE_H * 1.42, width: RIDGE_W * 2.0,
              color: '96,124,108', alpha: 0.26 * nearA, focus: focus * 0.7
            });
            this.far.draw(c, this.cam, t, {
              alpha: 0.62 * nearA, color: '26,38,32', focus: focus,
              ridgeFn: (x, l) => this._rh(x, l)
            });
            this._mass(c, this.cam, {
              depth: 9, height: RIDGE_H, width: RIDGE_W * 2.0,
              color: '11,11,10', alpha: 1.00 * nearA, focus: focus
            });
            this.near.draw(c, this.cam, t, {
              alpha: 0.80 * nearA, color: '12,12,10', focus: focus,
              ridgeFn: (x, l) => this._rh(x, l)
            });

            // —— V4 天头留白：群山自纸中升起（4.0s 内退净）——
            const skyK = 1 - clamp((L - 2.40) / 1.90);
            if (skyK > 0.01) {
              const sg = c.createLinearGradient(0, 0, 0, H * 0.70);
              sg.addColorStop(0.00, 'rgba(241,237,225,' + (1.00 * skyK).toFixed(3) + ')');
              sg.addColorStop(0.55, 'rgba(241,237,225,' + (0.99 * skyK).toFixed(3) + ')');
              sg.addColorStop(0.72, 'rgba(240,236,224,' + (0.62 * skyK).toFixed(3) + ')');
              sg.addColorStop(1.00, 'rgba(239,235,223,0)');
              c.fillStyle = sg;
              c.fillRect(0, 0, W, H * 0.70);
            }

            // 山脚冷雾：只压山脚，别把山头洗灰
            const g = c.createLinearGradient(0, H * 0.30, 0, H);
            g.addColorStop(0, 'rgba(240,240,232,0)');
            g.addColorStop(0.42, 'rgba(240,240,232,' + (0.12 * nearA).toFixed(3) + ')');
            g.addColorStop(0.70, 'rgba(243,243,235,' + (0.62 * nearA).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(246,246,238,' + (0.95 * nearA).toFixed(3) + ')');
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
            c.restore();
          }

          // 俯冲进云：白光把整帧吃掉，避免"黑屏"，也让山体的明暗转场不跳
          if (mistA > 0.012) {
            const mg = c.createLinearGradient(0, 0, 0, H);
            mg.addColorStop(0, 'rgba(244,246,241,' + clamp(mistA * 1.32).toFixed(3) + ')');
            mg.addColorStop(0.5, 'rgba(249,251,246,' + clamp(mistA * 1.48).toFixed(3) + ')');
            mg.addColorStop(1, 'rgba(240,244,238,' + clamp(mistA * 1.32).toFixed(3) + ')');
            c.fillStyle = mg;
            c.fillRect(0, 0, W, H);
            V3.cloudBank(c, t, {
              count: 9, alpha: 0.5 * mistA, y0: 80, y1: 720, color: '240,243,237'
            });
          }

          // 远望：群峰在脚下缩成墨点
          if (dotA > 0.012) {
            this._peakDots(c, dotA);
            const hz = c.createLinearGradient(0, 796, 0, 1004);
            hz.addColorStop(0, 'rgba(226,230,224,0)');
            hz.addColorStop(0.34, 'rgba(226,230,224,' + (0.40 * dotA).toFixed(3) + ')');
            hz.addColorStop(1, 'rgba(226,230,224,0)');
            c.fillStyle = hz;
            c.fillRect(0, 780, W, 260);
          }

          // 云海（12 层，慢速横移）：暗面 + 亮面，纸太白，云必须带冷灰才看得见
          if (cloudA > 0.012) {
            V3.cloudBank(c, t, {
              count: 12, alpha: 0.20 * cloudA, y0: 884, y1: 1044, color: '170,182,178'
            });
            V3.cloudBank(c, t, {
              count: 9, alpha: 0.44 * cloudA, y0: 840, y1: 972, color: '250,251,246'
            });
          }
        },

        /* ---- L3 绝顶天光（极淡） ---- */
        l3: (c) => {
          if (mistA > 0.4) return;                 // 白云期不需要天光
          c.save();
          c.translate(W * 0.58, -60);
          c.rotate(-0.26);
          V3.volumetricLight(c, t, { count: 3, alpha: 0.034, color: '246,246,235' });
          c.restore();
          // 地平线上一抹极淡的天光
          const g = c.createRadialGradient(W * 0.40, 640, 40, W * 0.40, 640, 640);
          g.addColorStop(0, 'rgba(255,253,244,0.13)');
          g.addColorStop(1, 'rgba(255,253,244,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, W, H);
        },

        /* ---- L4 山脊线 / 孤石 / 人影 / 前层云 ---- */
        l4: (c) => {
          if (ridgeA > 0.012) {
            const b0 = this._ridgeBase(L);
            const b1 = this._ridgeBase(L - 0.11);
            // 白云期不再画黑色脊线（否则像漂在雾里的黑虫）
            this._ridgeTrail(c, b0, b0 - b1, ridgeA * 0.85 * (1 - clamp(mistA * 2.2)));
          }

          if (rockP.alpha > 0.012) {
            const a = rockP.alpha;
            const dy = rockP.dy;
            c.save();
            c.globalAlpha = a;
            c.translate(0, dy);

            // 石下云影（石根埋进云里）
            const sg = c.createRadialGradient(ROCK_X, ROCK_Y + 76, 6, ROCK_X, ROCK_Y + 76, 260);
            sg.addColorStop(0, 'rgba(24,26,22,0.34)');
            sg.addColorStop(1, 'rgba(24,26,22,0)');
            c.fillStyle = sg;
            c.fillRect(ROCK_X - 280, ROCK_Y - 80, 560, 320);

            c.translate(ROCK_X, ROCK_Y);
            // 石体
            c.beginPath();
            for (let i = 0; i < this._rock.length; i++) {
              if (i === 0) c.moveTo(this._rock[i][0], this._rock[i][1]);
              else c.lineTo(this._rock[i][0], this._rock[i][1]);
            }
            c.closePath();
            const rg = c.createLinearGradient(0, -40, 0, 120);
            rg.addColorStop(0, 'rgba(44,45,39,1)');
            rg.addColorStop(0.28, 'rgba(20,20,18,1)');
            rg.addColorStop(0.72, 'rgba(10,10,9,1)');
            rg.addColorStop(1, 'rgba(30,32,28,1)');
            c.fillStyle = rg;
            c.fill();

            // 顶面受光（薄薄一条，别把石头照灰）
            c.beginPath();
            for (let i = 0; i <= 9; i++) {
              const p = this._rock[i];
              if (i === 0) c.moveTo(p[0], p[1]);
              else c.lineTo(p[0], p[1]);
            }
            for (let i = 9; i >= 0; i--) {
              c.lineTo(this._rock[i][0] - 5, this._rock[i][1] + 13);
            }
            c.closePath();
            c.fillStyle = 'rgba(132,134,116,0.30)';
            c.fill();

            // 石纹（只在石面上，别画出轮廓）
            const rr = DFS.rng(8801);
            c.strokeStyle = 'rgba(170,170,150,0.13)';
            c.lineWidth = 1;
            for (let i = 0; i < 12; i++) {
              const y0 = -20 + rr() * 74;
              const x0 = -120 + rr() * 150;
              c.beginPath();
              c.moveTo(x0, y0);
              c.lineTo(x0 + 24 + rr() * 58, y0 + (rr() - 0.5) * 7);
              c.stroke();
            }
            // 石根两道裂隙
            c.strokeStyle = 'rgba(0,0,0,0.35)';
            c.lineWidth = 1.6;
            c.beginPath();
            c.moveTo(-38, -18);
            c.lineTo(-30, 36);
            c.lineTo(-44, 74);
            c.stroke();
            c.beginPath();
            c.moveTo(58, -22);
            c.lineTo(50, 30);
            c.stroke();
            c.restore();

            // 人影：背对镜头，立于石上，竹杖
            DFS.figure(c, ROCK_X - 14, ROCK_Y - 39 - 2 + dy, 0.9, {
              color: '8,8,7', alpha: a, t: L, staff: true, breath: 1
            });
          }

          // 前层云（压住孤石底脚）
          if (cloudA > 0.012) {
            V3.cloudBank(c, t, {
              count: 7, alpha: 0.30 * cloudA, y0: 846, y1: 1052, color: '236,240,234'
            });
          }
        },

        /* ---- L5 竖排诗（杜诗吟诵：二·二·一 句读）+ 落款 ---- */
        l5: (c) => {
          const V4 = DFS.V4;
          const poemTop = POEM_CY - POEM_H / 2 + POEM_SIZE * 0.85;
          const a = V4
            ? V4.chantColumn(c, this.a, {
                id: 's02_a', L, x: POEM_A_X, top: poemTop, size: POEM_SIZE,
                gap: POEM_GAP, weight: 800, color: '#1A1309', seed: 61, halo: 0.42
              })
            : (V3.inkText(c, this.a, {
                x: POEM_A_X, y: POEM_CY, size: POEM_SIZE, weight: 800,
                vertical: true, gap: POEM_GAP, color: '#1A1309', seed: 61
              }) ? true : null);
          if (a) {
            DFS.dbgBox('s02_poem_a', POEM_A_X - 46, POEM_CY - POEM_H / 2 + 20,
              POEM_A_X + 46, POEM_CY + POEM_H / 2 - 30);
          }
          const b = V4
            ? V4.chantColumn(c, this.b, {
                id: 's02_b', L, x: POEM_B_X, top: poemTop, size: POEM_SIZE,
                gap: POEM_GAP, weight: 800, color: '#1A1309', seed: 83, halo: 0.42
              })
            : (V3.inkText(c, this.b, {
                x: POEM_B_X, y: POEM_CY, size: POEM_SIZE, weight: 800,
                vertical: true, gap: POEM_GAP, color: '#1A1309', seed: 83
              }) ? true : null);
          if (b) {
            DFS.dbgBox('s02_poem_b', POEM_B_X - 46, POEM_CY - POEM_H / 2 + 20,
              POEM_B_X + 46, POEM_CY + POEM_H / 2 - 30);
          }

          // 两列下方：落款 + 纪年（右对齐）
          if (noteE.alpha > 0.008) {
            c.save();
            c.globalAlpha = 0.94 * noteE.alpha;
            c.fillStyle = 'rgb(64,56,42)';
            c.textAlign = 'right';
            c.textBaseline = 'middle';
            c.font = DFS.font(NOTE_SIZE, 400, T.fonts.kai);
            c.fillText(this.note, NOTE_R, NOTE_Y + noteE.dy);
            c.restore();
          }
          if (yearE.alpha > 0.008) {
            c.save();
            c.globalAlpha = 0.80 * yearE.alpha;
            c.fillStyle = 'rgb(64,56,42)';
            c.textAlign = 'right';
            c.textBaseline = 'middle';
            c.font = DFS.font(YEAR_SIZE, 400, T.fonts.serif);
            c.fillText(this.year, NOTE_R, YEAR_Y + yearE.dy);
            c.restore();
          }
          if (noteE.alpha > 0.008) {
            DFS.dbgBox('s02_note', NOTE_R - 210, NOTE_Y - 18, NOTE_R + 6, YEAR_Y + 18);
          }
        }
      });
    }

    hudDark() { return false; }
  };
})(window.DFS);
