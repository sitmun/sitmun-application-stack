import { test, expect } from '@playwright/test';

test('admin UI login reaches dashboard', async ({ page }) => {
  const accountPromise = page.waitForResponse((response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      return pathname === '/backend/api/account' && response.request().method() === 'GET';
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
});
