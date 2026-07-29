import { test, expect } from '../fixtures';
import { uniqueValue } from '../helpers/form';
import {
  assertPlantillaHtmlPersisted,
  createPlantilla,
  openPlantilla,
  savePlantillaUpdate,
  setTemplateHtml,
  switchTemplateEditorToHtml,
  switchTemplateEditorToVisual,
} from '../helpers/template';

/**
 * #441: TipTap visual edits must keep data-sitmun-each so preview still expands table rows.
 */
test.describe('Admin Plantilla table data-sitmun-each preview', () => {
  test('visual mode round-trip keeps data-sitmun-each and preview still expands rows', async ({
    page,
    request,
    createdResources,
  }) => {
    const rowMarker = uniqueValue('e2e-row');
    const siblingMarker = uniqueValue('e2e-sib');
    const alias = 'consulta_sql';
    const tableHtml =
      `<table data-sitmun-each="${alias}.rows"><thead><tr><th>tui_name</th></tr></thead>` +
      `<tbody><tr><td>{{tui_name}}</td></tr></tbody></table>`;

    const plantilla = await createPlantilla(page, { html: tableHtml });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await assertPlantillaHtmlPersisted(request, plantilla.id, `data-sitmun-each="${alias}.rows"`);

    await openPlantilla(page, plantilla.id);
    await switchTemplateEditorToVisual(page);
    await expect(page.locator('app-template-editor .ProseMirror table')).toBeVisible({
      timeout: 15_000,
    });

    // Sibling paragraph after the table triggers TipTap serialize (partner "add element" AC).
    const prose = page.locator('app-template-editor .ProseMirror').first();
    await prose.locator('table').click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type(siblingMarker);

    await switchTemplateEditorToHtml(page);
    const source = page.locator('app-template-editor textarea.template-editor-source');
    await expect
      .poll(async () => source.inputValue(), { timeout: 15_000 })
      .toContain(`data-sitmun-each="${alias}.rows"`);
    await expect.poll(async () => source.inputValue(), { timeout: 15_000 }).toContain(siblingMarker);

    await savePlantillaUpdate(page, plantilla.id);
    await assertPlantillaHtmlPersisted(request, plantilla.id, `data-sitmun-each="${alias}.rows"`);

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
          [alias]: {
            rows: [{ tui_name: rowMarker }],
          },
        },
        knownTaskReferences: [],
      },
    });
    expect(preview.ok(), await preview.text()).toBeTruthy();
    const json = await preview.json();
    expect(String(json.html ?? '')).toContain(rowMarker);
    expect(String(json.html ?? '')).not.toContain('data-sitmun-each');
  });
});
