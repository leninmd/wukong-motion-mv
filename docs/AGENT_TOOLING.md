# 工具链与外部依赖（跨 session 复用）

> 本文件是给**下一个 session 的 agent** 看的：环境事实、能用的外部应用、可复用脚本、踩过的坑。
> 结论优先，命令可直接复制。与 `AGENTS.md` 冲突时以 `AGENTS.md` 为准。

---

## 0. 环境事实（2026-10 实测）

| 项 | 值 |
|---|---|
| 工作目录 | `D:\AI\wukong-motion-mv` |
| 远端 | `git@github.com:leninmd/wukong-motion-mv.git`（分支 `main`，已设 upstream） |
| Node / 包管理 | Node 24.16，npm；`remotion` / `@remotion/media-utils` / `@remotion/three` 锁 `4.0.537` |
| 三维栈 | `three 0.186.1`、`@react-three/fiber 9.8.2`、`@types/three 0.186.0`（与 remotion 精确同版本，禁止 `^`） |
| Python | `D:\dev\runtimes\python\Python313\python.exe`，可用 `numpy 2.2.6` / `scipy 1.18.1` / `Pillow 11.3` |
| ffmpeg | **系统没有**，用 Remotion 自带的精简构建：`node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe`（`ffprobe.exe` 同目录）。只有 `scale/crop/loudnorm/ebur128` 等基础滤镜，**没有 `fps` / `tile`** |
| GPU | **无**（`nvidia-smi` 不存在） |
| 本地图像模型 | **无**（无 torch / diffusers / ComfyUI / WebUI） |
| 终端编码 | Windows 下 Python `subprocess(text=True)` 默认 GBK，读 CLI 输出会 `UnicodeDecodeError`，一律加 `encoding="utf-8", errors="replace"` |

---

## 1. Antigravity（可调用生图）

### 1.1 位置

| 项 | 路径 |
|---|---|
| 桌面应用 | `D:\AI\apps\Antigravity\Antigravity.exe`（需保持登录/运行） |
| CLI 包装 | `D:\AI\apps\antigravity-cli\antigravity.cmd` → `node agy-bridge.js` |
| CLI 本体 | `D:\AI\apps\antigravity-cli\agy.exe` |
| 会话产物 | `C:\Users\<user>\.gemini\antigravity\...`（**不要在代码里引用**） |

### 1.2 能力

- 模型：`gemini-3.8-flash-high/medium/low`、`claude-sonnet-4-6`、`claude-opus-4-6-thinking`、`gpt-oss-120b-medium`
- 内置子 agent：**`image-generator`**，通过 `invoke_subagent` 调用，返回落盘图片路径
- 子命令：`agents` / `models` / `mcp` / `plugin` / `install` / `remote-control` / `update`

### 1.3 关键机制（踩坑总结）

1. **`agy -p "..."` 会立刻返回**：它只是"启动了子 agent"，会话一结束子 agent 就中止，**文件永远不会落盘**。
2. **必须保活会话**：用 `--input-format=stream-json --output-format=stream-json`，把一条 NDJSON 写进 stdin 后**不要关闭 stdin**；等文件出现再退出。仓库里的 `scripts/agy_image.mjs` 就是干这个的。
3. **必须放行命令**：不给 `--dangerously-skip-permissions` 时，子 agent 连 `New-Item` 建目录都会被拒（`run_command` 报 ERROR）。官方 `agy-bridge.js` 也是这么放行的。
4. **输出规格固定**：生成结果是 **1376×768 JPEG**，且**没有真 alpha**。要 1920×1080 PNG 必须自己裁切+放大；要透明资产（金箍棒等）**不要走生图**，用代码画。
5. 提示词里要显式带"尺寸 + 风格 + 配色 + 禁止项"，并把同样的风格句在所有板里复用，才能保证一套片子风格一致。

### 1.4 最简可复现调用

```powershell
node scripts/agy_image.mjs `
  "调用 image-generator 生成一张图，原样传参：[尺寸 16:9、1920x1080] [内容：…] [配色仅 #0B090A #F4EFE6 #D93025 #FCC934] [禁止人物、文字、水印]。生成后复制到 D:\AI\wukong-motion-mv\public\ai\<id>.png 并打印尺寸。" `
  "D:\AI\wukong-motion-mv\public\ai\<id>.png" 420000
```

