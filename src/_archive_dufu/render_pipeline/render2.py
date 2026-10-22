#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
render2.py — 无编码截帧管线：canvas.getImageData() → POST → ffmpeg rawvideo
比 Playwright screenshot(PNG) 快一个数量级，且像素完全无损（无二次压缩）。

  python render/render2.py stills --times 1.5,6,20 --out output/stills
  python render/render2.py video --out output/dufu_v1.mp4
  python render/render2.py video --start 12 --end 24 --out output/s03.mp4
"""
import argparse
import base64
import http.server
import os
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(ROOT, "tools", "ffmpeg.exe")
PORT = 8321
W, H = 1920, 1080

_lock = threading.Lock()
_frames = {}

JS_CAPTURE = """
async (idx) => {
  const c = document.getElementById('stage');
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  await fetch('/frame?i=' + idx, { method: 'POST', body: d });
  return d.length;
}
"""


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

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        path = self.path
        if path.startswith("/frame"):
            with _lock:
                _frames["buf"] = body
                _frames["ev"].set()
            self.send_response(204)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()


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
    ])
    ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/index.html?render=1", wait_until="load")
    page.wait_for_function("window.READY === true", timeout=120000)
    page.evaluate("document.fonts.ready")
    page.evaluate("window.seek(0)")
    return browser, page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["stills", "video"])
    ap.add_argument("--times", default="")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--out", default="output/out.mp4")
    ap.add_argument("--crf", type=int, default=15)
    ap.add_argument("--preset", default="slow")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    _frames["ev"] = threading.Event()
    httpd = serve()
    outdir = os.path.dirname(os.path.abspath(args.out)) or "."
    os.makedirs(outdir, exist_ok=True)

    with sync_playwright() as pw:
        browser, page = open_page(pw)

        if args.mode == "stills":
            os.makedirs(args.out, exist_ok=True)
            for t in [float(x) for x in args.times.split(",") if x.strip()]:
                page.evaluate("(t)=>window.seek(t)", t)
                page.wait_for_timeout(30)
                _frames["ev"].clear()
                page.evaluate(JS_CAPTURE, 0)
                _frames["ev"].wait(5)
                buf = _frames.get("buf")
                p = os.path.join(args.out, f"t{t:06.2f}.png")
                with open(p + ".raw", "wb") as f:
                    f.write(buf)
                subprocess.run([
                    FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
                    "-s", f"{W}x{H}", "-i", p + ".raw", "-frames:v", "1", p
                ], check=True)
                os.remove(p + ".raw")
                print("wrote", p)
        else:
            dur = page.evaluate("window.DURATION")
            end = args.end if args.end is not None else dur
            n0, n1 = int(round(args.start * args.fps)), int(round(end * args.fps))
            total = n1 - n0
            cmd = [
                FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
                "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
                "-r", str(args.fps), "-i", "-",
                "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-x264-params", "keyint=60:min-keyint=30",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                args.out,
            ]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
            t0 = time.time()
            for i, f in enumerate(range(n0, n1)):
                if i > 0 and i % 200 == 0:
                    page.reload(wait_until="load")
                    page.wait_for_function("window.READY === true", timeout=120000)
                    page.evaluate("document.fonts.ready")
                for attempt in range(3):
                    try:
                        page.evaluate("(f)=>window.renderFrame(f)", f)
                        _frames["ev"].clear()
                        page.evaluate(JS_CAPTURE, i)
                        if not _frames["ev"].wait(20):
                            raise RuntimeError("frame timeout")
                        break
                    except Exception as e:
                        print(f"\n  retry frame {f} ({attempt+1}/3): {str(e)[:120]}")
                        page.reload(wait_until="load")
                        page.wait_for_function("window.READY === true", timeout=120000)
                        page.evaluate("document.fonts.ready")
                else:
                    raise RuntimeError(f"frame {f} failed 3 times")
                proc.stdin.write(_frames["buf"])
                if i % 30 == 0:
                    el = time.time() - t0
                    eta = el / (i + 1) * (total - i - 1)
                    print(f"\r  frame {i}/{total}   {el:5.0f}s elapsed   eta {eta:5.0f}s", end="", flush=True)
            proc.stdin.close()
            proc.wait()
            print(f"\ndone -> {args.out}   ({time.time()-t0:.0f}s)")

        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()
