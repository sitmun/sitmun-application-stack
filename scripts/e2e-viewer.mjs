#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachChildLifecycle, fail, isWindows, spawnDetached } from './e2e-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const viewerRoot = join(stackRoot, 'front', 'viewer', 'sitmun-viewer-app');
const prefix = 'e2e-viewer';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

if (!existsSync(viewerRoot)) {
  fail(prefix, `Viewer submodule missing at ${viewerRoot}. Run: git submodule update --init --recursive`);
}
if (!existsSync(join(viewerRoot, 'package.json'))) {
  fail(prefix, `Viewer package.json missing at ${viewerRoot}`);
}
if (!existsSync(join(viewerRoot, 'node_modules'))) {
  fail(prefix, `Viewer dependencies missing. Run: cd ${viewerRoot} && npm ci`);
}

console.error('[e2e-viewer] Starting viewer on port 4400...');

const child = spawnDetached(npmCmd, ['run', 'start:e2e', '--', '--port', '4400'], {
  cwd: viewerRoot,
  env: process.env,
});

attachChildLifecycle(child, { prefix });
