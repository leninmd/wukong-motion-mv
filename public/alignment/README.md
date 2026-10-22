# public/alignment

毫秒级字级对齐与节拍网格。所有时间是**秒**，不是帧。场景代码必须用当前 Composition 的 fps 动态换算。

## 文件

- `wukong.alignment.json` — 字/词级时间轴（正片必需）
- `wukong.beats.json` — 节拍网格（可选但推荐）

## `wukong.alignment.json` 契约

```json
{
  "version": 1,
  "source": "BS-RoFormer stem + forced alignment",
  "mode": "char",
  "audio": "audio/mix.wav",
  "fps": 60,
  "duration": 0.0,
  "units": [
    {
      "id": "u0001",
      "text": "字",
      "start": 0.0,
      "end": 0.0,
      "confidence": 0.99,
      "energy": 0.0
    }
  ],
  "sections": [
    {"id": "intro", "start": 0.0, "end": 0.0, "label": "序"}
  ],
  "beats": {
    "bpm": 0,
    "offset": 0.0,
    "beats": [0.0]
  }
}
```

- `units` 必须按 `start` 升序；`end > start`。
- `fps` 仅作参考，**消费端不得信它**，必须用运行时 `useVideoConfig().fps`。
- 禁止保存 `startFrame` / `endFrame` 字段；这是工程宪法第 1 条。
- 标点、气口与停顿也要有明确时间，不要靠场景里的 `+= 0.2` 猜测。

## `wukong.beats.json` 契约

```json
{
  "version": 1,
  "audio": "audio/drums_stem.wav",
  "bpm": 0,
  "offset": 0.0,
  "beats": [0.0]
}
```

节拍时间同样是秒。分镜切点优先吸附到 `beats` 最近值，但切镜仍通过 `beats[i] * fps` 动态换算。
