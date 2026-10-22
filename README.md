# 孙悟空：金猴奋起千钧棒

> 一部以代码为笔、以鼓点为骨的填词调音 MV。
> 视觉节奏对标《千本樱》代码生成 MV；听觉与叙事张力对标《美猴王》鬼畜调音。

当前状态：**阶段三 · 纯代码重构完成**。

阶段一建立了全新 Remotion 仓库、素材契约、工程宪法 `AGENTS.md`，并用 `WukongPrologue` 验证了「宣纸纹 × 三维金墨点云 × 火星/飞灰 × 朱砂印 × 切片打字机」的合成链路。

阶段二逐镜头复刻了参考视频 `00:09–00:19`，但第一版依赖 5 张 AI 静态板与杜甫母版的展览框，被判定为“像放 PPT”。阶段三按《千本樱》的纯代码路线彻底重写：**删除全部 AI 静态背景、顶部章节框、BPM 仪表盘、常驻印章与底部 KTV 字幕条**，改由 SVG / Canvas 2D / Three.js 几何体实时绘制四镜，歌词作为战幡、符咒、罪状牌与印章进入画面。

> 本机无独立 GPU，且本轮明确禁止调用外部生图模型；纯代码是验收要求，不是权宜之计。

## 先读这两份

- [`docs/EXPLORATION_LOG.md`](docs/EXPLORATION_LOG.md)：**为什么现在这么做**。记录了从"纯代码仿拍"到"AI 板 + 代码合成"、再到"纯代码重构"的全部弯路、失败清单与代价。
- [`docs/AGENT_TOOLING.md`](docs/AGENT_TOOLING.md)：**怎么在这台机器上干活**。环境事实、Three.js 无 GPU 渲染、Antigravity 生图调用方式、脚本索引、踩坑对照表。

## 快速开始

```powershell
npm install
npm run dev
npm run typecheck
npm run compositions
```

渲染高潮复刻段的五个验收静帧（30 fps / 300 帧）：

```powershell
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f045.png --frame=45
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f085.png --frame=85
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f120.png --frame=120
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f190.png --frame=190
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f280.png --frame=280
npx remotion render src/index.ts WukongClimaxSegment out/senbon_v2_mvp.mp4 --concurrency=4
```

复刻段的音画自检（缺一不可）：

```powershell
python scripts/build_climax_assets.py   # 重建 drums_stem.wav + climax_words.json
python scripts/verify_climax.py         # 每个汉字起点距参考混音瞬态 <= 50 ms，退出码 0 才通过
```

渲染底片静帧 / 视频：

```powershell
npx remotion still src/index.ts WukongPrologue out/qa-prologue.png --frame=420
npm run render
```

## 方法论：为什么改成了「版画海报」

参考对象不是别的 AI 视频，而是 Opus 5.5 那条千本樱 MV。把它的开源化同类工程读完后，方法论是清楚的：

- **一镜一事**：PDoomVideo 的 `ANIMATION_GUIDE.md` 写死了这条规矩——每个镜头里必须有"某件事"发生，镜头长度 1.4–4 s，剪点落在拍上。156 秒里有 60 多个镜头。
- **纯粹的时间函数**：每一帧只由 `t` 决定，禁止跨帧状态和 `Math.random()`；随机来自 `hash(i)`，手绘抖动来自按 12 Hz 重播种的 `jit()`。
- **一个共享的绘制词汇表**：`paint()` / `inkLine()` / `wash` / `bleed` / `hatch`，加上 `camBegin/zoom`、`shakeXY`、`flash`、`iris`、`letter`。镜头代码是在"用词汇表构图"，不是在调 CSS。
- **美术优先于特效**：把千本樱逐帧扒下来看，它酷的地方不是光效，而是**大正浪漫版画海报**——靛黑底、鎏金线、樱粉、羊皮纸告示、双重边框、角饰、朱印、竖排大字、半调网点，以及**每帧都塞满的分层细节**。

所以本段重做时的取舍是：**往"印刷海报"靠，而不是往"夜戏特效"靠**。大色块承担构图，金线承担细节，快切承担节奏。

## 高潮复刻段：四镜（纯代码）

分镜切成四刀（10 秒），每一刀的边界在 `src/sequences/senbonPlan.ts` 里由分镜秒表与对齐 JSON 共同解出：

