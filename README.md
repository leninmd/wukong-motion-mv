# 孙悟空：金猴奋起千钧棒

> 一部以代码为笔、以鼓点为骨的填词调音 MV。
> 视觉节奏对标《千本樱》代码生成 MV；听觉与叙事张力对标《美猴王》鬼畜调音。

当前状态：**阶段二 · 高潮复刻段完成**。

阶段一建立了全新 Remotion 仓库、素材契约、工程宪法 `AGENTS.md`，并用 `WukongPrologue` 验证了「宣纸纹 × 三维金墨点云 × 火星/飞灰 × 朱砂印 × 切片打字机」的合成链路。

阶段二不再从零发散，而是**逐镜头复刻参考视频 `00:09–00:19` 的「天庭凌霄交战 × 五行山下压迫」**，落地为 `WukongClimaxSegment`（1920×1080 / 30 fps / 300 帧），并补齐了字级对齐、鼓组频谱驱动与动力学字幕三层管线。

## 快速开始

```powershell
npm install
npm run dev
npm run typecheck
npm run compositions
```

渲染高潮复刻段静帧（30 fps 下的第 45 帧＝交战瞬间，第 210 帧＝五指山特写）：

```powershell
npx remotion still src/index.ts WukongClimaxSegment out/climax_preview_45.png --frame=45
npx remotion still src/index.ts WukongClimaxSegment out/climax_preview_210.png --frame=210
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

## 高潮复刻段：12 个镜头

分镜切成 12 刀（10 秒），每一刀的边界都是一个 `unit id`，运行时由对齐 JSON 解出秒数再乘 fps：

| # | 段落 | 镜头 | 主体 |
|---|---|---|---|
| 01 | 天庭肃杀 | 全景推入 | 朱砂幡阵 + 大月 + 天兵剪影（分层视差） |
| 02 | 天兵合围 | 横移 | 幡阵特写（十万天兵合围六字直接挂在幡上） |
| 03 | 如意在手 | 举棒 | 金箍棒贯穿画面，日轮在棒后 |
| 04 | 一棒破阵 | 切分 | 三条切割光带扫过，闪白 |
| 05 | 秩序崩塌 |  whip | 方阵刚体坍塌 |
| 06 | 横扫千军 | 近身 | 多段扫击 + 火星 |
| 07 | 摧 | 冲击 | 全屏闪白 + 双爆字 |
| 08 | 五指压顶 | 砸落 | 五根石柱错峰砸下 |
| 09 | 石下 | 特写 | 石缝漏光、镜下小人比例 |
| 10 | 罪状 | 滑入 | 三张羊皮纸告示：罪名／不敬／权威 |
| 11 | 镇压 | 加压 | 镜头压到 1.4×，抖动拉满 |
| 12 | 罪名昭彰 | 收束 | 爆字 + 终闪 |

版画层常驻：`PosterFrame`（双重边框、角饰、侧栏竖排、朱印、顶部题签）+ `Halftone`（细网点 + 粗烫金颗粒，两次 pattern 烘焙）。

### AI 美术板 + 代码合成（现在的做法）

纯代码画不出插画密度，这一点已经过反复验证。现在的分工是：

1. **板负责"像画"**：`assets.manifest.json` 先写死镜头表与 5 张板的清单（id / 用途 / 尺寸 / 提示词 / 文件），再由
   `python scripts/gen_plates.py --only <id>` 通过本机 Antigravity CLI 的 `image-generator` 子 agent 生成，脚本自动规整成
   1920×1080 PNG 并校验落地。板存在 `public/ai/`，契约见 [public/ai/README.md](public/ai/README.md)。
2. **代码负责"像镜头"**：`Plate` 只做推轨 / 横移 / 呼吸浮动 / 四色罩染 / 网点；`CudgelSlash`、`BurstType`、`KineticLine`、
   `PosterFrame`、`ParchmentPanels`、粒子层继续叠在上面。
3. **板上留白给代码**：`bg_verdict` 的三张卷轴是空白的，`ParchmentPanels` 的 `bare` 模式只排"罪名/不敬/权威"与朱印，
   正好落在卷轴上。

一条硬规矩：**板缺失时自动回落纯代码底**（`PalaceHall` / `FiveFingerMountain`），渲染不会黑屏。

### 画面精致的四个抓手

`CourtDiorama` 按这四条重写了一遍，任何新镜头都应复用同一套：

1. **分层视差**：星空（0.18×）→ 云团（0.3×）→ 天际线（0.35×）→ 幡阵（0.55×）→ 灯阵（0.72×）→ 前景柱与碎石（1×），镜头一动就出纵深。
2. **次级运动**：幡按各自相位摆动并带褶皱阴影、灯笼按相位晃、天兵随拍点头、雾带与云团持续飘、余烬按深度分层下落——画面上没有静止元素。
3. **大气层次**：远景天际线 `blur(0.9px)`、雾带 `blur(14px)`、云团 `blur(18px)`，焦点始终留在中景；雾只画成薄带，绝不整屏压。
4. **前中后景框**：前景柱压住两侧、石栏压住下缘、幡阵压住上缘，中间留给月和主体——画面先有"框"，细节才有落点。
5. **有依据的光**：石缝两侧的岩面用渐变描边做"贴边受光"，月亮的辉光有明确衰减；不做无来源的全局泛光。

音频：**全部由代码合成**。`scripts/score.py` 用分轨总线 + 卷积混响 + 侧链 + 胶水压缩 + 前瞻限幅 + 两遍 loudnorm（-14 LUFS）产出一版 10.000 s 的配乐；旋律直接由对齐 JSON 驱动（每字一个音，五声音阶），主唱是按拼音韵母做 F1/F2/F3 共振峰合成的合成人声——这就是"填词调音"里的那条人声轨。产物 `public/audio/climax_mix.wav`（播放）与 `public/audio/drums_stem.wav`（频谱源）。

频谱驱动：`drums_stem.wav` 经 `visualizeAudio()`（32 波段，`smoothing`，`optimizeFor: 'speed'`）拆成 low / mid / high，分别驱动**相机震动**、**闪白与冲击环**、**边缘径向辉光**。映射与参考电平见 `src/audio/spectrum.ts` 的 `useStemEnergy()`。

> 规格说明（对应 `AGENTS.md` 第 0 条）：主片母版仍是 1920×1080 / 60 fps。复刻段因为要对齐 30 fps 的参考素材，**显式**在 `src/config/theme.ts` 的 `CLIMAX` 中声明 30 fps / 300 帧，而不是在调用点偷偷改帧率；所有 cue 仍由 `frameFromSeconds()` 从秒换算。

## 技术栈

- Remotion `4.0.537`（锁定精确版本）
- `@remotion/media-utils` `4.0.537`（与 remotion 逐位一致）
- React `19.3.1` / TypeScript `5.9.3`
- 1920×1080 / 60 fps / PNG frame sequence

## 目录

```text
src/
  index.ts                     Remotion entry
  Root.tsx                     主线注册表（WukongPrologue + WukongClimaxSegment）
  compositions/
    WukongPrologue.tsx         阶段一视觉底片（非正片歌词）
  sequences/
    WukongClimaxSegment.tsx    阶段二高潮复刻段（12 刀 / 30 fps / 300 帧）
    climaxPlan.ts              对齐 JSON → 分镜 / 爆破字 / 冲击 cue 的唯一解析层
  config/
    theme.ts                   四色宪法 / 画幅 / 安全区 / CLIMAX 交付规格
    fonts.ts                   FontFace 字体加载（缺失可回落）
  audio/
    spectrum.ts                32-band 鼓组频谱 + useStemEnergy 三频段能量
    sfx.ts                     音效 cue → frame 调度
  primitives/
    paperTexture.ts / PaperSurface.tsx   宣纸/麻纸/纤维/颗粒
    Vignette.tsx               暗角 + 胶片颗粒
    Seal.tsx                   朱砂毛边印章（收尾玉玺）
    Typewriter.tsx             严格的 text.slice 打字机
    pointCloud.ts / InkPointCloud.tsx    三维金墨点云
    ParticleRain.tsx           火星 / 飞灰 / 墨雨
    rigidBody.ts / RigidTextCollapse.tsx 预烘焙刚体坍塌
    CourtBlocks.tsx            天兵方阵刚体坍塌（单 Canvas）
    PalaceHall.tsx             一点透视长殿（AI 板缺失时的纯代码回落）
    Plate.tsx                  AI 美术板合成层（推轨/横移/罩染/网点）
    CudgelSlash.tsx            金箍棒横扫（拖影/扫弧/火星）
    FiveFingerMountain.tsx     五指山石柱镇压
    HeroTitle.tsx              竖排大字主视觉（单节点 + 整组变换）
    BurstType.tsx              爆破字（单 Canvas 绘制，符合 §9.2）
    KineticLine.tsx            卡点卡拉 OK 行（单 Canvas）
    ParchmentPanels.tsx        罪状卷轴（bare 模式只排字，落在 AI 板上）
    PosterFrame.tsx            版画边框（双线/角饰/侧栏竖排/朱印）
    Halftone.tsx               半调网点 + 烫金颗粒
    RadialBurst.tsx            放射线 / 冲击环
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
public/
  ai/                          AI 美术板（manifest 驱动，见 public/ai/README.md）
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
