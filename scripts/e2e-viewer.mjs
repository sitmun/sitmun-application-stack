#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
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

function envWithViewerNode(env = process.env) {
  const nvmrcPath = join(viewerRoot, '.nvmrc');
  if (!existsSync(nvmrcPath)) {
    return { ...env };
  }
  const version = readFileSync(nvmrcPath, 'utf8').trim().replace(/^v/, '');
  const nvmDir = env.NVM_DIR || join(homedir(), '.nvm');
  const bin = join(nvmDir, 'versions', 'node', `v${version}`, 'bin');
  if (!existsSync(join(bin, 'node'))) {
    fail(
      prefix,
      `Node v${version} from ${nvmrcPath} not found at ${bin}. Run: nvm install ${version}`
    );
  }
  const prior = env.NODE_OPTIONS || '';
  const nodeOptions = prior.includes('max-old-space-size')
    ? prior
    : `${prior} --max-old-space-size=8192`.trim();
  return {
    ...env,
    PATH: `${bin}${delimiter}${env.PATH || ''}`,
    NODE_OPTIONS: nodeOptions,
  };
}

const childEnv = envWithViewerNode(process.env);
console.error('[e2e-viewer] Starting viewer on port 4400...');

const child = spawnDetached(npmCmd, ['run', 'start:e2e', '--', '--port', '4400'], {
  cwd: viewerRoot,
  env: childEnv,
});

attachChildLifecycle(child, { prefix });
