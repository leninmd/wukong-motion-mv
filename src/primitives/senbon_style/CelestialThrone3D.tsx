import React, {useEffect, useLayoutEffect, useMemo} from 'react';
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
const COLUMN_TONES = ['#262630', '#1E1E26', '#2E2C36'];

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

const cameraAt = (time: number, start: number, cutAt: number, end: number) => {
  const duration = Math.max(0.001, end - start);
  const local = clamp((time - start) / duration);
  const age = Math.max(0, time - cutAt);
  const angle = -1.22 + local * 1.66;
  const radius = 30.5 - local * 12.5;
  const height = 16.2 - local * 6.0;
  const shake = age > 0 ? Math.exp(-age * 4.6) * 0.5 : 0;
  return {
    x: Math.cos(angle) * radius + Math.sin(time * 31) * shake * 0.5,
    y: height + Math.sin(time * 24) * shake * 0.32,
    z: Math.sin(angle) * radius + Math.cos(time * 27) * shake * 0.5,
    tx: 0,
    ty: 8.6 - local * 0.4,
    tz: 0,
    fov: 54 + local * 8,
    roll: -0.12 + local * 0.24 + (age > 0 ? Math.exp(-age * 5.4) * 0.07 : 0),
  };
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
      <meshToonMaterial color="#2A2227" />
      <Outlines thickness={0.03} color="#0A0808" />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <cylinderGeometry args={[radius * 1.38, radius * 1.48, 0.26, 8]} />
      <meshToonMaterial color="#352A2E" />
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
  return (
    <group>
      {[0.34, 0.68].map((position, index) => (
        <mesh key={`band-${index}`} position={[0, -height / 2 + height * position, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.035, 0.019, 5, 28]} />
          <meshBasicMaterial color={index === 0 ? '#B8860B' : '#FCC934'} toneMapped={false} transparent opacity={0.82} />
        </mesh>
      ))}
      {/* 两条鎏金盘龙脊线，只存在于两道金环之间 */}
      {[-1, 1].map((side) => (
        <mesh key={`spine-${side}`} position={[0, 0, side * radius * 1.015]}>
          <boxGeometry args={[radius * 0.055, height * 0.28, radius * 0.022]} />
          <meshBasicMaterial color="#8A5A20" toneMapped={false} transparent opacity={0.5} />
        </mesh>
      ))}
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
        <meshToonMaterial color={COLUMN_TONES[column.tone]} emissive={broken ? '#2A0B08' : '#140A0C'} emissiveIntensity={broken ? 0.9 : 0.35} transparent opacity={0.35 + fade * 0.65} />
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

const Floor: React.FC = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
      <circleGeometry args={[36, 72]} />
      <meshStandardMaterial color="#150C10" roughness={0.86} metalness={0.08} />
    </mesh>
    {[7, 13.5, 20, 26.5].map((radius) => (
      <mesh key={`ring-${radius}`} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <torusGeometry args={[radius, 0.014, 4, 96]} />
        <meshBasicMaterial color="#8A5A20" toneMapped={false} transparent opacity={0.55} />
      </mesh>
    ))}
    {Array.from({length: 16}, (_, index) => {
      const angle = (index / 16) * Math.PI * 2;
      return (
        <mesh key={`spoke-${index}`} position={[Math.cos(angle) * 16, 0.005, Math.sin(angle) * 16]} rotation={[0, -angle, 0]}>
          <boxGeometry args={[16, 0.008, 0.03]} />
          <meshBasicMaterial color="#6A4218" toneMapped={false} transparent opacity={0.32} />
        </mesh>
      );
    })}
    <mesh position={[11, 15.5, -27]}>
      <circleGeometry args={[8.2, 64]} />
      <meshBasicMaterial color="#5E1712" toneMapped={false} transparent opacity={0.82} />
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
      <color attach="background" args={['#0B0609']} />
      <fog attach="fog" args={['#0B0609', 20, 74]} />
      <ambientLight intensity={0.42} color="#7C8798" />
      <directionalLight position={[8, 14, 12]} intensity={1.15} color="#DCE6F2" />
      <directionalLight position={[-10, 9, -12]} intensity={0.85} color="#FFB86B" />
      <spotLight position={[0, 21, 1]} angle={0.66} penumbra={0.86} intensity={150} distance={42} decay={2} color="#FFE0B0" />
      <pointLight position={[0, 7.5, 3]} intensity={16} distance={26} decay={2} color="#D9A15C" />
      <pointLight position={[0, 3.4, -9]} intensity={24} distance={17} decay={2} color="#C8281E" />
      <pointLight position={[0, 4.5, 0]} intensity={8 + pulse * 6} distance={22} decay={2} color="#8E1A13" />

      <CameraRig time={time} start={start} cutAt={cutAt} end={end} />
      <Floor />
      <Throne />
      <PerimeterFrame />

      {chunks.map((chunk) => (
        <ColumnChunk key={`chunk-${chunk.index}`} chunk={chunk} time={time} cutAt={cutAt} />
      ))}

      <SlashBlade age={age} />
      <Sparkles age={age} count={400} scale={15} size={6} color="#FFF3D1" />

      {/* 刀光落点后的地面冲击环 */}
      {age > 0
        ? [0, 0.07, 0.14].map((delay, index) => {
            const ringAge = age - delay;
            if (ringAge <= 0 || ringAge > 0.9) return null;
            const radius = 2 + ringAge * 22;
            return (
              <mesh key={`impact-${index}`} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                <torusGeometry args={[radius, 0.035 + (1 - ringAge) * 0.03, 4, 96]} />
                <meshBasicMaterial color="#FFE8B0" toneMapped={false} transparent opacity={clamp(0.9 - ringAge) * 0.7} />
              </mesh>
            );
          })
        : null}

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

