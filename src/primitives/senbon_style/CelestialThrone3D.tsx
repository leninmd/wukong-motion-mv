import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Edges, Outlines} from '@react-three/drei';
import {useThree} from '@react-three/fiber';
import {Bloom, EffectComposer} from '@react-three/postprocessing';
import * as THREE from 'three';
import {clamp, hash} from '../../utils/math';

/**
 * `<CelestialThrone3D />` —— V6 的 Sub2B 真 WebGL 凌霄殿崩裂。
 *
 * V5 用 2D Canvas 手写透视投影，36 根柱子只有侧面 + 柱头/柱础，读起来像灰色
 * 下水管。V6 直接用 `@remotion/three`（React Three Fiber）+ 组合几何体：
 *
 *   · 36 根八棱柱 = 柱础（cylinder）+ 柱身（三段 cylinder，可断裂）+ 斗拱（三层 box）
 *   · `meshToonMaterial` + drei `<Outlines thickness={0.03} color="#0A0808" />`
 *     得到真正的三渲二硬描边
 *   · `@react-three/postprocessing` 的 `<Bloom luminanceThreshold={0.25}
 *     intensity={2.0} mipmapBlur />` 让柱身盘龙金环、刀光、断裂口真正发光
 *   · 112 帧的斜向刀光是世界空间里的发光面片，配合 400 颗确定性粒子刀光
 *   · 碎块用 `p = p0 + v·t + ½g·t²` 解析解，不做逐帧积分（Remotion 并发安全）
 *
 * 所有随机量来自 `hash(seed, i)`，不使用 Math.random()。
 */

export interface CelestialThrone3DProps {
  time: number;
  start: number;
  end: number;
  cutAt: number;
  pulse?: number;
}

interface ColumnSpec {
  index: number;
  x: number;
  z: number;
  height: number;
  radius: number;
  seed: number;
  tone: number;
}

interface ChunkSpec {
  index: number;
  column: ColumnSpec;
  part: number;
  y0: number;
  y1: number;
  delay: number;
  vx: number;
  vy: number;
  vz: number;
  sx: number;
  sy: number;
  sz: number;
}

const SIDE = 6;
const GAP = 5.6;
const GRAVITY = -26;
const COLUMN_TONES = ['#8E1A13', '#C9BBA2'];

const buildColumns = (): ColumnSpec[] => {
  const list: ColumnSpec[] = [];
  for (let index = 0; index < SIDE * SIDE; index += 1) {
    const ix = index % SIDE;
    const iz = Math.floor(index / SIDE);
    const seed = 8100 + index * 19;
    list.push({
      index,
      x: (ix - (SIDE - 1) / 2) * GAP + (hash(seed, 1) - 0.5) * 0.9,
      z: (iz - (SIDE - 1) / 2) * GAP + (hash(seed, 2) - 0.5) * 0.9,
      height: 14.0 + hash(seed, 3) * 0.8,
      radius: 0.6 + hash(seed, 4) * 0.1,
      seed,
      tone: index % 3,
    });
  }
  return list;
};

const buildChunks = (columns: ColumnSpec[]): ChunkSpec[] =>
  columns.flatMap((column) =>
    [0, 1, 2].map((part) => {
      const seed = column.seed * 7 + part;
      const height = column.height / 3;
      // 刀光从左上扫到右下，按柱心到斜线的距离决定断口延迟
      const distance = Math.abs(column.x * 0.86 - column.z * 0.5 + 2.2);
      return {
        index: column.index * 3 + part,
        column,
        part,
        y0: height * part,
        y1: height * (part + 1),
        delay: 0.015 + distance * 0.006 + part * 0.022,
        vx: (hash(seed, 11) - 0.5) * 11 + column.x * 0.42,
        vy: 2.4 + hash(seed, 12) * 5.6 + part * 0.9,
        vz: 2.4 + hash(seed, 13) * 5.2 + Math.abs(column.z) * 0.25,
        sx: (hash(seed, 14) - 0.5) * 3.2,
        sy: (hash(seed, 15) - 0.5) * 2.4,
        sz: (hash(seed, 16) - 0.5) * 3.2,
      };
    }),
  );

/**
 * V8 运镜：先在高空/远处绕着殿顶缓慢横移，刀光落下后 0.45 秒内**沿 Z 轴
 * 俯冲进柱阵内部**（半径 38→10、高度 21→6、FOV 48→84、roll −11°→+7°），
 * 再以极近距离横甩。V7 的 31→13.5 只是"轻推"，读不出空间跨度。
 */
