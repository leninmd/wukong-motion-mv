import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, easeInCubic, f} from './style';

/**
 * Shot 1B 的中景/前景层：
 *   · 40 名天兵从右向左冲锋（不是左右对称合拢）
 *   · 不断射来的箭矢 / 长戈在棍盾边缘弹飞
 *   · 左右边缘掠过 blur(8px) 的巨型长戈黑影
 *   · 脚下沙尘与横向速度线
 *
 * 40 个天兵共用一份 `<defs><g id>` 符号，只做实例变换，避免复制 40 份路径。
 */
export interface SiegeChargeProps {
  time: number;
  frame: number;
  shield: {cx: number; cy: number; radius: number};
  pressure?: number;
  pulse?: number;
}

interface VolleyItem {
  id: number;
  halberd: boolean;
  angle: number;
  cycle: number;
  offset: number;
  lift: number;
  startY: number;
}

export const SiegeCharge: React.FC<SiegeChargeProps> = ({time, frame, shield, pressure = 0.6, pulse = 0}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `siege-${rawId}-${suffix}`;

  const soldiers = useMemo(
    () =>
      Array.from({length: 40}, (_, index) => {
        const rank = index % 4;
        const row = Math.floor(index / 4);
        const rankConf = [
          {y: 706, scale: 0.66, speed: 160, opacity: 0.32, blur: 1.8},
          {y: 824, scale: 1.0, speed: 250, opacity: 0.56, blur: 0.7},
          {y: 952, scale: 1.44, speed: 350, opacity: 0.84, blur: 0},
          {y: 1086, scale: 1.92, speed: 470, opacity: 0.97, blur: 0},
        ][rank]!;
        return {
          key: `soldier-${index}`,
          rank,
          offset: hash(1201 + rank, row) * 2600 + row * 42,
          xSpeed: rankConf.speed,
          y: rankConf.y + (hash(2203 + rank, row) - 0.5) * 26,
          scale: rankConf.scale * (0.92 + hash(3307 + rank, row) * 0.16),
          opacity: rankConf.opacity,
          blur: rankConf.blur,
          bobPhase: hash(4409 + rank, row) * Math.PI * 2,
          tilt: 4 + hash(5501 + rank, row) * 5,
        };
      }),
    [],
  );

  const volley = useMemo<VolleyItem[]>(
    () =>
      Array.from({length: 18}, (_, index) => ({
        id: index,
        halberd: index % 5 === 0,
        angle: -0.85 + hash(6601, index) * 1.5,
        cycle: 0.72 + (index % 4) * 0.13,
        offset: hash(6602, index) * 0.9,
        lift: 0.4 + hash(6603, index) * 0.9,
        startY: shield.cy + (hash(6604, index) - 0.5) * 620,
      })),
    [shield.cy],
  );

  const dust = useMemo(
    () =>
      Array.from({length: 28}, (_, index) => ({
        x: hash(7701, index) * 1920,
        y: 960 + hash(7702, index) * 120,
        r: 10 + hash(7703, index) * 42,
        a: 0.03 + hash(7704, index) * 0.08,
        drift: 0.4 + hash(7705, index) * 1.2,
      })),
    [],
  );

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden'}}>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
        <defs>
          {/* 天兵符号：面朝左，长戈前指 */}
          <g id={id('soldier')}>
            <path d="M -26 -206 C -64 -196 -78 -150 -58 -116 L -30 -132 C -46 -160 -40 -188 -14 -196 Z" fill="#120D0E" stroke={SENBON.gold} strokeOpacity="0.28" strokeWidth="1.6" />
            <path d="M -18 -120 L -4 -8 L -24 -8 L -34 -116 Z" fill="#0B090A" />
            <path d="M 8 -120 L 22 -8 L 2 -8 L -6 -116 Z" fill="#0B090A" />
            <path d="M -28 -8 L 4 -8 L 2 -18 L -30 -18 Z" fill="#151011" stroke={SENBON.gold} strokeOpacity="0.35" strokeWidth="1" />
            <path d="M 0 -8 L 32 -8 L 30 -18 L -2 -18 Z" fill="#151011" stroke={SENBON.gold} strokeOpacity="0.35" strokeWidth="1" />
            <path d="M -42 -196 L 34 -196 L 40 -126 L -50 -126 Z" fill="#171012" stroke={SENBON.gold} strokeOpacity="0.4" strokeWidth="1.8" />
            {[-184, -166, -148].map((y) => (
              <path key={`lame-${y}`} d={`M -40 ${y} Q 0 ${y + 7} 38 ${y}`} fill="none" stroke={SENBON.gold} strokeOpacity="0.3" strokeWidth="1.1" />
            ))}
            <path d="M -2 -178 L 7 -168 L -2 -158 L -11 -168 Z" fill={SENBON.gold} opacity="0.7" />
            {/* 肩甲 */}
            <path d="M -48 -200 C -76 -190 -78 -160 -54 -154 L -34 -160 Z" fill="#1C1315" stroke={SENBON.gold} strokeOpacity="0.45" strokeWidth="1.5" />
            <path d="M 40 -200 C 68 -190 70 -160 46 -154 L 26 -160 Z" fill="#1C1315" stroke={SENBON.gold} strokeOpacity="0.45" strokeWidth="1.5" />
            {/* 头盔 */}
            <path d="M -24 -212 C -38 -246 -10 -270 4 -270 C 20 -270 44 -246 30 -212 Z" fill="#0D090A" stroke={SENBON.gold} strokeOpacity="0.6" strokeWidth="1.8" />
            <path d="M -27 -218 L 31 -218" stroke={SENBON.goldLight} strokeWidth="2.2" opacity="0.85" />
            <path d="M -20 -226 Q 2 -218 24 -226" fill="none" stroke={SENBON.cinnabar} strokeWidth="2.4" opacity="0.8" />
            <path d="M 2 -270 C -6 -300 8 -320 2 -344" fill="none" stroke={SENBON.cinnabar} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
            {/* 长戈：向左前伸 */}
            <line x1="-24" y1="-176" x2="-118" y2="-286" stroke={SENBON.silverDim} strokeWidth="5.4" strokeLinecap="round" />
            <line x1="-24" y1="-176" x2="-118" y2="-286" stroke={SENBON.silver} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M -118 -286 L -148 -304 L -136 -276 L -154 -262 L -122 -272 Z" fill={SENBON.silver} stroke={SENBON.paper} strokeWidth="1.2" />
            <path d="M -116 -284 C -132 -286 -142 -292 -148 -302" fill="none" stroke={SENBON.paper} strokeWidth="1.1" opacity="0.8" />
            <path d="M -64 -238 C -74 -232 -80 -222 -78 -214" fill="none" stroke={SENBON.cinnabar} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          </g>

          <linearGradient id={id('dust')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={SENBON.gold} stopOpacity="0" />
            <stop offset="50%" stopColor={SENBON.gold} stopOpacity="0.3" />
            <stop offset="100%" stopColor={SENBON.gold} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id('puff')} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={SENBON.paperDim} stopOpacity="0.5" />
            <stop offset="100%" stopColor={SENBON.paperDim} stopOpacity="0" />
          </radialGradient>
          <filter id={id('fgBlur')} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* 横向速度线 */}
        <g opacity={0.28 + pressure * 0.2}>
          {Array.from({length: 30}, (_, index) => {
            const y = 200 + hash(8801, index) * 840;
            const length = 100 + hash(8802, index) * 360;
            const x = ((hash(8803, index) * 1920 - time * (220 + hash(8804, index) * 480)) % 2200 + 2200) % 2200 - 140;
            return (
              <line
                key={`speed-${index}`}
                x1={f(x)}
                y1={f(y)}
                x2={f(x + length)}
                y2={f(y + (hash(8805, index) - 0.5) * 8)}
                stroke={index % 5 === 0 ? SENBON.gold : SENBON.paperShade}
                strokeWidth={index % 5 === 0 ? 2 : 0.9}
                opacity={0.08 + hash(8806, index) * 0.2}
              />
            );
          })}
        </g>

        {/* 40 名冲锋天兵 */}
        {soldiers.map((soldier) => {
          const travel = (soldier.offset + time * soldier.xSpeed) % 2600;
          const x = 2240 - travel;
          if (x < -420 || x > 2260) return null;
          const bob = Math.sin(time * 7 + soldier.bobPhase) * (1.6 + soldier.rank * 0.9);
          const flip = 1;
          return (
            <g key={soldier.key} opacity={soldier.opacity} style={soldier.blur > 0 ? {filter: `blur(${soldier.blur}px)`} : undefined}>
              <line
                x1={f(x + 120)}
                y1={f(soldier.y - 40)}
                x2={f(x + 330)}
                y2={f(soldier.y - 40)}
                stroke={SENBON.gold}
                strokeWidth={f(2 * soldier.scale)}
                opacity="0.12"
              />
              <g
                transform={`translate(${f(x)} ${f(soldier.y + bob)}) scale(${f(soldier.scale * flip)} ${f(soldier.scale)}) rotate(${f(
                  -soldier.tilt,
                )})`}
              >
                <use href={`#${id('soldier')}`} />
              </g>
            </g>
          );
        })}

        {/* 箭矢 / 长戈弹飞 */}
        {volley.map((item) => {
          const phase = ((time + item.offset) / item.cycle) % 1;
          const targetX = shield.cx + Math.cos(item.angle) * shield.radius * 1.02;
          const targetY = shield.cy + Math.sin(item.angle) * shield.radius * 1.02;
          const startX = 2020;
          const startY = item.startY;
          if (phase < 0.66) {
            const t = easeInCubic(phase / 0.66);
            const x = startX + (targetX - startX) * t;
            const y = startY + (targetY - startY) * t;
            const baseAngle = Math.atan2(targetY - startY, targetX - startX);
            const len = item.halberd ? 140 : 76;
            const tailX = x - Math.cos(baseAngle) * len;
            const tailY = y - Math.sin(baseAngle) * len;
            return (
              <g key={`volley-${item.id}`}>
                <line x1={f(tailX)} y1={f(tailY)} x2={f(x)} y2={f(y)} stroke={SENBON.silver} strokeWidth={item.halberd ? 5 : 2.4} opacity="0.9" />
                <line x1={f(tailX)} y1={f(tailY)} x2={f(x)} y2={f(y)} stroke={SENBON.paper} strokeWidth="0.9" opacity="0.6" />
                {item.halberd ? (
                  <polygon
                    points={`${f(x)},${f(y)} ${f(x - Math.cos(baseAngle - 0.5) * 34)},${f(y - Math.sin(baseAngle - 0.5) * 34)} ${f(
                      x - Math.cos(baseAngle) * 58,
                    )},${f(y - Math.sin(baseAngle) * 58)} ${f(x - Math.cos(baseAngle + 0.42) * 28)},${f(y - Math.sin(baseAngle + 0.42) * 28)}`}
                    fill={SENBON.silver}
                    stroke={SENBON.paper}
                    strokeWidth="1.2"
                  />
                ) : (
                  <polygon
                    points={`${f(x)},${f(y)} ${f(x - Math.cos(baseAngle - 0.17) * 18)},${f(y - Math.sin(baseAngle - 0.17) * 18)} ${f(
                      x - Math.cos(baseAngle + 0.17) * 18,
                    )},${f(y - Math.sin(baseAngle + 0.17) * 18)}`}
                    fill={SENBON.paper}
                  />
                )}
                {/* 速度残影 */}
                <line
                  x1={f(tailX - Math.cos(baseAngle) * 100)}
                  y1={f(tailY - Math.sin(baseAngle) * 100)}
                  x2={f(tailX)}
                  y2={f(tailY)}
                  stroke={SENBON.gold}
                  strokeWidth="1.2"
                  opacity="0.28"
                />
              </g>
            );
          }
          // 弹飞
          const t = (phase - 0.66) / 0.34;
          const bounceAngle = item.angle + Math.PI * 0.42 + (item.id % 3) * 0.12;
          const distance = 120 + t * 620;
          const x = targetX + Math.cos(bounceAngle) * distance;
          const y = targetY + Math.sin(bounceAngle) * distance - 220 * t + 520 * t * t;
          if (t > 0.9) return null;
          return (
            <g key={`volley-${item.id}`} opacity={1 - t}>
              <line x1={f(x)} y1={f(y)} x2={f(x - Math.cos(bounceAngle) * 60)} y2={f(y - Math.sin(bounceAngle) * 60)} stroke={SENBON.silverDim} strokeWidth="2" />
              <polygon
                points={`${f(x)},${f(y)} ${f(x - Math.cos(bounceAngle - 0.2) * 14)},${f(y - Math.sin(bounceAngle - 0.2) * 14)} ${f(
                  x - Math.cos(bounceAngle + 0.2) * 14,
                )},${f(y - Math.sin(bounceAngle + 0.2) * 14)}`}
                fill={SENBON.paper}
              />
              {Array.from({length: 3}, (_, spark) => (
                <circle
                  key={`spark-${spark}`}
                  cx={f(targetX + (hash(9901 + item.id, spark) - 0.5) * 90 * t)}
                  cy={f(targetY + (hash(9902 + item.id, spark) - 0.5) * 90 * t)}
                  r={f(2 + spark)}
                  fill={spark === 0 ? SENBON.paper : SENBON.gold}
                  opacity={1 - t}
                />
              ))}
            </g>
          );
        })}

        {/* 脚下沙尘 */}
        <g>
          {dust.map((puff, index) => (
            <ellipse
              key={`dust-${index}`}
              cx={f(puff.x + Math.sin(time * puff.drift + index) * 20)}
              cy={f(puff.y)}
              rx={f(puff.r)}
              ry={f(puff.r * 0.32)}
              fill={`url(#${id('puff')})`}
              opacity={puff.a + pulse * 0.04}
            />
          ))}
        </g>

        {/* 前景巨型长戈黑影：左右边缘掠过，blur(8px) */}
        <g filter={`url(#${id('fgBlur')})`} opacity="0.88">
          <g transform={`translate(${f(-220 - ((time * 160) % 260))} 0) rotate(28 300 900)`}>
            <rect x="210" y="380" width="34" height="920" fill="#080506" stroke={SENBON.gold} strokeWidth="2" strokeOpacity="0.35" />
            <path d="M 210 380 L 160 300 L 210 210 L 262 300 Z" fill="#0B090A" stroke={SENBON.gold} strokeWidth="2.2" strokeOpacity="0.45" />
            <path d="M 210 380 L 210 250" stroke={SENBON.gold} strokeWidth="2" opacity="0.4" />
          </g>
          <g transform={`translate(${f(1920 + ((time * 190) % 300))} 0) rotate(-22 1620 860)`}>
            <rect x="1600" y="300" width="40" height="980" fill="#080506" stroke={SENBON.gold} strokeWidth="2" strokeOpacity="0.35" />
            <path d="M 1600 300 L 1540 205 L 1600 110 L 1660 205 Z" fill="#0B090A" stroke={SENBON.gold} strokeWidth="2.4" strokeOpacity="0.45" />
            <path d="M 1600 300 L 1600 150" stroke={SENBON.gold} strokeWidth="2" opacity="0.4" />
          </g>
        </g>

        {/* 底部压暗 */}
        <rect x="0" y="900" width="1920" height="180" fill={SENBON.ink} opacity="0.55" />
      </svg>
    </div>
  );
};

export default SiegeCharge;
