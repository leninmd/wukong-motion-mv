"""Shot 2B 凌霄宝殿·无坚不摧 —— 殿柱真实刚体爆碎（Blender 5.2.3 / EEVEE / Freestyle）

用法（无头 CLI，参数放在 `--` 之后）：
  preview : blender -b -P scripts/blender/render_shot2_collapse.py -- --frame 24 --preview out/blender_qa/shot2_f24.png
  still   : ... -- --frame 14 --still out/blender_qa/shot2_f14.png --scale 2
  full    : ... -- --all --frames-dir out/blender_frames/shot2 --webm public/blender_renders/shot2_palace_destruction.webm
  inspect : ... -- --inspect

本机实测结论（详见 docs/EXPLORATION_LOG.md）：
1. 该构建只注册 BLENDER_EEVEE（无 Cycles / Workbench）；Grease Pencil Line Art 在本构建里
   bake 出 0 条描边（is_baked=True 但 layers[0].frames 为空），故墨线改用内置 Freestyle
   （工程宪法 §5 允许 Line Art 或 Freestyle），ABSOLUTE 2.2px，颜色锁玄黑 #120D14。
2. 刚体核心机制：对 kinematic 体的位移做**匀速关键帧**，在带速度的那一帧切 dynamic，
   Bullet 会继承该速度（实测 4.4 m/s 保持并正常受重力）。但动态体上绝不能再留位移关键帧，
   否则每帧“瞬移”会被当作巨大初速。
3. 因此爆碎 = 14→17 帧的定向冲量（kinematic 匀速外移） + 17 帧后纯 Bullet 模拟
   （重力、碎块互撞、地面被动刚体反弹）。碎片凸包必须留 ~3% 间隙，否则密集堆叠会持续抖动。
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
from mathutils import Vector, Quaternion, Euler, Matrix

# --------------------------------------------------------------------------- #
# 常量
# --------------------------------------------------------------------------- #
FPS = 30
FRAME_START = 1
FRAME_END = 52
HIT_FRAME = 14                    # 第 14 帧 = 全片第 112 帧重音「摧」
BURST_RELEASE = 17                # 冲量结束、交回真刚体的帧
RES_X, RES_Y = 1920, 1080

GRID = 6
SPACING = 3.9
SHAFT_R = 0.95
BASE_TOP = 0.92
SHAFT_TOP = 9.60
SIDES = 8

HERO_CELLS = [(2, 0), (3, 0), (3, 1)]   # 核心受击区：前排，不遮挡
SHARDS_PER_HERO = 72
SEED = 20261023

PAL = {
    "ink":           "#120D14",
    "ink_soft":      "#1D1620",
    "paper":         "#EAE0CE",
    "paper_bright":  "#F4EFE6",
    "cinnabar":      "#C8281E",
    "cinnabar_dark": "#8E1A13",
    "gold":          "#F5C242",
    "gold_bright":   "#FCC934",
    "stone":         "#C9BBA2",
    "stone_dark":    "#8E8172",
}

LIGHT_DIR = Vector((-0.72, -0.42, 0.55)).normalized()


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
    print(f"[shot2] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# 材质：三渲二（N·L 三段色阶 + 宣纸颗粒），无灯纯 Emission，锁定四主色
# --------------------------------------------------------------------------- #
def _make_toon_material(name, base_hex, shade=0.66, deep=0.44, grain=0.06,
                        highlight=1.0, rim_hex=None, rim_amt=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.location = (700, 0)
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
    gt_lo.inputs[1].default_value = 0.10
    nt.links.new(dot.outputs["Value"], gt_lo.inputs[0])

    gt_hi = nt.nodes.new("ShaderNodeMath")
    gt_hi.operation = "GREATER_THAN"
    gt_hi.location = (-500, -260)
    gt_hi.inputs[1].default_value = 0.55
    nt.links.new(dot.outputs["Value"], gt_hi.inputs[0])

    def _tone(fac, y):
        n = nt.nodes.new("ShaderNodeMixRGB")
        n.blend_type = "MULTIPLY"
        n.location = (-500, y)
        n.inputs["Fac"].default_value = 1.0
        nt.links.new(base.outputs[0], n.inputs["Color1"])
        n.inputs["Color2"].default_value = (fac, fac, fac, 1.0)
        return n

    t_deep, t_mid, t_lit = _tone(deep, 300), _tone(shade, 180), _tone(highlight, 60)

    m_mid = nt.nodes.new("ShaderNodeMixRGB")
    m_mid.blend_type = "MIX"
    m_mid.location = (-250, 200)
    nt.links.new(gt_lo.outputs[0], m_mid.inputs["Fac"])
    nt.links.new(t_deep.outputs[0], m_mid.inputs["Color1"])
    nt.links.new(t_mid.outputs[0], m_mid.inputs["Color2"])

    m_lit = nt.nodes.new("ShaderNodeMixRGB")
    m_lit.blend_type = "MIX"
    m_lit.location = (-250, 20)
    nt.links.new(gt_hi.outputs[0], m_lit.inputs["Fac"])
    nt.links.new(m_mid.outputs[0], m_lit.inputs["Color1"])
    nt.links.new(t_lit.outputs[0], m_lit.inputs["Color2"])

    tex_co = nt.nodes.new("ShaderNodeTexCoord")
    tex_co.location = (-900, 480)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-700, 480)
    noise.inputs["Scale"].default_value = 96.0
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex_co.outputs["Object"], noise.inputs["Vector"])

    grain_mix = nt.nodes.new("ShaderNodeMapRange")
    grain_mix.location = (-500, 480)
    grain_mix.inputs["From Min"].default_value = 0.0
    grain_mix.inputs["From Max"].default_value = 1.0
    grain_mix.inputs["To Min"].default_value = 1.0 - grain
    grain_mix.inputs["To Max"].default_value = 1.0 + grain
    nt.links.new(noise.outputs["Fac"], grain_mix.inputs["Value"])

    objinfo = nt.nodes.new("ShaderNodeObjectInfo")
    objinfo.location = (-700, 700)
    tint = nt.nodes.new("ShaderNodeMapRange")
    tint.location = (-500, 700)
    tint.inputs["To Min"].default_value = 0.93
    tint.inputs["To Max"].default_value = 1.05
    nt.links.new(objinfo.outputs["Random"], tint.inputs["Value"])

    mul1 = nt.nodes.new("ShaderNodeMixRGB")
    mul1.blend_type = "MULTIPLY"
    mul1.location = (100, -40)
    mul1.inputs["Fac"].default_value = 1.0
    nt.links.new(m_lit.outputs[0], mul1.inputs["Color1"])
    nt.links.new(grain_mix.outputs[0], mul1.inputs["Color2"])

    mul2 = nt.nodes.new("ShaderNodeMixRGB")
    mul2.blend_type = "MULTIPLY"
    mul2.location = (300, -40)
    mul2.inputs["Fac"].default_value = 1.0
    nt.links.new(mul1.outputs[0], mul2.inputs["Color1"])
    nt.links.new(tint.outputs[0], mul2.inputs["Color2"])

    final = mul2
    if rim_hex and rim_amt > 0:
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.location = (-300, -520)
        lw.inputs["Blend"].default_value = 0.32
        rimb = nt.nodes.new("ShaderNodeMath")
        rimb.operation = "MULTIPLY"
        rimb.location = (-100, -520)
        rimb.inputs[1].default_value = rim_amt
        nt.links.new(lw.outputs["Facing"], rimb.inputs[0])
        rim_mix = nt.nodes.new("ShaderNodeMixRGB")
        rim_mix.location = (500, -60)
        nt.links.new(rimb.outputs[0], rim_mix.inputs["Fac"])
        nt.links.new(mul2.outputs[0], rim_mix.inputs["Color1"])
        rim_mix.inputs["Color2"].default_value = lin(rim_hex)
        final = rim_mix

    nt.links.new(final.outputs[0], emit.inputs["Color"])
    emit.inputs["Strength"].default_value = 1.0
    mat.diffuse_color = lin(base_hex)
    return mat


def build_materials():
    m = {}
    m["shaft_red"] = _make_toon_material("M_ShaftCinnabar", PAL["cinnabar"], shade=0.72, deep=0.48)
    m["shaft_white"] = _make_toon_material("M_ShaftPaper", PAL["paper"], shade=0.82, deep=0.62)
    m["gold"] = _make_toon_material("M_GoldCloud", PAL["gold"], shade=0.76, deep=0.52,
                                    highlight=1.06, rim_hex=PAL["gold_bright"], rim_amt=0.35)
    m["gold_dk"] = _make_toon_material("M_GoldDeep", "#C79A2E", shade=0.74, deep=0.50)
    m["base"] = _make_toon_material("M_LotusBase", PAL["paper"], shade=0.78, deep=0.54)
    m["rock"] = _make_toon_material("M_FractureRock", PAL["stone"], shade=0.80, deep=0.58, grain=0.10)
    m["rock_alt"] = _make_toon_material("M_FractureRockAlt", "#B8AB93", shade=0.78, deep=0.56, grain=0.10)
    m["ink"] = _make_toon_material("M_InkGround", PAL["ink"], shade=0.95, deep=0.80, grain=0.05)
    m["ink_soft"] = _make_toon_material("M_InkGroundSoft", PAL["ink_soft"], shade=0.92, deep=0.78, grain=0.05)
    return m


# --------------------------------------------------------------------------- #
# 几何
# --------------------------------------------------------------------------- #
def add_octa_prism(bm, radius, z0, z1, mat_index=0, sides=SIDES, phase=math.pi / 8,
                   cap_bottom=True, cap_top=True, offset=(0.0, 0.0, 0.0)):
    ox, oy, oz = offset
    ring0 = [bm.verts.new((ox + radius * math.cos(phase + k * 2 * math.pi / sides),
                           oy + radius * math.sin(phase + k * 2 * math.pi / sides), oz + z0))
             for k in range(sides)]
    ring1 = [bm.verts.new((ox + radius * math.cos(phase + k * 2 * math.pi / sides),
                           oy + radius * math.sin(phase + k * 2 * math.pi / sides), oz + z1))
             for k in range(sides)]
    faces = []
    for k in range(sides):
        faces.append(bm.faces.new((ring0[k], ring0[(k + 1) % sides], ring1[(k + 1) % sides], ring1[k])))
    if cap_bottom:
        faces.append(bm.faces.new(list(reversed(ring0))))
    if cap_top:
        faces.append(bm.faces.new(ring1))
    for f in faces:
        f.material_index = mat_index
    return faces


def add_box(bm, size_xyz, center, mat_index=0, rot_z=0.0):
    sx, sy, sz = size_xyz
    cx, cy, cz = center
    verts = []
    for dz in (-0.5, 0.5):
        for dx, dy in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)):
            x, y = dx * sx, dy * sy
            if rot_z:
                c, s = math.cos(rot_z), math.sin(rot_z)
                x, y = x * c - y * s, x * s + y * c
            verts.append(bm.verts.new((cx + x, cy + y, cz + dz * sz)))
    b, t = verts[:4], verts[4:]
    faces = [bm.faces.new(list(reversed(b))), bm.faces.new(t)]
    for k in range(4):
        faces.append(bm.faces.new((b[k], b[(k + 1) % 4], t[(k + 1) % 4], t[k])))
    for f in faces:
        f.material_index = mat_index
    return faces


# --------------------------------------------------------------------------- #
# Voronoi 破碎（numpy 半空间切割；本构建无 cell_fracture 插件，这里是等价实现）
# --------------------------------------------------------------------------- #
def voronoi_shatter(region_planes, seeds, k_neighbors=13):
    seeds = np.asarray(seeds, dtype=np.float64)
    region = np.asarray(region_planes, dtype=np.float64)
    n, p = seeds.shape[0], region.shape[0]
    k = min(k_neighbors, n - 1)

    d2 = ((seeds[:, None, :] - seeds[None, :, :]) ** 2).sum(-1)
    np.fill_diagonal(d2, np.inf)
    nearest = np.argsort(d2, axis=1)[:, :k]

    M = p + k
    planes = np.zeros((n, M, 4), dtype=np.float64)
    planes[:, :p] = region[None]
    for i in range(n):
        js = nearest[i]
        diff = seeds[js] - seeds[i]
        norm = np.linalg.norm(diff, axis=1, keepdims=True)
        norm[norm < 1e-9] = 1e-9
        nrm = diff / norm
        mid = (seeds[i] + seeds[js]) * 0.5
        planes[i, p:, :3] = nrm
        planes[i, p:, 3] = (nrm * mid).sum(1)

    from itertools import combinations
    tri = np.array(list(combinations(range(M), 3)), dtype=np.int32)
    sub = planes[:, tri, :]
    A = sub[..., :3]
    b = sub[..., 3]
    det = np.linalg.det(A)
    pts = np.zeros((n, tri.shape[0], 3), dtype=np.float64)
    ok = np.abs(det) > 1e-9
    if ok.any():
        pts[ok] = np.linalg.solve(A[ok], b[ok][..., None])[..., 0]

    slack = np.einsum("ntk,nmk->ntm", pts, planes[:, :, :3]) - planes[:, :, 3][:, None, :]
    valid = (slack <= 1e-6).all(axis=2) & ok

    cells = []
    for i in range(n):
        pl = planes[i]
        vpts = pts[i][valid[i]]
        if len(vpts) < 4:
            continue
        uniq, order = {}, []
        for v in vpts:
            key = (round(v[0], 5), round(v[1], 5), round(v[2], 5))
            if key not in uniq:
                uniq[key] = len(order)
                order.append(v)
        verts = np.array(order, dtype=np.float64)

        faces, kinds = [], []
        for mi in range(M):
            nv = pl[mi, :3]
            d = pl[mi, 3]
            idx = np.nonzero(np.abs(verts @ nv - d) < 1e-5)[0]
            if len(idx) < 3:
                continue
            centre = verts[idx].mean(axis=0)
            helper = np.array([0.0, 0.0, 1.0]) if abs(nv[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
            u = np.cross(nv, helper)
            u /= max(np.linalg.norm(u), 1e-9)
            w = np.cross(nv, u)
            rel = verts[idx] - centre
            ang = np.arctan2(rel @ w, rel @ u)
            srt = idx[np.argsort(ang)]
            faces.append([int(x) for x in srt])
            kinds.append(0 if mi < p else 1)
        if len(faces) < 4:
            continue
        cells.append({"verts": verts, "faces": faces, "kinds": kinds})
    return cells


def shard_objects_from_cells(name_prefix, cells, shell_mat, rock_mat, alt_mat,
                             shrink=0.972, jitter=0.022, seed_key=0):
    """Voronoi 单元 → 独立碎块对象。网格以自身质心为原点（便于绕自转），
    并整体收缩 shrink 制造真实间隙（否则密集凸包堆叠会持续抖动）。"""
    objs = []
    for ci, cell in enumerate(cells):
        verts = cell["verts"].copy()
        nv = len(verts)
        for vi in range(nv):
            amp = (hash01(seed_key, ci, vi) - 0.5) * 2.0 * jitter
            r = max(1e-6, math.hypot(verts[vi][0], verts[vi][1]))
            verts[vi] = verts[vi] + np.array([verts[vi][0] / r, verts[vi][1] / r, 0.0]) * amp

        centroid = verts.mean(axis=0)
        local = (verts - centroid) * shrink

        mesh = bpy.data.meshes.new(f"{name_prefix}_{ci:03d}")
        bm = bmesh.new()
        bv = [bm.verts.new(tuple(float(x) for x in v)) for v in local]
        for fi, f in enumerate(cell["faces"]):
            try:
                nf = bm.faces.new([bv[i] for i in f])
            except ValueError:
                continue
            if cell["kinds"][fi] == 0:
                nf.material_index = 0
            else:
                nf.material_index = 1 if hash01(seed_key, ci, fi) > 0.42 else 2
        bm.normal_update()
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(mesh)
        bm.free()

        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        mesh.materials.append(shell_mat)
        mesh.materials.append(rock_mat)
        mesh.materials.append(alt_mat)
        for poly in mesh.polygons:
            poly.use_smooth = False
        obj["centroid"] = list(map(float, centroid))
        objs.append((obj, Vector(centroid)))
    return objs


# --------------------------------------------------------------------------- #
# 场景
# --------------------------------------------------------------------------- #
def cell_origin(i, j):
    return Vector(((i - (GRID - 1) / 2) * SPACING, (j - (GRID - 1) / 2) * SPACING, 0.0))


def _pillar_base(bm, mat_base, mat_white):
    """下沉式莲花柱础（本地坐标，z 0..BASE_TOP）。"""
    add_octa_prism(bm, 1.62, 0.0, 0.24, mat_base)
    add_octa_prism(bm, 1.36, 0.24, 0.52, mat_base)
    add_octa_prism(bm, 1.12, 0.52, 0.74, mat_white)
    add_octa_prism(bm, 1.04, 0.74, BASE_TOP, mat_white)
    for k in range(16):
        a = k * 2 * math.pi / 16
        add_box(bm, (0.30, 0.20, 0.30),
                (1.22 * math.cos(a), 1.22 * math.sin(a), 0.38), mat_base, rot_z=a)


def _pillar_capital(bm, mat_white, mat_red, mat_gold, z0):
    """斗拱 + 梁木（本地坐标，从 z0 起）。刻意收窄，避免相邻柱顶连成一片。"""
    add_octa_prism(bm, SHAFT_R * 1.06, z0, z0 + 0.16, mat_gold)
    add_box(bm, (1.55, 1.55, 0.30), (0.0, 0.0, z0 + 0.31), mat_white)
    for (dx, dy, rot) in ((1, 0, 0.0), (-1, 0, 0.0), (0, 1, math.pi / 2), (0, -1, math.pi / 2)):
        add_box(bm, (0.95, 0.26, 0.22), (dx * 1.16, dy * 1.16, z0 + 0.31), mat_white, rot_z=rot)
        add_box(bm, (0.62, 0.20, 0.18), (dx * 1.34, dy * 1.34, z0 + 0.55), mat_red, rot_z=rot)
    add_box(bm, (2.10, 0.42, 0.26), (0.0, 0.0, z0 + 0.72), mat_white)
    add_box(bm, (0.42, 2.10, 0.22), (0.0, 0.0, z0 + 0.72), mat_red)
    add_box(bm, (1.30, 1.30, 0.14), (0.0, 0.0, z0 + 0.92), mat_gold)


def _frame_visibility_driver(obj, expr):
    """用 frame 表达式驱动 hide_render：14 帧前显示整柱、14 帧起显示碎块。"""
    obj.hide_render = False
    fc = obj.driver_add("hide_render")
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = expr
    return fc


def build_scene(mats, verbose=True):
    scn = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)

    hero_set = set(HERO_CELLS)
    all_shards = []
    heroes = []

    # ---- 33 根静态华表：合并成一个 mesh（本地建好再平移到柱位） ----
    bm = bmesh.new()
    for i in range(GRID):
        for j in range(GRID):
            if (i, j) in hero_set:
                continue
            o = cell_origin(i, j)
            red = ((i + j) % 2 == 0)
            m_red, m_white = (1, 2) if red else (2, 1)
            v0 = len(bm.verts)
            _pillar_base(bm, 4, m_white)
            add_octa_prism(bm, SHAFT_R, BASE_TOP, SHAFT_TOP, m_red, cap_bottom=False, cap_top=True)
            _pillar_capital(bm, m_white, m_red, 3, SHAFT_TOP)
            bm.verts.ensure_lookup_table()
            for vi in range(v0, len(bm.verts)):
                bm.verts[vi].co.x += o.x
                bm.verts[vi].co.y += o.y

    mesh = bpy.data.meshes.new("pillar_array")
    bm.to_mesh(mesh)
    bm.free()
    pillars = bpy.data.objects.new("pillar_array", mesh)
    scn.collection.objects.link(pillars)
    for mat in (mats["ink"], mats["shaft_red"], mats["shaft_white"], mats["gold"], mats["base"]):
        mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = False

    # ---- 三根受击华表 ----
    for (i, j) in HERO_CELLS:
        origin = cell_origin(i, j)
        red = ((i + j) % 2 == 0)
        shell = mats["shaft_red"] if red else mats["shaft_white"]
        rock = mats["rock"]
        alt = mats["rock_alt"]

        # 柱础（静态）
        bmb = bmesh.new()
        _pillar_base(bmb, 4, 2)
        m2 = bpy.data.meshes.new(f"hero_base_{i}{j}")
        bmb.to_mesh(m2)
        bmb.free()
        base = bpy.data.objects.new(f"hero_base_{i}{j}", m2)
        scn.collection.objects.link(base)
        for mat in (mats["ink"], mats["shaft_red"], mats["shaft_white"], mats["gold"], mats["base"]):
            m2.materials.append(mat)
        base.location = origin
        for poly in m2.polygons:
            poly.use_smooth = False

        # Voronoi 种子：加权簇 + 每簇散布极差大 → 巨块与碎屑并存
        rng = random.Random(SEED + i * 97 + j * 131)
        seeds_local = []
        clusters = []
        n_clusters = 5
        for c in range(n_clusters):
            cz = BASE_TOP + (SHAFT_TOP - BASE_TOP) * ((c + 0.5) / n_clusters)
            ca = rng.uniform(0, 2 * math.pi)
            cr = rng.uniform(0.0, SHAFT_R * 0.5)
            clusters.append({"c": (cr * math.cos(ca), cr * math.sin(ca), cz),
                             "spread": rng.uniform(0.40, 3.20),
                             "weight": rng.uniform(0.40, 1.80)})
        weights = [cl["weight"] for cl in clusters]
        for s in range(SHARDS_PER_HERO):
            cl = rng.choices(clusters, weights=weights, k=1)[0]
            cx, cy, cz = cl["c"]
            sp = cl["spread"]
            x = cx + rng.gauss(0, 0.27 * sp)
            y = cy + rng.gauss(0, 0.27 * sp)
            z = cz + rng.gauss(0, 0.95 * sp)
            rr = math.hypot(x, y)
            lim = SHAFT_R * 0.93
            while rr > lim:
                x *= 0.92
                y *= 0.92
                rr = math.hypot(x, y)
            z = min(max(z, BASE_TOP + 0.07), SHAFT_TOP - 0.07)
            seeds_local.append((x, y, z))

        apothem = SHAFT_R * math.cos(math.pi / SIDES)
        region = []
        for k in range(SIDES):
            a = math.pi / 8 + k * 2 * math.pi / SIDES
            region.append([math.cos(a), math.sin(a), 0.0, apothem])
        region.append([0.0, 0.0, -1.0, -BASE_TOP])
        region.append([0.0, 0.0, 1.0, SHAFT_TOP])

        cells = voronoi_shatter(region, seeds_local, k_neighbors=13)
        pairs = shard_objects_from_cells(f"shard_{i}{j}", cells, shell, rock, alt, seed_key=i * 10 + j)
        for so, centroid in pairs:
            so.location = origin + centroid
            _frame_visibility_driver(so, f"frame < {HIT_FRAME}")
        all_shards.extend([p[0] for p in pairs])

        # 14 帧前的“完整柱身”——避免爆碎前就露出裂缝，命中瞬间切形
        bms = bmesh.new()
        add_octa_prism(bms, SHAFT_R, BASE_TOP, SHAFT_TOP, 1 if red else 2,
                       cap_bottom=False, cap_top=True)
        ms = bpy.data.meshes.new(f"hero_shell_{i}{j}")
        bms.to_mesh(ms)
        bms.free()
        shell_obj = bpy.data.objects.new(f"hero_shell_{i}{j}", ms)
        scn.collection.objects.link(shell_obj)
        for mat in (mats["ink"], mats["shaft_red"], mats["shaft_white"], mats["gold"], mats["base"]):
            ms.materials.append(mat)
        shell_obj.location = origin
        for poly in ms.polygons:
            poly.use_smooth = False
        _frame_visibility_driver(shell_obj, f"frame >= {HIT_FRAME}")

        # 柱顶（会掉落的整体刚体）
        bmc = bmesh.new()
        _pillar_capital(bmc, 2, 1, 3, 0.0)
        mc = bpy.data.meshes.new(f"hero_capital_{i}{j}")
        bmc.to_mesh(mc)
        bmc.free()
        cap = bpy.data.objects.new(f"hero_capital_{i}{j}", mc)
        scn.collection.objects.link(cap)
        for mat in (mats["ink"], mats["shaft_red"], mats["shaft_white"], mats["gold"], mats["base"]):
            mc.materials.append(mat)
        cap.location = origin + Vector((0, 0, SHAFT_TOP))
        for poly in mc.polygons:
            poly.use_smooth = False

        heroes.append({"cell": (i, j), "origin": origin, "shards": [p[0] for p in pairs],
                       "shard_pairs": pairs, "capital": cap})
        if verbose:
            log(f"hero {(i, j)}: {len(pairs)} shards")

    ground = build_ground(mats)
    if verbose:
        log(f"static pillars={GRID*GRID-len(HERO_CELLS)}, shards={len(all_shards)}, "
            f"objects={len(bpy.data.objects)}")
    return {"pillars": pillars, "ground": ground, "heroes": heroes, "shards": all_shards}


def add_ring_band(bm, r_in, r_out, z, mat_index=0, sides=SIDES, phase=0.0):
    """八棱环带（真正的环，不是实心盘）。"""
    outer = [bm.verts.new((r_out * math.cos(phase + k * 2 * math.pi / sides),
                           r_out * math.sin(phase + k * 2 * math.pi / sides), z)) for k in range(sides)]
    inner = [bm.verts.new((r_in * math.cos(phase + k * 2 * math.pi / sides),
                           r_in * math.sin(phase + k * 2 * math.pi / sides), z)) for k in range(sides)]
    faces = []
    for k in range(sides):
        faces.append(bm.faces.new((inner[k], outer[k], outer[(k + 1) % sides], inner[(k + 1) % sides])))
    for f in faces:
        f.material_index = mat_index
    return faces


def build_ground(mats):
    bm = bmesh.new()
    # 墨底八棱台 + 内圈墨晕 + 鎏金细环（环带，不是实心盘）
    add_octa_prism(bm, 90.0, -0.32, 0.0, 0, sides=SIDES, phase=0.0)
    add_octa_prism(bm, 58.0, 0.0, 0.04, 1, sides=SIDES, phase=0.0)
    add_octa_prism(bm, 24.0, 0.04, 0.07, 0, sides=SIDES, phase=0.0)
    for r in (7.2, 13.6, 20.4, 27.2):
        add_ring_band(bm, r - 0.10, r + 0.10, 0.075, 2, phase=0.0)
    mesh = bpy.data.meshes.new("palace_floor")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("palace_floor", mesh)
    bpy.context.scene.collection.objects.link(obj)
    for mat in (mats["ink"], mats["ink_soft"], mats["gold_dk"]):
        mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = False
    return obj


# --------------------------------------------------------------------------- #
# 刚体
# --------------------------------------------------------------------------- #
def _rb_add(obj, kind="ACTIVE"):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.rigidbody.object_add(type=kind)


def setup_physics(scene_objs, verbose=True):
    scn = bpy.context.scene
    try:
        bpy.ops.rigidbody.world_remove()
    except Exception:
        pass
    bpy.ops.rigidbody.world_add()
    rbw = scn.rigidbody_world
    rbw.substeps_per_frame = 20
    rbw.solver_iterations = 26
    rbw.use_split_impulse = True

    # 地面：隐形厚板（防穿透）承担物理，视觉地面不参与
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -1.5))
    floor = bpy.context.object
    floor.name = "floor_collider"
    floor.scale = (90.0, 90.0, 3.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    floor.hide_render = True
    floor.display_type = "WIRE"
    _rb_add(floor, "PASSIVE")
    floor.rigid_body.collision_shape = "BOX"
    floor.rigid_body.friction = 0.9
    floor.rigid_body.restitution = 0.36

    # 静态柱阵 / 柱础：被动
    _rb_add(scene_objs["pillars"], "PASSIVE")
    scene_objs["pillars"].rigid_body.collision_shape = "MESH"
    for hero in scene_objs["heroes"]:
        base = bpy.data.objects.get(f"hero_base_{hero['cell'][0]}{hero['cell'][1]}")
        if base:
            _rb_add(base, "PASSIVE")

    # ---- 碎片：13 帧冻结 → 14..17 定向冲量（kinematic 匀速） → 17 帧起真刚体 ----
    rng = random.Random(SEED + 7)
    hero_center = sum((h["origin"] for h in scene_objs["heroes"]), Vector()) / len(scene_objs["heroes"])
    impact = Vector((hero_center.x, hero_center.y, 4.6))

    burst_frames = BURST_RELEASE - HIT_FRAME     # 3 帧动画
    for hero in scene_objs["heroes"]:
        origin = hero["origin"]
        for obj, centroid in hero["shard_pairs"]:
            _rb_add(obj, "ACTIVE")
            rb = obj.rigid_body
            rb.type = "ACTIVE"
            rb.collision_shape = "CONVEX_HULL"
            rb.use_margin = False
            rb.collision_margin = 0.0
            # 质量参考外包体体积
            dims = obj.dimensions
            vol = max(0.004, dims.x * dims.y * dims.z)
            rb.mass = max(1.5, min(70.0, vol * 900.0))
            rb.friction = 0.85
            rb.restitution = 0.26
            rb.linear_damping = 0.05
            rb.angular_damping = 0.10
            rb.use_deactivation = False

            radial = Vector((centroid.x, centroid.y, 0.0))
            radial = radial.normalized() if radial.length > 1e-4 else Vector((1, 0, 0))
            # 强径向 + 朝镜头(-Y)与向上偏置：碎块向外炸，同时扑向镜头
            jitter = Vector((rng.uniform(-0.30, 0.30), rng.uniform(-0.30, 0.30), rng.uniform(-0.18, 0.32)))
            direction = (radial * 1.15 + Vector((0.0, -0.55, 0.25)) + jitter).normalized()
            height_f = min(1.0, max(0.0, (centroid.z - BASE_TOP) / (SHAFT_TOP - BASE_TOP)))
            speed = 7.5 + 7.0 * (1.0 - height_f) + rng.uniform(-1.2, 2.0)

            base_loc = origin + centroid
            # 冻结（1..13）
            rb.kinematic = True
            rb.keyframe_insert("kinematic", frame=HIT_FRAME - 1)
            obj.location = base_loc
            obj.keyframe_insert("location", frame=1)
            obj.keyframe_insert("location", frame=HIT_FRAME - 1)
            # 定向冲量（14..17，匀速）
            obj.location = base_loc + direction * (speed * burst_frames / FPS)
            obj.keyframe_insert("location", frame=BURST_RELEASE)
            # 自转（同样在 kinematic 期间，释放时继承角速度）
            spin_axis = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized()
            omega = rng.uniform(2.0, 6.5)      # rad/s
            obj.rotation_mode = "AXIS_ANGLE"
            obj.rotation_axis_angle = (0.0, spin_axis.x, spin_axis.y, spin_axis.z)
            obj.keyframe_insert("rotation_axis_angle", frame=1)
            obj.keyframe_insert("rotation_axis_angle", frame=HIT_FRAME - 1)
            obj.rotation_axis_angle = (omega * burst_frames / FPS, spin_axis.x, spin_axis.y, spin_axis.z)
            obj.keyframe_insert("rotation_axis_angle", frame=BURST_RELEASE)
            # 交回真刚体
            rb.kinematic = False
            rb.keyframe_insert("kinematic", frame=BURST_RELEASE)

    # ---- 柱顶：14 帧起脱落 ----
    for hero in scene_objs["heroes"]:
        cap = hero["capital"]
        _rb_add(cap, "ACTIVE")
        rb = cap.rigid_body
        rb.type = "ACTIVE"
        rb.collision_shape = "CONVEX_HULL"
        rb.mass = 220.0
        rb.friction = 0.85
        rb.restitution = 0.14
        rb.use_deactivation = False
        rb.kinematic = True
        rb.keyframe_insert("kinematic", frame=HIT_FRAME - 1)
        base_loc = cap.location.copy()
        cap.keyframe_insert("location", frame=1)
        cap.keyframe_insert("location", frame=HIT_FRAME - 1)
        cap.location = base_loc + Vector((0.0, -0.55, 0.12))
        cap.keyframe_insert("location", frame=BURST_RELEASE)
        rb.kinematic = False
        rb.keyframe_insert("kinematic", frame=BURST_RELEASE)

    # ---- 隐形倾斜旋转碰撞体（扫过爆碎区，兑现“碰撞体横扫”的设定） ----
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=impact)
    sweeper = bpy.context.object
    sweeper.name = "sweeper_collider"
    sweeper.scale = (13.0, 0.55, 0.55)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    sweeper.hide_render = True
    sweeper.display_type = "WIRE"
    _rb_add(sweeper, "ACTIVE")
    sweeper.rigid_body.kinematic = True
    sweeper.rigid_body.collision_shape = "BOX"
    sweeper.rotation_mode = "XYZ"
    for f, t in ((HIT_FRAME, 0.0), (FRAME_END, 1.0)):
        pos = impact + Vector((0.0, -2.6 + t * 5.2, 0.55 * t))
        sweeper.location = pos
        sweeper.rotation_euler = Euler((math.radians(11.0), math.radians(-6.0) * t,
                                        math.radians(24.0) + t * math.radians(30.0)), "XYZ")
        sweeper.keyframe_insert("location", frame=f)
        sweeper.keyframe_insert("rotation_euler", frame=f)

    scene_objs.update({"impact": impact, "sweeper": sweeper, "floor": floor})
    if verbose:
        log(f"physics: {len(scene_objs['shards'])} shards, impact={tuple(round(v,2) for v in impact)}")
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


# --------------------------------------------------------------------------- #
# 运镜
# --------------------------------------------------------------------------- #
def setup_camera(scene_objs):
    scn = bpy.context.scene
    old = bpy.data.objects.get("shot2_cam")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    cam_data = bpy.data.cameras.new("shot2_cam")
    cam = bpy.data.objects.new("shot2_cam", cam_data)
    scn.collection.objects.link(cam)
    scn.camera = cam
    cam_data.sensor_width = 36.0
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.1
    cam_data.clip_end = 600.0

    def fov_to_lens(fov_deg):
        return cam_data.sensor_width / (2.0 * math.tan(math.radians(fov_deg) * 0.5))

    impact = scene_objs["impact"]
    # 环绕中心略偏向柱阵内侧，让受击柱成为最近主体
    center = Vector((impact.x, impact.y + 1.1, 0.0))

    def ease(t):
        return t * t * (3.0 - 2.0 * t)

    for f in range(FRAME_START, FRAME_END + 1):
        t = (f - FRAME_START) / (FRAME_END - FRAME_START)
        e = ease(t)
        # 螺旋俯冲：Z=16.0 → 3.0，半径 32 → 20，方位 -132° → -92°
        ang = math.radians(-132.0) + math.radians(40.0) * e
        radius = 32.0 - 12.0 * (e ** 0.70)
        height = 16.0 - 13.2 * (e ** 0.55)
        cam.location = Vector((center.x + radius * math.cos(ang),
                               center.y + radius * math.sin(ang),
                               height))

        view = Vector((center.x - cam.location.x, center.y - cam.location.y, 0.0))
        if view.length < 1e-5:
            view = Vector((0.0, 1.0, 0.0))
        right = view.normalized().cross(Vector((0.0, 0.0, 1.0))).normalized()
        # 目标点右移 → 受击柱落在画面左三分（避免中心图腾）
        target = Vector((center.x + right.x * 3.0, center.y + right.y * 3.0, 3.2 + 3.8 * e))
        direction = target - cam.location
        q = direction.to_track_quat("-Z", "Y")
        roll = Quaternion((0.0, 0.0, 1.0), math.radians(-5.0) * e)
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q @ roll
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cam_data.lens = fov_to_lens(54.0 + 10.0 * e)
        cam_data.keyframe_insert("lens", frame=f)

    cam_data.lens = fov_to_lens(54.0)
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
    style = bpy.data.linestyles.get("Shot2Ink") or bpy.data.linestyles.new("Shot2Ink")
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
        fs.crease_angle = math.radians(96.0)
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
    scn.render.filepath = os.path.join(os.path.abspath(frames_dir), "shot2_")
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
    ffmpeg = os.environ.get("SHOT2_FFMPEG", "")
    if not ffmpeg:
        cand = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..",
                            "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe")
        ffmpeg = os.path.abspath(cand)
    if not os.path.exists(ffmpeg):
        raise RuntimeError(f"ffmpeg not found: {ffmpeg}")
    return ffmpeg


def encode_webm(frames_dir, webm_path):
    """PNG 序列 → VP9 WebM。

    ⚠️ 本机 ffmpeg（Remotion 自带的精简 7.1 构建）的 matroska 封装**不写 VP9 alpha**：
    即使传 `-pix_fmt yuva420p`，落盘仍是 yuv420p（实测容器里没有 AlphaMode）。
    Remotion 的渲染器复用的也是同一个二进制，所以 VP9+RGBA 在当前离线管线里拿不到。
    需要带 Alpha 的成片请用 `encode_prores_alpha()`（ProRes 4444，Remotion 可读），
    或直接用本脚本输出的 PNG 序列。
    """
    import subprocess
    import glob
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), "shot2_*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    os.makedirs(os.path.dirname(os.path.abspath(webm_path)), exist_ok=True)
    ffmpeg = _ffmpeg_path()
    pattern = os.path.join(os.path.abspath(frames_dir), "shot2_%04d.png")
    t0 = time.time()
    cmd = [ffmpeg, "-y", "-framerate", str(FPS), "-start_number", "1", "-i", pattern,
           "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "26",
           "-auto-alt-ref", "0", "-row-mt", "1", "-threads", "8", webm_path]
    log("encode: " + " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed({proc.returncode}): {proc.stderr[-1500:]}")
    size = os.path.getsize(webm_path) if os.path.exists(webm_path) else 0
    if size <= 0:
        raise RuntimeError(f"webm empty: {webm_path}")
    rep = {"webm": os.path.abspath(webm_path), "bytes": size,
           "seconds": round(time.time() - t0, 1), "frames": len(frames),
           "alpha": "unavailable (ffmpeg webm muxer cannot carry VP9 alpha)"}
    log(f"webm -> {webm_path} ({size/1024/1024:.2f} MB)  [no alpha: use ProRes/PNG for transparency]")
    return rep


def encode_prores_alpha(frames_dir, mov_path):
    """PNG 序列 → ProRes 4444 MOV（yuva444p10le，真 Alpha），Remotion 可直接读。"""
    import subprocess
    import glob
    frames = sorted(glob.glob(os.path.join(os.path.abspath(frames_dir), "shot2_*.png")))
    if not frames:
        raise RuntimeError(f"no frames in {frames_dir}")
    os.makedirs(os.path.dirname(os.path.abspath(mov_path)), exist_ok=True)
    ffmpeg = _ffmpeg_path()
    pattern = os.path.join(os.path.abspath(frames_dir), "shot2_%04d.png")
    t0 = time.time()
    cmd = [ffmpeg, "-y", "-framerate", str(FPS), "-start_number", "1", "-i", pattern,
           "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
           "-vendor", "apl0", mov_path]
    log("encode(alpha): " + " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"prores failed({proc.returncode}): {proc.stderr[-1500:]}")
    size = os.path.getsize(mov_path) if os.path.exists(mov_path) else 0
    if size <= 0:
        raise RuntimeError(f"mov empty: {mov_path}")
    rep = {"mov": os.path.abspath(mov_path), "bytes": size,
           "seconds": round(time.time() - t0, 1), "frames": len(frames), "pix_fmt": "yuva444p10le"}
    log(f"prores4444 -> {mov_path} ({size/1024/1024:.2f} MB, alpha kept)")
    return rep


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def collect_scene_objects():
    pillars = bpy.data.objects.get("pillar_array")
    ground = bpy.data.objects.get("palace_floor")
    heroes, all_shards = [], []
    for (i, j) in HERO_CELLS:
        prefix = f"shard_{i}{j}_"
        shards = [o for o in bpy.data.objects if o.name.startswith(prefix)]
        cap = bpy.data.objects.get(f"hero_capital_{i}{j}")
        pairs = []
        for s in shards:
            c = s.get("centroid", [0.0, 0.0, 0.0])
            pairs.append((s, Vector(c)))
        heroes.append({"cell": (i, j), "origin": cell_origin(i, j), "shards": shards,
                       "shard_pairs": pairs, "capital": cap})
        all_shards.extend(shards)
    hero_center = sum((h["origin"] for h in heroes), Vector()) / max(1, len(heroes))
    impact = Vector((hero_center.x, hero_center.y, 4.6))
    return {"pillars": pillars, "ground": ground, "heroes": heroes, "shards": all_shards,
            "impact": impact, "sweeper": bpy.data.objects.get("sweeper_collider"),
            "floor": bpy.data.objects.get("floor_collider")}


def build_all(verbose=True):
    t0 = time.time()
    for mat in list(bpy.data.materials):
        if mat.name.startswith(("M_", "Shot2")):
            bpy.data.materials.remove(mat)
    for ls in list(bpy.data.linestyles):
        if ls.name.startswith("Shot2"):
            bpy.data.linestyles.remove(ls)
    mats = build_materials()
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = FRAME_START, FRAME_END
    objs = build_scene(mats, verbose=verbose)
    setup_physics(objs, verbose=verbose)
    bake_physics(verbose=verbose)
    cam = setup_camera(objs)
    setup_render(scn, scale=1, samples=16)
    if verbose:
        log(f"scene built in {time.time()-t0:.1f}s")
    return {"mats": mats, "objs": objs, "cam": cam}


def parse_args(argv):
    import argparse
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(prog="render_shot2_collapse")
    p.add_argument("--frame", type=int, default=24)
    p.add_argument("--preview", type=str, default=None)
    p.add_argument("--still", type=str, default=None)
    p.add_argument("--scale", type=int, default=1)
    p.add_argument("--samples", type=int, default=16)
    p.add_argument("--thickness", type=float, default=2.2)
    p.add_argument("--frames-dir", type=str, default=os.path.join("out", "blender_frames", "shot2"))
    p.add_argument("--webm", type=str, default=None)
    p.add_argument("--alpha-mov", type=str, default=None,
                   help="同时输出 ProRes 4444 MOV（真正的 Alpha 通道，Remotion 可读）")
    p.add_argument("--all", action="store_true")
    p.add_argument("--qa-frames", type=str, default=None,
                   help="逗号分隔的关键验收帧，例如 6,14,20,40（一次建场渲多帧）")
    p.add_argument("--qa-dir", type=str, default=os.path.join("out", "blender_qa"))
    p.add_argument("--inspect", action="store_true")
    p.add_argument("--no-freestyle", action="store_true")
    p.add_argument("--blend", type=str, default=None)
    return p.parse_args(argv)


def inspect_physics(objs, frames=(HIT_FRAME - 1, HIT_FRAME, HIT_FRAME + 3, 20, 21, 24, 36, FRAME_END)):
    scn = bpy.context.scene
    stats = {"shards": len(objs["shards"]), "objects": len(bpy.data.objects)}
    prev, prev_f = None, None
    for f in frames:
        scn.frame_set(f)
        cs = []
        for o in objs["shards"]:
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            cs.append(sum(bb, Vector()) / 8.0)
        row = {"z": [round(min(c.z for c in cs), 2), round(max(c.z for c in cs), 2)],
               "spread": round(max(math.hypot(c.x - objs["impact"].x, c.y - objs["impact"].y) for c in cs), 2),
               "grounded": sum(1 for c in cs if c.z < 0.7)}
        if prev:
            gap = max(1, f - prev_f)     # 采样点之间可能隔多帧，速度必须按真实帧间隔折算
            sp = [(c - p).length * FPS / gap for c, p in zip(cs, prev)]
            row["vmax"] = round(max(sp), 1)
            row["vmean"] = round(sum(sp) / len(sp), 2)
        stats[f"f{f}"] = row
        prev, prev_f = cs, f
    return stats


def main():
    args = parse_args(sys.argv)
    t_start = time.time()
    report = {"args": {k: v for k, v in vars(args).items()}, "steps": []}

    built = build_all(verbose=True)
    objs = built["objs"]

    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
        log(f"saved blend -> {args.blend}")

    if args.inspect:
        log("INSPECT " + json.dumps(inspect_physics(objs)))
        return 0

    if args.qa_frames:
        for fr in [int(x) for x in args.qa_frames.split(",") if x.strip()]:
            path = os.path.join(args.qa_dir, f"shot2_f{fr:03d}.png")
            report["steps"].append(render_still(path, fr, scale=args.scale,
                                                samples=args.samples, thickness=args.thickness))
        report["total_seconds"] = round(time.time() - t_start, 1)
        print("REPORT:" + json.dumps(report, ensure_ascii=False))
        return 0

    if args.preview or args.still:
        if args.no_freestyle:
            bpy.context.scene.render.use_freestyle = False
        rep = render_still(args.preview or args.still, args.frame, scale=args.scale,
                           samples=args.samples, thickness=args.thickness)
        report["steps"].append(rep)

    elif args.all:
        rep = render_sequence(args.frames_dir, scale=args.scale, samples=args.samples,
                              thickness=args.thickness)
        report["steps"].append(rep)
        if args.webm:
            report["steps"].append(encode_webm(args.frames_dir, args.webm))
        if args.alpha_mov:
            report["steps"].append(encode_prores_alpha(args.frames_dir, args.alpha_mov))

    report["total_seconds"] = round(time.time() - t_start, 1)
    print("REPORT:" + json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    _code = main()
    # Freestyle 在部分无头构建上退出时会抛 EXCEPTION_ACCESS_VIOLATION；
    # 渲染产物已落盘，这里跳过 Blender 的析构以保证 CLI 退出码为 0。
    sys.stdout.flush()
    sys.stderr.flush()
    if bpy.app.background:
        os._exit(int(_code or 0))
    sys.exit(_code)