const cameraAt = (time: number, start: number, cutAt: number, end: number) => {
  const duration = Math.max(0.001, end - start);
  const local = clamp((time - start) / duration);
  const age = Math.max(0, time - cutAt);
  const dive = easeInOutCubic(clamp(age / 0.45));
  /*
   * 相机从殿前右上方起手（z>0），而不是从殿后穿过新加的天际线。
   * V8 第一版沿用 V7 的 -1.32 起手角，相机正好落在 z=-37 的天际线内部，
   * 整段 98–112 帧只看到几座楼的背面。现在从 +z 侧绕到左侧再俯冲，
   * 70 座天际线始终在御座背后当背景。
   */
  const angle = 0.62 + local * 2.35 + dive * 0.5;
  const radius = 38 - dive * 28;
  const height = 21 - dive * 15;
  const shake = age > 0 ? Math.exp(-age * 4.6) * 0.8 : 0;
  return {
    x: Math.cos(angle) * radius + Math.sin(time * 31) * shake * 0.55,
    y: height + Math.sin(time * 24) * shake * 0.36,
    z: Math.sin(angle) * radius + Math.cos(time * 27) * shake * 0.55,
    tx: 0,
    ty: 8.6 - dive * 4.9,
    tz: 0,
    fov: 48 + dive * 36 + local * 4,
    roll: -0.2 + dive * 0.32 + local * 0.12 + (age > 0 ? Math.exp(-age * 5.4) * 0.09 : 0),
  };
};

const easeInOutCubic = (t: number): number => {
  const v = clamp(t);
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
};

const CameraRig: React.FC<{time: number; start: number; cutAt: number; end: number}> = ({
  time,
  start,
  cutAt,
  end,
}) => {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const pose = cameraAt(time, start, cutAt, end);
  useLayoutEffect(() => {
    camera.position.set(pose.x, pose.y, pose.z);
    camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }, [camera, pose.fov, pose.roll, pose.tx, pose.ty, pose.tz, pose.x, pose.y, pose.z]);
  return null;
};

/** 柱础：两圈石台，让它读成“殿柱”，不是管子。 */
const ColumnBase: React.FC<{radius: number; offsetY: number}> = ({radius, offsetY}) => (
  <group position={[0, offsetY, 0]}>
    <mesh position={[0, 0.16, 0]}>
      <cylinderGeometry args={[radius * 1.75, radius * 1.9, 0.32, 8]} />
      <meshToonMaterial color="#3A2A20" />
      <Outlines thickness={0.03} color="#0A0808" />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <cylinderGeometry args={[radius * 1.38, radius * 1.48, 0.26, 8]} />
      <meshToonMaterial color="#4A3630" />
      <Outlines thickness={0.028} color="#0A0808" />
    </mesh>
  </group>
);

/** 斗拱：三层外挑石板 + 四角短枋，读成中国古建的柱头。 */
const ColumnCapital: React.FC<{radius: number; offsetY: number}> = ({radius, offsetY}) => (
  <group position={[0, offsetY, 0]}>
    <mesh position={[0, 0.16, 0]}>
      <boxGeometry args={[radius * 3.05, 0.22, radius * 3.05]} />
      <meshToonMaterial color="#3A2C30" />
      <Outlines thickness={0.03} color="#0A0808" />
    </mesh>
    <mesh position={[0, 0.36, 0]}>
      <boxGeometry args={[radius * 2.42, 0.18, radius * 2.42]} />
      <meshToonMaterial color="#32262A" />
      <Outlines thickness={0.028} color="#0A0808" />
    </mesh>
    <mesh position={[0, 0.52, 0]}>
      <boxGeometry args={[radius * 2.9, 0.16, radius * 2.9]} />
      <meshToonMaterial color="#2A2024" />
      <Outlines thickness={0.026} color="#0A0808" />
    </mesh>
    {[
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([sx, sz]) => (
      <mesh key={`arm-${sx}-${sz}`} position={[sx * radius * 1.16, 0.28, sz * radius * 1.16]}>
        <boxGeometry args={[radius * 0.62, 0.16, radius * 0.62]} />
        <meshToonMaterial color="#46343A" />
      </mesh>
    ))}
  </group>
);

