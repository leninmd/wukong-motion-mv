# 工具链与外部依赖（跨 session 复用）

> 本文件是给**下一个 session 的 agent** 看的：环境事实、能用的外部应用、可复用脚本、踩过的坑。
> 结论优先，命令可直接复制。与 `AGENTS.md` 冲突时以 `AGENTS.md` 为准。

---

## 0. 环境事实（2026-10 实测）

| 项 | 值 |
|---|---|
| 工作目录 | `D:\AI\wukong-motion-mv` |
| 远端 | `git@github.com:leninmd/wukong-motion-mv.git`（分支 `main`，已设 upstream） |
| Node / 包管理 | Node 24.16，npm；`remotion` 与 `@remotion/media-utils` 锁 `4.0.537` |
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

---

## 3. 质量门（提交前）

```powershell
npm run typecheck
npx remotion compositions src/index.ts
python scripts/verify_climax.py
npx remotion still src/index.ts WukongClimaxSegment out/climax_preview_45.png --frame=45
npx remotion render src/index.ts WukongClimaxSegment out/wukong-climax.mp4
```

- **禁止用"能编译"替代"能渲染"**。
- 改 Root / 关键 primitive 后，额外跑一次 `WukongPrologue` 的 still 防回归。
- 交付前必须出**接触表**（多时间点拼图）自检画面，不靠单帧判断。

---

## 4. 资产契约速查

| 目录 | 契约 |
|---|---|
| `public/ai/` | AI 板：1920×1080 PNG，必须先在 `assets.manifest.json` 声明；文件名稳定；见 `public/ai/README.md` |
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
| 画面"像 PPT" | 纯代码几何拼贴，缺插画密度 | 走 AI 板 + 代码合成，不要继续堆图形 |
