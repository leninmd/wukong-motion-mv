#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""make_highlights.py — 把 QA 关键帧拼成 2×5 高光验收图"""
import os, glob
import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "output", "v2_qa", "snapshots")
OUT = os.path.join(ROOT, "output", "v2_release", "v2_highlights_grid.png")


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.png")))
    if not files:
        print("no snapshots"); return
    # 取 10 张（每 1 张采样，避免超过 10）
    if len(files) > 10:
        idx = np.linspace(0, len(files) - 1, 10).round().astype(int)
        files = [files[i] for i in idx]
    tw, th = 576, 324
    thumbs = []
    for f in files:
        im = cv2.imread(f)
        if im is None:
            continue
        im = cv2.resize(im, (tw, th), interpolation=cv2.INTER_LANCZOS4)
        label = os.path.basename(f).split("_")[0]
        cv2.rectangle(im, (0, 0), (96, 34), (0, 0, 0), -1)
        cv2.putText(im, label, (10, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (240, 236, 220), 2, cv2.LINE_AA)
        thumbs.append(im)
    while len(thumbs) < 10:
        thumbs.append(np.zeros((th, tw, 3), np.uint8))
    rows = [np.hstack(thumbs[i * 5:(i + 1) * 5]) for i in range(2)]
    grid = np.vstack(rows)
    cv2.imwrite(OUT, grid)
    print("wrote", OUT, grid.shape)


if __name__ == "__main__":
    main()
