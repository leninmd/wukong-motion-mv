# public/ai

AI 生成的美术板。所有文件由 `assets.manifest.json` 声明后生成，命名稳定、可重建，禁止依赖任何 AIGC 厂商的本机绝对路径。

## 契约

- **尺寸**：背景板 ≥ 1920×1080 PNG；精灵（透明）按 manifest 声明，必须保留 alpha。
- **文件**：文件名与 manifest 的 `file` 字段逐字一致；改图先改 manifest。
- **色彩**：只用 `#0B090A / #F4EFE6 / #D93025 / #FCC934`，金色必须有明确光源。
- **禁止**：把生成结果里的可读文字当真（一律由代码排版）；把 AI 板当成分镜的全部（镜头语言仍由代码控制）。

## 清单

| id | 用途 | 文件 | 状态 |
|---|---|---|---|
| bg_court_wide | 镜头 01/02/03 | `bg_court_wide.png` | ✅ 1920×1080 |
| bg_impact | 镜头 04–07 | `bg_impact.png` | ✅ 1920×1080 |
| bg_mountain | 镜头 08/11 | `bg_mountain.png` | ✅ 1920×1080 |
| bg_crevasse | 镜头 09 | `bg_crevasse.png` | ✅ 1920×1080 |
| bg_verdict | 镜头 10/12 | `bg_verdict.png` | ✅ 1920×1080 |
| spr_cudgel | 金箍棒 | — | ✗ 生成器无真 alpha，改用代码 `CudgelSlash` |
| spr_spears | 前景枪林 | — | ✗ 改用代码剪影 |
| spr_dust | 浮尘层 | — | ✗ 改用代码粒子 |

生成器原始输出是 **1376×768 JPEG**，脚本统一居中裁到 16:9 后 Lanczos 放大到 1920×1080 并转 PNG。
放大 1.4× 在 1080p 下肉眼看不出，但**不要**在 4K 母版里直接复用这批板。

## 重建

```powershell
python scripts/gen_plates.py --only bg_court_wide     # 生成单张
python scripts/gen_plates.py --all                     # 按 manifest 全量（有预算上限）
```

生成通过本机 Antigravity CLI 的 `image-generator` 子 agent 完成；脚本只做「读 manifest → 拼提示词 → 调一次 → 校验尺寸与是否落盘」，不做任何隐式重试。

## 缺失时的降级

任何板缺失时，合成层自动回退到纯代码版本（`PalaceHall` / `FiveFingerMountain` / `ParchmentPanels`），画面不会黑屏；`npm run typecheck` 与 still 渲染不依赖 AI 板存在。
