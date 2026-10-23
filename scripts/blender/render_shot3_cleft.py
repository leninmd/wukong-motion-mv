"""Shot 3 五指山下·深渊岩体与紧绷铁索 —— 峡谷岩壁 + 刚体铁链 + 落石（Blender 5.2.3 / EEVEE / Freestyle）

用法（无头 CLI，参数放在 `--` 之后）：
  preview : blender -b -P scripts/blender/render_shot3_cleft.py -- --frame 30 --preview out/blender_qa/shot3_f30.png
  qa      : ... -- --qa-frames 4,15,30,50,70 --scale 2 --samples 12
  full    : ... -- --all --frames-dir out/blender_frames/shot3 \
                     --webm public/blender_renders/shot3_mountain_chains.webm \
                     --alpha-mov out/shot3_mountain_chains_alpha.mov
  inspect : ... -- --inspect      # 只建场+烘焙+打印铁链物理统计

沿用 Shot 2 已验证的结论（见 docs/AGENT_TOOLING.md §15）：
- 本构建只有 BLENDER_EEVEE；墨线用 Freestyle（Line Art 在本构建烘不出描边）。
- 动态刚体上不留位移关键帧；锚点用 kinematic 匀速/急停关键帧把冲量灌进链条。
- 相邻刚体之间用 POINT 约束 + disable_collisions，凸包用 CONVEX_HULL，碰撞保证金关掉。
"""

import bpy
import bmesh
import math
import os
import sys
import time
import json
import random
import numpy as np
from mathutils import Vector, Quaternion, Euler

# --------------------------------------------------------------------------- #
# 常量
# --------------------------------------------------------------------------- #
FPS = 30
FRAME_START = 1
FRAME_END = 75
RES_X, RES_Y = 1920, 1080

TENSION_FRAME = 14          # 山体下压、铁链骤然收紧的重音帧
SHAKE_END = 26              # 崖壁震颤结束

CANYON_HALF = 14.0          # 峡谷半宽（内壁 x=±14，相机留 ≥7 m 净空）
WALL_Y = 60.0
WALL_Z_TOP = 50.0
WALL_Z_BOT = -70.0
WALL_SEG_Y = 110
WALL_SEG_Z = 70

CHAIN_LINK_R = 0.50
CHAIN_LINK_r = 0.125
CHAIN_STRETCH = 1.55
CHAIN_SPACING = 0.80
CHAIN_LINKS = 22

DEBRIS_COUNT = 60
DUST_COUNT = 34
SPARK_COUNT = 48

PAL = {
    "ink":          "#120D14",
    "ink_soft":     "#1D1620",
    "ink_lift":     "#2A2130",
    "paper":        "#EAE0CE",
    "paper_bright": "#F4EFE6",
    "cinnabar":     "#C8281E",
    "gold":         "#F5C242",
    "gold_bright":  "#FCC934",
    "stone":        "#C9BBA2",
    "stone_dark":   "#8E8172",
}

LIGHT_DIR = Vector((-0.78, 0.30, 0.55)).normalized()   # 峡谷侧光：从左侧崖壁打过来


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #
def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin(hex_color, alpha=1.0):
    r, g, b = hex_to_rgb(hex_color)
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def hash01(*args):
    h = 2166136261
    for a in args:
        h ^= int(a * 1000.0) & 0xFFFFFFFF
        h = (h * 16777619) & 0xFFFFFFFF
    return h / 4294967296.0


