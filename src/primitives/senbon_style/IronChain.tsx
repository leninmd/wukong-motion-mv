import React, {useId, useMemo} from 'react';
import {hash} from '../../utils/math';
import {SENBON, f} from './style';

/**
 * `<IronChain />` —— 实体铁索，替代 `stroke-dasharray` 的黄色虚线。
 *
 * 每个链环都是独立 SVG 图元：
 *   · 面环：椭圆外环 + 深色内孔 + 双色高光弧（读得出金属厚度）
 *   · 边环：侧视窄环（90° 转向），与前一个面环互扣
 *   · 环间销钉 + 端部卸扣
 *   · 沿索分布的梵文/篆体铭文（单文本节点，按链向旋转）
 *   · 整体金色辉光 + 一条模糊底线
 *
 * 链索可以是直线，也可以用 `sag` 弯成悬链（悬签阵用）。
 */
export interface IronChainProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 中点下垂量（px，正值向下）。 */
  sag?: number;
  /** 0–1 生长进度。 */
  progress?: number;
  /** 单环长度（px）。 */
  linkLen?: number;
  glow?: number;
  opacity?: number;
  /** 铭文；空字符串关闭。 */
  runeText?: string;
  runeStep?: number;
  seed?: number;
  /** 端点卸扣。 */
  shackles?: boolean;
}

const quad = (
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  t: number,
): [number, number] => {
  const s = 1 - t;
  return [s * s * p0[0] + 2 * s * t * c[0] + t * t * p1[0], s * s * p0[1] + 2 * s * t * c[1] + t * t * p1[1]];
};

