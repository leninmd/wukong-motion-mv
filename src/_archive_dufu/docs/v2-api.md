# V2 分镜开发契约（Scene API Contract）

> 所有分镜由独立子智能体并行编写。**只改自己被分配的那一个 `scenes/sXX_*.js` 文件**，
> 严禁修改 `engine/`、`app.js`、`index.html`、`storyboard.json`（这些是共享契约）。

## 1. 场景类契约

```js
(function (DFS) {
  const { W, H, clamp, lerp } = DFS;
  const HUB = DFS.HUB;
  const T = DFS.THEME;

  DFS.sceneRegistry['s03'] = class Scene03V2 {
    // L = 场景内时间（秒，从 0 开始）；t = 全片时间；ch = storyboard 里的章节对象
    draw(ctx, L, t, ch) { ... }

    // 返回 true 时 HUD 用亮色（深色背景）
    hudDark(L) { return true; }
  };
})(window.DFS);
```

- 画布固定 **1920×1080**，`ctx` 已重置过 transform/alpha/filter。
- **禁止** `Math.random()` / `Date.now()`；随机数用 `DFS.rng(seed)` 或 `DFS.hash(seed, i)`。
- **禁止** `ctx.filter = 'blur(...)'` 作用于大量 path（性能灾难，单帧可到 20s）。
  需要柔化时：低 alpha + 细笔画 + 叠加雾层，或只对**单个** `<canvas>` 级绘制用一次。
- 每帧的文本绘制总量控制在 **2500 次 fillText 以内**。
- 场景必须自己画满整帧（不允许露出上一场）。

## 2. 可用引擎（已加载，直接用）

### 基础 `DFS`
`W, H, FPS, clamp, lerp, map, smoothstep, rng(seed), hash(seed,i), noise2(x,y), fbm(x,y,oct)`
`Ease.{outExpo,inExpo,inOutExpo,inOutCubic,outCubic,inCubic,outQuint,outBack,spring,snap}`
`font(size, weight, family)` `cnNum(n)`（→ 一〇五七）`km(n)`（→ 4,739）
`THEME.colors.{paper,paperHi,paperLo,ink,cinnabar,night,gold,hudLight,hudDark}`
`THEME.fonts.{serif,heavy,kai,brush,mono}`

### 图层 `DFS`
`drawPaper(ctx,{zoom,tint})` `drawNight(ctx,{inner,mid,outer})`
`drawGradientMesh(ctx,t,{c1,c2})` `drawGrainVignette(ctx,frame,{grain,vig})`
`drawInkWash(ctx,{x,y,r,seed,alpha})` `mkCanvas(w,h)`

### 文字动力学 `DFS.kinetic`（挂在 DFS 上）
`textIn(ctx, text, {x,y,size,weight,family,color,align,tracking,t,start,dur,stagger,rise,from,blur})`
`verticalIn(ctx, text, {x,y,size,gap,t,start,stagger,dur,color})`
`particleText(ctx, text, {x,y,size,vertical,assemble,dissolve,wind,color,step,seed})`
`outlineText(ctx, text, {x,y,size,weight,lw,tracking,color})`
`grainText(ctx, text, {x,y,size,weight,family,color,rough,seed})`  木刻质感大字
`seal(ctx,{x,y,size,text,chars,color,rotate})`  `handCircle(ctx,{x,y,rx,ry,progress,lw})`
`redTile(ctx,{x,y,size,ch,rot,scale,depth})`  `card(ctx,{x,y,w,h,rotY,front,label,sub})`

### 场景资产 `DFS`
`Camera` `TypeField`（`drawFlat(ctx,cam,t,{fogNear,fogFar,inkColor})` 平铺活字版面 / `draw` 立体）
`RidgeCloud`（`draw(ctx,cam,t,{alpha,color,size,focus})`，focus 0→1 群峰收束为孤峰）
`Sea`（`drawSky/drawSea/drawPaperSea/drawMoonPath`）`Rain` `Reeds` `Bamboo` `Leaves`
`figure(ctx,x,y,scale,{t})` `boat(ctx,x,y,scale,{t,figure})` `bird(ctx,x,y,scale,t)`
`splatter(ctx,x,y,{n,radius,progress,seed})` `textWall(ctx,{text,x,y,size,alpha})` `mist(ctx,t,{...})`

