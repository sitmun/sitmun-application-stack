import { test, expect } from '@playwright/test';

test('admin UI login reaches dashboard', async ({ page }) => {
  const accountPromise = page.waitForResponse((response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      return (
        pathname === '/backend/api/account' &&
        response.request().method() === 'GET' &&
        response.ok()
      );
    } catch {
      return false;
    }
  });

  await page.goto('/#/login');
  await page.locator('[formControlName="username"]').fill('admin');
  await page.locator('[formControlName="password"]').fill('admin');
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/#\/dashboard/);
  const account = await accountPromise;
  expect(account.ok()).toBeTruthy();
  await page.screenshot({ path: 'test-results/184-admin-login.png' });
});

test('admin session refresh keeps an operator with no cargos signed in', async ({ page }) => {
  const refresh = page.waitForResponse((response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      return pathname === '/backend/api/authenticate/refresh' && response.request().method() === 'POST';
    } catch {
      return false;
    }
  });

  await page.goto('/#/login');
  await page.locator('[formControlName="username"]').fill('admin');
  await page.locator('[formControlName="password"]').fill('admin');
  await page.locator('button[type="submit"]').click();

  const refreshResponse = await refresh;
  expect(refreshResponse.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/#\/dashboard/);
  await page.screenshot({ path: 'test-results/refresh-admin.png' });
});