| # | 帧 | 唱词 | 主体 / 物理转场 |
|---|---|---|---|
| 01 | 0–75 | 玉境凌霄十万天兵合围 | 南天门双扇拉门 → 满月飞檐 → 60 天兵三层合围 → 四道战幡弹簧砸落 |
| 02 | 75–150 | 怎敌我无坚不摧 | 斜切火眼金睛横条 → Three.js 天庭棋盘：金箍棒砸地、三圈冲击波、40 柱抛物线崩飞 → 一棒劈字 + 全屏反色 |
| 03 | 150–225 | 五指山下偿自由的罪 | 五座巨峰柱依次下砸（纵向震屏）→ 中央石缝跪姿大圣 → 六张符咒从四角钉入 |
| 04 | 225–300 | 罪名是老孙不敬权威 | 三层罪状木牌阵 → 金猴破壁斩断所有木牌 → 四枚朱砂巨印砸满全屏 |

### 纯代码视觉原语（现在的做法）

`src/primitives/senbon_style/` 是这一段的全部“美术资产”：

| 文件 | 作用 |
|---|---|
| `HalftoneOverlay` | SVG `<pattern>` 半调网点 + 径向渐变光晕 + 暗金纸屑噪点 |
| `WukongSilhouette` | 参数化大圣剪影：`stand / eyes_closeup / kneel_defiant / smash`；雉鸡翎与披风绑 `useCurrentFrame()` 正余弦，金箍棒独立旋转 |
| `NandamenDoors` | 南天门玄黑描金双扇门、门钉、铺首衔环、门匾 |
| `CourtSky` | 赤金满月（半调阴影）、飞檐殿宇、云带、飞鸟、浮尘 |
| `CelestialArmy` | 左右各 30 名执戈天兵 + 前景枪林，按压力值合拢 |
| `WarBanners` | 四分屏战幡，弹簧落幅 |
| `EyeCut` | 斜切漫画分格 + 火眼特写 + 横向赤金闪电 + 竖排【怎敌我】 |
| `CudgelImpact3D` | `@remotion/three`：棋盘格地面、40 根天条方柱、金箍棒、三圈冲击波、抛物线崩飞 |
| `SplitType` | 上下互补 `clip-path` 的一棒劈字 |
| `MountainCage` | 五峰柱下砸 + 金色等高线 + 中央 280px 深渊缝 |
| `Talismans` | 六张朱砂符纸从四角飞入、落钉、文字揭示 |
| `VerdictTags` | 远/中/近三层罪状木牌 + 链条 + 翻面 + 断裂纷飞 |
| `FinalSeals` | 四枚带裂纹的朱砂巨印，印泥飞溅 |

这些组件全部是**时间函数**：没有 `Math.random()`、没有 `Date.now()`、没有跨帧状态；随机量来自固定种子 `hash(seed, i)`。歌词文字始终是单个文本节点，不做逐字 DOM 动画。

### 画面精致的四个抓手

1. **三层视差**：满月/飞檐（0.22×）→ 60 天兵（中速合拢）→ 宫灯/火星/光条（高速划过）。镜头一动就出纵深。
2. **物理而不是淡入淡出**：门板被拉开、战幡被弹簧砸落、山柱按节拍砸下并触发纵向震屏、40 根方柱按抛物线崩飞、木牌被斩断成两片纷飞。
3. **印刷层**：全片叠一层 SVG 半调网点与暗金纸纹；暗场靠局部金色光源提亮，不整屏压雾。
4. **字景合一**：唱词只以战幡、符咒、罪状牌、印章、竖排大字出现，没有底部字幕条，也没有顶部章节框与 BPM 仪表盘。

音频：**全部由代码合成**。`scripts/score.py` 用分轨总线 + 卷积混响 + 侧链 + 胶水压缩 + 前瞻限幅 + 两遍 loudnorm（-14 LUFS）产出一版 10.000 s 的配乐；旋律直接由对齐 JSON 驱动（每字一个音，五声音阶），主唱是按拼音韵母做 F1/F2/F3 共振峰合成的合成人声——这就是"填词调音"里的那条人声轨。产物 `public/audio/climax_mix.wav`（播放）与 `public/audio/drums_stem.wav`（频谱源）。

频谱驱动：`drums_stem.wav` 经 `visualizeAudio()`（32 波段，`smoothing`，`optimizeFor: 'speed'`）拆成 low / mid / high，分别驱动**相机震动**、**闪白与冲击环**、**边缘径向辉光**。映射与参考电平见 `src/audio/spectrum.ts` 的 `useStemEnergy()`。

