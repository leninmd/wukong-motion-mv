#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""s03 诊断：逐层关掉，定位异常矩形。"""
import os, sys, threading, http.server
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8357
W, H = 1920, 1080


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a):
        pass
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

VARIANTS = sys.argv[1:] or ["base"]

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--force-color-profile=srgb"])
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
    page = ctx.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/index.html?render=1", wait_until="load", timeout=120000)
    page.wait_for_function("window.READY === true", timeout=180000)
    page.wait_for_function("!document.getElementById('loading')", timeout=15000)
    for v in VARIANTS:
        page.evaluate("""
        (v) => {
          const P = window.DFS.sceneRegistry['s03'].prototype;
          if (!P.__orig) {
            P.__orig = { m: P._mountains, cs: P._cloudSea, ls: P._lightShaft, mm: P._macroWorld };
          }
          P._mountains = P.__orig.m;
          P._cloudSea = P.__orig.cs;
          P._lightShaft = P.__orig.ls;
          if (v === 'nomtn') P._mountains = function(){};
          if (v === 'nocloud') P._cloudSea = function(){};
          if (v === 'nolight') P._lightShaft = function(){};
        }
        """, v)
        page.evaluate("window.seek(24.5)")
        page.screenshot(path=f"output/v3_work/s03/_diag_{v}.png")
        print("wrote", v, flush=True)
    b.close()
httpd.shutdown()
