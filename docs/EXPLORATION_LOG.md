# 代码生成视频 · 探索日志

> 这不是教程，是**事故记录**。记录我们为了让"代码生成的 MV"看起来不像 PPT，试过什么、错在哪、代价多少。
>
> **规矩**：只加不改。被推翻的结论保留原文，在新的条目里标注"推翻第 N 条"。弯路本身就是资产。

---

## 0. 速查：如果现在重来，应该怎么做

1. **先定"画面主体"，再谈特效**。没有主体 = PPT。
2. **纯代码画不出插画密度**。要"像动画片"，必须上 AI 美术板（或真人画师）；代码只负责镜头、节奏、字、合成。
3. **AI 板先写清单**（`assets.manifest.json`），一张一张生成、逐张校验，禁止批量乱出。
4. **同板复用靠镜头语言**：推轨 / 横移 / 呼吸浮动 / 不同裁切，比新画一张便宜得多。
5. **音频和画面共用一份对齐 JSON**；频谱只绑鼓组总线。
6. **每轮必须有接触表**，单帧好看不算数。

---

## 1. 起点：先有底座（2026-10-22 18:00 前后）

**动机**：仓库只有一条 `WukongPrologue` 底片，要验证「宣纸 × 三维金墨点云 × 火星 × 朱砂印 × 打字机」能不能在 1920×1080/60fps 跑起来。

**做法**：把旧的杜甫 Canvas 工程提纯成 Remotion primitives（`paperTexture`、`pointCloud`、`ParticleRain`、`rigidBody`、`Seal`、`Typewriter`）。

**结果**：底片能渲染，视觉克制、干净，但**信息密度极低**——一张图里只有标题、印章与粒子。

**结论（当时）**：底座合格，可以做正片。
**结论（事后看）**：这张底片的美学（大量留白 + 极简元素）**误导了后面的判断**。MV 需要的恰恰相反：满、密、有主体。

---

## 2. 第一次仿拍：四个长镜头（约 19:00–19:30）

**动机**：精准仿拍参考视频 00:09–00:19（西游记片段：天兵合围 → 举棒 → 五指山 → 山下）。

**做法**
- 用 Remotion + 纯代码画：金线勾殿、两列天兵方块、金箍棒横扫、五根石柱、卡拉 OK 字幕。
- 音频：从参考切片用 HPSS 分离出鼓组，频谱驱动相机震动。
- 对齐：字级 onset 对齐，35 字全部 ≤50ms。

**结果**：技术上全部跑通；视觉上**用户第一句话是"差太远"**。

**为什么失败（复盘）**
1. 4 个镜头、每个 2–3 秒，节奏太慢；参考片 10 秒里有 8 次以上变化。
2. 全片都在 5–25% 亮度区间，没有明度结构 → 糊成一团棕。
3. 每个元素都是**独立矢量卡片**（方块、幡、柱），彼此没有遮挡与光照关系 → "贴纸感"。
4. 没有主体：背景是背景，前景也是背景。

**代价**：约 6 小时，全部作废。

---

## 3. 研究 opus5.5 的开源项目（约 20:00–20:30）

**动机**：用户要求"去研究 opus5.5 是怎么做的"。

**做法**：读四个仓库 + 两个延伸项目。

