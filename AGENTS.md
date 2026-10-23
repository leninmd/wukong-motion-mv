# AGENTS.md — 《孙悟空：金猴奋起千钧棒》工程宪法

本文件是刚性工程约束，不是风格建议。任何代码、分镜、素材接入或自动化脚本都必须遵守；冲突时以本文件为准。

## 0. 工程定位

- 形态：填词调音 + 代码视觉 MV，Remotion/React/TypeScript 合成。
- 视觉节奏参照代码生成 MV《千本樱》；听觉与叙事张力参照《美猴王》鬼畜调音视频。
- 默认母版：1920×1080、60 fps。变更交付规格必须先改 `src/config/theme.ts` 与验收说明。
- 渲染确定性：禁止 `Math.random()`、`Date.now()`、`performance.now()` 进入画面计算。随机量必须来自固定种子的 `rng(seed)` / `hash(seed, i)`。

## 1. 时钟唯一基准

- 所有歌词动效、分镜切镜、音效命中点，必须读取 `public/alignment/*.json` 中每个单元的 `start` / `end`（单位：秒），再乘以当前 Composition 的 `fps` 动态计算帧号。
- 只允许通过 `src/utils/timing.ts` 的 `frameFromSeconds()` / `frameSpanFromSeconds()`，或 `src/utils/alignment.ts` 的 `toFrameSpan()` 完成秒 → 帧换算。
- 严禁在场景代码中出现硬编码魔法帧号（例如 `132`、`frame === 287`、`startFrom={480}`）。
- 对齐 JSON 不得预存帧号。帧率切换时，仅仅通过 `fps` 重新计算即可保持同步。
- 音频、字幕、特效与切镜必须共享同一份对齐 JSON / beat grid，不允许各自维护第二套时间轴。
- 引擎演示（如 `WukongPrologue`）可以声明“秒”常量，但不得冒充正片歌词或切镜；正片场景必须走 alignment。

## 2. 高性能文本渲染

- 打字机或逐字显现必须基于 `useCurrentFrame()` 做字符串切片：`text.slice(0, count)`。参考实现：`src/primitives/Typewriter.tsx`。
- 严禁把每个汉字拆成独立 DOM 节点，再对单字执行 `opacity` / `filter` / `transform` 动画；这会破坏中文整形、放大 DOM 并让 60 fps 渲染失速。
- 需要逐字位移、粒子化或刚体效果时，统一在单个 `<canvas>` 或单个 SVG 中绘制；不得生成 N 个绝对定位的 `<span>`。
- 大段文字优先使用一个文本节点 + 整组变换；粒子文字必须先离屏采样，再绘制点阵。

## 3. 频谱计算规范

- 使用 `visualizeAudio()` 时必须绑定独立鼓组轨（`drums_stem.wav`）或伴奏轨（instrumental），不得绑定主混音或孙悟空干声。
- 强制参数：`numberOfSamples: 32`（上限 64）、`smoothing: true`、`optimizeFor: "speed"`。
- 统一入口：`src/audio/spectrum.ts` 的 `SPECTRUM_SETTINGS` 与 `useStemSpectrum()`。禁止在场景里复制另一套 FFT 参数。
- 频谱只驱动视觉重音，不得反向修改音频；音频本身由外部调音/母带流程落盘。

## 4. 重资产解耦

- 复杂 3D 物理破碎、角色立绘、金箍棒特效不在 Remotion 运行时生成。
- 角色立绘：ComfyUI 生成并完成抠图，透明 PNG 放入 `public/comfy_sprites/`，通过 `src/primitives/ComfySprite.tsx` 使用 `<Img />` 合成。
- 3D 特效：Blender 渲染带 Alpha 通道的 `.webm`，放入 `public/blender_renders/`，通过 `src/primitives/BlenderAlphaVideo.tsx` 使用 `<OffthreadVideo transparent />` 合成。
- 不给 `OffthreadVideo` 加逐帧 CSS 遮罩/滤镜链。需要调色时，在 Blender/ComfyUI 侧完成，或在合成层用一次性色调覆盖。
- 素材文件名必须稳定、可版本化；禁止依赖本机绝对路径。