`agy_image.mjs` 做的事：spawn `agy.exe`（stream-json）→ 写一条 user 事件 → **stdin 不关** → 轮询目标文件 → 出现即退出（0/1）。

可覆盖的环境变量（换机器/换路径时用，避免改代码）：

```powershell
$env:AGY_EXE = 'D:\AI\apps\antigravity-cli\agy.exe'   # CLI 本体
$env:AGY_WORKDIR = 'D:\AI\wukong-motion-mv'             # 传给 --add-dir 的目录（默认当前目录）
```

### 1.5 经济用法（重要）

- **一次只生成一张**，落地校验后再下一张；失败最多重试 1 次。
- 先写 `assets.manifest.json`（镜头表 + 资产清单 + 提示词），再 `python scripts/gen_plates.py --only <id>`；脚本带 `budget.maxGenerations` 上限。
- 背景板优先（复用率高），透明精灵最后考虑；能用代码画的层（粒子、光效、文字）**不要生图**。
- 本项目实测：**5 张板**够撑 12 个镜头（同板靠推/移/浮/裁切区分）。

---

## 2. 仓库脚本（可复用）

| 脚本 | 作用 | 输入 → 输出 |
|---|---|---|
| `scripts/gen_plates.py` | 按 manifest 生成 AI 板并规整 | `assets.manifest.json` → `public/ai/*.png` |
| `scripts/agy_image.mjs` | Antigravity 保活调用桥 | prompt + target → 落盘文件 |
| `scripts/score.py` | 合成整支配乐（含逐字共振峰"人声"） | `climax_words.json` → `public/audio/climax_mix.wav`、`drums_stem.wav` |
| `scripts/build_climax_assets.py` | 字级对齐（HPSS 起音 + DP + 节拍网格） | `out/ref/segment_09_19.wav` → `public/alignment/climax_words.json` |
| `scripts/verify_climax.py` | 对齐独立校验（≤50 ms 才 PASS） | 对齐 JSON + 音频 → 退出码 |
| `scripts/spectrum_probe.mjs` | 直接跑 media-utils 的 FFT 标定三频段 | `drums_stem.wav` → `out/ref/spectrum_probe.json` |
| `scripts/analyze_climax_audio.py` | 逐字节复刻 `visualizeAudio()` 的 64 点 FFT，标定任意音源的 BAND_REFERENCE | wav → 三频段 99 分位 + 逐帧 32 桶 JSON |
| `scripts/export_wukong_model.mjs` | 把 TS 角色几何真源导出成 JSON + SVG（Node 24 原生类型擦除直接 import `.ts`） | `wukongRigGeometry.ts` → `public/wukong_model/` |
| `scripts/rasterize_wukong_model.py` | 多边形栅格化成透明 PNG，再用 cv2 从 alpha 反提 SVG 轮廓 | `wukong_rig.json` → 4 PNG + 4 outline SVG |

---

## 3. 质量门（提交前）

```powershell
npm run typecheck
npx remotion compositions src/index.ts
python scripts/verify_climax.py
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f045.png --frame=45
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f085.png --frame=85
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f120.png --frame=120
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f190.png --frame=190
npx remotion still src/index.ts WukongClimaxSegment out/senbon_v2_f280.png --frame=280
npx remotion render src/index.ts WukongClimaxSegment out/senbon_v2_mvp.mp4 --concurrency=4
```

- **禁止用"能编译"替代"能渲染"**。
- 改 Root / 关键 primitive 后，额外跑一次 `WukongPrologue` 的 still 防回归。
- 第 120 帧必须真的渲染出 Three.js 几何体（棋盘、40 柱、金箍棒、冲击环），不能只看 DOM 覆盖层。
- 交付前必须出**接触表**（≥12 个时间点拼图）自检画面，不靠单帧判断。

---

## 3.1 纯代码视觉原语 `src/primitives/senbon_style/`（2026-10-22 新增）

