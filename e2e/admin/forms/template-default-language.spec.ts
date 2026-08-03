import { test, expect } from '../fixtures';
import {
  assertPlantillaHtmlPersisted,
  createPlantilla,
  ensurePlantillaPreviewOpen,
  openPlantilla,
  renderPlantillaPreview,
  selectPlantillaPreviewLanguage,
} from '../helpers/template';
import { importLiteralCsv, openLiteralTranslations } from '../helpers/literal-csv';
import { uniqueValue } from '../helpers/form';

/** Français — non-default; safe to toggle enabled in N5/N13. */
const FR_LANGUAGE_ID = 5;

async function readLanguageDefault(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
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

async function findLiteralByKey(
  request: import('@playwright/test').APIRequestContext,
  literal: string,
): Promise<{
  id: number;
  literal: string;
  sourceLanguage: string;
  translation?: string;
  value?: string;
  complete?: boolean;
} | null> {
  const response = await request.get(
    `/backend/api/literal-translations?lang=en&searchText=${encodeURIComponent(literal)}`,
    { headers: { 'X-SITMUN-Client': 'admin' } },
  );
  if (!response.ok()) {
    return null;
  }
  const body = await response.json();
  const items = Array.isArray(body) ? body : body?.content || body?._embedded?.literalTranslations || [];
  return (
    items.find((item: { literal?: string }) => item.literal === literal) ?? null
  );
}

async function changeDefaultLanguage(
  request: import('@playwright/test').APIRequestContext,
  from: string,
  to: string,
): Promise<void> {
  const apply = await request.post('/backend/api/language-default/change', {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/json',
    },
    data: {
      from,
      to,
      continueOnMissingTranslations: true,
    },
  });
  expect(apply.ok(), await apply.text()).toBeTruthy();
}