def log(msg):
    print(f"[shot3] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# 三渲二材质（N·L 三段色阶 + 双层边缘光 + 宣纸颗粒），无灯纯 Emission
# --------------------------------------------------------------------------- #
def make_toon_material(name, base_hex, shade=0.62, deep=0.40, grain=0.06,
                       highlight=1.0, rim_hex=None, rim_amt=0.0,
                       rim2_hex=None, rim2_amt=0.0, rim2_blend=0.16):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (1000, 0)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.location = (820, 0)
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    base = nt.nodes.new("ShaderNodeRGB")
    base.location = (-900, 200)
    base.outputs[0].default_value = lin(base_hex)

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    geo.location = (-900, -100)
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.location = (-700, -100)
    dot.inputs[1].default_value = LIGHT_DIR
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])

    gt_lo = nt.nodes.new("ShaderNodeMath")
    gt_lo.operation = "GREATER_THAN"
    gt_lo.location = (-500, -80)
    gt_lo.inputs[1].default_value = 0.08
    nt.links.new(dot.outputs["Value"], gt_lo.inputs[0])

    gt_hi = nt.nodes.new("ShaderNodeMath")
    gt_hi.operation = "GREATER_THAN"
    gt_hi.location = (-500, -260)
    gt_hi.inputs[1].default_value = 0.46
    nt.links.new(dot.outputs["Value"], gt_hi.inputs[0])

    def tone(fac, y):
        n = nt.nodes.new("ShaderNodeMixRGB")
        n.blend_type = "MULTIPLY"
        n.location = (-520, y)
        n.inputs["Fac"].default_value = 1.0
        nt.links.new(base.outputs[0], n.inputs["Color1"])
        n.inputs["Color2"].default_value = (fac, fac, fac, 1.0)
        return n

    t_deep, t_mid, t_lit = tone(deep, 320), tone(shade, 190), tone(highlight, 60)

    m_mid = nt.nodes.new("ShaderNodeMixRGB")
    m_mid.blend_type = "MIX"
    m_mid.location = (-250, 210)
    nt.links.new(gt_lo.outputs[0], m_mid.inputs["Fac"])
    nt.links.new(t_deep.outputs[0], m_mid.inputs["Color1"])
    nt.links.new(t_mid.outputs[0], m_mid.inputs["Color2"])

    m_lit = nt.nodes.new("ShaderNodeMixRGB")
    m_lit.blend_type = "MIX"
    m_lit.location = (-250, 30)
    nt.links.new(gt_hi.outputs[0], m_lit.inputs["Fac"])
    nt.links.new(m_mid.outputs[0], m_lit.inputs["Color1"])
    nt.links.new(t_lit.outputs[0], m_lit.inputs["Color2"])

    # 宣纸颗粒
    tex_co = nt.nodes.new("ShaderNodeTexCoord")
    tex_co.location = (-900, 500)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-700, 500)
    noise.inputs["Scale"].default_value = 84.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(tex_co.outputs["Object"], noise.inputs["Vector"])
    grain_map = nt.nodes.new("ShaderNodeMapRange")
    grain_map.location = (-500, 500)
    grain_map.inputs["To Min"].default_value = 1.0 - grain
    grain_map.inputs["To Max"].default_value = 1.0 + grain
    nt.links.new(noise.outputs["Fac"], grain_map.inputs["Value"])

    mul1 = nt.nodes.new("ShaderNodeMixRGB")
    mul1.blend_type = "MULTIPLY"
    mul1.location = (100, -40)
    mul1.inputs["Fac"].default_value = 1.0
    nt.links.new(m_lit.outputs[0], mul1.inputs["Color1"])
    nt.links.new(grain_map.outputs[0], mul1.inputs["Color2"])

    cur = mul1

    def add_rim(prev, rim_color, amount, blend, power, sign, y):
        """边缘光：Facing 收窄到真轮廓，再按 N·L 的幂次门控——只让受光侧（sign=+1）
        或背光侧（sign=-1）出金边，避免整片石面被打成灰白。"""
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.location = (-420, y)
        lw.inputs["Blend"].default_value = blend
        face = nt.nodes.new("ShaderNodeMath")
        face.operation = "MULTIPLY"
        face.location = (-240, y)
        face.inputs[1].default_value = amount
        nt.links.new(lw.outputs["Facing"], face.inputs[0])

        g = dot.outputs["Value"]
        if sign < 0:
            neg = nt.nodes.new("ShaderNodeMath")
            neg.operation = "MULTIPLY"
            neg.location = (-640, y - 120)
            neg.inputs[1].default_value = -1.0
            nt.links.new(g, neg.inputs[0])
            g = neg.outputs[0]
        clamp = nt.nodes.new("ShaderNodeMath")
        clamp.operation = "MAXIMUM"
        clamp.location = (-470, y - 120)
        clamp.inputs[1].default_value = 0.0
        nt.links.new(g, clamp.inputs[0])
        gate = clamp.outputs[0]
        for _ in range(max(1, power) - 1):
            n = nt.nodes.new("ShaderNodeMath")
            n.operation = "MULTIPLY"
            n.location = (-300, y - 120)
            nt.links.new(gate, n.inputs[0])
            nt.links.new(gate, n.inputs[1])
            gate = n.outputs[0]
        fac = nt.nodes.new("ShaderNodeMath")
        fac.operation = "MULTIPLY"
        fac.location = (-80, y)
        nt.links.new(face.outputs[0], fac.inputs[0])
        nt.links.new(gate, fac.inputs[1])

        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.location = (180, y)
        nt.links.new(fac.outputs[0], mix.inputs["Fac"])
        nt.links.new(prev.outputs[0], mix.inputs["Color1"])
        mix.inputs["Color2"].default_value = lin(rim_color)
        return mix

    if rim_hex and rim_amt > 0:
        cur = add_rim(cur, rim_hex, rim_amt, 0.07, 2, +1, -300)
    if rim2_hex and rim2_amt > 0:
        cur = add_rim(cur, rim2_hex, rim2_amt, 0.07, 2, -1, -560)

    nt.links.new(cur.outputs[0], emit.inputs["Color"])
    emit.inputs["Strength"].default_value = 1.0
    mat.diffuse_color = lin(base_hex)
    return mat


def build_materials():
    m = {}
    # 崖壁：玄黑为底，侧光侧留宣纸米白 + 鎏金双层金边
    m["cliff"] = make_toon_material("M3_Cliff", PAL["ink"], shade=2.60, deep=1.70, grain=0.09,
                                    highlight=2.55, rim_hex=PAL["paper_bright"], rim_amt=1.0,
                                    rim2_hex=PAL["ink_lift"], rim2_amt=0.55)
    m["cliff_far"] = make_toon_material("M3_CliffFar", PAL["ink"], shade=0.85, deep=0.7, grain=0.08,
                                        highlight=1.3, rim_hex=PAL["paper"], rim_amt=0.45)
    m["chain"] = make_toon_material("M3_Chain", PAL["ink_soft"], shade=1.9, deep=1.2, grain=0.05,
                                    highlight=3.6, rim_hex=PAL["gold"], rim_amt=1.0,
                                    rim2_hex=PAL["paper_bright"], rim2_amt=0.30)
    m["anchor"] = make_toon_material("M3_Anchor", PAL["ink_soft"], shade=0.95, deep=0.6,
                                     highlight=1.7, rim_hex=PAL["paper"], rim_amt=0.5)
    m["rock"] = make_toon_material("M3_Rock", PAL["stone"], shade=0.78, deep=0.5, grain=0.10,
                                   highlight=1.1, rim_hex=PAL["paper_bright"], rim_amt=0.35)
    m["rock_dark"] = make_toon_material("M3_RockDark", PAL["stone_dark"], shade=0.76, deep=0.5, grain=0.10)
    m["dust"] = make_toon_material("M3_Dust", PAL["stone"], shade=0.80, deep=0.55, grain=0.2,
                                   highlight=0.9)
    m["dust_ink"] = make_toon_material("M3_DustInk", PAL["ink_lift"], shade=0.95, deep=0.7, grain=0.12)
    m["spark"] = make_toon_material("M3_Spark", PAL["gold_bright"], shade=1.0, deep=1.0,
                                    highlight=1.35, rim_hex=PAL["paper_bright"], rim_amt=0.5)
    return m