## 5. 色彩与美学基调

全片主色调锁定为以下四种，不得引入第五个主色：

- 玄黑底色：`#0B090A`
- 宣纸米白：`#F4EFE6`
- 朱砂赤红：`#D93025`
- 鎏金亮黄：`#FCC934`

审美要求：国画水墨留白 × 术力口高对比度视觉张力。暗场不能糊成灰雾；亮场不能把纸纹洗白。任何全屏叠加层必须先折损预算，文字区必须保留局部对比护罩，而不是整屏压暗。

## 6. 目录与注册边界

- `src/primitives/`：可复用图形、物理、排版、资产组件；不得包含杜甫文案。
- `src/utils/`：纯函数、确定性数学、时钟换算、对齐解析。
- `src/audio/`：频谱与音效调度；只消费 `public/audio/`。
- `src/config/`：主题、字体、常量和渲染规格。
- `src/compositions/`：正片与底片 Composition。
- `src/_archive_dufu/`：只读归档，禁止被 `src/Root.tsx` 或任何活动场景 import。
- `src/Root.tsx` 必须保持轻量：只注册主线 Composition，不得注册 9 个杜甫分镜或任何归档组件。
- 资产目录契约见 `public/audio/README.md`、`public/alignment/README.md`、`public/comfy_sprites/README.md`、`public/blender_renders/README.md`。

## 7. 质量门

提交前至少通过：

```powershell
npm run typecheck
npx remotion compositions src/index.ts
```

修改 Root 注册或关键 primitive 后，增加一次实际 still 渲染：

```powershell
npx remotion still src/index.ts WukongPrologue out/qa-prologue.png --frame=240
```

- 禁止用“能编译”替代“能渲染”。
- 禁止把旧帧号、旧文案、旧杜甫依赖带入新场景。
- `@remotion/media-utils` 必须与 `remotion` 精确同版本（当前 `4.0.537`），禁止 `^` 漂移。

## 9. 画面与资产的刚性要求（2026-10 增补）

1. **每一刀必须有可一眼识别的主体**。检查标准：把任意抽帧缩到 320×180，仍能说出"这一格在拍什么"；做不到就重设计，而不是加特效。
2. **禁止把每个汉字拆成独立 DOM 节点再逐字做 `opacity` / `transform` / `filter` 动画**（含 SVG `<text>` 逐字节点）。逐字显现只用 `text.slice(0, n)`；逐字位移、粒子化、爆破字一律在**单个 `<canvas>` 或单个 SVG** 内绘制。
3. **参考片只作为构图与景别参考**，成片必须能独立成立：要么有 `public/ai/*.png` 的 AI 美术板，要么是纯代码方案。AI 板必须 ≥1920×1080 PNG、需要透明时保留 alpha、文件名稳定、在 `public/ai/README.md` 登记，禁止在代码里引用 AIGC 厂商的本机会话路径。
4. **AI 板先写清单再生图**：镜头表 + `assets.manifest.json`（id / 类型 / 用途 / 尺寸 / 提示词 / 文件）先行，生成后逐张校验尺寸与是否真正落盘；禁止先生成一堆再回头拼故事。
5. **交付前必须出接触表**（≥12 个时间点拼图）自检；单帧好看不算数，要看镜头之间是否成立。
6. 主时钟仍以 `public/alignment/*.json` 为准；AI 板、音频、特效都不得自带第二套时间轴。
7. 帧率：主片 60 fps；本复刻段沿用 `src/config/theme.ts` 的 `CLIMAX`（30 fps / 300 帧）并已在此登记。
8. 探索期放宽项：配色允许在四色基础上做明度/色相微调以贴合 AI 板，但**主视觉仍以玄黑 / 宣纸 / 朱砂 / 鎏金为准**；放宽只允许发生在复刻段，不扩散到主片。

## 10. 工具与外部依赖

- 环境事实、Antigravity 生图调用方式、可复用脚本、踩坑清单，统一记录在 [`docs/AGENT_TOOLING.md`](docs/AGENT_TOOLING.md)。
- 生图只允许通过 `scripts/gen_plates.py`（读 `assets.manifest.json`）或 `scripts/agy_image.mjs`（会话保活桥）调用，禁止在场景代码里发起任何网络/AIGC 调用。
- 新增外部能力时，必须同时更新 `docs/AGENT_TOOLING.md`，否则下一个 session 视为不存在。

