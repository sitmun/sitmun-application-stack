import { test, expect } from '../fixtures';
import { uniqueValue } from '../helpers/form';
import {
  assertPlantillaHtmlExact,
  assertPlantillaHtmlPersisted,
  createPlantilla,
  insertVisualSiblingAfter,
  openPlantilla,
  savePlantillaUpdate,
  switchTemplateEditorToHtml,
  switchTemplateEditorToVisual,
} from '../helpers/template';

/**
 * TipTap attribute mustaches must stay literal attrs after visual round-trip.
 * Protect chips inside src/href corrupt the attribute and break preview.
 */
test.describe('Admin Plantilla attribute mustache preview', () => {
  test('no visual update keeps templateHtml byte-identical', async ({
    page,
    request,
    createdResources,
  }) => {
    const marker = uniqueValue('e2e-noedit');
    const html = `<p data-e2e-byte="noedit">${marker} &amp; keep</p>`;
    const plantilla = await createPlantilla(page, { html });
    createdResources.push({ collection: 'tasks', id: plantilla.id });

    await openPlantilla(page, plantilla.id);
    await switchTemplateEditorToVisual(page);
    await expect(page.locator('app-template-editor .ProseMirror')).toBeVisible({
      timeout: 15_000,
    });
    // No TipTap update → parent form stays clean (Save disabled) and API HTML is unchanged.
    await expect(page.getByTestId('form-save')).toBeDisabled({ timeout: 10_000 });
    await assertPlantillaHtmlExact(request, plantilla.id, html);
  });

  test('preview keeps {{#APP_NAME}} attribute-safe (no highlight span in title)', async ({
    request,
  }) => {
    const preview = await request.post('/backend/api/tasks/template/preview', {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        templateTaskId: null,
        templateHtml: '<img src="https://example.test/x.png" title="{{#APP_NAME}}">',
        context: {},
        knownTaskReferences: [],
      },
    });
    expect(preview.ok(), await preview.text()).toBeTruthy();
    const previewHtml = String((await preview.json()).html ?? '');
    expect(previewHtml).toContain('title="APP_NAME"');
    expect(previewHtml).not.toContain('title="<span');
    expect(previewHtml).not.toContain('sitmun-template-known');
  });

  test('img src mustache survives visual sibling edit and preview', async ({
    page,
    request,
    createdResources,
  }) => {
    const siblingMarker = uniqueValue('e2e-sib');
    const markerUrl = `https://example.test/${uniqueValue('img')}.png`;
    const imgHtml = '<img src="{{task_1.url}}">';

    const plantilla = await createPlantilla(page, { html: imgHtml });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await assertPlantillaHtmlPersisted(request, plantilla.id, 'src="{{task_1.url}}"');

    await openPlantilla(page, plantilla.id);
    await switchTemplateEditorToVisual(page);
    await expect(page.locator('app-template-editor .ProseMirror img')).toBeVisible({
      timeout: 15_000,
    });

    // Mode toggle before the sibling edit (user repro step).
    await switchTemplateEditorToHtml(page);
    const source = page.locator('app-template-editor textarea.template-editor-source');
    await expect
      .poll(async () => source.inputValue(), { timeout: 15_000 })
      .toContain('src="{{task_1.url}}"');

    await switchTemplateEditorToVisual(page);
    await insertVisualSiblingAfter(page, 'img', siblingMarker);

    await switchTemplateEditorToHtml(page);
    const afterEdit = await source.inputValue();
    expect(afterEdit).toContain('src="{{task_1.url}}"');
    expect(afterEdit).toContain(siblingMarker);
    expect(afterEdit).not.toMatch(/src="[^"]*data-sitmun-handlebars-expr/);
    expect(afterEdit).not.toContain('sitmun-handlebars-expression-node');

    await savePlantillaUpdate(page, plantilla.id);
    await assertPlantillaHtmlPersisted(request, plantilla.id, 'src="{{task_1.url}}"');

    const persisted = await request.get(`/backend/api/tasks/${plantilla.id}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(persisted.ok(), await persisted.text()).toBeTruthy();
    const task = (await persisted.json()) as { properties?: { templateHtml?: string } };
    const templateHtml = task.properties?.templateHtml ?? '';

    const preview = await request.post('/backend/api/tasks/template/preview', {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        templateTaskId: plantilla.id,
        templateHtml,
        context: {
          task_1: { url: markerUrl },
        },
        knownTaskReferences: [],
      },
    });
    expect(preview.ok(), await preview.text()).toBeTruthy();
    const json = await preview.json();
    const previewHtml = String(json.html ?? '');
    expect(previewHtml).toContain(`src="${markerUrl}"`);
    expect(previewHtml).not.toContain('data-sitmun-handlebars-expr');
  });

  test('anchor href mustache survives visual sibling edit', async ({
    page,
    request,
    createdResources,
  }) => {
    const siblingMarker = uniqueValue('e2e-href-sib');
    const linkHtml = '<a href="{{task_1.url}}">photo</a>';

    const plantilla = await createPlantilla(page, { html: linkHtml });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await assertPlantillaHtmlPersisted(request, plantilla.id, 'href="{{task_1.url}}"');

    await openPlantilla(page, plantilla.id);
    await switchTemplateEditorToVisual(page);
    await expect(page.locator('app-template-editor .ProseMirror a')).toBeVisible({
      timeout: 15_000,
    });

    await insertVisualSiblingAfter(page, 'a', siblingMarker);

    await switchTemplateEditorToHtml(page);
    const source = page.locator('app-template-editor textarea.template-editor-source');
    const afterEdit = await source.inputValue();
    expect(afterEdit).toContain('href="{{task_1.url}}"');
    expect(afterEdit).toContain(siblingMarker);
    expect(afterEdit).not.toMatch(/href="[^"]*data-sitmun-handlebars-expr/);

    await savePlantillaUpdate(page, plantilla.id);
    await assertPlantillaHtmlPersisted(request, plantilla.id, 'href="{{task_1.url}}"');
  });

  test('sibling visual edit keeps div, bare table cells, and authored link attrs', async ({
    page,
    request,
    createdResources,
  }) => {
    const siblingMarker = uniqueValue('e2e-shape');
    const html =
      '<div class="box"><p>inside</p></div>' +
      '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>' +
      '<p><a href="https://example.test/x">link</a></p>';

    const plantilla = await createPlantilla(page, { html });
    createdResources.push({ collection: 'tasks', id: plantilla.id });

    await openPlantilla(page, plantilla.id);
    await switchTemplateEditorToVisual(page);
    await expect(page.locator('app-template-editor .ProseMirror table')).toBeVisible({
      timeout: 15_000,
    });
    await insertVisualSiblingAfter(page, 'table', siblingMarker);

    await switchTemplateEditorToHtml(page);
    const source = page.locator('app-template-editor textarea.template-editor-source');
    const afterEdit = await source.inputValue();
    expect(afterEdit).toContain('<div');
    expect(afterEdit).toContain('class="box"');
    expect(afterEdit).toContain('<td>A</td>');
    expect(afterEdit).toContain('<td>B</td>');
    expect(afterEdit).not.toContain('<colgroup');
    expect(afterEdit).not.toContain('min-width');
    expect(afterEdit).toContain('href="https://example.test/x"');
    expect(afterEdit).not.toMatch(/<a[^>]*target=/);
    expect(afterEdit).not.toMatch(/<a[^>]*rel=/);
    expect(afterEdit).toContain(siblingMarker);

    await savePlantillaUpdate(page, plantilla.id);
    await assertPlantillaHtmlPersisted(request, plantilla.id, 'class="box"');
    await assertPlantillaHtmlPersisted(request, plantilla.id, '<td>A</td>');
  });
});
