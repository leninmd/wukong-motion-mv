"""Shot 3 · 五指山巨岩与八条实体铁索（75 帧 / 透明 Alpha / 30 fps）。

对应分镜：Sub3A/3B 150–225 帧，叠在五指山场景之上。复刻《千本樱》01:06 的
"牢笼下砸"：五座刻满发光梵文的棱角巨岩从画面顶部轰然砸落，八条粗壮的 3D
实体环扣铁索从四面八方高速射入、在镜头前交叉绷紧并剧烈震颤。

V8 的关键判断：原版这一段是静态壁纸 + 2D 铁索，呆板感的根源是"没有真三维的
重量"。这里每一节索环都是 torus 真几何，铁索按 3 段拼接、每段有独立入场延迟，
所以拉进来的时候会像鞭子一样抖；巨岩是 bmesh 生成的棱柱，落地带震屏与火星。

渲染规范走 `ukiyoe_style`：EEVEE / 1920×1080 / 30fps / Bloom / Motion Blur，
ShaderToRGB → ValToRGB(CONSTANT) 三色木刻，Freestyle 2.2px 墨线 #0A0808。
film_transparent=True → PNG RGBA → ProRes 4444 `.mov`（真 Alpha）。

用法：
  blender -b -P scripts/blender/b_shot3_mountain_chains.py -- --still out/blender_qa/s3_f20.png --frame 20
  blender -b -P scripts/blender/b_shot3_mountain_chains.py -- --all --frames-dir out/blender_frames/shot3
"""

import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Euler, Matrix, Vector  # noqa: E402

import ukiyoe_style as uk  # noqa: E402

uk.set_tag("shot3")

FRAME_START, FRAME_END = 1, 75
SHOT_NAME = "b_shot3_mountain_chains"
PREFIX = "s3_"
FRAMES_DIR = os.path.join("out", "blender_frames", "shot3")
WEBM_OUT = os.path.join("public", "blender_renders", f"{SHOT_NAME}.webm")

# 五座巨岩：x / 底面 z / 高度 / 落点帧 / 种子
ROCKS = (
    (-9.6, 9.0, 7.4, 5, 11),
    (-5.1, 7.4, 8.6, 7, 23),
    (0.2, 8.4, 9.4, 9, 37),
    (5.4, 7.4, 8.2, 6, 41),
    (9.7, 9.0, 7.0, 8, 53),
)

# 八条铁索：起点 / 终点（世界坐标，相机在 y=-17 附近）
CHAINS = (
    ((-15.0, -4.0, 1.6), (15.0, 1.0, 8.8)),
    ((15.0, -3.0, 0.8), (-14.0, 1.2, 9.2)),
    ((-16.0, 3.0, 10.0), (13.0, -2.0, 0.6)),
    ((16.0, 4.0, 10.6), (-13.0, -2.2, 0.4)),
    ((-11.0, -9.0, -0.6), (9.0, 0.5, 11.0)),
    ((11.0, -9.0, -0.6), (-9.0, 0.5, 11.0)),
    ((-17.0, -0.5, 9.6), (17.0, -0.5, 9.9)),
    ((-17.0, -0.5, 1.0), (17.0, -0.5, 1.4)),
)