> 规格说明（对应 `AGENTS.md` 第 0 条）：主片母版仍是 1920×1080 / 60 fps。复刻段因为要对齐 30 fps 的参考素材，**显式**在 `src/config/theme.ts` 的 `CLIMAX` 中声明 30 fps / 300 帧，而不是在调用点偷偷改帧率；所有 cue 仍由 `frameFromSeconds()` 从秒换算。

## 技术栈

- Remotion `4.0.537`（锁定精确版本）
- `@remotion/media-utils` / `@remotion/three` `4.0.537`（与 remotion 逐位一致）
- `three 0.186.1` / `@react-three/fiber 9.8.2`（无 GPU 时走 SwiftShader，仍可渲染基础几何体）
- React `19.3.1` / TypeScript `5.9.3`
- 1920×1080 / 复刻段 30 fps / PNG frame sequence

## 目录

```text
src/
  index.ts                     Remotion entry
  Root.tsx                     主线注册表（WukongPrologue + WukongClimaxSegment）
  compositions/
    WukongPrologue.tsx         阶段一视觉底片（非正片歌词）
  sequences/
    WukongClimaxSegment.tsx    阶段三高潮复刻段（四镜 / 30 fps / 300 帧 / 纯代码）
    senbonPlan.ts              分镜秒表 + 歌词锚点 + 冲击/震屏/反色 cue 的唯一来源
    climaxPlan.ts              对齐 JSON 的旧解析层（四镜仍复用其 fallbackEnergy）
  config/
    theme.ts                   四色宪法 / 画幅 / 安全区 / CLIMAX 交付规格
    fonts.ts                   FontFace 字体加载（缺失可回落）
  audio/
    spectrum.ts                32-band 鼓组频谱 + useStemEnergy 三频段能量
    sfx.ts                     音效 cue → frame 调度
  primitives/
    senbon_style/              ★ 纯代码视觉原语族（HalftoneOverlay / WukongSilhouette /
                               NandamenDoors / CourtSky / CelestialArmy / WarBanners /
                               EyeCut / CudgelImpact3D / SplitType / MountainCage /
                               Talismans / VerdictTags / FinalSeals）
    paperTexture.ts / PaperSurface.tsx   宣纸/麻纸/纤维/颗粒
    Vignette.tsx               暗角 + 胶片颗粒
    Seal.tsx                   朱砂毛边印章（仅 WukongPrologue 使用）
    Typewriter.tsx             严格的 text.slice 打字机
    pointCloud.ts / InkPointCloud.tsx    三维金墨点云
    ParticleRain.tsx           火星 / 飞灰 / 墨雨
    rigidBody.ts / RigidTextCollapse.tsx 预烘焙刚体坍塌
    BurstType.tsx              爆破字（单 Canvas 绘制，符合 §9.2；旧段遗留）
    Halftone.tsx               旧 Canvas 半调（新段用 senbon_style/HalftoneOverlay）
    RadialBurst.tsx            放射线 / 冲击环（旧段遗留）
    ComfySprite.tsx / BlenderAlphaVideo.tsx  预留：立绘与 Alpha 视频
  utils/
    math.ts                    确定性 rng/hash/noise/缓动/弹簧
    timing.ts                  秒 ↔ 帧唯一换算入口
    alignment.ts               字级对齐 JSON 类型与解析
  _archive_dufu/               杜甫原工程只读归档（不参与构建）
scripts/
  gen_plates.py                按 assets.manifest.json 生成 AI 板并规整为 1920×1080 PNG
  agy_image.mjs                Antigravity CLI 保活调用桥（stream-json）
  score.py                     合成整支配乐 + 逐字共振峰"人声"
  build_climax_assets.py       字级对齐（HPSS 起音 + DP + 节拍网格）
  verify_climax.py             对齐独立校验（≤50 ms 才 PASS）
  spectrum_probe.mjs           直接跑 media-utils 的 FFT 标定三频段
docs/
  AGENT_TOOLING.md             环境事实 / Antigravity 用法 / 脚本 / 踩坑（跨 session 复用）
  EXPLORATION_LOG.md           代码生成视频的探索日志（弯路、失败清单、可复用手法）
public/
  ai/                          2026-10-22 起清空：本段纯代码，不引用 AI 位图（见 public/ai/README.md）
  audio/                       合成配乐 + 鼓组总线
  alignment/                   字级对齐 JSON + 节拍网格
  comfy_sprites/ blender_renders/ fonts/   预留资产位
assets.manifest.json            镜头表 + AI 板清单（id/用途/尺寸/提示词/文件）
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
