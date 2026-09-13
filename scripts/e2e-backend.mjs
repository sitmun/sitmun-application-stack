#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachChildLifecycle, fail, isWindows, spawnDetached } from './e2e-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const backendRoot = join(stackRoot, 'back', 'backend', 'sitmun-backend-core');
const changelog = join(backendRoot, 'config', 'db', 'changelog', 'db.changelog-master.yaml');
const prefix = 'e2e-backend';
const gradlew = join(backendRoot, isWindows ? 'gradlew.bat' : 'gradlew');

if (!existsSync(backendRoot)) {
  fail(prefix, `Backend submodule missing at ${backendRoot}. Run: git submodule update --init --recursive`);
}
if (!existsSync(gradlew)) {
  fail(prefix, `Gradle wrapper missing at ${gradlew}`);
}
if (!existsSync(changelog)) {
  fail(prefix, `Liquibase changelog missing at ${changelog}`);
}

try {
  execSync('java -version 2>&1', { encoding: 'utf8' });
} catch {
  fail(
    prefix,
    'Java is not available on PATH. Install Java 17 (or a JDK that Gradle can use for the Java 17 toolchain).',
  );
}

const springArgs = [
  '--spring.profiles.active=dev',
  '--server.port=18080',
  '--spring.datasource.url=jdbc:h2:mem:sitmun-e2e;DB_CLOSE_DELAY=-1',
  '--spring.datasource.driver-class-name=org.h2.Driver',
  '--spring.datasource.username=sa',
  '--spring.datasource.password=',
  '--server.forward-headers-strategy=framework',
  '--sitmun.proxy-middleware.url=http://localhost:4400/middleware',
].join(' ');

const child = spawnDetached(gradlew, ['bootRun', '--no-daemon', `--args=${springArgs}`], {
  cwd: backendRoot,
  env: {
    ...process.env,
    SITMUN_USER_SECRET: 'test-only-insecure-user-secret-32-bytes',
    SITMUN_PROXY_MIDDLEWARE_SECRET: 'test-only-insecure-middleware-secret',
  },
});

attachChildLifecycle(child, { prefix });