def _parent_local(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse.identity()


# --------------------------------------------------------------------------- #
# 巨岩 + 梵文
# --------------------------------------------------------------------------- #

def build_rocks(mats):
    font = uk.load_font()
    rocks = []
    for index, (x, base_z, height, land, seed) in enumerate(ROCKS):
        rock = uk.jagged_rock(f"Rock_{index}", radius=2.15 + (index % 3) * 0.18,
                              height=height, sides=6, seed=seed, material=mats["stone"],
                              center=(x, (index % 2) * 1.2 - 0.4, base_z))
        rock.rotation_euler = Euler((0, 0, math.radians(seed % 40)), "XYZ")
        # 梵文（六字真言）：两列竖排，贴岩面，Detail 集合不勾线
        runes = ("嗡嘛呢", "叭咪吽")
        for column, text in enumerate(runes):
            objs = uk.add_vertical_text(
                text, font=font, size=0.46, gap=0.52,
                location=(0.0, -2.85 - column * 0.02, height * 0.42 - column * 1.55),
                rotation=(math.radians(90), 0, 0),
                material=mats["gold_text"], name=f"Rune_{index}_{column}",
            )
            for ob in objs:
                _parent_local(ob, rock)
        # 落点前的悬浮阴影：一块压在地面的暗色岩影（落地瞬间消失）
        rocks.append((rock, base_z, land, height))
    return rocks


def animate_rocks(rocks, scn):
    for index, (rock, base_z, land, height) in enumerate(rocks):
        start_z = base_z + 26.0 + index * 1.2
        # 下落：解析式自由落体，落地后一次性回弹 0.35
        for frame in range(FRAME_START, FRAME_END + 1):
            if frame < land - 7:
                z = start_z
            elif frame <= land:
                t = (frame - (land - 7)) / 7.0
                z = start_z + (base_z - start_z) * (t * t)
            else:
                bounce = max(0.0, 1.0 - (frame - land) / 3.0)
                z = base_z + math.sin(bounce * math.pi) * 0.42
            rock.location.z = z
            rock.rotation_euler.z = math.radians((index * 37) % 90) + (start_z - z) * 0.05
            rock.keyframe_insert("location", frame=frame)
            rock.keyframe_insert("rotation_euler", frame=frame)


# --------------------------------------------------------------------------- #
# 铁索（环扣）
# --------------------------------------------------------------------------- #

def path_point(p0, p1, t, sag):
    point = p0.lerp(p1, t)
    point.z -= math.sin(t * math.pi) * sag
    return point


def build_chain(mats, index, p0, p1, sag=0.55):
    """一条铁索：环环相扣的 torus 沿路径排布，分 3 段 join 以保留鞭状延迟。"""
    p0, p1 = Vector(p0), Vector(p1)
    length = (p1 - p0).length
    link_major = 0.44
    spacing = 0.62
    count = max(10, int(length / spacing))
    segments = 3
    per_segment = math.ceil(count / segments)
    groups = [[] for _ in range(segments)]
    for i in range(count):
        t = i / max(1, count - 1)
        pos = path_point(p0, p1, t, sag)
        ahead = path_point(p0, p1, min(1.0, t + 0.02), sag)
        behind = path_point(p0, p1, max(0.0, t - 0.02), sag)
        tangent = (ahead - behind).normalized()
        side = tangent.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = tangent.cross(Vector((0, 1, 0)))
        side.normalize()
        normal = side if i % 2 == 0 else tangent.cross(side).normalized()
        rot = normal.to_track_quat("Z", "Y").to_euler()
        link = uk.add_torus(f"C{index}_{i:02d}", link_major, 0.105, pos,
                            mats["ink_metal"], rotation=rot,
                            major_segments=14, minor_segments=6)
        groups[min(segments - 1, i // per_segment)].append(link)
    joined = []
    for seg_index, group in enumerate(groups):
        if not group:
            continue
        ob = uk.join_objects(group, f"Chain_{index}_{seg_index}")
        ob["entry_dir"] = list((p1 - p0).normalized())
        ob["delay"] = seg_index * 2.2
        joined.append(ob)
    return joined


def animate_chains(chains, rng):
    for chain_index, (segments, direction) in enumerate(chains):
        for seg_index, ob in enumerate(segments):
            base_loc = ob.location.copy() if ob.location.length > 1e-6 else Vector((0, 0, 0))
            delay = seg_index * 2.0 + chain_index * 0.15
            for frame in range(FRAME_START, FRAME_END + 1):
                t = uk.clamp01((frame - 2 - delay) / 9.0)
                ease = uk.ease_out_cubic(t)
                travel = (1.0 - ease) * 26.0
                jitter = Vector((0, 0, 0))
                if t >= 1.0:
                    amp = 0.045 + 0.02 * math.sin(frame * 0.7 + chain_index)
                    jitter = Vector((math.sin(frame * 2.1 + chain_index) * amp,
                                     math.cos(frame * 2.7 + seg_index) * amp,
                                     math.sin(frame * 3.3 + chain_index) * amp * 1.6))
                ob.location = base_loc - direction * travel + jitter
                ob.keyframe_insert("location", frame=frame)


# --------------------------------------------------------------------------- #
# 落地火星 / 碎石
# --------------------------------------------------------------------------- #

def build_impact_fx(mats, rng):
    detail = uk.ensure_collection("Detail")
    for index, (x, base_z, height, land, seed) in enumerate(ROCKS):
        for spark in range(16):
            angle = rng.uniform(0, math.pi * 2)
            speed = rng.uniform(3.0, 9.0)
            up = rng.uniform(2.0, 7.0)
            life = rng.randint(12, 26)
            ob = uk.add_ico(f"ImpactSpark_{index}_{spark}", rng.uniform(0.05, 0.13),
                            (0, 0, -60), mats["gold_hot"] if spark % 4 == 0 else mats["gold"],
                            subdiv=1, collection=detail)
            x0 = x + math.cos(angle) * 1.6
            y0 = (index % 2) * 1.2 - 0.4 + math.sin(angle) * 1.6
            z0 = base_z + 0.3
            for frame in range(FRAME_START, FRAME_END + 1):
                age = frame - land
                if age < 0 or age > life:
                    ob.location = (0, 0, -60)
                    ob.keyframe_insert("location", frame=frame)
                    continue
                t = age / uk.FPS
                ob.location = (x0 + math.cos(angle) * speed * t,
                               y0 + math.sin(angle) * speed * t,
                               z0 + up * t - 5.2 * t * t)
                ob.keyframe_insert("location", frame=frame)


# --------------------------------------------------------------------------- #
# 相机
# --------------------------------------------------------------------------- #

def build_camera(scn):
    cam = uk.make_camera("Shot3Cam", (0.0, -22.0, 4.2), (0.0, 0.0, 6.4), lens=32.0)
    for frame in range(FRAME_START, FRAME_END + 1):
        t = (frame - FRAME_START) / (FRAME_END - FRAME_START)
        push = uk.ease_in_out(t)
        loc = (0.0 + math.sin(t * 2.2) * 0.9, -22.0 + push * 3.8, 4.2 + push * 0.9)
        target = (0.0, 0.0, 6.4 - push * 0.4)
        # 五块岩落地的震屏
        shake = 0.0
        for _x, _z, _h, land, _seed in ROCKS:
            age = (frame - land) / uk.FPS
            if 0.0 <= age < 0.55:
                shake += math.exp(-age * 9.0) * 0.5
        loc = (loc[0] + math.sin(frame * 2.9) * shake,
               loc[1],
               loc[2] + math.cos(frame * 3.7) * shake)
        roll = math.sin(frame * 0.9) * 1.4 + math.sin(frame * 4.1) * shake * 4.0
        uk.keyframe_pose(cam, frame, loc, target, roll_deg=roll, lens=32.0 + push * 3.0)
    return cam


# --------------------------------------------------------------------------- #
# 组装
# --------------------------------------------------------------------------- #

def setup_scene():
    scn = uk.reset_scene()
    mats = uk.build_standard_materials()
    mats["gold_text"] = uk.make_glow_material("S3_GoldText", "gold_bright", 3.4)
    mats["ink_metal"] = uk.make_toon_material("S3_InkMetal", "ink_soft", mid_pos=0.40,
                                              light_pos=0.72, rim=0.20, base=0.55)
    rng = uk.make_rng(20261023)

    uk.setup_world("ink_deep", 0.04)
    uk.add_sun("KeySun", 2.2, rotation=(math.radians(62), 0, math.radians(-34)))
    uk.add_area("RimArea", 150.0, 10.0, (-6.0, 6.0, 14.0),
                rotation=(math.radians(-40), 0, 0), color="gold")
    uk.add_area("FillArea", 60.0, 12.0, (8.0, -12.0, 9.0),
                rotation=(math.radians(58), 0, math.radians(28)), color="paper")

    rocks = build_rocks(mats)
    animate_rocks(rocks, scn)
    build_impact_fx(mats, rng)

    chains = []
    for index, (p0, p1) in enumerate(CHAINS):
        segments = build_chain(mats, index, p0, p1, sag=0.35 + (index % 3) * 0.25)
        direction = (Vector(p1) - Vector(p0)).normalized()
        chains.append((segments, direction))
    animate_chains(chains, rng)

    build_camera(scn)
    uk.log(f"scene: {len(rocks)} rocks, {sum(len(c[0]) for c in chains)} chain segments, "
           f"{len(bpy.data.objects)} objects")
    return scn, mats


def main():
    scn, _ = setup_scene()
    uk.setup_render(scn, transparent=True, samples=20, motion_blur=True, shutter=0.6,
                    bloom=True, bloom_strength=0.55, bloom_threshold=0.6,
                    frame_start=FRAME_START, frame_end=FRAME_END)
    uk.setup_freestyle(scn, thickness=2.2, crease_deg=52.0, collection="Geo")
    opts = uk.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    uk.run_common(opts, prefix=PREFIX, transparent=True, frame_end=FRAME_END,
                  build_fn=setup_scene,
                  default_still=os.path.join("out", "blender_qa", "s3_f01.png"),
                  default_frames_dir=FRAMES_DIR, webm_out=WEBM_OUT)


if __name__ == "__main__":
    main()
