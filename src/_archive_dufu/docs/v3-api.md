# V3 分镜契约（120 秒 · 零旁白 · 只用原典）

## 0. 铁律
1. **屏幕上每一个字都必须来自 `storyboard.v3.json` 的 `texts` 字段**（已逐字核对过《旧唐书》《新唐书》元稹《墓系铭》、杜甫原诗）。
   **严禁自己写任何现代句子、标语、注释词**（包括"注释""特写""时空"这类现代说明字）。需要小字时只能用已给的 `_note` / `_source` 字段。
2. 场景文件只写 `scenes/sXX_*.js` 一个文件。**不要改** engine/、app.js、index.html、storyboard.v3.json。
3. 禁止 `Math.random` / `Date.now`；用 `DFS.rng(seed)`、`DFS.hash(seed,i)`。
4. 禁止 `ctx.filter='blur()'` 作用于大量 path。
5. 单帧 fillText ≤ 2000；总粒子 ≤ 2500。

## 1. 场景类
```js
DFS.sceneRegistry['s04'] = class Scene04V3 {
  draw(ctx, L, t, ch) { ... }   // L=场景内秒数，t=全片秒数
  hudDark(L) { return true; }
};
```
画布固定 1920×1080，ctx 已重置。

## 2. V3 新增引擎（必须用）
```js
const V3 = DFS.V3;
V3.paper(ctx, {zoom, dark})                 // 宋代麻纸（fBm 凹凸+纤维+帘纹），dark 为压暗比例
V3.inkText(ctx, text, {x,y,size,weight,vertical,gap,tracking,color,alpha,seed})
                                            // 墨渗字：飞白打孔 + 毛细毛边（比 fillText 高级，正文字都用它）
V3.eight(ctx, t, {l1,l2,l3,l4,l5,l6,l7,dust,grade:'warm'|'cold'|'ash',grain,vignette,void:true})
                                            // 八层管线：l1纸/l2资产/l3体积光/l4物理/l5排版/l6气溶胶/l7调色/l8颗粒
V3.aerosol(ctx, t, {count,alpha,color,seed}) // 160 颗布朗漂移金屑（eight 已默认调用）
V3.spearRain(ctx, t, {count,speed,alpha,slant,timeScale})  // 黑矛式暴雨
V3.volumetricLight(ctx, t, {count,alpha,color})            // 体积光柱
V3.cloudBank(ctx, t, {count,alpha,y0,y1})                  // 云海
V3.CelestialLattice                        // 参数化金色殿宇线框矩阵
V3.hallWire(ctx,{x,y,w,h,a,lw,color})      // 单座重檐庑殿顶线框
V3.FinePolyRuins                           // 8~12 顶点破损多边形断碑 + 预烘焙物理
```
`DFS.HUB` 仍可用：`multiEntrance / stagger / fastExit / idleMicroMotion / cameraShake / springPhysics / inkStampSplash / offscreenWindDissolve / cinematicPortalWipe / waterMoonShader / PALETTE / title / quote / vertical / monoNums`。
原有 `DFS` 资产也都在：`Camera / TypeField / RidgeCloud / Sea / Rain / Reeds / Bamboo / Leaves / boat / figure / handCircle / seal / grainText / textIn / verticalIn / particleText`。

## 3. 排版与配色（统一）
- 底色：麻纸 `#F3EAD6→#D3C2A2`；墨 `#1A1309`；朱砂 `#D9381E`；金石金 `#C59B27`；夜`#0A0A08`
- 正文一律 `V3.inkText`（有毛细毛边），不用裸 fillText 画大字。
- 竖排诗行：右起，`x∈[1520,1760]`；横排大字：居中，安全区 x∈[160,1760] y∈[90,990]。
- 出现文字的镜头必须 `DFS.dbgBox('<id>', x1,y1,x2,y2)` 上报。
- 静帧 Hold 段落：文字落定后**不要再加新元素**，只留气溶胶与呼吸微动。

## 4. 自检（必须做 2 轮）
```powershell
$env:V2_RENDER_PORT="8351"   # 每人一个端口：A=8351 B=8352 C=8353 D=8354 E=8355
python render/render3.py stills --times 0.5,3,6 --out output/v3_work/<场景>
```
用 `read_image` 逐张看，确认：文字无溢出、无重叠、无黑屏、构图稳、质感（纸纹/墨边/金线）真的出来了。
