"""按 assets.manifest.json 生成 AI 美术板。

只做四件事，刻意保持"笨"：
  1. 读 manifest（唯一事实来源）；
  2. 拼一段受限提示词，调一次本机 Antigravity CLI；
  3. 轮询目标文件是否落盘（异步子 agent 可能晚于 CLI 返回）；
  4. 用 Pillow 校验尺寸/透明度，失败只重试一次。

用法：
  python scripts/gen_plates.py --only bg_court_wide
  python scripts/gen_plates.py --all
  python scripts/gen_plates.py --list
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets.manifest.json"
NODE_BRIDGE = Path(__file__).resolve().parent / "agy_image.mjs"
WAIT_SECONDS = 240

PROMPT_TEMPLATE = """只做一件事，不要做别的：
调用 image-generator 生成 1 张图并保存到 `{target}`。
img prompt（原样传给 image-generator，不要改写风格词）：
{prompt}

要求：
- 必须真的把文件写到上面这个绝对路径，文件名不要改；
- 写完后用 shell 确认文件存在，把绝对路径和像素尺寸打印出来；
- 如果第一次调用失败，最多再试一次；
- 不要修改仓库里任何其它文件，不要运行 git 命令。"""


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def find_asset(doc: dict, name: str) -> dict | None:
    for asset in doc["assets"]:
        if asset["id"] == name:
            return asset
    return None


def normalize(path: Path, asset: dict) -> str:
    """把生成结果规整为 1920x1080 PNG（生成器固定返回 1376x768 JPEG）。"""
    with Image.open(path) as im:
        raw = f"{im.format} {im.size[0]}x{im.size[1]} {im.mode}"
        work = im.convert("RGBA" if asset.get("alpha") else "RGB")
    w, h = work.size
    want = asset["size"]
    ratio = want[0] / want[1]
    if asset.get("alpha"):
        canvas = Image.new("RGBA", (want[0], want[1]), (0, 0, 0, 0))
        work.thumbnail((want[0], want[1]), Image.LANCZOS)
        canvas.paste(work, ((want[0] - work.size[0]) // 2, (want[1] - work.size[1]) // 2))
        canvas.save(path, "PNG", optimize=True)
    else:
        if w / h > ratio:
            nw = int(h * ratio)
            work = work.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
        else:
            nh = int(w / ratio)
            work = work.crop((0, (h - nh) // 2, w, (h + nh) // 2))
        work.resize((want[0], want[1]), Image.LANCZOS).save(path, "PNG", optimize=True)
    return f"{raw} -> PNG {want[0]}x{want[1]}"


def verify(path: Path, asset: dict) -> tuple[bool, str]:
    if not path.exists():
        return False, "文件不存在"
    try:
        with Image.open(path) as im:
            w, h = im.size
            mode = im.mode
    except Exception as exc:  # noqa: BLE001
        return False, f"打不开：{exc}"
    want = asset["size"]
    if w < want[0] or h < want[1]:
        return False, f"尺寸不足 {w}x{h} < {want[0]}x{want[1]}"
    if asset.get("alpha") and mode not in ("RGBA", "LA"):
        return False, f"需要 alpha，实际 mode={mode}"
    return True, f"{w}x{h} {mode}"


def generate(asset: dict, force: bool) -> bool:
    target = ROOT / asset["file"]
    if target.exists() and not force:
        ok, info = verify(target, asset)
        print(f"[skip] {asset['id']} 已存在（{info}）")
        return ok

    target.parent.mkdir(parents=True, exist_ok=True)
    prompt = PROMPT_TEMPLATE.format(target=str(target), prompt=asset["prompt"])

    for attempt in (1, 2):
        print(f"[gen ] {asset['id']} 第 {attempt} 次 → {target.relative_to(ROOT)}")
        started = time.time()
        try:
            proc = subprocess.run(
                ["node", str(NODE_BRIDGE), prompt, str(target), "420000"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=600,
            )
            for line in (proc.stdout or "").strip().splitlines()[-3:]:
                print("       ", line[:160])
        except subprocess.TimeoutExpired:
            print("        桥接超时")

        if target.exists() and target.stat().st_size > 1024:
            try:
                note = normalize(target, asset)
                print("        ", note)
            except Exception as exc:  # noqa: BLE001
                print("        规整失败：", exc)

        ok, info = verify(target, asset)
        print(f"       {'OK ' if ok else 'ERR'} {info}  ({time.time() - started:.0f}s)")
        if ok:
            return True

        # 桥接可能在会话存活期生成到别处；再等一会儿
        deadline = time.time() + WAIT_SECONDS
        while time.time() < deadline:
            if target.exists() and target.stat().st_size > 1024:
                break
            time.sleep(5)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    doc = load_manifest()
    assets = doc["assets"]
    if args.list:
        for asset in assets:
            present = (ROOT / asset["file"]).exists()
            print(f"{'✓' if present else ' '} {asset['id']:<16} {asset['type']:<10} {asset['file']}")
        return 0

    if not (args.all or args.only):
        parser.print_help()
        return 2

    budget = int(doc.get("budget", {}).get("maxGenerations", 8))
    picked = assets if args.all else [a for a in assets if a["id"] in args.only]
    if len(picked) > budget:
        print(f"超过预算 maxGenerations={budget}，拒绝执行")
        return 2

    failed: list[str] = []
    for asset in picked:
        if not generate(asset, args.force):
            failed.append(asset["id"])

    print()
    if failed:
        print(f"失败：{', '.join(failed)}")
        return 1
    print("全部就绪")
    return 0


if __name__ == "__main__":
    sys.exit(main())
