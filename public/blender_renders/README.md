# public/blender_renders

Blender 渲染的透明 3D 特效：金箍棒挥击、山石破碎、天宫崩塌、八卦炉火焰等。

要求：

- 带 Alpha 的 WebM（VP9 + alpha）或 ProRes 4444 MOV；推荐 WebM 以控制体积。
- 不需要音轨；音效统一由 `public/audio/fx/` 管理。
- 帧率与母版一致（60 fps），画幅 1920×1080，预乘 Alpha 与 Remotion 读取方式需验证。
- 命名：`cudgel_shatter_01.webm`、`heaven_collapse_02.webm`。
- 同一镜头只渲染画面内的最小画幅，不要把全屏黑边带入合成。

消费组件：`src/primitives/BlenderAlphaVideo.tsx`（`<OffthreadVideo transparent />`）。

首帧 still 验收：在 Remotion Studio 中确认 Alpha 边缘无黑边、无锯齿、无颜色偏移。