## 11. 探索日志（强制追加）

- 文件：[`docs/EXPLORATION_LOG.md`](docs/EXPLORATION_LOG.md)。
- **触发条件**：任何一次"视频生成技术更新"——包含但不限于：新增/替换画面渲染方式（纯代码 / AI 板 / 3D 资产）、生图管线与提示词策略、音频合成与母带、转场系统、排版系统、镜头运动模型、渲染规格与帧率——都必须在**同一次提交里**追加一节。
- **每条至少写**：日期 / 动机 / 做法 / 结果（含证据：帧号、截图路径、参数、耗时）/ 结论（保留还是回滚）/ 影响到的文件。
- **只加不改**：被推翻的结论保留原文，在新条目里标注"推翻第 N 条"。把弯路写下来比把成功写漂亮更有价值。
- **必须写代价**：花了多久、生成了几次、返工几轮。只写"成功了"不算记录。
- 新增外部能力时，同一次提交里同步更新 [`docs/AGENT_TOOLING.md`](docs/AGENT_TOOLING.md)。

## 12. 五层复合图元铁律 + 微切镜构图（2026-10-23 增补，V4）

### 12.1 五层复合图元标准（5-Layer Compound Component Rule）

任何出现在画面上的**战幡、符咒、印章、石柱、木牌、铁索**，严禁用单一 DOM / SVG
节点绘制（一个 `<rect>` 加一个 `<text>` 不算图元）。每个视觉构件必须封装为独立
可复用组件，并至少包含以下五层：

1. **主体底色与宣纸 / 网点纹理层**：不是纯色块，要有纤维、纸屑、半调或石纹。
2. **外粗内细双层描边层**：外框厚重、内框纤细，中间留出一条暗缝。
3. **四角传统回纹 / 云雷纹角花层**：四角必须有独立角花，不允许直角裸边。
4. **内部暗纹层**：八卦、盘龙、雷纹、篆书底纹等低透明度暗印，压在文字之下。
5. **核心书法大字与朱文小印章层**：大字为单文本节点（AGENTS.md §9.2），旁边
   必须有一枚朱文小印或编号印，形成材质对比。

对应实现（V4）：
`OrnateSealStamp.tsx`、`ComplexOfudaTalisman.tsx`、`IronChain.tsx`、
`ComicPanels.tsx` 的分格卡片、`BoulderCage.tsx` 的巨岩。新增同类构件必须复用
这些组件，禁止在场景文件里再写一份「白底红框矩形」。

### 12.2 镜头语言：三分法侧影 + 0.6–1.2 秒微切镜

- **禁止中心图腾**：全身剪影不得默认站在 `X=50%` 正对镜头。全身镜头必须落在
  `X=22%` / `X=35%` / `X=78%` 的黄金分割位，并优先使用侧面、背影或仰角透视。
  中心位只留给肉眼特写、对称仪式镜头或刻意的静止。
- **微切镜密度**：10 秒（300 帧 @ 30 fps）至少 **8 个微切镜**；重击 / 特写镜
  0.6–1.2 秒，发展镜（如 3D 崩裂、六符钉入）可到 1.8 秒。切点落在分镜板节拍上，
  且每刀只允许一个 camera intent（推 / 移 / 跟 / 视差之一）。
- **特写必须有信息量**：眼部/面部特写必须是独立高精度组件（至少包含脸谱金线、
  多层虹膜、粒子与头冠细节），禁止用「两个三角眼 + 感叹号」冒充。
- **黑场必须真黑**：纯黑段落禁止铺会抬灰的全屏渐变；上一镜的角色、道具、粒子
  必须在切镜时彻底卸载，不允许残留剪影。

### 12.3 多模态抽帧自检（Vision Self-Check）

每次改完分镜，必须先用 `npx remotion still` 抽至少 7 个关键帧，逐张**读图**确认：