const GoldBands: React.FC<{radius: number; height: number}> = ({radius, height}) => {
  const goldMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFD54F'),
        emissive: new THREE.Color('#FFD54F'),
        emissiveIntensity: 1.6,
        metalness: 0.35,
        roughness: 0.28,
        toneMapped: false,
      }),
    [],
  );
  const helix = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 36; index += 1) {
      const p = index / 36;
      const angle = p * Math.PI * 5.0;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius * 1.025,
          -height / 2 + height * (0.08 + p * 0.84),
          Math.sin(angle) * radius * 1.025,
        ),
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, [height, radius]);

  return (
    <group>
      {[0.22, 0.46, 0.7].map((position) => (
        <mesh key={`band-${position}`} position={[0, -height / 2 + height * position, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.045, 0.032, 6, 32]} />
          <primitive object={goldMaterial} attach="material" />
        </mesh>
      ))}
      <mesh>
        <tubeGeometry args={[helix, 72, radius * 0.055, 7, false]} />
        <primitive object={goldMaterial} attach="material" />
      </mesh>
    </group>
  );
};

const ColumnChunk: React.FC<{
  chunk: ChunkSpec;
  time: number;
  cutAt: number;
}> = ({chunk, time, cutAt}) => {
  const {column, part} = chunk;
  const height = chunk.y1 - chunk.y0;
  const age = time - cutAt - chunk.delay;
  const broken = age > 0;
  const move = broken
    ? {
        x: chunk.vx * age,
        y: chunk.vy * age + 0.5 * GRAVITY * age * age,
        z: chunk.vz * age,
      }
    : {x: 0, y: 0, z: 0};
  const spin = broken ? {x: chunk.sx * age, y: chunk.sy * age, z: chunk.sz * age} : {x: 0, y: 0, z: 0};
  const centerY = (chunk.y0 + chunk.y1) / 2;
  const fade = broken ? clamp(1 - Math.max(0, age - 0.9) / 0.55) : 1;
  const crackGlow = broken ? clamp(1 - age / 1.1) : 0;

  return (
    <group
      position={[column.x + move.x, centerY + move.y, column.z + move.z]}
      rotation={[spin.x, spin.y, spin.z]}
    >
      <mesh>
        <cylinderGeometry args={[column.radius, column.radius * 1.02, height, 8, 1]} />
        <meshToonMaterial
          color={COLUMN_TONES[column.index % 2] ?? '#8E1A13'}
          emissive={column.index % 2 === 0 ? '#3A0A06' : '#2A2214'}
          emissiveIntensity={column.index % 2 === 0 ? 0.55 : 0.3}
          transparent
          opacity={0.35 + fade * 0.65}
        />
        <Outlines thickness={0.03} color="#0A0808" />
        <Edges threshold={18} scale={1.001} color="#4A3218" />
      </mesh>

      {part === 1 ? <GoldBands radius={column.radius} height={height} /> : null}
      {part === 0 ? <ColumnBase radius={column.radius} offsetY={-height / 2} /> : null}
      {part === 2 ? <ColumnCapital radius={column.radius} offsetY={height / 2} /> : null}

      {broken && part < 2 ? (
        <mesh position={[0, height / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[column.radius * 0.94, 8]} />
          <meshBasicMaterial color="#160C0B" toneMapped={false} transparent opacity={0.94} />
        </mesh>
      ) : null}

      {broken && part < 2 ? (
        <mesh position={[0, height / 2 + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[column.radius * 0.66, column.radius * 0.9, 8]} />
          <meshBasicMaterial color="#FF9D3A" toneMapped={false} transparent opacity={crackGlow * 0.3} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      {broken && part < 2 ? (
        <>
          {[
            {angle: 0.22, length: 1.5, width: 0.03, colour: '#FFE6A8'},
            {angle: 1.15, length: 1.05, width: 0.024, colour: '#FFB347'},
            {angle: 2.42, length: 1.3, width: 0.02, colour: '#FFD15C'},
          ].map((crack) => (
            <mesh key={`crack-${crack.angle}`} position={[0, height / 2 + 0.022, 0]} rotation={[-Math.PI / 2, 0, crack.angle]}>
              <planeGeometry args={[column.radius * crack.length, crack.width]} />
              <meshBasicMaterial color={crack.colour} toneMapped={false} transparent opacity={crackGlow * 0.5} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </>
      ) : null}
    </group>
  );
};

/** 112 帧的斜向刀光：世界空间三层面片，Bloom 负责真正的 HDR 辉光。 */
const SlashBlade: React.FC<{age: number}> = ({age}) => {
  if (age < 0 || age > 0.46) return null;
  const sweep = clamp(age / 0.24);
  const fade = clamp(1 - Math.max(0, age - 0.14) / 0.32);
  const x = -20 + sweep * 40;
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-17, 2.6, 0),
        new THREE.Vector3(-6, 0.7, 0.6),
        new THREE.Vector3(5, 0.1, 0.9),
        new THREE.Vector3(17, 1.5, 0.4),
      ]),
    [],
  );
  return (
    <group position={[x, 9.6, 4.6]} rotation={[0.14, -0.22, -0.3]}>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.075, 6, false]} />
        <meshBasicMaterial color="#FFF8E2" toneMapped={false} transparent opacity={0.95 * fade} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.28, 6, false]} />
        <meshBasicMaterial color="#FCC934" toneMapped={false} transparent opacity={0.34 * fade} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.55, 6, false]} />
        <meshBasicMaterial color="#C8281E" toneMapped={false} transparent opacity={0.16 * fade} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

