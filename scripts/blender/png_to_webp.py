"""把 Blender 直出的 PNG RGBA 序列转成无损 WebP 并同步到 public/。

为什么要转：透明层只能走逐帧位图（见 public/blender_renders/README.md），
而 1080p RGBA PNG 约 1–2.3 MB/帧，120 帧接近 200 MB。无损 WebP 像素完全一致，
体积约 1/3，Remotion 的 `<Img />` 直接可读。

用法：
  python scripts/blender/png_to_webp.py out/blender_frames/shot1 public/blender_renders/shot1_frames s1
  python scripts/blender/png_to_webp.py out/blender_frames/shot3 public/blender_renders/shot3_frames s3

只复制前缀匹配的帧；源 PNG 保留在 out/（gitignore），不删除。
"""

import shutil
import sys
from pathlib import Path

from PIL import Image


def convert(src_dir: Path, dst_dir: Path, prefix: str, method: int = 6) -> None:
    frames = sorted(src_dir.glob(f"{prefix}_*.png"))
    if not frames:
        raise SystemExit(f"no {prefix}_*.png in {src_dir}")
    dst_dir.mkdir(parents=True, exist_ok=True)
    total_in = total_out = 0
    for png in frames:
        webp = dst_dir / f"{png.stem}.webp"
        Image.open(png).save(webp, "WEBP", lossless=True, method=method)
        total_in += png.stat().st_size
        total_out += webp.stat().st_size
    print(f"{prefix}: {len(frames)} frames  {total_in/1024/1024:.1f} MB -> "
          f"{total_out/1024/1024:.1f} MB  → {dst_dir}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    convert(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
