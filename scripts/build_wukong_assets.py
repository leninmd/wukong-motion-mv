"""V6 造型 / 版画资产管线 —— 生图网关 2K 素材 → rembg / vtracer / OpenCV 套版。

为什么重写 V5
-------------
V5 的 `silhouette_*` 是「纯 #120D14 填死」：内部铠甲、五官、披风全部丢失，
在 1B / 3A 的暗底上就是一团黑墨。V5 的 `colour_*` 又保留了生图自带的白色
贴纸描边，2B 左下角像贴了一张卡通贴纸。V5 的 face / eyes 来自 852×480 参考
视频截图，放大 4.4 倍后只剩红白灰像素斑。

V6 只做三件事，全部离线完成，运行期 `src/` 只贴图：

1. **角色**：生图网关的四个姿态立绘 → `rembg` 去背 → 白边距离阈值 + 外轮廓
   填洞 + `cv2.erode(3px)` 彻底剥掉白色钥匙线 → 四色套版
   （墨 #120D14 / 朱砂 #C8281E / 鎏金 #F5C242 / 宣纸 #EAE0CE），
   内部铠甲线与披风色块全部保留。
2. **2K 特写**：生图网关的眼部 / 怒颜（1024² 与 1376×768）→ LANCZOS 放大
   → 2200×356 眼部横条 / 2048² 怒颜。**不再从 480p 视频截一帧放大。**
3. **建筑 / 天兵**：生图网关的南天门、凌霄殿、十万天兵 → 2K LANCZOS →
   `vtracer` 多层 SVG → `resvg` 2K 栅格 → 纸纹/暗角/套色。运行期只是 `<Img>`。

用法：
  python scripts/build_wukong_assets.py            # 全部重建
  python scripts/build_wukong_assets.py --only characters
  python scripts/build_wukong_assets.py --only prints,buildings
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "out" / "gen"
OUT = ROOT / "public" / "wukong_assets"
RASTERIZE = ROOT / "scripts" / "rasterize_svg.mjs"

# 调色板（RGB）。四主色 + 每种主色的一个暗调，不引入第五个主色。
INK = np.array([18, 13, 20], np.float32)          # #120D14
CINNABAR = np.array([200, 40, 30], np.float32)    # #C8281E
CINNABAR_DEEP = np.array([122, 20, 16], np.float32)
GOLD = np.array([245, 194, 66], np.float32)       # #F5C242
GOLD_DEEP = np.array([142, 96, 18], np.float32)
PAPER = np.array([234, 224, 206], np.float32)     # #EAE0CE
PAPER_LIGHT = np.array([244, 239, 230], np.float32)
PAPER_DIM = np.array([196, 176, 144], np.float32)

CHARACTERS = [
    # raw 文件名, 成品名, 目标高度（长边），纹理种子, 先裁掉的画框像素
    ("hero_spin_raw.png", "woodblock_spin.png", 1800, 6101, 0),
    ("hero_slash_clean_raw.png", "woodblock_slash.png", 2048, 6102, 30),
    ("hero_trapped_raw.png", "woodblock_trapped.png", 1800, 6103, 0),
    ("hero_raise_raw.png", "woodblock_raise.png", 1800, 6104, 0),
]

# V7 追加：1B 结印蓄力、1A 第四格腾空劈棒。
V7_CHARACTERS = [
    ("v7_charge_raw.png", "woodblock_charge.png", 1800, 7101, 0),
    ("v7_panel4_raw.png", "woodblock_panel4.png", 1800, 7102, 0),
]


# --------------------------------------------------------------------------- #
#  I/O
# --------------------------------------------------------------------------- #
def imread_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.array(im.convert("RGB"))


def write_rgb(path: Path, rgb: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(path, "PNG", optimize=True)


def write_rgba(path: Path, rgb: np.ndarray, alpha: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = np.dstack(
        [
            np.clip(rgb, 0, 255).astype(np.uint8),
            np.clip(alpha, 0, 255).astype(np.uint8),
        ]
    )
    Image.fromarray(rgba, "RGBA").save(path, "PNG", optimize=True)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def resize_rgb(rgb: np.ndarray, width: int, height: int) -> np.ndarray:
    return cv2.resize(rgb, (width, height), interpolation=cv2.INTER_LANCZOS4)


def unsharp(rgb: np.ndarray, amount: float = 0.55, sigma: float = 1.2) -> np.ndarray:
    blur = cv2.GaussianBlur(rgb.astype(np.float32), (0, 0), sigma)
    return np.clip(rgb.astype(np.float32) * (1 + amount) - blur * amount, 0, 255)


def paper_grain(shape: tuple[int, int], seed: int, amount: float = 0.028) -> np.ndarray:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 1, shape).astype(np.float32)
    return cv2.GaussianBlur(noise, (0, 0), 1.1)


def apply_grain(rgb: np.ndarray, seed: int, amount: float = 0.028) -> np.ndarray:
    grain = paper_grain(rgb.shape[:2], seed, amount)
    return np.clip(rgb.astype(np.float32) * (1 + grain[..., None] * amount), 0, 255)


def vignette(rgb: np.ndarray, strength: float = 0.16) -> np.ndarray:
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx / max(1, w - 1) - 0.5) * 2
    ny = (yy / max(1, h - 1) - 0.5) * 2
    r = np.sqrt(nx * nx + ny * ny) / 1.414
    factor = 1 - np.clip((r - 0.55) / 0.45, 0, 1) ** 1.6 * strength
    return np.clip(rgb.astype(np.float32) * factor[..., None], 0, 255)


# --------------------------------------------------------------------------- #
#  角色：rembg → 白边剥离 → 四色套版
# --------------------------------------------------------------------------- #
_SESSION = None


def rembg_alpha(rgb: np.ndarray) -> np.ndarray:
    global _SESSION
    from rembg import new_session, remove  # 延迟 import：只有角色步骤需要

    if _SESSION is None:
        print("[rembg] loading u2net …")
        _SESSION = new_session("u2net")
    src = Image.fromarray(rgb, "RGB")
    cut = remove(src, session=_SESSION, post_process_mask=True)
    return np.array(cut)[:, :, 3]


def strip_background(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """把生图自带的白色钥匙线连同背景一起剥掉。

    白色描边和背景同色、又和人物连通，rembg 会把它算进前景。这里只保留
    「有颜色或明显暗」的像素，再取外轮廓填洞（内部的眼白/牙齿会被填回），
    最后腐蚀 3px 抹掉残余的抗锯齿白边。
    """
    h, w = alpha.shape
    total = h * w
    mx = rgb.max(axis=2).astype(np.int16)
    mn = rgb.min(axis=2).astype(np.int16)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    coloured = ((alpha > 16) & (((mx - mn) > 18) | (gray < 238))).astype(np.uint8) * 255
    coloured = cv2.medianBlur(coloured, 3)

    contours, _ = cv2.findContours(coloured, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(coloured)
    kept = 0
    for contour in contours:
        if cv2.contourArea(contour) < total * 0.0025:
            continue
        cv2.drawContours(filled, [contour], -1, 255, -1)
        kept += 1
    if kept == 0:
        filled = coloured

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    filled = cv2.erode(filled, kernel, iterations=1)
    filled = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, kernel)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(filled, 8)
    main = np.zeros_like(filled)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= total * 0.0035:
            main[labels == index] = 255
    if not main.any():
        main = filled

    alpha = cv2.GaussianBlur(main, (0, 0), 1.15)
    return alpha


def posterize_character(rgb: np.ndarray, alpha: np.ndarray, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """四色套版：墨底 / 朱砂 / 鎏金 / 宣纸高光。

    直接用 HSV 阈值分色，不做模糊、不做渐变。生图本身的黑色线稿就是黑版，
    分色之后铠甲的鳞片、面部结构、翎羽编织纹都还在。
    """
    h, w = alpha.shape
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)

    red = (((hue <= 12) | (hue >= 168)) & (sat >= 78) & (val >= 38)).astype(bool)
    gold = ((hue >= 13) & (hue <= 50) & (sat >= 92) & (val >= 75)).astype(bool)
    # 皮肤、眼白、牙齿、浅色毛流：宣纸留白，而不是死黑或者金色塑像
    paper = ((sat < 92) & (val >= 158)).astype(bool)
    red &= ~gold
    paper &= ~red

    out = np.empty_like(rgb, dtype=np.float32)
    out[:] = INK

    out[red] = CINNABAR
    deep_red = red & (val < 118)
    out[deep_red] = CINNABAR_DEEP

    out[gold] = GOLD
    deep_gold = gold & (val < 132)
    out[deep_gold] = GOLD_DEEP

    out[paper] = PAPER
    dim_paper = paper & (val < 205)
    out[dim_paper] = PAPER_DIM

    # 黑版线：极暗像素强制回到墨色，保持木刻的硬边
    dark = gray < 56
    out[dark] = INK

    # 生图里本来就有的金色甲胄边线：高饱和金再提亮一档，作为「内部金线」
    bright_gold = gold & (val > 205) & (sat > 120)
    out[bright_gold] = np.array([255, 218, 120], np.float32)

    # 印刷纸纹 + 极轻的套色错位（只作用于颜色块，不动轮廓）
    grain = paper_grain((h, w), seed)
    out = out * (1 + grain[..., None] * 0.035)
    out = np.clip(out, 0, 255)
    return out, alpha


def build_character(raw_name: str, out_name: str, target_height: int, seed: int, crop: int = 0) -> dict:
    started = time.time()
    src = GEN / raw_name
    if not src.exists():
        raise SystemExit(f"缺立绘：{src}")
    rgb = imread_rgb(src)
    if crop > 0:
        h0, w0 = rgb.shape[:2]
        rgb = rgb[crop : h0 - crop, crop : w0 - crop]
    print(f"[char] {raw_name} {rgb.shape[1]}x{rgb.shape[0]} → rembg …")
    alpha = rembg_alpha(rgb)
    alpha = strip_background(rgb, alpha)

    ys, xs = np.where(alpha > 8)
    if len(ys) == 0:
        raise SystemExit(f"rembg 没切出主体：{src}")
    y0, y1 = max(0, ys.min() - 4), min(rgb.shape[0], ys.max() + 5)
    x0, x1 = max(0, xs.min() - 4), min(rgb.shape[1], xs.max() + 5)
    rgb = rgb[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]

    h, w = alpha.shape
    if target_height >= 2000 and w >= h:
        target_width = target_height
        target_height = int(round(h * target_width / w))
    else:
        target_width = int(round(w * target_height / h))

    rgb = resize_rgb(rgb, target_width, target_height)
    alpha = cv2.resize(alpha, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
    # 去掉 1.5px 的半透明灰边，保证外轮廓是硬朗的墨线而不是白贴纸
    alpha = np.clip((alpha.astype(np.float32) - 52) * 1.9, 0, 255)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.55)
    print(f"[char] {out_name} {target_width}x{target_height} → 四色套版 …")
    rgb, alpha = posterize_character(rgb, alpha, seed)
    if out_name == "woodblock_charge.png":
        # 这一姿的裤子是生图的米白大色块，与 1B 的宣纸底同色会“消失”。
        # 只把下半身的宣纸色压成暖灰，保留脸部/袖子留白。
        paper = (
            (np.abs(rgb[..., 0] - 234) < 12)
            & (np.abs(rgb[..., 1] - 224) < 12)
            & (np.abs(rgb[..., 2] - 206) < 14)
        )
        lower = np.zeros_like(paper)
        lower[int(target_height * 0.4) :, :] = True
        rgb[paper & lower] = rgb[paper & lower] * 0.35 + np.array([200, 184, 154], np.float32) * 0.65
    write_rgba(OUT / out_name, rgb, alpha)
    print(f"[char] {out_name} done in {time.time() - started:.0f}s")
    return {
        "file": out_name,
        "width": target_width,
        "height": target_height,
        "source": f"生图网关 {raw_name}",
        "pipeline": "rembg u2net → 白边剥离（外轮廓填洞 + erode 3px）→ HSV 四色套版 #120D14/#C8281E/#F5C242/#EAE0CE",
    }


# --------------------------------------------------------------------------- #
#  2K 特写
# --------------------------------------------------------------------------- #
def build_eyes() -> dict:
    raw = imread_rgb(GEN / "v6_eyes_raw.png")
    h, w = raw.shape[:2]
    # 横条宽高比 2200:356 = 6.18。只取双眼与眉骨，避开上下画框。
    band_h = int(round((w - 24) / (2200 / 356)))
    centre = int(h * 0.475)
    top = max(0, min(h - band_h, centre - band_h // 2))
    band = raw[top : top + band_h, 12 : w - 12]
    band = cv2.resize(band, (2200, 356), interpolation=cv2.INTER_LANCZOS4)
    band = unsharp(band, amount=0.7, sigma=1.0)
    # 版画套色的轻微反差
    band = np.clip((band.astype(np.float32) - 128) * 1.12 + 128, 0, 255)
    band = apply_grain(band, 6201, 0.022)
    write_rgb(OUT / "eyes_closeup_woodblock.png", band)
    return {
        "file": "eyes_closeup_woodblock.png",
        "width": 2200,
        "height": 356,
        "source": "生图网关 v6_eyes_raw.png（1376×768，2K 眼部木刻特写）",
        "pipeline": "按 6.18:1 取双眼带 → LANCZOS 2200×356 → unsharp + 反差 1.12 + 纸纹",
    }


def build_face() -> dict:
    raw_path = GEN / "v7_face_raw.png"
    if not raw_path.exists():
        raw_path = GEN / "v6_face_raw.png"
    raw = imread_rgb(raw_path)
    h, w = raw.shape[:2]
    side = min(h, w)
    y0 = (h - side) // 2
    x0 = (w - side) // 2
    face = raw[y0 : y0 + side, x0 : x0 + side]
    face = cv2.resize(face, (2048, 2048), interpolation=cv2.INTER_LANCZOS4)
    face = unsharp(face, amount=0.6, sigma=1.2)
    face = np.clip((face.astype(np.float32) - 128) * 1.08 + 128, 0, 255)
    face = apply_grain(face, 6202, 0.025)
    face = vignette(face, 0.14)
    write_rgb(OUT / "face_glare_woodblock.png", face)
    return {
        "file": "face_glare_woodblock.png",
        "width": 2048,
        "height": 2048,
        "source": f"生图网关 {raw_path.name}（2K 怒颜木刻，双眼居中）",
        "pipeline": "中心方形裁切 → LANCZOS 2048×2048 → unsharp + 反差 1.08 + 纸纹 + 暗角",
    }


def build_halberds() -> dict:
    raw = imread_rgb(GEN / "v7_halberds_raw.png")
    h, w = raw.shape[:2]
    raw = raw[14 : h - 14, 14 : w - 14]
    vec = vectorize(raw, "v7_halberds", 1400, speckle=5, layer=20, length=3.5)
    vec = np.clip(vec.astype(np.float32) * 0.99 + PAPER * 0.01, 0, 255)
    vec = apply_grain(vec, 6401, 0.028)
    vec = vignette(vec, 0.16)
    write_rgb(OUT / "halberds_woodblock.png", vec)
    h, w = vec.shape[:2]
    return {
        "file": "halberds_woodblock.png",
        "width": w,
        "height": h,
        "source": "生图网关 v7_halberds_raw.png（漫天朱砂战旗与银白长戈）",
        "pipeline": "裁纸边 → LANCZOS 2K → vtracer 多层 SVG → resvg 栅格 → 纸纹 + 暗角",
    }


def build_mountain() -> dict:
    raw_path = GEN / "v7_mountain_wide_raw.png"
    if not raw_path.exists():
        raw_path = GEN / "v7_mountain_raw.png"
    raw = imread_rgb(raw_path)
    h, w = raw.shape[:2]
    raw = raw[10 : h - 10, 10 : w - 10]
    vec = vectorize(raw, "v7_mountain_wide", 2048, speckle=6, layer=22, length=4.0)
    vec = np.clip(vec.astype(np.float32) * 0.97 + PAPER * 0.015, 0, 255)
    vec = apply_grain(vec, 6402, 0.03)
    vec = vignette(vec, 0.2)
    write_rgb(OUT / "five_finger_mountain_woodblock.png", vec)
    h, w = vec.shape[:2]
    return {
        "file": "five_finger_mountain_woodblock.png",
        "width": w,
        "height": h,
        "source": f"生图网关 {raw_path.name}（五指山巨岩 + 金色梵文 + 暖金裂谷）",
        "pipeline": "裁纸边 → LANCZOS 2K → vtracer SVG → resvg 栅格 → 纸纹 + 暗角",
    }


# --------------------------------------------------------------------------- #
#  建筑 / 天兵：vtracer → resvg
# --------------------------------------------------------------------------- #
def vectorize(rgb: np.ndarray, stem: str, target_width: int, *, speckle: int, layer: int, length: float) -> np.ndarray:
    h, w = rgb.shape[:2]
    target_height = int(round(h * target_width / w))
    up = resize_rgb(rgb, target_width, target_height)
    up = unsharp(up, amount=0.45, sigma=1.1)
    src = GEN / f"{stem}_up.png"
    svg = GEN / f"{stem}.svg"
    png = GEN / f"{stem}_vec.png"
    write_rgb(src, up)

    import vtracer  # 延迟 import

    started = time.time()
    vtracer.convert_image_to_svg_py(
        str(src),
        str(svg),
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=speckle,
        color_precision=6,
        layer_difference=layer,
        corner_threshold=60,
        length_threshold=length,
        max_iterations=10,
        splice_threshold=45,
        path_precision=3,
    )
    proc = subprocess.run(
        ["node", str(RASTERIZE), str(svg), str(png), str(target_width), "#FFFFFF"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0 or not png.exists():
        raise SystemExit(f"resvg 失败：{proc.stderr[-800:]}")
    print(f"[vtracer] {stem} {target_width}x{target_height} {time.time() - started:.0f}s svg={svg.stat().st_size / 1024:.0f}KB")
    return imread_rgb(png)


def build_gate() -> dict:
    raw = imread_rgb(GEN / "v6_gate_raw.png")
    vec = vectorize(raw, "v6_gate", 1400, speckle=6, layer=22, length=4.0)
    vec = np.clip(vec.astype(np.float32) * 0.985 + PAPER * 0.015, 0, 255)
    vec = apply_grain(vec, 6301, 0.03)
    vec = vignette(vec, 0.18)
    write_rgb(OUT / "gate_woodblock.png", vec)
    h, w = vec.shape[:2]
    return {
        "file": "gate_woodblock.png",
        "width": w,
        "height": h,
        "source": "生图网关 v6_gate_raw.png（南天门盘龙阙楼）",
        "pipeline": "LANCZOS 2K → vtracer 多层 SVG → resvg 栅格 → 纸纹 + 暗角",
    }


def build_palace() -> dict:
    raw = imread_rgb(GEN / "v6_palace_raw.png")
    # 去掉画面四周的印刷黑框
    h, w = raw.shape[:2]
    raw = raw[14 : h - 14, 12 : w - 12]
    vec = vectorize(raw, "v6_palace", 1400, speckle=6, layer=22, length=4.0)
    vec = np.clip(vec.astype(np.float32) * 0.985 + PAPER * 0.015, 0, 255)
    vec = apply_grain(vec, 6302, 0.03)
    vec = vignette(vec, 0.18)
    write_rgb(OUT / "palace_woodblock.png", vec)
    h, w = vec.shape[:2]
    return {
        "file": "palace_woodblock.png",
        "width": w,
        "height": h,
        "source": "生图网关 v6_palace_raw.png（凌霄殿重檐飞阁 + 满月）",
        "pipeline": "去印刷框 → LANCZOS 2K → vtracer 多层 SVG → resvg 栅格 → 纸纹 + 暗角",
    }


def build_army() -> dict:
    raw = imread_rgb(GEN / "v6_army_raw.png")
    h0, w0 = raw.shape[:2]
    # 生图自带 1px 黑框 + 白边，先裁掉再进 vtracer，否则黑框会被当成天兵轮廓
    raw = raw[18 : h0 - 18, 18 : w0 - 18]
    vec = vectorize(raw, "v6_army", 2400, speckle=2, layer=14, length=2.0)
    rgb = vec.astype(np.float32)

    # 生图的白底其实是被纸纹染过的米白（~232,222,202），不能用「接近白」做阈值。
    # 用亮度 + 饱和度联合抠：墨线/骑甲靠暗度，朱砂旗/金线靠饱和度，米白背景两端都不沾。
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    hsv_raw = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    sat = hsv_raw[..., 1] / 255
    val = hsv_raw[..., 2] / 255
    alpha_dark = np.clip((0.68 - gray) / 0.17, 0, 1)
    alpha_colour = np.clip((sat - 0.24) / 0.3, 0, 1)
    alpha = np.maximum(alpha_dark, alpha_colour)
    alpha[(val > 0.86) & (sat < 0.24)] = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    alpha = cv2.morphologyEx((alpha * 255).astype(np.uint8), cv2.MORPH_OPEN, kernel).astype(np.float32) / 255
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)

    # 以米白纸底做 unpremultiply，避免边缘留一圈米色
    bg = np.array([232, 222, 202], np.float32)
    safe = np.maximum(alpha, 0.08)[..., None]
    rgb = np.clip((rgb - (1 - safe) * bg) / safe, 0, 255)

    hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = ((hue <= 14) | (hue >= 168)) & (sat >= 70)
    gold = (hue >= 15) & (hue <= 55) & (sat >= 55) & (val >= 80)

    out = np.empty_like(rgb)
    out[:] = INK
    out[red] = CINNABAR
    out[gold] = GOLD
    out[(val < 70)] = INK

    ys, xs = np.where(alpha > 0.25)
    if len(ys) == 0:
        raise SystemExit("army 抠底失败")
    y0, y1 = max(0, ys.min() - 8), min(rgb.shape[0], ys.max() + 9)
    x0, x1 = max(0, xs.min() - 8), min(rgb.shape[1], xs.max() + 9)
    out = out[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)
    out = apply_grain(out, 6303, 0.025)
    write_rgba(OUT / "army_silhouette.png", out, alpha * 255)
    h, w = out.shape[:2]
    return {
        "file": "army_silhouette.png",
        "width": w,
        "height": h,
        "source": "生图网关 v6_army_raw.png（十万天兵压境，白底）",
        "pipeline": "LANCZOS 2400 → vtracer SVG → resvg → 白底软抠 + 白边去污染 → 墨/朱砂/金套色",
    }


# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--only",
        default="characters,prints,buildings,v7extras",
        help="逗号分隔：characters / prints / buildings / v7extras / v7face",
    )
    args = parser.parse_args()
    picked = {item.strip() for item in args.only.split(",") if item.strip()}
    OUT.mkdir(parents=True, exist_ok=True)
    GEN.mkdir(parents=True, exist_ok=True)

    manifest: dict = {
        "version": "v7",
        "pipeline": "image-gateway 2K → rembg / OpenCV 四色套版 → vtracer + resvg",
        "palette": {
            "ink": "#120D14",
            "cinnabar": "#C8281E",
            "gold": "#F5C242",
            "washi": "#EAE0CE",
        },
        "assets": {},
    }

    started = time.time()
    try:
        if "characters" in picked:
            for raw, out_name, height, seed, crop in CHARACTERS:
                info = build_character(raw, out_name, height, seed, crop)
                manifest["assets"][out_name.replace(".png", "")] = info
        if "prints" in picked:
            manifest["assets"]["eyes_closeup_woodblock"] = build_eyes()
            manifest["assets"]["face_glare_woodblock"] = build_face()
        if "buildings" in picked:
            manifest["assets"]["gate_woodblock"] = build_gate()
            manifest["assets"]["palace_woodblock"] = build_palace()
            manifest["assets"]["army_silhouette"] = build_army()
        if "v7extras" in picked:
            for raw, out_name, height, seed, crop in V7_CHARACTERS:
                if (GEN / raw).exists():
                    info = build_character(raw, out_name, height, seed, crop)
                    manifest["assets"][out_name.replace(".png", "")] = info
            if (GEN / "v7_halberds_raw.png").exists():
                manifest["assets"]["halberds_woodblock"] = build_halberds()
            if (GEN / "v7_mountain_wide_raw.png").exists():
                manifest["assets"]["five_finger_mountain_woodblock"] = build_mountain()
            elif (OUT / "five_finger_mountain_woodblock.png").exists():
                manifest["assets"]["five_finger_mountain_woodblock"] = {
                    "file": "five_finger_mountain_woodblock.png",
                    "width": 2048,
                    "height": 1152,
                    "source": "离线兜底：已有 2K 木刻纹理 + PIL 巨岩/梵文/裂谷（生图网关 429 RESOURCE_EXHAUSTED）",
                    "pipeline": "scripts/build_mountain_fallback.py；网关恢复后优先用 v7_mountain_wide_raw.png 重烘",
                }
        if "v7face" in picked:
            manifest["assets"]["face_glare_woodblock"] = build_face()
    except SystemExit as exc:
        print(exc)
        return 1

    for item in manifest["assets"].values():
        path = OUT / item["file"]
        item["bytes"] = path.stat().st_size
        item["sha"] = digest(path)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(manifest['assets'])} assets → {OUT.relative_to(ROOT)}  ({time.time() - started:.0f}s)")
    for item in manifest["assets"].values():
        print(f"  {item['file']:<34} {item['width']}x{item['height']}  {item['bytes'] / 1024:.0f}KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
