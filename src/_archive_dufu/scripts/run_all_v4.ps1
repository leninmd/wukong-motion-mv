# run_all_v4.ps1 — V4 一键重建：音轨 → 逐帧渲染 → 编码 → 质检 → 审片大图
# 用法： powershell -ExecutionPolicy Bypass -File .\run_all_v4.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "[1/4] 生成音轨（Karplus-Strong 古琴 + 堂鼓 + 毫秒级音画同步）" -ForegroundColor Cyan
python audio/build_audio_v4.py

Write-Host "[2/4] 逐帧渲染（5280 帧 @ 60fps，约 15 分钟）" -ForegroundColor Cyan
python render/render4.py frames --out output/v4_work/frames --fps 60 --quality 95

Write-Host "[3/4] 编码 + 合成成片" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File .\encode_v4.ps1

Write-Host "[4/4] 质检（22 项：17 工程 + 5 美学）" -ForegroundColor Cyan
python render/qa_probe_v4.py

Write-Host "完成： output/v4_release/dufu_v4_master_1080p60.mp4" -ForegroundColor Green
