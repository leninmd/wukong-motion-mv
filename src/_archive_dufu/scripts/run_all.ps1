# run_all.ps1 — 一键重建：音轨 → 逐帧渲染 → 编码 → 合成 → 质检
# 用法： powershell -ExecutionPolicy Bypass -File .\run_all.ps1
# 说明：帧渲染按帧写盘（可断点续渲，已存在的帧会跳过），编码与渲染解耦。

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "[1/5] 生成音轨（旁白 + 配乐 + 音效）" -ForegroundColor Cyan
python audio/build_audio.py

Write-Host "[2/5] 逐帧渲染（2550 帧，约 5–10 分钟）" -ForegroundColor Cyan
python render/render3.py frames --out output/frames --quality 96

Write-Host "[3/5] 编码 + 合成成片" -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -framerate 30 -i output/frames/f%05d.jpg -i output/audio/mix.wav `
  -map 0:v -map 1:a `
  -vf "scale=in_range=full:out_range=tv,format=yuv420p" `
  -c:v libx264 -preset medium -crf 19 -x264-params keyint=60:min-keyint=30 `
  -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 `
  -c:a aac -b:a 192k -shortest -movflags +faststart output/dufu_v1.mp4

Write-Host "[4/5] 质检" -ForegroundColor Cyan
python render/qa.py output/dufu_v1.mp4

Write-Host "完成： output/dufu_v1.mp4" -ForegroundColor Green
