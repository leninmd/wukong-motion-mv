/**
 * 把 `src/primitives/senbon_style/wukongRigGeometry.ts` 导出成角色资产。
 *
 * 单一真源：TS 几何模块既是运行时的 SVG 数据源，也是离线资产的来源；
 * 这里只做序列化，不复制任何坐标。
 *
 * 产物（public/wukong_model/）：
 *   wukong_rig.json          四姿态的完整多边形 JSON
 *   wukong_<pose>.svg        高精度矢量轮廓（可直接给设计/审片用）
 *
 * 用法： node scripts/export_wukong_model.mjs
 */

import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'wukong_model');

const geometry = await import(
  pathToFileURL(path.join(ROOT, 'src', 'primitives', 'senbon_style', 'wukongRigGeometry.ts')).href
);

const {POSES, POSE_IDS, RIG_W, RIG_H, polygonPoints, polygonPath} = geometry;

const FILL = {
  ink: '#0B090A',
  gold: '#FCC934',
  cinnabar: '#D93025',
  goldLine: 'none',
  rim: 'rgba(252,201,52,0.10)',
};

const svgFor = (pose) => {
  const g = POSES[pose];
  const parts = [...g.parts].sort((a, b) => a.layer - b.layer);
  const body = parts
    .map((item) => {
      const fill = FILL[item.material] ?? FILL.ink;
      const stroke = item.material === 'goldLine' ? '#FCC934' : '#FCC934';
      const width = item.material === 'goldLine' ? 2 : item.material === 'rim' ? 1.2 : 2;
      const opacity = item.material === 'goldLine' ? 0.62 : 1;
      return `    <polygon data-part="${item.id}" data-layer="${item.layer}" points="${polygonPoints(
        item.points,
      )}" fill="${fill}" fill-opacity="${item.material === 'rim' ? 1 : 1}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linejoin="miter" />`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RIG_W} ${RIG_H}" width="${RIG_W}" height="${RIG_H}">
  <title>WukongRig · ${pose}</title>
  <desc>Sharp angular polygon armor cutout. Interior #0B090A, 2px gilded rim. No facial
  features other than the two inverted-triangle eyes and the gold headband.</desc>
  <defs>
    <filter id="gold-glow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#FCC934" />
    </filter>
    <linearGradient id="gold-fill" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#FFEFB0" />
      <stop offset="46%" stop-color="#FCC934" />
      <stop offset="100%" stop-color="#9A6A0D" />
    </linearGradient>
    <linearGradient id="eye-fill" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#FFF7DA" />
      <stop offset="46%" stop-color="#FCC934" />
      <stop offset="100%" stop-color="#D93025" />
    </linearGradient>
  </defs>
  <g filter="url(#gold-glow)">
${body}
    <polygon data-part="crown" points="${polygonPoints(g.crown)}" fill="url(#gold-fill)" stroke="#FFEFB0" stroke-width="1.6" />
${g.crownWings
  .map(
    (wing, index) =>
      `    <polygon data-part="crown-wing-${index}" points="${polygonPoints(wing)}" fill="url(#gold-fill)" stroke="#FFEFB0" stroke-width="1.4" />`,
  )
  .join('\n')}
    <polygon data-part="crown-crest" points="${polygonPoints(g.crownCrest)}" fill="#FFEFB0" stroke="#FCC934" stroke-width="1.4" />
    <polygon data-part="eye-left" points="${polygonPoints(g.eyes.left)}" fill="url(#eye-fill)" stroke="#FCC934" stroke-width="1.6" />
    <polygon data-part="eye-right" points="${polygonPoints(g.eyes.right)}" fill="url(#eye-fill)" stroke="#FCC934" stroke-width="1.6" />
    <polygon data-part="eye-core-left" points="${polygonPoints(g.eyes.coreLeft)}" fill="#FFF7DA" opacity="0.75" />
    <polygon data-part="eye-core-right" points="${polygonPoints(g.eyes.coreRight)}" fill="#FFF7DA" opacity="0.75" />
  </g>
  <metadata>${JSON.stringify({
    pose,
    eyeFocus: g.eyeFocus,
    feathers: g.feathers,
    staff: g.staff,
  })}</metadata>
</svg>
`;
};

await mkdir(OUT, {recursive: true});

const manifest = {
  generator: 'scripts/export_wukong_model.mjs',
  source: 'src/primitives/senbon_style/wukongRigGeometry.ts',
  viewBox: [RIG_W, RIG_H],
  palette: {ink: '#0B090A', paper: '#F4EFE6', cinnabar: '#D93025', gold: '#FCC934'},
  poses: {},
};

for (const pose of POSE_IDS) {
  const g = POSES[pose];
  const svg = svgFor(pose);
  await writeFile(path.join(OUT, `wukong_${pose}.svg`), svg, 'utf8');
  manifest.poses[pose] = {
    svg: `wukong_${pose}.svg`,
    png: `wukong_${pose}.png`,
    parts: g.parts.length,
    polygons: g.parts.length + g.crownWings.length + 4,
    vertices: g.parts.reduce((sum, item) => sum + item.points.length, 0),
    feathers: g.feathers.length,
    staff: Boolean(g.staff),
    pathPreview: polygonPath(g.parts[0]?.points ?? []).slice(0, 48),
  };
}

await writeFile(
  path.join(OUT, 'wukong_rig.json'),
  JSON.stringify(
    {
      version: 3,
      viewBox: [RIG_W, RIG_H],
      poses: Object.fromEntries(POSE_IDS.map((pose) => [pose, POSES[pose]])),
    },
    null,
    1,
  ),
  'utf8',
);

await writeFile(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8',
);

console.log(`exported ${POSE_IDS.length} poses → ${path.relative(ROOT, OUT)}`);
for (const pose of POSE_IDS) {
  console.log(
    `  ${pose.padEnd(20)} parts=${String(POSES[pose].parts.length).padStart(3)}  vertices=${String(
      POSES[pose].parts.reduce((sum, item) => sum + item.points.length, 0),
    ).padStart(4)}`,
  );
}
