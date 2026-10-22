#!/usr/bin/env node
/**
 * engine/qa-gate.mjs — 强制质量门入口（Capsule Cinema 规范）
 *
 * 本仓库的渲染管线是 Python（Playwright + ffmpeg），因此把探针实现放在
 * render/qa_probe.py，这里作为 node 入口统一调用：
 *
 *   node engine/qa-gate.mjs            # 断言 11 项，失败退出码 1
 *   node engine/qa-gate.mjs --json     # 只输出 JSON
 *
 * 退出码 0 = QA_PASSED（可进入合成）；1 = QA_FAILED（必须返工）。
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probe = path.join(ROOT, 'render', 'qa_probe.py');
const args = process.argv.slice(2);

const py = process.platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(py, [probe, ...args], { cwd: ROOT, stdio: 'inherit' });

if (r.error) {
  console.error('[qa-gate] 无法启动探针:', r.error.message);
  process.exit(2);
}
process.exit(r.status === null ? 2 : r.status);
