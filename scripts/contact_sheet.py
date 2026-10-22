"""抽取成片的 16 个时间点拼接触表，用于镜头之间的自检（AGENTS.md §9.5）。

用法： python scripts/contact_sheet.py out/senbon_v3_mvp.mp4 out/senbon_v3_contact_sheet.png
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

# 每个镜头至少 4 个采样点，覆盖起手、中段、冲击与收尾
TIMES = [0.3, 0.7, 1.1, 1.6, 2.2, 2.7, 3.0, 3.4, 3.9, 4.5, 5.1, 5.8, 6.5, 7.0, 7.4, 8.0, 8.8, 9.3, 9.7, 9.95]
COLS = 5
CELL_W = 384
CELL_H = 216


def grab(video: Path, seconds: float, out: Path) -> None:
    subprocess.run(
        [
            str(FFMPEG),
            "-y",
            "-v",
            "error",
            "-ss",
            f"{seconds:.3f}",
            "-i",
            str(video),
            "-frames:v",
            "1",
            str(out),
        ],
        check=True,
    )


def main() -> None:
    video = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "out" / "senbon_v3_mvp.mp4"
    target = (
        Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "out" / "senbon_v3_contact_sheet.png"
    )
    tmp = ROOT / "out" / "_sheet_tmp"
    tmp.mkdir(parents=True, exist_ok=True)

    rows = (len(TIMES) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL_W, rows * CELL_H), (11, 9, 10))
    draw = ImageDraw.Draw(sheet)

    for index, seconds in enumerate(TIMES):
        frame = tmp / f"t{index:02d}.png"
        grab(video, seconds, frame)
        image = Image.open(frame).convert("RGB").resize((CELL_W, CELL_H), Image.LANCZOS)
        x = (index % COLS) * CELL_W
        y = (index // COLS) * CELL_H
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + CELL_W - 1, y + CELL_H - 1], outline=(60, 52, 54))
        draw.text((x + 8, y + 6), f"{seconds:.2f}s / f{round(seconds * 30)}", fill=(252, 201, 52))

    sheet.save(target)
    print(f"wrote {target}  {sheet.size[0]}x{sheet.size[1]}  ({len(TIMES)} frames)")


if __name__ == "__main__":
    main()
