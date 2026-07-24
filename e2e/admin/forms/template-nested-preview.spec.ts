import { test, expect } from '../fixtures';
import { uniqueValue } from '../helpers/form';
import {
  createPlantilla,
  executeNestedPlantillaCard,
  linkNestedPlantilla,
  openPlantilla,
  renderPlantillaPreview,
  savePlantillaUpdate,
  setReferenceAlias,
  setTemplateHtml,
} from '../helpers/template';

test.describe('Admin nested Plantilla preview', () => {
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
    await expect(page.locator('.preview-panel.ql-editor')).toContainText(marker, {
      timeout: 30_000,
    });
  });
});
