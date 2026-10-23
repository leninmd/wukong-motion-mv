"""Shot 1B · 如意金箍棒三维赤金旋风护盾（45 帧 / 透明 Alpha / 30 fps）。

对应分镜：Sub1B 30–75 帧，叠在侧身迎敌的大圣胸前（Remotion 里中心对齐双手
619,786）。这是《千本樱》式"道具特写即特效"的镜头：一根真实建模的如意金箍棒
以 35° 立体倾角高速自旋，两端盘龙金箍 + 篆书铭文在真实运动模糊下拉成赤金旋风，
火星从棍梢甩出。

技术要点（全部走 `ukiyoe_style` 规范）：
  · EEVEE + 1920x1080 + 30fps + 合成器 Bloom + 运动模糊 + 8 层滞后鬼影扇面
    （EEVEE 原生运动模糊对"父级驱动子物体"的采样不足，所以用真实几何做长曝光；
      两根手段叠加，扇面才是实心旋风而不是一根静止的棍）；
  · ShaderToRGB → ValToRGB(CONSTANT) 三色木刻：墨黑 / 朱砂 / 宣纸 + 赤金高光；
  · Freestyle 2.2px 墨线 #0A0808，只对 Geo 集合生效（火星/铭文/鬼影不勾线）；
  · film_transparent=True，PNG RGBA → VP9 yuva420p 真透明 WebM。

用法：
  blender -b -P scripts/blender/b_shot1_cudgel_shield.py -- --preview out/blender_qa/s1.png
  blender -b -P scripts/blender/b_shot1_cudgel_shield.py -- --still out/blender_qa/s1_f20.png --frame 20
  blender -b -P scripts/blender/b_shot1_cudgel_shield.py -- --all --frames-dir out/blender_frames/shot1
  blender -b -P scripts/blender/b_shot1_cudgel_shield.py -- --encode-webm public/blender_renders/b_shot1_cudgel_shield.webm
"""

import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import ukiyoe_style as uk  # noqa: E402

uk.set_tag("shot1")

FRAME_START, FRAME_END = 1, 45
SHOT_NAME = "b_shot1_cudgel_shield"
PREFIX = "s1_"
FRAMES_DIR = os.path.join("out", "blender_frames", "shot1")
WEBM_OUT = os.path.join("public", "blender_renders", f"{SHOT_NAME}.webm")

STAFF_HALF = 2.30          # 棍半长（世界单位）
STAFF_RADIUS = 0.145
SPIN_DEG_PER_FRAME = 30.0  # 每帧 30° → 45 帧 3.7 圈
TILT_DEG = 35.0            # 规范要求的 35° 立体倾角
PLANE_ROLL_DEG = -25.0     # 与 1B 的斜向椭圆同角度
GHOST_COUNT = 12           # 运动模糊扇面的滞后鬼影层数
GHOST_STEP_DEG = 1.15      # 每层滞后角（12 层 → 13.8° 扇面，读成高速旋转而非静止道具）


# --------------------------------------------------------------------------- #
# 骨架
# --------------------------------------------------------------------------- #

def _parent_local(obj, parent):
    """父子关系按"父空间局部坐标"处理：所有零件都以棍轴局部坐标建模。"""
    obj.parent = parent
    obj.matrix_parent_inverse.identity()


def build_rig():
    root = bpy.data.objects.new("RigRoot", None)
    root.empty_display_size = 0.4
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = Euler((0.0, 0.0, math.radians(PLANE_ROLL_DEG)), "XYZ")

    tilt = bpy.data.objects.new("RigTilt", None)
    tilt.empty_display_size = 0.3
    bpy.context.scene.collection.objects.link(tilt)
    tilt.parent = root
    tilt.rotation_euler = Euler((math.radians(TILT_DEG), 0.0, 0.0), "XYZ")

    rotor = bpy.data.objects.new("Rotor", None)
    rotor.empty_display_size = 0.3
    bpy.context.scene.collection.objects.link(rotor)
    rotor.parent = tilt
    rotor.rotation_mode = "XYZ"

    ghosts = []
    for index in range(GHOST_COUNT):
        ghost = bpy.data.objects.new(f"GhostRotor_{index}", None)
        ghost.empty_display_size = 0.2
        bpy.context.scene.collection.objects.link(ghost)
        ghost.parent = tilt
        ghost.rotation_mode = "XYZ"
        ghost.empty_display_size = 0.1
        ghosts.append(ghost)
    return root, tilt, rotor, ghosts


