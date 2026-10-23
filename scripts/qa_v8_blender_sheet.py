"""V8-Blender 交付自检：七帧回抽 + 4×2 接触表。

用法：python scripts/qa_v8_blender_sheet.py
输出：out/v8_blender_contact_sheet.png（2560×1440，7 格 + 1 格图例）
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TIMES = ["0.5", "1.8", "2.8", "4.0", "6.5", "8.0", "9.2"]
LABELS = ["0.5s 1A", "1.8s 1B 题笺", "2.8s 2A 眼条", "4.0s 2B 崩裂",
          "6.5s 3B 铁索", "8.0s 4A 悬签", "9.2s 4B 跳切"]

TW, TH = 640, 360
COLS, ROWS = 4, 2
sheet = Image.new("RGB", (TW * COLS, TH * ROWS), (8, 6, 7))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 26)
except Exception:
    font = ImageFont.load_default()

for index, (t, label) in enumerate(zip(TIMES, LABELS)):
    path = ROOT / "out" / f"v8_blender_mp4_{t}.png"
    if not path.exists():
        print(f"missing {path}")
        continue
    img = Image.open(path).convert("RGB").resize((TW, TH), Image.LANCZOS)
    x = (index % COLS) * TW
    y = (index // COLS) * TH
    sheet.paste(img, (x, y))
    draw.rectangle([x, y, x + TW - 1, y + TH - 1], outline=(245, 194, 66), width=2)
    draw.rectangle([x + 8, y + TH - 46, x + 8 + 17 * len(label), y + TH - 8], fill=(8, 6, 7))
    draw.text((x + 14, y + TH - 42), label, fill=(245, 194, 66), font=font)

# 第 8 格：工程信息
x = (len(TIMES) % COLS) * TW
y = (len(TIMES) // COLS) * TH
draw.rectangle([x, y, x + TW - 1, y + TH - 1], outline=(158, 31, 24), width=2)
lines = [
    "senbon_v8_blender.mp4",
    "1920×1080 / 30fps / 300f / 10.0s",
    "Blender 5.2.3 EEVEE + Freestyle",
    "三色木刻 #120D14/#9E1F18/#F8DEC8/#F5C242",
    "4 shots: 45/55/75/65 frames",
]
for i, line in enumerate(lines):
    draw.text((x + 28, y + 60 + i * 44), line, fill=(236, 222, 200), font=font)

out = ROOT / "out" / "v8_blender_contact_sheet.png"
sheet.save(out)
print(f"contact sheet -> {out} ({out.stat().st_size/1024:.0f} KB)")
