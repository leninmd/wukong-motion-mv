# 孙悟空：金猴奋起千钧棒

> 一部以代码为笔、以鼓点为骨的填词调音 MV。
> 视觉节奏对标《千本樱》代码生成 MV；听觉与叙事张力对标《美猴王》鬼畜调音。

当前状态：**阶段五 · V5 真实造型资产 + 真三维 + 和纸反色**（2026-10-23）。

阶段一建立了全新 Remotion 仓库、素材契约、工程宪法 `AGENTS.md`，并用 `WukongPrologue` 验证了「宣纸纹 × 三维金墨点云 × 火星/飞灰 × 朱砂印 × 切片打字机」的合成链路。

阶段二逐镜头复刻了参考视频 `00:09–00:19`，但第一版依赖 5 张 AI 静态板与杜甫母版的展览框，被判定为“像放 PPT”。阶段三按《千本樱》的纯代码路线彻底重写：**删除全部 AI 静态背景、顶部章节框、BPM 仪表盘、常驻印章与底部 KTV 字幕条**，改由 SVG / Canvas 2D / Three.js 几何体实时绘制四镜，歌词作为战幡、符咒、罪状牌与印章进入画面。

阶段四（V4）把 10 秒重构成 **8 个微切镜 + 0.3 s 黑场**：四分屏微缩画卷、侧面旋风棍盾、眼部斜切横条、左下角俯瞰 3D 崩裂、五指山巨岩铁索、五层复合符咒、纯黑悬签阵、四连跳切高精度脸谱。新增 `OrnateSealStamp` / `ComplexOfudaTalisman` / `WukongFaceCloseup` / `IronChain` 等 13 个复合图元，并把「五层复合图元」「三分法侧影」「抽帧视觉自检」写进 `AGENTS.md §12`。

阶段五（V5）推翻了 V4 的「用代码画角色」：**孙悟空不再由 SVG 多边形拼**，改由
`scripts/build_wukong_assets.py` 把参考片真帧（六小龄童 00:18 的咬牙怒视）与生图网关的
四姿立绘离线烘焙成木刻套色与纯黑剪影，运行期只贴图；2B 换成移植自 `_archive_dufu/world3d.js`
的**真透视投影**（36 根八棱殿柱 + 3000 粒子 + 螺旋俯冲相机）；全片改为**和纸反色**的明暗节奏
（四色画格 → 满月逆光 → 宣纸白底 → 暗金崩裂 → 明暗裂谷 → 红黑版画），不再一黑到底靠荧光描边。
对应的硬约束写进 `AGENTS.md §13`。

> 本机无独立 GPU。V5 的角色资产是**离线烘焙**的：参考帧与立绘先进 `out/`，成品 PNG 进
> `public/wukong_assets/`，渲染期不发起任何网络或 AIGC 调用。

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

重建角色资产（可选，成品已入库；需要参考片与本机 cv2）：

```powershell
python scripts/build_wukong_assets.py
```

渲染高潮复刻段的验收静帧（30 fps / 300 帧）：

```powershell
$frames = @(8,22,50,85,120,160,200,270)
foreach ($f in $frames) {
  npx remotion still src/index.ts WukongClimaxSegment ("out/v5_check_f{0:000}.png" -f $f) --frame=$f
}
npx remotion render src/index.ts WukongClimaxSegment out/senbon_v5_mvp.mp4 --concurrency=4
```

抽帧后必须用 `read_image` / 看图逐项确认：① 右缘印章/文字不裁切；② 大圣不在 X=50%；
③ 黑场无上一镜残留；④ 有没有任何「几何拼凑小人」；⑤ 明暗节奏是否成立。再看接触表：

```powershell
python scripts\contact_sheet.py out\senbon_v5_mvp.mp4 out\senbon_v5_contact_sheet.png
```

音频与对齐自检：