def _animate_spin(obj, offset_deg: float):
    obj.rotation_euler[2] = math.radians(offset_deg)
    obj.keyframe_insert("rotation_euler", frame=FRAME_START)
    obj.rotation_euler[2] = math.radians(offset_deg + SPIN_DEG_PER_FRAME * (FRAME_END - FRAME_START))
    obj.keyframe_insert("rotation_euler", frame=FRAME_END)
    uk.set_interpolation(obj, "LINEAR")


# --------------------------------------------------------------------------- #
# 真实金箍棒
# --------------------------------------------------------------------------- #

def _staff_core(mats, rotor, ghost=False, collection=None):
    """棍身 + 握把；ghost=True 时用低模（鬼影只需要剪影）。"""
    bm = bmesh.new()
    segments = 7 if ghost else 10
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=STAFF_RADIUS, radius2=STAFF_RADIUS,
                          depth=STAFF_HALF * 2)
    for v in bm.verts:
        v.co = Vector((v.co.z, v.co.x, v.co.y))
    mat = mats["smear"] if ghost else mats["cinnabar"]
    shaft = uk.mesh_from_bmesh("Staff_Shaft" if not ghost else "GhostShaft", bm, [mat],
                      collection=collection)
    _parent_local(shaft, rotor)
    parts = [shaft]
    if not ghost:
        for index in range(9):
            x = -0.62 + index * 0.155
            ring = uk.add_torus(f"Grip_{index}", STAFF_RADIUS + 0.016, 0.016,
                                (x, 0, 0), mats["ink"],
                                rotation=(0, math.radians(90), 0),
                                major_segments=10, minor_segments=5)
            _parent_local(ring, rotor)
            parts.append(ring)
    return parts


def _dragon_bands(mats, rotor, ghost=False, collection=None):
    parts = []
    for end in (-1, 1):
        x0 = end * (STAFF_HALF - 0.34)
        for index, offset in enumerate((-0.20, 0.0, 0.20)):
            major = STAFF_RADIUS + 0.085 - abs(offset) * 0.12
            band = uk.add_torus(f"Band_{end}_{index}", major, 0.055 if not ghost else 0.045,
                                (x0 + end * offset, 0, 0),
                                mats["smear"] if ghost else mats["gold"],
                                rotation=(0, math.radians(90), 0),
                                major_segments=8 if ghost else 22,
                                minor_segments=4 if ghost else 8)
            _parent_local(band, rotor)
            parts.append(band)
        if ghost:
            continue
        for index in range(2):
            line = uk.add_torus(f"BandLine_{end}_{index}", STAFF_RADIUS + 0.155,
                                0.012, (x0 - 0.11 + index * 0.22, 0, 0), mats["gold_hot"],
                                rotation=(0, math.radians(90), 0),
                                major_segments=20, minor_segments=4)
            _parent_local(line, rotor)
            parts.append(line)

        # 盘龙浮雕：13 节身体沿螺旋绕箍
        for index in range(13):
            t = index / 12.0
            theta = t * math.pi * 1.75 * end
            radius = STAFF_RADIUS + 0.10 + math.sin(t * math.pi) * 0.035
            px = x0 + end * (-0.34 + t * 0.62)
            seg = uk.add_ico(f"Dragon_{end}_{index}", 0.040 + 0.026 * math.sin(t * math.pi),
                             (px, math.cos(theta) * radius, math.sin(theta) * radius),
                             mats["gold"], subdiv=1)
            _parent_local(seg, rotor)
            parts.append(seg)
        head = uk.add_ico(f"DragonHead_{end}", 0.078,
                          (x0 + end * 0.40, 0.0, STAFF_RADIUS + 0.10), mats["gold"], subdiv=1)
        _parent_local(head, rotor)
        parts.append(head)
        for horn in (-1, 1):
            h = uk.add_cylinder(f"DragonHorn_{end}_{horn}", 0.014, 0.16,
                                (x0 + end * 0.46, horn * 0.045, STAFF_RADIUS + 0.19),
                                mats["gold_hot"], rotation=(0, math.radians(58), 0), verts=5)
            _parent_local(h, rotor)
            parts.append(h)
        for whisker in (-1, 1):
            w = uk.add_cylinder(f"Whisker_{end}_{whisker}", 0.008, 0.38,
                                (x0 + end * 0.60, whisker * 0.055, STAFF_RADIUS + 0.02),
                                mats["gold_hot"], rotation=(0, math.radians(78), 0), verts=4)
            _parent_local(w, rotor)
            parts.append(w)
    return parts


