// 保持会话存活的 Antigravity 调用：stream-json 模式，stdin 不关闭，
// 这样 image-generator 子 agent 有足够时间跑完并落盘。
import {spawn} from 'node:child_process';
import {existsSync, statSync} from 'node:fs';
import {resolve} from 'node:path';

// CLI 位置可用 AGY_EXE 覆盖；--add-dir 用当前工作目录，避免硬编码仓库路径
const EXE = process.env.AGY_EXE || 'D:\\AI\\apps\\antigravity-cli\\agy.exe';
const prompt = process.argv[2];
const target = process.argv[3];
const timeoutMs = Number(process.argv[4] ?? 480000);
if (!prompt || !target) {
  console.error('usage: node agy_image.mjs "<prompt>" <targetPath> [timeoutMs]');
  process.exit(2);
}

const args = [
  '--input-format=stream-json',
  '--output-format=stream-json',
  '--effort',
  'low',
  '--dangerously-skip-permissions',
  '--add-dir',
  process.env.AGY_WORKDIR || process.cwd(),
];

const child = spawn(EXE, args, {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});

let sawPath = false;
let sawResult = false;
let finished = false;

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

let buf = '';
child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  const lines = buf.split('\n');
  buf = lines.pop() ?? '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let evt = null;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      console.log(`[${stamp()}] RAW ${trimmed.slice(0, 200)}`);
      continue;
    }
    const type = evt.event ?? evt.type ?? '?';
    if (type === 'step_update' && evt.step_update?.text_delta) {
      process.stdout.write(evt.step_update.text_delta);
      continue;
    }
    const text = JSON.stringify(evt);
    if (/\.png/i.test(text)) sawPath = true;
    if (type === 'result') sawResult = true;
    console.log(`[${stamp()}] ${type} ${text.length > 320 ? text.slice(0, 320) + '…' : text}`);
  }
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString('utf8').trim();
  if (text) console.log(`[${stamp()}] ERR ${text.slice(0, 300)}`);
});

const userEvent = JSON.stringify({event: 'user', message: {content: prompt}});
child.stdin.write(userEvent + '\n'); // 注意：不 end，保持会话

const timer = setTimeout(() => {
  console.log(`[${stamp()}] timeout — killing`);
  try {
    child.kill();
  } catch {}
}, timeoutMs);

const poll = setInterval(() => {
  if (existsSync(target)) {
    const size = statSync(target).size;
    console.log(`[${stamp()}] file present ${size} bytes`);
    if (size > 4096) {
      console.log(`[${stamp()}] DONE ${target}`);
      clearInterval(poll);
      clearTimeout(timer);
      try {
        child.stdin.end();
      } catch {}
      setTimeout(() => {
        try {
          child.kill();
        } catch {}
        process.exit(0);
      }, 1500);
    }
  }
}, 3000);

child.on('close', (code) => {
  finished = true;
  clearInterval(poll);
  clearTimeout(timer);
  const ok = existsSync(target);
  console.log(`[${stamp()}] close code=${code} file=${ok} sawPath=${sawPath} sawResult=${sawResult}`);
  process.exit(ok ? 0 : 1);
});
void finished;
void resolve;
