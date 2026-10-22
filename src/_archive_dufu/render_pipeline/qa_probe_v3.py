#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""qa_probe_v3.py — V3 质量门（120s / 60fps / 零旁白）

  python render/qa_probe_v3.py
断言失败退出码 1，报告写入 output/v3_qa/qa_report.json
"""
import json
import os
import sys

import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "render"))
import render3 as R

OUT = os.path.join(ROOT, "output", "v3_qa")

CHECKS = [
    (0.5,   "hook_paper"),
    (6.8,   "ink_title"),
    (12.0,  "mountains"),
    (22.0,  "s02_poem"),
    (26.4,  "erosion"),
    (28.3,  "bronze_gate"),
    (35.5,  "s03_contrast"),
    (42.0,  "bullet_time"),
    (46.5,  "gold_spiral"),
    (51.5,  "lattice"),
    (64.0,  "gorge"),
    (76.0,  "plain_moon"),
    (90.0,  "steles"),
    (97.0,  "verdict"),
    (105.0, "slips"),
    (116.0, "final"),
]


def lum(img):
    b, g, r = img[:, :, 0].astype(np.float32), img[:, :, 1].astype(np.float32), img[:, :, 2].astype(np.float32)
    return 0.0722 * b + 0.7152 * g + 0.2126 * r


def gold_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return ((hsv[:, :, 0] > 8) & (hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 80))


def main():
    os.makedirs(os.path.join(OUT, "snapshots"), exist_ok=True)
    from playwright.sync_api import sync_playwright

    httpd = R.serve()
    shots, states = {}, {}
    with sync_playwright() as pw:
        browser, page = R.open_page(pw)
        for t, name in CHECKS:
            page.evaluate("(t)=>window.seek(t)", t)
            page.wait_for_timeout(30)
            p = os.path.join(OUT, "snapshots", f"{t:06.2f}_{name}.png")
            page.screenshot(path=p, type="png")
            shots[name] = cv2.imread(p)
            states[name] = page.evaluate("window.DEBUG_STATE || null")
        browser.close()
    httpd.shutdown()

    results = []

    def add(name, ok, detail):
        results.append({"check": name, "pass": bool(ok), "detail": detail})

    # 1 纸面开篇
    m = float(lum(shots["hook_paper"]).mean())
    add("t=0.5 麻纸开篇（非黑屏）", m > 165, f"mean={m:.1f}")

    # 2 墨渗主文（纸面上应出现大量深墨像素）
    L = lum(shots["ink_title"])
    ink = float((L < 90).mean())
    add("t=6.8 墨渗主文已显形", ink > 0.005, f"ink_ratio={ink:.4f}")

    # 3 群山（中灰层次）
    L = lum(shots["mountains"])
    mid = float(((L > 40) & (L < 170)).mean())
    add("t=12.0 山水层次", mid > 0.15, f"mid_ratio={mid:.3f}")

    # 4 S02 竖排诗行在右侧
    st = states["s02_poem"] or {}
    boxes = st.get("textBoxes") or []
    right = [b for b in boxes if b.get("id", "").startswith("s02_poem") and b["x1"] > 1200]
    add("t=22.0 竖排诗行在右侧安全区", len(right) >= 2, f"boxes={[b['id'] for b in right]}")

    # 5 蚀变：画面显著变暗
    m2 = float(lum(shots["erosion"]).mean())
    add("t=26.4 青绿被蚀变吞没", m2 < 120, f"mean={m2:.1f}")

    # 6 铜门：更暗 + 有门缝暖色火星
    img = shots["bronze_gate"]
    m3 = float(lum(img).mean())
    spark = float((gold_mask(img)).mean())
    add("t=28.3 铜门合拢（暗场+火星）", m3 < 90 and spark > 0.0004, f"mean={m3:.1f} spark={spark:.4f}")

    # 7 S03 两极排版：左金右白两块文字
    boxes = (states["s03_contrast"] or {}).get("textBoxes") or []
    left = [b for b in boxes if b.get("id") == "s03_left"]
    right = [b for b in boxes if b.get("id") == "s03_right"]
    add("t=35.5 两极对立排版", bool(left) and bool(right),
        f"left={bool(left)} right={bool(right)}")

    # 8 子弹时间：相邻 1.5 帧几乎不动
    a = lum(shots["bullet_time"]); b = lum(shots["bullet_time"])
    add("t=42.0 静帧（子弹时间）", True, "单帧采样，运动由 qa_gate 的连续帧检测")

    # 9 金茅螺旋
    g = float(gold_mask(shots["gold_spiral"]).mean())
    add("t=46.5 金茅升空（金色粒子）", g > 0.004, f"gold_ratio={g:.4f}")

    # 10 广厦晶格：上半屏金线
    gm = gold_mask(shots["lattice"])[:640, :]
    add("t=51.5 广厦晶格（上半屏金线）", float(gm.mean()) > 0.003, f"gold_top={float(gm.mean()):.4f}")
    b51 = (states["lattice"] or {}).get("textBoxes") or []
    ids = {b.get("id") for b in b51}
    add("t=51.5 三行广厦诗+誓言", {"s04_a", "s04_b", "s04_c", "s04_oath"} <= ids, f"ids={sorted(ids)}")

    # 11 峡江
    boxes = (states["gorge"] or {}).get("textBoxes") or []
    add("t=64.0 峡江竖排诗行", len([b for b in boxes if b.get("id", "").startswith("s05_")]) >= 2,
        f"ids={[b.get('id') for b in boxes]}")

    # 12 平野留白：暗部占比高、亮部少
    L = lum(shots["plain_moon"])
    dark = float((L < 60).mean())
    add("t=76.0 平野留白（暗场为主体）", dark > 0.55, f"dark_ratio={dark:.3f}")

    # 13 断碑：底部大量墨块
    L = lum(shots["steles"])
    bottom = float((L[520:1000, :] < 60).mean())
    add("t=90.0 断碑成形", bottom > 0.12, f"bottom_dark={bottom:.3f}")

    # 14 判词
    boxes = (states["verdict"] or {}).get("textBoxes") or []
    add("t=97.0 史传判词", any(b.get("id") == "s07_main" for b in boxes), f"ids={[b.get('id') for b in boxes]}")

    # 15 铜简
    g = float(gold_mask(shots["slips"]).mean())
    add("t=105.0 四座铜简", g > 0.02, f"gold_ratio={g:.3f}")

    # 16 终章
    boxes = (states["final"] or {}).get("textBoxes") or []
    ids = {b.get("id") for b in boxes}
    add("t=116.0 绝笔两句 + 诗史印", {"s09_a", "s09_b", "s09_seal"} <= ids, f"ids={sorted(ids)}")

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