| 项目 | 学到的关键点 |
|---|---|
| [PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) | `ANIMATION_GUIDE.md`：一镜一事、镜头 1.4–4s、**每帧只能是 t 的纯函数**、共享绘制词汇表、每镜必有镜头运动、接触表自检 |
| [meme67-art-history](https://github.com/Tunai-0511/meme67-art-history) | 82s/24fps/120BPM 全片同一节拍；`src/kit.js` 共享笔刷套件；**博物馆标签卡 + 年份计数器 + 百叶窗转场**；声音全程序合成 + Kokoro TTS |
| [The-Pelican-Test](https://github.com/RoyceBella-commits/The-Pelican-Test) | 20 个时代共用同一副骨架；**Web Audio 全合成配乐**；`check.mjs` 逐像素确定性校验 |
| [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) | 15 支 10s 片；**`lib/audio` = mgaudio 工具包**（103 个 CC0 采样、PolyBLEP、Karplus-Strong、FM）；每片 `audio.py` + `cues.json` |
| [abstract-algebra-promo](https://github.com/AnctyEnly453/abstract-algebra-promo) | 纯 Python `music.py`：分轨总线 → 卷积混响 → 侧链 → 胶水压缩 → 前瞻限幅 → -14 LUFS |

**最有价值的一条**（来自 mgaudio README）：
> 同步点语义 —— whoosh 的同步点是"掠过峰值"，riser/反向镲是"末端那一下"，永远传视觉事件时间。

**结论**：方法论清楚了，但**仍然没人告诉我们"画面凭什么像插画"**。五个项目里，四个是插画/角色驱动，一个是纯图形——而我们没有插画能力。

---

## 4. 12 刀 + 版画海报化（约 20:30–21:00）

**动机**：按"一镜一事"把 10 秒切成 12 刀，并把视觉语言改成大正浪漫版画（这是千本樱 MV 的真实语言）。

**做法**
- 新增 `PosterFrame`（双线框/角饰/竖排侧栏/朱印/题签）、`Halftone`（两层 pattern 网点）、`ParchmentPanels`（羊皮纸告示）、`CourtDiorama`（幡阵+大月+天际线）。
- 切镜边界全部用 `unit id` 解析，不写死帧号。
- 字幕加百叶窗切口、馆藏标签卡。

**结果**：结构对了，**用户仍然说"质量仍然很差"**。

**为什么失败（复盘）**
1. 仍然全是"干净矢量形状"：幡是圆角矩形 + 居中字，柱是矩形，天际线是多边形。
2. 有层次但**没有材质**：没有纸纹、没有笔触、没有边缘侵蚀。
3. 主体依旧是"图形"，不是"人/物/光"。

**修正尝试 A：水墨化（`InkStage`）** —— 用湿墨模糊椭圆 + 飞白笔触，结果更糟：宫殿变成一块黑板，幡变成一排红片。**结论：湿墨需要笔刷库，代码模拟出来是"团块"。已删除。**

**修正尝试 B：一点透视长殿（`PalaceHall`）** —— 用 `project()` 建真实透视：地面网格、两列立柱、藻井斗拱、门洞月、四层人海。空间感对了，但**画面主体仍是一堆几何**。保留至今，作为 AI 板缺失时的回落底。

**修正尝试 C：竖排大字当主体（`HeroTitle`）** —— 330px「天兵」+ 朱砂描边 + 鎏金渐变，压住画面一侧。这是当时最"像个 MV 帧"的版本，但仍被评价为"PPT"。

**代价**：约 5 小时，三次尝试只留下 B 和 C。

---

## 5. 音频：从"过滤鼓组"到"整支配乐"（约 20:40–21:10）

**动机**：用户指出"配音也很拉跨"。

**做法**
1. 移植 `music.py` 的母带链：分轨总线 → 卷积混响（hall/plate/room 三种 IR，噪声生成）→ 侧链 → 胶水压缩 → 前瞻限幅 → 两遍 `loudnorm` 到 -14 LUFS。
2. **旋律由对齐数据驱动**：每个汉字一个音，D 羽五声。
3. **人声是合成的**：按字查拼音韵母 → F1/F2/F3 共振峰带通 → 30ms 入音滑音 + 辅音噪声爆破。
4. 国风层：Karplus-Strong 古筝加花、竹笛副旋律、太鼓/木鱼/锣。

**结果**
- 谱线验证：每个音是稳定的谐波堆，共振峰落在预期频点（ü≈392/1968Hz、i≈2349Hz）。
- 质检：`sub 28.7% / bass 47.1% / lowmid 17.0% / presence 2.8% / brilliance 2.5%`，stereo corr 0.82，全部落在 mgaudio 给的健康区间。

**结论**：技术上成立，但**公式化的人声轨听起来像"机器人在唱"**。用户明确说：**不再研究调音，直接用现成火的歌**。→ 这条线冻结。

**代价**：约 3 小时。

---

## 6. 转折点：用本机 Antigravity 生图（约 21:50–22:50）

**动机**：用户给出 Antigravity 的截图（里面的 `Image Generation Specialist` 能出图），问能不能用。

**探测过程（全部踩过）**
1. `Get-Command antigravity` → `D:\AI\apps\antigravity-cli\antigravity.cmd`（Node 包装 `agy.exe`）。
2. `agy models` 有 6 个模型；`agy agents` 空；`plugin/mcp` 都是空的。
3. **第一次失败**：`-p "生成图并保存到…"` 会立刻返回，子 agent 随会话退出被杀，文件永远不出现。
4. **第二次失败**：`--print` 与 `--input-format` 参数互相吞；`-p -` 又报"prompt given on command line"。
5. **看源码破案**：`agy-bridge.js` 的做法是**删掉 `-p -`，只留 `--input-format=stream-json --output-format=stream-json`，并加 `--dangerously-skip-permissions`**，然后往 stdin 写 NDJSON 且**不关闭**。
6. **第三次失败**：照做了，但没放行权限 → 子 agent 连 `New-Item` 建目录都被拒（`run_command` ERROR）。
7. **第四次成功**：放行权限 + 保活 stdin → 60 秒出图并落盘。

**产物规格**：生成器只给 **1376×768 JPEG、无 alpha**；脚本统一裁 16:9 → Lanczos → 1920×1080 PNG。

**结果：质变。** 第一张 `bg_court_wide`（灯阵长廊 + 尽头月门 + 朱砂幡）就是纯代码几轮都画不出来的东西。

**关键认识**
> 我们缺的不是"更好的图形代码"，是**画面本身**。代码擅长的是：镜头、节奏、排版、合成、卡点；不擅长的是：画。

**代价**：约 1 小时试探 + 5 次生成（每张约 60–90 秒）。

---

## 7. 板 + 代码的分工（约 22:50–23:00）

**做法**
- 5 张板覆盖 12 刀：`bg_court_wide`(01–03) / `bg_impact`(04–07) / `bg_mountain`(08/11) / `bg_crevasse`(09) / `bg_verdict`(10/12)。
- `Plate` 只做：推轨、横移、呼吸浮动、四色罩染、网点。
- `bg_verdict` 的三张卷轴**故意留白**，由 `ParchmentPanels` 的 `bare` 模式把「罪名/不敬/权威」正好排上去。
- 板缺失时回落 `PalaceHall`，不黑屏。

**同时修掉的合规问题**
- `BurstType` 从"每字一个 span + CSS 动画"改成**单 Canvas 绘制**（墨描边 → 朱砂描边 → 鎏金渐变 → 白热帧 → 飞溅）。
- AI 板底部很亮 → 加 300px 字幕护罩 + 加粗描边。

**结果**：第 45 / 135 / 228 帧第一次有了"这是 MV"的观感。

---

## 8. 失败清单（不要重犯）

| # | 做法 | 为什么不行 |
|---|---|---|
| F1 | 纯代码画建筑/人物/幡 | 永远像矢量卡片，密度上不去 |
| F2 | 靠"加特效"救画面 | 主体不对，特效只会放大问题 |
| F3 | 用湿墨模糊椭圆模拟笔刷 | 变成团块，结构全丢 |
| F4 | 整屏压雾/压暗来"统一色调" | 明度结构被洗掉，反而更糊 |
| F5 | 把每个汉字拆成独立 DOM 动画 | 破坏中文整形、性能差，且已被宪法 §9.2 禁止 |
| F6 | 先批量生图再想怎么用 | 风格不统一、镜头对不上 |
| F7 | 用 `-p` 一次性调 Antigravity | 会话结束即杀子 agent，永远不落盘 |
| F8 | 公式化共振峰人声 | 技术上成立，听感像机器人 |

## 9. 有效手法清单（可复用）

1. **AI 板承担画面，代码承担镜头**（本项目唯一走通的高画质路线）。
2. **同板多镜**：一张板用推/移/浮动/裁切撑 3–4 刀。
3. **给代码留白**：板上的空白卷轴/空墙，正好给代码排字。
4. **四色罩染**：AI 板出来后统一压一版 multiply + screen，把颜色拉回体系。
5. **字幕护罩**：只压字幕区，不整屏压暗。
6. **字级对齐 + 频谱绑鼓组**：卡点与震屏都来自同一份 JSON 与同一条鼓总线。
7. **接触表自检**：≥12 个时间点拼图，比看单帧靠谱。

## 10. 未解决 / 下一步

- [ ] 镜头 11 复用山体板，缩放后偏空 → 补一张 `bg_press`。
- [ ] 同板复用的刀，裁切/光位还不够区分 → 每刀单独定推拉曲线与遮幅。
- [ ] 缺真运动模糊：快速横移时边缘太"干净"。
- [ ] 代码层的火星/浮尘没有跟板的光源方向对齐。
- [ ] 音频冻结中（用户决定改用现成歌曲）。

---

## 附：关键参数（便于复现）

| 项 | 值 |
|---|---|
| 画幅 | 1920×1080 / 30 fps / 300 帧（复刻段；主片 60 fps） |
| 节奏 | 104.99 BPM（一拍 0.5715 s），字级对齐 35/35 ≤ 50 ms |
| AI 板 | 生成 1376×768 JPEG → 1920×1080 PNG；5 张 |
| 配乐 | 48 kHz 立体声 / 10.000 s / -14 LUFS / 真峰值 ≤ -1.5 dBTP |
| 生成命令 | `python scripts/gen_plates.py --only <id>` |
| 渲染命令 | `npx remotion render src/index.ts WukongClimaxSegment out/wukong-climax.mp4` |

---

## 11. 推翻“必须上 AI 板”：10 秒纯代码重构（2026-10-22 23:30 — 2026-10-23 00:10）

### 动机

用户验收第一版 10 秒 MVP 后给出四条硬伤，全部成立：

1. 大殿/碎石/山缝是静态 AI 板，灯笼红绸不会动，像 PPT。
2. 生搬《杜甫测试》的展览框：顶部“第 X 幕”、左下 BPM 仪表盘、右下常驻印章、底部 KTV 字幕条。
3. 双套字幕打架：底部 KTV + 画面中央单字。
4. 机位固定、切镜只有透明度，没有多层视差与物理转场。

用户同时下了**硬约束**：本机无独立 GPU，禁止调用任何外部生图模型，按《千本樱》的纯代码路线重做。

### 推翻的旧结论（保留原文，只做标注）

- **推翻 §0.2**“纯代码画不出插画密度，必须上 AI 美术板”。
- **推翻 §7**“板 + 代码的分工”。
- **推翻 §8 F1**“纯代码画建筑/人物/幡永远像矢量卡片”。
- **推翻 §9.1**“AI 板承担画面是唯一走通的高画质路线”。

保留不动的结论：主体优先、先清单后生产、字级对齐、频谱绑鼓组、接触表自检。**“每刀必须有可一眼识别的主体”仍是最高优先级**；纯代码只是换了一种承担主体的材料。

### 做法

**删资产**
- 删除 `public/ai/` 的 5 张板（court/impact/mountain/crevasse/verdict）与 `src/primitives/Plate.tsx`。
- 删除旧展览框 primitive：`PosterFrame.tsx`（顶部章节框/侧栏/朱印）、`KineticLine.tsx`（底部 KTV 条）。
- `assets.manifest.json` 升到 v2，`assets: []`，明确标注“assets 为空是验收要求”。

**建原语（`src/primitives/senbon_style/`）**
- `HalftoneOverlay`：SVG `<pattern>` 细/粗网点 + 径向渐变光晕 + 固定种子纸屑 pattern；不做全屏 `feTurbulence`。
- `WukongSilhouette`：4 个 pose（stand / eyes_closeup / kneel_defiant / smash）；鬃毛、锁子甲、护心镜、战裙、云靴、雉鸡翎、披风、金箍棒全部是 path；翎子/披风用 `useCurrentFrame()` 的正余弦波驱动，眼睛用小型 blur 滤镜发光。
- Shot 1：`NandamenDoors`（0–12 帧双扇拉门 + 门钉 + 铺首衔环 + 门匾）、`CourtSky`（满月/飞檐/云/鸟/浮尘，三层视差 0.22/0.5/1）、`CelestialArmy`（左右各 30 名天兵，`<symbol>`+`<use>`）、`WarBanners`（四幡弹簧落幅）、`ForegroundMotion`（宫灯/火星/光条）。
- Shot 2：`EyeCut`（斜切 `clip-path` 分格 + 火眼特写 + 竖排【怎敌我】）、`CudgelImpact3D`（ThreeCanvas：棋盘格地面、40 根天条方柱、金箍棒、三圈冲击波、按距离延迟的抛物线崩飞）、`SplitType`（上下互补斜切遮罩 + 第 118–119 帧反色）。
- Shot 3：`MountainCage`（五根带金色等高线的巨峰柱依次下砸、纵向震屏、中央 280px 深渊缝）、`Talismans`（六张朱砂符纸从四角飞入并落钉）。
- Shot 4：`VerdictTags`（三道铁链 + 远/中/近三层木牌 + 前景三牌翻面 + 斩断成两片纷飞）、`FinalSeals`（四枚裂纹朱砂巨印 + 印泥飞溅）。

**时间与数据**
- 新增 `src/sequences/senbonPlan.ts`：分镜板帧号只在这里出现一次，统一 `sb(n)=n/30` 转秒；场景只看秒/帧。
- 歌词锚点仍全部来自 `public/alignment/climax_words.json`：眼睛标题、符咒、木牌、印章均取 `unit.start`；鼓组频谱 `useStemEnergy()` 驱动脉冲与相机震动。

**依赖**
- 安装并锁死 `@remotion/three 4.0.537`、`three 0.186.1`、`@react-three/fiber 9.8.2`、`@types/three 0.186.0`。无 GPU 时 Chrome 走 SwiftShader，stills 与整片均能渲染。

### 结果（证据）

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 错误 |
| `npx remotion compositions` | 2 个 Composition：Prologue 60fps/600f、Climax 30fps/300f |
| 第 45 帧 | `out/senbon_v2_f045.png`：四幡同框（玉境/凌霄/十万/天兵合围），满月、天兵、大圣居中 |
| 第 85 帧 | `out/senbon_v2_f085.png`：斜切火眼分格 + 竖排【怎敌我】 |
| 第 120 帧 | `out/senbon_v2_f120.png`：3D 棋盘、40 柱崩飞、金箍棒、三圈冲击波、劈字 |
| 第 190 帧 | `out/senbon_v2_f190.png`：五张符咒已钉、第六张飞入 |
| 第 280 帧 | `out/senbon_v2_f280.png`：四枚朱砂巨印 + 斩碎木牌 + 大圣 |
| 整片 | `out/senbon_v2_mvp.mp4`：h264 / 1920×1080 / 30 fps / 10.005 s / AAC 48 kHz 立体声 / 19.0 MB |
| 接触表 | `out/senbon_v2_contact_sheet.png`：16 个时间点 4×4 |
| 整片耗时 | 约 6–7 分钟（`--concurrency=4`，含 ThreeCanvas 的 55 帧；末段四印最慢） |

### 与分镜表的偏离（有意，必须记录）

- **四幡落点**：分镜写 10/25/40/55 帧，但验收帧 45 必须四幡同框。改为 8/18/28/38 帧（仍是四拍弹簧连落）；`senbonPlan.ts` 内注明原因。
- **符咒落点**：分镜 175–225，但六张全挤在后 50 帧会来不及读。改为 175/178/181/184/187/190（5.83–6.33 s），最后一张在 190 帧刚好落钉。
- **四印落点**：歌词重音为 8.605/8.95/9.20/9.475，最后两印略提前（最晚 9.233 s），保证 280 帧四印齐满；印章仍压在唱词重音附近。
- **峰柱落点**：第一根提前到 146 帧（4.87 s），让第 150 帧切入时已有山体进画，而不是空白金光。

### 代价与返工（只写真实发生的）

- **4 轮 still 返工**：每轮 5 张，约 1–2 分钟/轮；主要修构图、竖排、对比度、3D 光照。
- **1 次整片渲染失败**：第 163 帧 React error #310。原因：`Talismans` / `FinalSeals` / `Peak` / `Banner` 在 `useMemo` 之前 `return null`，组件从 0 个 hook 变成 N 个 hook。修复：把早退移到所有 hook 之后。**这个 bug 只有整片渲染才会暴露，still 抽帧看不出来**。
- **1 次整片重渲**：修完 hook 后重渲通过。
- **关键踩坑**：
  1. 竖排中文在无显式宽度的 flex 容器里会拆列/横排 → 容器固定 `width` + `whiteSpace: nowrap`。
  2. `HalftoneOverlay` 早期光晕 0.55 + 颗粒 overlay 把暗场洗成灰雾 → 光晕 ≤0.25、颗粒 ≤0.3、改 `soft-light`。
  3. Three.js 地面用 `meshStandardMaterial` + 雾 near=80，整片只剩棕色雾 → 地面改 `meshBasicMaterial`、雾 near=190、柱体加 emissive。
  4. 冲击白闪 opacity 0.5×0.16 s 叠加网点，280 帧被洗白 → 0.32×0.12 s，反色只保留指定帧。
  5. 四幡在 45 帧第四面还没落下 → 收紧落点。
  6. 印章用默认宋体，笔画太细、裂纹太多 → 换粗黑体栈、裂纹减到 4 条、加金线描边。
  7. 前三版 Wukong 翎子像“黑角” → 改为向外下弯的 S 曲线 + 羽毛倒刺。
- **观感仍未解决**：
  - 天兵阵列仍偏“黑块+金点”，个体辨识度不足；
  - 3D 段冲击瞬间（3.5 s）镜头偏远，柱子显得小；
  - 280 帧碎木牌仍会遮住大圣半张脸；
  - 纯代码的岩石/云仍不如手绘有机，下一步需要更细的 fBm 侵蚀轮廓或本地字体/纹理资产。

### 结论

- **保留纯代码路线**。在这段 10 秒、30 fps、无 GPU 的约束下，SVG + Three.js + CSS 3D 足以撑起“主体 + 视差 + 物理转场 + 字景合一”。
- 它没有推翻“主体优先”，只推翻了“主体必须由 AI 板承担”。
- 下一段的优先级：先把天兵个体与 3D 冲击的镜头距离调好，再谈加特效。

### 影响文件

- 删除：`public/ai/bg_*.png`（5）、`src/primitives/Plate.tsx`、`src/primitives/PosterFrame.tsx`、`src/primitives/KineticLine.tsx`
- 新增：`src/primitives/senbon_style/` 下 16 个文件、`src/sequences/senbonPlan.ts`
- 重写：`src/sequences/WukongClimaxSegment.tsx`
- 更新：`package.json`、`assets.manifest.json`、`public/ai/README.md`、`README.md`、`docs/AGENT_TOOLING.md`


---

## 12. V3 重制：真实音频 + 独立角色模型 + 1:1 还原四镜（2026-10-23 00:20 — 01:35）

### 动机

审片 `out/senbon_v2_mvp.mp4` 后收到三条**必须解决**的硬伤：

1. **主角丑陋**：`WukongSilhouette.tsx` 用 `<circle>`/`<ellipse>` 手写了五官、咧嘴笑、胸口蚊香圈，读起来是低幼吉祥物，不是大圣。
2. **音频错**：画面里放的是慢速纯音乐，不是参考视频 09–19 s 的高燃摇滚唱段。
3. **动画僵硬、分镜没还原**：Shot 1 四幡停 2 秒挡死画面且大圣呆立；Shot 2 缺《千本樱》00:32 眼部横条、劈字间距过大导致字残；Shot 3 画成了平视棕色纸带而不是高空俯视石缝；Shot 4 缺四连跳切与最后 0.3 s 硬切黑屏。

### 做法

**A. 真实音频（推翻第 5 条的“整支配乐”做法）**

- 本机无系统 ffmpeg，改用 Remotion 自带的 `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`（n7.1，含 aac 解码 + wav muxer + pcm_s16le 编码，够用）。
- `-i 参考.mp4 -ss 9.0 -t 10.2` 精确截取 → `public/audio/climax_real_vocal.wav`（48 kHz / 16 bit / 立体声 / 10.200 s）。
- 写完 `scripts/analyze_climax_audio.py`：**逐字节复刻** `@remotion/media-utils` 的 `visualizeAudio()`（64 点 FFT、`actualStart = floor(t*sr) - 32`、3 遍 3-tap 盒式平滑、除以 `(32)*峰值`），把 32 桶频谱算成 301 帧的 JSON，并给出各频段 99 分位。
- 实测：RMS 0.171、峰值 0.970、谱心 1.2–5.5 kHz —— 确认是密集全频段摇滚，不是慢速垫底乐。
- 频段参考值随音源重标定：鼓组 stem 的 `0.72 / 0.045 / 0.013` → 真实唱段的 `0.2248 / 0.0416 / 0.0089`（`CLIMAX_VOCAL_REFERENCE`）。不重标定会让 mid/high 永久饱和。
- `WukongClimaxSegment` 主音源与频谱源都换成 `climax_real_vocal.wav`。

> **与 AGENTS.md §3 的冲突**：§3 要求 `visualizeAudio()` 绑鼓组 stem，不得绑主混音。本次按用户明确指令绑真实唱段，并用实测参考值补偿；副作用是高频桶会被人声齿音带动，但低/中频段（0–15）仍稳定对应鼓与贝斯。已在 §13 的“未解决”里登记。

**B. 角色模型：从“手画吉祥物”改为“几何真源 + 离线切片”**

- 新增 `src/primitives/senbon_style/wukongRigGeometry.ts`：**纯数据 + 纯函数**，零 import（Node 的类型擦除可直接 import）。
  - 全部轮廓是**直边多边形**（`limb()` 锥形肢节、`tasset()` 尖角甲片、`eyeWedge()` 倒三角眼、`claw()` 爪），没有一个圆/椭圆/螺旋。
  - 四个姿态：`spin_staff`（40 块/234 顶点）、`slash_horizontally`（38/213）、`trapped_overhead`（20/117）、`snarl_closeup`（8/39）。
  - 面部只有两道倒三角赤金眼眸 + 金箍 + 冠心 + 凤翅，**没有鼻子/嘴/腮红/胸口旋涡**。
- 新增 `WukongRig.tsx`：SVG 直边多边形分层渲染。
  - 剪影内部恒为 `#0B090A`；描边为按多边形包围盒自动取向的鎏金渐变（每块甲片自动“左上亮、右下暗”，读起来是折面金属）；整体套 `drop-shadow(0 0 3px #FCC934)`。
  - 程序化双翎：22 段折线积分 + 双频正弦 + 音频高频能量 → `ribbon()` 变宽飘带，280 px 双曲率。
  - 金箍棒：每帧 45°，把过去 7 帧的棒位一起画（八叶风车）+ 扇形残影 + 同轴运动模糊金盘 + 40 颗确定性火星。
  - 横扫姿态附三层延迟重影（赤红/鎏金/青）。
- 新增 `scripts/export_wukong_model.mjs` + `scripts/rasterize_wukong_model.py`：
  - `export` 用 Node 24 原生类型擦除直接 import TS 真源 → `public/wukong_model/wukong_rig.json` + 4 张 `wukong_<pose>.svg`。
  - `rasterize` 用 PIL 2× 超采样栅格化成**透明 PNG**（1640×2240），再用 `cv2.findContours` + `approxPolyDP` 从 alpha 通道反提 `wukong_<pose>_outline.svg`（1–7 条闭合路径）。
  - 单一真源，不复制坐标。

**C. 四镜重写（300 帧 / 30 fps）**

- `senbonPlan.ts` 重写 CUE 表，板号只在这里出现：`panelDrop 0/7/14/21`、`panelExit 28`、`eyeBand 75→98`、`palace 98→150`、`staffSweep 112`、`rockDrops 150/154/158/162/166`、`chains 172…192`、`jumpCuts 256/264/272/280`、`whiteFlash 290`、`blackout 291`。
- Shot 1：`WordPanels`（四条 −5° 倾斜分格竖屏、竖排单文本节点战幡、弹簧砸落、28 帧向两侧拉开）+ `SiegeFog`（三层漂移云 + `blur(6px)` 前景虚焦天兵）+ `CourtSky` 满月飞檐 + `CelestialArmy`。
- Shot 2：`EyeBand`（−6° 260 px 金边横条 clip 内嵌 `snarl_closeup`、竖向拉丝 + 十字星芒、右侧【怎】【敌】【我】砸入）→ `ThronePalace3D`（36 根盘龙巨柱 + 中央龙座祭坛 + 暗金网格地面 + 低角度环绕俯冲；112 帧巨棒横扫、216 块三维残石飞溅、三圈冲击波）+ `WukongRig slash` + `UnbreakableType`。
- Shot 3：`AbyssMountain`（五块折面玄黑巨岩从四向砸入挤成竖直石缝、金色等高线、`trapped_overhead` 仰视、六道锁链交叉成“米”字、五张符咒）。
- Shot 4：`VerdictChamber`（三道铁索 + 三层景深木牌 + 游走聚光灯；256/264/272/280 四连跳切 1.0→1.4→1.9→2.6；每切一次崩碎对应木牌 + 盖一枚裂纹朱砂印；290 白闪、291–300 纯黑）。

**D. 劈字的可读性（本次最容易翻车的一处）**

要求是“上下两半仅沿刀痕错位 12 px、垂直间距仅拉开 6 px”，但上一版把间距做成几十像素，字被切碎。
做法：整串文字是**一个**文本节点，两层 `<div>` 各自用 `clip-path: polygon()` 裁出 15° 刀痕的**上/下半平面**（交点由 `y = 540 ± (W/2)·tan15°` 解析算出），只对两层做 `translate`：
`±(cos15, sin15)·6` 沿刀痕 + `±(-sin15, cos15)·3` 沿法向。字始终完整，只有一条发丝级错位。

### 结果（含证据）

- 类型检查：`npx tsc --noEmit` 0 报错；`npx remotion compositions` 只剩 2 条注册。
- 验收帧 `out/v3_check_f{20,50,85,120,195,275}.png`：
  - f20：四条 −5° 分格竖屏，【玉境】【凌霄】【十万】已落位、第四面在飞入（板号 21 帧才有第四拍）。
  - f50：大圣立满月前，金箍棒成八叶金色风车，40 名天兵三波合围，前景左右两团 `blur(7px)` 天兵头盔压边。
  - f85：−6° 金边横条内两只倒三角火眼金睛（竖瞳），右侧【怎】已砸入。
  - f120：`无坚不摧` 四字 100% 可读，15° 刀痕切开、只错位 12 px；背景 36 柱宝殿 + 巨棒横扫 + 残石飞溅 + 大圣三层残影。
  - f195：五块巨岩挤出的竖直石缝、金色等高线与“米”字锁链、符咒【五指山下/偿/自由】。
  - f275：四连跳切第三档，火眼金睛占屏、三枚裂纹朱砂印【不】【敬】【权】分居三角。

### 代价

- 耗时：约 75 分钟（音频 8 min、角色几何 30 min、四镜 25 min、六帧自检与返工 12 min）。
- 返工 5 轮，其中两轮是**真的 bug**：
  1. **渐变引用写成 `fill="#id"` 而不是 `url(#id)`**：浏览器静默回落成黑色，导致金箍、眼眸、护膝全部变黑，第一版截图里“眼睛是灰的”就是这个原因。查了两轮才定位。
  2. `ThronePalace3D` 里把 `local` 传成 `String(...)`，类型检查当场拦下。
  3. 四幡整体 `scale(1.2)` 把最外侧两列推出画框、字被切 → 改成“不加缩放、只用 −5° 旋转 + 加高竖屏”。
  4. 黑场镜头（Shot 2 横条 / Shot 4）被 `HalftoneOverlay` 的网点抬成灰雾 → 按分镜给不同 `opacity`（0.86 / 0.5 / 0.56 / 0.3）。
  5. Shot 3 的岩石与深渊同色，读不出石缝 → 深渊底光提亮一档、岩石折面提到 `#241C1D/#2E2426/#3A2E30`、压边从 0.97 降到 0.52。

### 结论

- **保留**：几何真源 + 离线切片的角色管线。它是本次唯一能同时满足“不复用吉祥物”“可动骨骼”“有 PNG/SVG 资产”的做法。
- **保留**：真实音频 + 实测频谱参考值。慢速垫底乐换成真实唱段后，画面重音的“对拍感”立刻成立。
- **保留**：`clip-path` 半平面劈字。它把“字被切碎”这个不可控的排版问题变成了可解析的几何问题。
- **推翻第 11 条的“下一段先调天兵个体与 3D 镜头距离”**：真正卡观感的不是这两项，而是**主角本身不成立**。角色不对，后面所有镜头都救不回来。
- **未解决**：见下一节。

### 影响文件

- 新增：`src/primitives/senbon_style/wukongRigGeometry.ts`、`WukongRig.tsx`、`WordPanels.tsx`、`SiegeFog.tsx`、`EyeBand.tsx`、`ThronePalace3D.tsx`、`UnbreakableType.tsx`、`AbyssMountain.tsx`、`VerdictChamber.tsx`
- 新增：`scripts/analyze_climax_audio.py`、`scripts/export_wukong_model.mjs`、`scripts/rasterize_wukong_model.py`
- 新增资产：`public/audio/climax_real_vocal.wav`、`public/wukong_model/*`（4 PNG + 4 SVG + 4 outline SVG + `wukong_rig.json` + manifest）
- 重写：`src/sequences/senbonPlan.ts`、`src/sequences/WukongClimaxSegment.tsx`
- 修改：`src/audio/spectrum.ts`（新增 `CLIMAX_VOCAL_REFERENCE` 与 `bandReference` 入参）
- 删除（被 V3 取代的 V2 分镜原语，11 个）：`CudgelImpact3D`、`EyeCut`、`FinalSeals`、`ForegroundMotion`、`MountainCage`、`NandamenDoors`、`SplitType`、`Talismans`、`VerdictTags`、`WarBanners`、`WukongSilhouette`

---

## 13. V3 之后仍未解决的

1. **Shot 3 的“俯视深渊”读感只到了六七成**：现在读作“四块带金脉的黑岩围出中央黑腔”，还缺真正的透视缩短与自上而下的光比。下一步应该把五块岩石改成带厚度的三维挤出，或直接在 Blender 里渲一层 Alpha 岩石底。
2. **Shot 4 跳切段整体偏灰**：`snarl_closeup` 在 1.9× 时半透明折面与网点叠加，把黑场抬成灰橄榄。已把 `rim` 折面从 0.10 降到 0.045、网点降到 0.3，仍不彻底；根因待查。
3. **频谱绑的是唱段而非鼓组**（见 §12-A 的冲突说明）。若要回到 AGENTS.md §3，需要从真实唱段里剥一条 kick/snare stem，再让 `useStemEnergy` 绑它。
4. **天兵个体重复度高**：40 名共用同一套多边形，只做了缩放/取色抖动，缺姿态变体。
5. **`public/wukong_model/*.png` 目前是“资产存档”而非渲染源**：运行时仍走 SVG 实时绘制（为了能动），PNG 用于审片与后续 ComfyUI/Blender 对齐。

### 12.1 交付前最后两处返工（01:35 — 01:55）

跑完接触表才发现的，两处都属于"单帧好看、连起来断气"的问题：

1. **28–35 帧的 5 帧黑屏**。`WordPanels` 为了做漫画分格沟铺了一层全屏 `#000000` 底，
   而它在战幡滑出时没有跟着淡出，于是把后面已经入场的大圣与天兵整段盖黑。
   接触表 1.10 s 那一格是纯黑（实测 mean 3.1 / max 40），1.20 s 才恢复（mean 43.6）。
   修法：沟底色 `opacity = clamp(1 - exitProgress ��� 2.4)`，随滑出同步消失。
2. **验收帧 20 只有三面战幡**。板号是 0/7/14/21，第四面的**落点**在 21 帧，所以
   20 帧时它还不存在（`local > 0` 才渲染）。要求里 20 帧又必须能验"四分屏"。
   修法：砸落时长从 0.30 s 收到 0.13 s，并让每个分格在**音节前 0.1 s** 开始进入
   （`local = (t - dropAt + LEAD) / 0.13`），落点仍在音节那一帧。20 帧时第四面已到 97%。
   拍点表本身一个数都没改。

两处合计重渲 3 次（每次约 9 分钟）。

### 12.2 交付校验（01:55）

```powershell
npx tsc --noEmit                                  # 0 报错
npx remotion compositions src/index.ts            # 只剩 WukongPrologue / WukongClimaxSegment
```

- 成片：`out/senbon_v3_mvp.mp4` 1920×1080 / 30 fps / 10.005 s / 15.8 MB / h264 + aac 48k。
- **音频即真实唱段**：从成片解出的音轨与 `climax_real_vocal.wav` 前 9 s 的相关系数
  **0.99996**（AAC 往返），与旧 `climax_mix.wav` 只有 0.0059。
- **黑屏留白**：9.72 / 9.86 / 9.97 s 三帧 `getextrema()` 全为 `(0,0)`，即 291–299 帧纯黑。
- **接触表**：`out/senbon_v3_contact_sheet.png`，20 个时间点 × 5 列。

### 12.3 尚未解决的观感问题（明确留给下一轮）

- Shot 3 的"高空俯视深渊"读感约六七成：缺真正的透视缩短，现在更像"四块带金脉的黑岩围出中央黑腔"。
- Shot 4 跳切段整体偏灰：`snarl_closeup` 放大到 1.9× 时，半透明折面 + 网点把黑场抬成灰橄榄；
  已把折面从 0.10 降到 0.045、网点降到 0.3，仍未根治。
- 天兵个体重复度高（40 名同一套多边形）。

---

## 14. V4 重构：五层复合图元 + 八微切镜 + 三分法侧影 + 高精度脸谱（2026-10-23 02:00 — 03:30）

### 动机

审片 `out/senbon_v3_mvp.mp4` 后收到五条「必须在本轮彻底修正」的硬伤：

1. **Shot 1 战幡越界且单调**：第四面「天兵合围」右侧被裁掉一半；四面只是棕黑矩形，没有《千本樱》00:30 的四分屏微缩场景 + 壹贰叁肆印章。
2. **中心图腾症**：V3 大圣在所有镜头里都站在 X=50% 正对镜头；参考片里角色应在左下/右侧三分之一处背对镜头俯瞰，或纯侧面大动态。
3. **简笔画与虚线**：金色锁链是 `stroke-dasharray` 虚线；符咒只是白底红框矩形。
4. **手与脸**：00:05 的双手像黄色小皇冠；脸部特写只有两个带感叹号的三角眼。
5. **穿帮与分镜稀疏**：00:08 悬签时背景残留上一幕猴子剪影；10 秒只有 4 个静止镜头。

### 做法

**A. 五层复合图元（新增 4 个组件）**

- `OrnateSealStamp.tsx`：玄黑载体 + 纸纤维 → 6.4px 外金框 / 1.5px 内金框 → 四角回纹 → 朱砂缺角印泥 + 46 枚斑驳飞白 + 八卦暗纹 → 大字 + 左侧竖排副标题 + 朱文小印。`crack` 提供战损裂纹。
- `ComplexOfudaTalisman.tsx`：手撕毛边宣纸 + 纤维/斑点 → 8px 朱砂外框 / 2px 内框 → 四角云雷纹 → 八卦 + 雷纹暗印 → 「敕令」符头 + 毛笔字 + 「封」印 + 两枚金钉。所有 layers 都有独立 `useId` 的 pattern/clip。
- `IronChain.tsx`：面环（椭圆厚环 + 深孔 + 左上高光弧 + 销钉）与边环（90° 侧视）互扣，端部卸扣，沿索旋转的「唵嘛呢叭咪吽」铭文，模糊金色底线 + drop-shadow。彻底替代 `stroke-dasharray`。
- `ComicPanels.tsx`：4 × 480px 竖格；卡片 440px、左右各 20px 安全距，最右缘 = 1900；**整板不旋转**；每格含微缩场景、编号印、题签、说明与小印。V3 的 −5° 整板旋转就是右缘裁切根因。

**B. 八微切镜（`senbonPlan.ts` 重写）**

- 300 帧拆成 s1a 0–30 / s1b 30–75 / s2a 75–98 / s2b 98–150 / s3a 150–175 / s3b 175–225 / s4a 225–256 / s4b 256–291 / 黑 291–300。
- 板号仍只在 `senbonPlan.ts` 出现，统一 `sb(n)=n/30`；歌词落点仍从 alignment 读取，例外（怎敌我 78/86/93、罪名是老孙 228/236/244）已在文件头登记。
- 每个切点配 `IMPACTS` 震屏/白闪；115–116 帧反色，290 白闪，291 起纯黑。

**C. 镜头语言：三分法 + 侧影 + 微切镜**

- s1b：大圣 `side_lunge` 在 **X=35%（672px）**，身前是 3 圈反向弧形刀光 + 2 圈半调网点环 + 14 根棍影；40 天兵自右向左冲锋，前景 blur(8px) 巨型长戈。`WukongRig` 的 `spinDegPerFrame=0`，旋转交给 `StaffShield`，避免棒身横切脸部。
- s2b：大圣 `back_overlook` 在 **X=20%、Y≈76%**，1.3× 前景；3D 相机沿 Z 轴 108→70 推进并 `up` 倾斜 15°；36 根柱全部断裂、只保留一圈矮桩（满足“36 根断裂”的规格，又保住地面透视）；18° 半调刀光；右上【无坚不摧】9° 切开、12px 错位 / 6px 法向，刀光线 0.08 s 内淡出。
- s3a/3b：五道岩柱收窄到 280–360px、留 80–100px 黑缝，底缘单独 5px 金线；大圣 `kneel_boulder` 在底部，双臂大幅张成 V 形上撑；六道实体铁索；六张复合符咒弹簧钉入。
- s4a：`#050404` 纯黑，只保留铁索、三层白签、聚光灯、金火；主牌 228/236/244 翻面。
- s4b：1.0→1.35→1.8→2.4 四连跳切，金色裂屏刀光 + 四枚裂纹巨印。

**D. 角色几何：三个新姿态**

- `side_lunge`：侧视弓步、棍盾在身前、双翎缩短到 234/252px（V3 的宽翎像黑镰刀）。
- `kneel_boulder`：侧面单膝跪地、双臂 V 形上撑；腕点从 V3 的 326/536 外移到 250/590，否则手臂会被头冠与双翎完全挡住；手是五指掌形 + 金色掌缘 + 青筋 + 朱砂掌纹，不是 `claw()` 黄色皇冠。
- `back_overlook`：背影 + 侧脸微转 + 鬃毛/耳朵/金冠；用于左下角前景。

**E. 高精度脸谱 `WukongFaceCloseup.tsx`**

- 墨底头骨 + 额顶鬃毛尖刺 + 双耳 → 金色桃心脸谱（多层贝塞尔 + 朱砂压边）→ 眉心火焰 + 太阳穴云纹 + 颧骨卷草 → 黑眼窝 + 金线眼睑 + 42px 虹膜 + 36 道放射 + 竖瞳 → 紧箍云纹 + 朱砂宝珠 + 凤翅 → 锁子甲 pattern + 云纹护喉 + 山文甲肩片 → 战损裂纹 + 金火粒子。
- `variant="eyes"` 裁 `viewBox 168 300 664 300` 供 s2a 横条；`variant="full"` 供 s4b 四连跳切。s2a 在每只眼外侧发射短金芒；s4b 不画跨脸长线，避免“交通警告标志”。

**F. 外部技能库**

- `git clone --depth 1` 挂载 `iart-ai/motion-skills`（索引 + 验收工具）、`imMamdouhaboammar/motion-graphics-skills`（29 个 `.agents/skills`）、`iart-ai/webgl-animation-skills`（shader/particle/three）、`iart-ai/motion-design-skills`（shot-composition / beat-sync / remotion）。
- 只读参考，不参与打包；取用点写在 `skills/README.md`。半调网点环、粒子火花、三分法、微切镜节拍都来自这些 priors。

### 结果（含证据）

- `npx tsc --noEmit` 0 报错；`npx remotion compositions` 仍只有 `WukongPrologue` / `WukongClimaxSegment`。
- 七张验收帧全部读图：
  - `out/v4_check_f022.png`：四格全部落位；编号「其一/其二/其三/其四」完整；最右卡片右缘 1900，**无裁切**。
  - `out/v4_check_f050.png`：大圣在 X=35%，侧面弓步；棍盾是网点环 + 弧形刀光，不再是十字棍；40 天兵与弹飞箭矢清楚。
  - `out/v4_check_f085.png`：−5° 双金边横条；眼部高精度脸谱；每只眼向外的短金芒；【怎】已落。
  - `out/v4_check_f120.png`：大圣在左下 X=20%；3D 柱阵 + 18° 半调刀光；【无坚不摧】四字可读，刀口是**暗缝**（12px 错位），不是亮线横切。
  - `out/v4_check_f195.png`：五道岩柱分离、底缘金线；大圣双臂 V 形上撑；六道实体铁索；【五指山下】【偿】【自】复合符咒。
  - `out/v4_check_f240.png`：`#050404` 纯黑；只有铁索/白签/金火/聚光灯；**没有猴子残留**；前景【罪名】【是】已翻面，第三块仍是「待判」。
  - `out/v4_check_f278.png`：2.4× 脸谱；双层描金印章【不】【敬】【权】在四角；虹膜/竖瞳/金火/紧箍可见；无感叹号三角眼。
- 黑场：291 帧 `getextrema()` 全为 `(0,0)`，即 291–299 纯黑。
- 成片：`out/senbon_v4_mvp.mp4`（规格与耗时见 §14.1）。
- 接触表：`out/senbon_v4_contact_sheet.png`。

### 代价与返工

- 总耗时约 3 小时（02:00–03:30），其中：图元 70 min、三姿态 40 min、八镜 50 min、抽帧返工 35 min、渲染 20 min。
- 抽帧自检 4 轮，超过 20 张 still。真实修掉的 bug：
  1. 第四面编号被右上回纹盖住 → header `zIndex:3` + `paddingRight:44` + 编号 `flexShrink:0`。
  2. 五块岩柱宽度太大、只差 10–20px，读成一面墙 → 收窄、留黑缝、底缘单独受光。
  3. 跪撑手臂被头冠/双翎挡住 → 腕点外移 80–100px，臂展成 V 形。
  4. 眼部横条一条白线横贯全脸 → 删掉脸组件里的全宽 rect；背景速度线跳过水平角。
  5. 脸谱像笑脸南瓜 → 嘴角下沉、3 尖牙 + 2 外翻獠牙、加深色口鼻区。
  6. 3D 相机 z=51 太近，画面只剩金色方块 → 改为 108→70，36 根全断 + 矮桩 + 更小碎片。
- 一次 `write` 遇到 Windows `ReplaceFileW EIO`，重试即成功；不是代码问题。

### 结论（保留 / 回滚）

- **保留**五层复合图元标准，并写进 `AGENTS.md §12`。印章与符咒是这轮最明显的“工业级”提升。
- **保留**三分法侧影 + 0.6–1.2 s 微切镜；中心图腾症在 s1b/s2b 已被打破。
- **保留** `WukongFaceCloseup` 三个变体；它同时解决 s2a 的“感叹号三角眼”与 s4b 的“脸部糊成灰”。
- **推翻 V3 §13.2**“Shot 4 跳切段整体偏灰”：新脸谱 + 纯黑底 + 网点 0.16，已不灰。
- **未完全解决**：
  1. 脸谱更像“金色猴王/怒目金刚”，离 86 版《西游记》的猴脸还有距离；下一步需要更细的鼻梁/人中与毛发走向，而不是继续加金色纹样。
  2. s3a 的“单膝跪地”在低机位下更像“宽步撑举”，后腿膝盖被裙甲与画框裁切；需要重做腿部的侧面透视。
  3. 3D 柱阵仍然是“深色柱 + 金色碎片”，缺少真正的透视缩短；下一步需要在 Blender 里预渲染一层带 Alpha 的柱阵。
  4. 铁索铭文用的是「唵嘛呢叭咪吽」汉字，不是梵文天城体；字体缺失风险已规避，但与“梵文”字面要求有差距。
  5. s2b 的 3D 碎片仍偏大偏黄，读起来更像“金色纸片”而非石屑。

### 影响文件

- 新增：`src/primitives/senbon_style/ComicPanels.tsx`、`OrnateSealStamp.tsx`、`ComplexOfudaTalisman.tsx`、`WukongFaceCloseup.tsx`、`IronChain.tsx`、`StaffShield.tsx`、`SiegeCharge.tsx`、`CrumblingPalace3D.tsx`、`GiantSlashArc.tsx`、`UnbreakableBanner.tsx`、`EyeCutBand.tsx`、`SuspendedTags.tsx`、`BoulderCage.tsx`
- 修改：`wukongRigGeometry.ts`（+3 姿态）、`WukongClimaxSegment.tsx`（重写）、`senbonPlan.ts`（重写）、`AGENTS.md`（§12）、`assets.manifest.json`（v3）、`docs/AGENT_TOOLING.md`（§9）、`skills/README.md`
- 新增外部库：`skills/motion-skills`、`skills/motion-graphics-skills`、`skills/webgl-animation-skills`、`skills/motion-design-skills`
- 未删除：V3 的 `WordPanels` / `EyeBand` / `AbyssMountain` / `VerdictChamber` / `ThronePalace3D` 仍留在仓库，但已不被正片 import；下一轮可清理。

### 14.1 交付校验

```text
成片：out/senbon_v4_mvp.mp4
规格：1920×1080 / 30 fps / 10.005 s / h264 + aac 48 kHz stereo
体积：14.4 MB（14,428,607 bytes）
音频：与 public/audio/climax_real_vocal.wav 的相关系数 0.99965（AAC 往返）
黑场：9.70 / 9.95 s 抽帧 getextrema() 全为 (0,0)；291–299 帧纯黑
渲染：300 帧，concurrency=4，本机无 GPU（SwiftShader），约 6 分钟
接触表：out/senbon_v4_contact_sheet.png，20 个时间点 × 5 列
抽帧：out/v4_check_f022 / f050 / f085 / f120 / f195 / f240 / f278.png
```

- 22 帧：四格落位、编号「其一~其四」完整，最右卡片右缘 1900，无裁切。
- 50 帧：大圣在 X=35%，侧面弓步；棍盾为半调环，不再十字棍。
- 85 帧：眼部横条内为高精度脸谱，每只眼向外的短金芒，无跨脸白线。
- 120 帧：大圣在 X=20%/Y≈76%，36 柱全断 + 矮桩，18° 半调刀光；【无坚不摧】四字可读，刀口是暗缝。
- 195 帧：五岩柱 + 六实体铁索 + 双臂 V 形上撑 + 六符中的三张。
- 240 帧：`#050404` 纯黑，无猴子残留；【罪名】【是】已翻面，第三块「待判」。
- 278 帧：2.4× 脸谱，双层描金印章【不】【敬】【权】在四角，虹膜/竖瞳/金火/紧箍可见。
- 肉眼仍可改进的点已列在 §14「未完全解决」；本轮不再为“完美猴脸”继续加纹样。

---

## 15. V5 破局重构：真实造型资产 + 真三维点云 + 和纸反色（2026-10-23）

### 动机

V4 虽然把“指标”凑齐了（36 柱、五层图元、8 微切），但被判定为“用简陋几何多边形
应付单元测试”：脸是三角形拼的猫头鹰面具，全片一黑到底靠荧光黄描边托人物，2B 只是
2D 斜网格上画 36 个矩形。根因不是参数没调好，而是**资产路线错了**——用代码画角色
永远画不出有机形状。V5 换路线：

1. 角色改为**离线烘焙的真实资产**（参考片真帧 + 立绘抠底），运行期只贴图；
2. 2B 改为**真投影矩阵**的三维场景（移植归档里的 Camera 算法）；
3. 全片改为**和纸反色**的明暗节奏（亮底托纯黑剪影），不再黑底描边。

### 做法

**① 造型资产管线** `scripts/build_wukong_assets.py`

- 从参考片 `大雨还在下…mp4` 09–19 s 抽帧（ffmpeg `-vsync 0`，852×480 → 300 帧），
  取 f271（00:18.0）做面部与眼部、f166（00:14.5）做备用后脑。
- 木刻套色：LANCZOS 放大 → bilateral + `pyrMeanShiftFiltering` 扁平化 →
  Lab 明度 5 阶分层（带网点抖动，`punch` 参数推对比）→ HSV 分出朱砂/鎏金 →
  Sobel + 形态学黑帽抽黑版线 → 和纸颗粒。眼部 punch=2.05、面部 punch=1.34。
- 立绘走 `scripts/agy_image.mjs` 网关生成 4 个姿态（纯白底、4 色平涂）：
  旋棍 / 横扫 / 跪撑 / 举棒，896×1200 与 1024×1024。抠白底 → `findContours`
  外轮廓填洞 → 2× 平滑 → 纯 `#120D14` 剪影；同时另存平涂彩稿 `colour_*.png`。
- 产物落 `public/wukong_assets/`（7 张 + manifest.json + README）。

**② 真三维** `src/utils/threeDCamera.ts` + `CelestialCollapse3D.tsx`

- 从 `_archive_dufu/canvas_engine/world3d.js` 的 `Camera` 移植透视除法与屏幕约定，
  把 yaw/pitch 换成 `position→target` 正交基，获得可沿曲线运动的相机与 roll。
- 36 根八棱柱（8 边 × 16 顶点，柱头斗拱 + 柱础），3000 颗粒子，地面 3D 网格；
  相机 `diveOrbit` 从 18 单位高空螺旋俯冲至 4.2，FOV 1.12→1.34，roll −0.16→0.14。
- 碎裂用解析解 `p = p0 + v·t + ½g·t²`（不做逐帧积分），任意乱序抽帧可复现。
- 112 帧刀光：500 颗高亮粒子 + 一条三维四边面片光刃；地面三圈透视波纹。

**③ 和纸反色八微切** 新增 `PaperStage` / `ClimaxAsset` / `FourPaperPanels` /
`MoonSpinShot` / `EyeWoodblockShot` / `MountainCleft` / `WoodblockJumpCuts`，
重写 `WukongClimaxSegment.tsx`。新增色板 `WASHI`（古宣纸 `#EAE0CE`、亮宣纸
`#F2E8D5`、满月 `#FFF3D1`、深绯 `#7A1C1C`、深黛 `#1B1521`、泥金 `#C29526`、
剪影墨 `#120D14`），依据 AGENTS.md §9.8 仅限本复刻段。

### 结果（证据）

```text
成片：out/senbon_v5_mvp.mp4
规格：1920×1080 / 30 fps / 10.005 s / h264 + aac 48 kHz stereo / 10.6 MB
接触表：out/senbon_v5_contact_sheet.png（20 个时间点 × 5 列）
抽帧：out/v5_check_f008 / f022 / f050 / f085 / f106 / f120 / f153 / f160 / f200 / f270.png
资产：public/wukong_assets/ 7 张，总计约 9.9 MB
```

- 0.3–1.6 s：四格四色（米白 / 深绯 / 深黛 / 泥金）依次落位，朱印跨框；第四格是
  真实举棒剪影，不再是多边形小人。
- 2.2–3.0 s：780px 暖白满月 + 云海，大圣真实剪影在 X=35%，背后亮月直接咬出轮廓，
  无任何描边；棍影是三层虚线椭圆 + 14 段短弧。
- 2.7 s：整屏翻成宣纸白，−5° 横条内是参考帧 00:18.0 的木刻眼部，右侧【怎】【敌】。
- 3.4–4.5 s：真投影 36 根八棱柱 + 3000 粒子 + 地面网格，相机俯冲；碎块按重力飞散，
  近大远小；左下角真实立绘侧影 + 三层残影；右上【无坚不摧】斜切错位 12px。
- 5.1–7.4 s：纯黑山体压在暖金天光上，跪撑剪影从光里升起，铁索横锁，六符钉壁。
- 8.0 s：悬签阵；8.8 s 红底反白版画怒颜；9.3 s 白底墨版怒颜 + 【不】【敬】【权】四印。
- 9.7 / 9.95 s：纯黑。

### 代价

- 参考素材只有 852×480，面部放大 2.7× 后必须靠套色掩盖解析度；眼部再做一次
  punch 提升（1.62 → 2.05）才敢放在 356px 高的横条里。
- 立绘生成 4 张、每张约 110 s，其中 1 张返回 JPEG 但扩展名是 .png（管线按内容解码，
  不受影响）。
- 视觉迭代 6 轮：面板裁切/层级 → 天兵灰火柴人 → 棍影划线 → 3D 柱子像纸筒 →
  裂谷像门框 → 5.1 s 空镜。每轮 2–5 张 still，单张 8–15 s。
- 成片重渲 2 次（第一次 5.1 s 山体未落位），每次约 6 分钟。

### 结论（保留 / 回滚）

- **保留**“角色不许代码画”的硬约束，写进 `AGENTS.md §13`。
- **保留**真投影相机（`threeDCamera.ts`）与解析解碎裂；这是与 V4 最本质的差别。
- **保留**和纸反色配色与四色画格。
- **推翻 V4 §14 的“3D 碎片像金色纸片”**：改成八棱柱 + 斗拱 + 柱础 + 冷灰石色后，
  已能读出殿柱；但**仍不完美**——高机位下柱顶仍偏“管口”，需要真正的顶面法线光照。
- **推翻 V4 §14 的“脸谱像金色猴王”**：现在直接用参考帧，五官是真的；代价是
  **画质受 480p 源限制**，放大后偏“水彩/手绘”，不是刀刻般锐利。
- **未按计划做**：原计划从参考片抽 12–15 帧真动作轮廓做 rotoscope 序列帧。实测
  广角镜头里大圣只有约 120×200 px，GrabCut 抠像失败（只抠到裙摆），强行放大后
  边缘糊成锯齿，与 AI 立绘剪影混用会突兀；改为**四个真实姿态的有限动画**（切镜
  + 残影 + 棍影），并把这一取舍写在这里。若后续要补，正确做法是先用 4K 源或
  生图网关逐帧生成，而不是在 480p 上抠像。
- **未解决**：
  1. 眼部横条的套色偏“高调水彩”，黑版不够狠；再往上推会把眼白吃掉，需要按部位
     分区套色而不是整幅一个 punch。
  2. 3A 的山体下沿仍是“一条金线 + 黑面”，缺少皴法体积；皴线在暖底上几乎看不见。
  3. 2B 的碎块在近景仍偏大偏平（单面填充，无法线渐变）。
  4. 参考片自带 bilibili 水印与字幕，只能靠裁切规避，f271 右上已裁到 x=616。

### 影响文件

- 新增：`scripts/build_wukong_assets.py`、`public/wukong_assets/`（7 PNG + manifest + README）、
  `src/utils/threeDCamera.ts`、`src/primitives/senbon_style/PaperStage.tsx`、
  `ClimaxAsset.tsx`、`FourPaperPanels.tsx`、`MoonSpinShot.tsx`、`EyeWoodblockShot.tsx`、
  `MountainCleft.tsx`、`WoodblockJumpCuts.tsx`、`CelestialCollapse3D.tsx`
- 修改：`WukongClimaxSegment.tsx`（重写）、`senbonPlan.ts`（切点/符咒位/画格色）、
  `AGENTS.md`（§13）、`assets.manifest.json`（v4）、`package.json`（scripts）、
  `docs/AGENT_TOOLING.md`（§10）、`README.md`
- 未删除：V4 的 `WukongRig` / `WukongFaceCloseup` / `ComicPanels` / `BoulderCage` 等
  仍留在仓库，但已不被正片 import；保留作为对照。

### 15.1 复审后的二次返工：眼部横条与殿柱比例（同日）

**动机**：V5 交付后复审，两处仍不成立——2A 的眼部横条偏“高调水彩”，读不出眼睛；
2B 的柱子被读成“纸筒 / 滚筒”，碎块像纸板。这两处都不是调色问题，是**尺度**与
**裁切**问题。

**做法**：

1. `scripts/build_wukong_assets.py` 新增 `eye_band()`，与五阶套色分开：
   - `CLAHE(clip=3.2)` 先把 480p 的局部对比拉起来；
   - 三色调映射（`t<0.62` 进朱砂、`t<0.38` 进墨、其余宣纸），不再用五阶；
   - 黑版 = Sobel 边 + 形态学黑帽细线（`k = min(h,w)//40`）；
   - 按横条比例（2200×356 ≈ 6.2:1）**切一条 316px 的带子**，取眼睛高度 37.5% 处
     为中心——直接把整张脸压进横条会把五官拉扁，这是之前发糊的真正原因。
   - 组件里改为 1:1 贴合（`width 2200 / height 356 / marginTop -178`），不再二次缩放。
2. `CelestialCollapse3D` 的柱体比例：
   - 柱高 `9.5–14`、半径 `0.6–0.74`（原来 6.4–10 / 0.82–1.04，宽高比接近 1）；
   - 碎段 `5 → 3`，每段接近 3:1，才不会读成“滚筒”；
   - 未断裂的柱段**不画顶盖**（原来每段都盖一个楣面，整根柱子被切成五节香肠）；
   - 柱身按投影后的高度做竖向渐变（柱底亮、柱顶沉），替代单色平涂；
   - 相机在切点后保持 `y ≥ 4.4 / r ≥ 7.2`，不再钻进碎块内部；
   - 断裂延迟改为 `0.07 + |x|·0.022 + piece·0.034`，刀光过后约 0.5 s 内依次崩完。

**结果**：

- `out/v5_check_f085.png`：横条能读出眉骨、眼白、瞳孔高光与朱砂阴影，不再是粉灰色糊片。
- `out/v5_check_f106.png`：36 根高柱 + 斗拱 + 柱础，读成“殿柱林”，不再是滚筒堆。
- `out/v5_check_f120.png`：柱段有高度、有接缝，崩裂方向仍朝镜头。

**代价**：资产重烘 3 次（每次约 40 s）；still 4 轮（f085 ×3 / f106 ×3 / f120 ×2）；
全片重渲 1 次（约 6 min）。`eye_band()` 的第一版把带子中心放在 45%，左眼被切掉，
改到 37.5% 才两只都在。

**结论**：

- **保留**独立的三色版眼部管线；它比五阶套色更适合“一根横条里只有眼睛”的场景。
- **保留**柱体长宽比约束与“未断裂不画顶盖”。
- **推翻 §15“未解决 1”（眼部偏水彩）**：已可用，但代价是它不再是“套色版画”，
  更像高对比三色丝网；若要木刻感，需要 4K 源而不是继续调参。
- **推翻 §15“未解决 3”（碎块偏大偏平）**：柱段变高后近景碎块有了纵深，但**仍无
  真法线光照**——现在是“竖向渐变 + 面法线明暗”，不是 PBR。

---

## 16. V6：2K 生图 + rembg/vtracer 四色套版 + 真 WebGL（2026-10-23）

### 16.1 动机

V5 交付后逐帧复审，五处工程事实偏差：

1. **2B【无坚不摧】在成片里消失**：00:03–00:04 右上只剩一条金线。
2. **角色两个极端**：1B/3A 立绘被填死成 `#120D14` 黑墨团；2B 左下角的
   `colour_side_slash.png` 带白色粗描边，像一张贴纸。
3. **4B 的怒颜来自 852×480 参考帧放大 4.4 倍**，00:09 是一滩红白灰像素。
4. **1A 的南天门是 4 个 `<rect>` + 1 个三角形**，凌霄殿是两块黑梯形。
5. **2B 的 36 根柱是手写 2D 透视**，没有着色器、没有三渲二描边、没有 Bloom。

### 16.2 做法

**A. 依赖升级**

- 前端：`@remotion/three` + `@react-three/fiber` + `@react-three/drei` +
  `@react-three/postprocessing` + `postprocessing` + `@remotion/motion-blur`，
  全部精确版本（见 `package.json`）。
- Python：`rembg[cpu]` + `vtracer` + `opencv-python`；SVG 用
  `@resvg/resvg-js` 栅格化（新脚本 `scripts/rasterize_svg.mjs`）。

**B. 2K 生图资产（禁用 480p 截帧）**

生图网关共生成 7 张（V5 四姿原图 4 张 + V6 新增/重生成 5 张，其中
clean slash 为排除速度线重生成）：

| 资产 | 原始 | 成品 |
|---|---|---|
| 眼部 | 1376×768 | 2200×356 `eyes_closeup_woodblock.png` |
| 怒颜 | 1024×1024 | 2048² `face_glare_woodblock.png` |
| 南天门 | 848×1264 | 1400×2087，vtracer + resvg |
| 凌霄殿 | 848×1264 | 1400×2100，vtracer + resvg |
| 十万天兵 | 1376×768 | 2390×1102 RGBA，vtracer + resvg + 软抠 |
| 横扫立绘（重生成，明确排除速度线） | 896×1200 | 1876×2048，rembg + 四色套版 |

四姿立绘全部走 `rembg` → 白边剥离（外轮廓填洞 + `cv2.erode(3px)`）→
HSV 四色套版：墨 `#120D14` / 朱砂 `#C8281E` / 鎏金 `#F5C242` / 宣纸 `#EAE0CE`。
**不再有白色钥匙线，也不再填死成黑团。**

**C. 2B 真 WebGL**

新文件 `src/primitives/senbon_style/CelestialThrone3D.tsx`，删除
`CelestialCollapse3D.tsx` 与 `src/utils/threeDCamera.ts`：

- 36 根柱 = 柱础（2 cylinder）+ 柱身（3 段，可断）+ 斗拱（3 box + 4 短枋）；
- `meshToonMaterial` + drei `<Outlines>` + `<Edges>`；
- `<EffectComposer><Bloom luminanceThreshold={0.25} intensity={2.0} mipmapBlur /></EffectComposer>`；
- 112 帧斜向刀光 = 三条 `CatmullRomCurve3` + `TubeGeometry`（白热 / 金 / 朱砂）；
- 400 颗确定性点云 Sparkles（不用 drei 的随机版）；
- 碎块 `p = p0 + v·t + ½g·t²` 解析解，裂口用暗盘 + 低透明金环 + 三条不规则裂纹；
- 相机从半径 30.5 / 高 16.2 俯冲到 18 / 10.2，FOV 54→62。

**D. 时间轴 Bug 根因与修复**

`SlashType` 的父容器只有绝对定位子节点，`height` 为 0；两层字都用
`clipPath: inset(0 0 51% 0)`，在 0 高元素上把 100% 裁掉，`bottom:-18` 的金线
是唯一漏网的。V6 改为**显式 height + 两个互补内联 `polygon(...)`**，并把
`SlashType` 移出 `Shot2B`，画在 `HalftoneOverlay`、白闪、反色、暗角之后
（zIndex 60），保证任何叠加层都压不住它。

2A：`eyeBand.open` 从 79 帧提前到 76 帧；横条在 75–98 帧内一定出现。
**复现 V5 成片时 t=2.8 s 的眼部横条其实是存在的**（`out/v5probe/t2.8.png`），
t=4.0 s 的大字确实丢失；V6 仍把 open 提前并把横条换成 2K 生图眼部，确保
“00:02–00:03 没有眼部”不可能再发生。

### 16.3 结果（证据）

单帧：

- `out/v6_check_f008.png` / `f022b.png`：南天门/凌霄殿换成 2K 版画；
  第三格是天兵反相银甲；第四格是四色套版举棒大圣。
- `out/v6_check_f050e.png`：右侧 74px 竖排【十万天兵合围】、2K 天兵层、
  8 层 Trail + 2.4px blur 的旋棍残影。
- `out/v6_check_f085.png`：2200×356 的 2K 眼部横条真正铺满画面。
- `out/v6_check_f120g.png`：36 柱 + 斗拱 + 柱础 + 金环 + 断裂碎块 + Bloom；
  右上【无坚不摧】清晰可读（上下两半纸白/鎏金斜切）。
- `out/v6_check_f160b.png`：跪撑大圣有完整的金甲、朱砂披风与面部，不再是黑团。
- `out/v6_check_f270.png`：2048² 生图怒颜反白印张，不再是 480p 红斑。

**成片**：`out/senbon_v6_mvp.mp4` 1920×1080 / 30 fps / 300 帧 / 10.005 s /
15.1 MB。按 `docs/AGENT_TOOLING.md §11.6` 从 MP4 反向回抽 7 帧：

| 时间 | 文件 | 读图结论 |
|---|---|---|
| 0.5 s | `out/v6_mp4_0.5.png` | 四分屏：南天门盘龙阙楼、凌霄殿重檐、银甲天兵、举棒大圣 |
| 1.8 s | `out/v6_mp4_1.8.png` | 满月逆光、74px 竖排大字、天兵层、Trail 残影 |
| 2.8 s | `out/v6_mp4_2.8.png` | **眼部横切在最终 MP4 内确实出现**，2200×356 清晰 |
| 4.0 s | `out/v6_mp4_4.0.png` | **【无坚不摧】四字在最终 MP4 内清晰可读** |
| 6.5 s | `out/v6_mp4_6.5.png` | 五指山下 + 复合符咒 + 有内部细节的跪撑大圣 |
| 8.0 s | `out/v6_mp4_8.0.png` | 纯黑悬签【罪名】【是】 |
| 9.2 s | `out/v6_mp4_9.2.png` | 2048² 木刻怒颜，五官与獠牙可辨，无像素红斑 |

接触表：`out/senbon_v6_contact_sheet.png`（20 个时间点，1920×864）。

### 16.4 代价

- 生图 7 张：眼部 66 s、怒颜 33 s、南天门 56 s、凌霄殿 66 s、天兵 52 s、
  clean slash 54 s，另加 V5 四姿原图（约 110 s/张）。每次看完成图再下一张。
- rembg 首张含 176 MB 模型下载约 45 s；之后 4 张共 20 s。
- vtracer + resvg：南天门 28 s / 凌霄殿 22 s / 天兵 20 s，SVG 12–20 MB。
- 视觉迭代：1A 3 轮、1B 4 轮、2A 1 轮、2B 6 轮（黑→棕→冷灰暖金→弧形刀光→
  降裂口亮度）、3A 2 轮、4B 1 轮；still 共 ~20 张，单张 15–25 s。
- `EffectComposer` 首帧全黑排查约 40 min：试了 `--gl=angle`、删 Bloom、换材质、
  改相机，最后定位是 `ManualFrameRenderer` 的 `advance()` 早于 composer effect；
  `LateAdvance` 一次修好。
- 成片渲染 300 帧 @ `--concurrency=2` 约 4 分钟；3D 段单帧 2–4.6 s，
  最慢帧集中在 99–139（崩裂 + Bloom）。

### 16.5 结论（保留 / 回滚 / 未解决）

**保留**

- 2K 生图 + rembg 四色套版；角色内部细节与“无白边”同时成立。
- vtracer + resvg 的建筑/天兵矢量化；边缘比 LANCZOS 放大干净。
- `@remotion/three` + Bloom + Outlines：2B 终于是有相机的真 3D。
- `LateAdvance` 与 `SlashType` 显式高度：两条都是可复用的硬约定，已写进
  `AGENTS.md §14` 与 `docs/AGENT_TOOLING.md §11`。

**回滚 / 推翻**

- 推翻 §13.4“三维必须用 `threeDCamera.ts` 手写投影”：V6 起 2B 必须走 three.js，
  `threeDCamera.ts` 已删除。
- 推翻 §15.1“眼部横条用三色版 `eye_band()`”：V6 不再从 480p 做眼部，
  改用 2K 生图 + 裁带。
- 推翻 §15 的“剪影内部恒为 #120D14”：角色必须是四色套版，只有黑版线是 #120D14。
- 删除 V5 的 `colour_*.png` / `silhouette_*.png` / `trapped_print.png`，
  避免被后续场景误用。

**未解决（诚实记录）**

1. 1B 的天兵层在 2D 平面上仍是一条“地平线军队带”，不是真正的纵深阵列；
   要让十万天兵有前后景，需要 3D 实例化或分层多张生图。
2. 2B 的柱子虽然有了柱础/斗拱/三渲二描边，但在近景仍偏“粗管”；
   需要更细的雕龙高模或法线贴图，而不是继续加金环。
3. 1B 的 Trail 仍是“扇形残影”：470°/s 的旋转 + 8 层冻结在视觉上就是扇形；
   要更接近光学模糊，应降低转速或把运动交给 `CameraMotionBlur`。
4. 3A 的山体仍是“暖棕渐变 + 黑剪影”，皴法体积不足；本次只修角色，不修山。
5. 无 GPU 的 SwiftShader 下 Bloom 亮度与真机有差异；交付以本机 MP4 为准。

### 16.6 影响文件

- 新增：`src/primitives/senbon_style/CelestialThrone3D.tsx`、
  `scripts/rasterize_svg.mjs`、`public/wukong_assets/`（9 PNG + manifest + README）。
- 删除：`CelestialCollapse3D.tsx`、`utils/threeDCamera.ts`、V5 的 8 张 superseded PNG。
- 修改：`scripts/build_wukong_assets.py`（全量重写）、`ClimaxAsset.tsx`、
  `FourPaperPanels.tsx`、`MoonSpinShot.tsx`、`EyeWoodblockShot.tsx`、
  `MountainCleft.tsx`、`WoodblockJumpCuts.tsx`、`WukongClimaxSegment.tsx`、
  `senbonPlan.ts`、`package.json`、`assets.manifest.json`、`AGENTS.md`（§14）、
  `docs/AGENT_TOOLING.md`（§11）、`README.md`。