| 文件 | 职责 | 关键约束 |
|---|---|---|
| `style.ts` | 四色令牌、缓动、弹簧、线宽 | 不新增第五主色 |
| `geometry.ts` | Catmull-Rom / 变宽飘带 / 锯齿 / 圆弧 | 纯函数，无时钟 |
| `HalftoneOverlay.tsx` | SVG `<pattern>` 半调网点 + 纸屑 + 径向光晕 | 光晕 ≤0.25、颗粒 ≤0.3，否则暗场发灰 |
| `WukongSilhouette.tsx` | 参数化大圣：`stand / eyes_closeup / kneel_defiant / smash` | 翎子/披风绑 `useCurrentFrame()` 正余弦；眼睛用小型 blur 滤镜 |
| `NandamenDoors.tsx` | 南天门双扇推拉门 | 0–12 帧，先蓄力再崩开 |
| `CourtSky.tsx` | 满月/云/飞檐/飞鸟/浮尘 | 三层视差按 pan×0.22/0.5/1 |
| `CelestialArmy.tsx` | 60 天兵 + 前景枪林 | 单 `<g>` symbol + `<use>`，不要复制 60 份路径 |
| `WarBanners.tsx` | 四分战幡 | 弹簧落幅；竖排字用 HTML + `whiteSpace: nowrap` |
| `ForegroundMotion.tsx` | 宫灯/火星/光条 | 只放屏幕两侧与下三分之一，禁止挡字 |
| `EyeCut.tsx` | 火眼横切条 | 斜切 `clip-path: polygon()`；标题容器必须有显式宽度 |
| `CudgelImpact3D.tsx` | Three.js 天庭棋盘 + 40 柱 + 三圈冲击波 | 地面用 `meshBasicMaterial` 保证棋盘可读 |
| `SplitType.tsx` | 一棒劈字 | 两个相同文本图层 + 互补斜切遮罩 |
| `MountainCage.tsx` | 五指山铁笼 | 五柱依次砸落；中央缝隙留 280px 给跪姿剪影 |
| `Talismans.tsx` | 六张封印符咒 | 从四角飞入、落钉、文字 clip 揭示 |
| `VerdictTags.tsx` | 三层罪状木牌 + 破壁 | 远/中/近三层景深；木牌翻面用 `rotateY` |
| `FinalSeals.tsx` | 四枚朱砂巨印 | 重字用粗黑体重栈，裂纹裁在字内 |

分镜秒表在 `src/sequences/senbonPlan.ts`；**所有分镜帧号只允许出现在这里**，且统一 `sb(n)=n/30` 转秒。歌词落点一律从 `public/alignment/climax_words.json` 取。

---

## 4. 资产契约速查

| 目录 | 契约 |
|---|---|
| `public/ai/` | **2026-10-22 起本段已清空**：`WukongClimaxSegment` 为纯代码，`assets` 为空；仅当其它镜头需要美术板时才按旧契约生成 |
| `public/alignment/` | 只有秒，无帧号；`units` 升序、`end>start`；见 `public/alignment/README.md` |
| `public/audio/` | `climax_mix.wav` 播放用；`drums_stem.wav` 频谱用；48 kHz / 10.000 s；见 `public/audio/README.md` |
| `out/` | 全部构建产物，**不进 git** |

---

## 5. 常见故障对照

| 现象 | 原因 | 处理 |
|---|---|---|
| 调 CLI 生图后 `public/ai` 一直空 | 用了 `-p` 一次性调用，会话结束子 agent 被杀 | 改用 `scripts/agy_image.mjs`（stream-json 保活） |
| 子 agent 报 `run_command` ERROR | 没放行权限 | 加 `--dangerously-skip-permissions`（仅在该步、且提示词限定只写 `public/ai`） |
| 生成的 png 打不开 | 实际是 JPEG 改了扩展名 | 用 Pillow 校验 `im.format`，统一转 PNG |
| Python 调 CLI 抛 GBK 解码错 | Windows 默认编码 | `subprocess(..., encoding="utf-8", errors="replace")` |
| `remotion still` 卡住 | 音频/图片 `delayRender` 未释放 | 检查 `staticFile()` 资源是否真的存在 |
| 竖排中文被拆成两列 / 变成横排 | 绝对定位 flex 容器没有显式 `width`，垂直书写时的 shrink-to-fit 计算出错 | 给容器固定 `width`，并给文字加 `whiteSpace: 'nowrap'`；参见 `WarBanners` / `EyeCut` |
| 纯代码画面发灰、对比度低 | 全屏半调光晕 + 颗粒叠太狠（`HalftoneOverlay` 早期 opacity 0.55） | 光晕 ≤0.25、颗粒 ≤0.3；暗场靠局部光源而非整屏提亮 |
| Three.js 画面只剩一片雾 | 雾 `near` 太近 + 环境光/平行光把地面染成棕色 | 雾 `near ≥180`；地面改 `meshBasicMaterial`；柱体加 emissive；先把 still 渲出来再调 |
| `ThreeCanvas` 在无 GPU 机器上空白 | 无独立 GPU 时走 SwiftShader，但材质/光照过暗会被误判为没渲染 | 用第 120 帧 still 验证；确认 `<color attach="background">`、相机 `lookAt` 与网格实际在视锥内 |
| 全屏反色帧把整段压灰 | 冲击白闪与 `HalftoneOverlay` 叠加 | 白闪 opacity ≤0.32、时长 ≤0.12 s；反色只在指定 1–2 帧 |
| 纯代码几何"像卡片"（旧结论） | 缺密度、缺视差、缺物理 | 2026-10-22 起改为：多层视差 + 每层 30–60 个实例 + 半调/纸纹 + 物理弹簧/抛物线 + Three.js 几何体；**不再以"上 AI 板"作为唯一解** |

