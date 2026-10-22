# 杜甫 · 确定性代码渲染短片（V1 / V2 / V3 / V4）

一支关于杜甫（712—770）的中文动态图形短片，做了四版。**每一帧都由代码算出来**——没有一张外部图片或视频素材，
纸纹、墨迹、活字、皴法群山、界画广厦、金石断碑全部是 Canvas 逐帧程序化绘制。

| 版本 | 时长 / 帧率 | 声音 | 文字 | 成片（仓库内） |
|---|---|---|---|---|
| **V1** 诗史 | 85s / 30fps | 男声旁白 + 配乐 | 现代文案 | 720p 预览 · 1080p 压缩 |
| **V2** 少陵野老 | 85s / 60fps | 男声旁白 + 配乐 | 现代文案（立意重构） | [720p 预览](output/v2_release/dufu_v2_preview_720p.mp4) · [1080p 压缩](output/v2_release/dufu_v2_share_1080p.mp4) |
| **V3** 万古诗史 | 120s / 60fps | 零旁白（numpy 噪波） | 只用原典 | [720p 预览](output/v3_release/dufu_v3_preview_720p.mp4) |
| **V4** 长卷 | **88s / 60fps** | **物理建模古琴 + 堂鼓（音画同步）** | 只用原典 + 句读律动 | [1080p 分享 25.6MB](output/v4_release/dufu_v4_share_1080p.mp4) · [720p 预览 8.4MB](output/v4_release/dufu_v4_preview_720p.mp4) · [母版 76MB](output/v4_release/dufu_v4_master_1080p60.mp4) |

![V4 审片大图](output/v4_release/v4_highlights_grid.png)

## 四版分别解决什么

- **V1**：证明"代码逐帧渲染"这条路能走通——把抖音上一支苏轼爆款短片的叙事骨架（活字世界 → 风雨 → 江月 → 黑暗自问 → 一手烂牌 → 收束）整体移植到杜甫身上。
- **V2**：修立意 + 上审美库。删掉苏轼式的「无法改变环境／每天都很焦虑／废物」自我内耗，改成杜甫的具身苦难；
  挂载六个开源美学模块（弹簧物理、朱印砸落、风场吹散、刚体预烘焙、字重极差、节奏克隆、质量门），帧率翻倍到 60fps。
- **V3**：把"准绳"提到第一位。**屏幕上每一个字都能在两唐书、元稹墓志、韩愈诗与杜甫原诗里逐字找到**；
  删掉全部旁白；渲染管线扩到八层（麻纸墨渗 / 参数化广厦晶格 / 多边形断碑 / 气溶胶）。
  ——但它"看不下去"：120 秒零旁白 + 数学噪波 + 八层发灰 + 理工科线框。
- **V4**：**减法手术**。120s → 88s；八层 → 五层；点云 → 皴法；线框 → 界画；多边形 → 碑拓；火柴人 → 减笔；
  数码 HUD → 朱丝栏夹注；机械入场 → 三种句读律动；分镜孤岛 → 1.2s 交叠的一镜到底；
  numpy 噪波 → Karplus-Strong 古琴 + 堂鼓 + 毫秒级音画同步；17 项工程断言 → 22 项（含 5 道美学门控）。

  **完整手术记录见 [docs/v4-upgrade-report.md](docs/v4-upgrade-report.md)。**

## 快速开始

```powershell
python tools/fetch_fonts.py                 # 四款字体（本机复制或下载）
python -m pip install numpy opencv-python playwright
python -m playwright install chromium
# ffmpeg：把 imageio_ffmpeg 自带的二进制复制成 tools/ffmpeg.exe（详见 docs/README.md）

python -m http.server 8000                  # 浏览器打开 http://127.0.0.1:8000 实时预览
powershell -ExecutionPolicy Bypass -File .\run_all_v4.ps1   # V4 一键重建（音轨 → 渲染 → 编码 → 质检）
```

单步：

```powershell
python audio/build_audio_v4.py                              # 88s 音轨
python render/render4.py frames --out output/v4_work/frames --fps 60
powershell -ExecutionPolicy Bypass -File .\encode_v4.ps1     # 母版 + 分享版 + 720p
python render/qa_probe_v4.py                                # 22 项质量门
```

## 结构

```
storyboard.json / storyboard.v3.json / storyboard.v4.json   三代剧本（单一事实来源）
engine/          theme · layers · kinetic · hud · world3d · water · figures
engine/aesthetics-hub/   六大外挂美学模块（V2 引入）
engine/v4/               笔墨工具箱 inkbrush · 句读律动 cadence（V4 引入）
engine/v3/               五层管线 · 麻纸墨渗 · 界画木构 · 金石碑拓
scenes/s01…s09           九个分镜，每个 draw(ctx, 本地时间, 全局时间) 的纯函数
render/render4.py        逐帧 JPEG 写盘 → ffmpeg（断点续渲，支持多端口并行）
render/qa_probe_v4.py    22 项质量门（17 工程 + 5 美学）
audio/build_audio_v4.py  Karplus-Strong 古琴 + 堂鼓 + 音画同步
docs/                    分镜脚本、配方、引文考据、版本档案、V4 手术记录
```

## 设计约束

* **确定性**：禁用 `Math.random` / `Date.now` / 挂钟时间，随机数一律来自固定种子；同一时间点两次渲染结果一致，可乱序并发、断点续渲。
* **五层**：纸 / 资产 / 大气 / 微尘 / 排版 / 调色 / 颗粒——每一层都有预算，全屏混合的东西一律先打折。
* **文字**：V1/V2 有现代文案；**V3/V4 一个现代字都不写**，全部逐字校对（见 [docs/v3-引文考据.md](docs/v3-引文考据.md)）。
* **节奏**：入场不再是 `Fade+Rise+Scale+Blur × 0.05–0.09s 等差`，
  而是三种物理模型（史笔刀刻 / 杜诗吟诵 / 墓志碑拓）+ 句读停顿，由 `storyboard.v4.json` 的 `cues` 驱动。
* **音画同步**：画面与音轨读同一张 `cues` / `sfx` 表，JS 与 Python 各实现一次同构的 `schedule()`。

## 四个踩过的坑

1. `ctx.filter='blur()'` 不要用于大量 path——它对每条路径单独软件模糊，草/雨那场单帧从 0.1 秒飙到 20 秒。
2. 8MB 原始帧别经 HTTP 回传再进 ffmpeg：管道背压会让截图卡在 25 秒/帧。逐帧写盘、渲染与编码解耦。
3. 内存紧张时每 120 帧重启一次 Chromium，否则堆增长会让渲染逐步停摆。
4. **探针会骗人**。V3 的 17 项断言全绿，成片依然"看不下去"——
   因为它们只能测"有没有黑屏"，测不出"满屏铆钉没有一寸留白"。
   V4 的留白率门控一上，两个"CG 感"镜头立刻被判死并被重写。

详见 [docs/版本档案.md](docs/版本档案.md)、[docs/README.md](docs/README.md)、[docs/storyboard.md](docs/storyboard.md)、
[docs/v4-upgrade-report.md](docs/v4-upgrade-report.md)、[docs/recipe.json](docs/recipe.json)。
