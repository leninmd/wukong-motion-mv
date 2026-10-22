# public/ai

## 2026-10-22 状态：本目录已清空（纯代码重建）

`WukongClimaxSegment` 的 10 秒复刻段已按《千本樱》纯代码路线重构，**不再引用任何 AI 生成位图**。原先的 5 张板（`bg_court_wide` / `bg_impact` / `bg_mountain` / `bg_crevasse` / `bg_verdict`）已从仓库删除，`src/primitives/Plate.tsx` 一并移除。

背景、人物、战幡、符咒、天兵、山体、金箍棒冲击波全部由：

- SVG 路径 / `<pattern>` / 渐变（`src/primitives/senbon_style/`）
- Three.js 基础几何体（`CudgelImpact3D.tsx`，`@remotion/three`）
- CSS 3D 与裁剪（推拉门、劈字、木牌翻面）

实时绘制。**这段不需要、也不允许再引入 AI 静帧**。

## 仍然有效的契约（仅当未来别的镜头需要美术板时）

- 尺寸 ≥1920×1080 PNG；需要透明时保留 alpha。
- 文件名与 `assets.manifest.json` 的 `file` 字段逐字一致。
- 只用 `#0B090A / #F4EFE6 / #D93025 / #FCC934`，金色必须有明确光源。
- 板上不要生成可读文字，文字一律由代码排版。
- 生成只允许通过 `scripts/gen_plates.py`（读 manifest）或 `scripts/agy_image.mjs`。
- 板缺失时合成必须回落到纯代码版本，不得黑屏。

## 当前清单

| id | 用途 | 文件 | 状态 |
|---|---|---|---|
| — | — | — | 无（纯代码段） |

## 不要做的事

- 不要在 `src/primitives/senbon_style/` 里用 `<Img />` 引用任何 AIGC 输出。
- 不要把旧的 5 张板从备份里重新拷回来“垫底”；这段的验收标准就是零位图背景。
