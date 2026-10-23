/**
 * 真三维透视投影 —— 从 `src/_archive_dufu/canvas_engine/world3d.js` 的
 * `DFS.Camera`（《杜甫测试》第 03 幕三维水墨点云的相机）移植而来。
 *
 * 原实现只有 yaw/pitch 两个欧拉角，无法做"螺旋俯冲"；这里保留同样的
 * 透视除法 `f / z` 与屏幕坐标约定（世界 y 向上 → 屏幕 y 向下），把朝向
 * 改成由 `position → target` 构造的正交基，于是相机可以沿任意空间曲线运动，
 * 并且能带 roll（俯冲时的地平线倾斜）。
 *
 * 纯函数、无状态，逐帧可重算，满足 AGENTS.md §0 的确定性要求。
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint {
  /** 屏幕 x（px）。 */
  x: number;
  /** 屏幕 y（px）。 */
  y: number;
  /** 透视缩放：世界单位 × scale = 屏幕 px。 */
  scale: number;
  /** 相机空间深度（>0 才可见）。 */
  z: number;
}

export interface CameraOptions {
  position: Vec3;
  target: Vec3;
  /** 垂直视场角（弧度）。 */
  fov: number;
  width: number;
  height: number;
  /** 地平线滚转（弧度）。 */
  roll?: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: Vec3): Vec3 => {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return {x: a.x / len, y: a.y / len, z: a.z / len};
};

export interface Camera {
  position: Vec3;
  project: (point: Vec3) => ProjectedPoint | null;
}

export const createCamera = ({position, target, fov, width, height, roll = 0}: CameraOptions): Camera => {
  const forward = norm(sub(target, position));
  const worldUp = Math.abs(forward.y) > 0.985 ? {x: 0, y: 0, z: 1} : {x: 0, y: 1, z: 0};
  const right = norm(cross(forward, worldUp));
  const up = cross(right, forward);
  const focal = height / 2 / Math.tan(fov / 2);
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);

  return {
    position,
    project: (point) => {
      const d = sub(point, position);
      const depth = dot(d, forward);
      if (depth <= 0.06) return null;
      const camX = dot(d, right);
      const camY = dot(d, up);
      const x = camX * cosR - camY * sinR;
      const y = camX * sinR + camY * cosR;
      const scale = focal / depth;
      return {
        x: width / 2 + x * scale,
        y: height / 2 - y * scale,
        scale,
        z: depth,
      };
    },
  };
};

/** 沿椭圆轨道 + 垂直俯冲的相机位置，`t` 0→1。 */
export const diveOrbit = (
  t: number,
  opts: {
    radius: [number, number];
    height: [number, number];
    angle: [number, number];
    targetY?: number;
  },
): Vec3 => {
  const {radius, height, angle, targetY = 0} = opts;
  const e = t * t * (3 - 2 * t); // smoothstep：起步慢、中段加速、到位稳住
  const r = radius[0] + (radius[1] - radius[0]) * e;
  const a = angle[0] + (angle[1] - angle[0]) * e;
  const y = height[0] + (height[1] - height[0]) * (e ** 0.72);
  return {x: Math.cos(a) * r, y: y + targetY, z: Math.sin(a) * r};
};

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
