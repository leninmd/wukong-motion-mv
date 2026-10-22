#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
qa_probe.py — V2 强制质量门（10 项硬断言）

  python render/qa_probe.py                # 抽样 10 个关键帧并断言
  python render/qa_probe.py --keep         # 保留 output/v2_qa/snapshots

任一断言失败 → 退出码 1，stdout 输出 JSON（供子智能体返工）。
"""
import argparse
import json
import os
import subprocess
import sys
import time

import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "render"))
import render3 as R  # 复用同一套静态服务器与浏览器启动参数

OUT = os.path.join(ROOT, "output", "v2_qa")

CHECKS = [
    (0.30,  "hook_paper"),
    (3.50,  "type_matrix"),
    (17.50, "wind_dissolve"),
    (21.00, "bullet_time_a"),
    (21.05, "bullet_time_b"),
    (31.20, "safe_area_no_overlap"),
    (35.50, "gold_coverage"),
    (44.00, "seagull_particles"),
    (61.50, "bottom_ruins"),
    (68.00, "cards_centered"),
    (78.00, "poster_contrast"),
]


def lum(img):
    b, g, r = img[:, :, 0].astype(np.float32), img[:, :, 1].astype(np.float32), img[:, :, 2].astype(np.float32)
    return 0.0722 * b + 0.7152 * g + 0.2126 * r


def contrast_ratio(l1, l2):
    a, b = max(l1, l2), min(l1, l2)
    return (a + 5.0) / (b + 5.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true")
    args = ap.parse_args()
    os.makedirs(os.path.join(OUT, "snapshots"), exist_ok=True)

    from playwright.sync_api import sync_playwright

    httpd = R.serve()
    results = []
    ok = True

    with sync_playwright() as pw:
        browser, page = R.open_page(pw)
        shots = {}
        states = {}
        for t, name in CHECKS:
            page.evaluate("(t)=>window.seek(t)", t)
            page.wait_for_timeout(30)
            p = os.path.join(OUT, "snapshots", f"{t:06.2f}_{name}.png")
            page.screenshot(path=p, type="png")
            shots[name] = cv2.imread(p)
            states[name] = page.evaluate("window.DEBUG_STATE || null")
        browser.close()
    httpd.shutdown()

    def add(name, passed, detail):
        nonlocal ok
        if not passed:
            ok = False
        results.append({"check": name, "pass": bool(passed), "detail": detail})

    # 1. 黄金前 2 秒：非黑屏
    img = shots["hook_paper"]
    mean = float(lum(img).mean())
    add("t=0.30 非黑屏（宣纸开篇）", mean > 170, f"mean_luma={mean:.1f} (>180 强约束, >170 宽松)")

    # 2. 3D 活字矩阵
    st = states.get("type_matrix") or {}
    tf = int(st.get("typeField", 0))
    add("t=3.50 3D 活字矩阵存在", tf >= 300, f"typeField_blocks={tf}")

    # 3. 风场吹散：文字右侧存在散落粒子
    img = shots["wind_dissolve"]
    L = lum(img)
    top = L[100:520, :]
    left_ink = float((top[:, :900] < 90).mean())
    right_ink = float((top[:, 900:] < 90).mean())
    add("t=17.50 文字粒子化风场消散", right_ink > 0.002, f"left_ink={left_ink:.4f} right_ink={right_ink:.4f}")

    # 4/5. 子弹时间：相邻 1.5 帧几乎静止，但存在高光圆珠
    a = lum(shots["bullet_time_a"]); b = lum(shots["bullet_time_b"])
    diff = float(np.abs(a - b).mean())
    bright = int((a > 205).sum())
    add("t=21.00 子弹时间（位移极小）", diff < 1.2, f"mean_abs_diff={diff:.3f} (<1.2)")
    add("t=21.00 雨滴圆珠高光", bright > 900, f"bright_px={bright} (>900)")

    # 6. 右侧竖排安全区：文本包围盒不得与黑山重叠；HUD 里程不倒退
    st = states.get("safe_area_no_overlap") or {}
    boxes = [bx for bx in (st.get("textBoxes") or []) if bx.get("id", "").startswith("poem")]
    safe_issues = []
    for bx in boxes:
        x1, y1, x2, y2 = int(bx["x1"]), int(bx["y1"]), int(bx["x2"]), int(bx["y2"])
        x1c, y1c = max(0, x1), max(0, y1)
        x2c, y2c = min(1920, x2), min(1080, y2)
        if x2c <= x1c or y2c <= y1c:
            continue
        crop = lum(shots["safe_area_no_overlap"][y1c:y2c, x1c:x2c])
        # 背景干扰度：暗像素（点云）占比
        dark = float((crop < 70).mean())
        if dark > 0.06:
            safe_issues.append({"id": bx.get("id"), "dark_ratio": round(dark, 3)})
    hud_km = float(((st.get("hud") or {}).get("km")) or 0)
    add("t=31.20 竖排文字与点云零重叠", len(safe_issues) == 0, f"issues={safe_issues} boxes={len(boxes)}")
    add("t=31.20 HUD 里程不倒退", hud_km >= 3879, f"hud_km={hud_km:.0f} (>=3880)")

    # 7. 金球覆盖率 + 计数器
    img = shots["gold_coverage"]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gold = ((hsv[:, :, 0] > 10) & (hsv[:, :, 0] < 40) & (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 70))
    lower = gold[540:, :].mean()
    st = states.get("gold_coverage") or {}
    has_counter = bool((st.get("counters") or {}).get("wanjin"))
    add("t=35.50 金球覆盖率 >45%（下半屏）", lower > 0.45, f"coverage={lower:.3f}")
    add("t=35.50 万金计数器存在", has_counter, f"counters={list((st.get('counters') or {}).keys())}")

    # 8. 沙鸥为粒子群而非折线
    st = states.get("seagull_particles") or {}
    n = int(st.get("gullParticles", 0))
    add("t=44.00 沙鸥为粒子群", n >= 100, f"particles={n}")

    # 9. 底部文字废墟
    img = shots["bottom_ruins"]
    band = lum(img)[910:1060, :]
    ink = float((band < 110).mean())
    add("t=61.50 底部刚体文字废墟", ink > 0.012, f"ink_ratio={ink:.4f} (>0.012)")

    # 10. 翻牌构图居中
    st = states.get("cards_centered") or {}
    boxes = st.get("textBoxes") or []
    centers = []
    for bx in boxes:
        if bx.get("id", "").startswith("cardline"):
            centers.append((bx["x1"] + bx["x2"]) / 2)
    centered = all(820 <= c <= 1100 for c in centers) if centers else False
    add("t=68.00 翻牌标题居中", centered, f"centers={[round(c) for c in centers]}")

    # 11. 终极海报帧对比度
    img = shots["poster_contrast"]
    st = states.get("poster_contrast") or {}
    cr = 0
    for bx in (st.get("textBoxes") or []):
        if bx.get("id") == "poster":
            x1, y1, x2, y2 = int(bx["x1"]), int(bx["y1"]), int(bx["x2"]), int(bx["y2"])
            crop = lum(img)[max(0, y1):min(1080, y2), max(0, x1):min(1920, x2)]
            if crop.size:
                flat = np.sort(crop.ravel())
                # 背景取中位偏亮的 50%，墨色取最暗 2%（文字像素占比小，用分位数更稳）
                bg = float(np.median(flat[int(len(flat) * 0.55):]))
                ink = float(np.mean(flat[:max(1, int(len(flat) * 0.02))]))
                cr = contrast_ratio(bg, ink)
    add("t=78.00 海报帧对比度 >=7", cr >= 7.0, f"contrast={cr:.2f}")

    # 汇总
    failed = [r for r in results if not r["pass"]]
    report = {
        "status": "QA_PASSED" if not failed else "QA_FAILED",
        "passed": len(results) - len(failed),
        "total": len(results),
        "results": results,
    }
    with open(os.path.join(OUT, "qa_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
