// Ground-truth probe: runs the exact `getVisualization` used by visualizeAudio()
// over every frame of the climax stem, then reports band statistics.
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const dist = resolve('node_modules/@remotion/media-utils/dist');
const {getVisualization} = require(resolve(dist, 'fft/get-visualization.js'));
const {getMaxPossibleMagnitude} = require(resolve(dist, 'fft/max-value-cached.js'));

const wavPath = process.argv[2] ?? 'public/audio/drums_stem.wav';
const fps = Number(process.argv[3] ?? 30);

const buffer = readFileSync(wavPath);
let offset = 12;
let fmt = null;
let data = null;
while (offset < buffer.length) {
  const id = buffer.toString('ascii', offset, offset + 4);
  const size = buffer.readUInt32LE(offset + 4);
  const body = buffer.subarray(offset + 8, offset + 8 + size);
  if (id === 'fmt ') {
    fmt = {
      format: body.readUInt16LE(0),
      channels: body.readUInt16LE(2),
      sampleRate: body.readUInt32LE(4),
      bits: body.readUInt16LE(14),
    };
  } else if (id === 'data') {
    data = body;
  }
  offset += 8 + size + (size % 2);
}

if (!fmt || !data) throw new Error('bad wav');
const samples = data.length / 2;
const wave = new Float32Array(samples);
for (let i = 0; i < samples; i += 1) wave[i] = data.readInt16LE(i * 2) / 32768;

const audioData = {
  channelWaveforms: [wave],
  sampleRate: fmt.sampleRate,
  numberOfChannels: 1,
  durationInSeconds: samples / fmt.sampleRate,
  resultId: 'probe',
};
const maxInt = getMaxPossibleMagnitude(audioData);

const frames = Math.round(audioData.durationInSeconds * fps);
const table = [];
for (let frame = 0; frame < frames; frame += 1) {
  const bars = getVisualization({
    sampleSize: 64,
    data: wave,
    frame,
    fps,
    sampleRate: fmt.sampleRate,
    maxInt,
    optimizeFor: 'speed',
    dataOffsetInSeconds: 0,
  });
  table.push(bars.map((value) => Number(value.toFixed(5))));
}

const groups = {
  low: [0, 1, 2],
  loMid: [3, 4, 5, 6, 7],
  hiMid: [8, 9, 10, 11, 12, 13, 14, 15],
  high: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
};
const stats = {};
for (const [name, indices] of Object.entries(groups)) {
  const series = table.map(
    (bars) => indices.reduce((sum, index) => sum + bars[index], 0) / indices.length,
  );
  const max = Math.max(...series);
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const sorted = [...series].sort((a, b) => a - b);
  stats[name] = {
    max: Number(max.toFixed(5)),
    mean: Number(mean.toFixed(5)),
    p50: Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(5)),
    p90: Number(sorted[Math.floor(sorted.length * 0.9)].toFixed(5)),
    series: series.map((v) => Number((v / (max || 1)).toFixed(4))),
  };
  console.log(
    `${name.padEnd(6)} max=${max.toFixed(5)} mean=${mean.toFixed(5)} p90=${stats[name].p90}`,
  );
}

// Bucket energy profile (average over time) shows where the content lives.
const profile = Array.from({length: 32}, (_, index) => {
  const values = table.map((bars) => bars[index]);
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(5));
});
console.log(
  'buckets: ' + profile.map((v, i) => `${i}:${(v * 1000).toFixed(1)}`).join(' '),
);

writeFileSync(
  'out/ref/spectrum_probe.json',
  JSON.stringify({fps, duration: audioData.durationInSeconds, profile, stats}, null, 1),
);
console.log('wrote out/ref/spectrum_probe.json');
