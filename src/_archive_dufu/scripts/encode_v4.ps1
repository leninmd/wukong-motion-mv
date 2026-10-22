# encode_v4.ps1 — V4 成片合成：88s / 60fps / 物理建模音轨 / 五层管线
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

New-Item -ItemType Directory -Force output\v4_release | Out-Null

$WAV = "output/audio/mix_v4.wav"
if (-not (Test-Path $WAV)) { throw "缺少音轨：先跑 python audio/build_audio_v4.py" }

Write-Host "[1/4] 编码 1080p60 母版（crf 17 / preset slow）..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -framerate 60 -i output/v4_work/frames/f%05d.jpg `
  -i $WAV `
  -map 0:v -map 1:a `
  -vf "scale=in_range=full:out_range=tv,format=yuv420p" `
  -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -r 60 `
  -x264-params "keyint=120:min-keyint=60:aq-mode=3" `
  -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 `
  -c:a aac -b:a 224k -shortest -movflags +faststart `
  output/v4_release/dufu_v4_master_1080p60.mp4

Write-Host "[2/4] 1080p 分享版（crf 23）..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -i output/v4_release/dufu_v4_master_1080p60.mp4 `
  -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p `
  -c:a aac -b:a 160k -movflags +faststart `
  output/v4_release/dufu_v4_share_1080p.mp4

Write-Host "[3/4] 720p 预览版（crf 26）..." -ForegroundColor Cyan
& tools\ffmpeg.exe -y -hide_banner -loglevel error `
  -i output/v4_release/dufu_v4_master_1080p60.mp4 `
  -vf "scale=1280:720:flags=lanczos" -c:v libx264 -crf 26 -preset medium `
  -c:a aac -b:a 128k -movflags +faststart `
  output/v4_release/dufu_v4_preview_720p.mp4

Write-Host "[4/4] 体积对账" -ForegroundColor Cyan
Get-ChildItem output\v4_release\*.mp4 | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
