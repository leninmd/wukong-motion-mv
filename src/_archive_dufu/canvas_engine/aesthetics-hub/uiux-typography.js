/* =========================================================================
   aesthetics-hub / uiux-typography.js  —  外挂模块 D
   源流：JJenglert1/remotion-claude-video（UI/UX Pro Max 配色与字体配对）
          + claude-remotion-skill/references/design-rules.md（60/30/10、单一 hero 色）
   锁定主题：「中式史诗传记 Chinese Historical Epic」
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.HUB = DFS.HUB || {};
  const H = DFS.HUB;
  const { W, H: HH, clamp } = DFS;

  const P = {
    paper: '#F4EFE6',
    paperEdge: '#EAE2D3',
    paperDeep: '#DCCFB6',
    ink: '#111111',
    night: '#1C1D21',
    nightDeep: '#0B0C0D',
    cinnabar: '#D9381E',
    cinnabarDeep: '#A82B1B',
    gold: '#C59B27',
    goldHi: '#E7C766',
    gray: '#6E6A63'
  };
  H.PALETTE = P;

  const F = {
    // 字重极差配对
    display: `900 ${'72px'} "NotoSerifSC", "SourceHanSerifHeavy", "Songti SC", serif`,
    serif: '"NotoSerifSC", "Source Han Serif SC", "Songti SC", serif',
    heavy: '"SourceHanSerifHeavy", "NotoSerifSC", serif',
    kai: '"LXGWWenKai", "KaiTi", "STKaiti", serif',
    brush: '"MaShanZheng", "LXGWWenKai", cursive',
    mono: '"JetBrains Mono", "Cascadia Mono", "Consolas", "Courier New", monospace'
  };
  H.FONTS = F;
  H.font = (size, weight = 400, family = F.serif) => `${weight} ${Math.round(size)}px ${family}`;

  /* ---------------- 等宽数字：逐个字符固定步进（tabular-nums 的 Canvas 等价物） ---------------- */
  H.monoNums = function (ctx, text, x, y, size, o = {}) {
    const color = o.color || P.gray;
    const weight = o.weight ?? 500;
    const tracking = o.tracking ?? size * 0.10;
    const align = o.align || 'left';
    const step = size * 0.60 + tracking;
    const chars = Array.from(text);
    const totalW = step * chars.length - tracking;
    let cx = align === 'right' ? x - totalW : align === 'center' ? x - totalW / 2 : x;
    ctx.save();
    ctx.font = H.font(size, weight, F.mono);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha *= (o.alpha ?? 1);
    chars.forEach((c) => {
      ctx.fillText(c, cx + step / 2, y);
      cx += step;
    });
    ctx.restore();
    return totalW;
  };

  /* ---------------- 标题（900 字重 + 字距 0.08em） ---------------- */
  H.title = function (ctx, text, o = {}) {
    const size = o.size ?? 120;
    const tracking = o.tracking ?? size * 0.08;
    const color = o.color || P.ink;
    const family = o.family || F.heavy;
    const weight = o.weight ?? 900;
    const chars = Array.from(text);
    ctx.save();
    ctx.font = H.font(size, weight, family);
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cx = o.align === 'right' ? o.x - total : o.align === 'center' ? o.x - total / 2 : o.x;
    ctx.textAlign = 'left';
    ctx.textBaseline = o.baseline || 'middle';
    ctx.fillStyle = color;
    ctx.globalAlpha *= (o.alpha ?? 1);
    chars.forEach((c, i) => {
      ctx.fillText(c, cx, o.y);
      cx += widths[i] + tracking;
    });
    ctx.restore();
    return total;
  };

  /* ---------------- 金句：单字高亮（hero 色只出现在一个词上） ---------------- */
  H.quote = function (ctx, text, o = {}) {
    const size = o.size ?? 56;
    const hi = o.highlight || '';             // 要高亮的子串
    const hiColor = o.highlightColor || P.cinnabar;
    const chars = Array.from(text);
    const hiChars = Array.from(hi);
    const track = o.tracking ?? size * 0.02;
    ctx.save();
    ctx.font = H.font(size, o.weight ?? 500, o.family || F.heavy);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    let cx = o.align === 'center' ? o.x - total / 2 : o.align === 'right' ? o.x - total : o.x;
    // 找出高亮区间
    let hiFrom = -1;
    if (hiChars.length) {
      for (let i = 0; i <= chars.length - hiChars.length; i++) {
        let ok = true;
        for (let k = 0; k < hiChars.length; k++) if (chars[i + k] !== hiChars[k]) { ok = false; break; }
        if (ok) { hiFrom = i; break; }
      }
    }
    ctx.globalAlpha *= (o.alpha ?? 1);
    chars.forEach((c, i) => {
      const inHi = hiFrom >= 0 && i >= hiFrom && i < hiFrom + hiChars.length;
      ctx.fillStyle = inHi ? hiColor : (o.color || P.ink);
      ctx.fillText(c, cx, o.y + (inHi ? -(o.hiLift ?? 0) : 0));
      cx += widths[i] + track;
    });
    ctx.restore();
    return total;
  };

  /* ---------------- 竖排 ---------------- */
  H.vertical = function (ctx, text, o = {}) {
    const size = o.size ?? 66;
    const gap = o.gap ?? 1.22;
    const chars = Array.from(text);
    const step = size * gap;
    const total = step * chars.length;
    let cy = o.align === 'bottom' ? o.y - total : o.align === 'top' ? o.y : o.y - total / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = H.font(size, o.weight ?? 400, o.family || F.serif);
    ctx.fillStyle = o.color || P.ink;
    ctx.globalAlpha *= (o.alpha ?? 1);
    chars.forEach((c) => {
      ctx.fillText(c, o.x, cy + step / 2);
      cy += step;
    });
    ctx.restore();
    return total;
  };

  /* ---------------- HUD 文本（等宽年份 + 宋体地名） ---------------- */
  H.hudLine = function (ctx, place, year, event, x, y, size, color, alpha) {
    const parts = [place, year, event].filter(Boolean);
    const sep = ' · ';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color || 'rgba(110,106,99,0.9)';
    ctx.globalAlpha *= (alpha ?? 1);
    ctx.font = H.font(size, 400, F.serif);
    const ws = parts.map((p) => ctx.measureText(p).width);
    const sepW = ctx.measureText(sep).width;
    const total = ws.reduce((a, b) => a + b, 0) + sepW * (parts.length - 1);
    let cx = x - total;
    parts.forEach((p, i) => {
      ctx.fillText(p, cx + ws[i], y);
      cx += ws[i];
      if (i < parts.length - 1) cx += sepW;
    });
    ctx.restore();
  };

})(window.DFS);
