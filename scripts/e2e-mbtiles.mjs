#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachChildLifecycle, fail, isWindows, spawnDetached } from './e2e-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const mbtilesRoot = join(stackRoot, 'back', 'mbtiles', 'sitmun-mbtiles');
const prefix = 'e2e-mbtiles';
const gradlew = join(mbtilesRoot, isWindows ? 'gradlew.bat' : 'gradlew');

if (!existsSync(mbtilesRoot) || !existsSync(gradlew)) {
  fail(prefix, `MBTiles submodule or Gradle wrapper missing at ${mbtilesRoot}`);
}

const child = spawnDetached(gradlew, ['bootRun', '--no-daemon', '--args=--server.port=18084'], {
  cwd: mbtilesRoot,
  env: { ...process.env },
});

attachChildLifecycle(child, { prefix });
