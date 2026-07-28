import { test, expect } from '../fixtures';
import { createLiteralViaGrid, openLiteralTranslations } from '../helpers/literal-csv';
import { uniqueValue } from '../helpers/form';

test.describe('Literal translation grid CRUD', () => {
  test('create literal row and reload persists', async ({ page }) => {
    const literal = uniqueValue('e2e-grid-literal');
    const translation = uniqueValue('e2e-grid-translation');

    await createLiteralViaGrid(page, {
      literal,
      sourceLanguage: 'en',
      targetLanguage: 'ca',
      translation,
    });

    await page.reload();
    await openLiteralTranslations(page);
    await expect(page.locator('.literal-translations-grid')).toContainText(literal, {
      timeout: 15_000,
    });

    // Grid Value column is for the selected target language (not source).
    await page.locator('mat-select').filter({ hasText: /\(/ }).first().click();
    await page
      .locator('mat-option')
      .filter({ hasText: /\(ca\)/i })
      .first()
      .click();
    await expect(page.locator('.literal-translations-grid')).toContainText(translation, {
      timeout: 15_000,
    });
  });
});