def build_staff(mats, rotor, ghosts):
    parts = _staff_core(mats, rotor) + _dragon_bands(mats, rotor)
    _animate_spin(rotor, 0.0)
    # 8 层滞后鬼影：真实长曝光扇面
    for index, ghost in enumerate(ghosts):
        _staff_core(mats, ghost, ghost=True)
        _dragon_bands(mats, ghost, ghost=True)
        _animate_spin(ghost, -(index + 1) * GHOST_STEP_DEG)
    return parts


def build_inscriptions(mats, rotor):
    """篆书铭文：四个方向的金牌，贴着棍身。Detail 集合，不参与勾线。"""
    font = uk.load_font()
    labels = ["如意", "金箍", "千钧", "定海"]
    for index, label in enumerate(labels):
        theta = index * math.pi / 2
        for end in (-1, 1):
            x = end * (STAFF_HALF - 0.92)
            py = math.cos(theta) * (STAFF_RADIUS + 0.012)
            pz = math.sin(theta) * (STAFF_RADIUS + 0.012)
            plaque = uk.add_box(f"Plaque_{end}_{index}", (0.34, 0.012, 0.125),
                                (x, py, pz), mats["ink_plaque"],
                                rotation=(theta, 0, 0))
            _parent_local(plaque, rotor)
            text = uk.add_text(
                label, font=font, size=0.056, extrude=0.004,
                location=(x, py * 1.22, pz * 1.22),
                rotation=(theta - math.pi / 2, 0, 0),
                material=mats["gold_text"], name=f"Insc_{end}_{index}",
            )
            _parent_local(text, rotor)


def build_shield_arcs(mats, tilt):
    """赤金旋风护盾骨架：三道**断裂**开口弧带 + 24 道径向速度线 + 12 根外缘金齿。

    整圆环会读成"呼啦圈"，所以每一道弧都只占 60°–150°，并且用不同的角速度
    反向对绞，形成《千本樱》那种高速旋转的能量盾。
    """
    parts = []
    detail = uk.ensure_collection("Detail")
    arcs = (
        (2.78, 0.062, math.radians(18), math.radians(168), 0.0, -210.0),
        (2.98, 0.052, math.radians(132), math.radians(258), 0.0, 260.0),
        (2.58, 0.048, math.radians(224), math.radians(322), 0.0, -330.0),
        (3.16, 0.040, math.radians(300), math.radians(356), 0.0, 180.0),
    )
    for index, (radius, minor, t0, t1, offset, delta) in enumerate(arcs):
        # 能量环是自发光环纹，走 Detail 不勾线，否则细环会被 2.2px 墨线吃掉变成黑圈
        arc = uk.add_arc_ring(f"ShieldArc_{index}", radius, minor, t0, t1, (0, 0, 0),
                              mats["gold"] if index % 2 == 0 else mats["gold_hot"],
                              segments=36, minor_segments=5, collection=detail)
        _parent_local(arc, tilt)
        arc.rotation_mode = "XYZ"
        arc.rotation_euler[2] = math.radians(offset)
        arc.keyframe_insert("rotation_euler", frame=FRAME_START)
        arc.rotation_euler[2] = math.radians(offset + delta)
        arc.keyframe_insert("rotation_euler", frame=FRAME_END)
        uk.set_interpolation(arc, "LINEAR")
        parts.append(arc)

    # 径向速度线：从棍梢向外的赤金刀风（细长金条不勾线，否则变成一圈黑刺）
    for index in range(24):
        theta = index / 24 * math.pi * 2
        inner = 2.30 + (index % 3) * 0.09
        outer = 3.02 + (index % 4) * 0.07
        mid = (inner + outer) / 2
        streak = uk.add_box(f"Streak_{index}", (outer - inner, 0.022, 0.010),
                            (math.cos(theta) * mid, math.sin(theta) * mid, 0.0),
                            mats["gold_hot"] if index % 3 == 0 else mats["gold_dim"],
                            rotation=(0, 0, theta), collection=detail)
        _parent_local(streak, tilt)
        parts.append(streak)

    for index in range(12):
        theta = index / 12 * math.pi * 2
        tooth = uk.add_box(f"Tooth_{index}", (0.22, 0.036, 0.036),
                           (math.cos(theta) * 3.26, math.sin(theta) * 3.26, 0.0),
                           mats["gold_hot"],
                           rotation=(0, 0, theta), collection=detail)
        _parent_local(tooth, tilt)
        parts.append(tooth)
    return parts


