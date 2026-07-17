#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const adminRoot = join(stackRoot, 'front', 'admin', 'sitmun-admin-app');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(`[e2e-admin] ${message}`);
  process.exit(1);
}

if (!existsSync(adminRoot)) {
  fail(`Admin submodule missing at ${adminRoot}. Run: git submodule update --init --recursive`);
}
if (!existsSync(join(adminRoot, 'package.json'))) {
  fail(`Admin package.json missing at ${adminRoot}`);
}
if (!existsSync(join(adminRoot, 'node_modules'))) {
  fail(`Admin dependencies missing. Run: cd ${adminRoot} && npm ci`);
}

const child = spawn(npmCmd, ['run', 'start:e2e', '--', '--port', '4300'], {
  cwd: adminRoot,
  env: process.env,
  stdio: 'inherit',
  shell: isWindows,
  detached: !isWindows,
});

let shuttingDown = false;

function killTree(force = false) {
  if (!child.pid) {
    return;
  }
  if (isWindows) {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // already gone
    }
    return;
  }
  try {
    process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
  } catch {
    try {
      child.kill(force ? 'SIGKILL' : 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(`[e2e-admin] Shutting down (${signal})...`);
  killTree(false);
  const timer = setTimeout(() => {
    console.error('[e2e-admin] Force-killing admin process tree...');
    killTree(true);
  }, 10_000);
  child.once('exit', () => {
    clearTimeout(timer);
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(signal));
}

child.on('error', (error) => {
  fail(`Failed to start admin: ${error.message}`);
});

child.on('exit', (code, signal) => {
  if (shuttingDown) {
    process.exit(0);
  }
  if (signal) {
    fail(`Admin process terminated by signal ${signal}`);
  }
  if (code !== 0) {
    fail(`Admin exited with code ${code}`);
  }
  process.exit(0);
});
