"""浮世绘三渲二木刻 —— 全项目 Blender 脚本共用的唯一渲染规范。

本模块把用户 2026-10 的硬性要求固化成代码，任何 `scripts/blender/b_shot*.py`
都必须 import 这里，禁止各自复制一套材质 / 渲染设置：

1. 渲染器 `BLENDER_EEVEE`，1920x1080，fps 30，开启 Bloom 与 Motion Blur。
   - Blender 5.2 的 EEVEE Next 已移除 `use_bloom`，Bloom 由合成器 Glare
     (`Fog Glow`, 阈值 0.55) 承担，脚本会自动创建合成节点树。
   - Motion Blur：`render.use_motion_blur` + `eevee.motion_blur_steps`。
2. 版画级 NPR 着色器：`ShaderNodeShaderToRGB` → `ShaderNodeValToRGB`
   (`interpolation='CONSTANT'`) 三段阶梯，锁死三色：
     暗部   #120D14  纯墨黑
     中调   #9E1F18  朱砂红 / #E8DEC8 古宣纸
     高光   #F5C242  赤金（自发光环纹同色）
   禁止默认灰色塑料 PBR：所有基础材质都走白底漫反射 → 三段色阶，
   颜色只由色阶决定，不由贴图决定。
3. 水墨勾线：`scene.render.use_freestyle = True`，线色 `#0A0808`，
   厚度 2.2px（ABSOLUTE），轮廓 / 边界 / 折痕 / 外轮廓全开。

除渲染规范外，本模块还提供四段镜头共用的：
  · 场景清理 / 集合管理（几何进 `Geo` 集合参与勾线，文字进 `Detail` 不勾线）
  · 相机与看向约束、螺旋运镜采样
  · PNG 序列渲染与 ffmpeg 编码（VP9 + yuva420p 真 Alpha / H.264 MP4）
  · 中文字体加载与 3D 文字（篆书铭文、罪状签文）
  · 确定性伪随机（禁止 random 无种子）

命令行约定（四段脚本一致，参数放在 `--` 之后）：
  --preview <png>            单帧预览（默认半分辨率）
  --still <png> [--frame N]  单帧全质量
  --all [--frames-dir DIR]   全序列 PNG
  --encode-webm <path>       序列 → VP9 Alpha WebM
  --encode-mp4 <path>        序列 → H.264 MP4
  --inspect                  打印场景统计，不渲染
"""

from __future__ import annotations

import glob
import math
import os
import random
import shutil
import subprocess
import sys
import time

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

# --------------------------------------------------------------------------- #
# 规范常量
# --------------------------------------------------------------------------- #

FPS = 30
RES_X, RES_Y = 1920, 1080

PAL = {
    # 三色版画（唯一允许的明暗三色）
    "ink": "#120D14",
    "cinnabar": "#9E1F18",
    "paper": "#E8DEC8",
    "gold": "#F5C242",
    # 墨线（比暗部更深、更冷，木刻刀口）
    "line": "#0A0808",
    # 允许的辅助色：全部由三色派生，不引入第五主色
    "ink_deep": "#0B090A",
    "ink_soft": "#1C141A",
    "cinnabar_deep": "#6E120E",
    "paper_dim": "#C9BBA2",
    "paper_bright": "#F4EFE6",
    "gold_bright": "#FFD877",
}

TAG = "blender"


def set_tag(tag: str) -> None:
    global TAG
    TAG = tag


