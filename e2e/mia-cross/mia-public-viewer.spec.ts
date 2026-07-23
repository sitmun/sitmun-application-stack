import { test, expect } from '../admin/fixtures';
import {
  APP_ID,
  isBackendRequest,
  MIA_PARENT_TASK_ID,
  TERRITORY_ID,
} from '../viewer/fixtures';
import {
  loadQueryableLeafIntoCapas,
  openPublicDashboard,
  simulateGetFeatureInfo,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';

test.describe('Public-user MIA render', () => {
  test('public map renders seeded MIA after simulated GFI', async ({
    browser,
    request,
  }) => {
    const makePublic = await request.patch(`/backend/api/applications/${APP_ID}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: false },
    });
    expect(makePublic.ok(), await makePublic.text()).toBeTruthy();

    try {
      await withViewerPage(browser, async (viewer) => {
        await openPublicDashboard(viewer);

        const profile = viewer.waitForResponse(
          (response) =>
            isBackendRequest(
              response,
              `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
              'GET',
            ) && response.ok(),
        );
        await viewer.goto(`/public/map/${APP_ID}/${TERRITORY_ID}`, {
          waitUntil: 'domcontentloaded',
        });
        const profileBody = (await (await profile).json()) as {
          tasks?: Array<{ 'ui-control'?: string; typeId?: number; cartographyId?: string }>;
        };
        expect(
          profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.moreInfoAdvanced'),
        ).toBeTruthy();

        await viewer.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
        await viewer.locator('.tc-tools-panel').evaluate((panel) => {
          panel.classList.remove('tc-collapsed-right');
        });
        await loadQueryableLeafIntoCapas(viewer);

        const render = viewer.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/tasks/template/more-info-advanced/render'),
        );
        await simulateGetFeatureInfo(viewer);
        const renderResponse = await render;
        expect(renderResponse.status(), await renderResponse.text()).toBe(200);
        const json = (await renderResponse.json()) as {
          tasks?: Array<{ taskId?: number }>;
        };
        expect(json.tasks?.some((task) => task.taskId === MIA_PARENT_TASK_ID)).toBeTruthy();

        await expect(
          viewer.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible'),
        ).toBeVisible({ timeout: 15_000 });
        await expect(viewer.locator(`[data-mia-task-id="${MIA_PARENT_TASK_ID}"]`)).toBeVisible({
          timeout: 15_000,
        });
      });
    } finally {
      const restore = await request.patch(`/backend/api/applications/${APP_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/merge-patch+json',
        },
        data: { appPrivate: true },
      });
      expect(restore.ok(), await restore.text()).toBeTruthy();
    }
  });
});
