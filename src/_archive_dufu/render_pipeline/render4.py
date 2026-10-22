#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""render4.py — V4 渲染入口（薄封装，复用 render3 的稳定管线）

差异只有"V4 契约"，不碰渲染内核：
  1. 默认 60fps
  2. 帧目录默认 output/v4_work/frames

  python render/render4.py frames --out output/v4_work/frames --fps 60
  python render/render4.py stills --times 5.6,13.4,35.2 --out output/v4_stills
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render3


def _patched_main():
    argv = sys.argv
    if len(argv) > 1 and argv[1] in ("frames", "video") and "--fps" not in argv:
        argv = argv[:2] + ["--fps", "60"] + argv[2:]
    if len(argv) > 1 and argv[1] == "frames" and "--out" not in argv:
        argv = argv + ["--out", os.path.join("output", "v4_work", "frames")]
    sys.argv = argv
    render3.main()


if __name__ == "__main__":
    _patched_main()
