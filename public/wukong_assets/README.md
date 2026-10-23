# `public/wukong_assets/` — V6 2K 版画 / 四色套版资产

V6 起，**孙悟空、怒颜、眼部、南天门、凌霄殿、十万天兵全部来自生图网关**，
不再从 852×480 的参考视频里截帧放大，也不再用 `<rect>` 手写建筑。
运行期只贴图（`ClimaxAsset` / `<Img>`），所有处理都在离线管线里完成。

唯一真源是 [`scripts/build_wukong_assets.py`](../../scripts/build_wukong_assets.py)：

```powershell
python scripts/build_wukong_assets.py                     # 全部重建
python scripts/build_wukong_assets.py --only characters   # 四姿立绘
python scripts/build_wukong_assets.py --only prints       # 眼部 / 怒颜
python scripts/build_wukong_assets.py --only buildings    # 南天门 / 凌霄殿 / 天兵
```

## 输入与管线

| 输入 | 处理 | 成品 |
|---|---|---|
| 生图网关 `out/gen/v6_eyes_raw.png`（1376×768） | 取 6.18:1 双眼带 → LANCZOS 2200×356 → unsharp + 反差 + 纸纹 | `eyes_closeup_woodblock.png` |
| 生图网关 `out/gen/v6_face_raw.png`（1024²） | 中心方形裁切 → LANCZOS 2048² → unsharp + 纸纹 + 暗角 | `face_glare_woodblock.png` |
| 生图网关 `v6_gate_raw.png`（848×1264） | LANCZOS 2K → **vtracer** 多层 SVG → **resvg** 栅格 → 纸纹/暗角 | `gate_woodblock.png` 1400×2087 |
| 生图网关 `v6_palace_raw.png` | 去印刷框 → LANCZOS 2K → vtracer → resvg | `palace_woodblock.png` 1400×2100 |
| 生图网关 `v6_army_raw.png`（白/米白底） | 裁黑框 → LANCZOS 2400 → vtracer → resvg → 亮度/饱和度联合软抠 + 米白去污染 → 墨/朱砂/金套色 | `army_silhouette.png` 2390×1102（alpha） |
| 生图网关四姿立绘（896×1200 / 896×1200 / 896×1200 / 896×1200） | **rembg u2net** 去背 → 白边距离阈值 + 外轮廓填洞 + `cv2.erode(3px)` → 硬边 alpha → HSV 四色套版 | `woodblock_*.png`（alpha，长边 1800–2048） |

## 角色四色套版（V6 的关键修正）

V5 的剪影把角色内部**填死成 #120D14**，在 1B/3A 暗底上就是一团黑墨；V5 的
`colour_*` 又保留了生图外圈的白色贴纸边。V6 的 `posterize_character()`：

1. **外轮廓**：rembg 之后只保留「有颜色或明显暗」的像素，取外轮廓填洞（保住
   眼白/牙齿），再 erode；最后把 alpha 边缘 `(a-52)*1.9` 压硬，**无白边**。
2. **内部**：按 HSV 分成四色——
   - 墨 `#120D14`：黑版线、毛发、靴；
   - 朱砂 `#C8281E`：披风、领巾、面部朱砂；
   - 鎏金 `#F5C242`：甲胄鳞片、金箍棒、凤翅；
   - 宣纸 `#EAE0CE`：脸、牙、眼白、浅色衣料。
3. **不做荧光描边、不做 drop-shadow**。需要从暗底分离时，由场景给亮底/逆光，
   或 `ClimaxAsset` 的朱砂/青/金三层错位残影完成。

## 文件

| 文件 | 尺寸 | 用途 |
|---|---|---|
| `eyes_closeup_woodblock.png` | 2200×356 | s2a 眼部横切 |
| `face_glare_woodblock.png` | 2048×2048 | s4b 四连跳切怒颜 |
| `gate_woodblock.png` | 1400×2087 | s1a 第一格 南天门 |
| `palace_woodblock.png` | 1400×2100 | s1a 第二格 凌霄殿 |
| `army_silhouette.png` | 2390×1102 (RGBA) | s1a 第三格 / s1b 十万天兵 |
| `woodblock_spin.png` | 1240×1800 (RGBA) | s1b 旋棍 |
| `woodblock_slash.png` | 1876×2048 (RGBA) | s2b 横扫 |
| `woodblock_trapped.png` | 1239×1800 (RGBA) | s3a / s3b 跪撑 |
| `woodblock_raise.png` | 1463×1800 (RGBA) | s1a 第四格 举棒 |

## 硬约束

1. 禁止 SVG `<polygon>` 手写大圣五官/身体（AGENTS.md §13）。
2. 禁止从 480p 参考片截帧放大做面部/眼部（V5 的红白灰像素斑事故）。
3. 外轮廓必须锐利、无白边；内部必须有甲胄金线与披风朱砂，不能填死成黑团。
4. 建筑/天兵必须走 vtracer + resvg；禁止 `<rect>` 搭南天门。
5. 生图原图只落 `out/gen/`（gitignore）；本目录只放成品。
6. `manifest.json` 记录尺寸、来源、sha 前缀；`assets.manifest.json` 记录完整提示词。

## V7 追加（2026-10-23）

V7 新增 3 张，并修正 1 张的取景：

| 文件 | 尺寸 | 用途 | 来源 / 状态 |
|---|---|---|---|
| `woodblock_charge.png` | 1355×1800 | 1B 双手胸前结印（静态棍从源头消失） | 生图网关 `v7_charge_raw.png`；下半身宣纸色压成暖灰，避免与纸底同色 |
| `woodblock_panel4.png` | 1355×1800 | 1A 第四格 腾空劈棒 | 生图网关 `v7_panel4_raw.png`（配额恢复后生成）→ 四色套版 |
| `halberds_woodblock.png` | 1400×2110 | 1A 第三格 银戈林 | 生图网关 `v7_halberds_raw.png` → vtracer + resvg |
| `five_finger_mountain_woodblock.png` | 2048×1130 | 3A/3B 满屏五指山 | 生图网关 `v7_mountain_wide_raw.png`（配额恢复后生成）→ vtracer + resvg；`build_mountain_fallback.py` 仅作断网/429 备用 |
| `face_glare_woodblock.png` | 2048×2048 | 4B 怒颜 | 沿用 V6 的 2048² 图；**图本身双眼完整**，V7 只把 4B 取景从 1.5× 改为 1.0×+下移 188px，让双眼/紧箍/獠牙同时入画。网关恢复后仍建议重生成一版更居中的脸 |

V7 生成过程（如实记录）：

- 第一轮 charge / halberds 成功后，panel4 / mountain / face 连续
  `429 RESOURCE_EXHAUSTED`；panel4 曾临时用 `woodblock_slash.png` 顶替，mountain
  用 `scripts/build_mountain_fallback.py` 兜底。
- 等待配额恢复后，panel4 与 mountain 已重新生成并替换；**当前目录里的成品是生图版**。
- `face_glare_woodblock.png` 仍是 V6 图；V7 通过取景修正让双眼完整入画（见 4B），
  没有为了“重新生成”而牺牲已可用的素材。