1. 文字/印章是否被右缘或安全区裁切；
2. 全身剪影是否仍然居中呆板；
3. 黑场背景是否有上一镜残留；
4. 面部/眼部特写是否达到「放大 2.4 倍仍经得起看」的细节密度。

发现问题先改代码再重渲，不允许带着已知瑕疵去渲染整片。抽帧文件统一命名
`out/v4_check_f###.png`，成片为 `out/senbon_v4_mvp.mp4`，接触表
`out/senbon_v4_contact_sheet.png`。

## 13. 角色造型资产铁律（2026-10-23 增补，V5）

V4 用 SVG `<polygon>` 手写大圣的五官与身体，被判定为「折纸积木人」；V5 起作废。
本节约束的是**角色**，不是背景：建筑、云、字、粒子仍然用代码画。

1. **禁止用代码画角色**。孙悟空的脸、身体、手脚、冠、翎，只允许来自
   `public/wukong_assets/` 的真实资产（参考帧木刻套色 / 立绘抠底剪影），
   经 `<ClimaxAsset />` 或 `<Img />` 合成。新增角色形象必须先过
   `scripts/build_wukong_assets.py`，不允许在场景里临时拼多边形。
2. **剪影不描边**。纯黑剪影内部恒为 `#120D14`；需要从暗背景里分离时，只允许
   （a）背后给亮底（满月 / 天光 / 宣纸），（b）1px 宣纸色边缘，
   （c）朱砂/青/金三层错位残影。**禁止**黄色荧光描边、禁止 drop-shadow 光晕。
3. **明暗节奏优先于暗场炫技**。每 10 秒至少要有两种明亮底色（和纸米白、满月暖白、
   泥金）与两种深底（深绯、深黛/玄黑）交替；不允许整段一黑到底。
4. **三维必须是真投影**。需要空间运镜时，用 `src/utils/threeDCamera.ts` 的
   `createCamera`（移植自 `_archive_dufu/world3d.js`）；禁止在 2D 斜网格上摆矩形
   冒充透视。碎裂必须写成 `p = p0 + v·t + ½g·t²` 的解析解，禁止逐帧积分
   （Remotion 并发渲染会乱序求帧）。
5. **资产先烘焙后引用**。参考帧与立绘的原始文件落在 `out/`（gitignore），成品落在
   `public/wukong_assets/` 并在 `README.md` 与 `manifest.json` 登记来源、尺寸、sha。
   禁止在 `src/` 里出现生图会话路径或本机绝对路径。
6. **自检命名**：V5 起抽帧用 `out/v5_check_f###.png`，成片 `out/senbon_v5_mvp.mp4`，
   接触表 `out/senbon_v5_contact_sheet.png`。§12.3 的四条同样适用于 V5。

## 14. V6：真 WebGL + 2K 生图资产铁律（2026-10-23 增补）

本节**明确推翻** §13.2「剪影内部恒为 #120D14」、§13.4「三维用
`threeDCamera.ts` 手写投影」与 §13.6 的 V5 命名。不是风格建议，是必须执行的
工程约束。

1. **2B 必须走真 WebGL**。`@remotion/three` 的 `<ThreeCanvas>` +
   `@react-three/fiber` + `@react-three/drei` 的 `<Outlines>` / `<Edges>` +
   `@react-three/postprocessing` 的 `<EffectComposer><Bloom …/>`。
   禁止再手写 2D 透视投影；`CelestialCollapse3D.tsx` 与 `utils/threeDCamera.ts`
   已删除，不得恢复。
2. **EffectComposer 首帧必须补一次 advance**。`<ThreeCanvas>` 的
   `ManualFrameRenderer` 早于 composer 的 effect，直接渲染会得到纯底色。
   任何启用 `<EffectComposer>` 的 ThreeCanvas 必须在 composer 之后挂
   `LateAdvance`（`delayRender` + 34 ms 后 `advance(performance.now())`）。
3. **粒子必须确定性**。禁止直接使用会在 mount 时调用 `Math.random` /
   `randFloatSpread` 的 `<Sparkles>`；需要粒子刀光时用 `hash(seed, i)` 的
   本地点云，参数可对齐 `count=400 / scale=15 / size=6 / #FFF3D1`。
