#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const backendRoot = join(stackRoot, 'back', 'backend', 'sitmun-backend-core');
const changelog = join(backendRoot, 'config', 'db', 'changelog', 'db.changelog-master.yaml');
const isWindows = process.platform === 'win32';
const gradlew = join(backendRoot, isWindows ? 'gradlew.bat' : 'gradlew');

function fail(message) {
  console.error(`[e2e-backend-mobile] ${message}`);
  process.exit(1);
}

if (!existsSync(backendRoot)) {
  fail(`Backend submodule missing at ${backendRoot}`);
}
if (!existsSync(gradlew)) {
  fail(`Gradle wrapper missing at ${gradlew}`);
}
if (!existsSync(changelog)) {
  fail(`Liquibase changelog missing at ${changelog}`);
}

const springArgs = [
  '--spring.profiles.active=dev',
  '--server.port=18080',
  '--spring.datasource.url=jdbc:h2:mem:sitmun-e2e-mobile;DB_CLOSE_DELAY=-1',
  '--spring.datasource.driver-class-name=org.h2.Driver',
  '--spring.datasource.username=sa',
  '--spring.datasource.password=',
  '--server.forward-headers-strategy=framework',
  '--sitmun.proxy-middleware.url=http://localhost:18081/middleware',
].join(' ');

const env = {
  ...process.env,
  SITMUN_USER_SECRET: 'test-only-insecure-user-secret-32-bytes',
  SITMUN_PROXY_MIDDLEWARE_SECRET: 'test-only-insecure-middleware-secret',
};

const child = spawn(gradlew, ['bootRun', '--no-daemon', `--args=${springArgs}`], {
  cwd: backendRoot,
  env,
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
  console.error(`[e2e-backend-mobile] Shutting down (${signal})...`);
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
  if (signal) fail(`Backend process terminated by signal ${signal}`);
  if (code !== 0) fail(`Backend exited with code ${code}`);
  process.exit(0);
});
