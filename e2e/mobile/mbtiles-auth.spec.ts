import { expect, test } from '@playwright/test';
import { BACKEND, GATEWAY, MIDDLEWARE } from './fixtures';
import { estimateBody, loadMobileFixture, mobileTokens } from './helpers';

const PROXY_KEY = 'test-only-insecure-middleware-secret';

test.describe('MBTiles secured path', () => {
  test('gateway does not route direct /mbtiles', async ({ request }) => {
    const response = await request.get(`${GATEWAY}/mbtiles/estimate`);
    expect(response.status()).toBe(404);
    expect(await response.text()).toMatch(/not publicly routed|not found/i);
  });

  test('authorized proxy_token can estimate one-tile MBTiles via middleware', async ({
    request,
  }) => {
    const fixture = await loadMobileFixture();
    const tokens = await mobileTokens(request);

    const backendConfig = await request.post(`${BACKEND}/api/config/proxy/mbtiles`, {
      headers: {
        Authorization: `Bearer ${tokens.proxy_token}`,
        'X-SITMUN-Proxy-Key': PROXY_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        appId: fixture.appId,
        territoryId: fixture.territoryId,
        action: 'estimate',
        ...estimateBody(fixture),
      },
    });
    expect(backendConfig.status(), await backendConfig.text()).toBe(200);
    const canonical = await backendConfig.json();
    expect(canonical.tileRequest?.mapServices?.[0]?.url).toBeTruthy();

    const response = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
      {
        headers: {
          Authorization: `Bearer ${tokens.proxy_token}`,
          'Content-Type': 'application/json',
        },
        data: estimateBody(fixture),
      },
    );
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    expect(body).toBeTruthy();
  });

  test('client-supplied absolute map URL is ignored; unknown service denied', async ({
    request,
  }) => {
    const fixture = await loadMobileFixture();
    const tokens = await mobileTokens(request);
    const response = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
      {
        headers: {
          Authorization: `Bearer ${tokens.proxy_token}`,
          'Content-Type': 'application/json',
        },
        data: estimateBody(fixture, {
          services: [
            {
              serviceId: 999999,
              layerIds: [fixture.layerId],
              url: 'http://127.0.0.1:9/ssrf-canary',
            },
          ],
        }),
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('create returns opaque jobHandle; status accepts handle; tampered handle fails', async ({
    request,
  }) => {
    const fixture = await loadMobileFixture();
    const tokens = await mobileTokens(request);
    const create = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles`,
      {
        headers: {
          Authorization: `Bearer ${tokens.proxy_token}`,
          'Content-Type': 'application/json',
        },
        data: estimateBody(fixture),
      },
    );
    expect(create.status(), await create.text()).toBe(200);
    const created = await create.json();
    expect(created.jobHandle).toBeTruthy();
    expect(String(created.jobHandle)).not.toMatch(/^\d+$/);

    const status = await request.get(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/${created.jobHandle}`,
      { headers: { Authorization: `Bearer ${tokens.proxy_token}` } },
    );
    expect(status.status(), await status.text()).toBeLessThan(500);

    const tampered = `${created.jobHandle}x`;
    const bad = await request.get(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/${tampered}`,
      { headers: { Authorization: `Bearer ${tokens.proxy_token}` } },
    );
    expect(bad.status()).toBeGreaterThanOrEqual(400);
  });
});
