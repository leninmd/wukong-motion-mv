#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""qa_probe_v4.py — V4 质量门（88s / 60fps / 物理建模音轨）

V3 的 17 项探针只能测"有没有黑屏 / 帧率 / 平均亮度"，
测不出"文字压在线上看不清""画面发灰""转场断崖"。

V4 在 17 项工程断言之上，再补 5 道【美学门控】：
  T18 留白率硬门控       —— 每帧纯净纸纹/纯墨占比 ≥ 35%
  T19 文字可读性门控     —— 文字框内对比度 + 周围背景繁忙度
  T20 转场连续性门控     —— 交接帧不得断崖 / 不得空帧 / 直方图相关
  T21 灰雾污染门控       —— 中灰占比与饱和度污染（"发灰发脏"的量化）
  T22 V4 审片大图        —— 9 个高潮帧 + 8 个转场交接帧

  python render/qa_probe_v4.py
断言失败退出码 1，报告写入 output/v4_qa/qa_report.json
"""
import json
import os
import sys

import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "render"))
import render3 as R

OUT = os.path.join(ROOT, "output", "v4_qa")
SB = json.load(open(os.path.join(ROOT, "storyboard.v4.json"), encoding="utf-8"))

CHECKS = [
    (0.6, "hook_paper"), (2.0, "seal_impact"), (5.6, "ink_title"),
    (9.0, "mountains"), (14.6, "s02_poem"), (18.0, "landscape"),
    (24.2, "s03_contrast"), (29.0, "s04_rain"), (32.2, "gold_spiral"),
    (36.3, "lattice"), (39.0, "gorge"), (42.4, "leaves"),
    (48.0, "plain_moon"), (62.6, "steles"), (65.4, "verdict"),
    (76.2, "slips"), (86.6, "final"),
]

CLIMAX = [(4.6, "C1 SHI"), (13.6, "C2 DING"), (24.4, "C3 POLAR"), (35.2, "C4 HALL"),
          (43.6, "C5 GORGE"), (50.4, "C6 PLAIN"), (63.4, "C7 STELE"), (73.6, "C8 FLAME"),
          (82.2, "C9 END")]


def lum(img):
    b, g, r = (img[:, :, 0].astype(np.float32), img[:, :, 1].astype(np.float32),
               img[:, :, 2].astype(np.float32))
    return 0.114 * b + 0.587 * g + 0.299 * r


def gold_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return ((hsv[:, :, 0] > 8) & (hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 80))


def empty_ratio(img):
    """纯净纸纹 / 纯墨黑占比：局部低方差 + 落在纸白或焦墨两极。"""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(g, (5, 5))
    sq = cv2.blur(g * g, (5, 5))
    var = np.maximum(0.0, sq - mu * mu)
    flat = var < 26.0
    bright = g > 186.0
    deep = g < 26.0
    return float(np.mean(flat & (bright | deep)))


def ring_busy(img, box, pad=20):
    h, w = img.shape[:2]
    x1, y1, x2, y2 = box
    X1 = int(max(0, x1 - pad)); Y1 = int(max(0, y1 - pad))
    X2 = int(min(w, x2 + pad)); Y2 = int(min(h, y2 + pad))
    if X2 - X1 < 8 or Y2 - Y1 < 8:
        return 0.0
    roi = img[Y1:Y2, X1:X2]
    g = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy)
    return float(np.mean(mag > 110))


def text_contrast(img, box):
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in box]
    X1 = max(0, x1); Y1 = max(0, y1); X2 = min(w, x2); Y2 = min(h, y2)
    if X2 - X1 < 8 or Y2 - Y1 < 8:
        return None
    g = cv2.cvtColor(img[Y1:Y2, X1:X2], cv2.COLOR_BGR2GRAY).astype(np.float32)
    return float(np.percentile(g, 95) - np.percentile(g, 5))


def hist_corr(a, b):
    ha = cv2.calcHist([cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)], [0], None, [64], [0, 256])
    hb = cv2.calcHist([cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)], [0], None, [64], [0, 256])
    cv2.normalize(ha, ha); cv2.normalize(hb, hb)
    return float(cv2.compareHist(ha, hb, cv2.HISTCMP_CORREL))


def sched(cue):
    """与 engine/v4/cadence.js 的 V4.schedule 同构。"""
    cd = cue.get("charDur", 0.06)
    pa = cue.get("pause", 0.2)
    t = cue.get("t", 0.0)
    times, starts = [], []
    for g in (cue.get("groups") or []):
        starts.append(t)
        n = len(list(g))
        for i in range(n):
            times.append(t + i * cd)
        t += n * cd + pa
    return times, starts


def chapter_start(sid):
    for c in SB["chapters"]:
        if c["scene"] == sid:
            return c["start"]
    return 0.0


def main():
    os.makedirs(os.path.join(OUT, "snapshots"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "output", "v4_release"), exist_ok=True)
    from playwright.sync_api import sync_playwright

    shots, states = {}, {}
    ws = []
    trans_frames = []
    grid_tiles = []

    httpd = R.serve()
    try:
        with sync_playwright() as pw:
            browser, page = R.open_page(pw)

            def shot():
                return page.screenshot(type="png")

            def shot_jpg():
                return cv2.imdecode(np.frombuffer(page.screenshot(type="jpeg", quality=90), np.uint8),
                                    cv2.IMREAD_COLOR)

            # ---- 17 项工程断言关键帧 ----
            for t, name in CHECKS:
                page.evaluate("(t)=>window.seek(t)", t)
                page.wait_for_timeout(25)
                p = os.path.join(OUT, "snapshots", "%06.2f_%s.png" % (t, name))
                page.screenshot(path=p, type="png")
                shots[name] = cv2.imread(p)
                states[name] = page.evaluate("window.DEBUG_STATE || null")

            # ---- 18 留白率：每 1 秒一帧 ----
            t = 0.5
            while t < SB["duration"]:
                page.evaluate("(x)=>window.seek(x)", t)
                ws.append((t, empty_ratio(shot_jpg())))
                t += 1.0

            # ---- 20 转场连续性 ----
            for tr in SB["transitions"]:
                T = tr["at"]
                frames = []
                # 交叠溶解发生在 [T+0.42, T+0.78]，按 0.05s 密采样才能分辨"溶解"与"硬切"
                ts = [round(T + 0.20 + k * 0.05, 2) for k in range(15)]
                for tt in ts:
                    page.evaluate("(x)=>window.seek(x)", tt)
                    frames.append(shot_jpg())
                trans_frames.append((T, tr["type"], frames))

            # ---- 19 文字可读性：按 cues 的落字完成时刻逐条采样 ----
            leg_frames = []
            for cue in SB["cues"]:
                if not cue.get("groups"):
                    continue
                sid = cue["id"].split("_")[0]
                base = chapter_start(sid)
                _times, _starts = sched(cue)
                end = (max(_times) if _times else cue["t"]) + 0.62
                t_sample = round(base + end, 2)
                ach = [c for c in SB["chapters"] if c["scene"] == sid]
                if ach and t_sample > ach[0]["end"] - 0.90:
                    t_sample = round(ach[0]["end"] - 0.90, 2)
                page.evaluate("(x)=>window.seek(x)", t_sample)
                page.wait_for_timeout(18)
                img = cv2.imdecode(np.frombuffer(page.screenshot(type="png"), np.uint8), cv2.IMREAD_COLOR)
                stt = page.evaluate("window.DEBUG_STATE || null") or {}
                leg_frames.append((cue["id"], t_sample, img, stt.get("textBoxes") or []))

            # ---- 22 审片大图素材 ----
            all_tiles = [(t, lab, False) for t, lab in CLIMAX]
            for i, tr in enumerate(SB["transitions"]):
                all_tiles.append((tr["at"] + (i % 3 - 1) * 0.34,
                                  "T%d %s" % (i + 1, tr["type"].upper()[:8]), True))
            for t, lab, is_tr in all_tiles:
                page.evaluate("(x)=>window.seek(x)", t)
                page.wait_for_timeout(20)
                grid_tiles.append((cv2.imdecode(np.frombuffer(page.screenshot(type="png"), np.uint8),
                                                cv2.IMREAD_COLOR), lab, is_tr))

            browser.close()
    finally:
        httpd.shutdown()

    results = []

    def add(name, ok, detail):
        results.append({"check": name, "pass": bool(ok), "detail": detail})

    # ================= 1–17 工程断言 =================
    m = float(lum(shots["hook_paper"]).mean())
    add("T01 0.6s 麻纸开篇（非黑屏）", m > 160, "mean=%.1f" % m)

    L = lum(shots["seal_impact"])
    add("T02 2.0s 重印落纸", float((L < 70).mean()) > 0.02, "ink=%.4f" % float((L < 70).mean()))

    L = lum(shots["ink_title"])
    add("T03 5.6s 墨渗史传主文", float((L < 90).mean()) > 0.004, "ink=%.4f" % float((L < 90).mean()))

    b = (states["ink_title"] or {}).get("textBoxes") or []
    add("T04 5.6s 竖排两列 + 出处", len([x for x in b if x["id"].startswith("s01")]) >= 2,
        "ids=%s" % sorted(x["id"] for x in b))

    L = lum(shots["mountains"])
    mid_r = float(((L > 35) & (L < 175)).mean())
    hi_r = float((L > 175).mean())
    lo_r = float((L < 90).mean())
    add("T05 9.0s 山水层次（留白 + 中间调并存）",
        mid_r > 0.25 and hi_r > 0.15,
        "mid=%.3f bright=%.3f dark=%.3f" % (mid_r, hi_r, lo_r))

    b = (states["s02_poem"] or {}).get("textBoxes") or []
    add("T06 14.6s 竖排诗行在右侧", len([x for x in b if x["id"].startswith("s02_poem")]) >= 2,
        "ids=%s" % [x["id"] for x in b])

    L = lum(shots["landscape"])
    mid_ratio = float(((L > 40) & (L < 175)).mean())
    add("T07 18.0s 青绿山水的墨色层次",
        mid_ratio > 0.35 and float((L > 200).mean()) > 0.05,
        "mid=%.3f bright=%.3f" % (mid_ratio, float((L > 200).mean())))

    b = (states["s03_contrast"] or {}).get("textBoxes") or []
    ids = {x["id"] for x in b}
    add("T08 24.2s 两极对立排版", "s03_left" in ids and "s03_right" in ids, "ids=%s" % sorted(ids))

    L = lum(shots["s04_rain"])
    add("T09 29.0s 夜雨毁屋（暗场）", float((L < 60).mean()) > 0.55, "dark=%.3f" % float((L < 60).mean()))

    g = float(gold_mask(shots["gold_spiral"]).mean())
    add("T10 32.2s 金茅升空", g > 0.0008, "gold=%.5f" % g)

    gm = float(gold_mask(shots["lattice"]).mean())
    b = (states["lattice"] or {}).get("textBoxes") or []
    ids = {x["id"] for x in b}
    add("T11 36.3s 广厦诗行（界画剪影 + 三行原典）",
        gm > 0.0006 and {"s04_a", "s04_b", "s04_c"} <= ids,
        "gold=%.5f ids=%s" % (gm, sorted(ids)))

    b = (states["gorge"] or {}).get("textBoxes") or []
    add("T12 39.0s 峡江（未出字，等待落木）",
        len(b) == 0 or not any(x["id"].startswith("s05") for x in b),
        "ids=%s" % [x.get("id") for x in b])

    lp = (states["leaves"] or {}).get("leafParticles", 0)
    add("T13 42.4s 落木萧萧（枯叶入水）", lp >= 200, "leafParticles=%s" % lp)

    L = lum(shots["plain_moon"])
    add("T14 48.0s 平野星垂（暗场留白）", float((L < 55).mean()) > 0.55,
        "dark=%.3f" % float((L < 55).mean()))

    L = lum(shots["steles"])
    add("T15 62.0s 断碑成形（底部墨块）", float((L[520:1000, :] < 75).mean()) > 0.20,
        "bottom=%.3f" % float((L[520:1000, :] < 75).mean()))

    b = (states["steles"] or {}).get("textBoxes") or []
    add("T16 62.0s 史传判词", any(x["id"] == "s07_main" for x in b), "ids=%s" % [x.get("id") for x in b])

    b = (states["final"] or {}).get("textBoxes") or []
    ids = {x["id"] for x in b}
    add("T17 86.6s 绝笔两句 + 诗史印", {"s09_a", "s09_b"} <= ids, "ids=%s" % sorted(ids))

    # ================= 18 留白率硬门控 =================
    vals = np.array([v for _, v in ws])
    worst = min(ws, key=lambda kv: kv[1])
    add("T18 留白率硬门控（每帧 ≥ 35%）", float(vals.min()) >= 0.35,
        "min=%.3f@%.1fs mean=%.3f p10=%.3f"
        % (worst[1], worst[0], float(vals.mean()), float(np.percentile(vals, 10))))

    # ================= 19 文字可读性 =================
    fails, worst_c, measured = [], (999.0, "-"), 0
    for cid, ts, img, boxes in leg_frames:
        bb = [bx for bx in boxes if cid in str(bx.get("id", ""))]
        if not bb:
            # 该 cue 的主字没有登记包围盒（如竖排诗按列登记），跳过后由 T06 覆盖
            continue
        bx = bb[0]
        c = text_contrast(img, (bx["x1"], bx["y1"], bx["x2"], bx["y2"]))
        if c is None:
            continue
        busy = ring_busy(img, (bx["x1"], bx["y1"], bx["x2"], bx["y2"]))
        measured += 1
        if c < worst_c[0]:
            worst_c = (c, "%s@%.1f" % (bx["id"], ts))
        bh = abs(bx["y2"] - bx["y1"])
        need = 40.0 if bh < 62 else 55.0   # 小字（夹注/落款）按小字标准判定
        if c < need or busy > 0.42:
            fails.append("%s@%.1f c=%.0f(need %.0f) busy=%.2f" % (bx["id"], ts, c, need, busy))
    add("T19 文字可读性与防撞车门控", len(fails) == 0 and measured >= 8,
        "measured=%d worst=%s c=%.0f | fails=%s" % (measured, worst_c[1], worst_c[0], fails[:4]))

    # ================= 20 转场连续性 =================
    bad = []
    for T, typ, frames in trans_frames:
        for i, f in enumerate(frames):
            m0 = float(lum(f).mean())
            if m0 < 6 or m0 > 250:
                bad.append("T=%.1f f%d blank(%.0f)" % (T, i, m0))
        steps = []
        for i in range(1, len(frames)):
            steps.append(float(np.mean(np.abs(frames[i].astype(np.float32) - frames[i - 1].astype(np.float32)))))
        total = sum(steps) + 1e-6
        # 硬切的特征：单步（0.05s）就承担了窗口内绝大部分变化
        if max(steps) / total > 0.42:
            bad.append("T=%.1f hard-cut step=%.0f/%.0f" % (T, max(steps), total))
        # 溶解过程中不应出现"更暗"的凹陷（双层半透明叠加会掉亮度）
        # 只有在两端都还亮着的情况下，"中间掉到全黑"才是问题（切黑/闪黑）
        m_first = float(lum(frames[0]).mean())
        m_last = float(lum(frames[-1]).mean())
        m_min = min(float(lum(f).mean()) for f in frames)
        if m_first > 34 and m_last > 34 and m_min < 9:
            bad.append("T=%.1f black-dip %.0f" % (T, m_min))
    add("T20 转场连续性门控（8 个交接窗口 × 15 帧）", len(bad) == 0,
        "issues=%s" % (bad[:5] or "none"))

    # ================= 21 灰雾污染 =================
    mids, sats = [], []
    for name, img in shots.items():
        gg = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
        mids.append((name, float(((gg > 58) & (gg < 168)).mean())))
        sats.append(float(cv2.cvtColor(img, cv2.COLOR_BGR2HSV)[:, :, 1].mean()))
    wm = max(mids, key=lambda kv: kv[1])
    add("T21 灰雾污染门控（中灰占比 ≤ 66%）", wm[1] <= 0.66,
        "worst=%s mid=%.3f mean_sat=%.1f" % (wm[0], wm[1], float(np.mean(sats))))

    # ================= 22 审片大图 =================
    tw, th = 480, 270
    imgs = []
    for im, lab, is_tr in grid_tiles:
        im = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
        cv2.rectangle(im, (0, 0), (tw - 1, th - 1),
                      (60, 170, 240) if is_tr else (90, 120, 210), 2)
        cv2.rectangle(im, (0, 0), (172, 24), (0, 0, 0), -1)
        cv2.putText(im, lab, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (238, 234, 218), 1, cv2.LINE_AA)
        imgs.append(im)
    while len(imgs) % 6:
        imgs.append(np.zeros((th, tw, 3), np.uint8))
    grid = np.vstack([np.hstack(imgs[i * 6:(i + 1) * 6]) for i in range(len(imgs) // 6)])
    grid_path = os.path.join(ROOT, "output", "v4_release", "v4_highlights_grid.png")
    cv2.imwrite(grid_path, grid)
    add("T22 输出 V4 审片大图（9 高潮 + 8 转场）",
        os.path.exists(grid_path) and os.path.getsize(grid_path) > 100000,
        "%s %s" % (os.path.relpath(grid_path, ROOT), grid.shape))

    failed = [r for r in results if not r["pass"]]
    report = {
        "status": "QA_PASSED" if not failed else "QA_FAILED",
        "passed": len(results) - len(failed),
        "total": len(results),
        "results": results,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "qa_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