# --------------------------------------------------------------------------- #
# 崖壁：网格细分 + Voronoi 置换噪波
# --------------------------------------------------------------------------- #
def build_cliff(side, mats, verbose=True):
    """side=-1 左壁（法线朝 +X），side=+1 右壁（法线朝 -X）。"""
    bm = bmesh.new()
    ny, nz = WALL_SEG_Y, WALL_SEG_Z
    grid = []
    for j in range(nz + 1):
        z = WALL_Z_BOT + (WALL_Z_TOP - WALL_Z_BOT) * (j / nz)
        row = []
        for i in range(ny + 1):
            y = -WALL_Y + 2 * WALL_Y * (i / ny)
            row.append(bm.verts.new((0.0, y, z)))
        grid.append(row)
    for j in range(nz):
        for i in range(ny):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            f.material_index = 0
    bm.normal_update()
    mesh = bpy.data.meshes.new(f"cliff_{'L' if side < 0 else 'R'}")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(mats["cliff"])
    for poly in mesh.polygons:
        poly.use_smooth = False

    # --- 置换用的拉伸空物体：让 Voronoi 胞体在竖直方向被拉长 = 崖壁皴法 ---
    tex_empty = bpy.data.objects.new(f"cliff_texco_{side}", None)
    bpy.context.scene.collection.objects.link(tex_empty)
    tex_empty.scale = (1.0, 0.62, 0.26)

    tex_vor = bpy.data.textures.new(f"CliffVoronoi_{side}", type="VORONOI")
    tex_vor.noise_scale = 0.85
    try:
        tex_vor.distance_metric = "DISTANCE_SQUARED"
        tex_vor.color_mode = "INTENSITY"
        tex_vor.weight_1 = 1.0
    except Exception:
        pass

    tex_clouds = bpy.data.textures.new(f"CliffClouds_{side}", type="CLOUDS")
    tex_clouds.noise_scale = 4.5
    tex_clouds.noise_depth = 3

    d_vor = obj.modifiers.new("displace_voronoi", "DISPLACE")
    d_vor.texture = tex_vor
    d_vor.texture_coords = "OBJECT"
    d_vor.texture_coords_object = tex_empty
    d_vor.strength = 2.0
    d_vor.mid_level = 0.42
    d_vor.direction = "X"
    d_vor.space = "LOCAL"

    d_clouds = obj.modifiers.new("displace_clouds", "DISPLACE")
    d_clouds.texture = tex_clouds
    d_clouds.texture_coords = "OBJECT"
    d_clouds.texture_coords_object = tex_empty
    d_clouds.strength = 3.8
    d_clouds.mid_level = 0.5
    d_clouds.direction = "X"

    # 应用置换（用 depsgraph 求值后落成真实网格，方便 Freestyle 与后续统计）
    dg = bpy.context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(dg)
    new_mesh = bpy.data.meshes.new_from_object(eval_obj)
    obj.modifiers.clear()
    old = obj.data
    obj.data = new_mesh
    bpy.data.meshes.remove(old)
    new_mesh.materials.clear()
    new_mesh.materials.append(mats["cliff"])
    for poly in new_mesh.polygons:
        poly.use_smooth = False

    # --- 平移到峡谷两侧，再叠纵向沟壑（皴法）：只依赖 y 的位移 = 竖直石纹 ---
    base_x = CANYON_HALF * side
    inward = -side                      # 指向峡谷中心的单位方向
    bm2 = bmesh.new()
    bm2.from_mesh(new_mesh)
    for v in bm2.verts:
        y, z = v.co.y, v.co.z
        ridge = (0.95 * math.sin(0.52 * y + 1.3)
                 + 0.42 * math.sin(1.63 * y + 0.4)
                 + 0.22 * math.sin(3.7 * y + 2.1))
        depth_k = 1.0 + 0.55 * max(0.0, (CANYON_HALF * 2.0 - z) / 60.0)
        # 水平岩层台阶：相机下坠时提供强烈的纵向视差
        strata = (1.75 * math.sin(z * 0.26 + 0.7)
                  + 0.85 * math.sin(z * 0.63 + 2.4)
                  + 0.45 * math.sin(z * 1.31 + 0.2))
        # 侵入量（朝峡谷中心为正）：置换 + 竖直石纹 + 水平层理
        disp = (v.co.x + ridge * depth_k * 0.9 + strata) * 0.85
        disp = max(-3.0, min(7.0, disp))
        # 谷底收束成 V 形：越往下两壁越靠近，俯冲时形成深邃的裂缝
        conv = 0.45 + 0.55 * ((z - WALL_Z_BOT) / (WALL_Z_TOP - WALL_Z_BOT))
        v.co.x = side * (CANYON_HALF - disp) * conv
    bm2.to_mesh(new_mesh)
    bm2.free()

    obj.location = (0.0, 0.0, 0.0)
    for poly in new_mesh.polygons:
        poly.use_smooth = False
    if verbose:
        log(f"cliff {side}: {len(new_mesh.polygons)} faces")
    return obj


