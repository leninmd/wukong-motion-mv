/* =========================================================================
   V3 / paper-fluid.js — 宣纸基质与墨渗流体
   1) 宋代手工麻纸：分形凹凸 + 纤维走向 + 帘纹
   2) 墨渗：毛细毛边（多次微位移叠加）+ 飞白（噪声打孔）
   所有纹理一次性烘焙，按 seed 缓存。
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V3 = DFS.V3 || {};
  const V3 = DFS.V3;
  const { W, H, clamp, lerp, fbm, rng } = DFS;

  /* ---------------- 1. 麻纸基质 ---------------- */
  let paperCanvas = null;
  V3.paper = function (ctx, o = {}) {
    const zoom = o.zoom || 1;
    const ox = o.ox || 0, oy = o.oy || 0;
    if (!paperCanvas) paperCanvas = bakePaper();
    ctx.save();
    ctx.drawImage(
      paperCanvas,
      -(W * (zoom - 1)) / 2 + ox,
      -(H * (zoom - 1)) / 2 + oy,
      W * zoom, H * zoom
    );
    if (o.dark) {
      ctx.globalAlpha = o.dark;
      ctx.fillStyle = 'rgba(12,12,10,1)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  function bakePaper() {
    const cv = DFS.mkCanvas(W, H);
    const c = cv.getContext('2d');
    // 底色：宋代麻纸偏暖黄，中心亮、边缘沉
    const g = c.createRadialGradient(W * 0.46, H * 0.42, H * 0.12, W * 0.5, H * 0.5, H * 1.05);
    g.addColorStop(0, '#F3EAD6');
    g.addColorStop(0.5, '#E8DCC2');
    g.addColorStop(1, '#D3C2A2');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // 分形凹凸（低分辨率 fBm → 放大）
    const sw = 480, sh = 270;
    const small = DFS.mkCanvas(sw, sh);
    const sc = small.getContext('2d');
    const img = sc.createImageData(sw, sh);
    const d = img.data;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const n1 = fbm(x * 0.06, y * 0.06, 5, 2.1, 0.55);
        const n2 = fbm(x * 0.33 + 17, y * 0.33 + 9, 3, 2.0, 0.5);
        const v = (n1 - 0.5) * 30 + (n2 - 0.5) * 14;
        d[i] = 128 + v; d[i + 1] = 112 + v; d[i + 2] = 88 + v; d[i + 3] = 255;
      }
    }
    sc.putImageData(img, 0, 0);
    c.save();
    c.globalCompositeOperation = 'soft-light';
    c.globalAlpha = 0.55;
    c.imageSmoothingQuality = 'high';
    c.drawImage(small, 0, 0, W, H);
    c.restore();

    // 纤维：长短不一的横向丝 + 少量纵丝（手工纸的帘纹方向）
    const r = rng(77021);
    c.save();
    for (let i = 0; i < 3200; i++) {
      const x = r() * W, y = r() * H;
      const horiz = r() > 0.16;
      const len = (horiz ? 30 : 14) + r() * (horiz ? 220 : 60);
      const a = 0.012 + r() * 0.05;
      c.strokeStyle = r() > 0.42 ? `rgba(96,79,55,${a})` : `rgba(255,251,238,${a * 1.6})`;
      c.lineWidth = 0.5 + r() * 0.9;
      c.beginPath();
      c.moveTo(x, y);
      if (horiz) c.lineTo(x + len, y + (r() - 0.5) * 1.6);
      else c.lineTo(x + (r() - 0.5) * 3, y + len);
      c.stroke();
    }
    // 帘纹（纸帘的横向条纹）
    c.globalAlpha = 0.05;
    for (let y = 0; y < H; y += 26 + r() * 6) {
      c.fillStyle = 'rgba(80,64,44,1)';
      c.fillRect(0, y, W, 1);
    }
    // 杂质
    c.globalAlpha = 1;
    for (let i = 0; i < 2200; i++) {
      c.fillStyle = `rgba(70,54,34,${0.02 + r() * 0.06})`;
      c.fillRect(r() * W, r() * H, 0.8 + r() * 2.2, 0.8 + r() * 2.2);
    }
    c.restore();
    return cv;
  }

  /* ---------------- 2. 墨渗字（毛细毛边 + 飞白） ----------------
     先离屏绘制 → 噪声打孔做飞白 → 多次微位移叠加做毛细边缘
     -------------------------------------------------------------- */
  const inkCache = new Map();
  V3.inkText = function (ctx, text, o = {}) {
    const size = o.size ?? 120;
    const weight = o.weight ?? 900;
    const family = o.family || DFS.THEME.fonts.heavy;
    const color = o.color || DFS.THEME.colors.ink;
    const vertical = !!o.vertical;
    const gap = o.gap ?? 1.15;
    const tracking = o.tracking ?? 0;
    const key = [text, size, weight, family, vertical, gap, tracking, color].join('|');
    let cv = inkCache.get(key);
    if (!cv) cv = bakeInk(text, { size, weight, family, vertical, gap, tracking, color, seed: o.seed ?? 1 });
    if (!cv) return;
    const x = (o.x ?? W / 2) - cv.width / 2;
    const y = (o.y ?? H / 2) - cv.height / 2;
    // ——— V4 可读性护罩：亮字垫暗、暗字垫亮，只作用于局部椭圆 ———
    const halo = o.halo;
    if (halo !== false && halo !== 0 && DFS.V4 && DFS.V4.halo) {
      const alpha = clamp((o.alpha ?? 1)) * (typeof halo === 'number' ? halo : (o.haloAlpha ?? 0.36));
      if (alpha > 0.01) {
        DFS.V4.halo(ctx, x + cv.width / 2, y + cv.height / 2, cv.width * 0.92, cv.height * 0.84, {
          alpha, dark: isLightText(color), pad: size * 0.26, padY: size * 0.17
        });
      }
    }
    ctx.save();
    ctx.globalAlpha *= (o.alpha ?? 1);
    ctx.drawImage(cv, x, y);
    ctx.restore();
    return { w: cv.width, h: cv.height };
  };

  /* 判断字色是"亮字"还是"暗字"，据此决定护罩垫暗还是垫亮。

     规则：
       · 高饱和（朱砂 / 金）一律当"亮字" —— 它们是暗场里的重音，
         垫亮色会变成一块发光的字幕板（V4 踩过这个坑）。
       · 其余按相对亮度判断。
     ------------------------------------------------------------ */
  function isLightText(color) {
    let r = 0, g = 0, b = 0;
    const hex = /^#([0-9a-f]{6})$/i.exec(color || '');
    if (hex) {
      const v = parseInt(hex[1], 16);
      r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255;
    } else {
      const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color || '');
      if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
      else { r = g = b = 30; }
    }
    const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
    if (maxc - minc > 60) return true;             // 饱和色 = 暗场重音
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 120;
  }

  function bakeInk(text, o) {
    const { size, weight, family, vertical, gap, tracking, color, seed } = o;
    const m = DFS.mkCanvas(8, 8).getContext('2d');
    m.font = DFS.font(size, weight, family);
    const chars = Array.from(text);
    const cw = chars.map((c) => m.measureText(c).width);
    let bw, bh;
    if (vertical) {
      bw = size * 1.75;
      bh = size * gap * chars.length + size * 0.6;
    } else {
      bw = cw.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1) + size * 0.6;
      bh = size * 1.55;
    }
    const cv = DFS.mkCanvas(Math.ceil(bw), Math.ceil(bh));
    const c = cv.getContext('2d');
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = DFS.font(size, weight, family);
    if (vertical) {
      let y = size * 0.85;
      chars.forEach((ch) => { c.fillText(ch, bw / 2, y); y += size * gap; });
    } else {
      let x = size * 0.3;
      chars.forEach((ch, i) => { c.fillText(ch, x + cw[i] / 2, bh / 2); x += cw[i] + tracking; });
    }
    // 飞白：按噪声打孔
    const img = c.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    const r = rng(seed * 7919 + 13);
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (d[i + 3] < 20) continue;
        const n = fbm(x * 0.06, y * 0.06, 4) * 0.55 + r() * 0.45;
        if (n < 0.30) d[i + 3] *= 0.25 + n;           // 飞白
        else d[i + 3] *= 0.86 + n * 0.14;
      }
    }
    c.putImageData(img, 0, 0);
    // 染色 + 毛细毛边（四次微位移叠加）
    const out = DFS.mkCanvas(cv.width + 12, cv.height + 12);
    const oc = out.getContext('2d');
    const offs = [[-2, 0], [2, 0], [0, -2], [0, 2], [0, 0]];
    offs.forEach(([dx, dy], i) => {
      oc.globalAlpha = i === offs.length - 1 ? 1 : 0.22;
      oc.drawImage(cv, 6 + dx, 6 + dy);
      oc.globalCompositeOperation = 'source-in';
      oc.fillStyle = color;
      oc.fillRect(0, 0, out.width, out.height);
      oc.globalCompositeOperation = 'source-over';
    });
    return out;
  }

})(window.DFS);
