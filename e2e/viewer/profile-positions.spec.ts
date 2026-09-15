import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { readViewerCredentials } from './fixtures';

const EN_ACCOUNT = 'My Account';
const ES_ACCOUNT = 'Mi perfil';
const CA_ACCOUNT = 'El meu perfil';

async function loginPasswordUser(
  page: Page,
  username: string,
  password: string,
  language: string,
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
}

async function openProfile(page: Page, accountLabel: string): Promise<void> {
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

async function saveShots(page: Page, table: ReturnType<typeof cargoTable>, slug: string) {
  await mkdir('test-results', { recursive: true });
  await table.scrollIntoViewIfNeeded();
  await table.screenshot({ path: `test-results/${slug}.png` });
}

test.describe('Viewer profile cargo copy', () => {
  test('shows Valid from, Valid until, Not set, and Active', async ({ page }) => {
    const credentials = await readViewerCredentials();
    await loginPasswordUser(
      page,
      credentials.nullCreatedDateUsername,
      credentials.nullCreatedDatePassword,
      'en',
    );
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/copy-dashboard.png' });

    await openProfile(page, EN_ACCOUNT);
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
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator('td.from-col')).toContainText('Not set');
    await expect(row.locator('td.to-col')).toContainText('Active');
    await expect(row.getByRole('button', { name: 'Edit organization' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Edit name' })).toBeVisible();
    const dated = table.getByRole('row').filter({ hasText: 'Job 622' });
    await expect(dated.locator('td.from-col')).toContainText('18/03/2016');
    await saveShots(page, table, 'viewer-copy-review-en');
    await table.screenshot({ path: 'test-results/stack-e2e-copy-review-en.png' });
    await table.screenshot({ path: 'test-results/copy-en-headers.png' });
    await row.screenshot({ path: 'test-results/copy-en-not-set.png' });
    await dated.screenshot({ path: 'test-results/copy-dated-row.png' });
    await row.screenshot({ path: 'test-results/copy-edit-controls.png' });

    if (process.env.SITMUN_E2E_COPY_PERF === '1') {
      const samples: number[] = [];
      for (let i = 0; i < 10; i += 1) {
        const started = performance.now();
        await page.goto('/user/profile');
        await expect(cargoTable(page).locator('thead th').nth(4)).toHaveText('Valid from');
        samples.push(performance.now() - started);
      }
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      await writeFile(
        'test-results/copy-perf-head.json',
        JSON.stringify({ samples, medianMs: median }, null, 2),
      );
      expect(median).toBeLessThan(3000);
    }
  });

  test('shows Fecha de alta, Fecha de baja, No informada, and Activo', async ({ page }) => {
    const credentials = await readViewerCredentials();
    await loginPasswordUser(
      page,
      credentials.nullCreatedDateUsername,
      credentials.nullCreatedDatePassword,
      'es',
    );
    await openProfile(page, ES_ACCOUNT);
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
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator('td.from-col')).toContainText('No informada');
    await expect(row.locator('td.to-col')).toContainText('Activo');
    await saveShots(page, table, 'viewer-copy-review-es');
    await table.screenshot({ path: 'test-results/stack-e2e-copy-review-es.png' });
    await table.screenshot({ path: 'test-results/copy-es-headers.png' });
    await row.screenshot({ path: 'test-results/copy-es-placeholders.png' });
  });

  test("shows Data d'alta and Data de baixa", async ({ page }) => {
    const credentials = await readViewerCredentials();
    await loginPasswordUser(
      page,
      credentials.nullCreatedDateUsername,
      credentials.nullCreatedDatePassword,
      'ca',
    );
    await openProfile(page, CA_ACCOUNT);
    const table = cargoTable(page);
    await expect(table.locator('thead th')).toHaveText([
      'Correu electrònic',
      'Organització',
      'Càrrec',
      'Tipus',
      "Data d'alta",
      'Data de baixa',
    ]);
    await saveShots(page, table, 'copy-ca-headers');
  });
});
