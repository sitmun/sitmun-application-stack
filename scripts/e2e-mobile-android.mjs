#!/usr/bin/env node
/**
 * Android emulator + Maestro orchestration for edition/touristic mobile apps.
 * Builds APKs from temporary copies of the pinned submodule sources (does not
 * commit generated Android projects). Requires adb, ANDROID_HOME, and Maestro.
 */
import { createHash } from 'node:crypto';
import { spawn, execSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stackRoot = resolve(__dirname, '..');
const artifactDir = join(stackRoot, 'test-results', 'mobile-android');
const editionSrc = join(stackRoot, 'apps', 'edition-mobile-app');
const touristicSrc = join(stackRoot, 'apps', 'touristic-mobile-app');

const EDITION_APP_ID = 1;
const EDITION_TERRITORY_ID = 1;
const EDITION_ROLE_ID = 1;
const TOURISTIC_APP_ID = 6;
const WMTS_SERVICE_ID = 1;
const WMTS_LAYER_ID = 1;
const WMTS_UPSTREAM_URL = 'http://127.0.0.1:18094/wmts';
const PROXY_KEY = 'test-only-insecure-middleware-secret';
const GATEWAY = 'http://127.0.0.1:18081';
const MIDDLEWARE = `${GATEWAY}/middleware`;

function failEarly(message) {
  console.error(`[e2e-mobile-android] ${message}`);
  process.exit(1);
}

function requireCmd(cmd, hint) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
  } catch {
    failEarly(`Required command missing: ${cmd}. ${hint ?? ''}`);
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function gitSha(repoPath) {
  return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf8' }).trim();
}

function run(cmd, args, options = {}) {
  console.error(`[e2e-mobile-android] $ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with code ${result.status}`);
  }
}

