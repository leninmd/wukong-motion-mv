import {AbsoluteFill, Composition, Img, registerRoot, staticFile, useCurrentFrame} from 'remotion';

/**
 * 独立入口：把 Blender 渲染的 52 帧 RGBA PNG 序列重新编码成视频（不影响 src/Root.tsx）。
 *
 * 为什么需要它：本机 Remotion 自带的 ffmpeg 7.1（compositor-win32-x64-msvc）
 * `--enable-encoder=libvpx_vp9` 可用，但它的 matroska 封装不写 VP9 alpha
 * （无 BlockAdditional / AlphaMode），`-pix_fmt yuva420p` 落盘仍是 yuv420p。
 * 2026-10-23 实测：走 Remotion 自己的 `--codec=vp9 --pixel-format=yuva420p` 也一样，
 * 因为它的 stitch 阶段复用的就是同一个 ffmpeg.exe。**要真 alpha 请用 ProRes 4444**
 * （`--codec=prores --prores-profile=4444`，或 Blender 脚本的 `--alpha-mov`）。
 *
 * 渲染命令：
 *   # 0) 先把 PNG 序列放进 public（staticFile 只认 public/ 下的文件；105 MB 默认不入 git）
 *   mkdir public/blender_renders/shot2_palace_destruction_png
 *   copy out/blender_frames/shot2/shot2_*.png public/blender_renders/shot2_palace_destruction_png/
 *   # 1) 编码
 *   npx remotion render scripts/blender_alpha_entry/index.tsx Shot2Alpha \
 *     out/shot2_from_png.webm --codec=vp9 --pixel-format=yuva420p --image-format=png
 */

const FRAME_COUNT = 52;

const Shot2Alpha: React.FC = () => {
  const frame = useCurrentFrame();
  const index = String(frame + 1).padStart(4, '0');
  return (
    <AbsoluteFill style={{backgroundColor: 'transparent'}}>
      <Img
        src={staticFile(`blender_renders/shot2_palace_destruction_png/shot2_${index}.png`)}
        style={{width: '100%', height: '100%', objectFit: 'fill'}}
      />
    </AbsoluteFill>
  );
};

const BlenderAlphaRoot: React.FC = () => (
  <Composition
    id="Shot2Alpha"
    component={Shot2Alpha}
    durationInFrames={FRAME_COUNT}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(BlenderAlphaRoot);
