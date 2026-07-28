import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const LITERALS_PATH = '/#/literalTranslations';

export async function openLiteralTranslations(page: Page): Promise<void> {
  await page.goto(LITERALS_PATH);
  await expect(page.locator('app-literal-translations')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.literal-translations-grid')).toBeVisible({ timeout: 30_000 });
}

function toolbarIconButton(page: Page, iconText: string) {
  return page
    .locator('button.toolbar-button, mat-toolbar button')
    .filter({ has: page.locator('mat-icon', { hasText: iconText }) })
    .first();
}

export async function importLiteralCsv(
  page: Page,
  options: { filePath: string; targetLanguage: string },
): Promise<void> {
  await openLiteralTranslations(page);
  await toolbarIconButton(page, 'file_upload').click();
  const dialog = page.locator('app-literal-translation-csv-dialog, mat-dialog-container').last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.locator('mat-select').first().click();
  await page
    .locator('mat-option')
    .filter({ hasText: new RegExp(`\\(${options.targetLanguage}\\)`, 'i') })
    .first()
    .click();

  await dialog.locator('#literal-translation-csv-file').setInputFiles(path.resolve(options.filePath));
  await dialog.getByRole('button', { name: /Import CSV/i }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

export async function createLiteralViaGrid(
  page: Page,
  options: {
    literal: string;
    sourceLanguage: string;
    /** Non-source language for the editable translation card (source textarea is disabled). */
    targetLanguage: string;
    translation: string;
  },
): Promise<void> {
  await openLiteralTranslations(page);
  await toolbarIconButton(page, 'add_circle_outline').click();
  const dialog = page.locator('app-literal-translation-create-dialog, mat-dialog-container').last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await dialog.locator('[formControlName="literal"]').fill(options.literal);
  await dialog.locator('mat-select').first().click();
  await page
    .locator('mat-option')
    .filter({ hasText: new RegExp(`\\(${options.sourceLanguage}\\)`, 'i') })
    .first()
    .click();
  await dialog
    .locator('.language-switcher-item')
    .filter({ has: page.locator('.language-switcher-code', { hasText: options.targetLanguage }) })
    .click();
  await dialog.locator('.translation-card textarea:not([disabled])').fill(options.translation);
  await dialog.getByRole('button', { name: /^(Save|Desar|Guardar|Enregistrer)$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('.literal-translations-grid')).toContainText(options.literal, {
    timeout: 15_000,
  });
}