# --------------------------------------------------------------------------- #
# 铁链（环环相扣的实体椭圆链环 + 刚体 + 球铰约束）
# --------------------------------------------------------------------------- #
CHAIN_LAYOUT = [
    # (y, z, sag) —— 沿镜头坠落路径分层排布，坠落时逐道穿过
    (-6.5, 18.5, 1.55),
    (-2.0, 11.0, 1.90),
    (2.5, 4.0, 1.70),
    (-4.5, -3.0, 2.05),
    (0.5, -10.0, 1.60),
    (3.5, -17.5, 1.35),
]


def build_chain_spurs(idx, y_c, z_c, mats):
    """把铁链两端锚进从崖壁探出的岩角，避免链条悬在空中。"""
    span = CHAIN_SPACING * (CHAIN_LINKS - 1)
    spurs = []
    for side in (-1, 1):
        inner = side * (span / 2 + 0.75)
        outer = side * (CANYON_HALF - 0.5)
        cx = (inner + outer) * 0.5
        half = abs(outer - inner) * 0.5 + 0.9
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0,
                                              location=(cx, y_c, z_c))
        o = bpy.context.object
        o.name = f"ch3_{idx}_spur_{'L' if side < 0 else 'R'}"
        for v in o.data.vertices:
            k = 0.72 + 0.5 * hash01(idx, side, v.index)
            v.co *= k
        o.data.materials.append(mats["cliff"])
        for poly in o.data.polygons:
            poly.use_smooth = False
        o.scale = (half, 2.4, 2.2)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        spurs.append(o)
    return spurs


