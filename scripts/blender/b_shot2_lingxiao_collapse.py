"""Shot 2B · 凌霄宝殿三维矩阵崩塌（55 帧 / 不透明 MP4 / 30 fps）。

对应分镜：Sub2B 98–150 帧，替换原 `@remotion/three` 场景。复刻《千本樱》
00:22 的冲击波与 02:44 的螺旋俯冲运镜：

  · 带发光阵纹的棋盘格地面（24×24 真棋盘 + 五环二十四芒阵）；
  · 中央三重须弥座上的盘龙宝座 + 赤金光环；
  · **环列 36 根斗拱巨柱**（八棱柱身 + 三层斗拱 + 盘龙金环），外围 80 座重檐飞阁剪影；
  · 第 14 帧（= 全片第 112 帧「摧」）巨型金箍棒横扫，地面炸开三圈赤金冲击波；
  · 36 根巨柱按 `subdivide` → `bisect_plane` → `split_edges` →
    `separate(type='LOOSE')` 裂成数百块 3D 石块，贴镜头飞溅；
  · 摄像机以螺旋轨迹从高空俯冲进殿心，伴随 Roll 轴倾斜与冲击震屏。

V8 第二版修正（第一版事故）：
  1. `separate(LOOSE)` 拆出来的碎块对象原点都在柱基，必须把网格顶点按质心
     归零、把质心写回对象原点，否则上千块碎片会全部从殿心炸开糊满镜头；
  2. 61 块/柱 × 36 柱 = 2196 对象会把 Freestyle 拖到 65s/帧（半分辨率）。
     因此按质心方位角把碎块**聚成 9 簇**，并且碎片不进勾线集合，
     只有柱体/宝座/地面勾线。

用法：
  blender -b -P scripts/blender/b_shot2_lingxiao_collapse.py -- --still out/blender_qa/s2_f14.png --frame 14
  blender -b -P scripts/blender/b_shot2_lingxiao_collapse.py -- --all --frames-dir out/blender_frames/shot2
"""

import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import ukiyoe_style as uk  # noqa: E402

uk.set_tag("shot2")

FRAME_START, FRAME_END = 1, 55
HIT_FRAME = 14           # 全片第 112 帧重音「摧」
SHOT_NAME = "b_shot2_lingxiao_collapse"
PREFIX = "s2_"
FRAMES_DIR = os.path.join("out", "blender_frames", "shot2")
MP4_OUT = os.path.join("public", "blender_renders", f"{SHOT_NAME}.mp4")

PILLARS = 36
RING_RADIUS = 18.0
PILLAR_R = 0.80
PILLAR_H = 9.4
SHARD_CLUSTERS = 9


# --------------------------------------------------------------------------- #
# 地面 / 阵纹
# --------------------------------------------------------------------------- #

def build_ground(mats):
    """24×24 真棋盘（单 mesh 双材质）+ 五环二十四芒赤金阵纹。"""
    cells = 24
    span = 54.0
    step = span / cells
    verts, faces, face_mats = [], [], []
    for i in range(cells):
        for j in range(cells):
            x0 = -span / 2 + i * step
            y0 = -span / 2 + j * step
            base = len(verts)
            verts += [(x0, y0, 0), (x0 + step, y0, 0), (x0 + step, y0 + step, 0), (x0, y0 + step, 0)]
            faces.append((base, base + 1, base + 2, base + 3))
            face_mats.append((i + j) % 2)
    ground = uk.new_mesh_object("Ground_Checker", verts, faces,
                                [mats["stone_dark"], mats["stone"]], face_mats=face_mats)
    detail = uk.ensure_collection("Detail")
    for index, radius in enumerate((4.2, 7.6, 10.8, 13.8, 16.6)):
        uk.add_arc_ring(f"FormationRing_{index}", radius, 0.055 + index * 0.004,
                        0.0, math.pi * 2.0, (0, 0, 0.05),
                        mats["gold"] if index % 2 == 0 else mats["gold_dim"],
                        segments=64, minor_segments=4, collection=detail)
    for index in range(24):
        theta = index / 24 * math.pi * 2
        length = 16.6 if index % 2 == 0 else 11.0
        uk.add_box(f"Spoke_{index}", (length, 0.09, 0.02),
                   (math.cos(theta) * length / 2, math.sin(theta) * length / 2, 0.05),
                   mats["gold_dim"], rotation=(0, 0, theta), collection=detail)
    return ground