### 外挂美学底座 `DFS.HUB`（V2 新增，强制使用）
```
HUB.ease.*                     高阶缓动（同 DFS.Ease，另含 outElastic/snap）
HUB.springPhysics(t,{stiffness:180,damping:14,mass:1,duration:1})  → 0..1（可过冲）
HUB.multiEntrance(t,start,{duration:.6,rise:42,scaleFrom:.92,blur:8}) → {alpha,dy,scale,blur,apply(ctx)}
HUB.stagger(i,{frames:6})      错落相位（秒）
HUB.fastExit(t,start,{duration:.24}) → {alpha,blur,apply(ctx)}
HUB.idleMicroMotion(t,seed)    静默呼吸 {dy,dx,scale,rot}
HUB.fiveLayerStack(ctx,t,{dark,layer1,layer2,layer3,layer4,grade:'warm'|'cold',grain,vignette})
HUB.cameraShake(frame,{amp:8,decay:9,startFrame}) / HUB.applyCameraShake(ctx,shake)
HUB.PALETTE   {paper,paperEdge,ink,night,cinnabar,gold,gray,paperDeep,nightDeep,goldHi}
HUB.FONTS     {serif,heavy,kai,brush,mono}
HUB.title(ctx,text,{x,y,size,weight:900,tracking,color,align})      // 900 字重 + 0.08em 字距
HUB.quote(ctx,text,{x,y,size,highlight:'诗史',highlightColor})       // 金句单字高亮
HUB.vertical(ctx,text,{x,y,size,gap,color,align})
HUB.monoNums(ctx,text,x,y,size,{color,align,tracking})               // tabular 数字
HUB.scaleByShortEdge(px)  HUB.measureFit(ctx,text,maxW,size)
HUB.inkStampSplash(ctx,x,y,progress,seed,{size,text,chars})          // 朱印砸落 + 飞溅
HUB.offscreenWindDissolve(ctx,text,x,y,{size,assemble,dissolve,wind,color,seed})  // 风场吹散
HUB.cinematicPortalWipe(ctx,cx,cy,progress,drawOuter,drawInner)      // 圆孔穿越
HUB.waterMoonShader(ctx,w,h,t,{horizon,moonX,moonY,moonR})           // 江面 + 月光走廊
HUB.PrebakedCollapse  // 刚体预烘焙（见 docs 内注释）
```

## 3. 调试状态（QA 探针要读，必须写）

```js
DFS.dbg({ typeField: 1600 });          // 任意键值，合并进 window.DEBUG_STATE
DFS.dbgBox('poem-line-1', x1, y1, x2, y2);   // 文本包围盒，用于溢出/重叠/对比度检查
DFS.dbg({ counters: { wanjin: 8450 } });     // 计数器
DFS.dbg({ gullParticles: 160 });             // 粒子数量类指标
```
**每个出现文字的镜头都必须 `DFS.dbgBox(...)` 上报包围盒**，否则 QA 判不通过。

## 4. 视觉规范（统一，不得自创）

- 60/30/10：纸白/墨黑为底，朱砂 `#D9381E` 是**唯一 hero 色**，每帧最多一处高饱和红。
- 字重极差：诗眼/金句 900，叙事 300–400，年份与里程用等宽 `HUB.monoNums`。
- 安全区：x∈[96,1824]，y∈[54,1026]。竖排诗行统一放右侧 `x∈[1360,1760]` 或左侧 `x∈[150,420]`。
- 动效：入场必须 `HUB.multiEntrance`（四属性联动），错落 `HUB.stagger(i,{frames:5})`，
  退场 `HUB.fastExit`，停留期叠加 `HUB.idleMicroMotion`。
- 文字压在深色背景上时，要么加纸色羽化衬底，要么换亮色；**黑字绝不准压在黑色粒子上**。

## 5. 自检（必须做，否则视为未完成）

```powershell
$env:V2_RENDER_PORT="8341"     # 每个 agent 用不同端口，避免互相抢占
python render/render3.py stills --times 5.0,8.0,12.0 --out output/v2_work/<你的场景名>
```
把生成的 jpg 用 `read_image` 逐张看，确认：无文字溢出、无重叠、无黑屏、构图居中、动效可读。
至少自检 **3 个时间点**，不满意就改，改完再看。
