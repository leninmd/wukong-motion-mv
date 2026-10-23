import React, {useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {hash} from '../../utils/math';
import {SENBON, clamp01, easeInCubic, easeOutCubic} from './style';

/**
 * Shot 2B 的 3D 后景：崩裂的天庭柱阵。
 *
 * 与 V3 的 `ThronePalace3D` 不同：
 *   · 相机沿 Z 轴高速推进（76 → 20），并带 15° 仰角滚转；
 *   · 36 根盘龙巨柱在 115 帧同时断裂，碎块**朝镜头**飞来，而不是向外炸开；
 *   · 地面三圈赤金网格冲击波；
 *   · 前景大圣在左下角俯瞰，后景的透视压缩必须读得出来。
 */
export interface CrumblingPalace3DProps {
  time: number;
  start: number;
  end: number;
  /** 断裂时刻（秒）。 */
  breakAt: number;
  pulse?: number;
}

const COLUMNS = 36;
const FRAGMENTS = 4;
const TILT = (15 * Math.PI) / 180;

interface ColumnData {
  angle: number;
  radius: number;
  height: number;
  width: number;
  lean: number;
}

const buildColumns = (): ColumnData[] =>
  Array.from({length: COLUMNS}, (_, index) => {
    const angle = (index / COLUMNS) * Math.PI * 2;
    return {
      angle,
      radius: 24 + (hash(1211, index) - 0.5) * 8,
      height: 22 + hash(2213, index) * 24,
      width: 2.4 + hash(3319, index) * 1.2,
      lean: (hash(4421, index) - 0.5) * 0.08,
    };
  });

const CameraRig: React.FC<{local: number; span: number; breakAge: number}> = ({local, span, breakAge}) => {
  const {camera} = useThree();
  const push = easeOutCubic(clamp01(local / Math.max(0.001, span)));
  const shake = breakAge >= 0 && breakAge < 0.7 ? Math.exp(-breakAge * 6) * 1.4 : 0;
  const z = 108 - push * 38;
  camera.position.set(
    Math.sin(push * 2.4) * 4 + Math.sin(local * 31) * shake,
    14 + push * 8 + Math.cos(local * 37) * shake * 0.6,
    z,
  );
  camera.up.set(Math.sin(TILT), Math.cos(TILT), 0);
  camera.lookAt(Math.sin(push * 1.4) * 2, 16 + push * 2, -12);
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
      ctx.fillStyle = '#0A0708';
      ctx.fillRect(0, 0, size, size);
      const cells = 14;
      const cell = size / cells;
      ctx.strokeStyle = 'rgba(252,201,52,0.42)';
      ctx.lineWidth = 2.0;
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
      /* 每隔四格再加一条粗金线，像天庭地砖的缝 */
      ctx.strokeStyle = 'rgba(255,247,218,0.22)';
      ctx.lineWidth = 4;
      for (let i = 0; i <= cells; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(7, 7);
    map.anisotropy = 4;
    return map;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[460, 460]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {[26, 38, 52, 66, 84].map((radius, index) => (
        <mesh key={`ring-${radius}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05 + index * 0.01, 0]}>
          <ringGeometry args={[radius, radius + 0.3, 160]} />
          <meshBasicMaterial
            color={index % 2 === 0 ? SENBON.gold : SENBON.cinnabar}
            transparent
            opacity={0.26 + index * 0.03}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

const Altar: React.FC<{breakAge: number}> = ({breakAge}) => {
  const glow = breakAge >= 0 && breakAge < 1.4 ? Math.exp(-breakAge * 2.4) : 0;
  return (
    <group position={[0, 0, -8]}>
      {[0, 1, 2].map((tier) => (
        <mesh key={`tier-${tier}`} position={[0, 1 + tier * 2.2, 0]} rotation={[0, tier * 0.3, 0]}>
          <cylinderGeometry args={[12 - tier * 3, 13.4 - tier * 3, 2.2, 8]} />
          <meshStandardMaterial color="#241A18" emissive={SENBON.goldDeep} emissiveIntensity={0.22 + glow * 0.5} metalness={0.6} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 13, -3]}>
        <torusGeometry args={[10.5, 0.28, 8, 96]} />
        <meshBasicMaterial color={SENBON.gold} transparent opacity={0.72 + glow * 0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 13, -3]}>
        <ringGeometry args={[15, 34, 96]} />
        <meshBasicMaterial
          color={SENBON.goldDeep}
          transparent
          opacity={0.1 + glow * 0.28}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight position={[0, 14, 2]} color={SENBON.goldLight} intensity={220} distance={120} decay={2} />
    </group>
  );
};

const Column: React.FC<{data: ColumnData; breakAge: number; local: number; intact?: boolean}> = ({
  data,
  breakAge,
  local,
  intact = false,
}) => {
  const x = Math.cos(data.angle) * data.radius;
  const z = Math.sin(data.angle) * data.radius;

  if (breakAge < 0 || intact) {
    return (
      <group position={[x, 0, z]} rotation={[data.lean, data.angle, data.lean * 0.7]}>
        <mesh position={[0, data.height / 2, 0]}>
          <boxGeometry args={[data.width, data.height, data.width]} />
          <meshStandardMaterial color="#181213" emissive="#241C1C" emissiveIntensity={0.36} roughness={0.58} metalness={0.42} />
        </mesh>
        <mesh position={[0, data.height + 0.7, 0]}>
          <boxGeometry args={[data.width * 1.55, 1.2, data.width * 1.55]} />
          <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.55} metalness={0.9} roughness={0.28} />
        </mesh>
        {[0.28, 0.52, 0.76].map((ratio) => (
          <mesh key={`coil-${ratio}`} position={[0, data.height * ratio, 0]} rotation={[Math.PI / 2 + ratio, 0, 0]}>
            <torusGeometry args={[data.width * 0.84, data.width * 0.13, 6, 20]} />
            <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.7} metalness={0.9} roughness={0.24} />
          </mesh>
        ))}
      </group>
    );
  }

  const age = breakAge;
  return (
    <group position={[x, 0, z]}>
      {/* 断柱基座：36 根全部断裂，但保留一圈矮桩，地面透视才读得出来 */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[data.width * 1.18, 2.8, data.width * 1.18]} />
        <meshStandardMaterial color="#161011" emissive="#241C1C" emissiveIntensity={0.28} metalness={0.4} roughness={0.62} />
      </mesh>
      {Array.from({length: FRAGMENTS}, (_, index) => {
        const seed = Math.round(data.angle * 1000) + index * 37;
        const burst = 0.65 + hash(seed, 1) * 1.1;
        const lift = 0.8 + hash(seed, 2) * 1.6;
        const y = data.height * (0.18 + index * 0.15) + lift * age * 10 - 0.5 * 15 * age * age;
        const toward = 4 + burst * age * 17;
        const dir = data.angle + (hash(seed, 3) - 0.5) * 0.9;
        const size = data.width * (0.38 + hash(seed, 4) * 0.5);
        if (y < -16) return null;
        return (
          <mesh
            key={`frag-${index}`}
            position={[Math.cos(dir) * toward * 0.32, Math.max(y, -16), Math.sin(dir) * toward * 0.32 + toward]}
            rotation={[age * (2.4 + hash(seed, 5) * 4), age * (3.2 + hash(seed, 6) * 4), age * 2.8]}
          >
            <boxGeometry args={[size, size * (0.8 + hash(seed, 7)), size * 0.85]} />
            <meshStandardMaterial
              color={index % 4 === 0 ? '#3A2C1A' : '#191314'}
              emissive={index % 4 === 0 ? SENBON.goldDeep : '#22191A'}
              emissiveIntensity={0.2}
              metalness={0.5}
              roughness={0.58}
            />
          </mesh>
        );
      })}
    </group>
  );
};

const Shockwaves: React.FC<{breakAge: number}> = ({breakAge}) => {
  if (breakAge < 0 || breakAge > 1.6) return null;
  return (
    <group>
      {[0, 0.12, 0.24].map((delay, index) => {
        const t = breakAge - delay;
        if (t < 0) return null;
        const p = clamp01(t / 1.25);
        const scale = 4 + p * (58 + index * 18);
        return (
          <mesh key={`wave-${index}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12 + index * 0.03, 0]} scale={scale}>
            <ringGeometry args={[0.92, 1, 180]} />
            <meshBasicMaterial
              color={index === 1 ? SENBON.cinnabar : SENBON.goldLight}
              transparent
              opacity={(1 - p) ** 1.4 * 0.9}
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

const Dust: React.FC<{local: number; breakAge: number}> = ({local, breakAge}) => {
  const positions = useMemo(() => {
    const array = new Float32Array(320 * 3);
    for (let index = 0; index < 320; index += 1) {
      const radius = 4 + hash(5511, index) * 72;
      const angle = hash(6619, index) * Math.PI * 2;
      array[index * 3] = Math.cos(angle) * radius;
      array[index * 3 + 1] = 0.6 + hash(7723, index) * 46;
      array[index * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, []);
  const rush = breakAge >= 0 ? Math.min(1, breakAge * 1.4) : 0;
  return (
    <points position={[0, ((local * 2.4) % 30) + rush * 4, rush * 12]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={SENBON.gold} size={0.32 + rush * 0.3} sizeAttenuation transparent opacity={0.2 + rush * 0.22} depthWrite={false} />
    </points>
  );
};

export const CrumblingPalace3D: React.FC<CrumblingPalace3DProps> = ({time, start, end, breakAt, pulse = 0}) => {
  const {width, height} = useVideoConfig();
  const local = Math.max(0, time - start);
  const span = Math.max(0.001, end - start);
  const breakAge = time - breakAt;
  const columns = useMemo(buildColumns, []);
  const flash = breakAge >= 0 && breakAge < 0.26 ? (1 - breakAge / 0.26) ** 2 : 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#0B090A', overflow: 'hidden'}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{fov: 50, position: [0, 14, 108], near: 0.1, far: 1200}}
        gl={{antialias: true, alpha: false, powerPreference: 'high-performance'}}
        style={{position: 'absolute', inset: 0}}
      >
        <color attach="background" args={[SENBON.ink]} />
        <fog attach="fog" args={[SENBON.ink, 90, 390]} />
        <ambientLight intensity={0.62} color="#FCC934" />
        <directionalLight position={[36, 62, 44]} intensity={1.5} color="#FFE9A3" />
        <directionalLight position={[-42, 30, -30]} intensity={0.55} color={SENBON.cinnabar} />
        <directionalLight position={[0, 18, -60]} intensity={0.42} color={SENBON.gold} />
        <CameraRig local={local} span={span} breakAge={breakAge} />
        <GridGround />
        <Altar breakAge={breakAge} />
        {columns.map((column, index) => (
          <Column key={`column-${index}`} data={column} breakAge={breakAge} local={local} intact={false} />
        ))}
        <Shockwaves breakAge={breakAge} />
        <Dust local={local} breakAge={breakAge} />
      </ThreeCanvas>

      {/* 屏幕空间：冲击白闪 / 网点 / 暗角 / 底部金雾 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 58% 46% at 46% 58%, rgba(252,201,52,${0.1 + flash * 0.36}) 0%, rgba(217,48,37,${0.06 + flash * 0.16}) 44%, rgba(11,9,10,0) 78%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(252,201,52,0.34) 1px, rgba(252,201,52,0) 1.4px)',
          backgroundSize: '9px 9px',
          opacity: 0.1 + flash * 0.2,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 66% at 50% 50%, rgba(11,9,10,0) 42%, rgba(11,9,10,0.7) 78%, rgba(11,9,10,0.97) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundColor: SENBON.paper,
          opacity: flash * 0.2 + pulse * 0.02,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(11,9,10,0.42) 0%, rgba(11,9,10,0) 20%, rgba(11,9,10,0) 76%, rgba(11,9,10,0.68) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export default CrumblingPalace3D;