4. **禁止 480p 截帧放大**。脸、眼、建筑、天兵只允许来自生图网关的 ≥1024px
   素材；眼部横条最终 ≥2200×356，怒颜 ≥2048²。`public/wukong_assets/` 里
   不允许再出现参考视频截帧派生的面部/眼部资产。
5. **角色必须是四色套版木刻**。`scripts/build_wukong_assets.py` 的
   `posterize_character()`：rembg 去背 + 白边剥离 + `cv2.erode(3px)`，内部保留
   墨 `#120D14` / 朱砂 `#C8281E` / 鎏金 `#F5C242` / 宣纸 `#EAE0CE`。
   既禁止整块填死成黑墨团，也禁止保留白色贴纸描边。
6. **建筑/天兵必须矢量化**。南天门、凌霄殿、十万天兵一律
   `LANCZOS 2K → vtracer → resvg`；禁止再写 `<rect>` 搭门楼。SVG 用
   `scripts/rasterize_svg.mjs`，禁止 `cairosvg`。
7. **斜切大字禁止零高父容器**。文字层必须有显式 `height`，只用内联
   `clip-path: polygon(...)`；禁止依赖外部 SVG `<clipPath id>`。所有主标题
   必须画在 `HalftoneOverlay`、白闪、反色、暗角之后（zIndex ≥ 60）。
8. **交付前必须从最终 MP4 回抽 7 帧**：0.5 / 1.8 / 2.8 / 4.0 / 6.5 / 8.0 / 9.2 s，
   逐张读图确认：1A 建筑、1B 大字与天兵、2A 眼部横切、2B【无坚不摧】、
   3A 跪撑、4A 悬签、4B 2K 怒颜。只测 still 不测 MP4，视为未交付。
9. **命名**：V6 抽帧 `out/v6_check_f###.png`，成片 `out/senbon_v6_mvp.mp4`，
   接触表 `out/senbon_v6_contact_sheet.png`，MP4 回抽 `out/v6_mp4_<t>.png`。
10. **依赖锁版本**：`three 0.186.1`、`@types/three 0.186.0`、`@react-three/fiber
    9.8.2`、`@react-three/drei 10.7.9`、`@react-three/postprocessing 3.2.2`、
    `postprocessing 6.39.5`、`@remotion/three` / `@remotion/motion-blur` `4.0.537`；
    禁止 `^` 漂移。

## 15. V7：单武器光轮 / 满屏山体 / 实心重印（2026-10-23 增补）

1. **1B 只允许一件武器**。大圣立绘必须是双手结印/握拳、**静态立绘里没有棍**的
   `woodblock_charge.png`；旋转武器只允许 `CudgelWheel`（圆心对齐双手，赤金/朱砂
   同心刀光环 + 火星 + 断箭）。禁止再叠 `<Trail>` 冻结层，禁止“静态斜棍 + 旋转黄棍”
   同框。
2. **1B 天兵必须落地**。天兵层 `top=398 / height=760 / objectFit=cover`，底边越过
   画面；三层带墨线的云海吃掉交界；远景补凌霄殿天际线。黑字必须放进
   `VerticalCartouche`（220×704，深墨底 + 双层金框 + 朱砂云头 + 鎏金书法）。
3. **1B 叠层必须显式 z-index**：云海 1、光轮 4（在角色之后，避免棍身穿脸）、角色 5、题笺 10。带 `opacity`
   的 SVG 与带 `transform` 的角色 div 不能只靠 DOM 顺序。
4. **2A 必须是暗金放射场**，不允许整片空白宣纸；横条上下各 14px 鎏金刀锋带；
   【怎】【敌】【我】用黑底金边斜切牌匾，重拍 75 / 82 / 89 帧。
5. **2B 禁止过曝**。柱色 `#8E1A13` / `#C9BBA2`，金环 `emissiveIntensity 1.6`，
   ambient 0.35 / key 1.2 / spot 140；保留 Bloom 2.0。背景用紫红渐变，地面有
   发光阵纹与汉白玉台阶。左下角色必须随刀光 1.15→1.45 放大、做风场位移与
   三层错位残影。
