import { test, expect } from '../admin/fixtures';
import path from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import { assertPlantillaHtmlPersisted, createPlantilla } from '../admin/helpers/template';
import { importLiteralCsv } from '../admin/helpers/literal-csv';
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

test.describe('MIA TipTap + CSV → viewer overlay', () => {
  test('TipTap Plantilla marker appears after simulated GFI', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const marker = uniqueValue('MARKER');
    const bodyText = `plantilla-body-${marker}`;
    const plantilla = await createPlantilla(page, {
      html: `<p data-e2e-plantilla="${marker}">${bodyText}</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await assertPlantillaHtmlPersisted(request, plantilla.id, bodyText);
    await ensureMiaViewerAccess(request, plantilla.id);

    const mia = await createMiaWithChild(page, {
      childSearch: plantilla.name,
      childOption: new RegExp(
        `${plantilla.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${plantilla.id}\\)`,
      ),
      childId: plantilla.id,
    });
    createdResources.push({ collection: 'tasks', id: mia.id });
    await ensureMiaViewerAccess(request, mia.id);

    await withViewerPage(browser, async (viewer) => {
      await loginAndOpenMap(viewer);
      await loadQueryableLeafIntoCapas(viewer);

      const render = waitForMiaRender(viewer);
      await simulateGetFeatureInfo(viewer);
      const renderResponse = await render;
      const renderJson = await renderResponse.json();
      expect(
        renderResponse.status(),
        `render failed: ${renderResponse.status()} ${JSON.stringify(renderJson)}`,
      ).toBe(200);
      expect(JSON.stringify(renderJson)).toContain(bodyText);

      await expectOverlayContains(viewer, { miaName: mia.name, text: bodyText });
      await expect(viewer.locator(`[data-e2e-plantilla="${marker}"]`)).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test('CSV Catalan literal resolves in overlay', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const literalKey = `e2e-literal-${uniqueValue('LIT')}`;
    const catalan = `e2e-catalan-${uniqueValue('CAT')}`;
    const csvPath = path.join(process.cwd(), 'e2e/mia-cross/fixtures', `literal-${Date.now()}.csv`);
    await writeFile(
      csvPath,
      `source_language,literal,translation\nen,${literalKey},${catalan}\n`,
      'utf8',
    );

    try {
      await importLiteralCsv(page, { filePath: csvPath, targetLanguage: 'ca' });

      const plantilla = await createPlantilla(page, {
        html: `<p data-e2e-literal="1"><t>${literalKey}</t></p>`,
      });
      createdResources.push({ collection: 'tasks', id: plantilla.id });
      await assertPlantillaHtmlPersisted(request, plantilla.id, literalKey);
      await ensureMiaViewerAccess(request, plantilla.id);

      const mia = await createMiaWithChild(page, {
        childSearch: plantilla.name,
        childOption: new RegExp(
          `${plantilla.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${plantilla.id}\\)`,
        ),
        childId: plantilla.id,
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
        expect(JSON.stringify(await renderResponse.json())).toContain(catalan);

        await expectOverlayContains(viewer, { miaName: mia.name, text: catalan });
      });
    } finally {
      await unlink(csvPath).catch(() => {});
    }
  });
});
