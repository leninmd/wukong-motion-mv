/* =========================================================================
   aesthetics-hub / motion-rules.js  —  外挂模块 A
   源流：haidrrrry/claude-remotion-skill（10 条不可妥协动效铁律 + 17 个动效组件）
          + remotion-dev/skills（fps 派生时序、音频同步、字幕测量）

   导出：
     DFS.HUB.ease.*                 高阶缓动（全部带边界钳制）
     DFS.HUB.springPhysics(t, {...})      物理弹簧
     DFS.HUB.multiEntrance(t, start, {...}) 四属性复合入场
     DFS.HUB.stagger(i, opts)            错落相位
     DFS.HUB.fastExit(t, start, {...})   快出慢入
     DFS.HUB.fiveLayerStack(ctx, t, parts) 五层合成堆栈
     DFS.HUB.idleMicroMotion(t, seed)     静默呼吸
     DFS.HUB.kbScale / kbPan             Ken Burns
     DFS.HUB.frames(sec) / sec(frames)   fps 派生时序
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.HUB = DFS.HUB || {};
  const H = DFS.HUB;
  const { W, H: HH, FPS, clamp, lerp } = DFS;

  /* ---------------- 铁律 8：一切时序由 fps 派生 ---------------- */
  H.FPS = FPS;
  H.frames = (sec) => Math.round(sec * H.FPS);
  H.sec = (f) => f / H.FPS;
  /** 把「帧」换算成秒的偏移量：staggerFrames(6) → 0.2s */
  H.staggerFrames = (n) => n / H.FPS;

  /* ---------------- 铁律 1：严禁线性插值 ---------------- */
  const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
  H.ease = {
    outExpo: (x) => { const t = clamp01(x); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inExpo: (x) => { const t = clamp01(x); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
    inOutExpo: (x) => {
      const t = clamp01(x);
      if (t === 0 || t === 1) return t;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    inOutCubic: (x) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outCubic: (x) => 1 - Math.pow(1 - clamp01(x), 3),
    inCubic: (x) => Math.pow(clamp01(x), 3),
    outQuint: (x) => 1 - Math.pow(1 - clamp01(x), 5),
    inQuint: (x) => Math.pow(clamp01(x), 5),
    outBack: (x, s = 1.5) => { const t = clamp01(x) - 1; return 1 + (s + 1) * t * t * t + s * t * t; },
    outElastic: (x) => {
      const t = clamp01(x);
      if (t === 0 || t === 1) return t;
      const c = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
    // 敲击：极快冲出后微回弹
    snap: (x) => { const t = clamp01(x); return 1 - Math.pow(1 - t, 7) + Math.sin(t * Math.PI) * 0.028 * (1 - t); }
  };

  /* ---------------- 物理弹簧（半隐式积分，确定性） ----------------
     返回 0..1 的进度；参数为 stiffness / damping / mass，单位与 Remotion spring 对齐。
     t 为秒。返回值可能轻微过冲（这正是"质量感"）。
     ------------------------------------------------------------- */
  H.springPhysics = function (t, o = {}) {
    const stiffness = o.stiffness ?? 180;
    const damping = o.damping ?? 14;
    const mass = o.mass ?? 1;
    const s = clamp01(t);
    if (s <= 0) return 0;
    const w0 = Math.sqrt(stiffness / mass);          // 固有角频率
    const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // 阻尼比
    const dur = o.duration ?? 1.0;
    const tt = s * dur;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * tt) * (Math.cos(wd * tt) + ((zeta * w0) / wd) * Math.sin(wd * tt));
    }
    // 临界/过阻尼
    return 1 - Math.exp(-zeta * w0 * tt) * (1 + zeta * w0 * tt);
  };

  /** 带过冲的缩放值（卡片砸落、印章砸下） */
  H.springScale = function (t, o = {}) {
    const p = H.springPhysics(t, o);
    return o.from ?? 0.86 + (1 - (o.from ?? 0.86)) * p;
  };

  /* ---------------- 铁律 2：多属性复合入场 ----------------
     opacity 0→1 · translateY 42→0 · scale 0.92→1 · blur 8→0
     返回可直接用于 ctx 的对象。
     -------------------------------------------------------- */
  H.multiEntrance = function (t, start, o = {}) {
    const dur = o.duration ?? 0.6;
    const p = H.ease.outExpo(clamp01((t - start) / dur));
    const rise = o.rise ?? 42;
    const fromScale = o.scaleFrom ?? 0.92;
    const blurMax = o.blur ?? 8;
    return {
      p,
      alpha: clamp01(p * (o.alphaBoost ?? 1.12)) * (o.alpha ?? 1),
      dy: (1 - p) * rise,
      dx: (1 - p) * (o.slide ?? 0),
      scale: fromScale + (1 - fromScale) * p,
      blur: (1 - p) * blurMax,
      /** 直接套到 ctx：在绘制前调用 */
      apply(ctx) {
        ctx.globalAlpha *= this.alpha;
        if (this.blur > 0.2) ctx.filter = `blur(${this.blur.toFixed(2)}px)`;
      }
    };
  };

  /* ---------------- 铁律 3：错落编排（4–8 帧） ---------------- */
  H.stagger = function (i, o = {}) {
    const frames = o.frames ?? 6;
    return i * (frames / H.FPS);
  };

  /* ---------------- 铁律 4：快出慢入（退场 = 入场 60%） ---------------- */
  H.fastExit = function (t, start, o = {}) {
    const dur = o.duration ?? 0.24;
    const p = H.ease.inExpo(clamp01((t - start) / dur));
    return {
      p,
      alpha: 1 - p,
      dy: -p * (o.rise ?? 0),
      blur: p * (o.blur ?? 6),
      apply(ctx) {
        ctx.globalAlpha *= this.alpha;
        if (this.blur > 0.2) ctx.filter = `blur(${this.blur.toFixed(2)}px)`;
      }
    };
  };

  /* ---------------- 铁律 6/7：Ken Burns 与静默呼吸 ---------------- */
  H.idleMicroMotion = function (t, seed = 0, amp = 1) {
    return {
      dy: Math.sin(t * 2.2 + seed * 2.1) * 3.5 * amp,
      dx: Math.cos(t * 1.7 + seed * 1.3) * 2.0 * amp,
      scale: 1 + Math.sin(t * 1.6 + seed) * 0.006 * amp,
      rot: Math.sin(t * 0.9 + seed) * 0.0018 * amp
    };
  };
  H.kbScale = (t, o = {}) => 1 + (o.amount ?? 0.06) * H.ease.inOutCubic(clamp01((t - (o.start ?? 0)) / (o.duration ?? 8)));
  H.kbPan = (t, o = {}) => (o.dx ?? 12) * Math.sin(t * 0.09 + (o.phase ?? 0));

  /* ---------------- 铁律 5：五层合成堆栈 ---------------- */
  /**
   * parts = {
   *   layer1(ctx)  // 漂移渐变网格（若为空则用默认宣纸/夜色调）
   *   layer2(ctx)  // 场景资产
   *   layer3(ctx)  // 排版
   *   layer4(ctx)  // 调色（默认已含 globalGrade）
   *   layer5(ctx)  // 颗粒与暗角（默认已含）
   *   dark: bool, paper: bool, grade: 'warm'|'cold'|'none', grain, vignette
   * }
   */
  H.fiveLayerStack = function (ctx, t, parts = {}) {
    const dark = !!parts.dark;
    // L1
    ctx.save();
    if (parts.layer1) parts.layer1(ctx);
    else {
      if (dark) DFS.drawNight(ctx, parts.night || {});
      else DFS.drawPaper(ctx, parts.paperOpts || {});
      DFS.drawGradientMesh(ctx, t, dark
        ? { c1: parts.mesh1 || 'rgba(80,86,74,0.20)', c2: parts.mesh2 || 'rgba(40,42,34,0.35)' }
        : { c1: parts.mesh1 || 'rgba(255,250,232,0.55)', c2: parts.mesh2 || 'rgba(120,104,78,0.14)' });
    }
    ctx.restore();
    // L2 / L3
    if (parts.layer2) { ctx.save(); parts.layer2(ctx); ctx.restore(); }
    if (parts.layer3) { ctx.save(); parts.layer3(ctx); ctx.restore(); }
    // L4 调色
    ctx.save();
    if (parts.layer4) parts.layer4(ctx);
    else if (parts.grade === 'warm') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#F0D9A8';
      ctx.fillRect(0, 0, W, HH);
    } else if (parts.grade === 'cold') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#7C93A8';
      ctx.fillRect(0, 0, W, HH);
    }
    ctx.restore();
    // L5 颗粒 + 暗角
    DFS.drawGrainVignette(ctx, Math.round(t * H.FPS), {
      grain: parts.grain ?? 0.42,
      vig: parts.vignette ?? 0.22,
      vigMid: parts.vignetteMid ?? 0.03
    });
  };

  /* ---------------- 屏幕震动（印章砸落、雷击） ---------------- */
  H.cameraShake = function (frame, o = {}) {
    const amp = o.amp ?? 8;
    const decay = o.decay ?? 9;
    const startFrame = o.startFrame ?? 0;
    const f = Math.max(0, frame - startFrame);
    const env = Math.exp(-f / (H.FPS / decay));
    if (env < 0.002) return { x: 0, y: 0, rot: 0 };
    const s = o.seed ?? 7;
    return {
      x: Math.sin(f * 1.37 + s) * amp * env,
      y: Math.cos(f * 1.91 + s * 1.7) * amp * env * 0.7,
      rot: Math.sin(f * 0.83 + s * 2.3) * 0.0022 * env
    };
  };

  /** 把震动套到画布（成对使用 restoreShake） */
  H.applyCameraShake = function (ctx, sh) {
    if (!sh || (Math.abs(sh.x) < 0.05 && Math.abs(sh.y) < 0.05)) return;
    ctx.translate(sh.x, sh.y);
    if (sh.rot) {
      ctx.translate(W / 2, HH / 2);
      ctx.rotate(sh.rot);
      ctx.translate(-W / 2, -HH / 2);
    }
  };

})(window.DFS);