6. **3A/3B 必须是满屏 2K 五指山**，岩面有金色梵文；六道 X 铁索画在角色之后，
   禁止再出现“晾衣绳穿过手掌”和左下灰色小字幕。生图网关 429 时允许用
   `scripts/build_mountain_fallback.py` 兜底，配额恢复后必须换回生图版。
7. **4B 脸必须两只眼睛完整入画**。4B 取景固定 `SCALES = [1.0, 1.02, 1.04, 1.0]`
   + `FACE_SHIFT = [84,120,156,188]`；四角必须是 `HeavySeal` 实心重印（270×270，
   实心墨/朱砂底 + 8px 鎏金外框 + 160px 白/金大字 + 刀劈裂纹），禁止透明空心框；
   每枚落地反色 2 帧。
8. **全片必须有统一画框**。0–290 帧挂 `SenbonStageFrame`：12px 乌木描金框 +
   四角回纹 + 80 颗确定性金火/残旗粒子；最后 9 帧黑场不挂。
9. **生图配额策略**：429 时可临时用兜底/已有素材，但必须在文档里写清楚；配额
   恢复后优先补生图。禁止把“429”伪装成“已生成”。
10. **命名**：V7 抽帧 `out/v7_check_f###.png`，成片 `out/senbon_v7_mvp.mp4`，
    接触表 `out/senbon_v7_contact_sheet.png`，MP4 回抽 `out/v7_mp4_<t>.png`。

## 16. V8：物理遮罩转场 / 真动态骨骼 / 跨量级跳切（2026-10-23 增补）

本节**明确推翻** §15.1「1B 只用无棍结印立绘」、§15.7「4B 固定
1.0/1.02/1.04」与 §15.10 的 V7 命名。不是风格建议，是必须执行的工程约束。

1. **五处物理遮罩转场必须保留**：`ShojiGate`（0–9 帧障子门拉开）、第 4 格
   撑开（26–34）、`SlashCrack`（70–76 刀光裂屏）、`MountainSmash`（144–156
   黑山云海对撞）、`ChainCurtain`（220–228 铁索黑幕）。禁止退回硬切；
   转场窗口只由 `CUE.wipe` 提供，场景渲染窗口允许跨镜重叠。
2. **1B 必须是侧身战姿 + 斜向椭圆棍盘 + 双手补片**：底层
   `woodblock_spin.png`；`CudgelVortex` 中心落在双手 `(619, 786)`，
   `rotate(-25deg) scaleY(0.5)`，最上缘必须低于下巴；双手补片是同一张立绘的
   **两块小 `inset` 裁剪**，禁止再用一块大矩形把整个盘面盖死（V8 第一版事故）。
3. **题笺排版**：`VerticalCartouche` 文字从 `top:100` 起排、`fontSize 52`、
   `letterSpacing 2`，禁止 flex 垂直居中；云头 6–52px，文字必须留 ≥40px 净空，
   六个字 100% 完整。不允许再出现「万天兵合围」。
4. **2B 相机不得从天际线内部起手**：相机起手角 `0.62`（+z 侧），120 座
   天际线全部在御座背后 `z −16…−42`；禁止再放“环城”实例把镜头包住。
5. **2B 双动作帧**：98–111 帧 `spin` 蓄力，第 112 帧硬切 `panel4` 腾空劈斩，
   禁止同一张图平移 50 帧。刀光命中后必须叠 `ForegroundDebris`（18 块
   7–49px 不规则黑岩，最大 2.1 倍），禁止再出现满屏金边六边形。
6. **3A/3B 必须七层**：山体压降（1.24×/−120px → 1.0/0，150–158 帧）、
   流动经文（12 列）、前景岩挤压、铁索、黑云河、火焰/落石、大圣震颤。
   `FlameAura`/`FlameFront` 必须分叉火舌，禁止用单椭圆/水滴冒充火焰。
7. **4B 眼睛锚点**：`face_glare_woodblock.png` 的双眼中心实测为
   `(836, 714)`（橙色虹膜连通域），不是 `(678,612)`；缩放/旋转以该点为
   `transform-origin`，双眼必须钉在画面 45%。四切倍率固定
   `1.05 / 1.42 / 1.95 / 1.25`，旋转 `0° / −6° / +5° / 0°`；禁止
   `1.0→1.04` 的伪缩放。