def build_wind_arcs(mats, rotor):
    """旋风拖尾：7 道随棍同速旋转的赤金弧带，填满盘面成为"风"而不是"一根棍"。

    这些弧带是真实几何（不是贴图），放在 Detail 集合不勾线，靠颜色与重叠
    读成高速旋转留下的风痕；没有它们，盘面中间会是一个空洞的白圆。
    """
    detail = uk.ensure_collection("Detail")
    parts = []
    specs = (
        (2.42, 0.085, math.radians(96), -26.0),
        (2.10, 0.075, math.radians(78), -31.0),
        (1.78, 0.062, math.radians(64), -36.0),
        (1.46, 0.050, math.radians(52), -41.0),
        (1.14, 0.040, math.radians(42), -46.0),
        (0.84, 0.032, math.radians(32), -52.0),
        (0.56, 0.024, math.radians(24), -58.0),
    )
    for index, (radius, minor, span, lead) in enumerate(specs):
        start = lead - math.degrees(span)
        arc = uk.add_arc_ring(
            f"WindArc_{index}", radius, minor,
            math.radians(start), math.radians(lead), (0, 0, 0),
            mats["gold"] if index % 3 == 0 else mats["smear"],
            segments=18, minor_segments=4, collection=detail,
        )
        _parent_local(arc, rotor)
        parts.append(arc)
    return parts