def build_chain(idx, y_c, z_c, sag, mats, verbose=True):
    spurs = build_chain_spurs(idx, y_c, z_c, mats)
    span = CHAIN_SPACING * (CHAIN_LINKS - 1)
    links = []
    for i in range(CHAIN_LINKS):
        x = -span / 2 + i * CHAIN_SPACING
        t = x / (span / 2)
        z = z_c - sag * (1.0 - t * t)
        bpy.ops.mesh.primitive_torus_add(major_radius=CHAIN_LINK_R, minor_radius=CHAIN_LINK_r,
                                         major_segments=12, minor_segments=6,
                                         location=(x, y_c, z))
        o = bpy.context.object
        o.name = f"ch3_{idx}_link_{i:02d}"
        o.scale = (CHAIN_STRETCH, 1.0, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        # 相邻链环互扣：绕链轴（X）交替旋转 90°
        o.rotation_euler = (math.radians(90.0) if i % 2 else 0.0, 0.0, 0.0)
        o.data.materials.append(mats["chain"])
        for poly in o.data.polygons:
            poly.use_smooth = False
        bpy.ops.rigidbody.object_add()
        rb = o.rigid_body
        rb.type = "ACTIVE"
        rb.collision_shape = "CONVEX_HULL"
        rb.mass = 11.0
        rb.friction = 0.62
        rb.restitution = 0.08
        rb.linear_damping = 0.02
        rb.angular_damping = 0.06
        rb.use_margin = False
        rb.collision_margin = 0.0
        rb.use_deactivation = False
        links.append(o)

    # 两端锚固块（kinematic）：1–14 帧被山体压得外扩下坠，把链条骤然绷紧
    anchors = []
    for side in (-1, 1):
        x0 = side * (span / 2 + 0.52)
        bpy.ops.mesh.primitive_cube_add(size=0.62, location=(x0, y_c, z_c))
        a = bpy.context.object
        a.name = f"ch3_{idx}_anchor_{'L' if side < 0 else 'R'}"
        a.scale = (1.35, 1.0, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        a.data.materials.append(mats["anchor"])
        for poly in a.data.polygons:
            poly.use_smooth = False
        bpy.ops.rigidbody.object_add()
        a.rigid_body.type = "ACTIVE"
        a.rigid_body.kinematic = True
        a.rigid_body.collision_shape = "BOX"
        # 静止 → 缓慢拉伸 → 14 帧骤紧
        for f, dx, dz in ((1, 0.0, 0.0), (9, side * 0.18, -0.10),
                          (TENSION_FRAME, side * 0.62, -0.42)):
            a.location = (x0 + dx, y_c, z_c + dz)
            a.keyframe_insert("location", frame=f)
        # 骤紧后的小幅震颤
        rnd = random.Random(9000 + idx * 17)
        for f in range(TENSION_FRAME + 1, TENSION_FRAME + 7):
            a.location = (x0 + side * 0.62 + rnd.uniform(-0.035, 0.035),
                          y_c + rnd.uniform(-0.05, 0.05),
                          z_c - 0.42 + rnd.uniform(-0.04, 0.04))
            a.keyframe_insert("location", frame=f)
        a.location = (x0 + side * 0.62, y_c, z_c - 0.42)
        a.keyframe_insert("location", frame=TENSION_FRAME + 8)
        # 骤紧之后不立刻死静：锚点做衰减摆动，把“晃荡”续到落幅
        for f in range(TENSION_FRAME + 10, FRAME_END + 1, 2):
            tt = (f - TENSION_FRAME) / FPS
            decay = math.exp(-tt * 0.42)
            a.location = (x0 + side * 0.62 + side * 0.055 * decay * math.sin(tt * 11.0 + idx),
                          y_c + 0.085 * decay * math.sin(tt * 8.3 + idx * 1.7),
                          z_c - 0.42 + 0.065 * decay * math.sin(tt * 13.1 + idx * 0.6))
            a.keyframe_insert("location", frame=f)
        anchors.append(a)

    def point_constraint(name, a, b, loc):
        bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
        con = bpy.context.object
        con.name = name
        bpy.ops.rigidbody.constraint_add(type="POINT")
        rbc = con.rigid_body_constraint
        rbc.object1 = a
        rbc.object2 = b
        rbc.disable_collisions = True
        return con

    pairs = [(anchors[0], links[0])] + [(links[i], links[i + 1]) for i in range(CHAIN_LINKS - 1)] \
            + [(links[-1], anchors[1])]
    for k, (a, b) in enumerate(pairs):
        point_constraint(f"ch3_{idx}_con_{k:02d}", a, b, a.location)

    if verbose:
        log(f"chain {idx}: {len(links)} links, span {span:.2f}, sag {sag}")
    return {"links": links, "anchors": anchors}


# --------------------------------------------------------------------------- #
# 落石 / 粉尘 / 火星（确定性解析运动，逐帧关键帧）
# --------------------------------------------------------------------------- #
def build_debris(mats, verbose=True):
    rng = random.Random(31337)
    rocks, dusts = [], []

    for i in range(DEBRIS_COUNT):
        subdiv = 1 if i % 3 else 2
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=1.0, location=(0, 0, 0))
        o = bpy.context.object
        o.name = f"ch3_rock_{i:02d}"
        for v in o.data.vertices:
            k = 0.62 + 0.55 * hash01(i, v.index)
            v.co *= k
            v.co.x *= 1.0 + 0.5 * (hash01(i, v.index, 3) - 0.5)
        o.data.materials.append(mats["rock_dark"] if i % 3 else mats["rock"])
        for poly in o.data.polygons:
            poly.use_smooth = False

        size = rng.uniform(0.16, 0.55)
        o.scale = (size, size * rng.uniform(0.7, 1.3), size * rng.uniform(0.6, 1.2))
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        xside = 1.0 if rng.random() > 0.5 else -1.0
        x = xside * rng.uniform(2.6, 8.0)
        y = rng.uniform(-13.0, 1.0)
        z = rng.uniform(14.0, 42.0)
        vx = rng.uniform(-1.4, 1.4)
        vy = rng.uniform(-1.2, 1.2)
        vz = rng.uniform(-2.0, -0.5)
        spin = Vector((rng.uniform(-3.0, 3.0), rng.uniform(-3.0, 3.0), rng.uniform(-2.0, 2.0)))
        start_f = int(rng.uniform(1, 34))
        o.rotation_mode = "XYZ"
        base_rot = Vector((rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3)))

        for f in range(FRAME_START, FRAME_END + 1):
            t = max(0.0, (f - start_f) / FPS)
            o.location = (x + vx * t, y + vy * t, z + vz * t - 0.5 * 9.81 * t * t)
            o.rotation_euler = Euler((base_rot.x + spin.x * t,
                                      base_rot.y + spin.y * t,
                                      base_rot.z + spin.z * t), "XYZ")
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
        # 出生前隐藏
        o.scale = (0, 0, 0)
        o.keyframe_insert("scale", frame=max(FRAME_START, start_f - 1))
        o.scale = (1, 1, 1)
        o.keyframe_insert("scale", frame=start_f)
        rocks.append(o)

    for i in range(DUST_COUNT):
        bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0, 0, 0))
        o = bpy.context.object
        o.name = f"ch3_dust_{i:02d}"
        o.data.materials.append(mats["dust"])
        w = rng.uniform(0.12, 0.34)
        h = w * rng.uniform(0.45, 1.0)
        o.scale = (w, h, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        x = rng.uniform(-11.0, 11.0)
        y = rng.uniform(-18.0, 14.0)
        z = rng.uniform(12.0, 44.0)
        vx = rng.uniform(-0.8, 0.8)
        vy = rng.uniform(-0.6, 0.6)
        vz = rng.uniform(-4.5, -1.5)
        start_f = int(rng.uniform(1, 40))
        base_rot = Vector((math.radians(90), 0, rng.uniform(0, 6.3)))
        spin_z = rng.uniform(-1.6, 1.6)
        for f in range(FRAME_START, FRAME_END + 1):
            t = max(0.0, (f - start_f) / FPS)
            o.location = (x + vx * t, y + vy * t, z + vz * t - 0.5 * 3.0 * t * t)
            o.rotation_euler = Euler((base_rot.x, base_rot.y + spin_z * t, base_rot.z), "XYZ")
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
        o.scale = (0, 0, 0)
        o.keyframe_insert("scale", frame=max(FRAME_START, start_f - 1))
        o.scale = (1, 1, 1)
        o.keyframe_insert("scale", frame=start_f)
        dusts.append(o)

    if verbose:
        log(f"debris: {len(rocks)} rocks, {len(dusts)} dust planes")
    return {"rocks": rocks, "dust": dusts}


def build_sparks(mats, chains, verbose=True):
    rng = random.Random(424242)
    sparks = []
    per = max(1, SPARK_COUNT // (len(chains) * 2))
    for ci, ch in enumerate(chains):
        for side_i, anchor in enumerate(ch["anchors"]):
            base = anchor.location.copy()
            for s in range(per):
                bpy.ops.mesh.primitive_plane_add(size=1.0, location=base)
                o = bpy.context.object
                o.name = f"ch3_spark_{ci}_{side_i}_{s}"
                o.data.materials.append(mats["spark"])
                sz = rng.uniform(0.05, 0.12)
                o.scale = (sz, sz, 1.0)
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
                o.rotation_euler = (math.radians(90), 0, rng.uniform(0, 6.3))

                dirv = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.05, 1.0))).normalized()
                spd = rng.uniform(1.8, 6.5)
                start_f = TENSION_FRAME + int(rng.uniform(0, 5))
                for f in range(start_f - 1, min(FRAME_END, start_f + 22) + 1):
                    t = max(0.0, (f - start_f) / FPS)
                    o.location = base + dirv * (spd * t) + Vector((0, 0, -0.5 * 9.81 * t * t))
                    o.keyframe_insert("location", frame=f)
                o.scale = (0, 0, 0)
                o.keyframe_insert("scale", frame=start_f - 1)
                o.scale = (1, 1, 1)
                o.keyframe_insert("scale", frame=start_f)
                o.scale = (0, 0, 0)
                o.keyframe_insert("scale", frame=min(FRAME_END, start_f + 21))
                sparks.append(o)
    if verbose:
        log(f"sparks: {len(sparks)}")
    return sparks


