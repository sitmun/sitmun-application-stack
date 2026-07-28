import { expect, test } from '@playwright/test';
import { MIDDLEWARE } from './fixtures';
import { estimateBody, loadMobileFixture, mobileTokens } from './helpers';

test.describe('edition proxy authorization', () => {
  test('middleware rejects missing bearer on MBTiles estimate', async ({ request }) => {
    const fixture = await loadMobileFixture();
    const response = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
      { data: estimateBody(fixture) },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('middleware rejects access_token as proxy credential', async ({ request }) => {
    const fixture = await loadMobileFixture();
    const tokens = await mobileTokens(request);
    const response = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/${fixture.territoryId}/mbtiles/estimate`,
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        data: estimateBody(fixture),
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('middleware rejects wrong territory with valid proxy_token', async ({ request }) => {
    const fixture = await loadMobileFixture();
    const tokens = await mobileTokens(request);
    const response = await request.post(
      `${MIDDLEWARE}/proxy/${fixture.appId}/999999/mbtiles/estimate`,
      {
        headers: { Authorization: `Bearer ${tokens.proxy_token}` },
        data: estimateBody(fixture),
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
