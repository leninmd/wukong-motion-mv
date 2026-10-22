"""栅格化 `public/wukong_model/wukong_rig.json` → 透明 PNG + 高精度 SVG 轮廓。

流程严格按"生图 → 抠图 → 提轮廓"来，只是把生图换成了确定性多边形：

  1. 读 `wukong_rig.json`，按 layer 排序逐块填充（内部恒为 #0B090A）。
  2. 鎏金外发光：先把所有多边形压成一张 alpha mask，高斯模糊后染成 #FCC934
     垫在最底层，等价于运行时的 `drop-shadow(0 0 3px #FCC934)`。
  3. `cv2.findContours` 从 alpha 通道抽出真实边缘，`approxPolyDP` 精简后写成
     SVG path —— 这就是"从抠图结果里提取高精度矢量轮廓"。

用法： python scripts/rasterize_wukong_model.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "wukong_model" / "wukong_rig.json"
OUT = ROOT / "public" / "wukong_model"

SCALE = 2.0
SSAA = 2  # 超采样倍率，先放大再缩回来做抗锯齿
GLOW_SIGMA = 3.0
STROKE = 2.0

INK = (11, 9, 10, 255)
GOLD = (252, 201, 52, 255)
GOLD_LIGHT = (255, 239, 176, 255)
CINNABAR = (217, 48, 37, 255)
GOLD_LINE = (252, 201, 52, 190)


def load() -> dict:
    return json.loads(SRC.read_text(encoding="utf-8"))


def draw_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[list[float]],
    scale: float,
    fill: tuple | None,
    outline: tuple | None,
    width: float,
) -> None:
    pts = [(p[0] * scale, p[1] * scale) for p in points]
    if len(pts) < 3:
        return
    draw.polygon(pts, fill=fill)
    if outline is not None:
        draw.line(pts + [pts[0]], fill=outline, width=max(1, int(round(width))), joint="curve")


def rasterize(pose: dict, named: list[tuple[str, list[list[float]]]]) -> Image.Image:
    width = int(pose["viewBox"][0] * SCALE * SSAA)
    height = int(pose["viewBox"][1] * SCALE * SSAA)
    scale = SCALE * SSAA

    # --- 1. 鎏金外发光底 ---------------------------------------------------
    glow_mask = Image.new("L", (width, height), 0)
    glow_draw = ImageDraw.Draw(glow_mask)
    for _, points in named:
        draw_polygon(glow_draw, points, scale, fill=255, outline=255, width=STROKE * scale)
    glow_mask = glow_mask.filter(ImageFilter.GaussianBlur(GLOW_SIGMA * scale))
    glow = Image.new("RGBA", (width, height), (252, 201, 52, 0))
    glow.putalpha(glow_mask.point(lambda v: int(v * 0.85)))
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(glow)

    # --- 2. 装甲本体 -------------------------------------------------------
    body = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(body)
    parts = sorted(pose["parts"], key=lambda item: item["layer"])
    for item in parts:
        material = item["material"]
        if material == "goldLine":
            draw_polygon(draw, item["points"], scale, None, GOLD_LINE, STROKE * 0.8 * scale)
        elif material == "gold":
            draw_polygon(draw, item["points"], scale, GOLD, GOLD_LIGHT, 1.4 * scale)
        elif material == "cinnabar":
            draw_polygon(draw, item["points"], scale, CINNABAR, GOLD, 1.4 * scale)
        elif material == "rim":
            draw_polygon(draw, item["points"], scale, (252, 201, 52, 26), GOLD, 1.2 * scale)
        else:
            draw_polygon(draw, item["points"], scale, INK, GOLD, STROKE * scale)

    # 金箍 / 冠心 / 眼眸在剪影之上
    draw_polygon(draw, pose["crown"], scale, GOLD, GOLD_LIGHT, 1.6 * scale)
    for wing in pose["crownWings"]:
        draw_polygon(draw, wing, scale, GOLD, GOLD_LIGHT, 1.4 * scale)
    draw_polygon(draw, pose["crownCrest"], scale, GOLD_LIGHT, GOLD, 1.4 * scale)
    for key in ("left", "right"):
        draw_polygon(draw, pose["eyes"][key], scale, GOLD, GOLD_LIGHT, 1.6 * scale)
    for key in ("coreLeft", "coreRight"):
        draw_polygon(draw, pose["eyes"][key], scale, GOLD_LIGHT, None, 0)

    canvas.alpha_composite(body)
    return canvas.resize(
        (int(pose["viewBox"][0] * SCALE), int(pose["viewBox"][1] * SCALE)),
        Image.LANCZOS,
    )


def extract_outline(png: Path, target: Path, epsilon: float = 1.2) -> int:
    image = cv2.imread(str(png), cv2.IMREAD_UNCHANGED)
    alpha = image[:, :, 3]
    _, binary = cv2.threshold(alpha, 18, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    paths: list[str] = []
    kept = 0
    for contour in contours:
        if cv2.contourArea(contour) < 24:
            continue
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) < 3:
            continue
        pts = approx.reshape(-1, 2)
        d = "M" + " L".join(f"{int(x)},{int(y)}" for x, y in pts) + " Z"
        paths.append(d)
        kept += 1
    h, w = alpha.shape
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        f"  <!-- 从透明 PNG 的 alpha 通道提取的矢量轮廓：{kept} 条闭合路径 -->\n"
        f'  <g fill="none" stroke="#FCC934" stroke-width="2" stroke-linejoin="miter">\n'
        + "".join(f'    <path d="{d}" />\n' for d in paths)
        + "  </g>\n</svg>\n"
    )
    target.write_text(svg, encoding="utf-8")
    return kept


def main() -> None:
    data = load()
    manifest = {"poses": {}}
    for pose_id, pose in data["poses"].items():
        named: list[tuple[str, list[list[float]]]] = [
            (item["id"], item["points"]) for item in pose["parts"]
        ]
        named += [("crown", pose["crown"]), ("crownCrest", pose["crownCrest"])]
        named += [(f"crownWing{index}", wing) for index, wing in enumerate(pose["crownWings"])]
        named += [("eyeLeft", pose["eyes"]["left"]), ("eyeRight", pose["eyes"]["right"])]

        image = rasterize(pose, named)
        png = OUT / f"wukong_{pose_id}.png"
        image.save(png)

        outline = OUT / f"wukong_{pose_id}_outline.svg"
        contours = extract_outline(png, outline)

        opaque = np.asarray(image)[:, :, 3] > 16
        ratio = float(opaque.mean())
        expected = math.ceil(pose["viewBox"][0] * SCALE)
        manifest["poses"][pose_id] = {
            "png": png.name,
            "pngBytes": png.stat().st_size,
            "size": list(image.size),
            "expectedWidth": expected,
            "coverage": round(ratio, 4),
            "outline": outline.name,
            "outlineContours": contours,
        }
        print(
            f"{pose_id:20s} {image.size[0]}x{image.size[1]}  "
            f"coverage={ratio:.1%}  contours={contours:3d}  {png.stat().st_size // 1024} KB"
        )

    (OUT / "raster_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"\nrasterized {len(manifest['poses'])} poses → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