/**
 * 确定性粒子刀光。
 *
 * 备注：没有直接用 drei 的 `<Sparkles />`，因为它的 `positions` 在 mount 时走
 * `THREE.MathUtils.randFloatSpread`，Remotion 并发渲染每个 tab 都会拿到不同
 * 分布，切帧时粒子会跳。这里保留相同的视觉参数（400 / 15 / 6 / #FFF3D1），
 * 但位置全部来自 `hash(seed, i)`，任意帧可复现。
 */
const Sparkles: React.FC<{age: number; count?: number; scale?: number; size?: number; color?: string}> = ({
  age,
  count = 400,
  scale = 15,
  size = 6,
  color = '#FFF3D1',
}) => {
  const texture = useMemo(() => {
    const side = 32;
    const data = new Uint8Array(side * side * 4);
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        const dx = (x + 0.5) / side - 0.5;
        const dy = (y + 0.5) / side - 0.5;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0, 1 - distance / 0.5) ** 2;
        const offset = (y * side + x) * 4;
        data[offset] = 255;
        data[offset + 1] = 246;
        data[offset + 2] = 220;
        data[offset + 3] = Math.round(alpha * 255);
      }
    }
    const map = new THREE.DataTexture(data, side, side, THREE.RGBAFormat);
    map.needsUpdate = true;
    return map;
  }, []);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const spread = scale;
      arr[index * 3] = (hash(9300, index) - 0.5) * spread * 1.8;
      arr[index * 3 + 1] = 5.2 + hash(9301, index) * spread * 0.55;
      arr[index * 3 + 2] = (hash(9302, index) - 0.5) * spread * 0.85;
    }
    return arr;
  }, [count, scale]);

  if (age < 0 || age > 1.1) return null;
  const fade = clamp(1 - age / 1.1);
  return (
    <points position={[0, 0, 0]} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.06 + size * 0.017}
        sizeAttenuation
        color={color}
        transparent
        opacity={0.9 * fade}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
};

const Throne: React.FC = () => (
  <group position={[0, 0, -9.5]}>
    {[
      {w: 15, h: 0.6, d: 7, y: 0.3},
      {w: 11.5, h: 0.7, d: 5.4, y: 0.9},
      {w: 8.4, h: 0.75, d: 4.0, y: 1.6},
    ].map((step, index) => (
      <mesh key={`step-${index}`} position={[0, step.y, 0]}>
        <boxGeometry args={[step.w, step.h, step.d]} />
        <meshToonMaterial color={index === 2 ? '#3B2B2F' : '#241C21'} />
        <Outlines thickness={0.035} color="#0A0808" />
      </mesh>
    ))}
    <mesh position={[0, 2.5, -0.4]}>
      <boxGeometry args={[4.4, 2.6, 1.1]} />
      <meshToonMaterial color="#2A1F24" emissive="#3A120C" emissiveIntensity={0.45} />
      <Outlines thickness={0.04} color="#0A0808" />
    </mesh>
    <mesh position={[0, 3.9, -0.4]}>
      <boxGeometry args={[5.4, 0.34, 1.7]} />
      <meshToonMaterial color="#4A3438" />
      <Outlines thickness={0.03} color="#0A0808" />
    </mesh>
    <mesh position={[0, 2.5, 0.18]}>
      <circleGeometry args={[1.6, 32]} />
      <meshBasicMaterial color="#7A1C1C" toneMapped={false} transparent opacity={0.5} />
    </mesh>
  </group>
);

