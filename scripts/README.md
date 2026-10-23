# scripts — 高潮复刻段资产管线

这些脚本只做**离线**处理：切参考片段、分离鼓组、生成字级对齐、独立校验。
渲染期不跑任何 Python；`src/` 只消费 `public/audio/drums_stem.wav` 与
`public/alignment/climax_words.json`。

## 0. 前置：从参考视频切出 09–19 s

仓库不安装系统 ffmpeg，直接使用 Remotion 自带的精简构建（含解码、`scale`、`crop`、音频重采样）：

```powershell
$ff = "$PWD\node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe"
$vid = "C:\Users\karl rex\Downloads\大雨还在下十方神佛在怒骂_哔哩哔哩_bilibili.mp4"
New-Item -ItemType Directory -Force -Path out\ref | Out-Null
& $ff -v error -y -ss 9 -t 10 -i $vid -vn -ac 1 -ar 48000 -c:a pcm_s16le out\ref\segment_09_19.wav
```

产物：`out/ref/segment_09_19.wav`（10.000 s / 48 kHz / 单声道 / 16-bit）。
`out/` 被 `.gitignore` 排除，因此这一步是**可重跑**的本地准备，而不是仓库内容。

## 1. 生成字级对齐（分析用）

```powershell
python scripts/build_climax_assets.py
```

做的事：

1. STFT（1024 / hop 240）→ HPSS 中值滤波遮罩 → 反向 STFT 还原打击乐参考轨，
   只写到 `out/ref/hpss_percussive.wav` 供起音检测使用（不进 `public/`）。
2. 在谐波残差上取 300–4500 Hz 频谱通量找**人声起音**，在打击乐上取 25–200 Hz 找**鼓点**，
   合并为候选集。
3. 用低频包络自相关 + 相位残差搜索拟合速度（≈105 BPM）与拍点偏移。
4. 每句歌词用动态规划给每个汉字挑一个 onset：最大化瞬态强度、惩罚偏离八分音符脉冲。
5. 收尾再吸附一次「参考混音 220–5200 Hz 瞬态」，保证每个字都落在真实瞬态上。
6. 写出 `public/alignment/climax_words.json`（只有秒，没有帧号）。

## 1.5 合成配乐（真正的音轨）

```powershell
python scripts/score.py
```

移植自开源社区的生产级做法（[abstract-algebra-promo 的 music.py](https://github.com/AnctyEnly453/abstract-algebra-promo)、
[mg-styles-15 的 lib/audio](https://github.com/Vincentwei1021/mg-styles-15)）：分轨总线 → 卷积混响 →
侧链 → 胶水压缩 → 前瞻限幅 → 两遍 loudnorm 到 -14 LUFS。

本片的两点不同：

- **旋律由对齐数据驱动**：`climax_words.json` 里每个汉字一个音，五声音阶按句走向取音；
- **主唱是合成的**：按字查拼音韵母 → F1/F2/F3 共振峰带通 → 30 ms 入音滑音 + 辅音噪声爆破，
  这就是"填词调音"里那条人声轨。

产物：`public/audio/climax_mix.wav`（成片音轨）与 `public/audio/drums_stem.wav`（频谱源）。

## 2. 独立校验（交付门）

```powershell
python scripts/verify_climax.py
```

- 结构：35 个字、文案与歌词一致、`start` 单调、`end > start`、落在 0–10 s。
- 音频：**重新**从参考混音算一条独立的频谱通量包络，找局部极大值，
  要求每个汉字起点距最近瞬态 ≤ 50 ms。
- 音乐：附带输出到八分音符网格的偏差（信息性指标）。

退出码非 0 即失败，不允许「能渲染就算过」。

## 2.5 角色资产管线（V5）

```powershell
python scripts/build_wukong_assets.py
python scripts/build_wukong_assets.py --skip-video
```

把参考片 09–19 s 的真帧与生图网关的四姿立绘，离线烘焙成
`public/wukong_assets/` 的木刻套色与纯黑剪影。细节见
[`public/wukong_assets/README.md`](../public/wukong_assets/README.md)。

## 3. 频段标定（可选）

```powershell
node scripts/spectrum_probe.mjs public/audio/drums_stem.wav 30
```

直接调用 `@remotion/media-utils` 内部的 `getVisualization()`，跑满 300 帧，
输出 32 个 bucket 的时间序列与各频段峰值，写入 `out/ref/spectrum_probe.json`。
`src/audio/spectrum.ts` 里的 `BAND_REFERENCE`（low 0.40 / mid 0.085 / high 0.010）
就是由它量出来的：bucket 0–2 是底鼓、3–15 是军鼓/人声body、16–31 是镲片。

## 4. 复刻段的渲染命令

```powershell
npx remotion still src/index.ts WukongClimaxSegment out/climax_preview_45.png --frame=45
npx remotion still src/index.ts WukongClimaxSegment out/climax_preview_210.png --frame=210
npx remotion render src/index.ts WukongClimaxSegment out/senbon_v5_mvp.mp4
```
