/* =========================================================================
   s01_title.js — 0.0–10.4s（L 0..10.4）· 青史有名
   0.0        满幅麻纸：1.10× 微距 → 3s 内推到 1.02×，极淡晨曦斜光缓扫，金屑缓漂
   2.0        玄铁重印「杜」自 Z 轴深处砸入纸面（0.45s）+ 震屏 + 三圈墨涟漪
   3.95–5.0   墨自印中渗出：竖排史传主文逐字显形（两列，右起）
   6.5        左下角出处小字
   5.2–9.0    静帧 Hold：只留气溶胶与 1–2px 呼吸
   9.0–10.4   纸面微压暗 + 右移 30px，交棒 S02
   文字全部取自 storyboard.v3.json 的 texts.s01_main / texts.s01_source，逐字照抄。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const T = DFS.THEME;
  const HUB = DFS.HUB;
  const V3 = DFS.V3;

  /* ---------- 重印 ---------- */
  const STAMP_X = 960, STAMP_Y = 470, STAMP_SIZE = 420;
  const STAMP_T0 = 0.95, STAMP_DUR = 0.45, IMPACT_AT = 0.35;
  const IMPACT_T = STAMP_T0 + STAMP_DUR * IMPACT_AT;      // ≈ 2.1575
  const IMPACT_F = Math.round(IMPACT_T * DFS.FPS);

  /* ---------- 主文（竖排两列，右起） ----------
     19 字 × 74px × 1.18 = 1658px，单列必出画，故按 10 + 9 分两列；
     每字 0.05s（3 帧）错落——19 字若用 0.10s 要 1.8s，会顶穿 5.0s 的静帧 Hold。
     ------------------------------------------------ */
  const MAIN_SIZE = 74, MAIN_GAP = 1.18, MAIN_LEAD = MAIN_SIZE * MAIN_GAP;
  const COL_R = 1170, COL_L = 1066, MAIN_TOP = 180, MAIN_SPLIT = 10;
  const T_SEEP = 3.10, SEEP_FADE = 0.34;

  /* ---------- 出处小字 ---------- */
  const T_SRC = 5.20, SRC_SIZE = 24, SRC_X = 152, SRC_Y = 946;
  /* V4：句读律动由 storyboard.v4.json 的 cues 驱动（史笔刀刻模式） */
  let SEED_TL = null;

  DFS.sceneRegistry['s01'] = class Scene01V3 {
    constructor() {
      const texts = (DFS.STORY && DFS.STORY.texts) || {};
      const main = Array.from(texts.s01_main || '');
      this.cols = [main.slice(0, MAIN_SPLIT), main.slice(MAIN_SPLIT)];
      this.source = texts.s01_source || '';
      this._seal = null;
      this._srcW = 0;
      this._fiber = null;
    }

    /* 微距纸纤维叠加：把 V3.paper 的纤维在放大镜头下补足到"看得见毛"的强度 */
    _fiberCanvas() {
      if (this._fiber) return this._fiber;
      const cv = DFS.mkCanvas(W, H);
      const c = cv.getContext('2d');
      const r = DFS.rng(55117);
      c.save();
      for (let i = 0; i < 2400; i++) {
        const x = r() * W, y = r() * H;
        const horiz = r() > 0.24;
        const len = (horiz ? 40 : 22) + r() * (horiz ? 250 : 80);
        const a = 0.026 + r() * 0.075;
        c.strokeStyle = r() > 0.46 ? 'rgba(92,74,50,' + a.toFixed(3) + ')'
          : 'rgba(255,252,240,' + (a * 1.4).toFixed(3) + ')';
        c.lineWidth = 0.5 + r() * 1.0;
        c.beginPath();
        c.moveTo(x, y);
        if (horiz) c.lineTo(x + len, y + (r() - 0.5) * 2.0);
        else c.lineTo(x + (r() - 0.5) * 4, y + len);
        c.stroke();
      }
      for (let i = 0; i < 1200; i++) {
        const x = r() * W, y = r() * H, s = 0.8 + r() * 2.6;
        c.fillStyle = r() > 0.5 ? 'rgba(96,78,52,' + (0.018 + r() * 0.045).toFixed(3) + ')'
          : 'rgba(255,253,244,' + (0.026 + r() * 0.065).toFixed(3) + ')';
        c.beginPath();
        c.ellipse(x, y, s, s * (0.5 + r() * 0.6), r() * 3.14, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      this._fiber = cv;
      return cv;
    }

    /* 印面烘焙（p=1 的印 → 可任意 alpha 复用的位图） */
    _sealCanvas() {
      if (this._seal) return this._seal;
      const S = 560;
      const cv = DFS.mkCanvas(S, S);
      const c = cv.getContext('2d');
      c.translate(S / 2, S / 2);
      HUB.inkStampSplash(c, 0, 0, 1, 7129, {
        size: STAMP_SIZE, text: '杜', chars: 'single', color: '#1A1309', rotate: -0.012
      });
      this._seal = cv;
      return cv;
    }

    /* 落印后的墨痕残留：墨被纸吸走，只留极淡的印痕 */
    _sealAlpha(L) {
      // V4：墨被纸吸走之后就不再是"灰方块"了 —— 3.55s 前彻底退净，
      // 把干净的麻纸留给《旧唐书》的史笔。
      if (L < 2.55) return 1;
      if (L < 3.55) return lerp(1, 0, Ease.inCubic(clamp((L - 2.55) / 1.00)));
      return 0;
    }

    /* 印缘的墨晕与毛细渗出细丝（让"砸进纸里"有物性，而不是浮在纸上） */
    _sealHalo(c, a) {
      if (a < 0.004) return;
      const half = STAMP_SIZE / 2;
      const r = DFS.rng(6612);
      c.save();
      for (let k = 0; k < 3; k++) {
        c.strokeStyle = 'rgba(26,19,9,' + (a * [0.055, 0.032, 0.017][k]).toFixed(4) + ')';
        c.lineWidth = [7, 16, 30][k];
        c.strokeRect(STAMP_X - half, STAMP_Y - half, STAMP_SIZE, STAMP_SIZE);
      }
      c.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const side = i % 4;
        const u = r();
        let x0, y0, dx, dy;
        if (side === 0) { x0 = STAMP_X - half + u * STAMP_SIZE; y0 = STAMP_Y - half; dx = (r() - 0.5) * 10; dy = -1; }
        else if (side === 1) { x0 = STAMP_X - half + u * STAMP_SIZE; y0 = STAMP_Y + half; dx = (r() - 0.5) * 10; dy = 1; }
        else if (side === 2) { x0 = STAMP_X - half; y0 = STAMP_Y - half + u * STAMP_SIZE; dx = -1; dy = (r() - 0.5) * 10; }
        else { x0 = STAMP_X + half; y0 = STAMP_Y - half + u * STAMP_SIZE; dx = 1; dy = (r() - 0.5) * 10; }
        const len = 6 + r() * 26;
        c.strokeStyle = 'rgba(26,19,9,' + (a * (0.05 + r() * 0.16)).toFixed(4) + ')';
        c.lineWidth = 0.6 + r() * 1.1;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x0 + dx * len, y0 + dy * len);
        c.stroke();
      }
      c.restore();
    }

    /* 一圈扩散涟漪：半径 0→520，alpha .35→0，线宽 2→0.4 */
    _ripple(c, prog, seed, amp) {
      if (prog <= 0 || prog >= 1) return;
      const r = 520 * Ease.outCubic(prog);
      const a = 0.35 * (amp ?? 1) * Math.pow(1 - prog, 1.6);
      c.save();
      c.strokeStyle = 'rgba(26,19,9,' + a.toFixed(4) + ')';
      c.lineWidth = Math.max(0.4, 2 - 1.6 * prog);
      c.beginPath();
      const N = 72;
      for (let i = 0; i <= N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const wob = 1 + 0.038 * Math.sin(ang * 3 + seed) + 0.026 * Math.sin(ang * 7 + seed * 2.3);
        const px = STAMP_X + Math.cos(ang) * r * wob;
        const py = STAMP_Y + Math.sin(ang) * r * wob * 0.94;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.restore();
    }

    _sourceWidth() {
      if (!this._srcW) {
        const m = DFS.mkCanvas(8, 8).getContext('2d');
        m.font = DFS.font(SRC_SIZE, 400, T.fonts.serif);
        this._srcW = m.measureText(this.source).width;
      }
      return this._srcW;
    }

    draw(ctx, L, t) {
      const frame = Math.round(L * DFS.FPS);

      /* ---------- 时间线 ---------- */
      const stampP = clamp((L - STAMP_T0) / STAMP_DUR);
      const shake = (frame >= IMPACT_F)
        ? HUB.cameraShake(frame, { amp: 12, decay: 8, startFrame: IMPACT_F, seed: 19 })
        : { x: 0, y: 0, rot: 0 };
      const br = HUB.idleMicroMotion(L, 3, 0.42);          // 1–2px 呼吸
      const panP = Ease.inOutCubic(clamp((L - 6.20) / 1.80)); // 6.2–8.0 右移 32px（交棒 S02）
      const panX = 30 * panP + br.dx * 0.55;
      const panY = br.dy * 0.5;
      const darkTail = 0.12 * panP;
      const impact = L - IMPACT_T;
      const cols = this.cols;
      const srcW = this._sourceWidth();

      ctx.save();
      HUB.applyCameraShake(ctx, shake);
      ctx.translate(panX, panY);

      V3.eight(ctx, t, {
        grain: 0.34,
        vignette: 0.20,
        vignetteMid: 0.03,
        dustAlpha: 0.40,
        dustOpts: { color: '226,198,138' },

        /* ---- L1 纸：1.10× 微距 → 1.02×（贴着纸面看纤维） ---- */
        l1: (c) => {
          const push = Ease.outCubic(clamp(L / 3.0));
          const zoom = lerp(1.10, 1.02, push) + 0.085 * panP;   // 尾段再放大，保证平移不露边
          const ox = lerp(-19, 11, push) + Math.sin(L * 0.10) * 3.2;
          const oy = lerp(15, -9, push) + Math.cos(L * 0.085) * 2.6;
          V3.paper(c, { zoom, ox, oy });
          // 微距纤维叠加（同变换，跟纸一起推近）
          const fb = this._fiberCanvas();
          c.save();
          c.globalAlpha = 0.62;
          c.drawImage(
            fb,
            -(W * (zoom - 1)) / 2 + ox, -(H * (zoom - 1)) / 2 + oy,
            W * zoom, H * zoom
          );
          c.restore();
          if (darkTail > 0.001) {
            c.save();
            c.globalAlpha = darkTail;
            c.fillStyle = 'rgba(12,12,10,1)';
            c.fillRect(0, 0, W, H);
            c.restore();
          }
        },

        /* ---- L3 极淡晨曦斜光：缓慢扫过 ---- */
        l3: (c) => {
          const sweep = Math.sin(L * 0.135) * 0.02 + 0.012 * Math.sin(L * 0.31);
          c.save();
          c.translate(W * 0.5, 0);
          c.rotate(-0.055 + sweep);
          c.translate(-W * 0.5, 0);
          V3.volumetricLight(c, t, { count: 3, alpha: 0.048, color: '255,241,212' });
          c.restore();

          // 一道极淡的斜向晨光带，10.4s 内横向缓慢扫过一次
          const sx = -560 + 2900 * (L / 10.4);
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.translate(sx, -160);
          c.rotate(0.62);
          const g = c.createLinearGradient(0, 0, 470, 0);
          g.addColorStop(0, 'rgba(255,246,220,0)');
          g.addColorStop(0.45, 'rgba(255,246,220,0.060)');
          g.addColorStop(0.62, 'rgba(255,250,232,0.040)');
          g.addColorStop(1, 'rgba(255,246,220,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, 470, 2600);
          c.restore();

          // 极柔的晨光晕（左上），把"光"从硬边光柱里救回来
          const rg = c.createRadialGradient(W * 0.24, H * 0.10, 30, W * 0.24, H * 0.10, W * 0.72);
          rg.addColorStop(0, 'rgba(255,248,226,0.16)');
          rg.addColorStop(1, 'rgba(255,248,226,0)');
          c.fillStyle = rg;
          c.fillRect(0, 0, W, H);
        },

        /* ---- L4 重印砸落 / 涟漪 / 纸面压痕（物理层） ---- */
        l4: (c) => {
          // 纸面压痕：落点长久的凹陷暗影
          if (impact > -0.06) {
            const d = clamp((L - (IMPACT_T - 0.06)) / 0.55);
            const a = 0.20 * d;
            const g = c.createRadialGradient(STAMP_X + 6, STAMP_Y + 10, 18, STAMP_X + 6, STAMP_Y + 10, 330);
            g.addColorStop(0, 'rgba(28,20,10,' + a.toFixed(3) + ')');
            g.addColorStop(0.52, 'rgba(40,30,16,' + (a * 0.40).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(40,30,16,0)');
            c.fillStyle = g;
            c.fillRect(STAMP_X - 340, STAMP_Y - 340, 680, 680);
          }

          // 落印前的投影收缩：从 Z 轴深处来
          if (L > 1.86 && L < IMPACT_T) {
            const k = clamp((L - 1.86) / (IMPACT_T - 1.86));
            const r = lerp(300, 208, Ease.inCubic(k));
            const g = c.createRadialGradient(STAMP_X + 12, STAMP_Y + 18, 6, STAMP_X + 12, STAMP_Y + 18, r);
            g.addColorStop(0, 'rgba(24,17,8,' + (0.04 + 0.15 * k).toFixed(3) + ')');
            g.addColorStop(1, 'rgba(24,17,8,0)');
            c.fillStyle = g;
            c.beginPath();
            c.ellipse(STAMP_X + 12, STAMP_Y + 18, r, r * 0.86, 0, 0, Math.PI * 2);
            c.fill();
          }

          // 印：0.45s 内砸完；之后退成墨痕
          if (L >= STAMP_T0) {
            if (stampP < 1) {
              HUB.inkStampSplash(c, STAMP_X, STAMP_Y, stampP, 7129, {
                size: STAMP_SIZE, text: '杜', chars: 'single', color: '#1A1309', rotate: -0.012
              });
            } else {
              const a = this._sealAlpha(L);
              if (a > 0.005) {
                const cv = this._sealCanvas();
                c.save();
                c.globalAlpha = a;
                c.drawImage(cv, STAMP_X - cv.width / 2, STAMP_Y - cv.height / 2);
                c.restore();
                if (a > 0.34) this._sealHalo(c, clamp((L - IMPACT_T) / 0.20) * a);
              }
            }
          }

          // 三圈涟漪（冲击后依次荡开）
          for (let i = 0; i < 3; i++) {
            const st = IMPACT_T + i * 0.24;
            const p = clamp((L - st) / 2.15);
            this._ripple(c, p, 3.1 + i * 2.7, [1.25, 0.85, 0.6][i]);
          }

          // 纤维断裂：冲击把纸纤维顶开，随即被墨吸住（快出）
          if (L > IMPACT_T && L < 4.2) {
            const ex = HUB.fastExit(L, 2.90, { duration: 0.75 });
            const grow = clamp((L - IMPACT_T) / 0.3);
            const r = DFS.rng(3311);
            c.save();
            c.lineCap = 'round';
            for (let i = 0; i < 34; i++) {
              const ang = r() * Math.PI * 2;
              const d0 = 148 + r() * 150;
              const len = 26 + r() * 96;
              c.strokeStyle = 'rgba(24,17,8,' + (0.11 * ex.alpha * (0.45 + r() * 0.55)).toFixed(4) + ')';
              c.lineWidth = 0.6 + r() * 1.2;
              c.beginPath();
              c.moveTo(STAMP_X + Math.cos(ang) * d0, STAMP_Y + Math.sin(ang) * d0 * 0.92);
              c.lineTo(
                STAMP_X + Math.cos(ang) * (d0 + len * grow),
                STAMP_Y + Math.sin(ang) * (d0 + len * grow) * 0.92
              );
              c.stroke();
            }
            c.restore();
          }
        },

        /* ---- L5 排版：竖排史传主文（史笔刀刻模式）+ 出处 ---- */
        l5: (c) => {
          const V4 = DFS.V4;
          if (!SEED_TL && V4) SEED_TL = V4.times('s01_main', { t: T_SEEP, dur: 0.2, stagger: 0.05, n: 19 });
          const tl = SEED_TL || { times: [] };
          const colX = [COL_R, COL_L];
          const colBase = [0, MAIN_SPLIT];
          for (let ci = 0; ci < 2; ci++) {
            const chars = cols[ci];
            const x = colX[ci];
            for (let i = 0; i < chars.length; i++) {
              const gi = colBase[ci] + i;
              const st = tl.times[gi] === undefined ? (T_SEEP + gi * 0.05) : tl.times[gi];
              if (L < st) continue;
              // 史笔刀刻：4~6 帧极速落位，无模糊，落到即定
              const e = V4 ? V4.charIn('hist', L, st) : { a: Ease.outCubic(clamp((L - st) / SEEP_FADE)), dy: 0, sc: 1, cut: 0 };
              const y = MAIN_TOP + MAIN_SIZE * 0.55 + i * MAIN_LEAD;
              // 竖排标点：抬到字格右上，才像竖写的句读
              const ch = chars[i];
              const punc = '，。、；：'.indexOf(ch) >= 0;
              const px = punc ? x + MAIN_SIZE * 0.13 : x;
              const py = punc ? y - MAIN_SIZE * 0.30 : y;
              const cutJit = (e.cut || 0) * (DFS.hash(77, gi) - 0.5) * 2.4;
              c.save();
              c.globalAlpha = clamp(e.a);
              c.translate(px + cutJit, py + e.dy);
              if (e.sc !== 1) c.scale(e.sc, e.sc);
              V3.inkText(c, ch, {
                x: 0, y: 0, size: MAIN_SIZE, weight: 800, color: '#1A1309', seed: 120 + gi, halo: 0.34
              });
              c.restore();
            }
          }

          if (L > T_SEEP - 0.05) {
            DFS.dbgBox(
              's01_main',
              COL_L - MAIN_SIZE * 0.62, MAIN_TOP,
              COL_R + MAIN_SIZE * 0.62,
              MAIN_TOP + MAIN_SIZE * 0.55 + 9 * MAIN_LEAD + MAIN_SIZE * 0.55
            );
          }

          // 出处小字（左下角，6.5s 起）
          if (L > T_SRC) {
            const ent = HUB.multiEntrance(L, T_SRC, { duration: 0.80, rise: 9 });
            if (ent.alpha > 0.01) {
              c.save();
              c.globalAlpha = 0.75 * ent.alpha;
              c.fillStyle = 'rgb(90,80,62)';
              c.font = DFS.font(SRC_SIZE, 400, T.fonts.serif);
              c.textAlign = 'left';
              c.textBaseline = 'middle';
              c.fillText(this.source, SRC_X, SRC_Y + ent.dy);
              c.restore();
              DFS.dbgBox('s01_src', SRC_X - 2, SRC_Y - 18, SRC_X + srcW + 2, SRC_Y + 18);
            }
          }
        },

        /* ---- L7 调色：暖纸 + 尾段轻压暗 ---- */
        l7: (c) => {
          c.globalCompositeOperation = 'soft-light';
          c.globalAlpha = 0.10;
          c.fillStyle = '#F0D9A8';
          c.fillRect(0, 0, W, H);
          if (panP > 0.001) {
            c.globalCompositeOperation = 'source-over';
            c.globalAlpha = 0.055 * panP;
            c.fillStyle = '#1A1309';
            c.fillRect(0, 0, W, H);
          }
        }
      });

      ctx.restore();
    }

    hudDark() { return false; }
  };
})(window.DFS);