const PerimeterFrame: React.FC = () => (
  <group position={[0, 15.1, 0]}>
    {[-14, 14].map((z) => (
      <group key={`beam-x-${z}`}>
        <mesh position={[0, 0, z]}>
          <boxGeometry args={[31, 0.42, 0.62]} />
          <meshToonMaterial color="#211A1F" />
          <Outlines thickness={0.03} color="#0A0808" />
        </mesh>
        <mesh position={[0, -0.25, z]}>
          <boxGeometry args={[29.2, 0.055, 0.09]} />
          <meshBasicMaterial color="#8A5A20" toneMapped={false} transparent opacity={0.78} />
        </mesh>
      </group>
    ))}
    {[-14, 14].map((x) => (
      <group key={`beam-z-${x}`}>
        <mesh position={[x, 0, 0]}>
          <boxGeometry args={[0.62, 0.42, 31]} />
          <meshToonMaterial color="#211A1F" />
          <Outlines thickness={0.03} color="#0A0808" />
        </mesh>
        <mesh position={[x, -0.25, 0]}>
          <boxGeometry args={[0.09, 0.055, 29.2]} />
          <meshBasicMaterial color="#8A5A20" toneMapped={false} transparent opacity={0.78} />
        </mesh>
      </group>
    ))}
  </group>
);

