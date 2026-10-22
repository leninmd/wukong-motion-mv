# `public/wukong_model/` — 孙悟空角色模型资产

V3 重制新增。**唯一真源是代码**：`src/primitives/senbon_style/wukongRigGeometry.ts`。
这里的文件全部由脚本从那份几何推导出来，不手工编辑，也不允许反向修改。

## 目录内容

| 文件 | 说明 |
|---|---|
| `wukong_rig.json` | 四个姿态的完整多边形数据（parts / eyes / crown / feathers / staff） |
| `wukong_<pose>.svg` | 高精度矢量轮廓，带 `#0B090A` 内胆、2px 鎏金描边与 `feDropShadow` 外发光 |
| `wukong_<pose>.png` | 透明 RGBA 切片，1640×2240（2× 超采样降采样），4096 像素内边缘干净 |
| `wukong_<pose>_outline.svg` | 由 PNG 的 alpha 通道 `cv2.findContours` 反提的闭合轮廓（1–7 条路径） |
| `manifest.json` | 每姿态的部件数 / 顶点数 / 翎与金箍棒元信息 |
| `raster_manifest.json` | 栅格化结果：尺寸、alpha 覆盖率、轮廓条数 |

## 四个姿态

| pose | 用途 | 部件 | 顶点 |
|---|---|---|---|
| `spin_staff` | Shot 1 凌霄迎敌，双手在身前极速转棍 | 40 | 234 |
| `slash_horizontally` | Shot 2 破阵横扫，带三层延迟重影 | 38 | 213 |
| `trapped_overhead` | Shot 3 五指山俯视，仅露肩甲/双爪/仰头 | 20 | 117 |
| `snarl_closeup` | Shot 2 & 4 火眼金睛脸谱特写 | 8 | 39 |

## 硬性视觉约束（改几何时必须守住）

1. 全部轮廓是**直边多边形**，没有一个圆 / 椭圆 / 螺旋。
2. 身体内部恒为纯墨黑 `#0B090A`；外描边 2px 鎏金，整体 `drop-shadow(0 0 3px #FCC934)`。
3. 面部**只有**两道倒三角赤金眼眸 + 额头金箍 + 冠心 + 凤翅。
   **禁止**鼻子、嘴、腮红、胸口旋涡、獠牙。

## 重新生成

```powershell
node scripts/export_wukong_model.mjs        # TS 几何 → JSON + SVG
python scripts/rasterize_wukong_model.py    # JSON → 透明 PNG + 反提轮廓 SVG
```

运行时**不读这些 PNG**：`WukongRig.tsx` 用同一份几何实时画 SVG，以便驱动翎的
物理、金箍棒每帧 45° 旋转与音频频谱。PNG/SVG 用于审片、比对与后续
ComfyUI / Blender 对齐。
