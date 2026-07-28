import { test, expect } from '../admin/fixtures';
import {
  assertPlantillaHtmlPersisted,
  createPlantilla,
  linkNestedPlantilla,
  openPlantilla,
  savePlantillaUpdate,
  setReferenceAlias,
  setTemplateHtml,
} from '../admin/helpers/template';
import {
  createMiaWithChild,
  ensureMiaViewerAccess,
  uniqueValue,
} from '../admin/helpers/mia-form';
import {
  loadQueryableLeafIntoCapas,
  loginAndOpenMap,
  simulateGetFeatureInfo,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';
import { expectOverlayContains, waitForMiaRender } from './helpers/overlay';

test.describe('Nested Plantilla in viewer overlay', () => {
  test('nested Plantilla B marker appears in overlay', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const marker = uniqueValue('NEST');
    const plantillaB = await createPlantilla(page, {
      html: `<p data-e2e-nested="B">${marker}</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaB.id });
    await assertPlantillaHtmlPersisted(request, plantillaB.id, marker);
    await ensureMiaViewerAccess(request, plantillaB.id);

    // Create A without nested placeholder first (TipTap rejects unknown refs).
    const plantillaA = await createPlantilla(page, {
      html: `<p>pending-nested</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaA.id });

    await openPlantilla(page, plantillaA.id);
    await linkNestedPlantilla(page, plantillaB.name, plantillaB.id);
    await setReferenceAlias(page, plantillaB.id, 'nested_b');
    await setTemplateHtml(page, `<div data-e2e-nested="A">{{nested_b.html}}</div>`);
    await savePlantillaUpdate(page, plantillaA.id);
    await assertPlantillaHtmlPersisted(request, plantillaA.id, 'nested_b.html');
    await ensureMiaViewerAccess(request, plantillaA.id);

    const mia = await createMiaWithChild(page, {
      childSearch: plantillaA.name,
      childOption: new RegExp(
        `${plantillaA.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${plantillaA.id}\\)`,
      ),
      childId: plantillaA.id,
    });
    createdResources.push({ collection: 'tasks', id: mia.id });
    await ensureMiaViewerAccess(request, mia.id);

    await withViewerPage(browser, async (viewer) => {
      await loginAndOpenMap(viewer);
      await loadQueryableLeafIntoCapas(viewer);

      const render = waitForMiaRender(viewer);
      await simulateGetFeatureInfo(viewer);
      const renderResponse = await render;
      expect(renderResponse.status()).toBe(200);
      expect(JSON.stringify(await renderResponse.json())).toContain(marker);

      await expectOverlayContains(viewer, { miaName: mia.name, text: marker });
    });
  });
});
