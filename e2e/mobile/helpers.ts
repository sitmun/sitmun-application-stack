import { expect, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { BACKEND, MOBILE_FIXTURE_FILE, type MobileFixture } from './fixtures';

export async function loadMobileFixture(): Promise<MobileFixture> {
  return JSON.parse(await readFile(MOBILE_FIXTURE_FILE, 'utf8')) as MobileFixture;
}

export async function mobileAccessToken(
  request: APIRequestContext,
  fixture?: MobileFixture,
): Promise<string> {
  const creds = fixture ?? (await loadMobileFixture());
  const mobile = await request.post(`${BACKEND}/api/authenticate/mobile`, {
    data: { username: creds.username, password: creds.password },
  });
  expect(mobile.status(), await mobile.text()).toBe(200);
  const body = await mobile.json();
  expect(body.access_token).toBeTruthy();
  return body.access_token as string;
}

export async function mobileTokens(request: APIRequestContext, fixture?: MobileFixture) {
  const access_token = await mobileAccessToken(request, fixture);
  const proxyExchange = await request.post(`${BACKEND}/api/authenticate/proxy`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  expect(proxyExchange.status(), await proxyExchange.text()).toBe(200);
  const { proxy_token } = await proxyExchange.json();
  expect(proxy_token).toBeTruthy();
  expect(proxy_token).not.toEqual(access_token);
  return { access_token, proxy_token: proxy_token as string };
}

export function estimateBody(fixture: MobileFixture, overrides: Record<string, unknown> = {}) {
  return {
    services: [{ serviceId: fixture.serviceId, layerIds: [fixture.layerId] }],
    bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    minZoom: 0,
    maxZoom: 1,
    srs: 'EPSG:3857',
    ...overrides,
  };
}
