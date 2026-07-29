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
  test('N11 nested child <t> translation appears in overlay for UI lang', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const literalKey = `e2e-nested-viewer-${uniqueValue('LIT')}`;
    const catalan = `e2e-nested-ca-${uniqueValue('CAT')}`;

    const plantillaB = await createPlantilla(page, {
      html: `<p data-e2e-nested="B"><t>${literalKey}</t></p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantillaB.id });
    await assertPlantillaHtmlPersisted(request, plantillaB.id, literalKey);

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
        translation: catalan,
        translations: { ca: catalan },
      },
    });
    expect(put.ok(), await put.text()).toBeTruthy();
    await ensureMiaViewerAccess(request, plantillaB.id);

    const plantillaA = await createPlantilla(page, { html: `<p>pending-nested</p>` });
    createdResources.push({ collection: 'tasks', id: plantillaA.id });

    await openPlantilla(page, plantillaA.id);
    await linkNestedPlantilla(page, plantillaB.name, plantillaB.id);
    await setReferenceAlias(page, plantillaB.id, 'nested_b');
    await setTemplateHtml(page, `<div data-e2e-nested="A">{{nested_b.html}}</div>`);
    await savePlantillaUpdate(page, plantillaA.id);
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
      await viewer.addInitScript(() => {
        localStorage.setItem('language', 'ca');
      });
      await loginAndOpenMap(viewer);
      await loadQueryableLeafIntoCapas(viewer);

      const render = waitForMiaRender(viewer);
      await simulateGetFeatureInfo(viewer);
      const renderResponse = await render;
      expect(renderResponse.status()).toBe(200);
      expect(JSON.stringify(await renderResponse.json())).toContain(catalan);
      await expectOverlayContains(viewer, { miaName: mia.name, text: catalan });
    });
  });

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
