# public/audio

正片音频资产目录。推荐命名：

| 文件 | 用途 |
|---|---|
| `original.wav` | 原曲/参考曲，保留未处理版本 |
| `drums_stem.wav` | BS-RoFormer 分离鼓组，唯一允许驱动频谱的轨之一 |
| `instrumental.wav` | 去人声伴奏，频谱备选轨 |
| `wukong_vocal_dry.wav` | 孙悟空角色干声 |
| `wukong_vocal_tuned.wav` | 调音/填词后的角色主唱 |
| `wukong_vocal_double.wav` | 叠加和声/鬼畜切片层 |
| `fx/` | 砸印、风声、金属、炉火等音效 |
| `mix.wav` | 最终混音（不得直接用于频谱） |

约束：

- 采样率统一 48 kHz，24-bit WAV 为母版；交付视频使用 AAC 320 kbps。
- 文件必须与 `public/alignment/*.json` 的 `audio` 字段一致。
- 频谱只读取 `drums_stem.wav` 或 `instrumental.wav`，并遵守 `AGENTS.md` 第 3 条。
- 大文件若仅本地使用，可在 `.gitignore` 中逐项排除，但需在 `README` 登记来源与重建方式。
