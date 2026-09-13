#!/usr/bin/env node
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
const prefix = 'e2e-proxy-mobile';
const gradlew = join(proxyRoot, isWindows ? 'gradlew.bat' : 'gradlew');
const BACKEND_HEALTH_URL = 'http://localhost:18080/api/dashboard/health';
const BACKEND_WAIT_MS = 180_000;

if (!existsSync(proxyRoot) || !existsSync(gradlew)) {
  fail(prefix, `Proxy submodule or Gradle wrapper missing at ${proxyRoot}`);
}

await waitForHttpOk(BACKEND_HEALTH_URL, BACKEND_WAIT_MS, prefix);

console.error('[e2e-proxy-mobile] Starting proxy middleware on port 18082...');

const child = spawnDetached(
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
  },
);

attachChildLifecycle(child, { prefix });