const Backdrop: React.FC = () => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColour: {value: new THREE.Color('#1E0E24')},
          bottomColour: {value: new THREE.Color('#6E2218')},
          glowColour: {value: new THREE.Color('#F5C242')},
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 topColour;
          uniform vec3 bottomColour;
          uniform vec3 glowColour;
          void main(){
            float t = smoothstep(0.0, 1.0, vUv.y);
            vec3 colour = mix(bottomColour, topColour, t);
            float horizon = smoothstep(0.2, 0.0, abs(vUv.y - 0.3));
            float veil = smoothstep(0.55, 1.0, vUv.y) * 0.18;
            colour += glowColour * horizon * 0.32 + vec3(veil * 0.6, veil * 0.18, veil * 0.06);
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  return (
    <mesh position={[0, 14, -48]}>
      <planeGeometry args={[180, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

/* -------------------------------------------------------------------------- */
/*  V8：120 座实例化天宫阙楼                                                    */
/* -------------------------------------------------------------------------- */

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  seed: number;
  face: 'x' | 'z';
  sign: number;
}

const BUILDING_COUNT = 120;
const SKYLINE_COUNT = 120;
const WINDOWS_PER_BUILDING = 4;

const buildBuildings = (): BuildingSpec[] =>
  Array.from({length: BUILDING_COUNT}, (_, index) => {
    const angle = (index / BUILDING_COUNT) * Math.PI * 2 + (hash(9500, index) - 0.5) * 0.14;
    const ring = 20 + hash(9501, index) * 22;
    const x = Math.cos(angle) * ring;
    const z = Math.sin(angle) * ring;
    const face = Math.abs(x) > Math.abs(z) ? 'x' : 'z';
    return {
      x,
      z,
      w: 2.2 + hash(9503, index) * 2.8,
      d: 2.2 + hash(9504, index) * 2.8,
      h: 6 + hash(9502, index) ** 1.35 * 16,
      rot: (hash(9505, index) - 0.5) * 0.5,
      seed: 9600 + index * 7,
      face,
      sign: face === 'x' ? Math.sign(x) : Math.sign(z),
    };
  });

/**
 * 御座之后的 70 座天际线。相机在 112 帧后俯冲进殿内，视线正对御座，
 * 这批楼正好填满御座背后的空隙；全部在 backdrop（z=-48）之前，不会被吃掉。
 */
const buildSkyline = (): BuildingSpec[] =>
  Array.from({length: SKYLINE_COUNT}, (_, index) => {
    const col = index % 14;
    const row = Math.floor(index / 14);
    return {
      x: -45 + col * 6.9 + (hash(9700, index) - 0.5) * 3.4,
      z: -16 - row * 3.2 + (hash(9701, index) - 0.5) * 1.3,
      w: 2.0 + hash(9702, index) * 2.0,
      d: 2.0 + hash(9703, index) * 2.0,
      h: 4 + hash(9704, index) ** 1.2 * 13.5,
      rot: (hash(9705, index) - 0.5) * 0.3,
      seed: 9800 + index * 5,
      face: 'z',
      sign: -1,
    };
  });

/**
 * 120 座阙楼：柱阵之外每隔 3° 一座，最高 22 单位，越远越暗（fog 吃掉）。
 * 全部用 `THREE.InstancedMesh`：
 *   · 楼身 1 个 instancedMesh（暗朱砂/暗金随机实例色）；
 *   · 重檐 1 个（四棱锥，压扁后读成中式攒尖顶）；
 *   · 檐口金线 1 个（发光 Basic，Bloom 会把它拖成一条金线）；
 *   · 窗格 480 个（每楼 4 扇，朝向殿心的一面）。
 *
 * 只使用 `hash(seed, i)`，不碰 Math.random；任意帧可复现。
 */
const InstancedPalace: React.FC<{time: number; pulse: number; kind?: 'ring' | 'skyline'}> = ({
  time,
  pulse,
  kind = 'ring',
}) => {
  const buildings = useMemo(() => (kind === 'skyline' ? buildSkyline() : buildBuildings()), [kind]);
  const count = buildings.length;
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const eaveRef = useRef<THREE.InstancedMesh>(null);
  const windowRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const body = bodyRef.current;
    const roof = roofRef.current;
    const eave = eaveRef.current;
    const windowMesh = windowRef.current;
    if (!body || !roof || !eave || !windowMesh) return;

    buildings.forEach((building, index) => {
      dummy.position.set(building.x, building.h / 2, building.z);
      dummy.rotation.set(0, building.rot, 0);
      dummy.scale.set(building.w, building.h, building.d);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      const tone = index % 3;
      body.setColorAt(
        index,
        new THREE.Color(tone === 0 ? '#3A1C18' : tone === 1 ? '#2A1A22' : '#241A14'),
      );

      dummy.position.set(building.x, building.h + 0.5, building.z);
      dummy.rotation.set(0, Math.PI / 4 + building.rot, 0);
      dummy.scale.set(building.w * 0.98, 1.15, building.d * 0.98);
      dummy.updateMatrix();
      roof.setMatrixAt(index, dummy.matrix);

      dummy.position.set(building.x, building.h + 0.06, building.z);
      dummy.rotation.set(0, building.rot, 0);
      dummy.scale.set(building.w * 1.16, 0.07, building.d * 1.16);
      dummy.updateMatrix();
      eave.setMatrixAt(index, dummy.matrix);

      for (let slot = 0; slot < WINDOWS_PER_BUILDING; slot += 1) {
        const windowIndex = index * WINDOWS_PER_BUILDING + slot;
        const y = building.h * (0.22 + slot * 0.19);
        const jitter = (hash(building.seed, slot) - 0.5) * 0.5;
        let px = building.x;
        let pz = building.z;
        let ry = 0;
        if (building.face === 'x') {
          px = building.x - building.sign * (building.w / 2 + 0.04);
          pz = building.z + jitter * building.d;
          ry = building.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          pz = building.z - building.sign * (building.d / 2 + 0.04);
          px = building.x + jitter * building.w;
          ry = building.sign > 0 ? Math.PI : 0;
        }
        dummy.position.set(px, y, pz);
        dummy.rotation.set(0, ry, 0);
        dummy.scale.set(building.w * (kind === 'skyline' ? 0.58 : 0.4), 0.24 + (slot % 2) * 0.1, 0.04);
        dummy.updateMatrix();
        windowMesh.setMatrixAt(windowIndex, dummy.matrix);
      }
    });

    body.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    roof.instanceMatrix.needsUpdate = true;
    eave.instanceMatrix.needsUpdate = true;
    windowMesh.instanceMatrix.needsUpdate = true;
  }, [buildings]);

  const windowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#F5C242'),
        toneMapped: false,
        transparent: true,
        opacity: 0.62 + pulse * 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    // 只在 mount 建一次；亮度用下面的 material ref 逐帧改，避免每帧新材质
    [],
  );

  const windowMaterialRef = useRef(windowMaterial);
  windowMaterialRef.current.opacity =
    (kind === 'skyline' ? 0.92 : 0.56) + pulse * 0.28 + Math.sin(time * 5.1) * 0.05;

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshToonMaterial
          color="#FFFFFF"
          emissive="#3A140C"
          emissiveIntensity={kind === 'skyline' ? 0.9 : 0.5}
        />
      </instancedMesh>

      <instancedMesh ref={roofRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 1, 1, 4]} />
        <meshToonMaterial color="#1A1014" emissive="#4A180E" emissiveIntensity={kind === 'skyline' ? 0.6 : 0.35} />
      </instancedMesh>

      <instancedMesh ref={eaveRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#C89A32" toneMapped={false} transparent opacity={kind === 'skyline' ? 0.92 : 0.72} />
      </instancedMesh>

      <instancedMesh
        ref={windowRef}
        args={[undefined, undefined, count * WINDOWS_PER_BUILDING]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={windowMaterialRef.current} attach="material" />
      </instancedMesh>
    </group>
  );
};

