import { test, expect } from '../admin/fixtures';
import { CCAVALLS_LAYER, CCAVALLS_MIA_TASK_ID } from '../viewer/fixtures';
import {
  enableCapasGfi,
  loadCcavallsLeafIntoCapas,
  loginAndOpenMenorcaMap,
  simulateGetFeatureInfoLayers,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';
import { expectOverlayContains, waitForMiaRender } from './helpers/overlay';

const GFI_ROUTE_NAME = 'e2e-ccavalls';

/**
 * IDE Menorca tu007rts_ccavalls (node 12094): Capas GFI → MIA Plantilla shows
 * seeded marker and mapped GFI attribute `nomruta` as `$featureName`.
 */
test.describe('Menorca tu007rts_ccavalls GFI → Plantilla', () => {
  test('activates Camí de cavalls node and renders GFI attr in seeded Plantilla', async ({
    browser,
  }) => {
    await withViewerPage(browser, async (viewer) => {
      await loginAndOpenMenorcaMap(viewer);
      await loadCcavallsLeafIntoCapas(viewer);
      await enableCapasGfi(viewer);

      const render = waitForMiaRender(viewer);
      await simulateGetFeatureInfoLayers(viewer, [
        { name: CCAVALLS_LAYER, features: [{ id: 1, nomruta: GFI_ROUTE_NAME }] },
      ]);

      const renderResponse = await render;
      expect(
        renderResponse.status(),
        `render failed: ${renderResponse.status()} ${await renderResponse.text()}`,
      ).toBe(200);
      const json = (await renderResponse.json()) as {
        tasks?: Array<{ taskId?: number; html?: string }>;
      };
      expect(json.tasks?.some((task) => task.taskId === CCAVALLS_MIA_TASK_ID)).toBeTruthy();
      expect(
        json.tasks?.some((task) =>
          task.html?.includes('data-e2e-seeded-plantilla="tu007rts-ccavalls"'),
        ),
      ).toBeTruthy();
      expect(
        json.tasks?.some((task) => task.html?.includes(GFI_ROUTE_NAME)),
        `render HTML must include mapped GFI nomruta: ${JSON.stringify(json.tasks)}`,
      ).toBeTruthy();

      await expectOverlayContains(viewer, {
        miaName: 'Dev MIA tu007rts_ccavalls',
        text: GFI_ROUTE_NAME,
      });
      // Backend MIA tabs: full / route / reference plantillas.
      await expect(viewer.locator('.sitmun-mia-tab')).toHaveCount(3, { timeout: 15_000 });
      await expect(viewer.locator('[data-e2e-seeded-plantilla="tu007rts-ccavalls"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(viewer.locator(`[data-e2e-gfi-name="${GFI_ROUTE_NAME}"]`).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(viewer.locator('[data-e2e-sql="langs"]').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(viewer.locator('[data-e2e-sql-gfi-route]').first()).toHaveText(GFI_ROUTE_NAME, {
        timeout: 15_000,
      });

      await viewer.locator('.sitmun-mia-tab', { hasText: 'Dev Plantilla route (GFI)' }).click();
      await expect(
        viewer.locator('[data-e2e-seeded-plantilla="tu007rts-ccavalls-route"]'),
      ).toBeVisible({ timeout: 10_000 });

      await viewer
        .locator('.sitmun-mia-tab', { hasText: 'Dev Plantilla reference data' })
        .click();
      await expect(
        viewer.locator('[data-e2e-seeded-plantilla="tu007rts-ccavalls-ref"]'),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        viewer.locator('[data-e2e-seeded-plantilla="tu007rts-ccavalls-ref"] [data-e2e-sql="langs"]'),
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});
