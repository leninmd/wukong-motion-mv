# 杜甫工程归档区 · 只读备查

本目录保存 `leninmd/dufu-motion-graphics`（提交 `3ece975`）中与杜甫叙事强绑定的原始实现，供 Wukong 工程追溯算法来源，**不参与新工程的 Remotion 注册与构建**。

## 归档映射

| 目录 / 文件 | 原路径 | 性质 |
|---|---|---|
| `canvas_engine/` | `engine/` | 原 Canvas/WebGL 图形引擎（已抽取关键算法到 `src/primitives`、`src/utils`） |
| `scenes/` | `scenes/` | 9 个杜甫分镜（`s01`–`s09`），整段隔离 |
| `storyboards/` | `storyboard*.json` | 杜甫剧本、文案、HUD、音效表 |
| `canvas_app/` | `app.js`, `index.html` | 原 Canvas 播放器入口 |
| `audio_build/` | `audio/` | Python/numpy 音轨构建脚本 |
| `render_pipeline/` | `render/` | Playwright 逐帧渲染与 QA 脚本 |
| `docs/` | `docs/` | 分镜、考据、版本档案 |
| `research/` | `research/` + AI 调研文档 | 参考片抽帧与调研 |
| `tools/` | `tools/` | 字体拉取脚本 |
| `scripts/` | `*.ps1` | 原编码/一键重建脚本 |
| `README_dufu.md` | `README.md` | 原项目说明 |

原始成片与音轨已移至仓库根的 `archive/dufu_releases/`，该目录被 `.gitignore` 排除，仅本地保留。

## 盘点结论

任务描述中预期的 `src/`、`package.json`、`Root.tsx`、`remotion.config.ts` 以及“20 个历史切片组件”在原仓库中均不存在。原仓库实际是 **原生 Canvas + Python 渲染管线**，只有 9 个分镜组件（`s01`–`s09`）。因此本工程没有可移除的旧 Root 注册项，而是新建了 Remotion 根注册表；可复用引擎算法按下列清单重新实现为 TypeScript：

- 宣纸/纤维/帘纹/颗粒/暗角 → `paperTexture.ts`、`PaperSurface.tsx`、`Vignette.tsx`
- 朱砂印章 + 毛边 + 砸落 + 飞溅 → `Seal.tsx`
- 3D 点云投影与实例化粒子 → `pointCloud.ts`、`InkPointCloud.tsx`
- 离屏文字采样 / 风场吹散 / 粒子雨 → `offscreenParticles.ts`、`ParticleRain.tsx`
- 预烘焙刚体文字坍塌 → `rigidBody.ts`、`RigidTextCollapse.tsx`
- 确定性随机、noise、缓动、弹簧、时钟换算 → `utils/math.ts`、`utils/timing.ts`
- 音画同步锚点与频谱约束 → `utils/alignment.ts`、`audio/spectrum.ts`、`audio/sfx.ts`
- 重资产解耦组件 → `ComfySprite.tsx`、`BlenderAlphaVideo.tsx`

> 归档仅为审计与算法对照，不应在新 MV 中直接引用。新场景必须读取 `public/alignment/*.json`，不得复制杜甫文案或旧帧号。