---

## 6. 本机没有系统 ffmpeg —— 用 Remotion 自带的那一个（2026-10-23 实测）

`where ffmpeg` / `where ffprobe` 都找不到。**不要**因此去下载整套 ffmpeg，Remotion 的
compositor 包已经带了一份精简版：

```
node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe
node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe
```

它是 n7.1、`--enable-small` 的定制构建：`--disable-filters` 只留了
`atrim acopy adelay apad amerge amix aformat aresample atempo asetrate asetpts
concat loudnorm volume pan scale split sine silencedetect ...`，
`--disable-encoders` 只留 `pcm_s16le pcm_s24le aac libfdk_aac libx264 libx265
libvpx_* libmp3lame prores_ks gif png mjpeg`，
`--disable-muxers` 只留 `wav mp3 mp4 mov matroska webm gif image2 ...`。
**没有 `fade` / `afade` / `libsoxr` / `loudnorm` 之外的母带滤镜**，也没有 `-filter_complex` 里的大部分图。

截取一段参考音频（本次实际用的命令）：

```powershell
$ff = 'node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe'
& $ff -y -v error -i "<参考>.mp4" -ss 9.0 -t 10.2 -vn -acodec pcm_s16le -ar 48000 -ac 2 "public\audio\climax_real_vocal.wav"
```

`-ss` 放在 `-i` 之后是**精确定位**（解码到手再丢帧），放前面是快速定位；音频要精确就用后面那种写法。

## 7. SVG 的坑：`fill="#id"` 会静默变黑

写 `<polygon fill={ids('goldFill')} />` 时，除非 `ids()` 返回的是 `url(#id)`，
否则浏览器把它当"颜色名解析失败"，**不报错、不警告，直接填充黑色**。
本次 V3 的金箍、眼眸、护膝集体变黑就是这个原因，查了两轮截图才定位。

约定：在任何需要引用 `<defs>` 里的渐变/滤镜的地方，包装函数一律返回 `url(#...)`。
`WukongRig.tsx` 已按此实现（`ids()` 返回 `url(#...)`，`idName()` 返回裸 id）。

## 8. 角色资产管线（V3）

```
src/primitives/senbon_style/wukongRigGeometry.ts   ← 唯一真源（纯数据 + 纯函数，零 import）
        │  node scripts/export_wukong_model.mjs     （Node 24 原生类型擦除，直接 import .ts）
        ▼
public/wukong_model/wukong_rig.json + wukong_<pose>.svg
        │  python scripts/rasterize_wukong_model.py （PIL 2× SSAA + cv2 反提轮廓）
        ▼
public/wukong_model/wukong_<pose>.png（透明 RGBA 1640×2240）
public/wukong_model/wukong_<pose>_outline.svg（1–7 条闭合路径）
```

运行时**不走 PNG**，仍由 `WukongRig.tsx` 用同一份几何实时画 SVG（要驱动翎的物理、
金箍棒旋转与音频频谱）。PNG/SVG 是审片与后续 ComfyUI/Blender 对齐用的资产存档。