```powershell
python scripts/build_climax_assets.py   # 仅在需要重建对齐时运行
python scripts/verify_climax.py         # 每个汉字起点距参考混音瞬态 <= 50 ms
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

## 高潮复刻段：八微切镜 + 黑场（真实资产 + 代码）

分镜切成八刀零九段（10 秒），每一刀的边界在 `src/sequences/senbonPlan.ts` 里由分镜秒表与对齐 JSON 共同解出：

| # | 帧 | 唱词 | 主体 / 构图 / 物理 |
|---|---|---|---|
| 1A | 0–30 | 玉境 | 四道竖幅**四色和纸画格**（米白南天门 / 深绯飞檐满月 / 深黛银戈林 / 泥金举棒剪影）+ 壹贰叁肆朱印跨框 |
| 1B | 30–75 | 十万天兵合围 | 780px 暖白满月偏左后方 + 云海；**真实剪影在 X=35%**；三层虚线椭圆棍影 + 箭雨 + 右缘天兵墙 |
| 2A | 75–98 | 怎敌我 | 整屏翻成**暖白宣纸**；−5° 玄黑金边横条内嵌**参考帧 00:18 的木刻眼部**；金色闪电；【怎】【敌】【我】 |
| 2B | 98–150 | 无坚不摧 | **真投影**：36 根八棱殿柱（斗拱+柱础）+ 3000 粒子 + 地面 3D 网格；螺旋俯冲；112 帧刀光；三圈地面波纹；左下真实立绘侧影 |
| 3A | 150–175 | 五指山下 | 整块黑山压下 + 暖金天光；**跪撑剪影**自下而上擦除入场；六道实体铁索 |
| 3B | 175–225 | 偿自由的罪 | 六张五层复合符咒弹簧钉入两侧山体：【五指山下】【偿】【自】【由】【的】【罪】 |
| 4A | 225–256 | 罪名是老孙 | `#050404` 纯黑深渊；三道铁索 + 三层白签；聚光灯下主牌依次翻面 |
| 4B | 256–291 | 不敬权威 | **红黑版画四连跳切**：白底墨版 / 朱砂反白交替；四枚裂纹朱印；290 白闪 |
| — | 291–300 | （留白） | 纯黑 `#000000`，只剩余音 |

### V5 原语（当前正片在用）

`src/primitives/senbon_style/` 与 `public/wukong_assets/` 是这一段的两套资产：前者是布景与排版，后者是**角色**（见 `AGENTS.md §13`）。

| 文件 | 作用 |
|---|---|
| `ClimaxAsset` | **角色唯一入口**：贴真实 PNG，负责残影（朱砂/青/金三层 CSS mask）与宣纸色边缘；不描边 |
| `CelestialCollapse3D` | 真投影八棱柱 + 3000 粒子 + 地面网格 + 螺旋俯冲 + 解析解碎裂 |
| `PaperStage` | 和纸底（`PaperField`）、满月（`MoonDisc`）、云浪（`CloudBank`）、墨点（`InkSpecks`） |
| `FourPaperPanels` | 四色和纸画格 + 编号朱印 + 三幕小景（南天门/飞檐/银戈林） |
| `MoonSpinShot` | 满月逆光 + 三层虚线椭圆棍影 + 箭雨 + 右缘天兵墙 |
| `EyeWoodblockShot` | 宣纸白底 + −5° 木刻眼部横条 + 金色闪电 + 三字 |
| `MountainCleft` | 黑山体 + 暖金天光 + 跪撑剪影 + 铁索 + 复合符咒 |
| `WoodblockJumpCuts` | 红黑版画四连跳切 + 巨印 + 裂纹 + 白闪 |
| `utils/threeDCamera` | 从 `_archive_dufu/world3d.js` 移植的透视相机（lookAt 正交基 + roll） |

