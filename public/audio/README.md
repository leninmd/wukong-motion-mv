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

## 已落盘资产

| 文件 | 来源与重建方式 |
|---|---|
| `climax_mix.wav` | 高潮段完整配乐：**全部由 `scripts/score.py` 合成**。鼓组（太鼓／底鼓／军鼓／踩镲／沙锤／木鱼／锣）、低音、弦乐垫、钟琴点缀、古筝（Karplus-Strong）加花、竹笛副旋律，外加按拼音韵母做 F1/F2/F3 共振峰合成的"人声"主旋律（逐字一个字）。48 kHz 立体声 / 严格 10.000 s / -14 LUFS / 真峰值 ≤ -1.5 dBTP。无任何采样与录音。 |
| `drums_stem.wav` | 同一次合成导出的**鼓组总线**，专门喂 `visualizeAudio()`（宪法第 3 条：频谱只绑鼓组或伴奏）。48 kHz 立体声 / 10.000 s / 0.9 峰值。 |

母带与自检（`python scripts/score.py` 末尾会打印）：

```
qc: duration 10.000s peak 0.652 dc +0.00009
qc: bands sub<60 28.7% bass<250 47.1% lowmid<2k 17.0% presence<5k 2.8% brilliance<12k 2.5%
qc: stereo corr 0.82  L/R 0.176/0.179
```

频段占比落在 mgaudio 文档给的健康区间（sub 5–35% / bass 30–65% / presence 1–5% / brilliance 0.5–6%）；
低频做了单声道折叠（<120 Hz），手机外放不会相位抵消。

> 早期版本曾用 HPSS 从参考切片里提取鼓组当频谱源；改成合成配乐后，HPSS 只作为对齐分析用的中间产物留在 `out/ref/`，不再进入 `public/`。
