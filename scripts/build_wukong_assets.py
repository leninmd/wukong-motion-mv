"""V5 造型资产管线 —— 真实参考帧 + AI 立绘 → 木刻版画 / 透明剪影。

背景（为什么存在这个脚本）
--------------------------
V4 的孙悟空是手写 SVG 多边形拼出来的，放大看就是"折纸积木人"。V5 起，
角色不再由代码画：本脚本把两类真实造型素材离线烘焙成透明 PNG，运行期
`src/` 只消费 `public/wukong_assets/` 的成品图。

  1. **参考片帧**（`大雨还在下…mp4` 的 00:09–00:19 段）：取六小龄童的咬牙怒视
     特写与眼部，做浮世绘木刻套色处理 → `face_glare_woodblock.png` /
     `eyes_closeup_woodblock.png`。五官来自真实影像，不是多边形。
  2. **立绘**（生图网关产出，纯白背景的平涂插画）：抠底 + 填洞 + 平滑 → 纯黑
     透明剪影 → `silhouette_*.png`。剪影内部恒为 #120D14，无描边、无荧光线。

处理流程（木刻套色）
--------------------
放大 → 双边/均值漂移扁平化 → 5 阶色调分层（带网点抖动）→ 朱砂/鎏金分色 →
黑版（Sobel 边缘 + 黑帽算子抽细线）→ 纸纹颗粒。输出 sRGB PNG。

用法：
  python scripts/build_wukong_assets.py
  python scripts/build_wukong_assets.py --skip-video   # 只重建剪影
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "wukong_assets"
FRAME_DIR = ROOT / "out" / "ref" / "frames"
GEN_DIR = ROOT / "out" / "gen"
FFMPEG = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
DEFAULT_VIDEO = Path.home() / "Downloads" / "大雨还在下十方神佛在怒骂_哔哩哔哩_bilibili.mp4"

INK = np.array([22, 15, 20], np.float32)        # #140F18
CINNABAR = np.array([34, 44, 198], np.float32)  # #C62C22
GOLD = np.array([56, 168, 232], np.float32)     # #E8A838
PAPER = np.array([220, 236, 245], np.float32)   # #F5ECD8


# --------------------------------------------------------------------------- #
#  源帧
# --------------------------------------------------------------------------- #
def ensure_frames(video: Path) -> None:
    FRAME_DIR.mkdir(parents=True, exist_ok=True)
    if len(list(FRAME_DIR.glob("f*.png"))) >= 300:
        return
    if not video.exists():
        raise SystemExit(f"参考片不存在：{video}")
    print(f"[frames] {video.name} 09–19s → {FRAME_DIR.relative_to(ROOT)}")
    subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y",
         "-ss", "9", "-t", "10", "-i", str(video), "-vsync", "0",
         str(FRAME_DIR / "f%03d.png")],
        check=True,
    )


def frame(index: int) -> np.ndarray:
    path = FRAME_DIR / f"f{index:03d}.png"
    img = cv2.imread(str(path))
    if img is None:
        raise SystemExit(f"缺帧：{path}")
    return img


# --------------------------------------------------------------------------- #
#  木刻套色
# --------------------------------------------------------------------------- #
def halftone(shape: tuple[int, int], cell: float, angle: float = 0.45) -> np.ndarray:
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xx * np.cos(angle) + yy * np.sin(angle)
    v = -xx * np.sin(angle) + yy * np.cos(angle)
    return np.hypot((u % cell) / cell - 0.5, (v % cell) / cell - 0.5) * 2


def woodblock(img: np.ndarray, scale: float = 2.4, levels: int = 5, seed: int = 3, punch: float = 1.0) -> np.ndarray:
    h0, w0 = img.shape[:2]
    w, h = int(w0 * scale), int(h0 * scale)
    big = cv2.resize(img, (w, h), interpolation=cv2.INTER_LANCZOS4)
    big = cv2.bilateralFilter(big, 7, 32, 32)
    flat = cv2.pyrMeanShiftFiltering(big, 6, 18, maxLevel=1)
    sharp = cv2.addWeighted(flat, 1.7, cv2.GaussianBlur(flat, (0, 0), 1.8), -0.7, 0)

    lab = cv2.cvtColor(sharp, cv2.COLOR_BGR2LAB)
    lum = lab[..., 0].astype(np.float32) * (100.0 / 255.0)
    lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
    t = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1)
    # punch>1：把中间调推向两端，让黑版更像刻出来的
    t = np.clip(0.5 + (t - 0.5) * punch, 0, 1)

    hsv = cv2.cvtColor(flat, cv2.COLOR_BGR2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0], hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    red = ((hue < 15) | (hue > 166)) * np.clip((sat - 0.38) / 0.25, 0, 1)
    gold = (hue >= 12) * (hue < 42) * np.clip((sat - 0.20) / 0.3, 0, 1) * np.clip((val - 0.25) / 0.3, 0, 1)
    gold = gold * (1 - red)

    band = np.clip(np.floor(t * (levels - 1) + 0.5) / (levels - 1), 0, 1)
    dots = halftone((h, w), max(3.0, 5.0 * scale))
    frac = t * (levels - 1) - np.floor(t * (levels - 1))
    band = np.where(dots < frac * 0.9, np.clip(np.floor(t * (levels - 1) + 1) / (levels - 1), 0, 1), band)

    tone = np.full((h, w, 3), PAPER, np.float32)
    tone = tone * (1 - red[..., None]) + CINNABAR * red[..., None]
    tone = tone * (1 - gold[..., None] * 0.9) + GOLD * (gold[..., None] * 0.9)

    dark = (1 - band)[..., None]
    out = PAPER * (1 - dark ** 1.15) + tone * (dark ** 1.15)
    deep = np.clip((0.58 - band) / 0.58, 0, 1)[..., None] ** 1.5
    out = out * (1 - deep) + INK * deep

    gray = cv2.cvtColor(sharp, cv2.COLOR_BGR2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.GaussianBlur(np.hypot(gx, gy), (0, 0), 0.8)
    edge = np.clip((mag - 26) / 40, 0, 1)
    k = max(5, (min(w, h) // 45) | 1)
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT,
                                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    line = np.clip((blackhat.astype(np.float32) - 8) / 16, 0, 1)
    key = np.maximum(np.clip(edge * 0.8 + line * 0.9, 0, 1),
                     np.clip((0.10 - band) / 0.10, 0, 1) * 0.95)
    out = out * (1 - key[..., None]) + INK * key[..., None]

    rng = np.random.default_rng(seed)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.0)
    out = np.clip(out * (1 + grain[..., None] * 0.05), 0, 255)
    return out.astype(np.uint8)


# --------------------------------------------------------------------------- #
#  剪影
# --------------------------------------------------------------------------- #
def eye_band(img: np.ndarray, out_w: int = 2200, out_h: int = 356) -> np.ndarray:
    """眼部横条专用：三色版（墨 / 朱砂 / 宣纸），比五阶套色更硬。

    横条的宽高比约 6.2:1，所以先在放大图上做整幅三色调，再按眼睛的位置切一条
    316px 高的带子——不能直接把整张脸压进横条，那样五官会被拉扁。
    """
    h, w = img.shape[:2]
    big = cv2.resize(img, (w * 4, h * 4), interpolation=cv2.INTER_LANCZOS4)
    big = cv2.bilateralFilter(big, 7, 40, 40)

    lab = cv2.cvtColor(big, cv2.COLOR_BGR2LAB)
    tone = cv2.createCLAHE(clipLimit=3.2, tileGridSize=(8, 8)).apply(lab[..., 0])
    lo, hi = np.percentile(tone, 2), np.percentile(tone, 98)
    t = np.clip((tone - lo) / max(1.0, hi - lo), 0, 1).astype(np.float32)

    gx = cv2.Sobel(tone, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(tone, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.GaussianBlur(np.hypot(gx, gy), (0, 0), 1.0)
    edge = np.clip((mag - 30) / 60, 0, 1)
    k = max(7, (min(big.shape[:2]) // 40) | 1)
    blackhat = cv2.morphologyEx(tone, cv2.MORPH_BLACKHAT,
                                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    line = np.clip((blackhat.astype(np.float32) - 10) / 20, 0, 1)
    key = np.clip(edge * 0.9 + line, 0, 1)

    out = np.full(big.shape, PAPER, np.float32)
    mid = np.clip((0.62 - t) / (0.62 * 0.55), 0, 1)[..., None]
    out = out * (1 - mid * 0.55) + CINNABAR * (mid * 0.55)
    deep = np.clip((0.62 * 0.62 - t) / (0.62 * 0.62), 0, 1)[..., None]
    out = out * (1 - deep) + INK * deep
    out = out * (1 - key[..., None]) + INK * key[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)

    # 按横条比例切：以眼睛所在高度（约 45%）为中心
    band_h = int(round(out.shape[1] / (out_w / out_h)))
    centre = int(out.shape[0] * 0.375)
    top = max(0, min(out.shape[0] - band_h, centre - band_h // 2))
    band = out[top:top + band_h, :]
    return cv2.resize(band, (out_w, out_h), interpolation=cv2.INTER_AREA)


def alpha_from_white(img: np.ndarray, thr: int = 232) -> np.ndarray:
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.int16)
    mask = ((rgb.min(axis=2)) < thr).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(mask)
    area_total = mask.shape[0] * mask.shape[1]
    for contour in cnts:
        area = cv2.contourArea(contour)
        if area < area_total * 0.004:      # 甩掉飞白速度线、泥点
            continue
        cv2.drawContours(filled, [contour], -1, 255, -1)
    return filled


def silhouette(src: Path, dst: Path, target_h: int = 1500, smooth: float = 1.6) -> dict:
    img = cv2.imread(str(src))
    if img is None:
        raise SystemExit(f"读不到立绘：{src}")
    alpha = alpha_from_white(img)
    ys, xs = np.where(alpha > 0)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    alpha = alpha[y0:y1, x0:x1]
    rgb = img[y0:y1, x0:x1]
    h, w = alpha.shape
    scale = target_h / h
    alpha = cv2.resize(alpha, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    alpha = cv2.GaussianBlur(alpha, (0, 0), smooth * scale * 0.5)
    alpha = (alpha > 127).astype(np.uint8) * 255
    h, w = alpha.shape[:2]
    bgra = np.zeros((h, w, 4), np.uint8)
    bgra[..., 0], bgra[..., 1], bgra[..., 2], bgra[..., 3] = INK[0], INK[1], INK[2], alpha
    cv2.imwrite(str(dst), bgra)
    # 同时存一份平涂彩稿：给需要"彩色小像"的地方用（不是剪影）
    colour = cv2.resize(rgb, (w, h), interpolation=cv2.INTER_LANCZOS4)
    flat = cv2.pyrMeanShiftFiltering(colour, 5, 24, maxLevel=1)
    flat = np.dstack([flat, alpha])
    flat_path = dst.with_name(dst.stem.replace("silhouette_", "colour_") + ".png")
    cv2.imwrite(str(flat_path), flat)
    return {"w": w, "h": h, "solidity": round(float((alpha > 0).mean()), 4)}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path, default=DEFAULT_VIDEO)
    parser.add_argument("--skip-video", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict = {"version": "v5", "assets": {}}

    if not args.skip_video:
        ensure_frames(args.video)

        # 面部：00:18.0 咬牙怒视（两个版本里 f271 双眼都睁开、牙关咬紧）
        face = frame(271)[0:418, 150:616]
        face_out = woodblock(face, scale=2.7, seed=11, punch=1.34)
        face_out = cv2.resize(face_out, (1280, 1200), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(OUT_DIR / "face_glare_woodblock.png"), face_out)
        manifest["assets"]["face_glare_woodblock"] = {
            "file": "face_glare_woodblock.png",
            "source": "ref f271 (00:18.0)",
            "size": [1280, 1200],
            "note": "咬牙怒视特写，五阶套色 + 黑版线",
        }

        # 眼部横带：Sub2A 的 2200×356 横条，单独走一套"三色版"（比五阶套色狠）
        eyes = frame(271)[92:330, 188:676]
        eyes_out = eye_band(eyes)
        cv2.imwrite(str(OUT_DIR / "eyes_closeup_woodblock.png"), eyes_out)
        manifest["assets"]["eyes_closeup_woodblock"] = {
            "file": "eyes_closeup_woodblock.png",
            "source": "ref f271 (00:18.0) eye band",
            "size": [int(eyes_out.shape[1]), int(eyes_out.shape[0])],
            "note": "CLAHE + 三色调（墨/朱砂/宣纸）+ 黑帽细线，专供横条",
        }

        # 五指山下：真实的后脑与红箍（00:14.5），压成版画
        trap = frame(166)[60:470, 120:760]
        trap_out = woodblock(trap, scale=2.2, seed=37)
        trap_out = cv2.resize(trap_out, (1400, 900), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(OUT_DIR / "trapped_print.png"), trap_out)
        manifest["assets"]["trapped_print"] = {
            "file": "trapped_print.png",
            "source": "ref f166 (00:14.5)",
            "size": [1400, 900],
        }
        print("[woodblock] face / eyes / trapped")

    for src_name, dst_name in [
        ("hero_spin_raw.png", "silhouette_spin_staff.png"),
        ("hero_slash_raw.png", "silhouette_side_slash.png"),
        ("hero_trapped_raw.png", "silhouette_trapped.png"),
        ("hero_raise_raw.png", "silhouette_raise_staff.png"),
    ]:
        src = GEN_DIR / src_name
        if not src.exists():
            print(f"[skip] 缺立绘 {src.relative_to(ROOT)}")
            continue
        info = silhouette(src, OUT_DIR / dst_name)
        manifest["assets"][dst_name.replace(".png", "")] = {
            "file": dst_name, "source": f"gen/{src_name}", **info}
        print(f"[silhouette] {dst_name} {info['w']}x{info['h']}")

    for item in manifest["assets"].values():
        path = OUT_DIR / item["file"]
        item["bytes"] = path.stat().st_size
        item["sha"] = digest(path)

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(manifest['assets'])} assets → {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
