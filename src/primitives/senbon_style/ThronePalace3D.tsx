import React, {useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {hash} from '../../utils/math';
import {SENBON, clamp01, easeInCubic, easeOutCubic} from './style';

/**
 * Shot 2 后段：三维凌霄宝殿矩阵。
 *
 * 暗金网格地面 + 中央龙座祭坛 + 环绕四周的 36 根盘龙巨柱；摄像机低角度
 * 环绕俯冲。第 112 帧一根巨型发光金箍棒横扫而过，地面炸开三圈赤金网格
 * 冲击波，36 根巨柱碎成 216 块三维残石向镜头飞溅。
 */

export interface ThronePalace3DProps {
  time: number;
  start: number;
  /** 金箍棒横扫时刻。 */
  sweepAt: number;
  end: number;
  pulse?: number;
}

const COLUMN_COUNT = 36;
const FRAGMENTS = 6;
const COLUMN_RADIUS = 30;

interface ColumnData {
  angle: number;
  radius: number;
  height: number;
  width: number;
  lean: number;
}

const buildColumns = (): ColumnData[] =>
  Array.from({length: COLUMN_COUNT}, (_, index) => {
    const angle = (index / COLUMN_COUNT) * Math.PI * 2;
    return {
      angle,
      radius: COLUMN_RADIUS + (hash(1201, index) - 0.5) * 3.2,
      height: 26 + hash(2203, index) * 12,
      width: 2.1 + hash(3307, index) * 0.7,
      lean: (hash(4409, index) - 0.5) * 0.05,
    };
  });

const CameraRig: React.FC<{local: number; sweepAge: number}> = ({local, sweepAge}) => {
  const {camera} = useThree();
  const dive = easeOutCubic(clamp01(local / 1.5));
  const orbit = 0.5 + local * 0.42;
  const shake = sweepAge >= 0 && sweepAge < 0.6 ? Math.exp(-sweepAge * 7) * 3.4 : 0;
  // 低角度环绕 → 俯冲：机位从接近地面的平视抬到中景俯视
  camera.position.set(
    Math.sin(orbit) * (62 - dive * 18) + Math.sin(local * 47) * shake,
    4.5 + dive * 15 + Math.cos(local * 53) * shake * 0.6,
    Math.cos(orbit) * (62 - dive * 18),
  );
  camera.lookAt(0, 11 + dive * 3, 0);
  camera.updateProjectionMatrix();
  return null;
};

const GridGround: React.FC = () => {
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0B090A';
      ctx.fillRect(0, 0, size, size);
      const cells = 16;
      const cell = size / cells;
      ctx.strokeStyle = 'rgba(252,201,52,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= cells; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(252,201,52,0.16)';
      ctx.lineWidth = 7;
      ctx.strokeRect(0, 0, size, size);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(6, 6);
    map.anisotropy = 4;
    return map;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[320, 320]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {[COLUMN_RADIUS + 4, 42, 56, 70].map((radius) => (
        <mesh key={`ring-${radius}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[radius, radius + 0.22, 128]} />
          <meshBasicMaterial
            color={SENBON.gold}
            transparent
            opacity={0.34}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

/** 中央龙座祭坛：三级八角台 + 高耸龙椅 + 背后金环。 */
const DragonThrone: React.FC<{local: number; sweepAge: number}> = ({local, sweepAge}) => {
  const glow = sweepAge >= 0 && sweepAge < 1 ? Math.exp(-sweepAge * 3) : 0;
  return (
    <group position={[0, 0, 0]}>
      {[0, 1, 2].map((tier) => (
        <mesh key={`tier-${tier}`} position={[0, 1.2 + tier * 2.4, 0]} rotation={[0, tier * 0.26, 0]}>
          <cylinderGeometry args={[13 - tier * 3.1, 14.4 - tier * 3.1, 2.4, 8]} />
          <meshStandardMaterial
            color={tier === 2 ? '#3A2E22' : '#241C18'}
            emissive={SENBON.goldDeep}
            emissiveIntensity={0.18 + glow * 0.4}
            roughness={0.5}
            metalness={0.5}
          />
        </mesh>
      ))}
      {/* 龙椅 */}
      <mesh position={[0, 9.6, 0]} rotation={[0, Math.PI / 8, 0]}>
        <boxGeometry args={[7.4, 9, 6.2]} />
        <meshStandardMaterial color="#1C1517" emissive={SENBON.goldDeep} emissiveIntensity={0.22} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 15.4, -1.1]}>
        <boxGeometry args={[8.6, 6.4, 1.4]} />
        <meshStandardMaterial color="#2A1E18" emissive={SENBON.gold} emissiveIntensity={0.26} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* 两侧龙首 */}
      {[-1, 1].map((side) => (
        <group key={`dragon-${side}`} position={[side * 5.6, 14, 1.6]} rotation={[0, side * -0.5, side * 0.2]}>
          <mesh>
            <coneGeometry args={[1.5, 4.2, 6]} />
            <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.4} metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 2.4, 0.4]} rotation={[0.5, 0, 0]}>
            <coneGeometry args={[0.5, 2.4, 5]} />
            <meshStandardMaterial color={SENBON.cinnabarDeep} emissive={SENBON.cinnabar} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
      {/* 背光金环 */}
      <mesh position={[0, 15.8, -3.4]}>
        <torusGeometry args={[11.6, 0.24, 8, 96]} />
        <meshBasicMaterial color={SENBON.gold} transparent opacity={0.6 + glow * 0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 15.8, -3.4]}>
        <ringGeometry args={[16, 30, 96]} />
        <meshBasicMaterial
          color={SENBON.goldDeep}
          transparent
          opacity={0.12 + glow * 0.24 + local * 0.02}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

/** 一根盘龙巨柱：柱身 + 金色柱头 + 底座 + 三道盘龙金环。 */
const Column: React.FC<{data: ColumnData; breakAt: number; local: number}> = ({data, breakAt, local}) => {
  const x = Math.cos(data.angle) * data.radius;
  const z = Math.sin(data.angle) * data.radius;
  if (local < breakAt) {
    return (
      <group position={[x, 0, z]} rotation={[data.lean, data.angle, data.lean * 0.6]}>
        <mesh position={[0, data.height / 2, 0]}>
          <boxGeometry args={[data.width, data.height, data.width]} />
          <meshStandardMaterial color="#241C1E" emissive="#2A2022" emissiveIntensity={0.5} roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, data.height + 0.5, 0]}>
          <boxGeometry args={[data.width * 1.5, 1.1, data.width * 1.5]} />
          <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.42} metalness={0.9} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[data.width * 1.7, 1, data.width * 1.7]} />
          <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.28} metalness={0.9} roughness={0.3} />
        </mesh>
        {[0.3, 0.55, 0.8].map((ratio) => (
          <mesh key={`coil-${ratio}`} position={[0, data.height * ratio, 0]} rotation={[Math.PI / 2 + ratio, 0, 0]}>
            <torusGeometry args={[data.width * 0.82, data.width * 0.11, 6, 20]} />
            <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.55} metalness={0.9} roughness={0.25} />
          </mesh>
        ))}
      </group>
    );
  }

  /* 碎裂：6 块残石向镜头飞溅 */
  const age = local - breakAt;
  return (
    <group position={[x, 0, z]}>
      {Array.from({length: FRAGMENTS}, (_, index) => {
        const seed = Math.round(data.angle * 1000) + index * 37;
        const outward = 0.55 + hash(seed, 1) * 0.9;
        const upward = 0.7 + hash(seed, 2) * 1.4;
        const gravity = 16;
        const y = data.height * (0.16 + index * 0.14) + upward * age * 9 - 0.5 * gravity * age * age;
        const dist = outward * age * 22;
        const dir = data.angle + (hash(seed, 3) - 0.5) * 0.7;
        const size = data.width * (0.5 + hash(seed, 4) * 0.7);
        if (y < -12) return null;
        return (
          <mesh
            key={`frag-${index}`}
            position={[Math.cos(dir) * dist, Math.max(y, -12), Math.sin(dir) * dist]}
            rotation={[age * (2 + hash(seed, 5) * 4), age * (3 + hash(seed, 6) * 4), age * 2.4]}
          >
            <boxGeometry args={[size, size * (0.7 + hash(seed, 7)), size * 0.8]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? '#3A2C1C' : '#221A1C'}
              emissive={index % 3 === 0 ? SENBON.goldDeep : '#2E2224'}
              emissiveIntensity={0.28}
              metalness={0.6}
              roughness={0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
};

/** 横扫的巨型金箍棒：三道残影 + 顶点光尘。 */
const GiantCudgel: React.FC<{age: number}> = ({age}) => {
  if (age < 0 || age > 1.1) return null;
  const travel = easeInCubic(clamp01(age / 0.42));
  const x = -150 + travel * 300;
  const fade = age < 0.42 ? 1 : Math.max(0, 1 - (age - 0.42) / 0.68);
  return (
    <group>
      {[0, 1, 2].map((index) => {
        const lag = index * 14;
        return (
          <mesh
            key={`cudgel-${index}`}
            position={[x - lag, 9 + index * 0.2, 0]}
            rotation={[0, 0, Math.PI / 2]}
            visible={fade > 0.01}
          >
            <cylinderGeometry args={[1.5 - index * 0.32, 1.5 - index * 0.32, 240, 18, 1, true]} />
            <meshBasicMaterial
              color={SENBON.gold}
              transparent
              opacity={fade * (0.9 - index * 0.26)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
      <mesh position={[x, 9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 236, 14]} />
        <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.75} metalness={0.9} roughness={0.2} />
      </mesh>
      <pointLight position={[x, 10, 0]} color={SENBON.goldLight} intensity={160} distance={190} decay={2} />
    </group>
  );
};

const Shockwaves: React.FC<{age: number}> = ({age}) => {
  if (age < 0 || age > 1.4) return null;
  return (
    <group>
      {[0, 0.1, 0.2].map((delay, index) => {
        const t = age - delay;
        if (t < 0) return null;
        const p = clamp01(t / 1.1);
        const scale = 4 + p * (52 + index * 14);
        return (
          <mesh key={`wave-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16 + index * 0.03, 0]} scale={scale}>
            <ringGeometry args={[0.9, 1, 160]} />
            <meshBasicMaterial
              color={index === 1 ? SENBON.cinnabar : SENBON.goldLight}
              transparent
              opacity={(1 - p) ** 1.5 * 0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const DustField: React.FC<{local: number}> = ({local}) => {
  const positions = useMemo(() => {
    const array = new Float32Array(220 * 3);
    for (let index = 0; index < 220; index += 1) {
      const radius = 6 + hash(5501, index) * 64;
      const angle = hash(6607, index) * Math.PI * 2;
      array[index * 3] = Math.cos(angle) * radius;
      array[index * 3 + 1] = 1 + hash(7703, index) * 40;
      array[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, []);
  return (
    <points position={[0, (local * 2.2) % 26, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={SENBON.gold} size={0.34} sizeAttenuation transparent opacity={0.42} depthWrite={false} />
    </points>
  );
};

export const ThronePalace3D: React.FC<ThronePalace3DProps> = ({
  time,
  start,
  sweepAt,
  end,
  pulse = 0,
}) => {
  const {width, height} = useVideoConfig();
  const local = Math.max(0, time - start);
  const span = Math.max(0.001, end - start);
  const progress = clamp01(local / span);
  const sweepLocal = sweepAt - start;
  const sweepAge = local - sweepLocal;
  const columns = useMemo(buildColumns, []);
  const flash = sweepAge >= 0 && sweepAge < 0.2 ? (1 - sweepAge / 0.2) ** 2 : 0;

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{fov: 46, position: [0, 6, 58], near: 0.1, far: 600}}
        gl={{antialias: true, alpha: false, powerPreference: 'high-performance'}}
        style={{position: 'absolute', inset: 0}}
      >
        <color attach="background" args={[SENBON.ink]} />
        <fog attach="fog" args={[SENBON.ink, 130, 380]} />
        <ambientLight intensity={0.95} color="#FCC934" />
        <directionalLight position={[26, 52, 34]} intensity={2.1} color="#FFE9A3" />
        <directionalLight position={[-34, 26, -24]} intensity={0.6} color={SENBON.cinnabar} />
        <CameraRig local={local} sweepAge={sweepAge} />
        <GridGround />
        <DragonThrone local={local} sweepAge={sweepAge} />
        {columns.map((column, index) => (
          <Column
            key={`column-${index}`}
            data={column}
            breakAt={sweepLocal}
            local={local}
          />
        ))}
        <GiantCudgel age={sweepAge} />
        <Shockwaves age={sweepAge} />
        <DustField local={local} />
      </ThreeCanvas>
      {/* 屏幕空间：金雾 / 网点 / 冲击白闪 / 暗角 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 52% 44% at 50% 62%, rgba(252,201,52,${0.1 + flash * 0.3}) 0%, rgba(217,48,37,${0.06 + flash * 0.1}) 44%, rgba(11,9,10,0) 78%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(252,201,52,0.3) 1px, rgba(252,201,52,0) 1.35px)',
          backgroundSize: '9px 9px',
          opacity: 0.13 + flash * 0.16,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 68% 64% at 50% 50%, rgba(11,9,10,0) 44%, rgba(11,9,10,0.68) 78%, rgba(11,9,10,0.96) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: SENBON.paper,
          opacity: flash * 0.22 + pulse * 0.02,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(11,9,10,${0.3 + progress * 0.2}) 0%, rgba(11,9,10,0) 22%, rgba(11,9,10,0) 78%, rgba(11,9,10,${0.42 + progress * 0.3}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default ThronePalace3D;
