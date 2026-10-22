/* =========================================================================
   engine/v4/cadence.js — 句读律动（Poetic Cadence）
   废除 0.05–0.09s 等差机械错落，改用三种截然不同的入场物理模型：

     hist   史笔刀刻 —— 《两唐书》纪事：4~6 帧极速落位，无模糊，
                       句读之间硬停（history is cold）。
     chant  杜诗吟诵 —— 严格按 二·二·一 / 二·二·三 句读：前两字重墨砸下，
                       强制停顿，再让后半句缓缓浮现；句末重字放大 1.35×，
                       并带一次缓慢的墨迹晕染。
     rub    墓志碑拓 —— 由淡及浓，自纸纹深处"洇"出来，庄严肃穆。

   时间表由 storyboard 的 cues 单一事实来源驱动，音轨用同一张表 → 毫秒级同步。
   ========================================================================= */
(function (DFS) {
  'use strict';
  DFS.V4 = DFS.V4 || {};
  const V4 = DFS.V4;
  const { W, clamp, lerp, hash, Ease, smoothstep } = DFS;

  /* ---------------- 1. 调度器（与 audio/build_audio_v4.py 严格同构） ---------------- */
  V4.schedule = function (cue) {
    const charDur = cue.charDur ?? 0.06;
    const pause = cue.pause ?? 0.2;
    const groups = (cue.groups && cue.groups.length) ? cue.groups : null;
    const times = [];
    const starts = [];
    let t = cue.t ?? 0;
    if (!groups) return { times: [t], starts: [t], end: t, charDur, pause };
    for (let g = 0; g < groups.length; g++) {
      const chars = Array.from(groups[g]);
      starts.push(t);
      for (let i = 0; i < chars.length; i++) times.push(t + i * charDur);
      t += chars.length * charDur + pause;
    }
    return { times, starts, end: t, charDur, pause };
  };

  /* 由 storyboard 取 cue（缓存） */
  const cueCache = new Map();
  V4.cue = function (id) {
    if (cueCache.has(id)) return cueCache.get(id);
    const list = (DFS.STORY && DFS.STORY.cues) || [];
    const c = list.find((x) => x.id === id) || null;
    cueCache.set(id, c);
    return c;
  };
  /* 取某个 id 的逐字时间表；找不到时退回"等差"（并打标） */
  V4.times = function (id, fallback) {
    const c = V4.cue(id);
    if (c) return V4.schedule(c);
    const f = fallback || { t: 0, dur: 0.5, stagger: 0.06, n: 8 };
    const times = [];
    for (let i = 0; i < f.n; i++) times.push(f.t + i * f.stagger);
    return { times, starts: [f.t], end: f.t + (f.n - 1) * f.stagger + f.dur, charDur: f.stagger, pause: 0 };
  };
  V4.modeOf = function (id) {
    const c = V4.cue(id);
    return c ? c.mode : 'hist';
  };
  /* 强调字集合（按字索引） */
  V4.emphSet = function (id, text) {
    const c = V4.cue(id);
    const set = new Set();
    if (!c || !c.emph) return set;
    const chars = Array.from(text || '');
    for (const e of c.emph) {
      let idx = -1;
      for (let i = 0; i < chars.length; i++) if (chars[i] === e) { idx = i; break; }
      if (idx < 0) { // 兜底：取最后一个
        for (let i = chars.length - 1; i >= 0; i--) if (chars[i] === e) { idx = i; break; }
      }
      if (idx >= 0) set.add(idx);
    }
    return set;
  };

  /* ---------------- 2. 三种入场物理模型 ---------------- */
  /* 返回 { a, dy, sc, bleed, emph } —— 直接可用的绘制参数 */
  V4.charIn = function (mode, L, st, o) {
    o = o || {};
    const dt = L - st;
    if (dt < 0) return { a: 0, dy: 0, sc: 1, bleed: 0 };
    const emph = o.emph ? 1 : 0;
    if (mode === 'chant') {
      // 吟诵：0.42s 缓落，重字放大 1.35×，落位后跟一次墨晕
      const p = clamp(dt / 0.42);
      const e = Ease.outCubic(p);
      const bleed = clamp(1 - dt / 1.10) * (1 - p);
      return {
        a: clamp(e * 1.18),
        dy: (1 - e) * 12,
        sc: (emph ? 1.35 : 1) * (0.94 + 0.06 * Ease.spring(p, 7.5, 5.0)),
        bleed: bleed * 0.85,
        emph
      };
    }
    if (mode === 'rub') {
      // 碑拓：由淡及浓，0.75s 自纸纹深处洇出
      const p = clamp(dt / 0.75);
      const e = smoothstep(0, 1, p);
      return { a: 0.08 + 0.92 * e, dy: 0, sc: 1 + (1 - e) * 0.025, bleed: (1 - e) * 0.6, emph };
    }
    // hist 史笔刀刻：4~6 帧极速落位，不模糊，轻微刀刻抖动
    const p = clamp(dt / 0.085);
    const e = Ease.outQuint(p);
    return {
      a: clamp(e * 1.10),
      dy: (1 - e) * 2.2,
      sc: 1 + (1 - e) * 0.10,
      bleed: 0,
      emph,
      cut: (1 - e) * 1.6
    };
  };

  /* ---------------- 3. 竖排一列（带句读律动） ---------------- */
  V4.chantColumn = function (ctx, text, o) {
    const chars = Array.from(text);
    if (!chars.length) return null;
    const size = o.size ?? 78;
    const gap = o.gap ?? 1.10;
    const step = size * gap;
    const tl = V4.times(o.id, { t: o.start ?? 0, dur: 0.6, stagger: o.stagger ?? 0.06, n: chars.length });
    const mode = o.mode || V4.modeOf(o.id);
    const emph = V4.emphSet(o.id, text);
    let any = false;
    let a0 = 1;
    for (let i = 0; i < chars.length; i++) {
      const st = tl.times[i] ?? (o.start ?? 0);
      const e = V4.charIn(mode, o.L, st, { emph: emph.has(i) });
      if (e.a <= 0.008) continue;
      any = true;
      const y = (o.top ?? 0) + i * step + e.dy;
      const sc = e.sc * (o.scale ?? 1);
      // 墨晕：放大、极淡的一层垫在后面（吟诵/碑拓专用）
      if (e.bleed > 0.02) {
        ctx.save();
        ctx.translate(o.x, y);
        ctx.scale(sc * 1.10, sc * 1.10);
        if (DFS.V3 && DFS.V3.inkText) {
          DFS.V3.inkText(ctx, chars[i], {
            x: 0, y: 0, size, weight: o.weight ?? 900, family: o.family,
            color: o.bleedColor || o.color, alpha: clamp(e.bleed) * 0.34 * (o.alpha ?? 1),
            seed: (o.seed ?? 1) + i * 3
          });
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(o.x, y);
      ctx.scale(sc, sc);
      if (DFS.V3 && DFS.V3.inkText) {
        DFS.V3.inkText(ctx, chars[i], {
          x: 0, y: 0, size, weight: o.weight ?? 900, family: o.family,
          color: o.color, alpha: clamp(e.a) * (o.alpha ?? 1),
          seed: (o.seed ?? 1) + i * 3, halo: o.halo
        });
      }
      ctx.restore();
    }
    if (!any) return null;
    return {
      x: o.x, top: o.top ?? 0, w: size * 1.25,
      h: (chars.length - 1) * step + size * 1.25
    };
  };

  /* ---------------- 4. 横排一行（带句读律动） ---------------- */
  V4.chantLine = function (ctx, text, o) {
    const chars = Array.from(text);
    if (!chars.length) return null;
    const size = o.size ?? 88;
    const tracking = o.tracking ?? 6;
    const m = DFS.mkCanvas(8, 8).getContext('2d');
    m.font = DFS.font(size, o.weight ?? 900, o.family || DFS.THEME.fonts.heavy);
    const widths = chars.map((c) => m.measureText(c).width);
    let total = tracking * (chars.length - 1);
    for (const w of widths) total += w;
    const align = o.align || 'center';
    const x = o.x ?? W / 2;
    let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const tl = V4.times(o.id, { t: o.start ?? 0, dur: 0.6, stagger: o.stagger ?? 0.06, n: chars.length });
    const mode = o.mode || V4.modeOf(o.id);
    const emph = V4.emphSet(o.id, text);
    let any = false;
    for (let i = 0; i < chars.length; i++) {
      const st = tl.times[i] ?? (o.start ?? 0);
      const e = V4.charIn(mode, o.L, st, { emph: emph.has(i) });
      const cx = cursor + widths[i] / 2;
      cursor += widths[i] + tracking;
      if (e.a <= 0.008) continue;
      any = true;
      const y = (o.y ?? 0) + e.dy;
      const sc = e.sc;
      if (e.bleed > 0.02) {
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(sc * 1.10, sc * 1.10);
        if (DFS.V3 && DFS.V3.inkText) {
          DFS.V3.inkText(ctx, chars[i], {
            x: 0, y: 0, size, weight: o.weight ?? 900, family: o.family,
            color: o.color, alpha: clamp(e.bleed) * 0.34 * (o.alpha ?? 1), seed: (o.seed ?? 1) + i * 3
          });
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(sc, sc);
      if (DFS.V3 && DFS.V3.inkText) {
        DFS.V3.inkText(ctx, chars[i], {
          x: 0, y: 0, size, weight: o.weight ?? 900, family: o.family,
          color: o.color, alpha: clamp(e.a) * (o.alpha ?? 1), seed: (o.seed ?? 1) + i * 3,
          halo: o.halo
        });
      }
      ctx.restore();
    }
    if (!any) return null;
    return { x: x - total / 2, y: (o.y ?? 0) - size * 0.62, w: total, h: size * 1.24 };
  };

  /* ---------------- 5. 音画同步锚点导出（QA / 音轨共用） ---------------- */
  V4.allBeats = function () {
    const list = (DFS.STORY && DFS.STORY.cues) || [];
    const out = [];
    for (const c of list) {
      if (!c.groups || !c.groups.length) continue;
      const s = V4.schedule(c);
      s.starts.forEach((t, i) => out.push({ id: c.id, group: i, t, mode: c.mode }));
    }
    return out;
  };

})(window.DFS);
