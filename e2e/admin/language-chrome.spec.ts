import { test, expect } from '@playwright/test';

async function readLanguageDefault(
  page: import('@playwright/test').Page,
): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch('/backend/api/configuration-parameters');
    const body = await response.json();
    const params = Array.isArray(body)
      ? body
      : body?._embedded?.['configuration-parameters'] || [];
    const found = params.find(
      (p: { name?: string; value?: string }) => p?.name === 'language.default',
    );
    return found?.value || 'en';
  });
}

function toIso(shortname: string): string {
  return shortname.trim().split(/[-_]/)[0].toUpperCase();
}

test.describe('Admin language chrome', () => {
  test('login toolbar shows ISO closed and API endonyms; no form language field', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('lang');
      localStorage.removeItem('languages');
    });

    await page.goto('/#/login');
    const defaultLang = await readLanguageDefault(page);
    const expectedIso = toIso(defaultLang);

    await expect(page.locator('[formControlName="lang"]')).toHaveCount(0);

    const languageButton = page.locator('button.language-toolbar-button');
    await expect(languageButton).toBeVisible({ timeout: 30_000 });
    await expect(languageButton).toContainText(expectedIso);
    await expect(languageButton).not.toContainText(/English|Català|Castellano/i);

    await languageButton.click();
    const menu = page.locator('.mat-mdc-menu-panel, .mat-menu-panel').last();
    await expect(menu.getByRole('menuitem', { name: 'English' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Català' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Castellano' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Anglès' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Castellà' })).toHaveCount(0);
  });
});
