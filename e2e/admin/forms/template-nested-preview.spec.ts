import { test, expect } from '../fixtures';
import { uniqueValue } from '../helpers/form';
import {
  createPlantilla,
  executeNestedPlantillaCard,
  linkNestedPlantilla,
  openPlantilla,
  renderPlantillaPreview,
  savePlantillaUpdate,
  selectPlantillaPreviewLanguage,
  setReferenceAlias,
  setTemplateHtml,
} from '../helpers/template';

test.describe('Admin nested Plantilla preview', () => {
  test('N11 nested child <t> translation appears in parent preview', async ({
    page,
    request,
    createdResources,
  }) => {
    const literalKey = `e2e-nested-lit-${uniqueValue('KEY')}`;
    const translated = `e2e-nested-tr-${uniqueValue('TR')}`;
    const plantillaB = await createPlantilla(page, {
      html: `<p data-e2e-nested="B"><t>${literalKey}</t></p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaB.id });

    const list = await request.get(
      `/backend/api/literal-translations?lang=en&searchText=${encodeURIComponent(literalKey)}`,
      { headers: { 'X-SITMUN-Client': 'admin' } },
    );
    expect(list.ok(), await list.text()).toBeTruthy();
    const body = await list.json();
    const items = Array.isArray(body) ? body : body?.content || [];
    const enrolled = items.find((item: { literal?: string }) => item.literal === literalKey);
    expect(enrolled?.id, 'child literal enrolled on save').toBeTruthy();

    const put = await request.put(`/backend/api/literal-translations/${enrolled.id}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        literal: literalKey,
        language: 'ca',
        sourceLanguage: enrolled.sourceLanguage || 'en',
        translation: translated,
        translations: { ca: translated },
      },
    });
    expect(put.ok(), await put.text()).toBeTruthy();

    const plantillaA = await createPlantilla(page, { html: `<p>pending-nested</p>` });
    createdResources.push({ collection: 'tasks', id: plantillaA.id });

    await openPlantilla(page, plantillaA.id);
    await linkNestedPlantilla(page, plantillaB.name, plantillaB.id);
    await setReferenceAlias(page, plantillaB.id, 'nested_b');
    await setTemplateHtml(page, `<div data-e2e-nested="A">{{nested_b.html}}</div>`);
    await savePlantillaUpdate(page, plantillaA.id);

    // Child alone with lang=ca (composition path covered by mia-cross N11).
    const childPreview = await request.post(
      '/backend/api/tasks/template/preview?lang=ca',
      {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          templateTaskId: plantillaB.id,
          templateHtml: `<p><t>${literalKey}</t></p>`,
          context: {},
          knownTaskReferences: [],
        },
      },
    );
    expect(childPreview.ok(), await childPreview.text()).toBeTruthy();
    expect(JSON.stringify(await childPreview.json())).toContain(translated);

    await openPlantilla(page, plantillaA.id);
    await selectPlantillaPreviewLanguage(page, 'ca');
    await renderPlantillaPreview(page);
    await expect(page.locator('[data-testid="template-preview-html"]')).toContainText(translated, {
      timeout: 30_000,
    });
  });

  test('preview panel shows composed HTML from nested child', async ({
    page,
    createdResources,
  }) => {
    const marker = uniqueValue('e2e-nested-preview');
    const plantillaB = await createPlantilla(page, {
      html: `<p data-e2e-nested="B">${marker}</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaB.id });

    const plantillaA = await createPlantilla(page, {
      html: `<p>pending-nested</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaA.id });

    await openPlantilla(page, plantillaA.id);
    await linkNestedPlantilla(page, plantillaB.name, plantillaB.id);
    await setReferenceAlias(page, plantillaB.id, 'nested_b');
    await setTemplateHtml(page, `<div data-e2e-nested="A">{{nested_b.html}}</div>`);
    await savePlantillaUpdate(page, plantillaA.id);

    await openPlantilla(page, plantillaA.id);
    await executeNestedPlantillaCard(page, plantillaB.id);
    await expect(page.locator('.template-result-panel')).toContainText(marker, {
      timeout: 15_000,
    });

    await renderPlantillaPreview(page);
    await expect(page.locator('[data-testid="template-preview-html"]')).toContainText(marker, {
      timeout: 30_000,
    });
  });
});