# --------------------------------------------------------------------------- #
# 巨柱
# --------------------------------------------------------------------------- #

def build_pillar_parts(mats, name="Pillar"):
    parts = []
    parts.append(uk.add_box(f"{name}_Base0", (2.8, 2.8, 0.55), (0, 0, 0.27), mats["stone"]))
    parts.append(uk.add_box(f"{name}_Base1", (2.2, 2.2, 0.42), (0, 0, 0.75), mats["paper_hard"]))
    parts.append(uk.add_cylinder(f"{name}_Shaft", PILLAR_R, PILLAR_H,
                                 (0, 0, 0.96 + PILLAR_H / 2), mats["stone"], verts=8))
    # 朱砂束带：柱身中段两道，保证 2B 不是一片黑白
    for band_z in (4.2, 5.0):
        parts.append(uk.add_cylinder(f"{name}_Band_{band_z}", PILLAR_R + 0.03, 0.30,
                                     (0, 0, 0.96 + band_z), mats["cinnabar"], verts=8))
    parts.append(uk.add_cylinder(f"{name}_Collar", PILLAR_R + 0.16, 0.32,
                                 (0, 0, 0.96 + PILLAR_H - 0.18), mats["paper"], verts=8))
    for level in range(2):
        z = 0.96 + PILLAR_H + level * 0.34
        arm = 2.1 - level * 0.36
        for direction in range(4):
            theta = direction * math.pi / 2
            parts.append(uk.add_box(
                f"{name}_Dougong_{level}_{direction}", (arm, 0.24, 0.20),
                (math.cos(theta) * (arm / 2 - 0.1), math.sin(theta) * (arm / 2 - 0.1), z),
                mats["paper_hard"] if level % 2 == 0 else mats["ink_soft"],
                rotation=(0, 0, theta)))
        parts.append(uk.add_box(f"{name}_DougongCap_{level}", (1.0, 1.0, 0.14),
                                (0, 0, z + 0.13), mats["paper_hard"]))
    parts.append(uk.add_box(f"{name}_Capital", (2.5, 2.5, 0.32),
                            (0, 0, 0.96 + PILLAR_H + 0.92), mats["paper_hard"]))
    for index, z in enumerate((3.1, 6.6)):
        parts.append(uk.add_torus(f"{name}_Ring_{index}", PILLAR_R + 0.19, 0.06,
                                  (0, 0, 0.96 + z), mats["gold"],
                                  major_segments=20, minor_segments=6))
        parts.append(uk.add_ico(f"{name}_RingBoss_{index}", 0.13,
                                (0, PILLAR_R + 0.25, 0.96 + z), mats["gold_hot"], subdiv=1))
    return parts


def build_pillar(mats, index, x, y):
    pillar = uk.join_objects(build_pillar_parts(mats, f"P{index:02d}"), f"Pillar_{index:02d}")
    pillar.location = (x, y, 0)
    return pillar


# --------------------------------------------------------------------------- #
# 飞阁剪影 / 宝座 / 金箍棒
# --------------------------------------------------------------------------- #

def pagoda_mesh(bm, center, scale, rotation):
    cx, cy = center
    mat = Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(rotation, 4, "Z") @ Matrix.Scale(scale, 4)

    def add_box(size, z):
        sx, sy, sz = size
        verts = []
        for dx in (-0.5, 0.5):
            for dy in (-0.5, 0.5):
                for dz in (0.0, 1.0):
                    verts.append(mat @ Vector((dx * sx, dy * sy, z + dz * sz)))
        idx = [bm.verts.new(v) for v in verts]
        bm.verts.ensure_lookup_table()
        for f in [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]:
            bm.faces.new([idx[i] for i in f])

    add_box((2.4, 2.4, 0.7), 0.0)
    add_box((1.8, 1.8, 1.9), 0.7)
    add_box((3.4, 3.4, 0.24), 2.6)
    add_box((1.5, 1.5, 1.5), 2.84)
    add_box((3.0, 3.0, 0.22), 4.34)
    add_box((1.1, 1.1, 1.1), 4.56)
    add_box((2.4, 2.4, 0.20), 5.66)
    add_box((0.22, 0.22, 1.4), 5.86)