复用不改的 V4 构件：`OrnateSealStamp`、`ComplexOfudaTalisman`、`IronChain`、`SuspendedTags`、`HalftoneOverlay`。
V4 的 `WukongRig` / `WukongFaceCloseup` / `ComicPanels` / `BoulderCage` / `CrumblingPalace3D` 等仍留在仓库作对照，但**不再被正片 import**。

### V4 纯代码原语（历史对照）

| 文件 | 作用 |
|---|---|
| `OrnateSealStamp` | 双层描金框 + 四角回纹 + 朱砂斑驳 + 八卦暗纹 + 竖排副标题 + 朱文小印 |
| `ComplexOfudaTalisman` | 宣纸毛边 + 朱砂双框 + 云雷角花 + 八卦暗印 + 敕令符头 + 毛笔字 + 封印 + 金钉 |
| `WukongFaceCloseup` | 京剧猴王金桃心脸谱：36 道放射虹膜、竖瞳、金火、紧箍、锁子甲、战损 |
| `IronChain` | 面环/边环互扣、销钉、卸扣、铭文、辉光、可 sag；取代虚线 |
| `ComicPanels` | 4×480px 四分屏微缩画卷；卡片 440px + 20px 安全距；整板不旋转 |
| `StaffShield` | 3 圈反向弧形刀光 + 2 圈半调网点环 + 14 根棍影 + 火花 |
| `SiegeCharge` | 40 天兵自右向左 + 弹飞箭矢 + 前景 blur(8px) 巨戈 |
| `CrumblingPalace3D` | Z 轴推进 + 15° 滚转；36 根柱全断 + 矮桩 + 朝镜头飞溅 |
| `GiantSlashArc` | 18° 锥形刀光 + 红/金/青残影 + 半调 + 白热刀脊 + 火星 |
| `UnbreakableBanner` | 右上描金书法，9° 切开、12px 错位；刀光线 0.08 s 内淡出 |
| `EyeCutBand` | −5° 双金边眼部横条 + 三枚重影金字 |
| `SuspendedTags` | 纯黑悬签阵：铁索 + 三层白签 + 聚光灯 + 翻面 + 金火 |
| `BoulderCage` | 五道浮世绘肌理巨岩 + 六道铁索 + 侧面跪撑 + 扬尘 |
| `WukongRig` | 2.5D 骨骼角色；V4 新增 `side_lunge / kneel_boulder / back_overlook` 三姿态 |

这些组件全部是**时间函数**：没有 `Math.random()`、没有 `Date.now()`、没有跨帧状态；随机量来自固定种子 `hash(seed, i)`。歌词文字始终是单个文本节点，不做逐字 DOM 动画。

### 画面精致的四个抓手

1. **三层视差**：满月/飞檐（0.22×）→ 60 天兵（中速合拢）→ 宫灯/火星/光条（高速划过）。镜头一动就出纵深。
2. **物理而不是淡入淡出**：门板被拉开、战幡被弹簧砸落、山柱按节拍砸下并触发纵向震屏、40 根方柱按抛物线崩飞、木牌被斩断成两片纷飞。
3. **印刷层**：全片叠一层 SVG 半调网点与暗金纸纹；暗场靠局部金色光源提亮，不整屏压雾。
4. **字景合一**：唱词只以战幡、符咒、罪状牌、印章、竖排大字出现，没有底部字幕条，也没有顶部章节框与 BPM 仪表盘。

音频：V3 起改用参考视频 **09.000–19.200 s 的真实摇滚唱段** `public/audio/climax_real_vocal.wav`（V3 §12-A 的决策，V4 沿用）。旧版 `climax_mix.wav` 的纯代码合成配乐仍保留在仓库，但正片不再使用。成片音轨与 `climax_real_vocal.wav` 的相关系数为 **0.99965**（AAC 往返）。