def build_sparks(mats, tilt, rng):
    """棍梢甩出的火星与断箭：解析式弹道，逐帧关键帧（确定性）。"""
    sparks = []
    detail = uk.ensure_collection("Detail")
    for index in range(96):
        birth = rng.randint(1, FRAME_END - 6)
        side = -1 if index % 2 == 0 else 1
        theta = rng.uniform(0, math.pi * 2)
        speed = rng.uniform(2.6, 7.4)
        up = rng.uniform(1.2, 5.4)
        life = rng.randint(10, 26)
        radius = rng.uniform(0.020, 0.056)
        mat = mats["gold_hot"] if index % 5 == 0 else mats["gold"]
        spark = uk.add_ico(f"Spark_{index:03d}", radius, (0, 0, 0), mat, subdiv=1,
                           collection=detail)
        _parent_local(spark, tilt)
        life_scale = rng.uniform(0.6, 1.2)
        for frame in range(FRAME_START, FRAME_END + 1):
            age = frame - birth
            if age < 0 or age > life:
                spark.location = Vector((0, 0, -60))
                spark.keyframe_insert("location", frame=frame)
                continue
            t = age / uk.FPS
            spin = math.radians(SPIN_DEG_PER_FRAME * (birth - 1))
            tip_x = side * STAFF_HALF * math.cos(spin)
            tip_y = side * STAFF_HALF * math.sin(spin)
            vx = math.cos(theta) * speed + side * math.cos(spin + 1.2) * 2.2
            vy = math.sin(theta) * speed + side * math.sin(spin + 1.2) * 2.2
            spark.location = Vector((tip_x + vx * t, tip_y + vy * t,
                                     up * t - 4.9 * t * t))
            spark.keyframe_insert("location", frame=frame)
            fade = 1.0 if age < life * 0.6 else 0.5
            spark.scale = (fade * life_scale, fade * life_scale, fade * life_scale)
        sparks.append(spark)

    for index in range(10):
        birth = 3 + index * 4
        side = -1 if index % 2 == 0 else 1
        angle = rng.uniform(0, math.pi * 2)
        speed = rng.uniform(3.4, 6.0)
        arrow = uk.add_cylinder(f"Arrow_{index}", 0.018, 0.34, (0, 0, 0),
                                mats["paper"], verts=4, collection=detail)
        head = uk.add_cylinder(f"ArrowHead_{index}", 0.032, 0.10, (0, 0, 0),
                               mats["gold"], verts=4, collection=detail)
        head.parent = arrow
        head.location = (0, 0.22, 0)
        _parent_local(arrow, tilt)
        for frame in range(FRAME_START, FRAME_END + 1):
            age = frame - birth
            if age < 0 or age > 40:
                arrow.location = Vector((0, 0, -60))
                arrow.keyframe_insert("location", frame=frame)
                continue
            t = age / uk.FPS
            spin = math.radians(SPIN_DEG_PER_FRAME * (birth - 1))
            arrow.location = Vector((side * STAFF_HALF * math.cos(spin) + math.cos(angle) * speed * t,
                                     side * STAFF_HALF * math.sin(spin) + math.sin(angle) * speed * t,
                                     1.4 * t - 4.9 * t * t))
            arrow.rotation_euler = Euler((0, 0, angle), "XYZ")
            arrow.keyframe_insert("location", frame=frame)
            arrow.keyframe_insert("rotation_euler", frame=frame)
        sparks.append(arrow)
    return sparks


def setup_scene():
    scn = uk.reset_scene()
    materials = uk.build_standard_materials()
    materials["ink_plaque"] = uk.make_toon_material(
        "S1_Plaque", "ink_soft", mid_pos=0.55, light_pos=0.9, rim=0.0, base=0.25)
    materials["gold_text"] = uk.make_glow_material("S1_GoldText", "gold_bright", 2.8)
    materials["smear"] = uk.make_ghost_material("S1_Smear", "cinnabar", alpha=0.20, strength=1.5)

    uk.setup_world("ink_deep", 0.03)
    uk.add_sun("KeySun", 1.55, rotation=(math.radians(58), 0, math.radians(-42)))
    uk.add_area("RimArea", 70.0, 6.0, (0.0, 1.2, 4.6), rotation=(math.radians(-14), 0, 0),
                color="gold")
    uk.add_area("FillArea", 22.0, 8.0, (-3.2, -3.0, 2.2),
                rotation=(math.radians(62), 0, math.radians(-40)), color="paper")

    root, tilt, rotor, ghosts = build_rig()
    build_staff(materials, rotor, ghosts)
    build_inscriptions(materials, rotor)
    build_shield_arcs(materials, tilt)

    rng = uk.make_rng(20261023)
    build_sparks(materials, tilt, rng)

    cam = uk.make_camera("Shot1Cam", (0.0, -14.2, 7.4), (0.0, 0.0, 0.0), lens=52.0)
    scn.camera = cam
    return scn, materials


def main():
    scn, _ = setup_scene()
    uk.setup_render(scn, transparent=True, samples=20, motion_blur=True, shutter=0.8,
                    bloom=True, bloom_strength=0.5, bloom_threshold=0.55,
                    frame_start=FRAME_START, frame_end=FRAME_END)
    uk.setup_freestyle(scn, thickness=2.2, crease_deg=54.0, collection="Geo")
    opts = uk.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    uk.run_common(opts, prefix=PREFIX, transparent=True, frame_end=FRAME_END,
                  build_fn=setup_scene,
                  default_still=os.path.join("out", "blender_qa", "s1_f01.png"),
                  default_frames_dir=FRAMES_DIR, webm_out=WEBM_OUT)


if __name__ == "__main__":
    main()