test.describe('Templates + language.default i18n cluster', () => {
  test('enroll on save, preview langs, survive default change, seed continuity', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(120_000);
    const initialDefault = await readLanguageDefault(request);
    expect(initialDefault).toBeTruthy();
    const otherLang = initialDefault === 'en' ? 'ca' : 'en';
    const literalKey = `e2e-enroll-${uniqueValue('KEY')}`;
    const translated = `e2e-translated-${uniqueValue('TR')}`;

    await page.addInitScript((lang) => {
      localStorage.setItem('lang', lang);
    }, otherLang === 'ca' ? 'ca' : 'es');

    const plantilla = await createPlantilla(page, {
      html: `<p data-e2e-enroll="1"><t>${literalKey}</t></p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await assertPlantillaHtmlPersisted(request, plantilla.id, literalKey);

    // N1 / N10: enrolled with DB default as sourceLanguage (not UI lang)
    const enrolled = await findLiteralByKey(request, literalKey);
    expect(enrolled, 'literal enrolled on template save').toBeTruthy();
    expect(enrolled!.sourceLanguage).toBe(initialDefault);

    // N9: preview in source language shows self-translation (key)
    await openPlantilla(page, plantilla.id);
    await selectPlantillaPreviewLanguage(page, initialDefault);
    await renderPlantillaPreview(page);
    await expect(page.locator('[data-testid="template-preview-html"]')).toContainText(literalKey, {
      timeout: 30_000,
    });

    // Add translation for other language (literal already enrolled on save)
    const lit = await findLiteralByKey(request, literalKey);
    expect(lit?.id).toBeTruthy();
    const put = await request.put(`/backend/api/literal-translations/${lit!.id}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        literal: literalKey,
        language: otherLang,
        sourceLanguage: initialDefault,
        translation: translated,
        translations: { [otherLang]: translated },
      },
    });
    expect(put.ok(), await put.text()).toBeTruthy();

    // N4: admin preview with other lang shows translation
    await openPlantilla(page, plantilla.id);
    await selectPlantillaPreviewLanguage(page, otherLang);
    await renderPlantillaPreview(page);
    await expect(page.locator('[data-testid="template-preview-html"]')).toContainText(translated, {
      timeout: 30_000,
    });

    // N8: language without translation falls back to opaque key (seeded H2 always has es/oc-aranes/fr)
    const langs = await request.get('/backend/api/languages?projection=view', {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    const langBody = await langs.json();
    const langList = Array.isArray(langBody)
      ? langBody
      : langBody?._embedded?.languages || [];
    const fallbackLang = langList.find(
      (l: { shortname?: string; enabled?: boolean }) =>
        l.shortname &&
        l.shortname !== initialDefault &&
        l.shortname !== otherLang &&
        l.enabled !== false,
    )?.shortname;
    expect(fallbackLang, 'seeded third enabled language for N8').toBeTruthy();

    const previewFallback = await request.post(
      `/backend/api/tasks/template/preview?lang=${fallbackLang}`,
      {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          templateTaskId: plantilla.id,
          templateHtml: `<p><t>${literalKey}</t></p>`,
          context: {},
          knownTaskReferences: [],
        },
      },
    );
    expect(previewFallback.ok(), await previewFallback.text()).toBeTruthy();
    const fallbackPayload = JSON.stringify(await previewFallback.json());
    expect(fallbackPayload).toContain(literalKey);
    expect(fallbackPayload).not.toContain(translated);

    await openPlantilla(page, plantilla.id);
    await selectPlantillaPreviewLanguage(page, fallbackLang);
    await renderPlantillaPreview(page);
    await expect(page.locator('[data-testid="template-preview-html"]')).toContainText(literalKey, {
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="template-preview-html"]')).not.toContainText(translated);

    // N12 before default change: overlay lang must differ from current DB default
    const overlayLang = initialDefault === 'en' ? 'ca' : 'en';
    const overlayLangId = overlayLang === 'ca' ? 3 : 1;
    const taskName = plantilla.name;
    const i18nName = `${taskName}-i18n`;
    const translationCreate = await request.post('/backend/api/translations', {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        element: plantilla.id,
        column: 'Task.name',
        translation: i18nName,
        language: `http://localhost:18080/api/languages/${overlayLangId}`,
      },
    });
    expect(translationCreate.ok(), await translationCreate.text()).toBeTruthy();
    const taskRes = await request.get(`/backend/api/tasks/${plantilla.id}?lang=${overlayLang}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Accept-Language': overlayLang,
      },
    });
    expect(taskRes.ok(), await taskRes.text()).toBeTruthy();
    expect((await taskRes.json()).name).toBe(i18nName);

    // Continuity-only key (A value only) for N14 — main key already has an otherLang value.
    const continuityKey = `e2e-continuity-${uniqueValue('KEY')}`;
    const continuityPlantilla = await createPlantilla(page, {
      html: `<p><t>${continuityKey}</t></p>`,
    });
    createdResources.push({ collection: 'tasks', id: continuityPlantilla.id });
    expect(await findLiteralByKey(request, continuityKey)).toBeTruthy();

    // N2 / N3 / N14: change default and assert Templates still load + key stable + B seeded from A
    await changeDefaultLanguage(request, initialDefault, otherLang);
    expect(await readLanguageDefault(request)).toBe(otherLang);

    await page.goto('/#/tasksTemplate');
    await expect(page.locator('app-tasks-template').first()).toBeVisible({ timeout: 30_000 });
    await openPlantilla(page, plantilla.id);
    await expect(page.locator('app-task-template-form, app-template-editor').first()).toBeVisible({
      timeout: 30_000,
    });
    await assertPlantillaHtmlPersisted(request, plantilla.id, `<t>${literalKey}</t>`);

    const afterChange = await request.get(
      `/backend/api/literal-translations?lang=${otherLang}&searchText=${encodeURIComponent(continuityKey)}`,
      { headers: { 'X-SITMUN-Client': 'admin' } },
    );
    expect(afterChange.ok(), await afterChange.text()).toBeTruthy();
    const afterBody = await afterChange.json();
    const afterItems = Array.isArray(afterBody)
      ? afterBody
      : afterBody?.content || [];
    const seeded = afterItems.find((i: { literal?: string }) => i.literal === continuityKey);
    expect(seeded, 'continuity row for new default').toBeTruthy();
    expect(seeded!.translation ?? seeded!.value).toBe(continuityKey);

    const existingB = await request.get(
      `/backend/api/literal-translations?lang=${otherLang}&searchText=${encodeURIComponent(literalKey)}`,
      { headers: { 'X-SITMUN-Client': 'admin' } },
    );
    expect(existingB.ok()).toBeTruthy();
    const existingBody = await existingB.json();
    const existingItems = Array.isArray(existingBody)
      ? existingBody
      : existingBody?.content || [];
    const kept = existingItems.find((i: { literal?: string }) => i.literal === literalKey);
    expect(kept?.translation ?? kept?.value).toBe(translated);

    // restore default for other tests
    await changeDefaultLanguage(request, otherLang, initialDefault).catch(() => {});
  });

  test('N5 enabled-only languages in Literal selectors and template preview', async ({
    page,
    request,
    createdResources,
  }) => {
    const frGet = await request.get(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    test.skip(!frGet.ok(), 'French language id 5 not present');
    const fr = await frGet.json();
    const wasEnabled = fr.enabled !== false;
    const n5Key = `e2e-n5-${uniqueValue('KEY')}`;

    const plantilla = await createPlantilla(page, {
      html: `<p><t>${n5Key}</t></p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantilla.id });

    try {
      if (wasEnabled) {
        const disable = await request.put(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
          headers: {
            'X-SITMUN-Client': 'admin',
            'Content-Type': 'application/json',
          },
          data: {
            name: fr.name,
            shortname: fr.shortname,
            enabled: false,
            order: fr.order,
          },
        });
        expect(disable.ok(), await disable.text()).toBeTruthy();
      }

      await openLiteralTranslations(page);
      await page
        .locator('button.toolbar-button, mat-toolbar button')
        .filter({ has: page.locator('mat-icon', { hasText: 'add_circle_outline' }) })
        .first()
        .click();
      const dialog = page.locator('app-literal-translation-create-dialog, mat-dialog-container').last();
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await dialog.locator('mat-select').first().click();
      await expect(page.locator('mat-option').filter({ hasText: /\(fr\)/i })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: /Cancel|Cancel·lar|Cancelar|Annuler/i }).click();

      await openPlantilla(page, plantilla.id);
      await ensurePlantillaPreviewOpen(page);
      await page.locator('.preview-language-field mat-select').click();
      await expect(page.locator('mat-option').filter({ hasText: /\(fr\)/i })).toHaveCount(0);
      await page.keyboard.press('Escape');
      // Completeness-with-disabled-lang is covered by LiteralTranslationCompletenessIntegrationTest.
    } finally {
      if (wasEnabled) {
        await request.put(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
          headers: {
            'X-SITMUN-Client': 'admin',
            'Content-Type': 'application/json',
          },
          data: {
            name: fr.name,
            shortname: fr.shortname,
            enabled: true,
            order: fr.order,
          },
        });
      }
    }
  });

  test('N13 CSV import may use disabled language', async ({ page, request }) => {
    const path = await import('node:path');
    const { writeFile, unlink } = await import('node:fs/promises');

    const frGet = await request.get(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    test.skip(!frGet.ok(), 'French language id 5 not present');
    const fr = await frGet.json();
    const literal = `e2e-disabled-csv-${uniqueValue('LIT')}`;
    const csvPath = path.join(process.cwd(), 'e2e/admin/fixtures', `literal-disabled-${Date.now()}.csv`);
    await writeFile(
      csvPath,
      `source_language,literal,translation\nfr,${literal},valeur-fr\n`,
      'utf8',
    );

    try {
      const disable = await request.put(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          name: fr.name,
          shortname: fr.shortname,
          enabled: false,
          order: fr.order,
        },
      });
      expect(disable.ok(), await disable.text()).toBeTruthy();
      await importLiteralCsv(page, { filePath: csvPath, targetLanguage: 'en' });
      await expect(page.locator('.literal-translations-grid')).toContainText(literal, {
        timeout: 15_000,
      });
    } finally {
      await unlink(csvPath).catch(() => {});
      await request.put(`/backend/api/languages/${FR_LANGUAGE_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          name: fr.name,
          shortname: fr.shortname,
          enabled: true,
          order: fr.order,
        },
      });
    }
  });
});
