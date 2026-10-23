"""V7 五指山 2K 木刻背景（生图网关配额耗尽时的确定性离线兜底）。

背景
----
V7 原计划调用生图网关生成 `v7_mountain_wide_raw.png`；实际连续返回
`429 RESOURCE_EXHAUSTED`，重试一次仍失败。为不阻塞镜头修复，本脚本用
**已有的 2K 木刻资产 + 确定性 PIL 绘制**合成一张 2048×1152 的满屏五指山：

  · 左右与顶部 75% 面积是嶙峋的墨黑/赭石巨岩，带层理/受光面/鎏金岩缘；
  · 岩面刻满金色梵文式经咒（确定性 glyph，非真实文本）；
  · 中下方只留一道狭窄暖金天光裂谷；
  · 巨岩内部叠加 `gate_woodblock.png` 的真实盘龙/云纹木刻纹理，底部叠
    浮世绘祥云带，避免纯代码的塑料感。

它不是生图；如果之后网关恢复，优先重新生成 `v7_mountain_wide_raw.png` 再走
`build_wukong_assets.py --only v7extras`。

用法：
  python scripts/build_mountain_fallback.py
"""

from __future__ import annotations

import random
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "wukong_assets"
OUT = ASSETS / "five_finger_mountain_woodblock.png"
W, H = 2048, 1152
S = 2


def jagged(points: list[tuple[float, float]], rough: float, rng: random.Random, steps: int = 8) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for index in range(len(points)):
        x0, y0 = points[index]
        x1, y1 = points[(index + 1) % len(points)]
        out.append((x0, y0))
        dx, dy = x1 - x0, y1 - y0
        length = max(1.0, (dx * dx + dy * dy) ** 0.5)
        nx, ny = -dy / length, dx / length
        for step in range(1, steps):
            t = step / steps
            jitter = (rng.random() - 0.5) * 2 * rough
            out.append((x0 + dx * t + nx * jitter, y0 + dy * t + ny * jitter))
    return out


def scaled(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(x * S, y * S) for x, y in points]


def draw_glyph(draw: ImageDraw.ImageDraw, x: float, y: float, size: float, colour: tuple[int, int, int], alpha: int, rng: random.Random) -> None:
    width = max(1, int(size * 0.14))
    top = y - size
    bottom = y + size
    draw.line((x, top, x, bottom), fill=colour + (alpha,), width=width)
    draw.arc((x - size * 0.42, top, x + size * 0.42, top + size * 0.5), 200, 345, fill=colour + (alpha,), width=width)
    if rng.random() < 0.8:
        draw.arc((x - size * 0.55, y - size * 0.25, x + size * 0.1, y + size * 0.45), 260, 100, fill=colour + (alpha,), width=width)
    if rng.random() < 0.65:
        draw.arc((x - size * 0.05, y + size * 0.1, x + size * 0.6, y + size * 0.7), 180, 20, fill=colour + (alpha,), width=width)
    draw.line((x - size * 0.18, bottom, x + size * 0.3, bottom - size * 0.22), fill=colour + (alpha,), width=width)
    if rng.random() < 0.5:
        draw.ellipse((x - size * 0.12, top + size * 0.02, x + size * 0.12, top + size * 0.26), fill=colour + (alpha,))


