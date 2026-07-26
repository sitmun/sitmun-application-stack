#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const mbtilesRoot = join(stackRoot, 'back', 'mbtiles', 'sitmun-mbtiles');
const isWindows = process.platform === 'win32';
const gradlew = join(mbtilesRoot, isWindows ? 'gradlew.bat' : 'gradlew');

function fail(message) {
  console.error(`[e2e-mbtiles] ${message}`);
  process.exit(1);
}

if (!existsSync(mbtilesRoot) || !existsSync(gradlew)) {
  fail(`MBTiles submodule or Gradle wrapper missing at ${mbtilesRoot}`);
}

const child = spawn(
  gradlew,
  ['bootRun', '--no-daemon', '--args=--server.port=18084'],
  {
    cwd: mbtilesRoot,
    env: { ...process.env },
    stdio: 'inherit',
    shell: isWindows,
    detached: !isWindows,
  },
);

let shuttingDown = false;

function killTree(force = false) {
  if (!child.pid) return;
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
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[e2e-mbtiles] Shutting down (${signal})...`);
  killTree(false);
  const timer = setTimeout(() => killTree(true), 10_000);
  child.once('exit', () => clearTimeout(timer));
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(signal));
}

child.on('error', (error) => fail(`Failed to start Gradle: ${error.message}`));
child.on('exit', (code, signal) => {
  if (shuttingDown) process.exit(0);
  if (signal) fail(`MBTiles process terminated by signal ${signal}`);
  if (code !== 0) fail(`MBTiles exited with code ${code}`);
  process.exit(0);
});
