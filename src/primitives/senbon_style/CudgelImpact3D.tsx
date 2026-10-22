import React, {useId, useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {hash} from '../../utils/math';
import {clamp01, easeInCubic, easeOutCubic, SENBON} from './style';

export interface CudgelImpact3DProps {
  /** 复刻段绝对秒数。 */
  time: number;
  /** 3D 段开始时刻。 */
  start: number;
  /** 金箍棒触地时刻。 */
  impactAt: number;
  /** 段结束时刻。 */
  end: number;
  /** 0–1 重音脉冲。 */
  pulse?: number;
}

interface ColumnData {
  x: number;
  z: number;
  height: number;
  width: number;
  delay: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  lift: number;
  push: number;
}

const buildColumns = (): ColumnData[] => {
  const columns: ColumnData[] = [];
  const rings = [
    {radius: 15, count: 10},
    {radius: 27, count: 14},
    {radius: 39, count: 16},
  ];
  rings.forEach((ring, ringIndex) => {
    for (let index = 0; index < ring.count; index += 1) {
      const angle = (index / ring.count) * Math.PI * 2 + ringIndex * 0.37;
      const radius = ring.radius + (hash(3301 + ringIndex * 97, index) - 0.5) * 3.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const distance = Math.hypot(x, z);
      columns.push({
        x,
        z,
        height: 5 + hash(4409 + ringIndex, index) * 12 + ringIndex * 2,
        width: 1.5 + hash(5501 + ringIndex, index) * 1.6,
        delay: clamp01(distance / 52) * 0.14,
        spinX: (hash(6607 + ringIndex, index) - 0.5) * 5,
        spinY: (hash(7703 + ringIndex, index) - 0.5) * 5,
        spinZ: (hash(8819 + ringIndex, index) - 0.5) * 5,
        lift: 26 + hash(9901 + ringIndex, index) * 36,
        push: 18 + hash(2213 + ringIndex, index) * 26,
      });
    }
  });
  return columns;
};

const CameraRig: React.FC<{local: number; impact: number}> = ({local, impact}) => {
  const {camera} = useThree();
  const dolly = easeOutCubic(clamp01(local / 1.4));
  const shake = Math.max(0, local - impact);
  const shakeAmount = Math.exp(-shake * 4.4) * (shake >= 0 ? 1 : 0) * 2.6;
  const orbit = local * 0.05;
  camera.position.set(
    Math.sin(orbit) * (22 + dolly * 10) + Math.sin(local * 60) * shakeAmount,
    70 - dolly * 10 + Math.cos(local * 71) * shakeAmount,
    124 - dolly * 22,
  );
  camera.lookAt(0, 4 + Math.sin(local * 3) * 0.6, 0);
  return null;
};

const Ground: React.FC = () => {
  const texture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cells = 8;
      const cell = size / cells;
      for (let y = 0; y < cells; y += 1) {
        for (let x = 0; x < cells; x += 1) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#241A12' : '#120D0B';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      ctx.strokeStyle = 'rgba(252,201,52,0.55)';
      ctx.lineWidth = 2.4;
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
      ctx.lineWidth = 5;
      ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
      const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.55);
      glow.addColorStop(0, 'rgba(252,201,52,0.2)');
      glow.addColorStop(0.55, 'rgba(217,48,37,0.06)');
      glow.addColorStop(1, 'rgba(11,9,10,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 7);
    texture.anisotropy = 4;
    return texture;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      {/* 天庭法阵：同心金环 */}
      {[8, 20, 32, 44].map((radius) => (
        <mesh key={`ring-${radius}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[radius, radius + 0.16, 128]} />
          <meshBasicMaterial color={SENBON.gold} transparent opacity={0.38} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({length: 12}, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return (
          <mesh key={`spoke-${index}`} rotation={[-Math.PI / 2, 0, -angle]} position={[0, 0.012, 0]}>
            <planeGeometry args={[44, 0.12]} />
            <meshBasicMaterial color={SENBON.goldDeep} transparent opacity={0.32} depthWrite={false} />
          </mesh>
        );
      })}
      {/* 中央八卦台 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.2, 5.4, 8]} />
        <meshBasicMaterial color={SENBON.cinnabarDeep} transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

const Column: React.FC<{data: ColumnData; local: number; impactAt: number}> = ({data, local, impactAt}) => {
  const t = Math.max(0, local - impactAt - data.delay);
  const launched = t > 0;
  const gravity = 26;
  const x = data.x + (data.x / Math.max(0.001, Math.hypot(data.x, data.z))) * data.lift * t;
  const z = data.z + (data.z / Math.max(0.001, Math.hypot(data.x, data.z))) * data.lift * t;
  const y = data.height / 2 + (launched ? data.push * t - 0.5 * gravity * t * t : 0);
  const falling = y < -data.height;

  return (
    <group
      position={[x, falling ? -40 : y, z]}
      rotation={[data.spinX * t, data.spinY * t, data.spinZ * t]}
      visible={!falling}
    >
      <mesh castShadow>
        <boxGeometry args={[data.width, data.height, data.width]} />
        <meshStandardMaterial color="#5A4C4F" emissive="#2E2225" emissiveIntensity={0.75} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* 金色顶面 */}
      <mesh position={[0, data.height / 2 + 0.06, 0]}>
        <boxGeometry args={[data.width * 1.08, 0.12, data.width * 1.08]} />
        <meshStandardMaterial color={SENBON.goldDeep} emissive={SENBON.gold} emissiveIntensity={0.35} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* 天条刻纹 */}
      <mesh position={[0, 0, data.width / 2 + 0.01]}>
        <planeGeometry args={[data.width * 0.7, data.height * 0.72]} />
        <meshBasicMaterial color="#120E0F" transparent opacity={0.65} />
      </mesh>
    </group>
  );
};

const Shockwaves: React.FC<{local: number; impactAt: number}> = ({local, impactAt}) => {
  return (
    <group>
      {[0, 0.1, 0.2].map((delay, index) => {
        const t = Math.max(0, local - impactAt - delay);
        const life = 1.1;
        const p = clamp01(t / life);
        const scale = 1 + p * (34 + index * 12);
        const opacity = t > 0 ? (1 - p) ** 1.6 * 0.9 : 0;
        return (
          <mesh
            key={`wave-${index}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.05 + index * 0.02, 0]}
            scale={scale}
            visible={opacity > 0.001}
          >
            <ringGeometry args={[0.86, 1, 160]} />
            <meshBasicMaterial
              color={index === 1 ? SENBON.cinnabar : SENBON.goldLight}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
      {/* 冲击光柱 */}
      {local > impactAt ? (
        <mesh position={[0, 14, 0]}>
          <cylinderGeometry args={[1.4, 5.5, 34, 24, 1, true]} />
          <meshBasicMaterial
            color={SENBON.gold}
            transparent
            opacity={Math.max(0, 0.3 - (local - impactAt) * 0.25)}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
    </group>
  );
};

const Staff: React.FC<{local: number; impactAt: number}> = ({local, impactAt}) => {
  const fall = clamp01(local / Math.max(0.001, impactAt));
  const drop = easeInCubic(fall);
  const y = 92 - drop * 74;
  const after = Math.max(0, local - impactAt);
  const rebound = after > 0 ? Math.sin(after * 15) * Math.exp(-after * 3.2) * 2.2 : 0;
  const spin = local * 0.32;
  return (
    <group position={[0, y + rebound, 0]} rotation={[0.06, spin, 0.035]}>
      {/* 辉光包层 */}
      <mesh>
        <cylinderGeometry args={[1.65, 1.65, 44, 24, 1, true]} />
        <meshBasicMaterial
          color={SENBON.gold}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[0.78, 0.78, 42, 24]} />
        <meshStandardMaterial
          color={SENBON.gold}
          emissive={SENBON.goldLight}
          emissiveIntensity={0.72}
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>
      {/* 两端朱砂箍 */}
      {[-19.2, 19.2].map((offset) => (
        <mesh key={`band-${offset}`} position={[0, offset, 0]}>
          <cylinderGeometry args={[0.94, 0.94, 2.6, 24]} />
          <meshStandardMaterial color={SENBON.cinnabarDeep} emissive={SENBON.cinnabar} emissiveIntensity={0.4} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      {/* 端点金冠 */}
      {[-21.2, 21.2].map((offset) => (
        <mesh key={`cap-${offset}`} position={[0, offset, 0]}>
          <sphereGeometry args={[0.95, 20, 16]} />
          <meshStandardMaterial color={SENBON.goldPale} emissive={SENBON.goldLight} emissiveIntensity={1.4} metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      <pointLight position={[0, 0, 0]} color={SENBON.goldLight} intensity={38} distance={95} decay={2} />
    </group>
  );
};

const Sparks: React.FC<{local: number; impactAt: number}> = ({local, impactAt}) => {
  const positions = useMemo(() => {
    const array = new Float32Array(90 * 3);
    for (let index = 0; index < 90; index += 1) {
      const angle = hash(3311, index) * Math.PI * 2;
      const speed = 8 + hash(4417, index) * 30;
      const lift = 6 + hash(5519, index) * 22;
      const t = Math.max(0, local - impactAt - hash(6613, index) * 0.08);
      const distance = speed * t;
      array[index * 3] = Math.cos(angle) * distance;
      array[index * 3 + 1] = 0.4 + lift * t - 0.5 * 24 * t * t;
      array[index * 3 + 2] = Math.sin(angle) * distance;
    }
    return array;
  }, [impactAt, local]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={SENBON.goldLight}
        size={0.4}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const DustField: React.FC<{local: number}> = ({local}) => {
  const positions = useMemo(() => {
    const array = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      array[index * 3] = (hash(7703, index) - 0.5) * 120;
      array[index * 3 + 1] = 2 + hash(8819, index) * 46;
      array[index * 3 + 2] = (hash(9901, index) - 0.5) * 120;
    }
    return array;
  }, []);
  const drift = (local * 1.4) % 30;
  return (
    <points position={[0, drift, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={SENBON.gold} size={0.28} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
    </points>
  );
};

const Scene: React.FC<{local: number; impactAt: number}> = ({local, impactAt}) => {
  const columns = useMemo(buildColumns, []);
  return (
    <>
      <color attach="background" args={['#0B090A']} />
      <fog attach="fog" args={['#0B090A', 190, 470]} />
      <ambientLight intensity={0.42} color="#FCC934" />
      <directionalLight position={[24, 60, 30]} intensity={1.1} color="#FFE9A3" />
      <directionalLight position={[-30, 24, -20]} intensity={0.4} color="#D93025" />
      <CameraRig local={local} impact={impactAt} />
      <Ground />
      {columns.map((column, index) => (
        <Column key={`column-${index}`} data={column} local={local} impactAt={impactAt} />
      ))}
      <Staff local={local} impactAt={impactAt} />
      <Shockwaves local={local} impactAt={impactAt} />
      <Sparks local={local} impactAt={impactAt} />
      <DustField local={local} />
    </>
  );
};

/**
 * Shot 2 后半：Three.js 三渲二天庭棋盘。
 *
 * 俯视斜角：暗金棋盘格地面、40 根天条方柱、金箍棒从天而降；触地后三圈
 * 赤金冲击波扩散，40 根方柱按抛物线向四周崩飞并自旋。
 */
export const CudgelImpact3D: React.FC<CudgelImpact3DProps> = ({
  time,
  start,
  impactAt,
  end,
  pulse = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `c3d-${rawId}-${suffix}`;
  const local = Math.max(0, time - start);
  const span = Math.max(0.001, end - start);
  const progress = clamp01(local / span);
  const impactAge = time - impactAt;
  const flash = impactAge >= 0 && impactAge < 0.18 ? (1 - impactAge / 0.18) ** 2 : 0;

  return (
    <AbsoluteFill style={{backgroundColor: SENBON.ink, overflow: 'hidden'}}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{fov: 38, position: [0, 68, 122], near: 0.1, far: 500}}
        gl={{antialias: true, alpha: false, powerPreference: 'high-performance'}}
        style={{position: 'absolute', inset: 0}}
      >
        <Scene local={local} impactAt={impactAt - start >= 0 ? impactAt - start : 0.4} />
      </ThreeCanvas>

      {/* 屏幕空间后处理：金雾、网点、暗角 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 48% 40% at 50% 58%, rgba(252,201,52,${0.08 + flash * 0.22}) 0%, rgba(217,48,37,${0.05 + flash * 0.1}) 42%, rgba(11,9,10,0) 76%)`,
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle, rgba(252,201,52,0.28) 1px, rgba(252,201,52,0) 1.3px)`,
          backgroundSize: '9px 9px',
          opacity: 0.12 + flash * 0.14,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 66% 62% at 50% 50%, rgba(11,9,10,0) 46%, rgba(11,9,10,0.62) 78%, rgba(11,9,10,0.94) 100%)`,
        }}
      />
      {/* 冲击波屏幕环 */}
      {impactAge >= 0 && impactAge < 0.9
        ? [0, 0.1, 0.2].map((delay, index) => {
            const t = impactAge - delay;
            if (t < 0) return null;
            const p = clamp01(t / 0.75);
            const size = 180 + p * 1900;
            return (
              <div
                key={`screen-wave-${index}`}
                style={{
                  position: 'absolute',
                  left: 960 - size / 2,
                  top: 610 - size / 2,
                  width: size,
                  height: size * 0.42,
                  borderRadius: '50%',
                  border: `${3 + (1 - p) * 8}px solid ${index === 1 ? SENBON.cinnabar : SENBON.gold}`,
                  transform: 'translateY(0)',
                  opacity: (1 - p) ** 2 * 0.55,
                  filter: `blur(${p * 4}px)`,
                }}
              />
            );
          })
        : null}

      {/* 段末金雾转场 */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `linear-gradient(180deg, rgba(11,9,10,0) 50%, rgba(11,9,10,${0.3 + progress * 0.5}) 100%)`,
        }}
      />

      {/* 角落小字：只做场景内材料标注，不占版面 */}
      <div
        style={{
          position: 'absolute',
          right: 56,
          bottom: 40,
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.34em',
          color: `rgba(244,239,230,${0.18 + pulse * 0.12})`,
        }}
      >
        RUDRA · 40 PILLARS · 3 RINGS
      </div>

      <div style={{position: 'absolute', left: 56, bottom: 40, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.34em', color: `rgba(252,201,52,${0.25 + progress * 0.2})`}}>
        {`IMPACT ${Math.max(0, impactAge).toFixed(2)}s`}
      </div>
    </AbsoluteFill>
  );
};
