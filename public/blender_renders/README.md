# public/blender_renders

Blender 渲染的透明 3D 特效：金箍棒挥击、山石破碎、天宫崩塌、八卦炉火焰等。

要求：

- 带 Alpha 的 WebM（VP9 + alpha）或 ProRes 4444 MOV；推荐 WebM 以控制体积。
- 不需要音轨；音效统一由 `public/audio/fx/` 管理。
- 帧率与母版一致（60 fps），画幅 1920×1080，预乘 Alpha 与 Remotion 读取方式需验证。
- 命名：`cudgel_shatter_01.webm`、`heaven_collapse_02.webm`。
- 同一镜头只渲染画面内的最小画幅，不要把全屏黑边带入合成。

消费组件：`src/primitives/BlenderAlphaVideo.tsx`（`<OffthreadVideo transparent />`）。

首帧 still 验收：在 Remotion Studio 中确认 Alpha 边缘无黑边、无锯齿、无颜色偏移。

## 已登记资产

### shot2_palace_destruction.webm

| 项 | 值 |
|---|---|
| 镜头 | Shot 2B【凌霄宝殿·无坚不摧】殿柱刚体爆碎 |
| 生成脚本 | `scripts/blender/render_shot2_collapse.py` |
| 规格 | 1920×1080 / 30 fps / 52 帧 / 1.73 s / VP9 |
| 体积 | 3.36 MB |
| **Alpha** | **无**。本机 ffmpeg（Remotion 自带的精简 7.1 构建）的 matroska 封装
不写 VP9 alpha，`-pix_fmt yuva420p` 落盘仍是 yuv420p；Remotion 渲染器复用同一二进制，
结果一致。详见 `docs/EXPLORATION_LOG.md` §19.5 |
| 用途 | 体积小、可直接预览；**透明合成请用下面的母版** |

真透明母版（不进 git，`out/` 下本地保存）：

- `out/blender_frames/shot2/shot2_0001..0052.png` —— PNG RGBA 序列（105.4 MB），
  `film_transparent` 直出，实测 f30 有 24.2% 像素 alpha=0。
- `out/shot2_palace_destruction_alpha.mov` —— ProRes 4444 `yuva444p12le`（100.3 MB），
  单文件带 alpha，Remotion `<OffthreadVideo transparent />` 可直接读。
- 重新生成：

```powershell
# 1) 渲染 52 帧 PNG RGBA
& "D:\Design\blender\blender.exe" -b -P scripts/blender/render_shot2_collapse.py -- `
  --all --frames-dir out/blender_frames/shot2
# 2) 带 alpha 的 ProRes 4444
& "D:\Design\blender\blender.exe" -b -P scripts/blender/render_shot2_collapse.py -- `
  --all --frames-dir out/blender_frames/shot2 --alpha-mov out/shot2_palace_destruction_alpha.mov
```

> 要给浏览器直接播的透明 WebM，需要换一个**带 libwebm 封装**的 ffmpeg
> （vpxenc / mkvmuxer），仅换参数无解。

### shot3_mountain_chains.webm

| 项 | 值 |
|---|---|
| 镜头 | Shot 3【五指山下·深渊岩体与紧绷铁索】 |
| 生成脚本 | `scripts/blender/render_shot3_cleft.py` |
| 规格 | 1920×1080 / 30 fps / 75 帧 / 2.50 s / VP9 |
| 体积 | 1.37 MB |
| **Alpha** | 同 shot2：本机 ffmpeg 不写 VP9 alpha，此文件为不透明版本 |
| 真透明母版 | `out/blender_frames/shot3/*.png`（PNG RGBA）、`out/shot3_mountain_chains_alpha.mov`（ProRes 4444） |
| 内容 | 6 道刚体铁索（22 环/道，POINT 球铰）在 1–15 帧被山体压紧并振动；60 块落石 + 34 片粉尘面片；相机 z 22→−26 垂直俯冲 |
| 注意 | 峡谷中缝是透明区（f30 约 16%），合成时背后必须有山体，否则会透出背景 |

```powershell
& "D:\Design\blender\blender.exe" -b -P scripts/blender/render_shot3_cleft.py -- `
  --all --frames-dir out/blender_frames/shot3 `
  --webm public/blender_renders/shot3_mountain_chains.webm `
  --alpha-mov out/shot3_mountain_chains_alpha.mov
```