/** 刀光落点后的三重冲击波：赤金 + 绯红，厚管渐薄。 */
const ImpactShockwaves: React.FC<{age: number}> = ({age}) => {
  if (age < 0) return null;
  return (
    <group>
      {[0, 0.055, 0.11].map((delay, index) => {
        const ringAge = age - delay;
        if (ringAge <= 0 || ringAge > 0.92) return null;
        const radius = 2.4 + ringAge * 30;
        const fade = clamp(1 - ringAge / 0.92);
        return (
          <group key={`shock-${index}`}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08 + index * 0.02, 0]}>
              <torusGeometry args={[radius, 0.06 + fade * 0.16, 6, 96]} />
              <meshBasicMaterial
                color={index === 2 ? '#C8281E' : '#FFE8B0'}
                toneMapped={false}
                transparent
                opacity={fade * 0.8}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1 + index * 0.02, 0]}>
              <ringGeometry args={[radius * 0.72, radius * 0.76, 96]} />
              <meshBasicMaterial
                color="#F5C242"
                toneMapped={false}
                transparent
                opacity={fade * 0.26}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/** 汉白玉台阶：五级，中央通向御座。 */
const MarbleStair: React.FC = () => (
  <group position={[0, 0, -8]}>
    {Array.from({length: 6}, (_, index) => (
      <group key={`step-${index}`}>
        <mesh position={[0, 0.15 + index * 0.26, -index * 0.72]}>
          <boxGeometry args={[12.4 - index * 0.7, 0.26, 1.12]} />
          <meshToonMaterial color="#C9BBA2" emissive="#3A2E1A" emissiveIntensity={0.14} />
          <Outlines thickness={0.03} color="#0A0808" />
        </mesh>
        <mesh position={[0, 0.29 + index * 0.26, -index * 0.72 - 0.57]}>
          <boxGeometry args={[12.2 - index * 0.7, 0.035, 0.07]} />
          <meshBasicMaterial color="#F5C242" toneMapped={false} />
        </mesh>
      </group>
    ))}
    <mesh position={[0, 1.9, -5.6]}>
      <boxGeometry args={[9.6, 2.5, 0.8]} />
      <meshToonMaterial color="#2A1218" emissive="#3A120C" emissiveIntensity={0.5} />
      <Outlines thickness={0.04} color="#0A0808" />
    </mesh>
  </group>
);

const Floor: React.FC = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
      <circleGeometry args={[38, 72]} />
      <meshStandardMaterial color="#1A0E16" roughness={0.78} metalness={0.12} />
    </mesh>
    {/* 发光暗金阵法网格 */}
    {Array.from({length: 15}, (_, index) => {
      const p = (index - 7) * 2.6;
      return (
        <group key={`grid-${p}`}>
          <mesh position={[p, 0.006, 0]}>
            <boxGeometry args={[0.028, 0.01, 32]} />
            <meshBasicMaterial color="#C89A32" toneMapped={false} transparent opacity={0.44} />
          </mesh>
          <mesh position={[0, 0.006, p]}>
            <boxGeometry args={[32, 0.01, 0.028]} />
            <meshBasicMaterial color="#C89A32" toneMapped={false} transparent opacity={0.44} />
          </mesh>
        </group>
      );
    })}
    {[7, 13.5, 20, 26.5].map((radius) => (
      <mesh key={`ring-${radius}`} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <torusGeometry args={[radius, 0.018, 4, 96]} />
        <meshBasicMaterial color="#F5C242" toneMapped={false} transparent opacity={0.62} />
      </mesh>
    ))}
    {Array.from({length: 16}, (_, index) => {
      const angle = (index / 16) * Math.PI * 2;
      return (
        <mesh key={`spoke-${index}`} position={[Math.cos(angle) * 16, 0.012, Math.sin(angle) * 16]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[16, 0.01, 0.04]} />
          <meshBasicMaterial color="#8A5A20" toneMapped={false} transparent opacity={0.42} />
        </mesh>
      );
    })}
    <mesh position={[11, 17.5, -32]}>
      <circleGeometry args={[7.4, 64]} />
      <meshBasicMaterial color="#8A2A16" toneMapped={false} transparent opacity={0.85} />
    </mesh>
  </group>
);

/** 首帧时 EffectComposer 尚未就绪；晚一帧 advance，保证 still 与视频都出图。 */
const LateAdvance: React.FC = () => {
  const advance = useThree((state) => state.advance);
  const frame = useCurrentFrame();
  useEffect(() => {
    const handle = delayRender(`throne3d-advance-${frame}`);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
    };
    const timer = setTimeout(() => {
      advance(performance.now());
      finish();
    }, 34);
    return () => {
      clearTimeout(timer);
      finish();
    };
  }, [advance, frame]);
  return null;
};

