import { test, expect } from '@playwright/test';
import {
  APP_ID,
  fetchCapabilities,
  hasProxyTokenInIndexedDb,
  isBackendRequest,
  PROXY_PATH,
  readViewerCredentials,
  TERRITORY_ID,
  waitForMiddlewareUrlInIndexedDb,
  waitForProxyTokenInIndexedDb,
  waitForServiceWorkerControl,
} from './fixtures';

test.describe('Viewer password access', () => {
  test('logs in as regular user and loads secured WMS through proxy', async ({ page }) => {
    const credentials = await readViewerCredentials();

    await page.goto('/auth/login');
    await expect(page.locator('h1')).toBeVisible();

    await page.locator('input[name="username"]').fill(credentials.username);
    await page.locator('input[name="password"]').fill(credentials.password);

    const authenticate = page.waitForResponse(
      (response) => isBackendRequest(response, '/authenticate', 'POST') && response.ok(),
    );
    const account = page.waitForResponse(
      (response) => isBackendRequest(response, '/account', 'GET') && response.ok(),
    );
    const proxyToken = page.waitForResponse(
      (response) => isBackendRequest(response, '/authenticate/proxy', 'POST') && response.ok(),
    );

    await page.locator('form .login-button button').click();

    await Promise.all([authenticate, account]);
    const proxyTokenResponse = await proxyToken;
    const proxyTokenBody = (await proxyTokenResponse.json()) as { proxy_token?: string };
    expect(proxyTokenBody.proxy_token, 'proxy_token missing').toBeTruthy();

    await expect(page).toHaveURL(/\/user\/dashboard/);

    const storedUsername = await page.evaluate(() =>
      window.sessionStorage.getItem('sitmun_viewer_app_username'),
    );
    expect(storedUsername).toBe(credentials.username);

    const profile = page.waitForResponse(
      (response) =>
        isBackendRequest(
          response,
          `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
          'GET',
        ) && response.ok(),
    );

    await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, {
      waitUntil: 'domcontentloaded',
    });

    const profileResponse = await profile;
    const profileBody = await profileResponse.text();
    expect(profileBody).toContain(PROXY_PATH);

    await waitForServiceWorkerControl(page);
    await waitForMiddlewareUrlInIndexedDb(page);
    await waitForProxyTokenInIndexedDb(page);

    expect(await hasProxyTokenInIndexedDb(page)).toBe(true);
    const capabilities = await fetchCapabilities(page);

    expect(capabilities.status).toBe(200);
    expect(capabilities.contentType ?? '').toMatch(/xml/i);
    expect(capabilities.body).toContain('WMS_Capabilities');
    expect(capabilities.body).toContain('E2E Secured WMS Stub');
  });
});
