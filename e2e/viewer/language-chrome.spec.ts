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

test.describe('Viewer language chrome', () => {
  test('toolbar shows ISO left of hamburger; endonyms in menu; no language in hamburger', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('language');
    });

    await page.goto('/auth/login');
    const defaultLang = await readLanguageDefault(page);
    const expectedIso = toIso(defaultLang);

    const languageButton = page.locator('button.language-toolbar-button').first();
    await expect(languageButton).toBeVisible({ timeout: 30_000 });
    await expect(languageButton).toContainText(expectedIso);

    const hamburger = page.locator('button[mat-icon-button]').filter({
      has: page.locator('mat-icon', { hasText: 'menu' }),
    }).first();
    await expect(hamburger).toBeVisible();

    const langBox = await languageButton.boundingBox();
    const menuBox = await hamburger.boundingBox();
    expect(langBox && menuBox).toBeTruthy();
    if (langBox && menuBox) {
      expect(langBox.x).toBeLessThan(menuBox.x);
    }

    await languageButton.click();
    const langMenu = page.locator('.mat-mdc-menu-panel, .mat-menu-panel').last();
    await expect(langMenu.getByRole('menuitem', { name: 'English' })).toBeVisible();
    await expect(langMenu.getByRole('menuitem', { name: 'Català' })).toBeVisible();
    await expect(langMenu.getByRole('menuitem', { name: 'Castellano' })).toBeVisible();
    await page.keyboard.press('Escape');

    await hamburger.click();
    const appMenu = page.locator('.mat-mdc-menu-panel, .mat-menu-panel').last();
    await expect(appMenu.getByRole('menuitem', { name: 'Català' })).toHaveCount(0);
    await expect(appMenu.getByRole('menuitem', { name: 'English' })).toHaveCount(0);
  });
});