const Scene: React.FC<{
  time: number;
  start: number;
  end: number;
  cutAt: number;
  pulse: number;
}> = ({time, start, end, cutAt, pulse}) => {
  const columns = useMemo(buildColumns, []);
  const chunks = useMemo(() => buildChunks(columns), [columns]);
  const age = time - cutAt;
  return (
    <>
      <color attach="background" args={['#1E0E24']} />
      <fog attach="fog" args={['#2A1018', 22, 90]} />
      <Backdrop />
      <ambientLight intensity={0.35} color="#E8C9A0" />
      <directionalLight position={[8, 16, 12]} intensity={1.2} color="#FFE0B0" />
      <directionalLight position={[-12, 10, -14]} intensity={0.55} color="#C8281E" />
      <spotLight position={[0, 22, 2]} angle={0.7} penumbra={0.82} intensity={140} distance={48} decay={2} color="#FFE0B0" />
      <pointLight position={[0, 8, 4]} intensity={20} distance={30} decay={2} color="#FFB86B" />
      <pointLight position={[0, 4, -10]} intensity={20} distance={20} decay={2} color="#F5C242" />
      <pointLight position={[0, 4.5, 0]} intensity={12 + pulse * 8} distance={22} decay={2} color="#8E1A13" />

      <CameraRig time={time} start={start} cutAt={cutAt} end={end} />
      {/*
        120 座天际线全部放在御座背后（z −16…−32），不再绕成包围相机的
        "环城"：V8 第一版把 120 座楼放在半径 20–42 的环上，相机起手正好
        在楼群中间，2B 前 14 帧只看见一排挡在镜头前的黑方块。
      */}
      <InstancedPalace time={time} pulse={pulse} kind="skyline" />
      <Floor />
      <MarbleStair />
      <Throne />
      <PerimeterFrame />

      {chunks.map((chunk) => (
        <ColumnChunk key={`chunk-${chunk.index}`} chunk={chunk} time={time} cutAt={cutAt} />
      ))}

      <SlashBlade age={age} />
      <Sparkles age={age} count={400} scale={15} size={6} color="#FFF3D1" />
      <ImpactShockwaves age={age} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.25} intensity={2.0} mipmapBlur />
      </EffectComposer>
      <LateAdvance />
    </>
  );
};

export const CelestialThrone3D: React.FC<CelestialThrone3DProps> = ({time, start, end, cutAt, pulse = 0}) => {
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: '#0B0609'}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{position: [10, 18, -18], fov: 46, near: 0.1, far: 140}}
        gl={{antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'}}
        style={{position: 'absolute', inset: 0, filter: 'saturate(0.82) contrast(1.1) brightness(0.96)'}}
        dpr={1}
      >
        <Scene time={time} start={start} end={end} cutAt={cutAt} pulse={pulse} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export default CelestialThrone3D;

