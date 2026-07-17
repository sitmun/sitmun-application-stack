import { test, expect } from '@playwright/test';
import {
  APP_ID,
  fetchCapabilities,
  hasProxyTokenInIndexedDb,
  isBackendRequest,
  TERRITORY_ID,
} from './fixtures';

test.describe('Viewer public access', () => {
  test('loads public dashboard but rejects private profile and WMS', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('h1')).toBeVisible();

    const logout = page.waitForResponse(
      (response) => isBackendRequest(response, '/authenticate/logout', 'POST') && response.ok(),
    );
    const dashboardApps = page.waitForResponse(
      (response) =>
        isBackendRequest(response, '/config/client/dashboard/applications', 'GET') &&
        response.ok(),
    );

    await page.getByRole('button', { name: /Acceso público|Public access/i }).click();
    await Promise.all([logout, dashboardApps]);
    await expect(page).toHaveURL(/\/public\/dashboard/);

    const username = await page.evaluate(() =>
      window.sessionStorage.getItem('sitmun_viewer_app_username'),
    );
    expect(username).toBeNull();

    const profileStatus = await page.evaluate(
      async ({ appId, territoryId }) => {
        const response = await fetch(
          `/backend/api/config/client/profile/${appId}/${territoryId}`,
          { credentials: 'same-origin' },
        );
        return response.status;
      },
      { appId: APP_ID, territoryId: TERRITORY_ID },
    );
    expect(profileStatus).toBe(403);
    expect(await hasProxyTokenInIndexedDb(page)).toBe(false);

    const capabilities = await fetchCapabilities(page);
    expect(capabilities.status).toBe(403);
    expect(capabilities.body).not.toContain('E2E Secured WMS Stub');
  });
});