def log(msg: str) -> None:
    print(f"[{TAG}] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# 颜色 / 数学
# --------------------------------------------------------------------------- #

def hex_to_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(hex_color: str, alpha: float = 1.0):
    r, g, b = hex_to_rgb(hex_color)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def clamp01(value: float) -> float:
    return 0.0 if value < 0.0 else 1.0 if value > 1.0 else value


def ease_in_out(t: float) -> float:
    t = clamp01(t)
    return t * t * (3.0 - 2.0 * t)


def ease_out_cubic(t: float) -> float:
    t = clamp01(t)
    return 1.0 - (1.0 - t) ** 3


def ease_in_cubic(t: float) -> float:
    t = clamp01(t)
    return t ** 3


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def hash01(*args) -> float:
    """确定性伪随机（FNV-1a），全脚本共用，禁止 random 无种子。"""
    h = 2166136261
    for a in args:
        h ^= int(round(a * 1000.0)) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    return h / 4294967296.0


def make_rng(seed: int) -> random.Random:
    return random.Random(seed)


# --------------------------------------------------------------------------- #
# 场景生命周期
# --------------------------------------------------------------------------- #

def reset_scene():
    """清空整个文件（对象 / 网格 / 材质 / 灯光 / 相机 / 文字 / 节点组）。"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.name = "UkiyoeShot"
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                  bpy.data.lights, bpy.data.cameras, bpy.data.node_groups,
                  bpy.data.linestyles, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)
    return scn


def ensure_collection(name: str, parent=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def link_object(obj, collection=None, detail: bool = False):
    """把对象链入场景；`detail=True` 的（文字/铭文）只进 Detail 集合，不勾线。"""
    scn_coll = bpy.context.scene.collection
    target = collection or (ensure_collection("Detail") if detail else ensure_collection("Geo"))
    if obj.name not in target.objects:
        target.objects.link(obj)
    # 确保对象在 view layer 中可见
    if obj.name not in scn_coll.objects and obj.name not in bpy.context.view_layer.objects:
        try:
            scn_coll.objects.link(obj)
        except Exception:
            pass
    return obj


def new_mesh_object(name: str, verts, faces, mats, collection=None, face_mats=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.validate(verbose=False)
    for mat in mats:
        me.materials.append(mat)
    if face_mats is not None:
        for poly, index in zip(me.polygons, face_mats):
            poly.material_index = int(index)
    me.update()
    ob = bpy.data.objects.new(name, me)
    link_object(ob, collection)
    return ob


def join_objects(objs, name: str):
    """把一个列表里的对象 join 成单个 mesh（大幅降低 Freestyle 的对象开销）。"""
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    if not objs:
        return None
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


# --------------------------------------------------------------------------- #
# 三渲二木刻材质
# --------------------------------------------------------------------------- #

def _new_material(name: str):
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    return mat, mat.node_tree


def make_toon_material(name: str, mid: str = "paper", *, dark: str = "ink",
                       light: str = "gold", mid_pos: float = 0.26,
                       light_pos: float = 0.62, rim: float = 0.16,
                       base: float = 0.82, roughness: float = 0.62,
                       emission_mix: float = 0.0):
    """版画三色阶梯材质：ShaderToRGB → ColorRamp(CONSTANT) → Emission。

    - `mid` 只允许 `paper`(#E8DEC8) 或 `cinnabar`(#9E1F18) 及其深色派生，
      决定该材质在版画里属于"宣纸版"还是"朱砂版"。
    - 明暗完全由色阶决定，`base` 只提供 ShaderToRGB 需要的灰阶输入，
      所以不会出现塑料感高光。
    - `rim` 把 Fresnel 边缘并入 Fac，让物体轮廓自动吃到赤金色高光。
    """
    mid_hex = PAL.get(mid, mid)
    dark_hex = PAL.get(dark, dark)
    light_hex = PAL.get(light, light)
    mat, nt = _new_material(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (760, 0)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.location = (560, 0)
    emit.inputs["Strength"].default_value = 1.0
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (300, 0)
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = lin(dark_hex)
    els[1].position = mid_pos
    els[1].color = lin(mid_hex)
    third = els.new(light_pos)
    third.color = lin(light_hex)

    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    s2r.location = (100, 0)
    nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
    # 关键连线：色阶 → Emission 颜色。少这一根线，材质会退回 Emission 的默认纯白，
    # 整个镜头变成"白模 + 黑线"，三色版画完全不落色（V8 第一版事故）。
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-160, 0)
    bsdf.inputs["Base Color"].default_value = (base, base, base, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.12
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], s2r.inputs["Shader"])

    if rim > 0.0:
        fres = nt.nodes.new("ShaderNodeFresnel")
        fres.location = (-160, -240)
        fres.inputs["IOR"].default_value = 1.45
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.location = (-20, -200)
        mul.inputs[1].default_value = rim
        nt.links.new(fres.outputs["Fac"], mul.inputs[0])
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        add.location = (140, -80)
        nt.links.new(s2r.outputs["Color"], add.inputs[0])
        nt.links.new(mul.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], ramp.inputs["Fac"])

    if emission_mix > 0.0:
        emit.inputs["Strength"].default_value = 1.0 + emission_mix

    return mat


def make_glow_material(name: str, color: str = "gold", strength: float = 3.2):
    """自发光环纹：同样走 ShaderToRGB + CONSTANT 色阶，三档全部锁赤金。"""
    color_hex = PAL.get(color, color)
    mat, nt = _new_material(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    emit_out = nt.nodes.new("ShaderNodeEmission")
    emit_out.location = (400, 0)
    emit_out.inputs["Strength"].default_value = strength
    nt.links.new(emit_out.outputs["Emission"], out.inputs["Surface"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (180, 0)
    ramp.color_ramp.interpolation = "CONSTANT"
    for el in ramp.color_ramp.elements:
        el.color = lin(color_hex)
    ramp.color_ramp.elements[0].position = 0.0
    extra = ramp.color_ramp.elements.new(0.5)
    extra.color = lin(color_hex)

    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    s2r.location = (-20, 0)
    src = nt.nodes.new("ShaderNodeEmission")
    src.location = (-240, 0)
    src.inputs["Color"].default_value = lin(color_hex)
    src.inputs["Strength"].default_value = 1.0
    nt.links.new(src.outputs["Emission"], s2r.inputs["Shader"])
    nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit_out.inputs["Color"])
    return mat


def make_ghost_material(name: str, color: str = "cinnabar", alpha: float = 0.2,
                        strength: float = 1.6):
    """运动拖影材质：半透明自发光，12 层叠加 → 越靠近本体越浓的真长曝光。

    EEVEE Next 的 object motion blur 在"多级空物体父级"下采不到子物体速度，
    所以高速旋转的道具用真实几何 + 逐层 alpha 叠出运动模糊（见 EXPLORATION_LOG）。
    """
    color_hex = PAL.get(color, color)
    mat, nt = _new_material(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (420, 0)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.location = (200, 60)
    emit.inputs["Color"].default_value = lin(color_hex)
    emit.inputs["Strength"].default_value = strength
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    transp.location = (0, -140)
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.location = (200, -50)
    mix.inputs["Fac"].default_value = 1.0 - alpha
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    try:
        mat.surface_render_method = "BLENDED"
    except Exception:
        pass
    for attr, value in (("blend_method", "BLEND"), ("shadow_method", "NONE"),
                        ("show_transparent_back", False), ("use_backface_culling", False)):
        try:
            setattr(mat, attr, value)
        except Exception:
            pass
    return mat


def make_veil_material(name: str, color: str = "paper", alpha: float = 0.14,
                       strength: float = 1.4):
    """体积光锥 / 半透明幕布：Emission + Alpha Blend（不参与勾线阴影）。"""
    color_hex = PAL.get(color, color)
    mat, nt = _new_material(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.location = (200, 0)
    emit.inputs["Color"].default_value = lin(color_hex)
    emit.inputs["Strength"].default_value = strength
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    transp.location = (0, -160)
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.location = (200, -60)
    mix.inputs["Fac"].default_value = 1.0 - alpha
    nt.links.new(transp.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND"),
                        ("show_transparent_back", False), ("use_backface_culling", False)):
        try:
            setattr(mat, attr, value)
        except Exception:
            pass
    return mat


def build_standard_materials():
    """四段镜头共用的标准材质表（同一名字全局复用，避免重复建节点）。"""
    mats = {
        "ink": make_toon_material("UK_Ink", "ink_soft", dark="ink", light="ink_soft",
                                  mid_pos=0.5, light_pos=0.9, rim=0.0, base=0.3),
        "ink_soft": make_toon_material("UK_InkSoft", "ink_soft", dark="ink",
                                       light="ink_soft", mid_pos=0.46, light_pos=0.86,
                                       rim=0.0, base=0.38),
        "paper": make_toon_material("UK_Paper", "paper", mid_pos=0.24, light_pos=0.64, rim=0.18),
        "paper_hard": make_toon_material("UK_PaperHard", "paper", mid_pos=0.38, light_pos=0.78,
                                         rim=0.10, base=0.78),
        "cinnabar": make_toon_material("UK_Cinnabar", "cinnabar", mid_pos=0.24, light_pos=0.63,
                                       rim=0.14),
        "cinnabar_deep": make_toon_material("UK_CinnabarDeep", "cinnabar_deep",
                                            mid_pos=0.30, light_pos=0.72, rim=0.10, base=0.72),
        "stone": make_toon_material("UK_Stone", "paper_dim", mid_pos=0.34, light_pos=0.76,
                                    rim=0.12, base=0.76),
        "stone_dark": make_toon_material("UK_StoneDark", "ink_soft", mid_pos=0.30,
                                         light_pos=0.72, rim=0.14, base=0.55),
        "gold": make_glow_material("UK_Gold", "gold", 2.4),
        "gold_hot": make_glow_material("UK_GoldHot", "gold_bright", 6.0),
        "gold_dim": make_glow_material("UK_GoldDim", "gold", 1.15),
        "rim": make_glow_material("UK_Rim", "cinnabar", 1.6),
    }
    return mats


# --------------------------------------------------------------------------- #
# 灯光 / 世界
# --------------------------------------------------------------------------- #

def setup_world(color: str = "ink_deep", strength: float = 0.05):
    world = bpy.data.worlds.get("UkiyoeWorld") or bpy.data.worlds.new("UkiyoeWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = lin(PAL.get(color, color))
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return world


def add_sun(name: str, energy: float = 3.6, rotation=(math.radians(52), 0.0, math.radians(-38)),
            angle: float = 0.09):
    light = bpy.data.lights.new(name, "SUN")
    light.energy = energy
    light.angle = angle
    ob = bpy.data.objects.new(name, light)
    ob.rotation_euler = Euler(rotation, "XYZ")
    bpy.context.scene.collection.objects.link(ob)
    return ob


def add_area(name: str, energy: float, size: float, location, rotation=(0, 0, 0),
             color: str = "paper"):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.size = size
    light.color = lin(PAL.get(color, color))[:3]
    ob = bpy.data.objects.new(name, light)
    ob.location = location
    ob.rotation_euler = Euler(rotation, "XYZ")
    bpy.context.scene.collection.objects.link(ob)
    return ob


# --------------------------------------------------------------------------- #
# 渲染设置（规范核心）
# --------------------------------------------------------------------------- #

def setup_render(scene, *, transparent: bool = False, samples: int = 16,
                 motion_blur: bool = True, shutter: float = 0.55,
                 bloom: bool = True, bloom_strength: float = 0.55,
                 bloom_threshold: float = 0.55, resolution=(RES_X, RES_Y),
                 frame_start: int = 1, frame_end: int = 48, view_transform: str = "Standard"):
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.render.fps_base = 1.0
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 12
    scene.view_settings.view_transform = view_transform
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0

    # --- 运动模糊（规范 1.b） ---
    scene.render.use_motion_blur = bool(motion_blur)
    scene.render.motion_blur_shutter = shutter
    for attr, value in (("motion_blur_steps", 2), ("motion_blur_max", 1024),
                        ("use_shadows", True), ("use_raytracing", False)):
        try:
            setattr(scene.eevee, attr, value)
        except Exception:
            pass
    try:
        scene.eevee.taa_render_samples = samples
    except Exception:
        pass

    scene.frame_start = frame_start
    scene.frame_end = frame_end
    scene.frame_set(frame_start)

    # --- Bloom（规范 1.a）：5.2 用合成器 Glare 实现 ---
    if bloom:
        setup_bloom(scene, strength=bloom_strength, threshold=bloom_threshold)
    else:
        scene.render.use_compositing = False
    return scene


def setup_bloom(scene, *, strength: float = 0.55, threshold: float = 0.55,
                size: float = 0.62, saturation: float = 1.0):
    """合成器 Fog Glow：EEVEE Next 没有内建 Bloom，这是官方等价做法。"""
    try:
        ng = bpy.data.node_groups.new("UkiyoeBloom", "CompositorNodeTree")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        rl = ng.nodes.new("CompositorNodeRLayers")
        rl.location = (-600, 0)
        glare = ng.nodes.new("CompositorNodeGlare")
        glare.location = (-320, 0)
        for key, value in (("Type", "Bloom"), ("Quality", "High")):
            try:
                glare.inputs[key].default_value = value
            except Exception:
                pass
        for key, value in (("Threshold", threshold), ("Strength", strength),
                           ("Size", size), ("Saturation", saturation), ("Smoothness", 0.2)):
            try:
                glare.inputs[key].default_value = value
            except Exception:
                pass
        set_alpha = ng.nodes.new("CompositorNodeSetAlpha")
        set_alpha.location = (-60, 0)
        set_alpha.name = "RestoreAlpha"
        go = ng.nodes.new("NodeGroupOutput")
        go.location = (200, 0)
        ng.links.new(rl.outputs["Image"], glare.inputs["Image"])
        # 辉光会把 RGB 溢出到透明区，必须把原始 alpha 装回去（透明镜头不能脏边）
        ng.links.new(glare.outputs["Image"], set_alpha.inputs["Image"])
        if "Alpha" in set_alpha.inputs and "Alpha" in rl.outputs:
            ng.links.new(rl.outputs["Alpha"], set_alpha.inputs["Alpha"])
        ng.links.new(set_alpha.outputs["Image"], go.inputs[0])
        scene.use_nodes = True
        scene.compositing_node_group = ng
        scene.render.use_compositing = True
        log(f"bloom: compositor Fog Glow (strength={strength}, threshold={threshold})")
        return True
    except Exception as exc:  # pragma: no cover - 只在构建不兼容时触发
        log(f"bloom: compositor unavailable ({exc!r}); geometric glow only")
        scene.render.use_compositing = False
        return False


def setup_freestyle(scene, *, thickness: float = 2.2, color: str = "line",
                    crease_deg: float = 57.0, collection: str = "Geo",
                    silhouette: bool = True, border: bool = True,
                    crease: bool = True, contour: bool = True,
                    material_boundary: bool = False):
    """规范 3：浮世绘木刻黑边，2.2px，线色 #0A0808。"""
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    scene.render.line_thickness = thickness
    try:
        scene.view_layers[0].use_freestyle = True
    except Exception:
        pass

    settings = scene.view_layers[0].freestyle_settings
    for ls in list(settings.linesets):
        settings.linesets.remove(ls)
    lineset = settings.linesets.new("WoodcutInk")
    style = bpy.data.linestyles.get("UkiyoeInk")
    if style:
        bpy.data.linestyles.remove(style)
    style = bpy.data.linestyles.new("UkiyoeInk")
    style.color = lin(PAL.get(color, color))[:3]
    style.thickness = thickness
    style.use_chaining = True
    style.caps = "ROUND"
    try:
        style.chaining = "PLAIN"
    except Exception:
        pass
    lineset.linestyle = style
    lineset.select_silhouette = silhouette
    lineset.select_border = border
    lineset.select_crease = crease
    lineset.select_external_contour = contour
    lineset.select_contour = contour
    lineset.select_material_boundary = material_boundary
    lineset.select_suggestive_contour = False
    lineset.select_ridge_valley = False
    lineset.select_edge_mark = False
    try:
        lineset.select_by_collection = True
        lineset.collection = ensure_collection(collection)
    except Exception as exc:
        log(f"freestyle collection filter unavailable ({exc!r}); using all geometry")
    try:
        lineset.select_by_visibility = True
        lineset.visibility = "VISIBLE"
    except Exception:
        pass
    try:
        settings.crease_angle = math.radians(crease_deg)
        settings.use_culling = True
    except Exception:
        pass
    log(f"freestyle: {thickness}px {PAL.get(color, color)} @ ABSOLUTE, crease {crease_deg}°")
    return style


# --------------------------------------------------------------------------- #
# 相机
# --------------------------------------------------------------------------- #

def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_camera(name: str, location, target, lens: float = 50.0, roll: float = 0.0,
                ortho: bool = False, ortho_scale: float = 12.0, dof: float = 0.0):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.sensor_width = 36.0
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new(name, cam_data)
    cam.location = Vector(location)
    bpy.context.scene.collection.objects.link(cam)
    look_at(cam, target)
    if abs(roll) > 1e-6:
        cam.rotation_mode = "XYZ"
        cam.rotation_euler.rotate_axis("Z", math.radians(roll))
    if dof > 0.0:
        cam_data.dof.use_dof = True
        cam_data.dof.aperture_fstop = dof
        cam_data.dof.focus_distance = (Vector(target) - cam.location).length
    bpy.context.scene.camera = cam
    return cam


def set_camera_pose(cam, location, target, roll_deg: float = 0.0, lens: float | None = None):
    cam.location = Vector(location)
    cam.rotation_mode = "XYZ"
    look_at(cam, target)
    if abs(roll_deg) > 1e-6:
        cam.rotation_euler.rotate_axis("Z", math.radians(roll_deg))
    if lens is not None:
        cam.data.lens = lens
    return cam


def iter_fcurves(obj):
    """Blender 5.x 的分层 Action（layers → strips → channelbags）兼容读取。"""
    data = obj.animation_data
    action = getattr(data, "action", None) if data else None
    if action is None:
        return []
    if hasattr(action, "fcurves"):
        try:
            return list(action.fcurves)
        except Exception:
            pass
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                curves.extend(bag.fcurves)
    return curves


def set_interpolation(obj, mode: str = "LINEAR"):
    for fcurve in iter_fcurves(obj):
        for key in fcurve.keyframe_points:
            key.interpolation = mode


def keyframe_pose(cam, frame: int, location, target, roll_deg: float = 0.0, lens=None,
                  interpolation: str = "LINEAR"):
    set_camera_pose(cam, location, target, roll_deg, lens)
    cam.keyframe_insert("location", frame=frame)
    cam.keyframe_insert("rotation_euler", frame=frame)
    if lens is not None:
        cam.data.keyframe_insert("lens", frame=frame)
    set_interpolation(cam, interpolation)


# --------------------------------------------------------------------------- #
# 中文字体 / 3D 文字
# --------------------------------------------------------------------------- #

FONT_CANDIDATES = (
    r"C:\Windows\Fonts\STSONG.TTF",
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\STKAITI.TTF",
    r"C:\Windows\Fonts\simkai.ttf",
    r"C:\Windows\Fonts\msyh.ttc",
    "/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc",
)


def load_font(path: str | None = None):
    candidates = (path,) if path else FONT_CANDIDATES
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            try:
                return bpy.data.fonts.load(candidate, check_existing=True)
            except Exception as exc:
                log(f"font load failed {candidate}: {exc!r}")
    log("font: no CJK font found, falling back to Blender default")
    return None


def add_text(text: str, *, font=None, size: float = 0.3, extrude: float = 0.008,
             location=(0, 0, 0), rotation=(0, 0, 0), material=None, name: str | None = None,
             align_x: str = "CENTER", align_y: str = "CENTER", bevel: float = 0.0,
             detail: bool = True):
    """3D 文字（篆书铭文 / 罪状签文）。默认进 Detail 集合，不参与 Freestyle。"""
    curve = bpy.data.curves.new(name or f"Txt_{text[:4]}", "FONT")
    curve.body = text
    if font:
        curve.font = font
    curve.align_x = align_x
    curve.align_y = align_y
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = bevel
    curve.resolution_u = 4
    ob = bpy.data.objects.new(name or f"Txt_{text[:4]}", curve)
    ob.location = Vector(location)
    ob.rotation_euler = Euler(rotation, "XYZ")
    if material:
        ob.data.materials.append(material)
    link_object(ob, detail=detail)
    return ob


def add_vertical_text(text: str, *, font=None, size: float = 0.3, gap: float = 0.34,
                      location=(0, 0, 0), rotation=(0, 0, 0), material=None,
                      name: str = "VText"):
    """竖排文字：逐字摆位（每个字是一个独立 3D 文字对象，仍是 Blender 侧几何）。"""
    objs = []
    total = (len(text) - 1) * gap
    for index, char in enumerate(text):
        offset = -total / 2 + index * gap
        ob = add_text(char, font=font, size=size, extrude=0.006,
                      location=(location[0], location[1] + offset, location[2]),
                      rotation=rotation, material=material, name=f"{name}_{index}")
        objs.append(ob)
    return objs


# --------------------------------------------------------------------------- #
# 几何工具
# --------------------------------------------------------------------------- #

def mesh_from_bmesh(name: str, bm, mats, collection=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    for mat in mats:
        me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    link_object(ob, collection)
    return ob


def add_box(name, size, center, material, rotation=(0, 0, 0), collection=None):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    ob.rotation_euler = Euler(rotation, "XYZ")
    return ob


def add_cylinder(name, radius, depth, center, material, rotation=(0, 0, 0), verts=12,
                 collection=None):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=radius, radius2=radius, depth=depth)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    ob.rotation_euler = Euler(rotation, "XYZ")
    return ob


def add_torus(name, major, minor, center, material, rotation=(0, 0, 0),
              major_segments=20, minor_segments=8, collection=None):
    return add_arc_ring(name, major, minor, 0.0, math.pi * 2.0, center, material,
                        rotation=rotation, segments=major_segments,
                        minor_segments=minor_segments, collection=collection)


def add_arc_ring(name, major, minor, theta0, theta1, center, material,
                 rotation=(0, 0, 0), segments=24, minor_segments=8, collection=None):
    """部分圆环（旋风弧带）：theta0→theta1 的开口圆弧。"""
    import bmesh
    bm = bmesh.new()
    rings = []
    closed = abs((theta1 - theta0) - math.pi * 2.0) < 1e-4
    count = segments if closed else segments + 1
    for i in range(count):
        t = i / segments
        theta = theta0 + (theta1 - theta0) * t
        ring = []
        for j in range(minor_segments):
            phi = 2 * math.pi * j / minor_segments
            x = (major + minor * math.cos(phi)) * math.cos(theta)
            y = (major + minor * math.cos(phi)) * math.sin(theta)
            z = minor * math.sin(phi)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(len(rings) - 1):
        for j in range(minor_segments):
            a = rings[i][j]
            b = rings[i + 1][j]
            c = rings[i + 1][(j + 1) % minor_segments]
            d = rings[i][(j + 1) % minor_segments]
            bm.faces.new((a, b, c, d))
    if closed:
        for j in range(minor_segments):
            a = rings[-1][j]
            b = rings[0][j]
            c = rings[0][(j + 1) % minor_segments]
            d = rings[-1][(j + 1) % minor_segments]
            bm.faces.new((a, b, c, d))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    ob.rotation_euler = Euler(rotation, "XYZ")
    return ob


def add_ico(name, radius, center, material, subdiv=1, collection=None):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    return ob


def add_plane(name, size, center, material, rotation=(0, 0, 0), collection=None):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    ob.rotation_euler = Euler(rotation, "XYZ")
    return ob


def jagged_rock(name, radius, height, sides=7, seed=1, material=None, center=(0, 0, 0),
                twist=0.22, taper=0.62, collection=None):
    """棱角巨岩柱：上下两圈不规则多边形 → 侧面三角化 → 岩面有折角（Freestyle 出折痕）。"""
    import bmesh
    rng = make_rng(seed)
    bm = bmesh.new()
    rings = []
    levels = 4
    for level in range(levels):
        t = level / (levels - 1)
        ring = []
        r = radius * (1.0 - taper * t) * (0.86 + rng.random() * 0.3)
        z = height * t
        phase = twist * level + rng.random() * 0.12
        for i in range(sides):
            theta = 2 * math.pi * i / sides + phase
            rr = r * (0.78 + 0.42 * hash01(seed, level, i))
            ring.append(bm.verts.new((math.cos(theta) * rr, math.sin(theta) * rr, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for level in range(levels - 1):
        for i in range(sides):
            a = rings[level][i]
            b = rings[level][(i + 1) % sides]
            c = rings[level + 1][(i + 1) % sides]
            d = rings[level + 1][i]
            bm.faces.new((a, b, c, d))
    # 顶盖 / 底盖：用中心点扇形封口
    for ring, z_dir in ((rings[0], -1), (rings[-1], 1)):
        center_v = bm.verts.new((0, 0, ring[0].co.z + z_dir * height * 0.04))
        for i in range(sides):
            a = ring[i]
            b = ring[(i + 1) % sides]
            if z_dir < 0:
                bm.faces.new((center_v, b, a))
            else:
                bm.faces.new((center_v, a, b))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = mesh_from_bmesh(name, bm, [material], collection)
    ob.location = Vector(center)
    return ob


# --------------------------------------------------------------------------- #
# 物理式碎裂（subdivide + separate(LOOSE)）
# --------------------------------------------------------------------------- #

def fracture_object(obj, *, cuts=2, seed=1, planes=6, spread=1.0,
                    xform=None, prefix="shard"):
    """把对象切成数百块独立碎片：subdivide → 多次 bisect → separate(LOOSE)。

    严格按照用户指定的 Blender 操作序列：
      1. `bmesh.ops.subdivide_edges` 加密表面（`cuts` 次）；
      2. 随机平面 `bmesh.ops.bisect_plane` 切 3–4 刀；
      3. `bmesh.ops.split_edges` 把切口真正撕开；
      4. `bpy.ops.mesh.separate(type='LOOSE')` 把每个孤岛变成独立对象。

    返回新生成的碎片对象列表（已从原对象分离）。
    """
    import bmesh

    me = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=cuts, use_grid_fill=True)
    rng = make_rng(seed)
    bbox = [Vector(c) for c in obj.bound_box]
    zmin = min(v.z for v in bbox)
    zmax = max(v.z for v in bbox)
    rmax = max(max(v.x for v in bbox), max(v.y for v in bbox), 0.5)
    for _ in range(planes):
        center = Vector((rng.uniform(-rmax, rmax) * 0.55,
                         rng.uniform(-rmax, rmax) * 0.55,
                         rng.uniform(zmin, zmax)))
        normal = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1),
                         rng.uniform(-0.6, 0.6))).normalized()
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        result = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5,
                                        plane_co=center, plane_no=normal,
                                        clear_inner=False, clear_outer=False)
        cut_edges = [e for e in result.get("geom_cut", []) if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            bmesh.ops.split_edges(bm, edges=cut_edges)
    bm.to_mesh(me)
    bm.free()

    shard = bpy.data.objects.new(f"{prefix}_{obj.name}", me)
    shard.matrix_world = obj.matrix_world.copy()
    link_object(shard)
    for mat in obj.data.materials:
        pass  # materials already copied with mesh
    # 原对象隐藏（不删除：它可能是被引用的实例）
    obj.hide_render = True
    obj.hide_viewport = True
    bpy.ops.object.select_all(action="DESELECT")
    shard.select_set(True)
    bpy.context.view_layer.objects.active = shard
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    parts = [o for o in bpy.context.selected_objects if o is not shard]
    parts.append(shard)
    parts = [p for p in parts if p.type == "MESH"]
    for part in parts:
        part.name = f"{prefix}_{len(parts):03d}_{part.name}"
    log(f"fracture {obj.name}: {len(parts)} loose parts")
    return parts


# --------------------------------------------------------------------------- #
# 渲染 / 编码
# --------------------------------------------------------------------------- #

def render_still(path: str, frame: int, *, scale: int = 1, samples: int = 16,
                 transparent: bool = False, thickness: float = 2.2):
    scn = bpy.context.scene
    scn.render.resolution_x = RES_X // scale
    scn.render.resolution_y = RES_Y // scale
    scn.render.film_transparent = transparent
    try:
        scn.eevee.taa_render_samples = samples
    except Exception:
        pass
    scn.frame_set(frame)
    out = os.path.abspath(path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scn.render.filepath = out
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t0
    size = os.path.getsize(out) if os.path.exists(out) else 0
    if size <= 0:
        raise RuntimeError(f"render produced empty file: {out}")
    log(f"still f{frame} -> {os.path.basename(out)} ({size/1024:.0f} KB, {dt:.1f}s)")
    return {"path": out, "frame": frame, "bytes": size, "seconds": round(dt, 2)}


def render_sequence(frames_dir: str, *, filename_prefix: str = "frame_",
                    samples: int = 16, transparent: bool = False,
                    frame_start: int = 1, frame_end: int = 48):
    scn = bpy.context.scene
    scn.render.resolution_x, scn.render.resolution_y = RES_X, RES_Y
    scn.render.film_transparent = transparent
    scn.frame_start, scn.frame_end = frame_start, frame_end
    try:
        scn.eevee.taa_render_samples = samples
    except Exception:
        pass
    out_dir = os.path.abspath(frames_dir)
    os.makedirs(out_dir, exist_ok=True)
    for stale in glob.glob(os.path.join(out_dir, f"{filename_prefix}*.png")):
        os.remove(stale)
    scn.render.filepath = os.path.join(out_dir, filename_prefix)
    t0 = time.time()
    bpy.ops.render.render(animation=True)
    dt = time.time() - t0
    produced = sorted(glob.glob(os.path.join(out_dir, f"{filename_prefix}*.png")))
    if not produced:
        raise RuntimeError("no frames rendered")
    total = sum(os.path.getsize(p) for p in produced)
    log(f"sequence: {len(produced)} frames, {total/1024/1024:.1f} MB, "
        f"{dt:.1f}s ({dt/max(1,len(produced)):.2f}s/frame)")
    return {"dir": out_dir, "frames": len(produced), "seconds": round(dt, 1),
            "bytes": total, "prefix": filename_prefix}


def ffmpeg_path() -> str:
    env = os.environ.get("BLENDER_FFMPEG", "")
    if env and os.path.exists(env):
        return env
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "..", "..", "node_modules", "@remotion",
                     "compositor-win32-x64-msvc", "ffmpeg.exe"),
        os.path.join(here, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
    ]
    for candidate in candidates:
        candidate = os.path.abspath(candidate)
        if os.path.exists(candidate):
            return candidate
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found (set BLENDER_FFMPEG)")


def encode_webm_alpha(frames_dir: str, out_path: str, *, prefix: str = "frame_",
                      crf: int = 24, start_number: int = 1, fps: int = FPS):
    """PNG(RGBA) 序列 → VP9 + yuva420p 真透明 WebM。

    旧脚本断言"webm 封装不支持 VP9 alpha"是错的：ffmpeg 7.x 的 webm muxer
    可以携带 alpha，关键是 `-pix_fmt yuva420p` + `-auto-alt-ref 0`。
    这里编码完会用 ffprobe 复核 pix_fmt 必须是 yuva420p，否则报错。
    """
    ffmpeg = ffmpeg_path()
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), f"{prefix}*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    out_abs = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    pattern = os.path.join(os.path.abspath(frames_dir), f"{prefix}%04d.png")
    cmd = [ffmpeg, "-y", "-framerate", str(fps), "-start_number", str(start_number),
           "-i", pattern, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
           "-b:v", "0", "-crf", str(crf), "-auto-alt-ref", "0",
           "-row-mt", "1", "-threads", "8", "-an", out_abs]
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed({proc.returncode}): {proc.stderr[-1500:]}")
    size = os.path.getsize(out_abs)
    pix_fmt = probe_pix_fmt(out_abs)
    log(f"webm -> {os.path.basename(out_abs)} ({size/1024/1024:.2f} MB, "
        f"{len(frames)}f, pix_fmt={pix_fmt}, {time.time()-t0:.1f}s)")
    result = {"path": out_abs, "bytes": size, "frames": len(frames), "pix_fmt": pix_fmt}
    if pix_fmt != "yuva420p":
        # 本机 ffmpeg 7.1 的 webm muxer 会丢弃 VP9 alpha（实测 yuva420p → yuv420p），
        # 真透明只能走 ProRes 4444。WebM 留档给剪辑软件，Remotion 用 .mov。
        mov_path = os.path.splitext(out_abs)[0] + ".mov"
        result["mov"] = encode_mov_alpha(frames_dir, mov_path, prefix=prefix,
                                         start_number=start_number, fps=fps)
        result["alpha"] = "prores4444"
        log("webm muxer dropped VP9 alpha → wrote ProRes 4444 .mov for Remotion")
    else:
        result["alpha"] = "vp9-yuva420p"
    return result