# --------------------------------------------------------------------------- #
# 场景装配
# --------------------------------------------------------------------------- #
def build_scene(mats, verbose=True):
    scn = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)

    walls = [build_cliff(-1, mats, verbose), build_cliff(1, mats, verbose)]

    chains = []
    for idx, (y_c, z_c, sag) in enumerate(CHAIN_LAYOUT):
        chains.append(build_chain(idx, y_c, z_c, sag, mats, verbose))

    debris = build_debris(mats, verbose)
    sparks = build_sparks(mats, chains, verbose)

    if verbose:
        log(f"objects={len(bpy.data.objects)}")
    return {"walls": walls, "chains": chains, "debris": debris, "sparks": sparks}


def setup_physics(scene_objs=None, verbose=True):
    """必须先于 build_scene 调用：刚体世界存在时，rigidbody.object_add 才会把对象
    注册进 rbw.collection；先建对象再建世界，对象不会进入模拟集合（实测 bake 0.0s）。
    幂等：世界已存在时只覆盖参数，不重建（重建会清空已注册的对象）。"""
    scn = bpy.context.scene
    if scn.rigidbody_world is None:
        try:
            bpy.ops.rigidbody.world_remove()
        except Exception:
            pass
        bpy.ops.rigidbody.world_add()
    rbw = scn.rigidbody_world
    rbw.substeps_per_frame = 25
    rbw.solver_iterations = 40
    rbw.use_split_impulse = True
    if verbose and scene_objs:
        log(f"physics: {sum(len(c['links']) for c in scene_objs['chains'])} links")
    return rbw


def bake_physics(frame_end=FRAME_END, verbose=True):
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = FRAME_START, frame_end
    t0 = time.time()
    scn.frame_set(FRAME_START)
    bpy.ops.ptcache.free_bake_all()
    bpy.ops.ptcache.bake_all(bake=True)
    dt = time.time() - t0
    if verbose:
        log(f"physics baked in {dt:.1f}s")
    return dt


def animate_walls(scene_objs, verbose=True):
    """崖壁震颤：14 帧重音后整体抖动，制造山体下压的挤压感。"""
    rnd = random.Random(70707)
    for k, wall in enumerate(scene_objs["walls"]):
        base = wall.location.copy()
        for f in range(FRAME_START, FRAME_END + 1):
            if f < TENSION_FRAME - 1:
                amp = 0.0
            elif f < TENSION_FRAME + 2:
                amp = 0.16
            elif f < SHAKE_END:
                amp = 0.16 * (1.0 - (f - TENSION_FRAME - 2) / (SHAKE_END - TENSION_FRAME - 2))
            else:
                amp = 0.0
            if amp > 0:
                wall.location = (base.x + rnd.uniform(-amp, amp) * 0.35,
                                 base.y + rnd.uniform(-amp, amp),
                                 base.z + rnd.uniform(-amp, amp) * 0.8)
            else:
                wall.location = base
            wall.keyframe_insert("location", frame=f)
    if verbose:
        log("wall tremor keyed")


