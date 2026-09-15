import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { readViewerCredentials } from './fixtures';

const EN_ACCOUNT = 'My Account';
const ES_ACCOUNT = 'Mi perfil';

async function loginAndOpenProfile(
  page: Page,
  username: string,
  password: string,
  language: string,
  accountLabel: string,
): Promise<void> {
  await page.addInitScript((lang) => {
    localStorage.setItem('language', lang);
  }, language);
  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form .login-button button').click();
  await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 30_000 });

  const hamburger = page
    .locator('button[mat-icon-button]')
    .filter({ has: page.locator('mat-icon', { hasText: 'menu' }) })
    .first();
  await hamburger.click();
  await page.getByRole('menuitem', { name: accountLabel }).click();
  await expect(page).toHaveURL(/\/user\/profile/);
  await page.locator('#territories-profile-section').scrollIntoViewIfNeeded();
}

function cargoTable(page: Page) {
  return page.locator('table.territory-table');
}

test.describe('Viewer profile cargo copy', () => {
  test('shows Valid from, Valid until, Not set, and Active', async ({ page }) => {
    const credentials = await readViewerCredentials();
    await loginAndOpenProfile(
      page,
      credentials.nullCreatedDateUsername,
      credentials.nullCreatedDatePassword,
      'en',
      EN_ACCOUNT,
    );
    const table = cargoTable(page);
    await expect(table.locator('thead th')).toHaveText([
      'Email',
      'Organization',
      'Position',
      'Type',
      'Valid from',
      'Valid until',
    ]);
    const row = table.getByRole('row').filter({ hasText: 'e2e-null-dates' });
    await expect(row).toBeVisible();
    await expect(row.locator('td.from-col')).toContainText('Not set');
    await expect(row.locator('td.to-col')).toContainText('Active');
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/viewer-copy-review-en.png' });
  });

  test('shows Fecha de alta, Fecha de baja, No informada, and Activo', async ({ page }) => {
    const credentials = await readViewerCredentials();
    await loginAndOpenProfile(
      page,
      credentials.nullCreatedDateUsername,
      credentials.nullCreatedDatePassword,
      'es',
      ES_ACCOUNT,
    );
    const table = cargoTable(page);
    await expect(table.locator('thead th')).toHaveText([
      'Correo electrónico',
      'Organización',
      'Cargo',
      'Tipo',
      'Fecha de alta',
      'Fecha de baja',
    ]);
    const row = table.getByRole('row').filter({ hasText: 'e2e-null-dates' });
    await expect(row).toBeVisible();
    await expect(row.locator('td.from-col')).toContainText('No informada');
    await expect(row.locator('td.to-col')).toContainText('Activo');
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/viewer-copy-review-es.png' });
  });
});
