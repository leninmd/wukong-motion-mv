import {hash, rng} from '../utils/math';

/**
 * 3D dust / ink point cloud extracted from the original `RidgeCloud` and
 * `TypeField` projection code. Coordinates are camera-space world units, not
 * pre-projected pixels, so the same cloud can be re-cammed at any resolution.
 */
export interface CloudParticle {
  x: number;
  y: number;
  z: number;
  radius: number;
  phase: number;
  warmth: number;
  spark: boolean;
}

export interface PointCloudOptions {
  count?: number;
  seed?: number;
  /** Horizontal world extent. */
  spread?: number;
  /** Vertical compression. A flat cloud reads as a nebula, not a snowball. */
  flatten?: number;
  /** Number of spiral arms. */
  arms?: number;
}

export interface Camera3D {
  width: number;
  height: number;
  yaw: number;
  pitch: number;
  distance: number;
  fov: number;
  centerX?: number;
  centerY?: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
  depth: number;
}

/**
 * Spiral accretion disc with a sparse outer halo. The original used a ridge
 * height field; this keeps the same deterministic, pure-function contract while
 * giving Wukong's furnace embers a rotational silhouette.
 */
export const createPointCloud = ({
  count = 2600,
  seed = 60613,
  spread = 3.4,
  flatten = 0.34,
  arms = 3,
}: PointCloudOptions = {}): CloudParticle[] => {
  const random = rng(seed);
  const points: CloudParticle[] = [];

  for (let index = 0; index < count; index += 1) {
    const isHalo = index % 9 === 0;
    const radial = isHalo
      ? spread * (0.92 + random() * 0.5)
      : spread * Math.pow(random(), 0.58);
    const arm = index % arms;
    const spin = (arm / arms) * Math.PI * 2;
    const angle =
      spin +
      radial / spread * (5.4 + random() * 0.9) +
      (random() - 0.5) * (isHalo ? 1.6 : 0.44);
    const thickness = (random() - 0.5) * (isHalo ? 1.1 : 0.5);

    points.push({
      x: Math.cos(angle) * radial + (random() - 0.5) * 0.22,
      y: thickness * flatten * (0.4 + radial / spread) - radial * 0.035,
      z: Math.sin(angle) * radial * 0.72 + (random() - 0.5) * 0.22,
      radius: 0.0035 + random() * (isHalo ? 0.009 : 0.013),
      phase: random() * Math.PI * 2,
      warmth: random(),
      spark: !isHalo && hash(seed + 19, index) > 0.91,
    });
  }

  return points;
};

export const projectPoint3D = (
  point: {x: number; y: number; z: number},
  camera: Camera3D,
): ProjectedPoint | null => {
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const dz = point.z + camera.distance;

  const x1 = point.x * cosYaw - dz * sinYaw;
  const z1 = point.x * sinYaw + dz * cosYaw;
  const y1 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;

  if (z2 <= 0.2) return null;

  const focal = camera.height / 2 / Math.tan(camera.fov / 2);
  const scale = focal / z2;
  return {
    x: (camera.centerX ?? camera.width / 2) + x1 * scale,
    y: (camera.centerY ?? camera.height / 2) - y1 * scale,
    scale,
    depth: z2,
  };
};
