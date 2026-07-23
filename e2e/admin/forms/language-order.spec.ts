import { test, expect } from '../fixtures';
import { control, saveUpdate, waitForFormReady } from '../helpers/form';

/** Français (id 5) — non-default; safe to toggle enabled/order then restore. */
const FR_LANGUAGE_ID = 5;

test.describe('Language enabled/order', () => {
  test('disable non-default language and restore', async ({ page, request }) => {
    const get = await request.get(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(get.ok(), await get.text()).toBeTruthy();
    const original = (await get.json()) as {
      name: string;
      shortname: string;
      enabled: boolean;
      order: number;
    };

    try {
      await page.goto(`/#/language/${FR_LANGUAGE_ID}/languageForm`);
      await waitForFormReady(page, 'name');

      const enabledToggle = page.locator('mat-slide-toggle[formControlName="enabled"]');
      await expect(enabledToggle).toBeVisible({ timeout: 15_000 });
      const checked = await enabledToggle.evaluate((el) => el.classList.contains('mat-mdc-slide-toggle-checked') || el.classList.contains('mat-checked'));
      if (checked) {
        await enabledToggle.locator('button').click();
      }
      await expect(enabledToggle).not.toHaveClass(/mat-mdc-slide-toggle-checked|mat-checked/);

      const orderField = control(page, 'order');
      await orderField.fill('99');
      await saveUpdate(page, 'languages', FR_LANGUAGE_ID);

      await page.reload();
      await waitForFormReady(page, 'name');
      await expect(page.locator('mat-slide-toggle[formControlName="enabled"]')).not.toHaveClass(
        /mat-mdc-slide-toggle-checked|mat-checked/,
      );
      await expect(control(page, 'order')).toHaveValue('99');

      await page.addInitScript(() => {
        localStorage.removeItem('lang');
        localStorage.removeItem('languages');
      });
      await page.goto('/#/login');
      const languageButton = page.locator('button.language-toolbar-button');
      await expect(languageButton).toBeVisible({ timeout: 30_000 });
      await languageButton.click();
      const menu = page.locator('.mat-mdc-menu-panel, .mat-menu-panel').last();
      await expect(menu.getByRole('menuitem', { name: 'Français' })).toHaveCount(0);
    } finally {
      const restore = await request.put(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          name: original.name,
          shortname: original.shortname,
          enabled: original.enabled,
          order: original.order,
        },
      });
      expect(restore.ok(), await restore.text()).toBeTruthy();
    }
  });
});