def build_pavilions(mats, rng):
    bm = bmesh.new()
    for index in range(80):
        angle = index / 80 * math.pi * 2 + rng.uniform(-0.02, 0.02)
        radius = 36.0 + rng.uniform(0, 22.0)
        pagoda_mesh(bm, (math.cos(angle) * radius, math.sin(angle) * radius),
                    rng.uniform(1.7, 3.4), angle)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Pavilions")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["ink_soft"])
    ob = bpy.data.objects.new("Pavilions_80", me)
    uk.link_object(ob, uk.ensure_collection("Detail"))
    return ob


def build_throne(mats):
    parts = []
    parts.append(uk.add_box("Throne_Dais0", (12.0, 9.0, 0.7), (0, 0, 0.35), mats["stone"]))
    parts.append(uk.add_box("Throne_Dais1", (10.2, 7.6, 0.6), (0, 0, 1.0), mats["paper_hard"]))
    parts.append(uk.add_box("Throne_Dais2", (8.4, 6.2, 0.55), (0, 0, 1.55), mats["cinnabar"]))
    parts.append(uk.add_box("Throne_Seat", (4.4, 3.2, 1.5), (0, 0, 2.55), mats["paper"]))
    parts.append(uk.add_box("Throne_Cushion", (3.6, 2.4, 0.4), (0, 0, 3.2), mats["cinnabar"]))
    parts.append(uk.add_box("Throne_Back", (5.0, 0.6, 6.2), (0, 2.1, 5.6), mats["cinnabar"]))
    for side in (-1, 1):
        parts.append(uk.add_box(f"Throne_Arm_{side}", (0.7, 3.0, 0.8), (side * 2.5, 0.2, 3.6),
                                mats["paper_hard"]))
        for index in range(14):
            t = index / 13
            theta = t * math.pi * 3.2 * side
            parts.append(uk.add_ico(
                f"ThroneDragon_{side}_{index}", 0.16 + 0.055 * math.sin(t * math.pi),
                (side * 2.9 + math.cos(theta) * 0.40, 1.9 + math.sin(theta) * 0.40, 2.4 + t * 5.4),
                mats["gold"], subdiv=1))
    for index, radius in enumerate((4.2, 5.2, 6.3)):
        parts.append(uk.add_torus(f"ThroneHalo_{index}", radius, 0.09 + index * 0.02,
                                  (0, 2.9, 7.0), mats["gold"],
                                  rotation=(math.radians(90), 0, 0),
                                  major_segments=32, minor_segments=5))
    parts.append(uk.add_box("Throne_Crown", (1.7, 0.5, 3.0), (0, 2.35, 9.2), mats["gold"]))
    return uk.join_objects(parts, "Throne")


def build_cudgel(mats):
    parts = []
    for index in range(5):
        parts.append(uk.add_cylinder(
            f"GiantCudgel_{index}", 1.15 - index * 0.06, 86.0, (-index * 2.6, 0, 0),
            mats["gold_hot"] if index == 0 else mats["gold_dim"],
            rotation=(0, math.radians(90), 0), verts=12,
            collection=uk.ensure_collection("Detail")))
    return parts


# --------------------------------------------------------------------------- #
# 碎裂模板（质心归零 + 方位角聚类）
# --------------------------------------------------------------------------- #

def make_fracture_template(mats, cuts, planes, seed, clusters=SHARD_CLUSTERS):
    pillar = uk.join_objects(build_pillar_parts(mats, "TemplatePillar"), "TemplatePillar")
    parts = uk.fracture_object(pillar, cuts=cuts, seed=seed, planes=planes, prefix="tpl")
    buckets = [[] for _ in range(clusters)]
    for part in parts:
        if not part.data.vertices:
            continue
        centroid = sum((v.co for v in part.data.vertices), Vector()) / len(part.data.vertices)
        angle = (math.atan2(centroid.y, centroid.x) + math.pi) / (2 * math.pi)
        buckets[min(clusters - 1, int(angle * clusters))].append(part)

    template = []
    for bucket in buckets:
        if not bucket:
            continue
        joined = uk.join_objects(bucket, "ShardCluster")
        mesh = joined.data
        centroid = sum((v.co for v in mesh.vertices), Vector()) / max(1, len(mesh.vertices))
        # 关键：原点归到碎块自身质心，否则爆炸的径向方向全指向柱基
        mesh.transform(Matrix.Translation(-centroid))
        local = Matrix.Translation(centroid) @ joined.matrix_world
        mesh_copy = mesh.copy()
        mesh_copy.name = f"ShardMesh_{seed}_{len(template)}"
        template.append((mesh_copy, local))
        bpy.data.objects.remove(joined, do_unlink=True)
    bpy.data.objects.remove(pillar, do_unlink=True)
    uk.log(f"fracture template: {len(parts)} loose → {len(template)} clusters")
    return template


