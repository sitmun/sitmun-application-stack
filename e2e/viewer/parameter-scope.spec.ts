import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  APP_ID,
  SERVICE_ID,
  TERRITORY_ID,
  UPSTREAM_PASSWORD,
  UPSTREAM_URL,
  UPSTREAM_USER,
  readViewerCredentials,
} from './fixtures';

const ADMIN_HEADERS = {
  'X-SITMUN-Client': 'admin',
  'Content-Type': 'application/json',
};

/** Seed cartography on service 3: layers DTE50_MUN,DTE50_PROV. */
const CARTOGRAPHY_ID = 4;
const LAYERS = 'DTE50_MUN,DTE50_PROV';
const STUB_LAST_QUERY = 'http://127.0.0.1:18093/last-query';
const PROXY_CARTOGRAPHY = `/middleware/proxy/${APP_ID}/${TERRITORY_ID}/WMS/${SERVICE_ID}/${CARTOGRAPHY_ID}`;

test('WMS rows apply to both operations; INFO and GETMAP stay on theirs', async ({ playwright }) => {
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  const viewer = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  try {
    await createScopedParameters(admin);
    const token = await proxyToken(viewer);

    const getMap = await viewer.get(wmsUrl('GetMap'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getMap.ok(), `GetMap failed: ${getMap.status()} ${await getMap.text()}`).toBeTruthy();
    const getMapNames = await upstreamNames(viewer);
    expect(getMapNames).toEqual(expect.arrayContaining(['E2E_PROTOCOL', 'E2E_GETMAP', 'E2E_LAYER']));
    expect(getMapNames).toEqual(expect.not.arrayContaining(['E2E_INFO', 'E2E_LAYER_INFO', 'E2E_OLPARAM']));

    const getFeatureInfo = await viewer.get(wmsUrl('GetFeatureInfo'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(
      getFeatureInfo.ok(),
      `GetFeatureInfo failed: ${getFeatureInfo.status()} ${await getFeatureInfo.text()}`,
    ).toBeTruthy();
    const infoNames = await upstreamNames(viewer);
    expect(infoNames).toEqual(
      expect.arrayContaining(['E2E_PROTOCOL', 'E2E_INFO', 'E2E_LAYER', 'E2E_LAYER_INFO']),
    );
    expect(infoNames).toEqual(expect.not.arrayContaining(['E2E_GETMAP', 'E2E_OLPARAM']));
  } finally {
    await admin.dispose();
    await viewer.dispose();
  }
});

test('WFS protocol reaches upstream and OLPARAM does not', async ({ playwright }) => {
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  const viewer = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  try {
    await loginAdmin(admin);
    const cartographyId = await createProxiedCartography(admin, 'WFS', 'E2E_WFS_LAYER');
    const service = await serviceUri(admin, cartographyId);
    await postParameter(admin, '/backend/api/service-parameters', {
      name: 'E2E_WFS_PROTOCOL',
      value: 'protocol',
      type: 'WFS',
      service,
    });
    await postParameter(admin, '/backend/api/service-parameters', {
      name: 'E2E_WFS_OLPARAM',
      value: 'ol',
      type: 'OLPARAM',
      service,
    });

    const token = await proxyToken(viewer);
    const response = await viewer.get(
      proxyUrl('WFS', await serviceIdOf(admin, cartographyId), cartographyId, {
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAME: 'E2E_WFS_LAYER',
      }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.ok(), `WFS failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    const names = await upstreamNamesFor(viewer, 'getfeature');
    expect(names).toEqual(expect.arrayContaining(['E2E_WFS_PROTOCOL']));
    expect(names).toEqual(expect.not.arrayContaining(['E2E_WFS_OLPARAM']));
  } finally {
    await admin.dispose();
    await viewer.dispose();
  }
});

test('a WMTS profile row is absent from the upstream request', async ({ playwright }) => {
  const admin = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  const viewer = await playwright.request.newContext({ baseURL: 'http://localhost:4400' });
  try {
    await loginAdmin(admin);
    const cartographyId = await createProxiedCartography(admin, 'WMTS', 'E2E_WMTS_LAYER');
    const service = await serviceUri(admin, cartographyId);
    await postParameter(admin, '/backend/api/service-parameters', {
      name: 'E2E_WMTS_MATRIX',
      value: 'EPSG:25831',
      type: 'WMTS',
      service,
    });
    await postParameter(admin, '/backend/api/service-parameters', {
      name: 'E2E_WMTS_OLPARAM',
      value: 'ol',
      type: 'OLPARAM',
      service,
    });

    const token = await proxyToken(viewer);
    const response = await viewer.get(
      proxyUrl('WMTS', await serviceIdOf(admin, cartographyId), cartographyId, {
        SERVICE: 'WMTS',
        REQUEST: 'GetTile',
        LAYER: 'E2E_WMTS_LAYER',
        TILEMATRIXSET: 'EPSG:25831',
        TILEMATRIX: '0',
        TILEROW: '0',
        TILECOL: '0',
        FORMAT: 'image/png',
      }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(response.ok(), `WMTS failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    const names = await upstreamNamesFor(viewer, 'gettile');
    expect(names).toEqual(expect.not.arrayContaining(['E2E_WMTS_MATRIX', 'E2E_WMTS_OLPARAM']));
  } finally {
    await admin.dispose();
    await viewer.dispose();
  }
});

async function createScopedParameters(admin: APIRequestContext): Promise<void> {
  const login = await admin.post('/backend/api/authenticate/admin', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();

  const service = `http://localhost:18080/api/services/${SERVICE_ID}`;
  const cartography = `http://localhost:18080/api/cartographies/${CARTOGRAPHY_ID}`;
  await postParameter(admin, '/backend/api/service-parameters', {
    name: 'E2E_PROTOCOL',
    value: 'protocol',
    type: 'WMS',
    service,
  });
  await postParameter(admin, '/backend/api/service-parameters', {
    name: 'E2E_INFO',
    value: 'info',
    type: 'INFO',
    service,
  });
  await postParameter(admin, '/backend/api/service-parameters', {
    name: 'E2E_GETMAP',
    value: 'getmap',
    type: 'GETMAP',
    service,
  });
  await postParameter(admin, '/backend/api/service-parameters', {
    name: 'E2E_OLPARAM',
    value: 'ol',
    type: 'OLPARAM',
    service,
  });
  await postParameter(admin, '/backend/api/cartography-service-parameters', {
    name: 'E2E_LAYER',
    value: 'layer',
    type: 'WMS',
    cartography,
  });
  await postParameter(admin, '/backend/api/cartography-service-parameters', {
    name: 'E2E_LAYER_INFO',
    value: 'layer-info',
    type: 'INFO',
    cartography,
  });
}

async function loginAdmin(admin: APIRequestContext): Promise<void> {
  const login = await admin.post('/backend/api/authenticate/admin', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();
}

async function createProxiedCartography(
  admin: APIRequestContext,
  type: 'WFS' | 'WMTS',
  layerName: string,
): Promise<number> {
  const createdService = await admin.post('/backend/api/services', {
    headers: ADMIN_HEADERS,
    data: {
      name: `e2e-${type.toLowerCase()}-${Date.now()}`,
      type,
      serviceURL: UPSTREAM_URL,
      isProxied: true,
      blocked: false,
      authenticationMode: 'HTTP Basic authentication',
      user: UPSTREAM_USER,
      password: UPSTREAM_PASSWORD,
    },
  });
  expect(
    createdService.ok(),
    `create ${type} service failed: ${createdService.status()} ${await createdService.text()}`,
  ).toBeTruthy();
  const serviceId = idFrom(createdService.headers().location ?? '', 'services');
  const service = `http://localhost:18080/api/services/${serviceId}`;

  const createdLayer = await admin.post('/backend/api/cartographies', {
    headers: ADMIN_HEADERS,
    data: {
      name: `e2e-${type.toLowerCase()}-layer-${Date.now()}`,
      layers: [layerName],
      queryableFeatureAvailable: false,
      queryableFeatureEnabled: false,
      useAllStyles: false,
      blocked: false,
      service,
    },
  });
  expect(
    createdLayer.ok(),
    `create ${type} cartography failed: ${createdLayer.status()} ${await createdLayer.text()}`,
  ).toBeTruthy();
  const cartographyId = idFrom(createdLayer.headers().location ?? '', 'cartographies');
  const cartography = `http://localhost:18080/api/cartographies/${cartographyId}`;

  const permissions = await admin.get('/backend/api/cartographies/4/permissions', {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(permissions.ok(), `permissions lookup failed: ${permissions.status()}`).toBeTruthy();
  const permissionId = firstPermissionId(await permissions.json());
  const linked = await admin.post(`/backend/api/cartography-groups/${permissionId}/members`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'text/uri-list',
    },
    data: cartography,
  });
  expect(linked.ok(), `link permission failed: ${linked.status()} ${await linked.text()}`).toBeTruthy();

  const availability = await admin.post('/backend/api/cartography-availabilities', {
    headers: ADMIN_HEADERS,
    data: {
      cartography,
      territory: `http://localhost:18080/api/territories/${TERRITORY_ID}`,
    },
  });
  expect(
    [201, 204, 409].includes(availability.status()),
    `availability failed: ${availability.status()} ${await availability.text()}`,
  ).toBeTruthy();
  return cartographyId;
}

async function serviceUri(admin: APIRequestContext, cartographyId: number): Promise<string> {
  return `http://localhost:18080/api/services/${await serviceIdOf(admin, cartographyId)}`;
}

async function serviceIdOf(admin: APIRequestContext, cartographyId: number): Promise<number> {
  const cartography = await admin.get(`/backend/api/cartographies/${cartographyId}/service`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(cartography.ok(), `cartography service failed: ${cartography.status()}`).toBeTruthy();
  const body = (await cartography.json()) as { id?: number };
  expect(body.id, 'service id missing').toBeTruthy();
  return body.id as number;
}

function proxyUrl(
  type: 'WFS' | 'WMTS',
  serviceId: number,
  cartographyId: number,
  params: Record<string, string>,
): string {
  return `/middleware/proxy/${APP_ID}/${TERRITORY_ID}/${type}/${serviceId}/${cartographyId}?${new URLSearchParams(params).toString()}`;
}

function firstPermissionId(body: unknown): number {
  const hrefs: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string' && value.includes('/cartography-groups/')) {
      hrefs.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value != null && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(body);
  expect(hrefs[0], `permission link missing: ${JSON.stringify(body).slice(0, 500)}`).toBeTruthy();
  return idFrom(hrefs[0], 'cartography-groups');
}

function idFrom(location: string, collection: string): number {
  const match = location.match(new RegExp(`/${collection}/(\\d+)`));
  expect(match, `id missing from ${location}`).toBeTruthy();
  return Number(match?.[1]);
}

async function postParameter(
  admin: APIRequestContext,
  path: string,
  data: Record<string, string>,
): Promise<void> {
  const created = await admin.post(path, { headers: ADMIN_HEADERS, data });
  expect(created.ok(), `${path} ${data.name} failed: ${created.status()} ${await created.text()}`).toBeTruthy();
}

async function proxyToken(viewer: APIRequestContext): Promise<string> {
  const credentials = await readViewerCredentials();
  const login = await viewer.post('/backend/api/authenticate', {
    data: { username: credentials.username, password: credentials.password },
  });
  expect(login.ok(), `viewer login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
  const proxy = await viewer.post('/backend/api/authenticate/proxy');
  expect(proxy.ok(), `proxy token failed: ${proxy.status()} ${await proxy.text()}`).toBeTruthy();
  const body = (await proxy.json()) as { proxy_token?: string };
  expect(body.proxy_token, 'proxy_token missing').toBeTruthy();
  return body.proxy_token as string;
}

function wmsUrl(requestName: 'GetMap' | 'GetFeatureInfo'): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: requestName,
    LAYERS: LAYERS,
    STYLES: '',
    CRS: 'EPSG:25831',
    BBOX: '400000,4500000,500000,4700000',
    WIDTH: '2',
    HEIGHT: '2',
    FORMAT: 'image/png',
  });
  if (requestName === 'GetFeatureInfo') {
    params.set('QUERY_LAYERS', LAYERS);
    params.set('I', '1');
    params.set('J', '1');
    params.set('INFO_FORMAT', 'text/plain');
  }
  return `${PROXY_CARTOGRAPHY}?${params.toString()}`;
}

async function upstreamNames(viewer: APIRequestContext): Promise<string[]> {
  const body = await lastQuery(viewer);
  return (body.names ?? []).map((name) => name.toUpperCase());
}

async function upstreamNamesFor(viewer: APIRequestContext, requestName: string): Promise<string[]> {
  const body = await lastQuery(viewer);
  const match = [...(body.recent ?? [])].reverse().find((entry) => entry.request === requestName);
  expect(match, `stub has no ${requestName} query`).toBeTruthy();
  return (match?.names ?? []).map((name) => name.toUpperCase());
}

async function lastQuery(viewer: APIRequestContext): Promise<{
  names?: string[];
  recent?: { request?: string; names?: string[] }[];
}> {
  const last = await viewer.get(STUB_LAST_QUERY);
  expect(last.ok(), `stub last-query failed: ${last.status()}`).toBeTruthy();
  return (await last.json()) as {
    names?: string[];
    recent?: { request?: string; names?: string[] }[];
  };
}