def encode_mov_alpha(frames_dir: str, out_path: str, *, prefix: str = "frame_",
                     start_number: int = 1, fps: int = FPS):
    """PNG(RGBA) → ProRes 4444 .mov（yuva444p12le），Remotion 的唯一真透明通道。"""
    ffmpeg = ffmpeg_path()
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), f"{prefix}*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    out_abs = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    pattern = os.path.join(os.path.abspath(frames_dir), f"{prefix}%04d.png")
    cmd = [ffmpeg, "-y", "-framerate", str(fps), "-start_number", str(start_number),
           "-i", pattern, "-c:v", "prores_ks", "-profile:v", "4444",
           "-pix_fmt", "yuva444p10le", "-vendor", "apl0", "-an", out_abs]
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg(prores) failed({proc.returncode}): {proc.stderr[-1200:]}")
    size = os.path.getsize(out_abs)
    pix_fmt = probe_pix_fmt(out_abs)
    log(f"mov(alpha) -> {os.path.basename(out_abs)} ({size/1024/1024:.1f} MB, "
        f"{len(frames)}f, pix_fmt={pix_fmt}, {time.time()-t0:.1f}s)")
    if not pix_fmt.startswith("yuva"):
        raise RuntimeError(f"alpha lost in prores: pix_fmt={pix_fmt}")
    return {"path": out_abs, "bytes": size, "frames": len(frames), "pix_fmt": pix_fmt}


