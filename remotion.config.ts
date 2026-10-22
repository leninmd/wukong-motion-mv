import {Config} from '@remotion/cli/config';

/**
 * 工程级 Remotion 配置。
 * - PNG 序列可保留 OffthreadVideo 透明通道合成后的边缘质量；
 * - 音频/视频最终由 CLI 参数决定，避免配置与调用方互相覆盖。
 */
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
