import { test, expect } from '../fixtures';
import { waitForFormReady } from '../helpers/form';

async function readLanguageDefault(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const response = await request.get('/backend/api/configuration-parameters', {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const params = Array.isArray(body)
    ? body
    : body?._embedded?.['configuration-parameters'] || [];
  const found = params.find(
    (p: { name?: string; value?: string }) => p?.name === 'language.default',
  );
  return found?.value || 'en';
}

test.describe('Language default change', () => {
  test('preview dialog cancel leaves language.default unchanged', async ({ page, request }) => {
    const before = await readLanguageDefault(request);
    expect(before).toBeTruthy();

    // Open a non-default language (ca = 3 when default is en).
    await page.goto('/#/language/3/languageForm');
    await waitForFormReady(page, 'name');

    const setDefault = page
      .locator('button')
      .filter({ has: page.locator('mat-icon', { hasText: 'star' }) })
      .first();
    await expect(setDefault).toBeVisible({ timeout: 15_000 });
    await expect(setDefault).toBeEnabled();
    await setDefault.click();

    const dialog = page.locator('app-default-language-change-dialog, mat-dialog-container').last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: /Cancel|Cancel·lar|Cancelar|Annuler/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    expect(await readLanguageDefault(request)).toBe(before);
  });

  test('language.default is not freely editable via raw configuration parameter', async ({
    request,
  }) => {
    const list = await request.get('/backend/api/configuration-parameters', {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(list.ok()).toBeTruthy();
    const body = await list.json();
    const params = Array.isArray(body)
      ? body
      : body?._embedded?.['configuration-parameters'] || [];
    const found = params.find(
      (p: { name?: string; id?: number }) => p?.name === 'language.default',
    );
    expect(found?.id, 'language.default config id').toBeTruthy();

    const put = await request.put(`/backend/api/configuration-parameters/${found.id}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        name: 'language.default',
        value: 'xx-should-fail',
      },
    });
    if (put.ok()) {
      expect(await readLanguageDefault(request)).not.toBe('xx-should-fail');
    } else {
      expect(put.status()).toBeGreaterThanOrEqual(400);
    }
  });
});
