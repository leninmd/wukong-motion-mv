/* =========================================================================
   app.js — 主时间轴 / 帧函数 / 长卷交叠 / 朱丝栏合成（V4）
   心智模型：整片是帧号的纯函数 f(t)，无挂钟时间、无 Math.random。

   V4 新增：
     · Cross-Scene Morph & Camera Carry：相邻分镜之间有 1.2s 交叠窗口，
       出场镜头做 Whip Pan 或 Zoom-through，入场镜头反向承接，形成一镜到底。
     · 贯穿全片的长卷锚点（墨屑 / 风痕），让 9 个分镜不再是孤岛。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, FPS, clamp, smoothstep } = DFS;

  DFS.sceneRegistry = DFS.sceneRegistry || {};

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const sceneBuf = document.createElement('canvas');
  sceneBuf.width = W; sceneBuf.height = H;
  const sctx = sceneBuf.getContext('2d', { alpha: false });
  const loading = document.getElementById('loading');
  const hint = document.getElementById('hint');

  let STORY = null, HUD = null, chapters = [];
  const TR_DUR = 1.2;

  /* ---------- 场景装配 ---------- */
  function build() {
    chapters = STORY.chapters.map((ch, i) => {
      const S = DFS.sceneRegistry[ch.scene];
      if (!S) console.warn('missing scene', ch.scene);
      return { ch, index: i, scene: S ? new S() : null };
    });
    HUD = new DFS.Hud(STORY.hud);
  }

  /* ---------- 调试状态（QA 探针读取） ---------- */
  function resetDebug() {
    window.DEBUG_STATE = {
      textBoxes: [], counters: {}, hud: null, typeField: 0, gullParticles: 0,
      goldBalls: 0, stamp: null, cards: [], camera: null, beats: 0
    };
  }
  DFS.dbg = function (o) { Object.assign(window.DEBUG_STATE, o); };
  DFS.dbgBox = function (id, x1, y1, x2, y2, extra) {
    (window.DEBUG_STATE.textBoxes || (window.DEBUG_STATE.textBoxes = []))
      .push(Object.assign({ id, x1, y1, x2, y2 }, extra || {}));
  };
  window.DEBUG_STATE = { textBoxes: [], counters: {}, hud: null, typeField: 0, gullParticles: 0 };

  /* ---------- 转场：章节变换（Whip Pan / Zoom-through） ---------- */
  function chapterTransform(c, t) {
    let dx = 0, sc = 1, fx = W * 0.5, fy = H * 0.48;
    const n = chapters.length;
    const trIn = c.index > 0 ? (STORY.transitions || [])[c.index - 1] : null;
    const trOut = c.index < n - 1 ? (STORY.transitions || [])[c.index] : null;

    if (trIn) {
      const p = clamp((t - c.ch.start) / TR_DUR);
      const e = Math.pow(1 - p, 2.4);
      if (trIn.type === 'whipPan') dx += (trIn.dir || 1) * W * 0.90 * e;
      else { sc += 0.95 * e; fx = W * (trIn.fx ?? 0.5); fy = H * (trIn.fy ?? 0.48); }
    }
    if (trOut) {
      const p = clamp((t - (c.ch.end - TR_DUR)) / TR_DUR);
      const e = Math.pow(p, 2.4);
      if (trOut.type === 'whipPan') dx -= (trOut.dir || 1) * W * 0.90 * e;
      else { sc += 1.05 * e; fx = W * (trOut.fx ?? 0.5); fy = H * (trOut.fy ?? 0.48); }
    }
    return { dx, sc, fx, fy };
  }

  /* ---------- 章节权重：交叠窗口的交叉溶解 ----------
     1.2s 的交叠窗口里，只有正中 0.36s 做真正的溶解；
     其余时间由 Whip Pan / Zoom-through 的运动把眼睛带走 ——
     这样交接处不会"糊成一片灰"，也不会出现断崖式硬切。
     ------------------------------------------------------ */
  function chapterWeight(c, t) {
    const s = c.ch.start, e = c.ch.end, n = chapters.length;
    let w = 1;
    if (c.index > 0) w *= smoothstep(s + 0.42, s + 0.78, t);
    if (c.index < n - 1) w *= 1 - smoothstep(e - 0.78, e - 0.42, t);
    return w;
  }

  function toneAt(t) {
    const chs = (STORY.chapters) || [];
    for (const c of chs) if (t >= c.start && t <= c.end) return c.tone || 'dark';
    return 'dark';
  }

  /* ---------- 长卷锚点：贯穿全片的墨屑与风痕 ----------
     它不属于任何一个分镜，因此它是"一镜到底"的物理证据。
     ------------------------------------------------------ */
  DFS.drawCarry = function (g, t, dark) {
    const r = DFS.rng(60613);
    const core = dark ? '232,224,204' : '44,34,20';
    const HX = DFS.hash;
    g.save();
    for (let i = 0; i < 16; i++) {
      const r1 = HX(9001, i * 4 + 1);
      const r2 = HX(9001, i * 4 + 2);
      const r3 = HX(9001, i * 4 + 3);
      const r4 = HX(9001, i * 4 + 4);
      const spd = 26 + r3 * 52;
      // 缓慢横穿全片 + 正弦浮沉（确定性、无挂钟）
      const x = ((r1 + (t * spd) / W * 0.05) % 1.16 - 0.08) * W;
      const y = H * (0.12 + r2 * 0.78) + Math.sin(t * (0.22 + r4 * 0.3) + i) * (18 + r4 * 34);
      const sz = 0.9 + r4 * 2.1;
      const a = (0.08 + r2 * 0.16) * (dark ? 1 : 0.85);
      // 亮晕（让墨屑在暗底也看得见）
      g.globalAlpha = a * 0.5;
      g.fillStyle = 'rgba(255,248,228,0.9)';
      g.beginPath();
      g.arc(x, y, sz * 2.4, 0, Math.PI * 2);
      g.fill();
      // 墨核
      g.globalAlpha = a;
      g.fillStyle = 'rgba(' + core + ',1)';
      g.beginPath();
      g.arc(x, y, sz, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  };

  /* ---------- 转场风痕：把 Whip Pan 的"速度"画出来 ---------- */
  function drawWindStreak(g, t, dir, p) {
    const a = Math.sin(Math.PI * clamp(p)) * 0.5;
    if (a < 0.01) return;
    g.save();
    g.globalAlpha = a;
    g.strokeStyle = 'rgba(246,240,224,0.55)';
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const r1 = DFS.hash(771, i * 3 + 1), r2 = DFS.hash(771, i * 3 + 2), r3 = DFS.hash(771, i * 3 + 3);
      const y = r1 * H;
      const len = 120 + r2 * 620;
      const x = W * 0.5 + dir * ((r3 - 0.5) * W * 1.2);
      g.lineWidth = 0.8 + r2 * 2.6;
      g.globalAlpha = a * (0.12 + r2 * 0.30);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dir * len, y + (r3 - 0.5) * 8);
      g.stroke();
    }
    g.restore();
  }

  /* ---------- 主绘制 ---------- */
  function render(t) {
    t = clamp(t, 0, STORY.duration);
    const frame = Math.round(t * FPS);
    resetDebug();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = '#070703';
    ctx.fillRect(0, 0, W, H);

    let hudDark = false, tone = toneAt(t);
    let activeTr = null, activeTrP = 0;

    for (const c of chapters) {
      const s = c.ch.start, e = c.ch.end;
      if (t < s || t > e) continue;
      const w = chapterWeight(c, t);
      if (w <= 0.003) continue;
      const local = t - s;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
      sctx.filter = 'none';
      sctx.clearRect(0, 0, W, H);
      try {
        c.scene && c.scene.draw(sctx, local, t, c.ch);
      } catch (err) {
        console.error('scene error', c.ch.id, err);
      }
      const tr = chapterTransform(c, t);
      ctx.save();
      ctx.globalAlpha = w;
      if (tr.dx !== 0) ctx.translate(tr.dx, 0);
      if (tr.sc !== 1) {
        ctx.translate(tr.fx, tr.fy);
        ctx.scale(tr.sc, tr.sc);
        ctx.translate(-tr.fx, -tr.fy);
      }
      ctx.drawImage(sceneBuf, 0, 0);
      ctx.restore();
      if (c.scene && c.scene.hudDark) hudDark = !!c.scene.hudDark(local, t);

      // 记录当前活跃的转场（用于风痕）
      const trOut = c.index < chapters.length - 1 ? (STORY.transitions || [])[c.index] : null;
      if (trOut && t > e - TR_DUR) {
        activeTr = trOut; activeTrP = clamp((t - (e - TR_DUR)) / TR_DUR);
      }
    }

    // 长卷锚点：墨屑贯穿全片
    DFS.drawCarry(ctx, t, tone === 'dark');

    // 转场风痕
    if (activeTr && activeTr.type === 'whipPan') {
      drawWindStreak(ctx, t, activeTr.dir || 1, activeTrP);
    }

    // 朱丝栏边栏
    if (HUD) {
      ctx.save();
      HUD.draw(ctx, t, { dark: hudDark });
      ctx.restore();
    }

    if (DFS.DEBUG) {
      ctx.save();
      ctx.font = '16px "Courier New", monospace';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillText('t=' + t.toFixed(2) + 's  f=' + frame, 16, H - 16);
      ctx.restore();
    }
  }

  /* ---------- 对外接口 ---------- */
  window.FPS = FPS;
  window.DURATION = 0;
  window.seek = function (timeSeconds) { render(timeSeconds); };
  window.renderFrame = function (frameIndex) { render(frameIndex / FPS); };
  window.cadenceBeats = function () {
    return (DFS.V4 && DFS.V4.allBeats) ? DFS.V4.allBeats() : [];
  };

  DFS.DEBUG = /[?&]debug=1/.test(location.search);
  if (DFS.DEBUG && hint) hint.textContent = 'SPACE 播放/暂停 · ← → 逐帧 · ' + location.search;

  /* ---------- 启动 ---------- */
  async function boot() {
    try {
      await document.fonts.ready;
      const STORY_URL = window.STORY_URL || 'storyboard.v4.json';
      const res = await fetch(STORY_URL, { cache: 'no-store' });
      STORY = await res.json();
      DFS.STORY = STORY;
      window.DURATION = STORY.duration;
      build();
      DFS.getPaper();
      DFS.getGrain();
      render(0);
      loading.style.opacity = '0';
      setTimeout(function () { if (loading.parentNode) loading.remove(); }, 450);
      window.READY = true;

      const params = new URLSearchParams(location.search);
      if (params.has('t')) {
        render(parseFloat(params.get('t')));
      } else if (!/[?&]render=1/.test(location.search)) {
        let playing = true, clock = 0, last = performance.now();
        const loop = function (now) {
          const dt = (now - last) / 1000; last = now;
          if (playing) {
            clock += dt;
            if (clock > STORY.duration) clock = 0;
            render(clock);
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        window.addEventListener('keydown', function (e) {
          if (e.code === 'Space') { playing = !playing; e.preventDefault(); }
          if (e.code === 'ArrowRight') { clock = Math.min(STORY.duration, clock + 1 / FPS); render(clock); }
          if (e.code === 'ArrowLeft') { clock = Math.max(0, clock - 1 / FPS); render(clock); }
        });
        window.__getClock = function () { return clock; };
      } else {
        render(0);
      }
    } catch (err) {
      loading.textContent = 'BOOT ERROR: ' + err.message;
      console.error(err);
    }
  }
  boot();

})(window.DFS);