8. **禁止整屏反色盖掉 4B 色彩**：`invertAt` 只保留 112–113 帧的 2B 刀光
   Impact Frame，四枚巨印落地不再整屏反色。4B 的三种色调（宣纸 / 黑金红 /
   红黑 Impact）必须各自成立。
9. **命名**：V8 抽帧 `out/v8_check_f###.png`，成片 `out/senbon_v8_mvp.mp4`，
   接触表 `out/senbon_v8_contact_sheet.png`，MP4 回抽 `out/v8_mp4_<t>.png`。
10. **交付前必须回抽 258 / 266 / 274 / 282 四帧**，确认
    1.05→1.42→1.95→1.25 的构图/色彩跳变；另回抽 1.8s 确认题笺六字完整。


## 17. V8-Blender：离线三维镜头管线（2026-10-23 增补）

本节**明确收口** §14.1「2B 必须走真 WebGL」在 2B / 1B / 3A / 4A 上的适用范围：
复杂三维与碎裂从本轮起**不在 Remotion 运行时生成**，而是 Blender 离线烘焙。
`@remotion/three` 不再出现在 `WukongClimaxSegment` 的依赖树里。

1. **唯一规范模块**：所有 `scripts/blender/b_shot*.py` 必须 `import ukiyoe_style as uk`，
   禁止各自复制渲染/材质设置。规范内容：`BLENDER_EEVEE` / 1920×1080 / 30 fps /
   Motion Blur / 合成器 Bloom / `ShaderToRGB → ColorRamp(CONSTANT)` 三色
   `#120D14`、`#9E1F18` 或 `#E8DEC8`、`#F5C242` / Freestyle 2.2 px `#0A0808`。
2. **透明层只能是 PNG 序列**：本机 ffmpeg 的 webm muxer 丢 VP9/VP8 alpha，
   ProRes 4444 在 Remotion 合成器里解成噪点（实测，见 `docs/AGENT_TOOLING.md` §16.3）。
   1B / 3A 的透明素材落在 `public/blender_renders/shot1_frames`、`shot3_frames`，
   由 `BlenderAlphaSequence.tsx` 逐帧读取。**不要再写 `<OffthreadVideo transparent />`
   指向 .webm/.mov**，会得到空层。
3. **不透明镜头走 `BlenderPlate.tsx` + `.mp4`**：2B（55 帧）、4A/4B（65 帧）。
4. **4B 的 3D 只出现在每刀第 1–2 帧**：`abyssInsert` 由 `CUE.jumpCuts` 换算，
   第 3 帧必须回到 2K 怒颜，保证 258 / 266 / 274 / 282 四个验收帧仍是人脸。
5. **挂载点全部从 `CUE` 取秒、用 `frameFromSeconds()` 换算**，禁止写死帧号；
   1B 的 3D 盾中心必须钉在 `woodblock_spin.png` 的双手 `(623, 786)`，
   缩放 0.52，双手补片仍在其上。
6. **题笺文字下移 36px**（`VerticalCartouche` `top: 136`），云头与首字之间 ≥70 px 净空；
   任何改动后必须回抽 1.8 s 确认【十万天兵合围】六字完整。
7. **命名**：成片 `out/senbon_v8_blender.mp4`；合成自检 `out/v8_blender_check_f###.png`；
   MP4 回抽 `out/v8_blender_mp4_<t>.png`；接触表 `out/v8_blender_contact_sheet.png`。
8. **交付前必须从最终 MP4 回抽** 0.5 / 1.8 / 2.8 / 4.0 / 6.5 / 8.0 / 9.2 s 七帧 + 接触表，
   逐张读图确认 3D 纵深感、题笺完整度与 4B 跳切。

> 17.2 补充（2026-10-23 23:20）：逐帧位图落库前必须用
> `scripts/blender/png_to_webp.py` 转**无损 WebP**（像素一致，120 帧 199 MB → 68 MB），
> 运行时读 `shot1_frames/*.webp`、`shot3_frames/*.webp`；Blender 直出 PNG 留在 `out/`。
