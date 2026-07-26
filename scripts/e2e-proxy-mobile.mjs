#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const proxyRoot = join(stackRoot, 'back', 'proxy', 'sitmun-proxy-middleware');
const isWindows = process.platform === 'win32';
const gradlew = join(proxyRoot, isWindows ? 'gradlew.bat' : 'gradlew');

function fail(message) {
  console.error(`[e2e-proxy-mobile] ${message}`);
  process.exit(1);
}

if (!existsSync(proxyRoot) || !existsSync(gradlew)) {
  fail(`Proxy submodule or Gradle wrapper missing at ${proxyRoot}`);
}

const child = spawn(
  gradlew,
  [
    'bootRun',
    '--no-daemon',
    '--args=--server.port=18082 --sitmun.backend.config.url=http://localhost:18080/api/config/proxy --sitmun.mbtiles.url=http://127.0.0.1:18084/mbtiles',
  ],
  {
  cwd: proxyRoot,
  env: {
    ...process.env,
    SITMUN_BACKEND_CONFIG_URL: 'http://localhost:18080/api/config/proxy',
    SITMUN_BACKEND_CONFIG_SECRET: 'test-only-insecure-middleware-secret',
    SITMUN_MBTILES_URL: 'http://127.0.0.1:18084/mbtiles',
    SITMUN_MBTILES_JOB_HANDLE_SECRET: 'test-only-insecure-job-handle-secret-32b',
  },
  stdio: 'inherit',
  shell: isWindows,
  detached: !isWindows,
});

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
  console.error(`[e2e-proxy-mobile] Shutting down (${signal})...`);
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
  if (signal) fail(`Proxy process terminated by signal ${signal}`);
  if (code !== 0) fail(`Proxy exited with code ${code}`);
  process.exit(0);
});
