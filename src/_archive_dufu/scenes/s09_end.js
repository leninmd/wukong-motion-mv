/* =========================================================================
   s09_end.js — 110.1–120.0s 终章 · 万古诗史
   大雪落湘江，孤舟远去，舟中灯化作一滴金墨入水，江水成金。
   绝笔：战血流依旧 / 军声动至今。钤印：诗史。
   ========================================================================= */
(function (DFS) {
  'use strict';
  const { W, H, clamp, lerp, Ease } = DFS;
  const V3 = DFS.V3;
  const HUB = DFS.HUB;
  const T = DFS.THEME;

  DFS.sceneRegistry['s09'] = class Scene09V3 {
    draw(ctx, L, t, ch) {
      const st = DFS.STORY.texts;
      const tSnow = clamp(L / 1.2);
      const tGold = clamp((L - 2.6) / 2.2);        // 灯化金墨 → 江水成金
      const pA = HUB.multiEntrance(L, 4.10, { duration: 1.1, rise: 26, blur: 0 });
      const pB = HUB.multiEntrance(L, 5.50, { duration: 1.1, rise: 26, blur: 0 });
      const tSeal = clamp((L - 7.00) / 0.5);
      const pNote = HUB.multiEntrance(L, 8.00, { duration: 0.9, rise: 14, blur: 0 });
      const tEnd = clamp((L - 9.90) / 0.80);

      V3.eight(ctx, t, {
        void: true,
        voidInner: '#0E1114', voidMid: '#07090A', voidOuter: '#020304',
        grade: 'cold', grain: 0.5, vignette: 0.34, dustAlpha: 0.3,
        l2: (c) => {
          // 江面：冷灰的雪夜水面
          const horizon = H * 0.52;
          const g = c.createLinearGradient(0, horizon, 0, H);
          g.addColorStop(0, 'rgba(30,36,40,0.9)');
          g.addColorStop(0.45, 'rgba(20,26,30,0.95)');
          g.addColorStop(1, 'rgba(10,14,17,1)');
          c.fillStyle = g;
          c.fillRect(0, horizon, W, H - horizon);
          // 水面细纹
          const r = DFS.rng(6611);
          c.save();
          for (let i = 0; i < 120; i++) {
            const k = i / 120;
            const y = horizon + Math.pow(k, 1.8) * (H - horizon);
            const n = Math.round(lerp(90, 14, k));
            for (let j = 0; j < n; j++) {
              const x = ((j + r() * 0.9) / n) * W;
              c.strokeStyle = `rgba(190,200,206,${0.02 + r() * 0.05})`;
              c.lineWidth = 0.6 + k * 1.2;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x + lerp(8, 60, k) * (0.5 + r()), y);
              c.stroke();
            }
          }
          c.restore();
          // 金色江水（从舟下沉入的金墨扩散）
          if (tGold > 0.001) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            const gg = c.createLinearGradient(0, horizon + 40, 0, H);
            gg.addColorStop(0, `rgba(214,168,86,0)`);
            gg.addColorStop(0.5, `rgba(214,168,86,${0.16 * tGold})`);
            gg.addColorStop(1, `rgba(232,196,120,${0.26 * tGold})`);
            c.fillStyle = gg;
            c.fillRect(0, horizon, W, H - horizon);
            // 金色流纹
            const r2 = DFS.rng(9921);
            for (let i = 0; i < 70; i++) {
              const k = r2();
              const y = horizon + Math.pow(k, 1.5) * (H - horizon);
              const x = r2() * W;
              const len = 40 + r2() * 220;
              c.strokeStyle = `rgba(240,206,140,${(0.03 + r2() * 0.07) * tGold})`;
              c.lineWidth = 0.8 + k * 2;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x + len, y);
              c.stroke();
            }
            c.restore();
          }
        },
        l3: (c) => {
          // 冷月辉
          const g = c.createRadialGradient(W * 0.5, H * 0.16, 30, W * 0.5, H * 0.3, H * 0.7);
          g.addColorStop(0, 'rgba(200,214,222,0.10)');
          g.addColorStop(1, 'rgba(200,214,222,0)');
          c.fillStyle = g;
          c.fillRect(0, 0, W, H * 0.8);
        },
        l4: (c) => {
          // 孤舟（远去）
          const bx = lerp(W * 0.62, W * 0.72, clamp(L / 10.4));
          const by = H * 0.615;
          const scale = lerp(0.5, 0.32, clamp(L / 10.4));
          c.save();
          c.globalAlpha = 0.92;
          DFS.boat(c, bx, by, scale, { t, alpha: 0.9, color: '12,14,16', figure: true, figureColor: '10,12,14' });
          // 舟中灯
          const lampA = 1 - clamp((L - 2.6) / 0.8);
          if (lampA > 0.01) {
            c.globalCompositeOperation = 'lighter';
            const lg = c.createRadialGradient(bx + 16, by - 26, 0, bx + 16, by - 26, 46);
            lg.addColorStop(0, `rgba(255,214,140,${0.85 * lampA})`);
            lg.addColorStop(0.25, `rgba(255,190,100,${0.30 * lampA})`);
            lg.addColorStop(1, 'rgba(255,190,100,0)');
            c.fillStyle = lg;
            c.beginPath();
            c.arc(bx + 16, by - 26, 46, 0, Math.PI * 2);
            c.fill();
          }
          // 灯火坠落成金墨
          if (tGold > 0 && tGold < 1) {
            const dropY = lerp(by - 26, by + 40, Ease.inCubic(tGold));
            c.globalCompositeOperation = 'lighter';
            const dg = c.createRadialGradient(bx + 16, dropY, 0, bx + 16, dropY, 16);
            dg.addColorStop(0, `rgba(255,232,170,${0.9 * (1 - tGold * 0.4)})`);
            dg.addColorStop(1, 'rgba(255,232,170,0)');
            c.fillStyle = dg;
            c.beginPath();
            c.arc(bx + 16, dropY, 16, 0, Math.PI * 2);
            c.fill();
            // 入水涟漪
            if (tGold > 0.6) {
              const rp = (tGold - 0.6) / 0.4;
              c.strokeStyle = `rgba(240,206,140,${0.5 * (1 - rp)})`;
              c.lineWidth = 1.6;
              c.beginPath();
              c.ellipse(bx + 16, by + 40, 10 + rp * 160, (10 + rp * 160) * 0.24, 0, 0, Math.PI * 2);
              c.stroke();
            }
          }
          c.restore();

          // 风雪
          c.save();
          const r = DFS.rng(3388);
          for (let i = 0; i < 420; i++) {
            const x = ((r() * 1.2 - 0.1) + Math.sin(t * 0.4 + i) * 0.01) * W;
            const y = ((r() + t * 0.035 * (0.5 + r())) % 1) * H;
            const s = 0.8 + r() * 2.6;
            c.globalAlpha = (0.25 + r() * 0.55) * tSnow;
            c.fillStyle = 'rgba(238,244,248,0.9)';
            c.beginPath();
            c.arc(x + Math.sin(t * 0.7 + i) * 6, y, s, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        },
        l5: (c) => {
          const V4 = DFS.V4;
          // 绝笔两句（杜诗吟诵）
          if (V4) {
            const mA = V4.chantLine(c, st.s09_a, {
              id: 's09_a', L, x: W * 0.5, y: 300, size: 88, weight: 900,
              family: T.fonts.heavy, color: 'rgba(240,236,222,0.97)', tracking: 10, seed: 3, halo: 0.55
            });
            if (mA) DFS.dbgBox('s09_a', mA.x, mA.y, mA.x + mA.w, mA.y + mA.h);
            const mB = V4.chantLine(c, st.s09_b, {
              id: 's09_b', L, x: W * 0.5, y: 396, size: 88, weight: 900,
              family: T.fonts.heavy, color: 'rgba(240,236,222,0.97)', tracking: 10, seed: 5, halo: 0.55
            });
            if (mB) DFS.dbgBox('s09_b', mB.x, mB.y, mB.x + mB.w, mB.y + mB.h);
          } else {
            V3.inkText(c, st.s09_a, {
              x: W * 0.5, y: 300, size: 88, weight: 900,
              family: T.fonts.heavy, color: 'rgba(240,236,222,0.97)', tracking: 10
            });
            V3.inkText(c, st.s09_b, {
              x: W * 0.5, y: 396, size: 88, weight: 900,
              family: T.fonts.heavy, color: 'rgba(240,236,222,0.97)', tracking: 10
            });
          }
          // 钤印「诗史」
          if (tSeal > 0.001) {
            HUB.inkStampSplash(c, W * 0.5, 560, Ease.outExpo(tSeal), 77, {
              size: 132, text: st.s09_seal, chars: 'v', rotate: -0.03, color: T.colors.cinnabar
            });
            DFS.dbgBox('s09_seal', W * 0.5 - 90, 494, W * 0.5 + 90, 626);
          }
          if (V4) {
            const mN = V4.chantLine(c, st.s09_note, {
              id: 's09_note', L, x: W * 0.76, y: 930, size: 28, weight: 400,
              family: T.fonts.serif, color: 'rgba(210,204,188,0.85)', tracking: 3, seed: 9, halo: 0.55
            });
            if (mN) DFS.dbgBox('s09_note', mN.x, mN.y, mN.x + mN.w, mN.y + mN.h);
            if (pNote.alpha > 0.01) {
              c.save();
              c.globalAlpha = pNote.alpha * 0.45;
              V3.inkText(c, st.s09_note_src, {
                x: W * 0.79, y: 968, size: 18, weight: 400,
                family: T.fonts.serif, color: 'rgba(192,186,170,0.8)', halo: 0.5
              });
              c.restore();
            }
          } else if (pNote.alpha > 0.01) {
            c.save();
            c.globalAlpha = pNote.alpha * 0.7;
            V3.inkText(c, st.s09_note, {
              x: W * 0.76, y: 930, size: 28, weight: 400,
              family: T.fonts.serif, color: 'rgba(210,204,188,0.85)'
            });
            c.restore();
          }
        }
      });

      if (tEnd > 0) {
        ctx.save();
        ctx.globalAlpha = Ease.inOutCubic(tEnd);
        ctx.fillStyle = '#030304';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    hudDark() { return true; }
  };
})(window.DFS);
