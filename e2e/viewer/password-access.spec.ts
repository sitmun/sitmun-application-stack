import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  APP_ID,
  fetchCapabilities,
  hasProxyTokenInIndexedDb,
  isBackendRequest,
  MENORCA_TERRITORY_ID,
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

  test('hides expired cargo in territory list and denies its profile', async ({ page }) => {
    const credentials = await readViewerCredentials();

    await page.goto('/auth/login');
    await expect(page.locator('h1')).toBeVisible();
    await page.locator('input[name="username"]').fill(credentials.expiryUsername);
    await page.locator('input[name="password"]').fill(credentials.expiryPassword);
    await page.locator('form .login-button button').click();
    await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 30_000 });

    const listed = await page.evaluate(async (appId) => {
      const response = await fetch(
        `/backend/api/config/client/application/${appId}/territories`,
        { credentials: 'same-origin' },
      );
      const body = (await response.json()) as { content?: Array<{ id?: number }> };
      return { status: response.status, ids: (body.content ?? []).map((row) => row.id) };
    }, APP_ID);
    expect(listed.status).toBe(200);
    expect(listed.ids).toContain(TERRITORY_ID);
    expect(listed.ids).not.toContain(MENORCA_TERRITORY_ID);
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/184-regression-picker.png' });

    const expiredProfile = await page.evaluate(
      async ({ appId, territoryId }) => {
        const response = await fetch(
          `/backend/api/config/client/profile/${appId}/${territoryId}`,
          { credentials: 'same-origin' },
        );
        return response.status;
      },
      { appId: APP_ID, territoryId: MENORCA_TERRITORY_ID },
    );
    expect(expiredProfile).toBe(403);
    await page.screenshot({ path: 'test-results/184-profile-denied.png' });

    const liveProfile = await page.evaluate(
      async ({ appId, territoryId }) => {
        const response = await fetch(
          `/backend/api/config/client/profile/${appId}/${territoryId}`,
          { credentials: 'same-origin' },
        );
        return response.status;
      },
      { appId: APP_ID, territoryId: TERRITORY_ID },
    );
    expect(liveProfile).toBe(200);

    await page.getByRole('tab', { name: 'Limited access applications' }).click();
    const provincial = page
      .getByRole('tabpanel', { name: 'Limited access applications' })
      .locator('mat-card.dashboard-item')
      .filter({ hasText: 'SITMUN - Provincial' });
    await provincial.locator('.primary-button').click();
    await expect(page).toHaveURL(new RegExp(`/user/map/${APP_ID}/${TERRITORY_ID}`));
  });

  test('client application list for mixed-grant user stays under 5s', async ({ page }) => {
    const credentials = await readViewerCredentials();
    await page.goto('/auth/login');
    await page.locator('input[name="username"]').fill(credentials.expiryUsername);
    await page.locator('input[name="password"]').fill(credentials.expiryPassword);
    await page.locator('form .login-button button').click();
    await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 30_000 });

    const samples: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const elapsed = await page.evaluate(async () => {
        const started = performance.now();
        const response = await fetch('/backend/api/config/client/application', {
          credentials: 'same-origin',
        });
        await response.arrayBuffer();
        return { status: response.status, ms: performance.now() - started };
      });
      expect(elapsed.status).toBe(200);
      expect(elapsed.ms).toBeLessThan(5000);
      samples.push(elapsed.ms);
      await page.waitForTimeout(1000);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const median = (sorted[9] + sorted[10]) / 2;
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/184-perf-head.json',
      JSON.stringify({ median, max: Math.max(...samples), samples }, null, 2),
    );
    expect(median).toBeLessThan(5000);
  });
});
