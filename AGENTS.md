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
