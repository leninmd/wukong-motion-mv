"""Shot 4 · 深渊悬签阵与四连跳切破壁（65 帧 / 不透明 MP4 / 30 fps）。

对应分镜：Sub4A/4B 225–290 帧。

  · 前 31 帧（= 225–256）：纯黑三维空间里三排随风摇摆的 3D 罪状白签，
    顶部三盏体积聚光灯把纸签打出体积光；摄像机缓慢钻入签阵。
  · 后 34 帧（= 256–290）：随【不】【敬】【权】【威】四个重拍，3D 摄像机执行
    `1.0x → 1.45x → 2.0x → 1.3x` 的跨量级跳切推进，金色刀光把白签当场劈碎，
    木片按解析弹道飞散。

技术要点：每张签拆成三块竖板，平时严丝合缝，挨刀后各自带速度与自旋飞开；
黑场是纯 `#050404`，不铺任何会抬灰的渐变（AGENTS.md §12.2）。

渲染规范走 `ukiyoe_style`：EEVEE / 1920×1080 / 30fps / Bloom / Motion Blur，
ShaderToRGB → ValToRGB(CONSTANT) 三色木刻，Freestyle 2.2px 墨线 #0A0808。

用法：
  blender -b -P scripts/blender/b_shot4_verdict_abyss.py -- --still out/blender_qa/s4_f20.png --frame 20
  blender -b -P scripts/blender/b_shot4_verdict_abyss.py -- --all --frames-dir out/blender_frames/shot4
"""

import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import ukiyoe_style as uk  # noqa: E402

uk.set_tag("shot4")

FRAME_START, FRAME_END = 1, 65
CUT_FRAMES = (32, 40, 48, 56)          # 四连跳切（对应总片 256 / 264 / 272 / 280）
CUT_SCALES = (1.0, 1.45, 2.0, 1.3)
SHOT_NAME = "b_shot4_verdict_abyss"
PREFIX = "s4_"
FRAMES_DIR = os.path.join("out", "blender_frames", "shot4")
MP4_OUT = os.path.join("public", "blender_renders", f"{SHOT_NAME}.mp4")

ROWS = (-3.4, 0.0, 3.4)                # 三排签的景深
TAGS_PER_ROW = 7
TAG_W, TAG_H, TAG_T = 1.02, 2.55, 0.075
HANG_Z = 4.35
GLYPHS = '罪名欺天妄言犯上狂徒逆夭妖猴当诛条不臣当'


def _parent_local(obj, parent):
    obj.parent = parent
    obj.matrix_parent_inverse.identity()


# --------------------------------------------------------------------------- #
# 罪状签
# --------------------------------------------------------------------------- #

def build_tag(mats, index, x, row_y, break_frame, glyph, font):
    """一张签 = 三块竖板 + 一块吊绳 + 一个墨字；原点是吊点（签顶中心）。"""
    parts = []
    third_w = TAG_W / 3.0
    for third in range(3):
        ox = -TAG_W / 2 + third_w * (third + 0.5)
        # 顶点以吊点为原点，向下为 -Z
        verts = []
        for dz in (-TAG_H, 0.0):
            for dx in (-third_w / 2 + 0.004, third_w / 2 - 0.004):
                for dy in (-TAG_T / 2, TAG_T / 2):
                    verts.append((ox + dx, dy, dz))
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4), (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)]
        board = uk.new_mesh_object(f"Tag{index}_b{third}", verts, faces, [mats["paper"]])
        board.location = (x, row_y, HANG_Z)
        parts.append(board)

    rope = uk.add_cylinder(f"Tag{index}_rope", 0.012, 1.9, (0, 0, 0), mats["ink_soft"], verts=4)
    rope.location = (x, row_y, HANG_Z + 0.95)
    parts.append(rope)

    text = uk.add_text(glyph, font=font, size=0.78, extrude=0.006,
                       location=(0.0, -TAG_T / 2 - 0.012, -TAG_H * 0.52),
                       rotation=(math.radians(90), 0, 0),
                       material=mats["ink"], name=f"Tag{index}_glyph", detail=True)
    _parent_local(text, parts[0])
    text.location = (0.0, -TAG_T / 2 - 0.012, -TAG_H * 0.52)
    text.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    return parts, text, break_frame


