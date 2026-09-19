#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attachChildLifecycle,
  fail,
  isWindows,
  spawnDetached,
  waitForHttpOk,
} from './e2e-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const proxyRoot = join(stackRoot, 'back', 'proxy', 'sitmun-proxy-middleware');
const prefix = 'e2e-proxy';
const gradlew = join(proxyRoot, isWindows ? 'gradlew.bat' : 'gradlew');
const BACKEND_HEALTH_URL = 'http://localhost:18080/api/dashboard/health';
const BACKEND_WAIT_MS = 180_000;

if (!existsSync(proxyRoot)) {
  fail(prefix, `Proxy submodule missing at ${proxyRoot}. Run: git submodule update --init --recursive`);
}
if (!existsSync(gradlew)) {
  fail(prefix, `Gradle wrapper missing at ${gradlew}`);
}

try {
  execSync('java -version 2>&1', { encoding: 'utf8' });
} catch {
  fail(
    prefix,
    'Java is not available on PATH. Install Java 17 (or a JDK that Gradle can use for the Java 17 toolchain).',
  );
}

// Playwright starts webServers in parallel; proxy config fetch needs backend first.
await waitForHttpOk(BACKEND_HEALTH_URL, BACKEND_WAIT_MS, prefix);

console.error('[e2e-proxy] Starting proxy middleware on port 18082...');

const child = spawnDetached(gradlew, ['bootRun', '--no-daemon', '--args=--server.port=18082'], {
  cwd: proxyRoot,
  env: {
    ...process.env,
    SITMUN_BACKEND_CONFIG_URL: 'http://localhost:18080/api/config/proxy',
    SITMUN_BACKEND_CONFIG_SECRET: 'test-only-insecure-middleware-secret',
  },
});

attachChildLifecycle(child, { prefix });