def instantiate_shards(template, pillar_index, origin):
    shards = []
    debris = uk.ensure_collection("Debris")
    for index, (mesh, local) in enumerate(template):
        ob = bpy.data.objects.new(f"S{pillar_index:02d}_{index:02d}", mesh)
        uk.link_object(ob, debris)
        ob.matrix_world = Matrix.Translation(origin) @ local
        shards.append(ob)
    return shards


def animate_shards(shards, origin, rng):
    """解析式碎裂：p = p0 + v·t + ½g·t²（禁止逐帧积分，并发渲染才不会乱序）。"""
    g = -22.0
    for shard in shards:
        base = shard.matrix_world.translation.copy()
        base_rot = shard.matrix_world.to_euler("XYZ").copy()
        radial = Vector((base.x - origin[0], base.y - origin[1], 0.0))
        if radial.length < 0.05:
            radial = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0.0))
        radial.normalize()
        speed = rng.uniform(3.2, 8.5)
        vx, vy = radial.x * speed, radial.y * speed
        vz = rng.uniform(3.0, 9.0)
        spin = Vector((rng.uniform(-5, 5), rng.uniform(-5, 5), rng.uniform(-5, 5)))
        shard.location = (base.x, base.y, base.z - 220.0)
        shard.keyframe_insert("location", frame=HIT_FRAME - 1)
        for frame in range(HIT_FRAME, FRAME_END + 1):
            t = (frame - HIT_FRAME) / uk.FPS
            shard.location = (base.x + vx * t, base.y + vy * t, base.z + vz * t + 0.5 * g * t * t)
            shard.rotation_euler = Euler((base_rot.x + spin.x * t,
                                          base_rot.y + spin.y * t,
                                          base_rot.z + spin.z * t), "XYZ")
            shard.keyframe_insert("location", frame=frame)
            shard.keyframe_insert("rotation_euler", frame=frame)


# --------------------------------------------------------------------------- #
# 冲击波 / 尘埃
# --------------------------------------------------------------------------- #

def build_shockwaves(mats):
    for index in range(3):
        ring = uk.add_torus(f"Shock_{index}", 1.0, 0.09 + index * 0.03, (0, 0, 0.25 + index * 0.12),
                            mats["gold_hot"] if index == 0 else mats["gold"],
                            major_segments=48, minor_segments=5,
                            collection=uk.ensure_collection("Detail"))
        ring.scale = (0.05, 0.05, 0.05)
        ring.keyframe_insert("scale", frame=HIT_FRAME - 1)
        ring.scale = (17.0 - index * 3.4, 17.0 - index * 3.4, 1.0)
        ring.keyframe_insert("scale", frame=HIT_FRAME + 24 + index * 4)
        uk.set_interpolation(ring, "LINEAR")


def build_dust(mats, rng):
    detail = uk.ensure_collection("Detail")
    for index in range(90):
        angle = rng.uniform(0, math.pi * 2)
        radius = rng.uniform(2.0, 20.0)
        born = HIT_FRAME + rng.randint(0, 4)
        speed = rng.uniform(1.5, 6.0)
        up = rng.uniform(5.0, 14.0)
        mat = mats["gold"] if index % 3 else mats["paper"]
        ob = uk.add_ico(f"Dust_{index:03d}", rng.uniform(0.06, 0.20), (0, 0, -80), mat,
                        subdiv=1, collection=detail)
        x0, y0 = math.cos(angle) * radius, math.sin(angle) * radius
        for frame in range(FRAME_START, FRAME_END + 1):
            if frame < born:
                ob.location = (0, 0, -80)
                ob.keyframe_insert("location", frame=frame)
                continue
            t = (frame - born) / uk.FPS
            ob.location = (x0 + math.cos(angle) * speed * t, y0 + math.sin(angle) * speed * t,
                           0.4 + up * t - 7.0 * t * t)
            ob.keyframe_insert("location", frame=frame)


# --------------------------------------------------------------------------- #
# 相机
# --------------------------------------------------------------------------- #

