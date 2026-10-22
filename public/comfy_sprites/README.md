# public/comfy_sprites

ComfyUI 生成、已抠图的孙悟空角色/道具立绘。

要求：

- PNG，RGBA，透明背景；不要白底/绿幕。
- 长边建议 2048–3072 px，保留足够边缘用于推拉镜头。
- 命名：`wukong_[state]_[variant]_[two-digit].png`，例如 `wukong_ink_stand_01.png`、`wukong_golden_eyes_roar_02.png`。
- 同一状态的多帧请按 `_01`、`_02` 排序，并在随附 `manifest.json` 中登记：文件、尺寸、锚点、作者、生成参数摘要。
- 角色轮廓内不要烘焙背景粒子；粒子交给 Remotion 合成，便于分轨调整。

消费组件：`src/primitives/ComfySprite.tsx`（`<Img />`）。