def animate_tags(tags, rng):
    """摇摆（吊点旋转）→ 挨刀（三块竖板按解析弹道飞散）。"""
    for board_index, (parts, text, break_frame) in enumerate(tags):
        phase = rng.uniform(0, math.pi * 2)
        swing_x = rng.uniform(0.035, 0.075)
        swing_y = rng.uniform(0.06, 0.13)
        base_locs = [p.location.copy() for p in parts]
        for frame in range(FRAME_START, FRAME_END + 1):
            sway_x = math.sin(frame * 0.28 + phase) * swing_x
            sway_y = math.sin(frame * 0.19 + phase * 1.7) * swing_y
            # 入场：落签 + 一点回弹
            if frame < 5 + (board_index % 3) * 3:
                drop = 2.4
            else:
                age = frame - (5 + (board_index % 3) * 3)
                drop = max(0.0, 1.0 - age / 6.0) * 0.5 * math.sin(min(1.0, age / 6.0) * math.pi)
            if frame < break_frame:
                for third, part in enumerate(parts):
                    part.location = (base_locs[third].x, base_locs[third].y,
                                     base_locs[third].z + drop)
                    part.rotation_euler = Euler((sway_x, sway_y, 0), "XYZ")
                    part.keyframe_insert("location", frame=frame)
                    part.keyframe_insert("rotation_euler", frame=frame)
                text.location = (0.0, -TAG_T / 2 - 0.012, -TAG_H * 0.52 - drop)
                text.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
                text.keyframe_insert("location", frame=frame)
                text.keyframe_insert("rotation_euler", frame=frame)
                text.hide_render = False
                text.keyframe_insert("hide_render", frame=frame)
            else:
                if frame == break_frame:
                    text.hide_render = True
                    text.keyframe_insert("hide_render", frame=frame)
                t = (frame - break_frame) / uk.FPS
                for third, part in enumerate(parts):
                    vx = (third - 1) * rng.uniform(2.2, 4.0) + rng.uniform(-1.4, 1.4)
                    vy = rng.uniform(-3.2, -0.6)
                    vz = rng.uniform(0.4, 3.2)
                    spin = (rng.uniform(-5, 5), rng.uniform(-5, 5), rng.uniform(-5, 5))
                    part.location = (base_locs[third].x + vx * t,
                                     base_locs[third].y + vy * t,
                                     base_locs[third].z + vz * t - 4.9 * t * t)
                    part.rotation_euler = Euler((sway_x + spin[0] * t,
                                                 sway_y + spin[1] * t,
                                                 spin[2] * t), "XYZ")
                    part.keyframe_insert("location", frame=frame)
                    part.keyframe_insert("rotation_euler", frame=frame)


def build_spotlights(mats):
    """体积聚光灯：三道柔光柱（放在签阵**之后**，不挡正面主光、不投影）。

    第一版用自发光锥体 + 260W 聚光灯，结果锥体前后两面在 alpha 混合下叠加、
    又把正面柔光挡住，整帧爆成白屏（见 EXPLORATION_LOG）。改为背光板 +
    微弱自发光，才有"黑场里一束光"的体积感。
    """
    detail = uk.ensure_collection("Detail")
    for index, row_y in enumerate(ROWS):
        shaft = uk.add_box(f"SpotShaft_{index}", (3.4, 0.02, 12.0),
                           (0.0, row_y + 1.35, 8.6), mats["veil"],
                           collection=detail)
        shaft.rotation_euler = Euler((0, 0, math.radians(-6 + index * 6)), "XYZ")
        core = uk.add_box(f"SpotCore_{index}", (0.55, 0.02, 11.0),
                          (0.0, row_y + 1.30, 8.2), mats["veil_core"],
                          collection=detail)
        core.rotation_euler = Euler((0, 0, math.radians(-6 + index * 6)), "XYZ")


def build_blade(mats):
    """金色刀光：四次跳切各出现 2 帧，横扫签阵。"""
    blade = uk.add_box("VerdictBlade", (34.0, 0.05, 0.42), (0, 0, 2.6), mats["gold_hot"],
                       collection=uk.ensure_collection("Detail"))
    core = uk.add_box("VerdictBladeCore", (34.0, 0.03, 0.12), (0, 0, 2.6), mats["paper_bright"],
                      collection=uk.ensure_collection("Detail"))
    for ob in (blade, core):
        for cut in CUT_FRAMES:
            ob.location.z = 6.2
            ob.scale = (1.0, 1.0, 0.6)
            ob.keyframe_insert("location", frame=cut - 1)
            ob.keyframe_insert("scale", frame=cut - 1)
            ob.location.z = 1.4
            ob.scale = (1.0, 1.0, 1.0)
            ob.keyframe_insert("location", frame=cut)
            ob.keyframe_insert("scale", frame=cut)
            ob.keyframe_insert("location", frame=cut + 1)
            ob.scale = (1.0, 1.0, 0.2)
            ob.keyframe_insert("scale", frame=cut + 1)
    uk.set_interpolation(blade, "LINEAR")
    uk.set_interpolation(core, "LINEAR")
    return blade


