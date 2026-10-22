#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fetch_fonts.py — 准备 assets/fonts/ 下的四款字体

优先从本机 Windows 字体目录复制（最快），缺失时从官方源下载。
四个文件缺一不可，否则画面会退化成默认宋体/黑体。

  python tools/fetch_fonts.py
"""
import os
import shutil
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "assets", "fonts")
WIN_FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

# (目标文件名, 本机候选名, 下载地址)
FONTS = [
    ("NotoSerifSC-VF.ttf", ["NotoSerifSC-VF.ttf"],
     "https://github.com/googlefonts/noto-cjk/raw/main/Serif/Variable/OTF/Subset/NotoSerifSC-VF.otf"),
    ("SourceHanSerifSC-Heavy.ttf", ["Source Han Serif SC Heavy (TrueType).ttf", "SourceHanSerifSC-Heavy.ttf"],
     "https://github.com/adobe-fonts/source-han-serif/raw/release/SubsetOTF/SC/SourceHanSerifSC-Heavy.otf"),
    ("LXGWWenKai-Regular.ttf", ["LXGWWenKai-Regular.ttf"],
     "https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Regular.ttf"),
    ("MaShanZheng-Regular.ttf", ["MaShanZheng-Regular.ttf"],
     "https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf"),
]


def download(url, path):
    print(f"  ↓ {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r, open(path, "wb") as f:
        shutil.copyfileobj(r, f)


def main():
    os.makedirs(DEST, exist_ok=True)
    missing = 0
    for target, candidates, url in FONTS:
        out = os.path.join(DEST, target)
        if os.path.exists(out) and os.path.getsize(out) > 10000:
            print(f"✓ {target} 已存在 ({os.path.getsize(out)//1024} KB)")
            continue
        copied = False
        for name in candidates:
            src = os.path.join(WIN_FONTS, name)
            if os.path.exists(src):
                shutil.copyfile(src, out)
                print(f"✓ {target} ← 系统字体 {name}")
                copied = True
                break
        if copied:
            continue
        try:
            download(url, out)
            print(f"✓ {target} ← 下载完成 ({os.path.getsize(out)//1024} KB)")
        except Exception as e:
            missing += 1
            print(f"✗ {target} 获取失败: {e}")
    if missing:
        print(f"\n有 {missing} 个字体失败，可手动放入 {DEST}")
        sys.exit(1)
    print("\n字体就绪。可以运行 python -m http.server 8000 预览，或 run_all.ps1 重建。")


if __name__ == "__main__":
    main()
