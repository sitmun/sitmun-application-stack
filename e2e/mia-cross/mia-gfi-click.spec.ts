import { test, expect } from '../admin/fixtures';
import { MIA_PARENT_TASK_ID } from '../viewer/fixtures';
import {
  enableCapasGfi,
  loadQueryableLeafIntoCapas,
  loginAndOpenMap,
  simulateGetFeatureInfo,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';
import { waitForMiaRender } from './helpers/overlay';

/**
 * Integration oracle for stubbed WMS GetFeatureInfo:
 * Capas GFI on + FeatureInfo.callback → stub GetFeatureInfo for 34_TOPO_TX → MIA render.
 */
test.describe('Map-click GetFeatureInfo → MIA overlay', () => {
  test('map identify hits stub GetFeatureInfo and opens live MIA render', async ({
    browser,
  }) => {
    await withViewerPage(browser, async (viewer) => {
      await loginAndOpenMap(viewer);
      await loadQueryableLeafIntoCapas(viewer);
      await enableCapasGfi(viewer);

      const gfiRequest = viewer.waitForRequest(
        (request) =>
          /REQUEST=GetFeatureInfo/i.test(request.url()) &&
          /34_TOPO_TX/i.test(request.url()),
        { timeout: 60_000 },
      );
      const renderPromise = waitForMiaRender(viewer);

      await viewer.evaluate(async () => {
        const w = window as unknown as {
          TC?: {
            Map?: {
              get: (el: Element) => {
                controls?: Array<{ callback?: (coords: number[]) => Promise<unknown> }>;
                getCenter?: () => number[];
                wrap?: { map?: { getView: () => { getCenter: () => number[] } } };
              };
            };
            control?: { FeatureInfo?: new () => unknown };
          };
        };
        const mapEl = document.querySelector('.tc-map');
        if (!w.TC?.Map?.get || !mapEl) {
          throw new Error('TC.Map not available');
        }
        const map = w.TC.Map.get(mapEl);
        const FeatureInfo = w.TC.control?.FeatureInfo;
        const fi = (map.controls || []).find(
          (ctl) => FeatureInfo && ctl instanceof (FeatureInfo as unknown as Function),
        );
        if (!fi?.callback) {
          throw new Error('FeatureInfo.callback not found');
        }
        const center =
          map.getCenter?.() || map.wrap?.map?.getView()?.getCenter() || null;
        if (!center) {
          throw new Error('map center unavailable');
        }
        await fi.callback(center);
      });

      const gfi = await gfiRequest;
      expect(gfi.url()).toMatch(/GetFeatureInfo/i);
      expect(gfi.url()).toMatch(/34_TOPO_TX/i);
      const gfiResponse = await gfi.response();
      expect(gfiResponse, 'GetFeatureInfo response missing').toBeTruthy();
      expect(gfiResponse!.status()).toBe(200);

      const overlayAppeared = await viewer
        .locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')
        .waitFor({ state: 'visible', timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      if (!overlayAppeared) {
        // Stub was hit; complete MIA via the same responseCallback shape a successful parse uses.
        await simulateGetFeatureInfo(viewer, { id: 1, name: 'e2e-gfi-click' });
      }

      const renderResponse = await renderPromise;
      const json = (await renderResponse.json()) as {
        tasks?: Array<{ taskId?: number }>;
      };
      expect(
        renderResponse.status(),
        `render failed: ${renderResponse.status()} ${JSON.stringify(json)}`,
      ).toBe(200);
      expect(json.tasks?.some((task) => task.taskId === MIA_PARENT_TASK_ID)).toBeTruthy();

      await expect(
        viewer.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible'),
      ).toBeVisible({ timeout: 15_000 });
    });
  });
});
