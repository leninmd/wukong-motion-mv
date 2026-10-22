#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
render3.py — 稳定版渲染器：Playwright JPEG 截图 → ffmpeg image2pipe
JPEG q96 的压缩损失在 H.264 编码后基本不可见，但截帧速度快 3–4 倍。

  python render/render3.py video --out output/dufu_silent_v1.mp4
  python render/render3.py video --start 55 --end 64 --out output/seg_c7.mp4
"""
import argparse
import http.server
import os
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")
PORT = int(os.environ.get("V2_RENDER_PORT", "8331"))
W, H = 1920, 1080


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        path = self.path.split("?")[0].lower()
        if path.endswith((".html", ".js", ".json")) or path in ("/", ""):
            self.send_header("Cache-Control", "no-store")
        else:
            self.send_header("Cache-Control", "max-age=86400")
        super().end_headers()


def serve():
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def open_page(pw):
    browser = pw.chromium.launch(args=[
        "--force-color-profile=srgb",
        "--disable-lcd-text",
        "--font-render-hinting=none",
        "--disable-features=Translate",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
    ])
    ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/index.html?render=1", wait_until="load", timeout=120000)
    page.wait_for_function("window.READY === true", timeout=180000)
    page.evaluate("document.fonts.ready")
    # LOADING 遮罩有 0.4s 淡出，必须等它彻底移除，否则片头几帧会拍到它
    page.wait_for_function("!document.getElementById('loading')", timeout=15000)
    page.wait_for_timeout(120)
    page.evaluate("window.seek(0)")
    return browser, page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["video", "stills", "frames"])
    ap.add_argument("--times", default="")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--out", default="output/out.mp4")
    ap.add_argument("--quality", type=int, default=96)
    ap.add_argument("--crf", type=int, default=15)
    ap.add_argument("--preset", default="medium")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    httpd = serve()
    t_all = time.time()

    with sync_playwright() as pw:
        browser, page = open_page(pw)
        print(f"ready in {time.time()-t_all:.1f}s", flush=True)

        if args.mode == "frames":
            dur = page.evaluate("window.DURATION")
            end = args.end if args.end is not None else dur
            n0, n1 = int(round(args.start * args.fps)), int(round(end * args.fps))
            os.makedirs(args.out, exist_ok=True)
            t0 = time.time()
            for i, f in enumerate(range(n0, n1)):
                if i > 0 and i % 120 == 0:
                    try:
                        browser.close()
                    except Exception:
                        pass
                    browser, page = open_page(pw)
                pth = os.path.join(args.out, f"f{f:05d}.jpg")
                if os.path.exists(pth) and os.path.getsize(pth) > 1000:
                    continue
                for attempt in range(3):
                    try:
                        page.evaluate("(f)=>window.renderFrame(f)", f)
                        page.screenshot(path=pth, type="jpeg", quality=args.quality)
                        break
                    except Exception as e:
                        print(f"  retry {f} ({attempt+1}/3): {str(e)[:120]}", flush=True)
                        try:
                            browser.close()
                        except Exception:
                            pass
                        browser, page = open_page(pw)
                if i % 30 == 0:
                    el = time.time() - t0
                    eta = el / (i + 1) * ((n1 - n0) - i - 1)
                    print(f"  frame {i}/{n1-n0}  {el:5.0f}s  eta {eta:5.0f}s", flush=True)
            print(f"frames done -> {args.out} ({time.time()-t0:.0f}s)", flush=True)
            browser.close()
            httpd.shutdown()
            return

        if args.mode == "stills":
            os.makedirs(args.out, exist_ok=True)
            for t in [float(x) for x in args.times.split(",") if x.strip()]:
                page.evaluate("(t)=>window.seek(t)", t)
                p = os.path.join(args.out, f"t{t:06.2f}.jpg")
                page.screenshot(path=p, type="jpeg", quality=args.quality)
                print("wrote", p, flush=True)
        else:
            dur = page.evaluate("window.DURATION")
            end = args.end if args.end is not None else dur
            n0, n1 = int(round(args.start * args.fps)), int(round(end * args.fps))
            total = n1 - n0
            cmd = [
                FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                "-f", "image2pipe", "-vcodec", "mjpeg", "-r", str(args.fps), "-i", "-",
                "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-x264-params", "keyint=60:min-keyint=30",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                args.out,
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            t0 = time.time()
            last_launch = time.time()

            def relaunch():
                nonlocal browser, page, last_launch
                try:
                    browser.close()
                except Exception:
                    pass
                browser, page = open_page(pw)
                last_launch = time.time()

            for i, f in enumerate(range(n0, n1)):
                # 每 120 帧重启浏览器，释放 Chromium 的堆（本机内存紧张时尤其必要）
                if i > 0 and i % 120 == 0:
                    relaunch()
                for attempt in range(3):
                    try:
                        t_f = time.time()
                        page.evaluate("(f)=>window.renderFrame(f)", f)
                        jpg = page.screenshot(type="jpeg", quality=args.quality)
                        if time.time() - t_f > 12:
                            print(f"  slow frame {f}: {time.time()-t_f:.1f}s", flush=True)
                        break
                    except Exception as e:
                        print(f"\n  retry {f} ({attempt+1}/3): {str(e)[:140]}", flush=True)
                        relaunch()
                else:
                    raise RuntimeError(f"frame {f} failed")
                proc.stdin.write(jpg)
                if i % 30 == 0:
                    el = time.time() - t0
                    eta = el / (i + 1) * (total - i - 1)
                    print(f"  frame {i}/{total}  {el:5.0f}s  eta {eta:5.0f}s", flush=True)
            proc.stdin.close()
            proc.wait()
            print(f"done -> {args.out}  ({time.time()-t0:.0f}s)", flush=True)
        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