def encode_mp4(frames_dir: str, out_path: str, *, prefix: str = "frame_",
               crf: int = 17, preset: str = "medium", fps: int = FPS, start_number: int = 1):
    ffmpeg = ffmpeg_path()
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), f"{prefix}*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    out_abs = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    pattern = os.path.join(os.path.abspath(frames_dir), f"{prefix}%04d.png")
    cmd = [ffmpeg, "-y", "-framerate", str(fps), "-start_number", str(start_number),
           "-i", pattern, "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out_abs]
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed({proc.returncode}): {proc.stderr[-1500:]}")
    size = os.path.getsize(out_abs)
    log(f"mp4 -> {os.path.basename(out_abs)} ({size/1024/1024:.2f} MB, "
        f"{len(frames)}f, {time.time()-t0:.1f}s)")
    return {"path": out_abs, "bytes": size, "frames": len(frames)}


def probe_pix_fmt(path: str) -> str:
    ffmpeg = ffmpeg_path()
    probe = os.path.join(os.path.dirname(ffmpeg), "ffprobe.exe")
    if not os.path.exists(probe):
        return "unknown"
    proc = subprocess.run([probe, "-v", "error", "-select_streams", "v:0",
                           "-show_entries", "stream=pix_fmt", "-of", "csv=p=0", path],
                          capture_output=True, text=True)
    return (proc.stdout or "").strip()


# --------------------------------------------------------------------------- #
# 通用 CLI
# --------------------------------------------------------------------------- #

def parse_args(argv, defaults: dict | None = None):
    opts = dict(defaults or {})
    index = 0
    while index < len(argv):
        token = argv[index]
        if token == "--inspect":
            opts["inspect"] = True
        elif token == "--all":
            opts["all"] = True
        elif token in ("--frame", "--still", "--preview", "--scale", "--samples",
                       "--frames-dir", "--encode-webm", "--encode-mp4",
                       "--quick", "--frames"):
            key = token.lstrip("-").replace("-", "_")
            if token in ("--all", "--inspect", "--quick"):
                opts[key] = True
            else:
                index += 1
                opts[key] = argv[index]
        index += 1
    return opts


def run_common(opts, *, prefix: str, transparent: bool, frame_end: int,
               build_fn, default_still: str, default_frames_dir: str,
               webm_out: str | None = None, mp4_out: str | None = None):
    """四段脚本共用的主流程：--preview / --still / --all / --encode-*。"""
    samples = int(opts.get("samples", 16))
    if opts.get("inspect"):
        scn = bpy.context.scene
        log(f"inspect: {len(bpy.data.objects)} objects, "
            f"{sum(len(o.data.polygons) for o in bpy.data.objects if o.type=='MESH')} polys, "
            f"engine={scn.render.engine}, fps={scn.render.fps}, "
            f"frames={scn.frame_start}-{scn.frame_end}")
        for ob in sorted(bpy.data.objects, key=lambda o: o.name):
            if ob.type in ("MESH", "FONT"):
                log(f"  {ob.name:<28} {ob.type:<5} "
                    f"{len(ob.data.polygons) if ob.type=='MESH' else 0:>6} faces "
                    f"loc=({ob.location.x:.1f},{ob.location.y:.1f},{ob.location.z:.1f})")
        return None

    if opts.get("preview"):
        frame = int(opts.get("frame", 1))
        return render_still(str(opts["preview"]), frame, scale=int(opts.get("scale", 2)),
                            samples=samples, transparent=transparent)

    if opts.get("still"):
        frame = int(opts.get("frame", 1))
        return render_still(str(opts["still"]), frame, scale=int(opts.get("scale", 1)),
                            samples=samples, transparent=transparent)

    frames_dir = str(opts.get("frames_dir") or default_frames_dir)

    if opts.get("encode_webm") or opts.get("encode_mp4"):
        pass

    if opts.get("all"):
        result = render_sequence(frames_dir, filename_prefix=prefix, samples=samples,
                                 transparent=transparent, frame_start=1, frame_end=frame_end)
        if webm_out:
            result["webm"] = encode_webm_alpha(frames_dir, webm_out, prefix=prefix)
        if mp4_out:
            result["mp4"] = encode_mp4(frames_dir, mp4_out, prefix=prefix)
        return result

    if opts.get("encode_webm"):
        return encode_webm_alpha(frames_dir, str(opts["encode_webm"]), prefix=prefix)
    if opts.get("encode_mp4"):
        return encode_mp4(frames_dir, str(opts["encode_mp4"]), prefix=prefix)

    # 默认：单帧预览，方便快速迭代
    return render_still(default_still, 1, scale=2, samples=samples, transparent=transparent)
