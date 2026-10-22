# encode_v2.ps1 — V2 成片合成：60fps 帧序列 + 混音 → 母版
# 用法： powershell -ExecutionPolicy Bypass -File .\encode_v2.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

New-Item -ItemType Directory -Force output\v2_release | Out-Null

Write-Host "[1/2] 编码 1080p60 母版（crf 16 / preset slow）..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -framerate 60 -i output/v2_work/frames60/f%05d.jpg `
  -i output/audio/mix.wav `
  -map 0:v -map 1:a `
  -vf "scale=in_range=full:out_range=tv,format=yuv420p" `
  -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -r 60 `
  -x264-params keyint=120:min-keyint=60 `
  -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 `
  -af "volume=0.72" -c:a aac -b:a 192k -shortest `
  -movflags +faststart `
  output/v2_release/dufu_v2_masterpiece.mp4

Write-Host "[2/2] 生成 720p 分享版..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -i output/v2_release/dufu_v2_masterpiece.mp4 `
  -vf "scale=1280:720:flags=lanczos" -c:v libx264 -crf 24 -preset medium `
  -c:a aac -b:a 128k -movflags +faststart `
  output/v2_release/dufu_v2_preview_720p.mp4

Get-ChildItem output\v2_release\*.mp4 | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