def main() -> int:
    rng = random.Random(71011)
    ASSETS.mkdir(parents=True, exist_ok=True)

    # ---- 天幕：深墨 → 赭石 ----
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top = np.array([10, 7, 9], np.float32)
    mid = np.array([34, 17, 14], np.float32)
    bottom = np.array([58, 24, 14], np.float32)
    base = top * (1 - yy) + mid * yy
    t = np.clip((yy - 0.55) / 0.45, 0, 1) ** 1.1
    base = base * (1 - t) + bottom * t
    canvas = np.repeat(base, W, axis=1)

    # ---- 远景天空：复用 halberds 的木刻云山 ----
    halberds = cv2.imread(str(ASSETS / "halberds_woodblock.png"))
    if halberds is not None:
        sky = halberds[16:600, 18:-18]
        sky = cv2.resize(sky, (W, 560), interpolation=cv2.INTER_LANCZOS4)
        sky = cv2.cvtColor(sky, cv2.COLOR_BGR2RGB).astype(np.float32)
        alpha = np.linspace(0.5, 0.0, 560, dtype=np.float32)[:, None, None]
        canvas[0:560] = canvas[0:560] * (1 - alpha) + sky * alpha

    # ---- 裂谷暖光 ----
    gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
    rift = np.exp(-((gx - 1000) ** 2) / (2 * 260 ** 2)) * np.clip((gy - 380) / 720, 0, 1)
    canvas = np.clip(canvas + np.dstack([255 * rift * 0.75, 190 * rift * 0.55, 105 * rift * 0.35]), 0, 255)

    # ---- 2× 超采样：巨岩 / 受光面 / 层理 / 鎏金岩缘 ----
    big = Image.fromarray(canvas.astype(np.uint8)).resize((W * S, H * S), Image.LANCZOS).convert("RGBA")
    draw = ImageDraw.Draw(big, "RGBA")

    left = jagged([(0, -30), (720, -30), (640, 150), (700, 300), (560, 430), (640, 600), (470, 760), (540, 930), (330, 1080), (360, 1180), (0, 1180)], 34, rng)
    right = [(W - x, y) for x, y in left]
    top_edge = jagged([(0, -30), (W, -30), (W, 310), (1810, 250), (1640, 380), (1430, 270), (1220, 400), (1010, 300), (800, 410), (610, 310), (400, 420), (190, 300), (0, 380)], 40, rng)
    finger_left = jagged([(560, 280), (820, 160), (980, 300), (930, 520), (820, 760), (680, 900), (590, 700), (540, 480)], 38, rng)
    finger_right = [(W - x, y) for x, y in finger_left]
    central = jagged([(900, 420), (1010, 360), (1110, 440), (1080, 620), (1140, 820), (1040, 980), (930, 860), (860, 640)], 24, rng)

    rocks = [
        (left, (12, 8, 10), (40, 22, 16)),
        (right, (12, 8, 10), (40, 22, 16)),
        (top_edge, (10, 7, 8), (34, 18, 13)),
        (finger_left, (12, 8, 10), (44, 24, 16)),
        (finger_right, (12, 8, 10), (44, 24, 16)),
        (central, (9, 6, 7), (30, 16, 12)),
    ]

    for points, dark, light in rocks:
        poly = scaled(points)
        draw.polygon(poly, fill=dark + (255,))
        shifted = [(x + 24 * S if x < W * S / 2 else x - 24 * S, y + 16 * S) for x, y in poly]
        draw.polygon(shifted, fill=light + (70,))

        # 大块受光面
        for _ in range(8):
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            cx = rng.uniform(min(xs), max(xs))
            cy = rng.uniform(min(ys), max(ys))
            size = rng.uniform(40, 120) * S
            facet = [
                (cx + rng.uniform(-size, size), cy + rng.uniform(-size, size)),
                (cx + rng.uniform(-size, size), cy + rng.uniform(-size, size)),
                (cx + rng.uniform(-size, size), cy + rng.uniform(-size, size)),
            ]
            draw.polygon(facet, fill=(74, 40, 26, rng.randint(30, 60)))

        # 层理刻线
        for _ in range(80):
            x = rng.uniform(min(p[0] for p in poly), max(p[0] for p in poly))
            y = rng.uniform(min(p[1] for p in poly), max(p[1] for p in poly))
            length = rng.uniform(30, 160) * S
            draw.line((x, y, x + length * 0.55, y + length), fill=(8, 5, 6, 140), width=rng.randint(1, 3) * S)

        edge = poly + [poly[0]]
        draw.line(edge, fill=(143, 91, 32, 220), width=3 * S, joint="curve")
        draw.line(edge, fill=(245, 194, 66, 120), width=1 * S, joint="curve")

    # ---- 缩回 1×，叠真实盘龙木刻纹理 ----
    arr = np.array(big.convert("RGB").resize((W, H), Image.LANCZOS)).astype(np.float32)
    gate = cv2.imread(str(ASSETS / "gate_woodblock.png"))
    if gate is not None:
        tex = gate[900:1750, 60:-60]
        tex = cv2.resize(cv2.cvtColor(tex, cv2.COLOR_BGR2RGB), (W, H), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
        gray = cv2.cvtColor(tex.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        tex = tex * 0.35 + np.dstack([gray] * 3) * 0.65
        mask = np.clip((105 - arr.mean(axis=2)) / 105, 0, 1)[..., None]
        arr = arr * (1 - 0.2 * mask) + (arr * tex / 255.0) * (0.2 * mask)

    # 重新压回裂谷暖光（纹理会压暗它）
    arr = np.clip(arr + np.dstack([255 * rift * 0.5, 190 * rift * 0.35, 105 * rift * 0.22]), 0, 255)

    # ---- 大号金色梵文经咒 ----
    glyph_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glyph_layer)
    gold = (210, 160, 66)
    gold_light = (245, 194, 66)
    placed = 0
    while placed < 80:
        x = rng.uniform(40, W - 40)
        y = rng.uniform(60, H - 120)
        if 660 < x < 1380 and y > 420:
            continue
        if 560 < x < 1000 and y > 320:
            continue
        size = rng.uniform(12, 28)
        draw_glyph(gd, x, y, size, gold_light if rng.random() < 0.4 else gold, rng.randint(110, 200), rng)
        placed += 1

    composed = Image.alpha_composite(Image.fromarray(arr.astype(np.uint8)).convert("RGBA"), glyph_layer)

    # ---- 底部浮世绘祥云带：只占底部 150px，给角色一个落脚处 ----
    cloud_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cloud_layer)
    for band, (y0, fill, alpha) in enumerate(
        [
            (1004, (232, 218, 190), 242),
            (1062, (214, 194, 158), 244),
        ]
    ):
        pts: list[tuple[float, float]] = [(-40, y0)]
        for x in range(-40, W + 80, 32):
            wave = np.sin(x / 105 + band * 1.4) * 14 + np.sin(x / 41 + band) * 7
            pts.append((x, y0 + wave))
        pts += [(W + 40, H + 40), (-40, H + 40)]
        cd.polygon(pts, fill=fill + (alpha,))
        cd.line(pts[:-2], fill=(18, 13, 20, 238), width=4, joint="curve")
        cd.line([(x, y + 9) for x, y in pts[:-2]], fill=(194, 149, 38, 130), width=1, joint="curve")

    # 云头卷曲
    for index in range(22):
        cx = 36 + index * 96
        cy = 990 + (index % 2) * 18 + np.sin(index * 1.7) * 10
        r = 18 + (index % 4) * 5
        cd.arc((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), 200, 340, fill=(18, 13, 20, 220), width=3)

    composed = Image.alpha_composite(composed, cloud_layer)

    # ---- 纸纹 + 暗角 ----
    arr = np.array(composed.convert("RGB")).astype(np.float32)
    rng2 = np.random.default_rng(71012)
    grain = cv2.GaussianBlur(rng2.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 1.1)
    arr = np.clip(arr * (1 + grain[..., None] * 0.035), 0, 255)
    vy, vx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (vx / (W - 1) - 0.5) * 2
    ny = (vy / (H - 1) - 0.5) * 2
    rr = np.sqrt(nx * nx + ny * ny) / 1.414
    arr = np.clip(arr * (1 - np.clip((rr - 0.5) / 0.5, 0, 1)[..., None] * 0.32), 0, 255)
    Image.fromarray(arr.astype(np.uint8), "RGB").save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} {W}x{H} {OUT.stat().st_size / 1024:.0f}KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