def setup_camera(scene_objs):
    scn = bpy.context.scene
    old = bpy.data.objects.get("shot3_cam")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    cam_data = bpy.data.cameras.new("shot3_cam")
    cam = bpy.data.objects.new("shot3_cam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    cam_data.sensor_width = 36.0
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.1
    cam_data.clip_end = 400.0

    def fov_to_lens(fov_deg):
        return cam_data.sensor_width / (2.0 * math.tan(math.radians(fov_deg) * 0.5))

    def ease_in(t):
        return t ** 1.35          # 越落越快 = 压下来的感觉

    for f in range(FRAME_START, FRAME_END + 1):
        t = (f - FRAME_START) / (FRAME_END - FRAME_START)
        k = ease_in(t)
        # 垂直坠落：z 22 → -26，同时极缓慢前移与侧移
        cam.location = Vector((1.1 - 1.9 * k, -14.0 + 14.5 * k, 26.0 - 48.0 * k))
        yaw = math.radians(10.0) - math.radians(18.0) * k
        pitch = math.radians(9.0) + math.radians(31.0) * k      # 越落越俯
        direction = Vector((math.sin(yaw) * math.cos(pitch),
                            math.cos(yaw) * math.cos(pitch),
                            -math.sin(pitch)))
        q = direction.to_track_quat("-Z", "Y")
        roll = Quaternion((0.0, 0.0, 1.0), math.radians(3.5) * math.sin(k * math.pi))
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q @ roll
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cam_data.lens = fov_to_lens(60.0 + 12.0 * k)
        cam_data.keyframe_insert("lens", frame=f)

    cam_data.lens = fov_to_lens(60.0)
    scn.frame_set(FRAME_START)
    return cam


# --------------------------------------------------------------------------- #
# 线稿 / 渲染
# --------------------------------------------------------------------------- #
def setup_freestyle(scn, thickness=2.2):
    scn.render.use_freestyle = True
    try:
        bpy.context.view_layer.use_freestyle = True
    except Exception:
        pass
    try:
        scn.render.line_thickness_mode = "ABSOLUTE"
        scn.render.line_thickness = thickness
    except Exception:
        pass
    fs = bpy.context.view_layer.freestyle_settings
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    fls = fs.linesets.new("Ink")
    style = bpy.data.linestyles.get("Shot3Ink") or bpy.data.linestyles.new("Shot3Ink")
    style.color = lin(PAL["ink"])[:3]
    style.thickness = thickness
    style.use_chaining = True
    fls.linestyle = style
    fls.select_silhouette = True
    fls.select_border = True
    fls.select_crease = True
    fls.select_external_contour = True
    fls.select_contour = True
    try:
        fls.select_by_visibility = True
        fls.visibility = "VISIBLE"
    except Exception:
        pass
    try:
        fs.crease_angle = math.radians(58.0)
    except Exception:
        pass
    try:
        fs.use_culling = True
    except Exception:
        pass
    return fls


def setup_render(scn, scale=1, samples=16, transparent=True):
    scn.render.engine = "BLENDER_EEVEE"
    scn.render.resolution_x = max(64, RES_X // scale)
    scn.render.resolution_y = max(36, RES_Y // scale)
    scn.render.resolution_percentage = 100
    scn.render.fps = FPS
    scn.render.fps_base = 1.0
    scn.render.film_transparent = transparent
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"
    scn.render.image_settings.color_depth = "8"
    scn.render.image_settings.compression = 15
    scn.view_settings.view_transform = "Standard"
    scn.view_settings.look = "None"
    scn.view_settings.exposure = 0.0
    scn.view_settings.gamma = 1.0
    try:
        scn.eevee.taa_render_samples = samples
        scn.eevee.use_shadows = False
        scn.eevee.use_raytracing = False
    except Exception:
        pass
    scn.frame_start, scn.frame_end = FRAME_START, FRAME_END


def render_still(path, frame, scale=1, samples=16, thickness=2.2, verbose=True):
    scn = bpy.context.scene
    setup_render(scn, scale=scale, samples=samples)
    setup_freestyle(scn, thickness=thickness)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    scn.frame_set(frame)
    scn.render.filepath = os.path.abspath(path)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t0
    size = os.path.getsize(path) if os.path.exists(path) else 0
    if size <= 0:
        raise RuntimeError(f"render produced empty file: {path}")
    if verbose:
        log(f"still f{frame} -> {os.path.basename(path)} ({size/1024:.0f} KB, {dt:.1f}s)")
    return {"path": os.path.abspath(path), "frame": frame, "bytes": size, "seconds": round(dt, 2)}


def render_sequence(frames_dir, scale=1, samples=16, thickness=2.2, verbose=True):
    scn = bpy.context.scene
    setup_render(scn, scale=scale, samples=samples)
    setup_freestyle(scn, thickness=thickness)
    os.makedirs(frames_dir, exist_ok=True)
    scn.render.filepath = os.path.join(os.path.abspath(frames_dir), "shot3_")
    t0 = time.time()
    bpy.ops.render.render(animation=True)
    dt = time.time() - t0
    produced = sorted(p for p in os.listdir(frames_dir) if p.endswith(".png"))
    total = sum(os.path.getsize(os.path.join(frames_dir, p)) for p in produced)
    if verbose:
        log(f"sequence: {len(produced)} frames, {total/1024/1024:.1f} MB, "
            f"{dt:.1f}s ({dt/max(1,len(produced)):.1f}s/frame)")
    return {"frames": len(produced), "dir": os.path.abspath(frames_dir),
            "bytes": total, "seconds": round(dt, 1)}


def _ffmpeg_path():
    import glob
    ffmpeg = os.environ.get("SHOT3_FFMPEG", "")
    if not ffmpeg:
        cand = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                            "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe")
        ffmpeg = os.path.abspath(cand)
    if not os.path.exists(ffmpeg):
        raise RuntimeError(f"ffmpeg not found: {ffmpeg}")
    return ffmpeg, glob


def encode_webm(frames_dir, webm_path):
    """PNG 序列 → VP9 WebM（本机 ffmpeg 的 matroska 封装不带 VP9 alpha，需真透明请用 ProRes）。"""
    import subprocess
    ffmpeg, glob = _ffmpeg_path()
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), "shot3_*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    os.makedirs(os.path.dirname(os.path.abspath(webm_path)), exist_ok=True)
    pattern = os.path.join(os.path.abspath(frames_dir), "shot3_%04d.png")
    t0 = time.time()
    cmd = [ffmpeg, "-y", "-framerate", str(FPS), "-start_number", "1", "-i", pattern,
           "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "27",
           "-auto-alt-ref", "0", "-row-mt", "1", "-threads", "8", webm_path]
    log("encode: " + " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed({proc.returncode}): {proc.stderr[-1200:]}")
    size = os.path.getsize(webm_path) if os.path.exists(webm_path) else 0
    if size <= 0:
        raise RuntimeError(f"webm empty: {webm_path}")
    rep = {"webm": os.path.abspath(webm_path), "bytes": size, "frames": len(frames),
           "seconds": round(time.time() - t0, 1),
           "alpha": "unavailable (ffmpeg webm muxer cannot carry VP9 alpha)"}
    log(f"webm -> {webm_path} ({size/1024/1024:.2f} MB)")
    return rep


def encode_prores_alpha(frames_dir, mov_path):
    import subprocess
    ffmpeg, glob = _ffmpeg_path()
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), "shot3_*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    os.makedirs(os.path.dirname(os.path.abspath(mov_path)), exist_ok=True)
    pattern = os.path.join(os.path.abspath(frames_dir), "shot3_%04d.png")
    t0 = time.time()
    cmd = [ffmpeg, "-y", "-framerate", str(FPS), "-start_number", "1", "-i", pattern,
           "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
           "-vendor", "apl0", mov_path]
    log("encode(alpha): " + " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"prores failed({proc.returncode}): {proc.stderr[-1200:]}")
    size = os.path.getsize(mov_path) if os.path.exists(mov_path) else 0
    if size <= 0:
        raise RuntimeError(f"mov empty: {mov_path}")
    rep = {"mov": os.path.abspath(mov_path), "bytes": size, "frames": len(frames),
           "seconds": round(time.time() - t0, 1), "pix_fmt": "yuva444p10le"}
    log(f"prores4444 -> {mov_path} ({size/1024/1024:.1f} MB, alpha kept)")
    return rep


# --------------------------------------------------------------------------- #
# 统计 / 主流程
# --------------------------------------------------------------------------- #
def inspect_physics(objs, frames=(1, 9, TENSION_FRAME, TENSION_FRAME + 2, 30, 52, FRAME_END)):
    scn = bpy.context.scene
    stats = {"objects": len(bpy.data.objects),
             "links": sum(len(c["links"]) for c in objs["chains"])}
    prev, prev_f = None, None
    for f in frames:
        scn.frame_set(f)
        row = {}
        for ci, ch in enumerate(objs["chains"]):
            ps = [l.matrix_world.translation.copy() for l in ch["links"]]
            sag = min(p.z for p in ps)
            row[f"c{ci}"] = {
                "zmin": round(sag, 2),
                "xspan": [round(min(p.x for p in ps), 2), round(max(p.x for p in ps), 2)],
            }
        if prev:
            gap = max(1, f - prev_f)
            vmax = 0.0
            for ci, ch in enumerate(objs["chains"]):
                for i, l in enumerate(ch["links"]):
                    d = (l.matrix_world.translation - prev[ci][i]).length * FPS / gap
                    vmax = max(vmax, d)
            row["vmax"] = round(vmax, 2)
        stats[f"f{f}"] = row
        prev = [[l.matrix_world.translation.copy() for l in ch["links"]] for ch in objs["chains"]]
        prev_f = f
    return stats


def build_all(verbose=True):
    t0 = time.time()
    for mat in list(bpy.data.materials):
        if mat.name.startswith(("M3_", "Shot3")):
            bpy.data.materials.remove(mat)
    for tex in list(bpy.data.textures):
        if tex.name.startswith("Cliff"):
            bpy.data.textures.remove(tex)
    for ls in list(bpy.data.linestyles):
        if ls.name.startswith("Shot3"):
            bpy.data.linestyles.remove(ls)
    mats = build_materials()
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = FRAME_START, FRAME_END
    setup_physics(verbose=False)          # 先建刚体世界，保证后续 object_add 注册进集合
    objs = build_scene(mats, verbose=verbose)
    setup_physics(objs, verbose=True)     # 再确认一次参数（不重建世界也能覆盖）
    bake_physics(verbose=verbose)
    animate_walls(objs, verbose=verbose)
    cam = setup_camera(objs)
    setup_render(scn, scale=1, samples=16)
    if verbose:
        log(f"scene built in {time.time()-t0:.1f}s")
    return {"mats": mats, "objs": objs, "cam": cam}


def parse_args(argv):
    import argparse
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(prog="render_shot3_cleft")
    p.add_argument("--frame", type=int, default=30)
    p.add_argument("--preview", type=str, default=None)
    p.add_argument("--still", type=str, default=None)
    p.add_argument("--scale", type=int, default=1)
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--thickness", type=float, default=2.2)
    p.add_argument("--frames-dir", type=str, default=os.path.join("out", "blender_frames", "shot3"))
    p.add_argument("--webm", type=str, default=None)
    p.add_argument("--alpha-mov", type=str, default=None)
    p.add_argument("--all", action="store_true")
    p.add_argument("--qa-frames", type=str, default=None)
    p.add_argument("--qa-dir", type=str, default=os.path.join("out", "blender_qa"))
    p.add_argument("--inspect", action="store_true")
    p.add_argument("--blend", type=str, default=None)
    return p.parse_args(argv)


def main():
    args = parse_args(sys.argv)
    t_start = time.time()
    report = {"args": {k: v for k, v in vars(args).items()}, "steps": []}

    built = build_all(verbose=True)
    objs = built["objs"]

    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))

    if args.inspect:
        log("INSPECT " + json.dumps(inspect_physics(objs)))
        return 0

    if args.qa_frames:
        for fr in [int(x) for x in args.qa_frames.split(",") if x.strip()]:
            path = os.path.join(args.qa_dir, f"shot3_f{fr:03d}.png")
            report["steps"].append(render_still(path, fr, scale=args.scale,
                                                samples=args.samples, thickness=args.thickness))
    elif args.preview or args.still:
        report["steps"].append(render_still(args.preview or args.still, args.frame,
                                            scale=args.scale, samples=args.samples,
                                            thickness=args.thickness))
    elif args.all:
        report["steps"].append(render_sequence(args.frames_dir, scale=args.scale,
                                               samples=args.samples, thickness=args.thickness))
        if args.webm:
            report["steps"].append(encode_webm(args.frames_dir, args.webm))
        if args.alpha_mov:
            report["steps"].append(encode_prores_alpha(args.frames_dir, args.alpha_mov))

    report["total_seconds"] = round(time.time() - t_start, 1)
    print("REPORT:" + json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    _code = main()
    sys.stdout.flush()
    sys.stderr.flush()
    if bpy.app.background:
        os._exit(int(_code or 0))
    sys.exit(_code)










