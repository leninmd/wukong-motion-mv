# public/blender_renders

Blender 离线烘焙的 3D 镜头与特效：金箍棒旋风盾、凌霄殿崩裂、五指山巨岩铁索、深渊悬签阵。

## 当前管线（V8-Blender）

| 脚本 | 镜头 | 帧数 | 输出 |
|---|---|---|---|
| `scripts/blender/b_shot1_cudgel_shield.py` | 1B 赤金旋风护盾（透明） | 45 | `b_shot1_cudgel_shield.webm` + `shot1_frames/*.png` |
| `scripts/blender/b_shot2_lingxiao_collapse.py` | 2B 凌霄殿崩裂 | 55 | `b_shot2_lingxiao_collapse.mp4` |
| `scripts/blender/b_shot3_mountain_chains.py` | 3A/3B 巨岩 + 铁索（透明） | 75 | `b_shot3_mountain_chains.webm` + `shot3_frames/*.png` |
| `scripts/blender/b_shot4_verdict_abyss.py` | 4A/4B 悬签阵 + 四连跳切 | 65 | `b_shot4_verdict_abyss.mp4` |

四段共用 `scripts/blender/ukiyoe_style.py`，它把规范写死，禁止各脚本另起一套：

1. `BLENDER_EEVEE`、1920×1080、30 fps、Motion Blur、合成器 Bloom（EEVEE Next 无 `use_bloom`）。
2. `ShaderToRGB → ColorRamp(CONSTANT)` 三色版画：`#120D14` / `#9E1F18` 或 `#E8DEC8` / `#F5C242`。
3. Freestyle 2.2 px、`#0A0808`、ABSOLUTE，只对 `Geo` 集合勾线。
4. 透明镜头 `film_transparent=True`，PNG RGBA 直出。

### 重新生成

```powershell
$B = "D:\Design\blender\blender.exe"
# 1B（45 帧，一步出 PNG → webm → prores）
& $B -b -P scripts/blender/b_shot1_cudgel_shield.py -- --all --frames-dir out/blender_frames/shot1
# 2B（55 帧，一步出 PNG → mp4）
& $B -b -P scripts/blender/b_shot2_lingxiao_collapse.py -- --all --frames-dir out/blender_frames/shot2
# 3A/3B（75 帧）
& $B -b -P scripts/blender/b_shot3_mountain_chains.py -- --all --frames-dir out/blender_frames/shot3
# 4A/4B（65 帧）
& $B -b -P scripts/blender/b_shot4_verdict_abyss.py -- --all --frames-dir out/blender_frames/shot4

# 透明层：PNG RGBA → 无损 WebP → public（像素一致，体积 ≈1/3）
python scripts/blender/png_to_webp.py out/blender_frames/shot1 public/blender_renders/shot1_frames s1
python scripts/blender/png_to_webp.py out/blender_frames/shot3 public/blender_renders/shot3_frames s3
```

单帧验收：

```powershell
& $B -b -P scripts/blender/b_shot2_lingxiao_collapse.py -- --still out/blender_qa/s2_f14.png --frame 14
```

## Alpha 的现实（重要）

| 方案 | 结果 |
|---|---|
| VP9 + `yuva420p` → `.webm` | **alpha 丢失**（落盘 `yuv420p`；`-auto-alt-ref 0` 也无效） |
| VP8 + `yuva420p` → `.webm` | 同上 |
| ProRes 4444 → `.mov` | 文件本身有 `yuva444p12le`，但 Remotion 合成器解码出噪点/黑块 |
| **逐帧位图 → `<Img>`** | ✅ 唯一可靠的真透明通道；落库用**无损 WebP**（像素一致，≈1/3 体积） |

因此 1B / 3A 的透明层由 `src/primitives/senbon_style/BlenderAlphaSequence.tsx`
逐帧读取 `shot1_frames/*.webp`、`shot3_frames/*.webp`（45 帧 12 MB / 75 帧 57 MB）；整屏不透明镜头（2B / 4A / 4B）走
`<OffthreadVideo />` + `.mp4`。`b_shot1/3_*.webm` 与 `.mov` 作为归档母版保留，
不进 git（体积 73–190 MB）。

> 若要恢复 `<OffthreadVideo transparent />` + WebM，需要换一个带 **libwebm 封装**
> 的 ffmpeg（vpxenc / mkvmuxer），只换编码参数无解。

## 已登记资产

### b_shot1_cudgel_shield.webm / shot1_frames/

| 项 | 值 |
|---|---|
| 镜头 | 1B【十万天兵合围】胸前三 维棍盾 |
| 规格 | 1920×1080 / 30 fps / 45 帧 / 1.50 s / VP9 |
| 内容 | 35° 立体倾角的如意金箍棒（盘龙金箍 + 篆书铭文）自旋 3.7 圈，12 层 alpha 拖影、4 段断弧护盾环、96 颗解析弹道火星 |
| 合成 | PNG 序列按 `translate(-337px,246px) scale(0.52)` 钉在大圣双手 (623,786) |

### b_shot2_lingxiao_collapse.mp4

| 项 | 值 |
|---|---|
| 镜头 | 2B【无坚不摧】凌霄殿矩阵崩塌 |
| 规格 | 1920×1080 / 30 fps / 55 帧 / 1.83 s / H.264 CRF 17 |
| 内容 | 24×24 棋盘阵 + 36 根环列斗拱巨柱 + 盘龙宝座 + 80 座飞阁；第 14 帧金箍棒横扫，36 柱裂成 324 块，螺旋俯冲 + Roll 24° |
| 合成 | 整屏底片，2D 大圣/刀光/【无坚不摧】叠在上层 |

### b_shot3_mountain_chains.webm / shot3_frames/

| 项 | 值 |
|---|---|
| 镜头 | 3A/3B【五指山下】巨岩铁索 |
| 规格 | 1920×1080 / 30 fps / 75 帧 / 2.50 s |
| 内容 | 5 座贴六字真言的棱角巨岩砸落 + 8 条 24 段环扣铁索交叉绷紧 |
| 合成 | 透明 PNG 序列插在 `MountainCleft` 的角色之上、符咒之下（z 6.5） |

### b_shot4_verdict_abyss.mp4

| 项 | 值 |
|---|---|
| 镜头 | 4A/4B【罪名是老孙】【不敬权威】 |
| 规格 | 1920×1080 / 30 fps / 65 帧 / 2.17 s |
| 内容 | 3 排 × 7 张 3D 罪状白签 + 体积光柱；第 32/40/48/56 帧四连跳切 1.0→1.45→2.0→1.3，刀光劈散 |
| 合成 | 4A 整屏底片 + 2D 主牌（z60）；4B 仅在每刀第 1–2 帧"破壁"插入 |

## 旧资产（已弃用）

`shot2_palace_destruction.webm`、`shot3_mountain_chains.webm` 由
`render_shot2_collapse.py` / `render_shot3_cleft.py` 生成，已被上面的
`b_shot*` 管线取代；保留文件仅为对照，勿在新代码中引用。

消费组件：
- 不透明：`src/primitives/senbon_style/BlenderPlate.tsx`（`<OffthreadVideo />`）
- 透明：`src/primitives/senbon_style/BlenderAlphaSequence.tsx`（逐帧 `<Img />`）
- 旧：`src/primitives/BlenderAlphaVideo.tsx`（保留但不再用于 1B/3A）
