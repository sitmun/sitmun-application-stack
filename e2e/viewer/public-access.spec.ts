import { test, expect } from '@playwright/test';
import {
  APP_ID,
  BLOCKED_CONTACT_APP_TITLE,
  BLOCKED_CONTACT_EMAIL,
  BLOCKED_CONTACT_INSTITUTION,
  CONTACT_APP_TITLE,
  CONTACT_EMAIL,
  CONTACT_INSTITUTION,
  fetchCapabilities,
  hasProxyTokenInIndexedDb,
  isBackendRequest,
  TERRITORY_ID,
} from './fixtures';

async function openPublicDashboard(page: import('@playwright/test').Page): Promise<void> {
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
}

async function openApplicationDetails(
  page: import('@playwright/test').Page,
  title: string,
): Promise<void> {
  const card = page.locator('mat-card.dashboard-item').filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card
    .getByRole('button', {
      name: /View details|Ver detalles|Veure detalls|Voir les détails/i,
    })
    .click();
  await expect(page.locator('#left-side #application-details')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Viewer public access', () => {
  test('loads public dashboard but rejects private profile and WMS', async ({ page }) => {
    await openPublicDashboard(page);

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

  test('shows eligible PoC email and hides blocked PoC email', async ({ page }) => {
    await openPublicDashboard(page);

    await openApplicationDetails(page, CONTACT_APP_TITLE);
    await expect(page.locator('#application-responsible-institution')).toContainText(
      CONTACT_INSTITUTION,
    );
    await expect(page.locator('#application-point-of-contact')).toContainText(CONTACT_EMAIL);

    await page.goBack();
    await expect(page).toHaveURL(/\/public\/dashboard/);

    await openApplicationDetails(page, BLOCKED_CONTACT_APP_TITLE);
    await expect(page.locator('#application-responsible-institution')).toContainText(
      BLOCKED_CONTACT_INSTITUTION,
    );
    await expect(page.locator('#application-point-of-contact')).toHaveCount(0);
    await expect(page.locator('#left-side #application-details')).not.toContainText(
      BLOCKED_CONTACT_EMAIL,
    );
  });
});
