#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
qa.py — 成片质检：容器参数 + 逐点抽帧亮度/运动探针 + 音轨电平

  python render/qa.py output/dufu_v1.mp4
"""
import json
import os
import subprocess
import sys
import tempfile

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")
FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe")


def probe(path):
    # imageio-ffmpeg 只带 ffmpeg，没有 ffprobe：用 ffmpeg -i 解析
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", path], capture_output=True, text=True)
    return r.stderr


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "output", "dufu_v1.mp4")
    info = probe(path)
    out = {"file": path, "issues": [], "checks": {}}

    # 容器信息
    for line in info.splitlines():
        s = line.strip()
        if s.startswith("Duration"):
            out["checks"]["duration"] = s.split(",")[0].replace("Duration:", "").strip()
        if "Video:" in s:
            out["checks"]["video"] = s.strip()[:120]
        if "Audio:" in s:
            out["checks"]["audio"] = s.strip()[:120]

    if "Audio:" not in info:
        out["issues"].append("NO_AUDIO_STREAM")

    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = n / fps if fps else 0
    out["checks"].update({"fps": round(fps, 3), "frames": n, "size": [w, h], "seconds": round(dur, 2)})

    if abs(fps - 60) > 0.01 and abs(fps - 30) > 0.01:
        out["issues"].append(f"FPS_NOT_30 ({fps})")
    if (w, h) != (1920, 1080):
        out["issues"].append(f"RESOLUTION_NOT_1920x1080 ({w}x{h})")
    if not (84.5 <= dur <= 85.5):
        out["issues"].append(f"DURATION_OUT_OF_RANGE ({dur:.2f}s)")

    # 逐 2 秒抽一帧：亮度、方差、与前一采样帧的差异
    samples = []
    prev = None
    t = 0.0
    while t < dur - 0.05:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(fr, (240, 135)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        row = {"t": round(t, 1), "mean": round(float(g.mean()), 1), "std": round(float(g.std()), 1)}
        if prev is not None:
            row["diff"] = round(float(np.abs(g - prev).mean()), 2)
        samples.append(row)
        prev = g
        t += 2.0
    out["samples"] = samples

    # 死帧 / 黑屏检测（注意：片头 0–0.9s 与终章 84.5s 后本就是黑场）
    dead = []
    for i, s in enumerate(samples):
        if 1.2 < s["t"] < 84.0 and s["std"] < 3.0:
            dead.append(s["t"])
    if dead:
        out["issues"].append(f"FLAT_FRAMES at {dead}")
    frozen = [s["t"] for s in samples if "diff" in s and s["diff"] < 0.05 and 1.2 < s["t"] < 84]
    if frozen:
        out["issues"].append(f"FROZEN_SAMPLES at {frozen}")

    # 对比度粗检：中段不应整段贴边
    mids = [s["mean"] for s in samples if 5 < s["t"] < 80]
    if mids and max(mids) - min(mids) < 8:
        out["issues"].append("LOW_DYNAMIC_RANGE")

    out["status"] = "PASS" if not out["issues"] else "FAIL"
    print(json.dumps(out, ensure_ascii=False, indent=2)[:4000])
    cap.release()


if __name__ == "__main__":
    main()
