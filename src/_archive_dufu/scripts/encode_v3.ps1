# encode_v3.ps1 — V3 成片合成：120s / 60fps / 零旁白
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

New-Item -ItemType Directory -Force output\v3_release | Out-Null

Write-Host "[1/2] 编码 1080p60 母版（crf 16 / preset medium）..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -framerate 60 -i output/v3_work/frames/f%05d.jpg `
  -i output/audio/mix_v3.wav `
  -map 0:v -map 1:a `
  -vf "scale=in_range=full:out_range=tv,format=yuv420p" `
  -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 60 `
  -x264-params keyint=120:min-keyint=60 `
  -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 `
  -c:a aac -b:a 192k -shortest `
  -movflags +faststart `
  output/v3_release/dufu_v3_silent_master.mp4

Write-Host "[2/2] 生成 720p 分享版..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -i output/v3_release/dufu_v3_silent_master.mp4 `
  -vf "scale=1280:720:flags=lanczos" -c:v libx264 -crf 25 -preset medium `
  -c:a aac -b:a 128k -movflags +faststart `
  output/v3_release/dufu_v3_preview_720p.mp4

Get-ChildItem output\v3_release\*.mp4 | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