频谱驱动：`visualizeAudio()`（32 波段，`smoothing`，`optimizeFor: 'speed'`）直接绑定真实唱段，按 `CLIMAX_VOCAL_REFERENCE` 重新标定 low / mid / high，驱动**相机震动**、**闪白与冲击环**、**边缘径向辉光**。与 `AGENTS.md §3` 的“必须绑鼓组 stem”冲突已在 `docs/EXPLORATION_LOG.md` §12-A 登记。

> 规格说明（对应 `AGENTS.md` 第 0 条）：主片母版仍是 1920×1080 / 60 fps。复刻段因为要对齐 30 fps 的参考素材，**显式**在 `src/config/theme.ts` 的 `CLIMAX` 中声明 30 fps / 300 帧，而不是在调用点偷偷改帧率；所有 cue 仍由 `frameFromSeconds()` 从秒换算。

## V5 交付物（2026-10-23）

| 文件 | 说明 |
|---|---|
| `out/senbon_v5_mvp.mp4` | 1920×1080 / 30 fps / 10.005 s / h264 + aac 48k stereo |
| `public/wukong_assets/` | 7 张真实造型资产 + `manifest.json` + `README.md` |
| `out/v5_check_f008.png` | 1A 起手：四格依次落位 |
| `out/v5_check_f022.png` | 1A 落定：四色画格 + 四枚朱印跨框 |
| `out/v5_check_f050.png` | 1B：满月逆光 + 真实剪影 X=35% + 棍影 + 天兵墙 |
| `out/v5_check_f085.png` | 2A：宣纸白底横条内的木刻眼部 + 【怎】 |
| `out/v5_check_f120.png` | 2B：真三维崩裂 + 左下侧影 + 【无坚不摧】 |
| `out/v5_check_f160.png` | 3A：黑山 + 天光 + 跪撑剪影 + 铁索 |
| `out/v5_check_f200.png` | 3B：六张复合符咒钉壁 |
| `out/v5_check_f270.png` | 4B：朱砂反白版画怒颜 + 巨印 |
| `out/senbon_v5_contact_sheet.png` | 20 个时间点接触表 |

外部动效先验库在 `skills/`（只读、不打包），取用点见 `skills/README.md`。

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
    WukongClimaxSegment.tsx    阶段五高潮复刻段（八微切镜 / 30 fps / 300 帧 / 真实资产 + 代码）
    senbonPlan.ts              分镜秒表 + 歌词锚点 + 冲击/震屏/反色 cue 的唯一来源
    climaxPlan.ts              对齐 JSON 的旧解析层（仍复用其 fallbackEnergy）
  config/
    theme.ts                   四色宪法 / 画幅 / 安全区 / CLIMAX 交付规格
    fonts.ts                   FontFace 字体加载（缺失可回落）
  audio/
    spectrum.ts                32-band 鼓组频谱 + useStemEnergy 三频段能量
    sfx.ts                     音效 cue → frame 调度
  primitives/
    senbon_style/              ★ V5 原语族（ClimaxAsset / CelestialCollapse3D / PaperStage /
                               FourPaperPanels / MoonSpinShot / EyeWoodblockShot /
                               MountainCleft / WoodblockJumpCuts / OrnateSealStamp /
                               ComplexOfudaTalisman / IronChain / SuspendedTags /
                               HalftoneOverlay）+ V4 对照件（WukongRig / WukongFaceCloseup 等）
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
    threeDCamera.ts            透视相机（移植自 _archive_dufu/world3d.js）+ 螺旋俯冲轨道
  _archive_dufu/               杜甫原工程只读归档（不参与构建）

public/
  wukong_assets/               ★ V5 真实造型资产（剪影 / 木刻脸 / 眼部）+ manifest + README
  audio/ alignment/ fonts/ ... 音频、字级对齐、字体契约

scripts/
  build_wukong_assets.py       ★ 参考帧 + 立绘 → 木刻套色 / 纯黑剪影
  contact_sheet.py             成片接触表
  agy_image.mjs                生图网关桥（离线，只在烘焙期用）
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
