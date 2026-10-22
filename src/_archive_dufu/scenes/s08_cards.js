/* =========================================================================
   s08_cards.js — 98.1–110.3s 丰碑 · 光焰万丈
   劫难废墟下裂出地火，四座青铜重简拔地而起；
   定论：李杜文章在，光焰万丈长。（韩愈）
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const V3 = DFS.V3;
  const HUB = DFS.HUB;
  const T = DFS.THEME;

  DFS.sceneRegistry['s08'] = class Scene08V3 {
    draw(ctx, L, t, ch) {
      const st = DFS.STORY.texts;
      const tForge = clamp((L - 1.4) / 2.6);      // 地火
      const tSlips = clamp((L - 2.9) / 2.4);      // 铜简升起
      const pMain = HUB.multiEntrance(L, 5.6, { duration: 1.0, rise: 24, blur: 0 });
      const pNote = HUB.multiEntrance(L, 8.3, { duration: 0.9, rise: 16, blur: 0 });
      const tOut = clamp((L - 11.7) / 0.8);

      V3.eight(ctx, t, {
        void: true,
        voidInner: '#191510', voidMid: '#0B0906', voidOuter: '#040302',
        grade: 'warm', grain: 0.48, vignette: 0.32, dustAlpha: 0.55,
        l2: (c) => {
          // 废墟残影（渐隐）
          c.save();
          c.globalAlpha = 0.22 * (1 - tSlips * 0.6);
          for (let i = 0; i < 5; i++) {
            const x = W * (0.2 + i * 0.15);
            const h = 120 + (i % 3) * 60;
            c.fillStyle = 'rgba(26,24,20,0.9)';
            c.beginPath();
            c.moveTo(x - 90, H);
            c.lineTo(x - 70, H - h);
            c.lineTo(x + 40, H - h - 30 * (i % 2));
            c.lineTo(x + 95, H);
            c.closePath();
            c.fill();
          }
          c.restore();
        },
        l3: (c) => {
          // 地火辉光
          if (tForge > 0.01) {
            const g = c.createRadialGradient(W * 0.5, H * 1.02, 20, W * 0.5, H * 0.98, H * 0.95);
            g.addColorStop(0, `rgba(255,176,62,${0.30 * tForge})`);
            g.addColorStop(0.4, `rgba(220,110,30,${0.14 * tForge})`);
            g.addColorStop(1, 'rgba(220,110,30,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
          }
        },
        l4: (c) => {
          // 地火裂纹（从底部中心向上分叉）
          if (tForge > 0.01) {
            const r = DFS.rng(8123);
            c.save();
            c.globalCompositeOperation = 'lighter';
            const N = 9;
            for (let k = 0; k < N; k++) {
              let x = W * 0.5 + (r() - 0.5) * 80;
              let y = H + 10;
              const ang0 = -Math.PI / 2 + (r() - 0.5) * 1.5;
              let ang = ang0;
              const segs = Math.round((18 + r() * 10) * Ease.outCubic(tForge));
              c.beginPath();
              c.moveTo(x, y);
              for (let i = 0; i < segs; i++) {
                ang += (r() - 0.5) * 0.7;
                const len = 18 + r() * 30;
                x += Math.cos(ang) * len;
                y += Math.sin(ang) * len;
                c.lineTo(x, y);
              }
              const a = clamp(tForge * 1.4 - k * 0.05) * (1 - clamp((L - 6.5) / 2.2) * 0.55);
              c.strokeStyle = `rgba(255,${170 + k * 6},${70 + k * 4},${0.55 * a})`;
              c.lineWidth = 1.6 + (k % 3) * 0.8;
              c.stroke();
              c.strokeStyle = `rgba(255,238,190,${0.30 * a})`;
              c.lineWidth = 0.7;
              c.stroke();
            }
            c.restore();
          }

          // 四座青铜重简
          if (tSlips > 0.001) {
            const titles = st.s08_cards;
            const n = titles.length;
            const gap = 210;
            const baseX = W * 0.5 - (gap * (n - 1)) / 2;
            for (let i = 0; i < n; i++) {
              const p = Ease.outExpo(clamp((tSlips - i * 0.11) / 0.7));
              if (p <= 0.001) continue;
              const x = baseX + i * gap;
              const y = lerp(H + 340, H * 0.585, p);
              const w = 118, h = 470;
              c.save();
              c.translate(x, y);
              // 简身（青铜渐变）
              const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
              g.addColorStop(0, 'rgba(58,44,26,1)');
              g.addColorStop(0.28, 'rgba(122,94,48,1)');
              g.addColorStop(0.5, 'rgba(196,158,86,1)');
              g.addColorStop(0.72, 'rgba(122,94,48,1)');
              g.addColorStop(1, 'rgba(46,34,20,1)');
              c.fillStyle = g;
              c.fillRect(-w / 2, -h / 2, w, h);
              // 金边
              c.strokeStyle = `rgba(255,222,150,${0.55 * p})`;
              c.lineWidth = 1.6;
              c.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
              // 编绳
              c.strokeStyle = 'rgba(40,30,18,0.85)';
              c.lineWidth = 3;
              for (let k = 1; k <= 3; k++) {
                c.beginPath();
                c.moveTo(-w / 2, -h / 2 + (h / 4) * k);
                c.lineTo(w / 2, -h / 2 + (h / 4) * k);
                c.stroke();
              }
              // 题名（竖排）
              const chars = Array.from(titles[i]);
              const fs = 46;
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.font = DFS.font(fs, 700, T.fonts.heavy);
              chars.forEach((ch2, k) => {
                const yy = -h / 2 + 90 + k * (fs * 1.32);
                c.fillStyle = 'rgba(30,20,10,0.55)';
                c.fillText(ch2, 1.5, yy + 1.5);
                c.fillStyle = 'rgba(255,240,208,0.95)';
                c.fillText(ch2, 0, yy);
              });
              c.restore();
            }
          }
        },
        l5: (c) => {
          const V4 = DFS.V4;
          if (V4) {
            const m1 = V4.chantLine(c, st.s08_main, {
              id: 's08_main', L, x: W * 0.5, y: 236, size: 92, weight: 900,
              family: T.fonts.heavy, color: 'rgba(244,236,214,0.98)', tracking: 6, seed: 3, halo: 0.5
            });
            if (m1) DFS.dbgBox('s08_main', m1.x, m1.y, m1.x + m1.w, m1.y + m1.h);
            const m2 = V4.chantLine(c, st.s08_note, {
              id: 's08_note', L, x: W * 0.5 + 250, y: 848, size: 34, weight: 400,
              family: T.fonts.serif, color: 'rgba(214,206,186,0.9)', tracking: 4, seed: 7, halo: 0.5
            });
            if (m2) DFS.dbgBox('s08_note', m2.x, m2.y, m2.x + m2.w, m2.y + m2.h);
            if (pNote.alpha > 0.01) {
              c.save();
              c.globalAlpha = pNote.alpha * 0.6;
              V3.inkText(c, st.s08_note_src, {
                x: W * 0.5 + 330, y: 898, size: 20, weight: 400,
                family: T.fonts.serif, color: 'rgba(196,188,168,0.8)', halo: 0.5
              });
              c.restore();
            }
          } else {
            V3.inkText(c, st.s08_main, {
              x: W * 0.5, y: 236, size: 92, weight: 900,
              family: T.fonts.heavy, color: 'rgba(244,236,214,0.98)', tracking: 6
            });
          }
        }
      });

      if (tOut > 0.001) {
        ctx.save();
        ctx.globalAlpha = Ease.inOutCubic(tOut) * 0.75;
        ctx.fillStyle = '#050403';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    hudDark(L) { return L < 12; }
  };
})(window.DFS);
