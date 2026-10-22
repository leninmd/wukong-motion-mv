#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
render.py — 确定性逐帧渲染（Playwright → PNG → ffmpeg pipe）

用法:
  # 抽帧自检（返回静帧，用于视觉验收）
  python render/render.py stills --times 1.5,6,10.5 --out output/stills

  # 全片渲染
  python render/render.py video --out output/dufu_v1.mp4 --fps 30

  # 区间渲染（调试某一场）
  python render/render.py video --start 12 --end 24 --out output/s03.mp4
"""
import argparse
import http.server
import os
import socketserver
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")
PORT = 8317


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve():
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    httpd.daemon_threads = True
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def open_page(pw, w, h):
    browser = pw.chromium.launch(args=[
        "--force-color-profile=srgb",
        "--disable-lcd-text",
        "--font-render-hinting=none",
        "--disable-features=Translate",
    ])
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/index.html?render=1", wait_until="load")
    page.wait_for_function("window.READY === true", timeout=120000)
    # 字体二次确认 + 首帧预热
    page.evaluate("document.fonts.ready")
    page.evaluate("window.seek(0)")
    time.sleep(0.3)
    return browser, page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["stills", "video"])
    ap.add_argument("--times", default="")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--out", default="output/out.mp4")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument("--subdir", action="store_true", help="stills 模式：每张图存为独立文件")
    args = ap.parse_args()

    sys.path.insert(0, ROOT)
    from playwright.sync_api import sync_playwright

    httpd = serve()
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)

    with sync_playwright() as pw:
        browser, page = open_page(pw, args.width, args.height)

        if args.mode == "stills":
            out = args.out
            os.makedirs(out, exist_ok=True)
            times = [float(x) for x in args.times.split(",") if x.strip()]
            for t in times:
                page.evaluate("(t)=>window.seek(t)", t)
                page.wait_for_timeout(60)
                p = os.path.join(out, f"t{t:06.2f}.png")
                page.screenshot(path=p)
                print("wrote", p)
        else:
            dur = page.evaluate("window.DURATION")
            end = args.end if args.end is not None else dur
            n0 = int(round(args.start * args.fps))
            n1 = int(round(end * args.fps))
            total = n1 - n0
            cmd = [
                FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                "-f", "image2pipe", "-vcodec", "png", "-r", str(args.fps), "-i", "-",
                "-c:v", "libx264", "-preset", "medium", "-crf", str(args.crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                args.out,
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            t0 = time.time()
            for i, f in enumerate(range(n0, n1)):
                page.evaluate("(f)=>window.renderFrame(f)", f)
                png = page.screenshot(type="png")
                proc.stdin.write(png)
                if i % 30 == 0:
                    el = time.time() - t0
                    eta = el / (i + 1) * (total - i - 1)
                    print(f"\rframe {i}/{total}  {el:.0f}s elapsed  eta {eta:.0f}s", end="", flush=True)
            proc.stdin.close()
            proc.wait()
            print(f"\ndone -> {args.out}  ({time.time()-t0:.0f}s)")

        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
