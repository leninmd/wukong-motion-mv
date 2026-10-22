# public/fonts

可选的本地字体目录，供 `src/config/fonts.ts` 的 `loadProjectFonts()` 通过 `FontFace` 加载。

推荐文件：

- `NotoSerifSC-VF.ttf`
- `SourceHanSerifSC-Heavy.ttf`
- `LXGWWenKai-Regular.ttf`
- `MaShanZheng-Regular.ttf`

缺失字体时会自动回落到系统宋体/楷体字体栈，不会阻塞渲染；但交付前必须在目标渲染机上确认中文不出现豆腐块、字形度量与设计稿一致。
