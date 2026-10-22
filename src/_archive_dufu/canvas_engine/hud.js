/* =========================================================================
   hud.js — 「朱丝栏边栏 + 双行小字夹注」（V4）
   废除四角数码 HUD（编号 / 进度条 / 坐标 / 线框角标）。
   改为中国古籍刻本的版式：
     · 画面左侧一道朱丝栏（双线界栏），栏内竖排 地点 / 纪年 / 里数
     · 画面右侧双行小字夹注，竖排考据出处（《旧唐书》等），淡墨
     · 全部落在固定版心线内，字色淡墨或暗朱砂，随章节极缓淡入淡出
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const T = DFS.THEME;

  const RULE_X1 = 76;      // 内栏线
  const RULE_X2 = 128;     // 外栏线
  const RULE_Y0 = 118;
  const RULE_Y1 = 962;
  const COL_X = 102;       // 栏内竖排中线
  const NOTE_X = W - 84;   // 右侧夹注中线

  DFS.Hud = class Hud {
    constructor(cues) {
      this.cues = (cues || []).slice().sort((a, b) => a.t - b.t);
      this.sizePlace = 27;
      this.sizeYear = 19;
      this.sizeKm = 16;
      this.sizeSrc = 16;
      this._srcCache = null;
    }

    _cueAt(t) {
      let cur = null, prev = null;
      for (const c of this.cues) {
        if (c.t <= t) { prev = cur; cur = c; } else break;
      }
      return { cur, prev };
    }

    /* 章节 → 考据出处（右侧双行小字夹注） */
    _source(t) {
      const chs = (DFS.STORY && DFS.STORY.chapters) || [];
      const src = (DFS.STORY && DFS.STORY.sources) || {};
      let hit = null;
      for (const c of chs) if (t >= c.start && t <= c.end) hit = c;
      return hit ? (src[hit.id] || '') : '';
    }

    draw(ctx, t, opts) {
      opts = opts || {};
      const { cur, prev } = this._cueAt(t);
      const src = this._source(t);
      const dark = !!opts.dark;

      /* 栏线本身：始终存在，随全片极缓呼吸（这是"版心"，不是 HUD） */
      const ruleA = 0.52 + 0.06 * Math.sin(t * 0.31);
      const inkCol = dark ? '208,200,180' : '92,82,64';
      const cinnabar = dark ? '188,74,54' : '168,54,38';

      if (DFS.V4 && DFS.V4.cinnabarRule) {
        ctx.save();
        ctx.globalAlpha = 1;
        DFS.V4.cinnabarRule(ctx, {
          alpha: ruleA * (dark ? 0.72 : 0.62),
          color: cinnabar,
          seed: 17,
          lines: [
            { x: RULE_X1, y0: RULE_Y0, y1: RULE_Y1, w: 1.15 },
            { x: RULE_X2, y0: RULE_Y0 + 18, y1: RULE_Y1 - 18, w: 0.8 }
          ],
          ticks: [
            [RULE_X1, RULE_X2, RULE_Y0],
            [RULE_X1, RULE_X2, RULE_Y1]
          ]
        });
        ctx.restore();
      }

      /* ---------- 栏内：地点 / 纪年 / 里数（竖排） ---------- */
      if (cur) {
        const hide = cur.hide === true;
        const since = t - cur.t;
        let a;
        if (hide) a = clamp(1 - since / 0.30);
        else a = clamp(since / 0.60);
        a = Ease.outCubic(a) * (hide ? 1 : 1);
        if (a > 0.004) {
          const kmFrom = prev ? prev.km : cur.km;
          const kp = Ease.inOutCubic(clamp((since - 0.10) / 1.8));
          const km = lerp(kmFrom, cur.km, kp);
          if (DFS.dbg) DFS.dbg({ hud: { km, place: cur.place, year: cur.year, event: cur.event, style: 'zhushilan' } });

          let y = 182;
          const placeChars = Array.from(cur.place || '');
          if (DFS.V4 && DFS.V4.annotation) {
            DFS.V4.annotation(ctx, cur.place || '', {
              x: COL_X, y, size: this.sizePlace, gap: 1.16,
              color: inkCol, alpha: a * 0.82, family: T.fonts.kai, weight: 500
            });
            y += placeChars.length * this.sizePlace * 1.16 + 16;
            DFS.V4.annotation(ctx, cur.year || '', {
              x: COL_X, y, size: this.sizeYear, gap: 1.10,
              color: cinnabar, alpha: a * 0.72, family: T.fonts.kai, weight: 400
            });
            y += Array.from(cur.year || '').length * this.sizeYear * 1.10 + 14;
            // 里数：汉字记数 + "里"，不用 km 与等宽数字（那是数码感）
            const kmTxt = '行' + DFS.cnNum(Math.round(km)) + '里';
            DFS.V4.annotation(ctx, kmTxt, {
              x: COL_X, y, size: this.sizeKm, gap: 1.08,
              color: inkCol, alpha: a * 0.58, family: T.fonts.kai, weight: 400
            });
          }
        }
      }

      /* ---------- 右侧：双行小字夹注（考据出处） ---------- */
      if (src && DFS.V4 && DFS.V4.annotation) {
        // 在章节后段才浮现，像拓工补写题跋
        const chs = (DFS.STORY && DFS.STORY.chapters) || [];
        let ch = null;
        for (const c of chs) if (t >= c.start && t <= c.end) ch = c;
        let a = 0.34;
        if (ch) {
          const span = ch.end - ch.start;
          a = 0.30 * clamp((t - ch.start - span * 0.55) / 1.2) + 0.06;
        }
        if (a > 0.02) {
          DFS.V4.annotation(ctx, src, {
            x: NOTE_X, y: 168, size: this.sizeSrc, gap: 1.22,
            color: inkCol, alpha: a, family: T.fonts.kai, weight: 400
          });
        }
      }
    }
  };
})(window.DFS);