# --------------------------------------------------------------------------- #
# 相机：1.0x → 1.45x → 2.0x → 1.3x 跨量级跳切
# --------------------------------------------------------------------------- #

def phase_of(frame):
    phase = 0
    for index, cut in enumerate(CUT_FRAMES):
        if frame >= cut:
            phase = index + 1
    return phase


def build_camera(scn):
    cam = uk.make_camera("Shot4Cam", (0.0, -19.0, 2.9), (0.0, 0.0, 3.1), lens=38.0)
    base_dist = 19.0
    rolls = (0.0, -6.0, 5.0, 0.0)
    for frame in range(FRAME_START, FRAME_END + 1):
        phase = min(3, phase_of(frame))
        scale = CUT_SCALES[phase] if phase > 0 else 1.0
        phase_start = 0 if phase == 0 else CUT_FRAMES[phase - 1]
        local = (frame - phase_start) / 8.0 if phase > 0 else (frame - FRAME_START) / 31.0
        local = uk.clamp01(local)
        dist = base_dist / scale * (1.0 - 0.07 * local)
        # 轻微横移，避免四刀完全同构图
        drift = math.sin(phase * 1.7 + local * 2.2) * 0.55
        loc = (drift, -dist, 2.9 + math.sin(phase * 0.9) * 0.30)
        target = (drift * 0.3, 0.0, 3.1)
        uk.keyframe_pose(cam, frame, loc, target, roll_deg=rolls[phase], lens=38.0)
    return cam


# --------------------------------------------------------------------------- #
# 组装
# --------------------------------------------------------------------------- #

def setup_scene():
    scn = uk.reset_scene()
    mats = uk.build_standard_materials()
    mats["paper_bright"] = uk.make_glow_material("S4_PaperHot", "paper_bright", 4.5)
    mats["veil"] = uk.make_veil_material("S4_Veil", "paper", alpha=0.035, strength=0.55)
    mats["veil_core"] = uk.make_veil_material("S4_VeilCore", "gold", alpha=0.055, strength=0.9)
    mats["gold_hot"] = uk.make_glow_material("S4_GoldHot", "gold_bright", 7.0)
    font = uk.load_font()
    rng = uk.make_rng(20261023)

    uk.setup_world("ink", 0.055)
    # 正面主光必须是 Sun：Area 灯的 Watt 在 7m 外只剩 0.2 W/m²，
    # 直接掉进版画墨腔，整排签变成黑剪影（实测 v3 事故）。Sun 无距离衰减。
    uk.add_sun("TagKeySun", 2.35, rotation=(math.radians(66), 0, math.radians(4)))
    uk.add_sun("TagRimSun", 0.9, rotation=(math.radians(74), 0, math.radians(196)))

    tags = []
    index = 0
    for row_index, row_y in enumerate(ROWS):
        for slot in range(TAGS_PER_ROW):
            x = (slot - (TAGS_PER_ROW - 1) / 2) * 1.55 + (row_index - 1) * 0.28
            glyph = GLYPHS[index % len(GLYPHS)]
            # 四刀按对角线波次劈完 21 张签，每一拍都有新碎屑
            break_frame = CUT_FRAMES[(row_index + slot) % 4]
            tags.append(build_tag(mats, index, x, row_y, break_frame, glyph, font))
            index += 1

    animate_tags(tags, rng)
    build_spotlights(mats)
    build_blade(mats)
    build_camera(scn)
    uk.log(f"scene: {len(tags)} tags, {len(bpy.data.objects)} objects")
    return scn, mats


def main():
    scn, _ = setup_scene()
    uk.setup_render(scn, transparent=False, samples=16, motion_blur=True, shutter=0.5,
                    bloom=True, bloom_strength=0.6, bloom_threshold=0.55,
                    frame_start=FRAME_START, frame_end=FRAME_END)
    uk.setup_freestyle(scn, thickness=2.2, crease_deg=54.0, collection="Geo")
    opts = uk.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    uk.run_common(opts, prefix=PREFIX, transparent=False, frame_end=FRAME_END,
                  build_fn=setup_scene,
                  default_still=os.path.join("out", "blender_qa", "s4_f01.png"),
                  default_frames_dir=FRAMES_DIR, mp4_out=MP4_OUT)


if __name__ == "__main__":
    main()
