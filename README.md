# 孙悟空：金猴奋起千钧棒

> 一部以代码为笔、以鼓点为骨的填词调音 MV。
> 视觉节奏对标《千本樱》代码生成 MV；听觉与叙事张力对标《美猴王》鬼畜调音。

当前状态：**阶段一 · 工程底座与可复用引擎提纯完成**。
已建立全新 Remotion 仓库、素材契约、工程宪法 `AGENTS.md`，并用一条 `WukongPrologue` 底片验证了「宣纸纹 × 三维金墨点云 × 火星/飞灰 × 朱砂印 × 切片打字机」的合成链路。

## 快速开始

```powershell
npm install
npm run dev
npm run typecheck
npm run compositions
```

渲染底片静帧：

```powershell
npx remotion still src/index.ts WukongPrologue out/qa-prologue.png --frame=420
```

渲染底片视频（10 秒 / 60 fps）：

```powershell
npm run render
```

## 技术栈

- Remotion `4.0.537`（锁定精确版本）
- `@remotion/media-utils` `4.0.537`（与 remotion 逐位一致）
- React `19.3.1` / TypeScript `5.9.3`
- 1920×1080 / 60 fps / PNG frame sequence

## 目录

```text
src/
  index.ts                     Remotion entry
  Root.tsx                     主线注册表（只注册 WukongPrologue）
  compositions/
    WukongPrologue.tsx         阶段一视觉底片（非正片歌词）
  config/
    theme.ts                   四色宪法 / 画幅 / 安全区 / 预算
    fonts.ts                   FontFace 字体加载（缺失可回落）
  audio/
    spectrum.ts                32-band 鼓组/伴奏频谱规范
    sfx.ts                     音效 cue → frame 调度 + Web Audio 预览
  primitives/
    paperTexture.ts            宣纸/麻纸/纤维/帘纹/颗粒烘焙
    PaperSurface.tsx           静态纸面 Canvas 组件
    Vignette.tsx               暗角 + 胶片颗粒层
    Seal.tsx                   朱砂毛边印章（齐天大圣 / 如意）
    Typewriter.tsx             严格的 text.slice(0, count) 打字机
    pointCloud.ts              3D 点云生成与透视投影
    InkPointCloud.tsx          三维金墨点云 Canvas
    offscreenParticles.ts      离屏文字采样 / 风场吹散
    ParticleRain.tsx           暗金火星 / 八卦炉飞灰 / 墨雨粒子
    rigidBody.ts               预烘焙刚体文字坍塌
    RigidTextCollapse.tsx      单 Canvas 刚体文字渲染
    ComfySprite.tsx            ComfyUI 透明立绘合成
    BlenderAlphaVideo.tsx      Blender Alpha WebM 合成
    DrumSpectrum.tsx           受约束的 32-band 频谱条
  utils/
    math.ts                    确定性 rng/hash/noise/缓动/弹簧
    timing.ts                  秒 ↔ 帧唯一换算入口
    alignment.ts               字级对齐 JSON 类型与解析
  _archive_dufu/               杜甫原工程只读归档（不参与构建）
public/
  audio/                       BS-RoFormer stems、干声、混音
  alignment/                   字级对齐 JSON + 节拍网格
  comfy_sprites/               透明 PNG 角色立绘
  blender_renders/             透明 WebM 3D 特效
  fonts/                       可选本地中文字体
```

资产命名与接入规则见各目录 README。工程刚性约束见 [AGENTS.md](AGENTS.md)。

## 从 dufu-motion-graphics 提纯出的组件

| 原实现 | 新模块 | 提取内容 |
|---|---|---|
| `engine/layers.js` + `engine/v3/paper-fluid.js` | `paperTexture.ts` / `PaperSurface.tsx` | 宣纸底、fBm 纤维、帘纹、折痕、杂质、颗粒 |
| `engine/layers.js` + `engine/aesthetics-hub/opuscar-fx.js` | `Vignette.tsx` / `Seal.tsx` | 暗角、胶片颗粒、朱印毛边、印泥斑驳、砸落与飞溅 |
| `engine/world3d.js` + `engine/kinetic.js` | `pointCloud.ts` / `InkPointCloud.tsx` | 相机投影、3D 点云、深度雾、按 index 的确定性粒子 |
| `engine/kinetic.js` + `opuscar-fx.js` | `offscreenParticles.ts` / `ParticleRain.tsx` | 离屏文字采样、风场吹散、粒子雨、飞灰/火星变体 |
| `engine/aesthetics-hub/remonster-physics.js` | `rigidBody.ts` / `RigidTextCollapse.tsx` | 预烘焙重力、地面/侧墙、AABB 碰撞、单 Canvas 绘制 |
| `engine/theme.js` + `motion-rules.js` | `utils/math.ts` | Mulberry32、hash、value noise、fBm、Expo/Cubic/Quint、弹簧 |
| `engine/hud.js` + `v4/cadence.js` | `utils/timing.ts` / `utils/alignment.ts` | 秒→帧、句读调度、字级对齐、节拍锚点 |
| `engine/v3/paper-fluid.js` + `v4/inkbrush.js` | `Seal.tsx` / `paperTexture.ts` | 毛边、飞白、墨渗、纸张噪点等视觉语言（转译为 SVG/Canvas） |
| `app.js` + 原 Python `audio/build_audio_v4.py` | `audio/sfx.ts` / `audio/spectrum.ts` | 音画共用 cue 表、音效预听、鼓组频谱参数 |

完整归档映射见 [src/_archive_dufu/README.md](src/_archive_dufu/README.md)。

## 重要溯源说明

原仓库 `leninmd/dufu-motion-graphics` **不是** Remotion 工程，实际为原生 Canvas/WebGL + Python/Playwright 的确定性渲染管线。它没有 `package.json`、`src/`、`Root.tsx`、`remotion.config.ts`，也没有任务描述中预期的“20 个历史切片组件”——只有 9 个杜甫分镜（`s01`–`s09`）与三代 storyboard。

因此本仓库做了两件事：

1. 原工程全部文件原样移入 `src/_archive_dufu/`（成片大文件另存 `archive/dufu_releases/`，被 `.gitignore` 排除），保留可追溯性。
2. 从零建立 Remotion 根工程，把可复用的图形/物理/排版/音频算法**重写为严格类型化的 TypeScript 组件**，而不是把旧浏览器脚本直接塞进 React。

原工程版本：`3ece975e99c2f7cc91ff9c1ae3fa2e7315e9af76`（`main`，2026-10-21）。
