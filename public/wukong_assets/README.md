# `public/wukong_assets/` — V5 真实造型资产

V5 起，**孙悟空不再由代码画**。V4 用 `<polygon>` 手写五官，放大就是折纸积木人；
这里放的是从真实素材烘焙出来的透明 PNG，运行期只贴图（`ClimaxAsset` / `<Img>`）。

唯一真源是 [`scripts/build_wukong_assets.py`](../../scripts/build_wukong_assets.py)：
本目录所有文件都由它生成，不手工编辑。重新生成：

```powershell
python scripts/build_wukong_assets.py           # 参考帧 + 立绘全量重烘
python scripts/build_wukong_assets.py --skip-video   # 只重建剪影
npm run assets:wukong
```

## 两条输入

| 来源 | 素材 | 处理 |
|---|---|---|
| 参考片 `大雨还在下…mp4` 00:09–00:19（本地 `out/ref/frames/`，gitignore） | f271 咬牙怒视、f271 眼部横带、f166 后脑 | 木刻套色：放大 → 双边/均值漂移扁平 → 5 阶色调分层（带网点抖动）→ 朱砂/鎏金分色 → Sobel + 黑帽黑版线 → 和纸颗粒 |
| 生图网关（`scripts/agy_image.mjs`，纯白底平涂立绘） | 旋棍 / 横扫 / 跪撑 / 举棒 四姿 | 白底抠除 → 外轮廓填洞 → 2× 平滑 → 纯 `#120D14` 剪影；另存一份平涂彩稿 `colour_*.png` |

## 文件

| 文件 | 尺寸 | 用途 | 说明 |
|---|---|---|---|
| `face_glare_woodblock.png` | 1280×1200 | s4b 四连跳切 | 参考片 00:18.0 真帧套色，五官来自六小龄童 |
| `eyes_closeup_woodblock.png` | 1920×660 | s2a 眼部横切 | 同一帧的眼部横带，punch=2.05 强化黑版 |
| `silhouette_spin_staff.png` | 1049×1500 | s1b 满月逆光 | 纯黑剪影，无描边、无荧光线 |
| `silhouette_side_slash.png` | 1830×1500 | s2b（彩色版） | `colour_side_slash.png` 供前景侧影 |
| `silhouette_trapped.png` | 1062×1500 | s3a / s3b | 单膝跪地、双手撑岩 |
| `silhouette_raise_staff.png` | 1215×1500 | s1a 第四格 | 正面举棒怒吼 |
| `trapped_print.png` | 1400×900 | 备用 | 参考片 00:14.5 后脑与红箍，V5 正片未启用 |

`colour_*.png` 与 `silhouette_*.png` 同源同尺寸，只是保留了平涂色块——暗场前景
用彩稿更亮，亮场逆光用剪影更狠。

## 硬约束

1. **不允许再用 SVG `<polygon>` 手写大圣的五官或身体**（AGENTS.md §13）。
2. 剪影内部恒为 `#120D14`，**禁止描边、禁止 drop-shadow 荧光**；需要分离时只用
   1px 宣纸色边缘或朱砂/青/金三层错位残影（`ClimaxAsset` 的 `echo`）。
3. 素材文件名稳定、可版本化；禁止在代码里出现生图会话路径。
4. 生图网关产出的原始图落在 `out/gen/`（gitignore），本目录只放处理后的成品。
5. `manifest.json` 记录每张图的来源、尺寸、sha 前缀，供审片与回归比对。
