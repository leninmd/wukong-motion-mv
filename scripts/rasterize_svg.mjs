// Rasterize a vtracer SVG at a target width with resvg (Rust).
// Usage: node scripts/rasterize_svg.mjs <input.svg> <output.png> [width] [background]
import fs from 'node:fs';
import {Resvg} from '@resvg/resvg-js';

const [input, output, widthRaw, backgroundRaw] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/rasterize_svg.mjs <input.svg> <output.png> [width] [background]');
  process.exit(2);
}
const width = widthRaw ? Number(widthRaw) : undefined;
const background = backgroundRaw ?? '#FFFFFF';
const svg = fs.readFileSync(input);
const resvg = new Resvg(svg, {
  fitTo: width ? {mode: 'width', value: width} : undefined,
  background,
  font: {loadSystemFonts: false},
});
const rendered = resvg.render();
fs.mkdirSync(output.replace(/[\\/][^\\/]+$/, ''), {recursive: true});
fs.writeFileSync(output, rendered.asPng());
console.log(`[resvg] ${output} ${rendered.width}x${rendered.height}`);
