# 杜甫复刻视频 · 工程说明

一支 85 秒、1920×1080 / 30fps 的确定性代码渲染短片：把抖音「苏轼」动态图形短片（`sushi.mp4`）的
叙事骨架、色彩系统、HUD 装置与运镜语法，整体移植到杜甫的生平与诗作上。

```
D:\AI\AIVideoStudio\
├─ sushi.mp4                   参考片（1280×720 / 30fps / 83.2s / 无音轨）
├─ AI代码视频复刻全面调研.md      前期调研文档（含若干史实/工程错误，见 docs/考证与勘误.md）
├─ index.html                  播放器入口（浏览器打开即为实时预览）
├─ app.js                      主时间轴：帧函数、章节交叉溶解、颗粒/暗角、HUD 合成
├─ storyboard.json             ★ 单一事实来源：章节、HUD 提示点、旁白文本与起始时间
├─ engine/
│   ├─ theme.js                主题色/字体/缓动/确定性 PRNG/value noise
│   ├─ layers.js               宣纸纹理、胶片颗粒、暗角、墨韵、墨染转场
│   ├─ kinetic.js              文字动力学：逐字入场、竖排、粒子文字、木刻质感字、朱印、红圈、字牌、翻牌
│   ├─ hud.js                  右上角「地点·纪年·事件 / 累计公里」状态栏
│   ├─ world3d.js              极简 3D：透视相机、活字版面（仿射贴字）、点云群山
│   ├─ water.js                江面/夜海/月/月光柱
│   └─ figures.js              程序化资产：雨、茅草/芦苇、竹、人影、舟、落木、飞鸟、墨点、文字墙、雾
├─ scenes/                     九个分镜（s01…s09），每个 draw(ctx, localTime, globalTime)
├─ render/
│   ├─ render3.py              ★ 主渲染器：逐帧 JPEG 写盘（可断点续渲、渲染与编码解耦）
│   ├─ qa.py                   成片质检：容器参数 + 抽帧亮度/运动探针
│   ├─ render.py / render2.py  早期方案（截图 / rawvideo 管道），保留作参考
│   └─ diag*.py                调试脚本
├─ audio/
│   ├─ build_audio.py          旁白 edge-tts + numpy 程序化配乐/音效 + ducking 混音
│   └─ cache/                  TTS 缓存（按文本哈希）
├─ output/
│   ├─ dufu_v1.mp4             ★ 交付成片（85.9 MB / 85.00s / 1080p30 / H.264 + AAC）
│   ├─ frames/                 2550 张 JPEG 中间帧（可复用于重新编码）
│   ├─ audio/mix.wav           85s 立体声混音
│   ├─ qa/                     逐秒抽帧质检图
│   └─ stills/                 关键帧静帧
└─ docs/
    ├─ storyboard.md           分镜脚本（时间轴、屏幕文字、旁白、HUD）
    ├─ recipe.json             可复用的「视频配方」
    └─ 考证与勘误.md            杜甫生平考证，以及对调研文档的纠错
```

## 一、快速开始

```powershell
git clone <this-repo> && cd dufu-motion-graphics
python tools/fetch_fonts.py          # 准备四款字体（本机复制或下载）
python -m http.server 8000           # 浏览器打开 http://127.0.0.1:8000 实时预览

# 重建全片（约 10 分钟）
powershell -ExecutionPolicy Bypass -File .\run_all.ps1
```

仓库内自带 **`output/preview_720p.mp4`（9.8 MB，720p，含旁白与配乐）**，
1080p 母版（85.9 MB）因体积过大未入库，按上面的 `run_all.ps1` 可一分钟内重建。

依赖：Python 3.10+（numpy / opencv-python / playwright / edge-tts）、
Playwright Chromium（`python -m playwright install chromium`）、ffmpeg（见下）。

`tools/ffmpeg.exe` 未入库。任选一种方式获取：

```powershell
# 方式 A：用 pip 自带的 ffmpeg 二进制
python -m pip install imageio-ffmpeg
$bin = python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"
Copy-Item $bin tools\ffmpeg.exe
# 方式 B：从 gyan.dev 下载 essentials 版解压后放到 tools/ffmpeg.exe
```

## 二、运行

```powershell
# 实时预览（浏览器打开 http://127.0.0.1:8000 ）
python -m http.server 8000

# 渲染静帧（自检）
python render/render2.py stills --times 2.9,7.5,19 --out output/stills

# 逐帧渲染（可断点续渲，已存在帧自动跳过）
python render/render3.py frames --out output/frames --quality 96

# 音轨
python audio/build_audio.py

# 合成（视频 + 旁白/配乐）
tools\ffmpeg.exe -y -i output\dufu_silent_v1.mp4 -i output\audio\mix.wav `
  -c:v copy -c:a aac -b:a 192k -shortest output\dufu_v1.mp4
```

## 三、确定性约定（可乱序逐帧渲染）

* 禁止 `Math.random()`、`Date.now()`、挂钟时间：一切随机数来自 `DFS.rng(seed)` / `DFS.hash(seed, i)`。
* 每个分镜是 `draw(ctx, L, t)` 的纯函数：`L` 为场景内时间，`t` 为全片时间。
* 尺寸以短边 1080 为基准（`DFS.s()`），字号/间距不写死像素。
* 场景先画到离屏缓冲，再按章节权重合成——场景内部的 `globalAlpha` 不会污染交叉溶解。
* 颗粒/暗角按帧号取种子，同一帧两次渲染字节一致。

## 四、性能

| 环节 | 单帧耗时 | 说明 |
|---|---|---|
| 场景绘制 | 40–90 ms | 主要开销：活字版面（~2000 个仿射贴字）与点云（2 万点） |
| 像素回读 | ~95 ms | `getImageData(1920×1080)` |
| 传输+编码 | ~余量 | 8.3 MB rawvideo over localhost + x264 medium |

全片 2550 帧约 35–45 分钟（机械硬盘/单进程）。若要提速：降 `--crf` 或改 `--preset veryfast`，
或把画幅降到 1280×720（像素回读与编码成本约降 55%）。

## 五、已知取舍

* 原片无音轨；本版按委托加入中文男声旁白 + 程序化氛围配乐 + 雨/风/水/低频重音。
* 成片质检（`render/qa.py`）：85.00s / 2550 帧 / 30fps / 1920×1080 / yuv420p(tv, bt709) / AAC 48k 立体声；
  无死帧、无冻结帧，音轨峰值 0.94（未削波）。
* 点云群山是"墨点山"，与参考片的 Three.js 点云在质感上有差异，但保持了"多峰收束为孤峰"的叙事动作。
* 所有素材均为代码生成，无外部图片/视频素材，因此可无限次无损重渲染。