const quadTangent = (
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  t: number,
): number => {
  const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
  const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

export const IronChain: React.FC<IronChainProps> = ({
  x1,
  y1,
  x2,
  y2,
  sag = 0,
  progress = 1,
  linkLen = 32,
  glow = 0.6,
  opacity = 1,
  runeText = '唵嘛呢叭咪吽',
  runeStep = 5,
  seed = 1,
  shackles = true,
}) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (suffix: string) => `chain-${rawId}-${suffix}`;
  const p0: [number, number] = [x1, y1];
  const p1: [number, number] = [x2, y2];
  const control: [number, number] = [(x1 + x2) / 2, (y1 + y2) / 2 + sag];

  const geometry = useMemo(() => {
    const steps = 16;
    const points: Array<[number, number]> = [];
    for (let index = 0; index <= steps; index += 1) points.push(quad(p0, control, p1, index / steps));
    const approx =
      Math.hypot(x2 - x1, y2 - y1) * (1 + Math.abs(sag) / Math.max(1, Math.hypot(x2 - x1, y2 - y1)) * 0.6);
    const count = Math.max(4, Math.floor(approx / (linkLen * 0.74)));
    return {points, count};
  }, [x1, y1, x2, y2, sag, linkLen]);

  const visible = Math.max(0, Math.min(1, progress));
  if (visible <= 0) return null;
  const drawCount = Math.max(1, Math.floor(geometry.count * visible));
  const links = Array.from({length: drawCount}, (_, index) => {
    const t = drawCount === 1 ? visible : ((index + 0.5) / geometry.count) * visible;
    const position = quad(p0, control, p1, t);
    const angle = quadTangent(p0, control, p1, t);
    const face = index % 2 === 0;
    return {index, x: position[0], y: position[1], angle, face, t};
  });

  const runes = useMemo(() => {
    if (!runeText) return [];
    const chars = Array.from(runeText);
    return Array.from({length: Math.ceil((geometry.count * visible) / runeStep)}, (_, index) => {
      const t = Math.min(visible, ((index + 0.6) * runeStep) / geometry.count);
      const position = quad(p0, control, p1, t);
      return {
        key: `rune-${index}`,
        x: position[0],
        y: position[1],
        angle: quadTangent(p0, control, p1, t) + (index % 2 === 0 ? 90 : -90),
        char: chars[index % chars.length]!,
      };
    });
  }, [runeText, runeStep, geometry.count, visible]);

  const endPoint = links[links.length - 1]!;

  return (
    <g opacity={opacity} style={{filter: `drop-shadow(0 0 ${4 + glow * 10}px rgba(252,201,52,${0.25 + glow * 0.3}))`}}>
      <defs>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SENBON.goldPale} />
          <stop offset="38%" stopColor={SENBON.gold} />
          <stop offset="72%" stopColor={SENBON.goldDeep} />
          <stop offset="100%" stopColor={SENBON.goldShadow} />
        </linearGradient>
      </defs>

      {/* 模糊底线：让铁索在暗底上先有一层体积 */}
      <path
        d={`M ${f(x1)} ${f(y1)} Q ${f(control[0])} ${f(control[1])} ${f(quad(p0, control, p1, visible)[0])} ${f(
          quad(p0, control, p1, visible)[1],
        )}`}
        fill="none"
        stroke={SENBON.gold}
        strokeWidth={linkLen * 0.55}
        opacity={0.14 + glow * 0.1}
        style={{filter: 'blur(9px)'}}
      />

      {links.map((link) => {
        const rx = link.face ? linkLen * 0.44 : linkLen * 0.17;
        const ry = link.face ? linkLen * 0.27 : linkLen * 0.24;
        return (
          <g key={`link-${link.index}`} transform={`translate(${f(link.x)} ${f(link.y)}) rotate(${f(link.angle)})`}>
            {link.face ? (
              <>
                {/* 面环：厚环 + 内孔 */}
                <ellipse cx="0" cy="0" rx={f(rx)} ry={f(ry)} fill="none" stroke="#060403" strokeWidth={f(linkLen * 0.22)} />
                <ellipse cx="0" cy="0" rx={f(rx)} ry={f(ry)} fill="none" stroke={`url(#${id('gold')})`} strokeWidth={f(linkLen * 0.14)} />
                <ellipse cx="0" cy="0" rx={f(rx)} ry={f(ry)} fill="none" stroke={SENBON.goldPale} strokeWidth="1.4" opacity="0.7" />
                <ellipse cx="0" cy="0" rx={f(rx * 0.55)} ry={f(ry * 0.55)} fill="#0A0708" opacity="0.92" />
                {/* 左上高光弧 */}
                <path
                  d={`M ${f(-rx * 0.82)} ${f(-ry * 0.18)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(-rx * 0.18)} ${f(-ry * 0.86)}`}
                  fill="none"
                  stroke={SENBON.goldPale}
                  strokeWidth="2.2"
                  opacity="0.8"
                />
                {/* 环耳销钉 */}
                <circle cx={f(rx * 0.9)} cy="0" r={f(linkLen * 0.055)} fill={SENBON.goldLight} />
              </>
            ) : (
              <>
                {/* 边环：侧视，暗面压住 */}
                <rect
                  x={f(-rx)}
                  y={f(-ry)}
                  width={f(rx * 2)}
                  height={f(ry * 2)}
                  rx={f(rx * 0.9)}
                  fill="#0A0708"
                  stroke="#050303"
                  strokeWidth={f(linkLen * 0.12)}
                />
                <rect
                  x={f(-rx)}
                  y={f(-ry)}
                  width={f(rx * 2)}
                  height={f(ry * 2)}
                  rx={f(rx * 0.9)}
                  fill="none"
                  stroke={SENBON.goldDeep}
                  strokeWidth={f(linkLen * 0.09)}
                />
                <line x1="0" y1={f(-ry * 0.8)} x2="0" y2={f(ry * 0.8)} stroke={SENBON.goldLight} strokeWidth="1.2" opacity="0.5" />
              </>
            )}
            {/* 环间销钉 */}
            {link.index % 2 === 0 ? (
              <circle cx={f(linkLen * 0.42)} cy="0" r={f(linkLen * 0.06)} fill={SENBON.goldPale} opacity="0.85" />
            ) : null}
          </g>
        );
      })}

      {/* 铭文：沿索旋转 */}
      {runes.map((rune) => (
        <text
          key={rune.key}
          x={f(rune.x)}
          y={f(rune.y - linkLen * 0.34)}
          transform={`rotate(${f(rune.angle)} ${f(rune.x)} ${f(rune.y - linkLen * 0.34)})`}
          textAnchor="middle"
          fontFamily="'Ma Shan Zheng', 'STKaiti', 'KaiTi', serif"
          fontWeight={700}
          fontSize={f(linkLen * 0.72)}
          fill={SENBON.gold}
          opacity="0.92"
          style={{filter: 'drop-shadow(0 0 5px rgba(252,201,52,0.95))'}}
        >
          {rune.char}
        </text>
      ))}

      {/* 端部卸扣 */}
      {shackles && visible > 0.02 ? (
        <g>
          <circle cx={f(x1)} cy={f(y1)} r={f(linkLen * 0.28)} fill="none" stroke={SENBON.gold} strokeWidth={f(linkLen * 0.12)} />
          <circle cx={f(x1)} cy={f(y1)} r={f(linkLen * 0.1)} fill={SENBON.goldPale} />
          {visible > 0.98 ? (
            <>
              <circle
                cx={f(endPoint.x)}
                cy={f(endPoint.y)}
                r={f(linkLen * 0.28)}
                fill="none"
                stroke={SENBON.gold}
                strokeWidth={f(linkLen * 0.12)}
              />
              <circle cx={f(endPoint.x)} cy={f(endPoint.y)} r={f(linkLen * 0.1)} fill={SENBON.goldPale} />
            </>
          ) : null}
        </g>
      ) : null}

      {/* 重量感：随机金屑 */}
      {Array.from({length: 5}, (_, index) => {
        const t = hash(seed + index, 7);
        const position = quad(p0, control, p1, t * visible);
        return (
          <circle
            key={`dust-${index}`}
            cx={f(position[0] + (hash(seed + index, 11) - 0.5) * 18)}
            cy={f(position[1] + (hash(seed + index, 13) - 0.5) * 18)}
            r={f(1 + hash(seed + index, 17) * 2.2)}
            fill={SENBON.gold}
            opacity={0.5 * glow}
          />
        );
      })}
    </g>
  );
};

export default IronChain;