def build_camera(scn):
    cam = uk.make_camera("Shot2Cam", (34.0, 0.0, 36.0), (0.0, 0.0, 5.0), lens=25.0)
    for frame in range(FRAME_START, FRAME_END + 1):
        t = (frame - FRAME_START) / (FRAME_END - FRAME_START)
        angle = 0.62 + 2.75 * t
        radius = 36.0 * (1 - t) ** 1.3 + 11.0 * t
        height = 38.0 * (1 - t) ** 1.2 + 6.2 * t
        target = (0.0, 0.0, 5.0 * (1 - t) + 6.6 * t)
        age = max(0.0, (frame - HIT_FRAME) / uk.FPS)
        shock = math.exp(-age * 7.5) if frame >= HIT_FRAME else 0.0
        jitter = Vector((math.sin(frame * 2.7) * 0.45 * shock,
                         math.cos(frame * 3.1) * 0.45 * shock,
                         math.sin(frame * 4.3) * 0.30 * shock))
        loc = Vector((math.cos(angle) * radius, math.sin(angle) * radius, height)) + jitter
        roll = -20.0 + 32.0 * t + math.sin(frame * 3.4) * 6.0 * shock
        uk.keyframe_pose(cam, frame, loc, target, roll_deg=roll, lens=25.0 + 9.0 * t)
    return cam


# --------------------------------------------------------------------------- #
# 组装
# --------------------------------------------------------------------------- #

def setup_scene():
    scn = uk.reset_scene()
    mats = uk.build_standard_materials()
    mats["gold_hot"] = uk.make_glow_material("S2_GoldHot", "gold_bright", 6.0)
    rng = uk.make_rng(20261023)

    uk.setup_world("ink_deep", 0.10)
    uk.add_sun("KeySun", 3.4, rotation=(math.radians(48), 0, math.radians(-42)))
    uk.add_area("RimArea", 90.0, 16.0, (0.0, 16.0, 20.0),
                rotation=(math.radians(-54), 0, 0), color="cinnabar")
    uk.add_area("FillArea", 260.0, 30.0, (30.0, -26.0, 24.0),
                rotation=(math.radians(58), 0, math.radians(-40)), color="paper")
    uk.add_area("FillFront", 380.0, 36.0, (0.0, -30.0, 22.0),
                rotation=(math.radians(64), 0, 0), color="paper")
    # 宝座顶光：全片唯一动机光，保证殿心始终是视觉落点
    uk.add_area("ThroneSpot", 220.0, 6.0, (0.0, 0.0, 17.0),
                rotation=(0, 0, 0), color="gold")

    build_ground(mats)
    build_pavilions(mats, rng)
    build_throne(mats)

    template = make_fracture_template(mats, cuts=1, planes=4, seed=77)

    shards_all = 0
    for index in range(PILLARS):
        angle = index / PILLARS * math.pi * 2
        x, y = math.cos(angle) * RING_RADIUS, math.sin(angle) * RING_RADIUS
        pillar = build_pillar(mats, index, x, y)
        pillar.keyframe_insert("location", frame=HIT_FRAME - 1)
        pillar.location = (x, y, -220.0)
        pillar.keyframe_insert("location", frame=HIT_FRAME)
        shards = instantiate_shards(template, index, (x, y, 0))
        animate_shards(shards, (x, y), rng)
        shards_all += len(shards)

    for part in build_cudgel(mats):
        base_x = part.location.x
        part.location.x = base_x - 52.0
        part.keyframe_insert("location", frame=HIT_FRAME - 2)
        part.location.x = base_x + 52.0
        part.keyframe_insert("location", frame=HIT_FRAME + 3)
        uk.set_interpolation(part, "LINEAR")

    build_shockwaves(mats)
    build_dust(mats, rng)
    build_camera(scn)
    uk.log(f"scene: {PILLARS} pillars, {shards_all} shards, {len(bpy.data.objects)} objects")
    return scn, mats


def main():
    scn, _ = setup_scene()
    uk.setup_render(scn, transparent=False, samples=12, motion_blur=True, shutter=0.5,
                    bloom=True, bloom_strength=0.5, bloom_threshold=0.65,
                    frame_start=FRAME_START, frame_end=FRAME_END)
    uk.setup_freestyle(scn, thickness=2.2, crease_deg=56.0, collection="Geo")
    opts = uk.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    uk.run_common(opts, prefix=PREFIX, transparent=False, frame_end=FRAME_END,
                  build_fn=setup_scene,
                  default_still=os.path.join("out", "blender_qa", "s2_f01.png"),
                  default_frames_dir=FRAMES_DIR, mp4_out=MP4_OUT)


if __name__ == "__main__":
    main()
