/* =========================================================================
   s04_gao.js — 全片 38.1–54.3s「安得广厦千万间」（L = 0 .. 16.2）
   -------------------------------------------------------------------------
   0.00–3.40  38.1–41.5  暴雨毁屋
        · 夜底 void（#0A0A08 径向渐变）+ 低空雷雨光
        · V3.spearRain 1100 柄「黑矛」，画面下 1/3 一座破茅屋剪影
        · 0.70（38.8s）起屋顶自右向左被掀开：clip 逐段消失 + 飞散茅草 800 颗
   3.40–6.90  41.5–45.0  子弹时间 + 金茅升空
        · 白光闪 + HUB.cameraShake(amp 10)
        · 雨速倍率 γ：1.0 → 0.02（0.30s）。用「雨相位积分」驱动 spearRain，
          故雨丝是减速而非倒流；凝滞后以 620 颗悬停圆珠接管（半径 2–5，
          内亮外暗 + 左上高光）
        · 800 颗被卷走的茅草沿黄金螺旋升空：r = r0(1−0.55u)，角持续增大，
          y 向上加速，色 #8A6320 → #F2D79A
   6.90–10.40 45.0–48.5  广厦晶格成形
        · V3.CelestialLattice（46 座 / spread 26 / baseY 6.0）3.2s 生长
        · 相机贴地（pos.y 1.15, z −10），殿宇向天顶与深空无限延展
        · V3.hallWire 金色线框（213,168,84）+ lattice.lightShafts 檐下泄光
        · 7.40 地面：泥水（低饱和深灰蓝 + 微反射）+ 褴褛老翁剪影（x≈780,y≈830）
   10.40–16.2 48.5–54.3  终极静帧 Hold
        · 只留：晶格 alpha 0.85→1.0 呼吸、光柱微摆、气溶胶、雨珠上飘
        · 四行文字全部原典，全部 V3.inkText
   -------------------------------------------------------------------------
   层次：l1 void / l2 屋与山（含晶格、泥水、老翁）/ l3 体积光 / l4 雨·粒子·刚体
         / l5 排版。禁用 Math.random / Date.now / ctx.filter。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, FPS, clamp, lerp, hash, rng } = DFS;
  const Ease = DFS.Ease;
  const HUB = DFS.HUB;
  const V3 = DFS.V3;
  const T = DFS.THEME;

  const CX = W * 0.5;
  const CY = H * 0.5;

  /* ---------------- 时间节点（场景内秒；38.1s 处 L=0） ---------------- */
  const T0 = 25.4;          // V4 章节全局起点
  const T_TEAR0 = 0.70;     // 38.8  屋顶开始被掀
  const T_TEAR1 = 2.45;
  const T_FLASH = 3.40;     // 41.5  白光 / 震屏 / 子弹时间
  const G_DUR = 0.30;       // γ 衰减时长
  const T_SPIRAL = 3.40;    // 金茅开始螺旋升空
  const T_LATTICE = 6.90;   // 45.0  晶格生长
  const T_GROUND = 7.40;    // 45.5  泥水 + 老翁
  const T_SAGE = 7.55;
  const T_TEXT = 8.05;      // V4 终极静帧（文字与广厦一同生长）
  const T_HOLD = 8.00;
  const G_FLOOR = 0.02;     // 子弹时间残余雨速

  const GOLD = '213,168,84';
  const CREAM = '#F4EFE6';
  const CINNABAR = '#D9381E';

  /* ---------------- 构图常量 ---------------- */
  const HZ = 636;                       // 泥水地平线
  const SAGE_X = 780, SAGE_Y = 830;     // 老翁（很小）
  const SPIRAL_CX = 960, SPIRAL_CY = 545;

  /* ---------------- 原典文字（storyboard.v3.json → texts） ----------------
     一个字都不许改；本场只做排版。                                     */
  const TEXTS = {
    s04_a: '安得广厦千万间',
    s04_b: '大庇天下寒士俱欢颜',
    s04_c: '风雨不动安如山',
    s04_oath: '呜呼！何时眼前突兀见此屋，吾庐独破受冻死亦足！'
  };

  /* ---------------- 雨相位积分：γ 1 → 0.02 的减速（不是倒流） -------------
     spearRain 的纵向位置 ∝ t·speed·timeScale。直接改 timeScale 会让雨丝
     瞬间后退；这里改为对 γ 积分得到"有效时间"，雨丝只会减速直至悬停。   */
  function rainPhase(L) {
    if (L <= T_FLASH) return L;
    const u = clamp((L - T_FLASH) / G_DUR);
    const seg = G_DUR * (u - 0.49 * u * u);          // ∫(1−0.98u)du · 0.30
    const rest = Math.max(0, L - T_FLASH - G_DUR) * G_FLOOR;
    return T_FLASH + seg + rest;
  }
  const TF_EFF = T0 + rainPhase(T_FLASH + G_DUR);    // 雨丝彻底凝滞的那一刻

  /* ======================================================================
     场景
     ====================================================================== */
  DFS.sceneRegistry['s04'] = class Scene04Guangsha {
    constructor() {
      /* --- 相机：贴地仰拍。殿宇在头顶，向天顶与深空无限延展 --- */
      this.cam = new DFS.Camera({
        pos: { x: 0, y: 1.15, z: -10 },
        yaw: 0,
        pitch: 0.30,
        fov: 1.15
      });

      /* --- 天上广厦：46 座重檐庑殿顶线框 --- */
      this.lattice = new V3.CelestialLattice({ count: 46, spread: 26, baseY: 6.0, seed: 2024 });
      // 只保留能进画的实例：最近处几座会以数十倍尺寸从画外扫过，纯粹浪费且脏画
      this.lattice.items = this.lattice.items.filter((it) => {
        const p = this.cam.project({ x: it.x, y: it.y, z: it.z });
        return !!p && p.z > 9.2 && p.y > -260 && p.y < H + 400;
      });

      this._buildThatch();
      this._buildBeads();
      this._buildRigid();
    }

    /* ------------------------------------------------------------------
       800 颗茅草：先被风卷离屋顶，41.5s 起改由黄金螺旋接管
       ------------------------------------------------------------------ */
    _buildThatch() {
      const r = rng(9301);
      const out = [];
      const K = 1.15;
      for (let i = 0; i < 800; i++) {
        const rx = 506 + r() * 730;
        // 屋顶自右向左被掀：右侧的茅草先离屋
        const order = 1 - (rx - 506) / 730;
        const birth = T_TEAR0 + order * (T_TEAR1 - T_TEAR0) * 0.92 + r() * 0.12;
        const surf = this.roofSurfY(rx);
        const y0 = surf + 6 + r() * 96;
        const vx = 22 + r() * 150;
        const vy = -(64 + r() * 300);
        const ageEnd = T_SPIRAL - birth;
        const f = (1 - Math.exp(-ageEnd * K)) / K;
        const bx = rx + vx * f;
        const by = y0 + vy * f;
        const rr = Math.hypot(bx - SPIRAL_CX, by - SPIRAL_CY);
        out.push({
          x0: rx, y0, vx, vy, birth,
          len: 4 + r() * 9,
          lw: 0.9 + r() * 1.8,
          ph: r() * 6.283,
          // 螺旋参数（预烘焙，保证换帧纯函数）
          r0: Math.min(rr, 760),
          a0: Math.atan2(by - SPIRAL_CY, bx - SPIRAL_CX),
          spin: 3.1 + r() * 2.1,
          arm: (i % 3) * 2.0944
        });
      }
      this.thatch = out;
    }

    /* ---------------- 620 颗悬停雨珠（与凝滞雨丝同一坐标系） ---------------- */
    _buildBeads() {
      const out = [];
      const spanY = H * 1.5;
      for (let i = 0; i < 620; i++) {
        const r1 = hash(8801, i * 3 + 1);
        const r2 = hash(8801, i * 3 + 2);
        const r3 = hash(8801, i * 3 + 3);
        const sp = 1180 * (0.75 + r3 * 0.55);
        const y = ((r2 * spanY + TF_EFF * sp) % spanY) - H * 0.25;
        const x = r1 * W * 1.3 - W * 0.15 + y * (-0.30) * 0.4;
        out.push({
          x, y,
          r: 2 + r3 * 3,
          b: Math.min(2, Math.floor(r1 * 3)),      // 透明度分桶
          gold: (i % 11) === 0,
          sway: r2
        });
      }
      this.beads = out;
    }

    /* ---------------- 12 块被掀飞的屋面刚体 ---------------- */
    _buildRigid() {
      const r = rng(6613);
      const out = [];
      for (let i = 0; i < 12; i++) {
        const x0 = 560 + r() * 640;
        const y0 = 790 + r() * 116;
        const order = 1 - (x0 - 560) / 640;
        out.push({
          x0, y0,
          birth: T_TEAR0 + order * (T_TEAR1 - T_TEAR0) * 0.9,
          vx: 30 + r() * 130,
          vy: -(30 + r() * 130),
          s: 10 + r() * 22,
          spin: 1.6 + r() * 3.4,
          land: 940 + r() * 46
        });
      }
      this.rigid = out;
    }

    /* ------------------------------------------------------------------
       震屏：只在 41.5s 之后生效（cameraShake 之前会被 max(0,·) 拉成满幅）
       ------------------------------------------------------------------ */
    _shake(t, L) {
      if (t < T0 + T_FLASH) return { x: 0, y: 0 };
      return HUB.cameraShake(Math.round(t * FPS), {
        amp: 10, decay: 7, startFrame: Math.round((T0 + T_FLASH) * FPS), seed: 11
      });
    }

    /* ==================================================================
       L1 —— 夜底 void + 被雷电照亮的低云（必须在屋与山之后，否则会照亮剪影）
       ================================================================== */
    _sky(ctx, L) {
      const g = ctx.createRadialGradient(CX, H * 0.44, 60, CX, H * 0.5, H * 1.15);
      g.addColorStop(0, '#121718');
      g.addColorStop(0.44, '#0A0D0E');
      g.addColorStop(0.80, '#060809');
      g.addColorStop(1, '#020303');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const stormA = 1 - clamp((L - (T_FLASH - 0.15)) / 0.9);
      if (stormA <= 0.004) return;

      // 横亘在屋脊后方的一大片低云
      ctx.save();
      ctx.translate(820, 660);
      ctx.scale(1, 0.30);
      const s1 = ctx.createRadialGradient(0, 0, 30, 0, 0, 1180);
      s1.addColorStop(0, `rgba(118,132,138,${0.40 * stormA})`);
      s1.addColorStop(0.42, `rgba(86,100,106,${0.22 * stormA})`);
      s1.addColorStop(0.75, `rgba(58,70,76,${0.08 * stormA})`);
      s1.addColorStop(1, 'rgba(50,60,66,0)');
      ctx.fillStyle = s1;
      ctx.beginPath();
      ctx.arc(0, 0, 1180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 屋脊后的一线天光：把屋顶与远山"剥"成剪影
      ctx.save();
      ctx.translate(870, 700);
      ctx.scale(1, 0.13);
      const s2 = ctx.createRadialGradient(0, 0, 20, 0, 0, 760);
      s2.addColorStop(0, `rgba(146,162,168,${0.30 * stormA})`);
      s2.addColorStop(0.5, `rgba(104,118,124,${0.14 * stormA})`);
      s2.addColorStop(1, 'rgba(80,92,98,0)');
      ctx.fillStyle = s2;
      ctx.beginPath();
      ctx.arc(0, 0, 760, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ==================================================================
       L2 —— 屋与山 / 泥水 / 老翁 / 天上广厦
       ================================================================== */
    _world(ctx, L, t) {
      const hutA = 1 - clamp((L - 5.55) / 1.25);       // 43.65 → 44.9 沉入泥水
      const hutSink = (1 - hutA) * 86;                 // 边淡边往下沉

      if (hutA > 0.004) this._farRidge(ctx, L, hutA);
      this._water(ctx, L, t);
      if (hutA > 0.004) this._hut(ctx, L, t, hutA, hutSink);
      this._sage(ctx, L, t);
      this._lattice(ctx, L, t);
      this._reflection(ctx, L, t);
      this._horizonMist(ctx, L);
    }

    /* ---------------- 远山：三层压得很低的墨线 ---------------- */
    _farRidge(ctx, L, a) {
      ctx.save();
      ctx.globalAlpha = a;
      const layer = (amp, base, shift, alpha, color) => {
        const yAt = (x) => base + (DFS.fbm(x * 0.0011 + shift, 1.7 + shift, 4) - 0.5) * amp
          - Math.pow(clamp(1 - Math.abs(x - 760) / 1340), 2) * amp * 0.5;
        ctx.beginPath();
        ctx.moveTo(-40, H);
        for (let x = -40; x <= W + 40; x += 40) ctx.lineTo(x, yAt(x));
        ctx.lineTo(W + 40, H);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      layer(96, 706, 3.1, a, 'rgba(13,17,18,0.72)');
      layer(128, 748, 7.7, a, 'rgba(8,11,12,0.90)');

      // 山脚雾：把脊线化进夜里的湿气（不要一条硬线横切画面）
      const fog = ctx.createLinearGradient(0, 640, 0, 900);
      fog.addColorStop(0, 'rgba(24,30,32,0)');
      fog.addColorStop(0.45, 'rgba(22,28,30,0.26)');
      fog.addColorStop(1, 'rgba(12,16,17,0.86)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 640, W, 280);
      ctx.restore();
    }

    /* ---------------- 破茅屋（三角屋顶 + 屋身 + 毛边） ---------------- */
    roofSurfY(x) {
      return x <= 884
        ? lerp(872, 646, clamp((x - 470) / (884 - 470)))
        : lerp(642, 866, clamp((x - 884) / (1270 - 884)));
    }

    _roofPath(c) {
      c.beginPath();
      c.moveTo(470, 872);
      c.lineTo(706, 650);
      c.lineTo(884, 644);
      c.lineTo(944, 642);
      c.lineTo(1270, 866);
      // 檐线：几乎是一条直线（屋顶是一层薄薄的斜面，不是一堵墙）
      c.lineTo(1120, 882);
      c.lineTo(884, 888);
      c.lineTo(640, 882);
      c.closePath();
    }

    _hut(ctx, L, t, a, sink) {
      const tearU = clamp((L - T_TEAR0) / (T_TEAR1 - T_TEAR0));
      const tearX = lerp(1292, 646, Ease.outCubic(tearU));
      const r = rng(4417);

      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, sink);

      /* 地面：一层湿黑的土 */
      const gg = ctx.createLinearGradient(0, 930, 0, H);
      gg.addColorStop(0, 'rgba(9,11,10,0.55)');
      gg.addColorStop(0.35, 'rgba(5,6,6,0.92)');
      gg.addColorStop(1, 'rgba(3,4,4,1)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, 930, W, H - 930);

      /* 屋身（墙 + 门洞 + 窗） */
      ctx.beginPath();
      ctx.moveTo(516, 876);
      ctx.lineTo(1244, 872);
      ctx.lineTo(1244, 1032);
      ctx.lineTo(516, 1032);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, 870, 0, 1032);
      bg.addColorStop(0, 'rgba(12,14,14,0.98)');
      bg.addColorStop(0.45, 'rgba(6,7,7,0.99)');
      bg.addColorStop(1, 'rgba(3,4,4,1)');
      ctx.fillStyle = bg;
      ctx.fill();
      // 檐下漏进的一线天光：墙头微微发亮
      const wl = ctx.createLinearGradient(0, 872, 0, 946);
      wl.addColorStop(0, 'rgba(120,138,136,0.18)');
      wl.addColorStop(1, 'rgba(120,138,136,0)');
      ctx.fillStyle = wl;
      ctx.fill();

      // 门洞：一线冷雾
      const dg = ctx.createLinearGradient(0, 940, 0, 1032);
      dg.addColorStop(0, 'rgba(96,112,110,0.28)');
      dg.addColorStop(1, 'rgba(26,32,32,0.05)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.moveTo(828, 1032);
      ctx.lineTo(828, 946);
      ctx.quadraticCurveTo(880, 916, 932, 946);
      ctx.lineTo(932, 1032);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,168,162,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(56,66,62,0.12)';
      ctx.fillRect(690, 952, 52, 38);

      /* 屋顶：clip 到撕口左侧（撕口本身是锯齿，屋顶直接被撕出毛边） */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-20, 600);
      ctx.lineTo(tearX - 30, 600);
      for (let k = 0; k <= 10; k++) {
        const yy = 600 + (k / 10) * 380;
        const jx = (hash(7717, k * 3 + 1) - 0.5) * 30 - (k % 2) * 10;
        ctx.lineTo(tearX + jx, yy);
      }
      ctx.lineTo(tearX - 60, 1000);
      ctx.lineTo(-20, 1000);
      ctx.closePath();
      ctx.clip();

      this._roofPath(ctx);
      ctx.fillStyle = 'rgba(6,7,6,0.995)';
      ctx.fill();
      ctx.save();
      this._roofPath(ctx);
      ctx.clip();

      // 茅草：顺坡倒伏的短笔（从脊往檐，不交叉）
      ctx.lineCap = 'round';
      for (let i = 0; i < 680; i++) {
        const u = r();
        const x = lerp(472, 1268, u);
        const yTop = this.roofSurfY(x) + 2 + r() * 10;
        const len = 26 + r() * 70;
        const lean = (x < 884 ? -0.50 : 0.48) + (r() - 0.5) * 0.16;
        const light = r() > 0.93;
        ctx.strokeStyle = light
          ? `rgba(${74 + r() * 34},${84 + r() * 30},${76 + r() * 26},${0.03 + r() * 0.07})`
          : `rgba(${13 + r() * 16},${15 + r() * 16},${12 + r() * 14},${0.20 + r() * 0.30})`;
        ctx.lineWidth = 0.8 + r() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.quadraticCurveTo(x + lean * len * 0.4, yTop + len * 0.62, x + lean * len, yTop + len);
        ctx.stroke();
      }
      // 脊线冷边（雨光只擦亮一线）
      ctx.strokeStyle = 'rgba(176,192,186,0.26)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(470, 872);
      ctx.lineTo(706, 650);
      ctx.lineTo(884, 644);
      ctx.lineTo(1050, 642);
      ctx.lineTo(1270, 866);
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      /* 檐口垂穗：挂在檐线之下（屋顶 clip 之外，才垂得出来） */
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 120; i++) {
        const u = r();
        const x = 478 + u * 788;
        const aa = 0.10 + r() * 0.22;
        const drop = 16 + r() * 22;
        const sway = Math.sin(t * 2.1 + i * 1.07) * 5.5;
        if (x > tearX - 8) continue;                 // 被掀走的那半没有檐穗
        ctx.strokeStyle = `rgba(${12 + r() * 16},${14 + r() * 16},${12 + r() * 14},${aa})`;
        ctx.lineWidth = 0.8 + r() * 1.4;
        ctx.beginPath();
        ctx.moveTo(x, 874);
        ctx.quadraticCurveTo(x + 3, 874 + drop * 0.55, x + 5 + sway, 874 + drop);
        ctx.stroke();
      }
      // 檐线的一线湿光：把屋顶从夜色里"剥"出来
      ctx.strokeStyle = 'rgba(142,160,154,0.20)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(472, 872);
      ctx.lineTo(640, 882);
      ctx.lineTo(884, 888);
      ctx.lineTo(1120, 882);
      ctx.lineTo(1268, 866);
      ctx.stroke();
      ctx.restore();

      /* 撕口：几缕还没断的茅草，贴着断口翻卷 */
      if (tearU > 0.015 && tearU < 0.995) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tearX - 8, 646);
        for (let k = 0; k <= 8; k++) {
          const yy = 646 + (k / 8) * 240;
          const jx = (hash(7717, k * 2 + 1) - 0.5) * 24;
          ctx.lineTo(tearX + jx, yy);
        }
        ctx.lineTo(tearX - 6, 900);
        ctx.lineTo(tearX - 26, 900);
        ctx.lineTo(tearX - 18, 646);
        ctx.closePath();
        ctx.fillStyle = `rgba(5,6,5,${0.55 * a})`;
        ctx.fill();

        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const u = hash(7717, i * 3 + 1);
          const by = 680 + i * 42 + (hash(7717, i * 3 + 2) - 0.5) * 16;
          const len = 14 + u * 26;
          const flap = Math.sin(L * 3.4 + i * 1.31) * 7 + tearU * 8;
          ctx.strokeStyle = `rgba(7,8,7,${0.85 * a})`;
          ctx.lineWidth = 1.6 + u * 2.4;
          ctx.beginPath();
          ctx.moveTo(tearX - 4, by);
          ctx.quadraticCurveTo(tearX + 10 + flap, by - 10, tearX + 16 + flap, by - len);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();
    }

    /* ---------------- 泥水：低饱和深灰蓝 + 微反射 ---------------- */
    _water(ctx, L, t) {
      const p = clamp((L - T_GROUND) / 1.40);
      if (p <= 0.004) return;
      const top = HZ - 90;
      const g = ctx.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, 'rgba(26,32,36,0)');
      g.addColorStop(0.30, `rgba(28,35,40,${0.55 * p})`);
      g.addColorStop(0.46, `rgba(18,24,28,${0.90 * p})`);
      g.addColorStop(0.70, `rgba(11,15,18,${0.95 * p})`);
      g.addColorStop(1, `rgba(5,7,9,${0.98 * p})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, H - top);

      // 水线：一条极细的冷亮边
      ctx.strokeStyle = `rgba(140,160,158,${0.10 * p})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, HZ);
      for (let x = 0; x <= W; x += 60) ctx.lineTo(x, HZ + Math.sin(x * 0.007 + t * 0.6) * 1.8);
      ctx.stroke();

      // 细波纹：横向短笔，缓慢漂移
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 120; i++) {
        const r1 = hash(5153, i * 4 + 1);
        const r2 = hash(5153, i * 4 + 2);
        const r3 = hash(5153, i * 4 + 3);
        const y = HZ + 10 + Math.pow(r1, 0.72) * (H - HZ - 24);
        const depth = (y - HZ) / (H - HZ);
        const len = 40 + r2 * (90 + depth * 300);
        const x = ((r3 * (W + 320) + t * (6 + depth * 22)) % (W + 320)) - 160;
        ctx.strokeStyle = `rgba(${96 + r2 * 36},${112 + r2 * 36},${116 + r2 * 34},${(0.015 + r3 * 0.035) * p})`;
        ctx.lineWidth = 0.7 + depth * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + Math.sin(t * 0.8 + i) * 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---------------- 地平线雾：把晶格底边化进夜色 ---------------- */
    _horizonMist(ctx, L) {
      const p = clamp((L - T_LATTICE) / 2.4) * 0.85;
      if (p <= 0.004) return;
      const g = ctx.createLinearGradient(0, 380, 0, HZ + 60);
      g.addColorStop(0, 'rgba(10,11,10,0)');
      g.addColorStop(0.62, `rgba(10,11,10,${0.30 * p})`);
      g.addColorStop(0.88, `rgba(9,10,9,${0.52 * p})`);
      g.addColorStop(1, `rgba(8,9,8,${0.10 * p})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 380, W, HZ + 60 - 380);
    }

    /* ---------------- 褴褛老翁：小、惨、昂首张臂 ---------------- */
    _sage(ctx, L, t) {
      const p = clamp((L - T_SAGE) / 0.95);
      if (p <= 0.004) return;
      const x = SAGE_X, y = SAGE_Y;
      const a = Ease.outCubic(p);
      const sway = Math.sin(t * 0.85) * 1.4;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x + sway * 0.4, y);

      // ① 底：DFS.figure（长衫 / 斗笠 / 头），跪坐半躺
      ctx.save();
      ctx.rotate(-0.12);
      ctx.translate(0, 8);
      DFS.figure(ctx, 0, 0, 1.15, { color: '6,7,6', alpha: 1, t, staff: false });
      ctx.restore();

      ctx.fillStyle = 'rgba(6,7,6,1)';

      // ② 肩背：把斗笠下缘压成佝偻的肩
      ctx.beginPath();
      ctx.moveTo(-28, -54);
      ctx.quadraticCurveTo(-18, -72, 0, -73);
      ctx.quadraticCurveTo(18, -73, 28, -52);
      ctx.quadraticCurveTo(4, -44, -28, -54);
      ctx.closePath();
      ctx.fill();

      // ③ 斗笠：宽檐压住头，檐口前低后高
      ctx.save();
      ctx.rotate(-0.09);
      ctx.beginPath();
      ctx.ellipse(0, -74, 27, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-15, -78);
      ctx.quadraticCurveTo(0, -100, 15, -78);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ④ 头：自檐下昂起（脸朝左上）
      ctx.save();
      ctx.translate(-13, -80);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();                       // 须
      ctx.moveTo(-1, 6);
      ctx.quadraticCurveTo(-9, 16, -11, 24);
      ctx.quadraticCurveTo(-2, 17, 5, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ⑤ 双臂：向左上 / 右上张开（含手总宽 ≤ 160px）
      const sleeve = (x0, y0, cx, cy, x1, y1, w0, w1) => {
        ctx.fillStyle = 'rgba(6,7,6,1)';
        ctx.beginPath();
        ctx.moveTo(x0, y0 - w0 * 0.5);
        ctx.quadraticCurveTo(cx, cy - w0 * 0.5, x1, y1 - w1 * 0.5);
        ctx.quadraticCurveTo(x1 + w1 * 0.5, y1, x1, y1 + w1 * 0.62);
        ctx.quadraticCurveTo(cx, cy + w0 * 0.45, x0, y0 + w0 * 0.5);
        ctx.closePath();
        ctx.fill();
        // 天上殿宇漏下的一点金，勾在袖的上沿
        ctx.strokeStyle = 'rgba(206,172,104,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - w0 * 0.5);
        ctx.quadraticCurveTo(cx, cy - w0 * 0.5, x1, y1 - w1 * 0.5);
        ctx.stroke();
      };
      const wob = Math.sin(t * 1.05) * 2.2;
      sleeve(-16, -56, -38, -68, -56, -92 + wob, 13, 8);
      sleeve(-4, -60, 20, -78, 44, -102 + wob * 1.2, 14, 8.5);
      // 手
      ctx.fillStyle = 'rgba(6,7,6,1)';
      ctx.beginPath(); ctx.ellipse(-59, -94 + wob, 5.4, 4.2, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(47, -104 + wob * 1.2, 5.6, 4.4, -0.5, 0, Math.PI * 2); ctx.fill();

      // ⑥ 膝：泥里拱起的一团
      ctx.beginPath();
      ctx.moveTo(4, -16);
      ctx.quadraticCurveTo(34, -24, 44, -2);
      ctx.quadraticCurveTo(28, 8, 8, 2);
      ctx.closePath();
      ctx.fill();

      // ⑦ 破衣下摆的毛边
      ctx.strokeStyle = 'rgba(6,7,6,1)';
      for (let i = 0; i < 9; i++) {
        const u = hash(9137, i * 3 + 1);
        const bx = -24 + u * 52;
        ctx.lineWidth = 1.2 + hash(9137, i * 3 + 2) * 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, -10 + u * 6);
        ctx.lineTo(bx + (hash(9137, i * 3 + 3) - 0.5) * 14, 6);
        ctx.stroke();
      }
      ctx.restore();

      // ⑦ 水淹到腰：一层水色盖住下身
      ctx.save();
      ctx.globalAlpha = a;
      const wg = ctx.createLinearGradient(0, SAGE_Y - 26, 0, SAGE_Y + 30);
      wg.addColorStop(0, 'rgba(18,24,28,0)');
      wg.addColorStop(0.30, 'rgba(16,21,25,0.66)');
      wg.addColorStop(1, 'rgba(9,13,16,0.90)');
      ctx.fillStyle = wg;
      ctx.fillRect(SAGE_X - 96, SAGE_Y - 26, 192, 60);
      // 水线
      ctx.strokeStyle = 'rgba(150,170,166,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const xx = SAGE_X - 92 + i * 11.5;
        const yy = SAGE_Y - 10 + Math.sin(i * 0.9 + t * 1.4) * 1.4;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      // 倒影：黑水里的一个更黑的团
      const rg = ctx.createRadialGradient(SAGE_X, SAGE_Y + 16, 0, SAGE_X, SAGE_Y + 16, 70);
      rg.addColorStop(0, 'rgba(4,6,7,0.55)');
      rg.addColorStop(1, 'rgba(4,6,7,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(SAGE_X - 80, SAGE_Y - 10, 160, 70);
      ctx.restore();
    }

    /* ---------------- 天上广厦：46 座金色晶格 ---------------- */
    _lattice(ctx, L, t) {
      if (L < T_LATTICE) return;
      const grow = Ease.outCubic(clamp((L - T_LATTICE) / 3.20));
      const inA = clamp((L - T_LATTICE) / 0.35);
      // 静帧呼吸：0.85 → 1.0
      const breath = L > T_HOLD
        ? 0.85 + 0.15 * (0.5 + 0.5 * Math.sin((L - T_HOLD) * 1.05 - 1.57))
        : 1;
      const alpha = inA * breath;

      const cam = this.cam;
      cam.pos.y = 1.15 + Math.sin(t * 0.31) * 0.05;
      cam.pitch = 0.30 - 0.020 * grow + Math.sin(t * 0.23) * 0.010;
      cam.yaw = Math.sin(t * 0.19) * 0.026;

      this.lattice.draw(ctx, cam, t, {
        progress: grow,
        alpha: alpha,
        color: GOLD,
        glow: false
      });
    }

    /* ---------------- 泥水里的金色倒影（微反射） ---------------- */
    _reflection(ctx, L, t) {
      const p = clamp((L - T_GROUND) / 1.80);
      if (p <= 0.004) return;
      const cam = this.cam;
      const list = [];
      for (const it of this.lattice.items) {
        const q = cam.project({ x: it.x, y: it.y, z: it.z });
        if (!q) continue;
        const w = q.px(it.scale);
        if (w < 40 || q.x < -260 || q.x > W + 260) continue;
        list.push({ x: q.x, w, ring: it.ring });
      }
      list.sort((a, b) => b.ring - a.ring);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        const sway = Math.sin(t * 0.85 + i * 1.31) * (3 + h.w * 0.03);
        const len = 60 + h.w * 0.8;
        const x = h.x + sway;
        const g = ctx.createLinearGradient(0, HZ, 0, HZ + len);
        const a0 = 0.038 * p * (0.5 + 0.5 * (1 - h.ring));
        g.addColorStop(0, `rgba(${GOLD},${a0})`);
        g.addColorStop(0.35, `rgba(${GOLD},${a0 * 0.5})`);
        g.addColorStop(1, `rgba(${GOLD},0)`);
        ctx.fillStyle = g;
        const wTop = h.w * 0.28;
        const wBot = h.w * 0.44;
        ctx.beginPath();
        ctx.moveTo(x - wTop, HZ);
        ctx.lineTo(x + wTop, HZ);
        ctx.lineTo(x + wBot + sway * 1.6, HZ + len);
        ctx.lineTo(x - wBot + sway * 1.6, HZ + len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    /* ==================================================================
       L3 —— 体积光：雷雨光 / 檐下泄金
       ================================================================== */
    _light(ctx, L, t) {
      /* 天际金雾：殿宇成形 */
      const grow = Ease.outCubic(clamp((L - T_LATTICE) / 3.20));
      if (L >= T_LATTICE - 0.25) {
        const inA = clamp((L - (T_LATTICE - 0.25)) / 0.6);
        const g = ctx.createRadialGradient(CX, 180, 40, CX, 240, 900);
        g.addColorStop(0, `rgba(238,204,138,${0.065 * inA * (0.65 + 0.35 * grow)})`);
        g.addColorStop(0.45, `rgba(222,184,116,${0.032 * inA})`);
        g.addColorStop(1, 'rgba(214,176,108,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H * 0.92);

        // 檐下光柱：只落在水线以上，免得把水面刷成灰白
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, HZ + 6);
        ctx.clip();
        this.lattice.lightShafts(ctx, this.cam, t, { count: 12, alpha: 0.55 * inA });
        ctx.restore();
      }
    }

    /* ==================================================================
       L4 —— 雨 / 雨珠 / 茅草 / 刚体 / 闪光
       ================================================================== */
    _weather(ctx, L, t) {
      this._rain(ctx, L);
      this._splash(ctx, L, t);
      this._beads(ctx, L, t);
      this._thatchDraw(ctx, L);
      this._rigidDraw(ctx, L);
      this._flash(ctx, L);
    }

    /* ---------------- 雨打屋脊：溅起的一层白屑 ---------------- */
    _splash(ctx, L, t) {
      const a = 1 - clamp((L - 3.9) / 1.2);
      if (a <= 0.01) return;
      ctx.save();
      ctx.fillStyle = `rgba(196,208,200,${0.30 * a})`;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const u = hash(6421, i * 3 + 1);
        const x = 500 + u * 740;
        const ph = hash(6421, i * 3 + 2) * 6.283;
        const flick = Math.sin(t * (7 + hash(6421, i * 3 + 3) * 9) + ph);
        if (flick < 0.15) continue;
        const y = this.roofSurfY(x) + 6 + hash(6421, i * 3 + 3) * 22 - flick * 10;
        const r = 0.9 + hash(6421, i * 3 + 2) * 1.7;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    /* ---------------- 万柄黑矛 ---------------- */
    _rain(ctx, L) {
      const out = clamp((L - (T_FLASH + 0.06)) / 0.32);     // 3.46 → 3.78
      if (out >= 1) return;
      const teff = T0 + rainPhase(L);
      ctx.save();
      // 主雨幕：冷调长矛
      V3.spearRain(ctx, teff, {
        count: 1100, speed: 1180, alpha: 0.55 * (1 - out),
        slant: -0.30, seed: 4141, color: '182,194,186'
      });
      // 近景更粗的几柄，压出"矛"的重量
      V3.spearRain(ctx, teff, {
        count: 260, speed: 1320, alpha: 0.26 * (1 - out),
        slant: -0.34, seed: 907, color: '208,218,208'
      });
      ctx.restore();
    }

    /* ---------------- 悬停雨珠：内亮外暗 + 左上高光 ---------------- */
    _beads(ctx, L, t) {
      const p = clamp((L - (T_FLASH + 0.22)) / 0.48);
      if (p <= 0.004) return;
      const drift = Math.max(0, L - (T_FLASH + G_DUR)) * 5.4;   // 缓慢上飘
      const baseA = p * 0.95;
      // 近层的珠子更大更实，远层退成细屑——靠尺度差读"悬浮在水里"
      const near = [], mid = [], far = [], golds = [];
      for (const b of this.beads) {
        const wob = Math.sin(t * 0.55 + b.sway * 6.283) * 1.5;
        const x = b.x + wob;
        const y = b.y - drift + Math.cos(t * 0.42 + b.sway * 5.1) * 1.1;
        const o = { x, y, r: b.r * (0.62 + b.r * 0.13) };
        if (b.gold) { golds.push(o); continue; }
        const z = b.r;                                   // 2..5 当"景深"
        if (z > 3.9) near.push(o); else if (z > 2.9) mid.push(o); else far.push(o);
      }
      const layer = (arr, aCore, aHi, rim) => {
        if (!arr.length) return;
        // 水壳：外暗（比夜空更沉一点，才有"珠子"的边界）
        ctx.fillStyle = `rgba(7,9,8,${rim * baseA})`;
        ctx.beginPath();
        for (const o of arr) { ctx.moveTo(o.x + o.r, o.y); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); }
        ctx.fill();
        // 内亮
        ctx.fillStyle = `rgba(186,202,194,${aCore * baseA})`;
        ctx.beginPath();
        for (const o of arr) { ctx.moveTo(o.x + o.r * 0.72, o.y); ctx.arc(o.x, o.y, o.r * 0.72, 0, Math.PI * 2); }
        ctx.fill();
        // 左上高光（偏心小圆）
        ctx.fillStyle = `rgba(255,252,242,${aHi * baseA})`;
        ctx.beginPath();
        for (const o of arr) {
          ctx.moveTo(o.x - o.r * 0.26 + o.r * 0.30, o.y - o.r * 0.36);
          ctx.arc(o.x - o.r * 0.26, o.y - o.r * 0.36, o.r * 0.30, 0, Math.PI * 2);
        }
        ctx.fill();
      };
      ctx.save();
      layer(far, 0.10, 0.30, 0.22);
      layer(mid, 0.15, 0.46, 0.32);
      layer(near, 0.20, 0.62, 0.44);
      // 沾了金光的雨珠（极少）
      if (golds.length) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(240,214,160,${0.16 * baseA})`;
        ctx.beginPath();
        for (const o of golds) { ctx.moveTo(o.x + o.r, o.y); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); }
        ctx.fill();
        ctx.fillStyle = `rgba(255,250,232,${0.55 * baseA})`;
        ctx.beginPath();
        for (const o of golds) {
          ctx.moveTo(o.x - o.r * 0.26 + o.r * 0.28, o.y - o.r * 0.36);
          ctx.arc(o.x - o.r * 0.26, o.y - o.r * 0.36, o.r * 0.28, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.restore();
    }

    /* ---------------- 800 颗茅草：先乱飞，再黄金螺旋升空 ---------------- */
    _thatchDraw(ctx, L) {
      const K = 1.15;
      const spiral = L >= T_SPIRAL;
      const u = clamp((L - T_SPIRAL) / 6.6);
      const fade = 1 - clamp((u - 0.76) / 0.24);
      if (spiral && fade <= 0.002) return;

      const lift = 820 * Math.pow(u, 1.75);
      const cu = clamp(u * 1.15);
      const cr = Math.round(lerp(138, 242, cu));
      const cg = Math.round(lerp(99, 215, cu));
      const cb = Math.round(lerp(32, 154, cu));
      const armRamp = Ease.outCubic(clamp(u / 0.45));

      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < this.thatch.length; i++) {
        const p = this.thatch[i];
        let x, y, a, ang;
        if (!spiral) {
          const age = L - p.birth;
          if (age <= 0) continue;
          const f = (1 - Math.exp(-age * K)) / K;
          x = p.x0 + p.vx * f + Math.sin(age * 2.6 + p.ph) * 9;
          y = p.y0 + p.vy * f + Math.cos(age * 2.2 + p.ph) * 7;
          a = clamp(age / 0.16) * 0.85;
          ang = Math.atan2(p.vy, p.vx) + Math.sin(age * 3.1 + p.ph) * 0.8;
          const cc = clamp(age * 1.2);
          ctx.strokeStyle = `rgba(${Math.round(lerp(58, 96, cc))},${Math.round(lerp(44, 74, cc))},${Math.round(lerp(24, 32, cc))},${(a * 0.62).toFixed(3)})`;
        } else {
          const r = p.r0 * (1 - 0.55 * u);
          const aa = p.a0 + p.spin * u + p.arm * armRamp;
          x = SPIRAL_CX + Math.cos(aa) * r;
          y = SPIRAL_CY + Math.sin(aa) * r - lift;
          a = fade * (0.6 + 0.4 * clamp(u * 2.6));
          ang = aa + Math.PI * 0.5;
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(a * 0.95).toFixed(3)})`;
        }
        ctx.lineWidth = p.lw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * p.len, y + Math.sin(ang) * p.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---------------- 被掀飞的屋面刚体 ---------------- */
    _rigidDraw(ctx, L) {
      if (L < T_TEAR0 || L > 5.6) return;
      ctx.save();
      for (const b of this.rigid) {
        const age = L - b.birth;
        if (age <= 0) continue;
        const x = b.x0 + b.vx * age + 26 * age * age;
        const y = Math.min(b.land, b.y0 + b.vy * age + 520 * age * age);
        const a = 1 - clamp((L - 3.9) / 1.4);
        if (a <= 0.01) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(b.birth * 3 + age * b.spin);
        ctx.fillStyle = `rgba(8,9,8,${0.95 * a})`;
        ctx.beginPath();
        ctx.moveTo(-b.s * 0.5, -b.s * 0.32);
        ctx.lineTo(b.s * 0.55, -b.s * 0.16);
        ctx.lineTo(b.s * 0.34, b.s * 0.30);
        ctx.lineTo(-b.s * 0.42, b.s * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(140,156,148,${0.09 * a})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    /* ---------------- 41.5s 白光闪 ---------------- */
    _flash(ctx, L) {
      const p = clamp((L - T_FLASH) / 0.62);
      if (L < T_FLASH || p >= 1) return;
      const a = Math.pow(1 - p, 2.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(CX, H * 0.44, 0, CX, H * 0.44, W * 0.78);
      g.addColorStop(0, `rgba(255,250,236,${0.80 * a})`);
      g.addColorStop(0.32, `rgba(246,238,214,${0.34 * a})`);
      g.addColorStop(1, 'rgba(240,230,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    /* ==================================================================
       L5 —— 排版：四行原典
       ================================================================== */
    _plate(ctx, cx, cy, rx, ry, a, rgb) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(0.52, `rgba(${rgb},${(a * 0.88).toFixed(3)})`);
      g.addColorStop(0.80, `rgba(${rgb},${(a * 0.44).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _type(ctx, L) {
      const V4 = DFS.V4;
      const lines = [
        { id: 's04_a', x: CX, y: 288, size: 96, track: 10, color: CREAM, a: 1 },
        { id: 's04_b', x: CX, y: 430, size: 74, track: 5, color: CREAM, a: 1 },
        { id: 's04_c', x: CX, y: 552, size: 60, track: 4, color: CREAM, a: 1 },
        { id: 's04_oath', x: CX, y: 972, size: 34, track: 3, color: CINNABAR, a: 0.98 }
      ];
      if (L < T_TEXT) return;

      // 衬底：极淡的墨色，只为把字从广厦剪影里"托"出来
      const first = Ease.outCubic(clamp((L - T_TEXT) / 0.5));
      this._plate(ctx, CX, 420, 1010, 420, 0.26 * first, '5,6,5');
      this._plate(ctx, CX, 420, 760, 300, 0.52 * first, '5,6,5');
      this._plate(ctx, CX, 970, 600, 70, 0.62 * clamp((L - 9.4) / 0.6), '5,6,5');

      for (const ln of lines) {
        if (!V4) {
          V3.inkText(ctx, TEXTS[ln.id], {
            x: ln.x, y: ln.y, size: ln.size, weight: 900,
            family: T.fonts.heavy, color: ln.color, tracking: ln.track, alpha: 1, seed: 3
          });
          continue;
        }
        const m = V4.chantLine(ctx, TEXTS[ln.id], {
          id: ln.id, L, x: ln.x, y: ln.y, size: ln.size,
          weight: ln.id === 's04_oath' ? 700 : 900,
          family: ln.id === 's04_oath' ? T.fonts.serif : T.fonts.heavy,
          color: ln.color, tracking: ln.track, seed: 3,
          halo: ln.id === 's04_oath' ? 0.72 : 0.50
        });
        if (m) DFS.dbgBox(ln.id, m.x, m.y, m.x + m.w, m.y + m.h);
      }
    }

    /* ==================================================================
       主绘制
       ================================================================== */
    draw(ctx, L, t) {
      const sh = this._shake(t, L);
      V3.eight(ctx, t, {
        l1: (c) => this._sky(c, L),
        l2: (c) => { c.save(); c.translate(sh.x, sh.y); this._world(c, L, t); c.restore(); },
        l3: (c) => { c.save(); c.translate(sh.x, sh.y); this._light(c, L, t); c.restore(); },
        l4: (c) => { c.save(); c.translate(sh.x * 1.25, sh.y * 1.25); this._weather(c, L, t); c.restore(); },
        l5: (c) => this._type(c, L),
        dust: true,
        dustAlpha: L > T_TEXT ? 0.32 : 0.22,
        dustOpts: { count: 130, color: '226,204,160' },
        grain: 0.46,
        vignette: 0.38,
        vignetteMid: 0.05
      });

      DFS.dbg({
        s04: {
          L: Math.round(L * 100) / 100,
          rainPhase: Math.round(rainPhase(L) * 1000) / 1000,
          halls: this.lattice.items.length,
          beads: this.beads.length,
          thatch: this.thatch.length
        }
      });
    }

    hudDark() { return true; }
  };
})(window.DFS);