async function waitFor(url, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

function estimateBody(fixture, overrides = {}) {
  return {
    services: [{ serviceId: fixture.serviceId, layerIds: [fixture.layerId] }],
    bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    minZoom: 0,
    maxZoom: 1,
    srs: 'EPSG:3857',
    ...overrides,
  };
}

function requireOk(label, res, text) {
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${text}`);
  }
}

function requireStatus(label, res, predicate, text) {
  if (!predicate(res.status)) {
    throw new Error(`${label}: unexpected status ${res.status} ${text}`);
  }
}

/** Mirror e2e/mobile/setup so Android flows see ED + public touristic apps. */
async function provisionMobileBackend(gatewayBackend) {
  const login = await jsonFetch(`${gatewayBackend}/api/authenticate/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });
  requireOk('admin login', login.res, login.text);
  const cookieHeader =
    typeof login.res.headers.getSetCookie === 'function'
      ? login.res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
      : (login.res.headers.get('set-cookie') ?? '')
          .split(',')
          .map((c) => c.split(';')[0].trim())
          .join('; ');
  if (!cookieHeader) {
    throw new Error('admin login returned no Set-Cookie header');
  }
  const patchHeaders = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'application/merge-patch+json',
    Cookie: cookieHeader,
  };
  const jsonHeaders = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'application/json',
    Cookie: cookieHeader,
  };
  const uriHeaders = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'text/uri-list',
    Cookie: cookieHeader,
  };

  const patchEdition = await jsonFetch(`${gatewayBackend}/api/applications/${EDITION_APP_ID}`, {
    method: 'PATCH',
    headers: patchHeaders,
    body: JSON.stringify({ type: 'ED', appPrivate: false }),
  });
  requireOk('patch ED app', patchEdition.res, patchEdition.text);

  const serviceResponse = await jsonFetch(
    `${gatewayBackend}/api/services/${WMTS_SERVICE_ID}`,
    { headers: { 'X-SITMUN-Client': 'admin', Cookie: cookieHeader } },
  );
  requireOk('get WMTS service', serviceResponse.res, serviceResponse.text);
  const service = serviceResponse.body;
  const updateService = await jsonFetch(`${gatewayBackend}/api/services/${WMTS_SERVICE_ID}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: service.name,
      type: service.type,
      blocked: service.blocked,
      serviceURL: WMTS_UPSTREAM_URL,
      isProxied: true,
      authenticationMode: null,
    }),
  });
  requireOk('update WMTS service', updateService.res, updateService.text);

  // Keep credentials short: ion-input + Maestro can truncate long values.
  const username = `ea${Date.now().toString(36)}`;
  const password = `E2e!${Date.now().toString(36).slice(-6)}A1`;
  const createUser = await jsonFetch(`${gatewayBackend}/api/users`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      username,
      password,
      administrator: false,
      blocked: false,
      firstName: 'E2E',
      lastName: 'Android',
      email: 'e2e-android@example.com',
    }),
  });
  if (createUser.res.status !== 201) {
    throw new Error(`create edition user failed: ${createUser.res.status} ${createUser.text}`);
  }
  let userId = createUser.body?.id;
  if (!userId) {
    const location = createUser.res.headers.get('location');
    const match = location?.match(/\/users\/(\d+)/);
    userId = match ? Number(match[1]) : undefined;
  }
  if (!userId) {
    throw new Error('create edition user returned no id');
  }
  const userSelf =
    createUser.body?._links?.self?.href ??
    createUser.res.headers.get('location') ??
    `${gatewayBackend}/api/users/${userId}`;
  const apiOrigin = new URL(userSelf).origin;

  const createConfig = await jsonFetch(`${gatewayBackend}/api/user-configurations`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      user: `${apiOrigin}/api/users/${userId}`,
      territory: `${apiOrigin}/api/territories/${EDITION_TERRITORY_ID}`,
      role: `${apiOrigin}/api/roles/${EDITION_ROLE_ID}`,
      appliesToChildrenTerritories: false,
    }),
  });
  if (createConfig.res.status !== 201) {
    throw new Error(
      `create user-configuration failed: ${createConfig.res.status} ${createConfig.text}`,
    );
  }

  const patchTouristic = await jsonFetch(
    `${gatewayBackend}/api/applications/${TOURISTIC_APP_ID}`,
    {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify({ appPrivate: false }),
    },
  );
  requireOk('patch touristic app', patchTouristic.res, patchTouristic.text);

  const assignRole = await jsonFetch(
    `${gatewayBackend}/api/applications/${TOURISTIC_APP_ID}/availableRoles`,
    {
      method: 'PUT',
      headers: uriHeaders,
      // Spring Data REST parses the last URI path segment as an id; avoid a trailing newline.
      body: `${gatewayBackend}/api/roles/${EDITION_ROLE_ID}`,
    },
  );
  requireOk('assign touristic role', assignRole.res, assignRole.text);

  // Seed app 6 has no trees; touristic home navigation requires a type=touristic tree
  // with a menu root node or redirect throws on undefined rootNode.type.
  await provisionTouristicTree(gatewayBackend, cookieHeader);

  return {
    username,
    password,
    appId: EDITION_APP_ID,
    territoryId: EDITION_TERRITORY_ID,
    serviceId: WMTS_SERVICE_ID,
    layerId: WMTS_LAYER_ID,
  };
}

/**
 * Phase 8 flows 4–6: proxy/MBTiles success and denial against the same gateway
 * the rebuilt APKs use (API boundary; Maestro covers UI login/touristic).
 */
async function assertAndroidStackContracts(gatewayBackend, fixture) {
  console.error('[e2e-mobile-android] Asserting proxy/MBTiles stack contracts...');
  const gatewayMbtiles = await jsonFetch(`${GATEWAY}/mbtiles/estimate`);
  requireStatus('direct gateway /mbtiles', gatewayMbtiles.res, (s) => s === 404, gatewayMbtiles.text);

  const mobile = await jsonFetch(`${gatewayBackend}/api/authenticate/mobile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: fixture.username, password: fixture.password }),
  });
  requireOk('mobile login', mobile.res, mobile.text);
  if (mobile.res.headers.get('set-cookie')) {
    throw new Error('mobile login must not set cookies');
  }
  const accessToken = mobile.body?.access_token;
  if (!accessToken) {
    throw new Error('mobile login missing access_token');
  }

  const proxyExchange = await jsonFetch(`${gatewayBackend}/api/authenticate/proxy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  requireOk('proxy token exchange', proxyExchange.res, proxyExchange.text);
  const proxyToken = proxyExchange.body?.proxy_token;
  if (!proxyToken || proxyToken === accessToken) {
    throw new Error('proxy exchange did not return a distinct proxy_token');
  }

  const body = estimateBody(fixture);
  const missing = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  requireStatus('missing bearer', missing.res, (s) => s >= 400, missing.text);

  const wrongUse = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  requireStatus('access_token as proxy', wrongUse.res, (s) => s >= 400, wrongUse.text);

  const wrongTer = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/999999/mbtiles/estimate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  requireStatus('wrong territory', wrongTer.res, (s) => s >= 400, wrongTer.text);

  const estimate = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  requireOk('mbtiles estimate', estimate.res, estimate.text);

  const create = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  requireOk('mbtiles create', create.res, create.text);
  const jobHandle = create.body?.jobHandle;
  if (!jobHandle || /^\d+$/.test(String(jobHandle))) {
    throw new Error(`mbtiles create returned non-opaque jobHandle: ${jobHandle}`);
  }

  const status = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/${jobHandle}`,
    { headers: { Authorization: `Bearer ${proxyToken}` } },
  );
  requireStatus('mbtiles status', status.res, (s) => s < 500, status.text);

  // File may fail upstream when the WMTS stub cannot harvest tiles; still require
  // the authenticated route is not rejected as unauthorized.
  const file = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/${jobHandle}/file`,
    { headers: { Authorization: `Bearer ${proxyToken}` } },
  );
  requireStatus(
    'mbtiles file auth',
    file.res,
    (s) => s !== 401 && s !== 403,
    file.text,
  );
  const fileDenied = await jsonFetch(
    `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/${jobHandle}/file`,
  );
  requireStatus('mbtiles file missing bearer', fileDenied.res, (s) => s >= 400, fileDenied.text);

  // Touch proxy-key backend canonicalization used by middleware (edition proxy path).
  const backendConfig = await jsonFetch(`${gatewayBackend}/api/config/proxy/mbtiles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${proxyToken}`,
      'X-SITMUN-Proxy-Key': PROXY_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId: fixture.appId,
      territoryId: fixture.territoryId,
      action: 'estimate',
      ...body,
    }),
  });
  requireOk('backend mbtiles config', backendConfig.res, backendConfig.text);
  if (!backendConfig.body?.tileRequest?.mapServices?.[0]?.url) {
    throw new Error('backend mbtiles config missing canonical map service URL');
  }

  console.error('[e2e-mobile-android] Proxy/MBTiles stack contracts OK.');
}

async function provisionTouristicTree(gatewayBackend, cookieHeader) {
  const jsonHeaders = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'application/json',
    Cookie: cookieHeader,
  };
  const uriHeaders = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'text/uri-list',
    Cookie: cookieHeader,
  };

  const tree = await jsonFetch(`${gatewayBackend}/api/trees`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: 'E2E Touristic',
      type: 'touristic',
      description: 'android e2e',
    }),
  });
  if (!tree.res.ok) {
    throw new Error(`create touristic tree failed: ${tree.res.status} ${tree.text}`);
  }
  const treeUri = tree.body?._links?.self?.href;
  if (!treeUri) {
    throw new Error('create touristic tree returned no self link');
  }

  const node = await jsonFetch(`${gatewayBackend}/api/tree-nodes`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      name: 'E2E Home',
      type: 'menu',
      visible: true,
      order: 1,
      tree: treeUri,
    }),
  });
  if (!node.res.ok) {
    throw new Error(`create touristic root node failed: ${node.res.status} ${node.text}`);
  }

  const appTrees = await jsonFetch(`${gatewayBackend}/api/applications/6/trees`, {
    method: 'PUT',
    headers: uriHeaders,
    body: treeUri,
  });
  if (!appTrees.res.ok) {
    throw new Error(`attach tree to app failed: ${appTrees.res.status} ${appTrees.text}`);
  }

  const roleTrees = await jsonFetch(`${gatewayBackend}/api/roles/1/trees`, {
    method: 'GET',
    headers: { 'X-SITMUN-Client': 'admin', Cookie: cookieHeader },
  });
  if (!roleTrees.res.ok) {
    throw new Error(`list role trees failed: ${roleTrees.res.status} ${roleTrees.text}`);
  }
  const existing =
    roleTrees.body?._embedded?.trees?.map((t) => t._links?.self?.href).filter(Boolean) ?? [];
  const merged = existing.includes(treeUri) ? existing : [...existing, treeUri];
  const putRoleTrees = await jsonFetch(`${gatewayBackend}/api/roles/1/trees`, {
    method: 'PUT',
    headers: uriHeaders,
    body: merged.join('\n'),
  });
  if (!putRoleTrees.res.ok) {
    throw new Error(
      `attach tree to role failed: ${putRoleTrees.res.status} ${putRoleTrees.text}`,
    );
  }
}

function patchTouristicEnvironment(touristicWork, backendUrl) {
  // ionic build --configuration=development replaces environment.ts with
  // environment.dev.ts, so both files must point at the local gateway.
  const envContents = `export const environment = {
  production: false,
  instancesUrl: '',
  instancesData: {
    e2e: {
      name: 'E2E Local',
      urlBackend: '${backendUrl}'
    }
  },
  cacheExpirationTime: 2
};
`;
  for (const name of ['environment.ts', 'environment.dev.ts']) {
    writeFileSync(join(touristicWork, 'src', 'environments', name), envContents);
  }
}

async function main() {
  if (!existsSync(editionSrc) || !existsSync(touristicSrc)) {
    failEarly('Mobile app submodules missing under apps/');
  }

  requireCmd('adb', 'Install Android platform-tools and ensure an emulator/device is connected.');
  requireCmd('maestro', 'Install Maestro CLI: https://maestro.mobile.dev');
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
    failEarly('ANDROID_HOME or ANDROID_SDK_ROOT must be set.');
  }

  mkdirSync(artifactDir, { recursive: true });
  const workRoot = mkdtempSync(join(tmpdir(), 'sitmun-mobile-android-'));
  const children = [];
  let shuttingDown = false;

  function killProcessGroup(pid, signal) {
    try {
      process.kill(-pid, signal);
    } catch {
      try {
        process.kill(pid, signal);
      } catch {
        // already gone
      }
    }
  }

  function killChildren() {
    for (const child of children) {
      if (child.pid) killProcessGroup(child.pid, 'SIGTERM');
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
    for (const child of children) {
      if (child.pid) killProcessGroup(child.pid, 'SIGKILL');
    }
  }

  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    killChildren();
    try {
      rmSync(workRoot, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      shutdown();
      process.exit(1);
    });
  }

  try {
    const devices = execSync('adb devices', { encoding: 'utf8' });
    const ready = devices
      .split('\n')
      .some((line) => line.includes('\tdevice') && !line.startsWith('List'));
    if (!ready) {
      throw new Error('No adb device/emulator in "device" state. Start an API 34 emulator first.');
    }

    run('adb', ['reverse', 'tcp:18081', 'tcp:18081']);

    const webServers = [
      ['e2e:backend:mobile', 'http://localhost:18080/api/dashboard/health'],
      ['e2e:mbtiles', 'http://127.0.0.1:18084/actuator/health'],
      ['e2e:proxy:mobile', 'http://localhost:18082/actuator/health'],
      ['e2e:wmts-stub', 'http://127.0.0.1:18094/health'],
      ['e2e:mobile:gateway', 'http://127.0.0.1:18081/health'],
    ];

    for (const [script] of webServers) {
      const child = spawn('npm', ['run', script], {
        cwd: stackRoot,
        stdio: 'inherit',
        detached: true,
        env: process.env,
      });
      children.push(child);
    }

    for (const [, url] of webServers) {
      await waitFor(url);
    }

    const gatewayBackend = `${GATEWAY}/backend`;
    console.error('[e2e-mobile-android] Provisioning mobile backend fixtures...');
    const fixture = await provisionMobileBackend(gatewayBackend);
    await assertAndroidStackContracts(gatewayBackend, fixture);

    const editionWork = join(workRoot, 'edition');
    const touristicWork = join(workRoot, 'touristic');
    cpSync(editionSrc, editionWork, { recursive: true });
    cpSync(touristicSrc, touristicWork, { recursive: true });
    patchTouristicEnvironment(touristicWork, gatewayBackend);

    const sourceManifest = {
      editionSha: gitSha(editionSrc),
      touristicSha: gitSha(touristicSrc),
      builtAt: new Date().toISOString(),
    };

    for (const appDir of [editionWork, touristicWork]) {
      run('npm', ['ci'], { cwd: appDir });
      run('npx', ['ionic', 'build', '--configuration=development'], { cwd: appDir });
      // Native projects are not committed in the mobile submodules; generate in the temp copy.
      if (!existsSync(join(appDir, 'android'))) {
        run('npx', ['cap', 'add', 'android'], { cwd: appDir });
      }
      run('npx', ['cap', 'sync', 'android'], { cwd: appDir });
      const gradle = join(appDir, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
      if (!existsSync(gradle)) {
        throw new Error(`Capacitor android project missing gradlew at ${gradle}`);
      }
      run(gradle, ['assembleDebug', '--no-daemon'], { cwd: join(appDir, 'android') });
    }

    const editionApk = join(
      editionWork,
      'android',
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug.apk',
    );
    const touristicApk = join(
      touristicWork,
      'android',
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug.apk',
    );
    if (!existsSync(editionApk) || !existsSync(touristicApk)) {
      throw new Error('Debug APKs were not produced.');
    }

    sourceManifest.editionApkSha256 = sha256(editionApk);
    sourceManifest.touristicApkSha256 = sha256(touristicApk);
    writeFileSync(join(artifactDir, 'build-manifest.json'), JSON.stringify(sourceManifest, null, 2));

    run('adb', ['install', '-r', editionApk]);
    run('adb', ['install', '-r', touristicApk]);

    const maestroEnv = [
      '-e',
      `EDITION_USERNAME=${fixture.username}`,
      '-e',
      `EDITION_PASSWORD=${fixture.password}`,
      '-e',
      `GATEWAY_URL=${GATEWAY}`,
      '-e',
      `GATEWAY_BACKEND_URL=${gatewayBackend}`,
    ];
    const flows = [
      join(stackRoot, 'e2e', 'mobile', 'android', 'edition-login-denied.yaml'),
      join(stackRoot, 'e2e', 'mobile', 'android', 'edition-login.yaml'),
      join(stackRoot, 'e2e', 'mobile', 'android', 'touristic-public.yaml'),
    ];
    run('adb', ['shell', 'am', 'kill-all']);
    for (const flow of flows) {
      run('maestro', ['test', ...maestroEnv, flow]);
    }

    console.error('[e2e-mobile-android] Maestro flows completed.');
  } catch (error) {
    console.error(`[e2e-mobile-android] ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    shutdown();
  }
}

main();
