#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachChildLifecycle, fail, isWindows, spawnDetached } from './e2e-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const backendRoot = join(stackRoot, 'back', 'backend', 'sitmun-backend-core');
const changelogDir = join(backendRoot, 'config', 'db', 'changelog');
const backendChangelog = join(changelogDir, 'db.changelog-master.yaml');
const fixtureYaml = join(stackRoot, 'e2e', 'fixtures', 'ensure-document-export-task-type.yaml');
const fixtureSpecDir = join(stackRoot, 'e2e', 'fixtures', 'ensure-document-export-task-type');
const stagedWrapper = join(changelogDir, 'db.changelog-e2e.yaml');
const stagedYaml = join(changelogDir, 'ensure-document-export-task-type.yaml');
const stagedSpecDir = join(changelogDir, 'ensure-document-export-task-type');
const prefix = 'e2e-backend';
const gradlew = join(backendRoot, isWindows ? 'gradlew.bat' : 'gradlew');

if (!existsSync(backendRoot)) {
  fail(prefix, `Backend submodule missing at ${backendRoot}. Run: git submodule update --init --recursive`);
}
if (!existsSync(gradlew)) {
  fail(prefix, `Gradle wrapper missing at ${gradlew}`);
}
if (!existsSync(backendChangelog)) {
  fail(prefix, `Liquibase changelog missing at ${backendChangelog}`);
}
if (!existsSync(fixtureYaml) || !existsSync(fixtureSpecDir)) {
  fail(prefix, `Document-export type fixture missing under ${join(stackRoot, 'e2e', 'fixtures')}`);
}

try {
  execSync('java -version 2>&1', { encoding: 'utf8' });
} catch {
  fail(
    prefix,
    'Java is not available on PATH. Install Java 17 (or a JDK that Gradle can use for the Java 17 toolchain).',
  );
}

function unstageE2eChangelog() {
  rmSync(stagedWrapper, { force: true });
  rmSync(stagedYaml, { force: true });
  rmSync(stagedSpecDir, { recursive: true, force: true });
}

function stageE2eChangelog() {
  unstageE2eChangelog();
  writeFileSync(
    stagedWrapper,
    [
      'databaseChangeLog:',
      '  - include:',
      '      file: db.changelog-master.yaml',
      '      relativeToChangelogFile: true',
      '  - include:',
      '      file: ensure-document-export-task-type.yaml',
      '      relativeToChangelogFile: true',
      '',
    ].join('\n'),
  );
  copyFileSync(fixtureYaml, stagedYaml);
  cpSync(fixtureSpecDir, stagedSpecDir, { recursive: true });
}

stageE2eChangelog();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, unstageE2eChangelog);
}
process.on('exit', unstageE2eChangelog);

const springArgs = [
  '--spring.profiles.active=dev',
  '--server.port=18080',
  '--spring.datasource.url=jdbc:h2:mem:sitmun-e2e;DB_CLOSE_DELAY=-1',
  '--spring.datasource.driver-class-name=org.h2.Driver',
  '--spring.datasource.username=sa',
  '--spring.datasource.password=',
  '--server.forward-headers-strategy=framework',
  '--sitmun.proxy-middleware.url=http://localhost:4400/middleware',
  '--spring.liquibase.change-log=file:./config/db/changelog/db.changelog-e2e.yaml',
].join(' ');

const child = spawnDetached(gradlew, ['bootRun', '--no-daemon', `--args=${springArgs}`], {
  cwd: backendRoot,
  env: {
    ...process.env,
    SITMUN_USER_SECRET: 'test-only-insecure-user-secret-32-bytes',
    SITMUN_PROXY_MIDDLEWARE_SECRET: 'test-only-insecure-middleware-secret',
  },
});

child.on('exit', unstageE2eChangelog);
attachChildLifecycle(child, { prefix });
