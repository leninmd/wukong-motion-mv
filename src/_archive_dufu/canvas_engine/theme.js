/* =========================================================================
   theme.js — 全局主题 / 确定性数学 / 排版基元
   规范来源：参考片逐帧配色取样 + 「十条动态设计铁律」第 1/8/9 条
   —— 所有色值、缓动、字号基准集中于此，分镜内禁止硬编码。
   ========================================================================= */
window.DFS = window.DFS || {};
(function (DFS) {
  'use strict';

  const W = 1920, H = 1080, FPS = 60;
  DFS.W = W; DFS.H = H; DFS.FPS = FPS;
  DFS.DURATION = 85;
  DFS.sceneRegistry = DFS.sceneRegistry || {};

  /* ---------------- 1. 主题常量 ---------------- */
  DFS.THEME = {
    colors: {
      paper:       '#E7DAC2',   // 宣纸主色（参考片取样 #DFD0BB~#E5D8C2）
      paperHi:     '#F4ECDB',   // 受光面
      paperLo:     '#C9B69A',   // 暗角/纸背
      ink:         '#1A1309',   // 徽墨（参考片取样 #1B1007）
      ink2:        '#3A3125',
      ink3:        '#6B6151',
      cinnabar:    '#D8402A',   // 朱砂（红字牌 #EF5C31 略去高光后）
      cinnabarDp:  '#A82B1B',
      gold:        '#C39A4E',
      night:       '#16170F',   // 夜海/黑场（取样 #1A1B16）
      nightLo:     '#0C0D08',
      nightSea:    '#2B2B22',
      hudLight:    'rgba(74,71,55,0.80)',
      hudDark:     'rgba(226,216,196,0.74)'
    },
    fonts: {
      serif:  '"NotoSerifSC", "Source Han Serif SC", "Songti SC", serif',
      heavy:  '"SourceHanSerifHeavy", "NotoSerifSC", serif',
      kai:    '"LXGWWenKai", "KaiTi", "STKaiti", serif',
      brush:  '"MaShanZheng", "LXGWWenKai", cursive',
      mono:   '"Courier New", "Consolas", monospace'
    },
    // 1920x1080 的 90% 安全区
    safe: { left: 96, top: 54, right: 1824, bottom: 1026 }
  };

  /* ---------------- 2. 确定性数学 ---------------- */
  DFS.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  DFS.lerp = (a, b, t) => a + (b - a) * t;
  DFS.map = (v, a, b, c = 0, d = 1) => c + (d - c) * DFS.clamp((v - a) / (b - a));
  DFS.smoothstep = (e0, e1, x) => {
    const t = DFS.clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  // 短边自适应（Remonster 规则）：所有尺寸以 1080 短边为基准
  DFS.s = (px) => px * Math.min(W, H) / 1080;
  // 基于 fps 的时序（铁律第 8 条：禁止魔法帧数）
  DFS.frames = (sec) => Math.round(sec * FPS);
  DFS.sec = (frames) => frames / FPS;

  // Mulberry32：固定种子伪随机（铁律：严禁 Math.random）
  DFS.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // 由 (seed, index) 直接算出随机数——用于粒子/雨滴等"无状态"元素
  DFS.hash = function (seed, i) {
    let t = (seed ^ Math.imul(i + 1, 0x9E3779B9)) >>> 0;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
  // 二维 value noise（确定性、无需预计算表）
  const PERM = new Uint8Array(512);
  (function initPerm() {
    const r = DFS.rng(20240917);
    for (let i = 0; i < 256; i++) PERM[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = PERM[i]; PERM[i] = PERM[j]; PERM[j] = tmp;
    }
    for (let i = 0; i < 256; i++) PERM[i + 256] = PERM[i];
  })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad2 = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y; case 1: return -x + y;
      case 2: return x - y; default: return -x - y;
    }
  };
  DFS.noise2 = function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = PERM[PERM[X] + Y], ab = PERM[PERM[X] + Y + 1];
    const ba = PERM[PERM[X + 1] + Y], bb = PERM[PERM[X + 1] + Y + 1];
    const x1 = DFS.lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
    const x2 = DFS.lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
    return DFS.lerp(x1, x2, v) * 0.5 + 0.5;
  };
  DFS.fbm = function (x, y, oct = 4, lac = 2.0, gain = 0.5) {
    let a = 0.5, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += a * DFS.noise2(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  };

  /* ---------------- 3. 缓动（铁律第 1 条：严禁线性） ---------------- */
  DFS.Ease = {
    outExpo: (x) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    inExpo: (x) => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, 10 * x - 10),
    inOutExpo: (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
    },
    outCubic: (x) => 1 - Math.pow(1 - DFS.clamp(x), 3),
    inCubic: (x) => Math.pow(DFS.clamp(x), 3),
    inOutCubic: (x) => {
      const t = DFS.clamp(x);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    outQuint: (x) => 1 - Math.pow(1 - DFS.clamp(x), 5),
    inQuint: (x) => Math.pow(DFS.clamp(x), 5),
    outBack: (x, s = 1.4) => {
      const t = DFS.clamp(x) - 1;
      return 1 + (s + 1) * t * t * t + s * t * t;
    },
    // 阻尼弹簧：0→1，轻微过冲（文字/图形入场的质量感）
    spring: (x, damping = 6.5, freq = 7.2) => {
      const t = DFS.clamp(x);
      if (t === 0) return 0; if (t === 1) return 1;
      return 1 - Math.exp(-damping * t) * Math.cos(freq * Math.PI * t);
    },
    // 敲击感：极快冲出后回弹
    snap: (x) => {
      const t = DFS.clamp(x);
      return 1 - Math.pow(1 - t, 7) + Math.sin(t * Math.PI) * 0.03 * (1 - t);
    }
  };

  /* ---------------- 4. 排版基元 ---------------- */
  DFS.font = (size, weight = 400, family = DFS.THEME.fonts.serif) =>
    `${weight} ${Math.round(size)}px ${family}`;

  // 把汉字数字转成参考片使用的中式记数（一〇五七）
  const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  DFS.cnNum = function (n) {
    return String(n).split('').map((d) => CN[+d]).join('');
  };
  // 千分位（HUD 里程）
  DFS.km = function (n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 按字切分，便于逐字编排（错落 3–6 帧相位）
  DFS.splitChars = (s) => Array.from(s);

  // 文本自适应宽度测量：超出 maxW 时等比缩字号（杜绝溢出/截断）
  DFS.fitText = function (ctx, text, maxW, startSize, weight = 400, family = DFS.THEME.fonts.serif) {
    let size = startSize;
    for (let i = 0; i < 40; i++) {
      ctx.font = DFS.font(size, weight, family);
      if (ctx.measureText(text).width <= maxW) break;
      size *= 0.94;
    }
    return size;
  };

  // 以 (x,y) 为锚点的多行文本（支持行高、对齐、逐行淡入）
  DFS.wrapText = function (ctx, text, maxW) {
    const lines = []; let cur = '';
    for (const ch of Array.from(text)) {
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      const test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  /* 多属性复合入场（铁律第 2 条）：Fade + Rise + Scale + Blur */
  DFS.entrance = function (local, start, dur = 0.55, opts = {}) {
    const p = DFS.Ease.outExpo(DFS.clamp((local - start) / dur));
    return {
      p,
      alpha: DFS.clamp(p * (opts.alphaBoost || 1)),
      dy: (1 - p) * (opts.rise ?? 26),
      dx: (1 - p) * (opts.slide ?? 0),
      scale: (opts.from ?? 0.96) + (1 - (opts.from ?? 0.96)) * p,
      blur: (1 - p) * (opts.blur ?? 4)
    };
  };
  /* 快出慢入（铁律第 4 条）：退场时长 ≈ 入场的 45% */
  DFS.exit = function (local, start, dur = 0.24) {
    const p = DFS.Ease.inExpo(DFS.clamp((local - start) / dur));
    return { p, alpha: 1 - p, dy: -p * 12, blur: p * 6 };
  };
  /* 静默微动效（铁律第 7 条）：正弦呼吸 */
  DFS.breathe = function (t, seed = 0, amp = 1) {
    return {
      y: Math.sin(t * 1.05 + seed * 2.1) * 3.2 * amp,
      x: Math.cos(t * 0.83 + seed * 1.7) * 2.1 * amp,
      rot: Math.sin(t * 0.61 + seed) * 0.0016 * amp,
      scale: 1 + Math.sin(t * 0.77 + seed * 0.9) * 0.0038 * amp
    };
  };

  /* ---------------- 5. Canvas 便捷封装 ---------------- */
  DFS.withLayer = function (ctx, fn) {
    ctx.save();
    try { fn(); } finally { ctx.restore(); }
  };
  // 带模糊的绘制（ctx.filter 在 Chromium 中可用且确定性）
  DFS.blurDraw = function (ctx, blurPx, fn) {
    ctx.save();
    if (blurPx > 0.15) ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
    fn();
    ctx.restore();
  };
  // 逐字绘制（支持相位偏移与单独变换）
  DFS.eachChar = function (ctx, text, x, y, step, fn) {
    let cx = x;
    Array.from(text).forEach((ch, i) => { fn(ch, i, cx, y); cx += step; });
  };

})(window.DFS);
