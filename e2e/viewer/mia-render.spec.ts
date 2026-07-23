import { test, expect } from '@playwright/test';
import { APP_ID, MIA_PARENT_TASK_ID, TERRITORY_ID } from './fixtures';
import {
  loadQueryableLeafIntoCapas,
  loginAndOpenMap,
  simulateGetFeatureInfo,
} from './helpers/mia';

/**
 * More Info Advanced map render contract (#162):
 * after FeatureInfo-shaped identify results for Toponímia, viewer opens the MIA
 * overlay and POSTs /more-info-advanced/render with appId/terId + lang.
 *
 * Identify uses simulateGetFeatureInfo (responseCallback). Real map-click GFI
 * is covered by e2e:mia-cross (mia-gfi-click.spec.ts).
 */

test.describe('Viewer MIA render', () => {
  test('opens MIA overlay and POSTs render with appId terId and lang', async ({ page }) => {
    await page.route('**/api/tasks/template/more-info-advanced/render**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [
            {
              taskId: MIA_PARENT_TASK_ID,
              title: 'E2E MIA',
              html: '<p data-e2e-mia="1">rendered</p>',
            },
          ],
        }),
      });
    });

    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);

    const render = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/api/tasks/template/more-info-advanced/render'),
    );

    await simulateGetFeatureInfo(page);

    const renderRequest = await render;
    const url = new URL(renderRequest.url());
    expect(url.searchParams.get('lang')).toBe('ca');
    const body = renderRequest.postDataJSON() as {
      appId?: number;
      terId?: number;
      miaTaskIds?: number[];
    };
    expect(body).toMatchObject({
      appId: APP_ID,
      terId: TERRITORY_ID,
      miaTaskIds: [MIA_PARENT_TASK_ID],
    });

    await expect(page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-e2e-mia="1"]')).toBeVisible({ timeout: 15_000 });
  });

  test('live backend render returns seeded MIA parent in overlay', async ({ page }) => {
    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);

    const render = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/tasks/template/more-info-advanced/render'),
    );

    await simulateGetFeatureInfo(page);

    const renderResponse = await render;
    expect(renderResponse.status(), await renderResponse.text()).toBe(200);
    const json = (await renderResponse.json()) as {
      tasks?: Array<{ taskId?: number; html?: string; error?: string }>;
    };
    expect(json.tasks?.some((task) => task.taskId === MIA_PARENT_TASK_ID)).toBeTruthy();

    await expect(page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator(`[data-mia-task-id="${MIA_PARENT_TASK_ID}"]`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('render failure shows error in overlay', async ({ page }) => {
    await page.route('**/api/tasks/template/more-info-advanced/render**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'e2e-mia-render-failed' }),
      });
    });

    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);
    await simulateGetFeatureInfo(page);

    await expect(page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.sitmun-mia-error')).toBeVisible({ timeout: 15_000 });
  });

  test('close button hides MIA overlay', async ({ page }) => {
    await page.route('**/api/tasks/template/more-info-advanced/render**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [
            {
              taskId: MIA_PARENT_TASK_ID,
              title: 'E2E MIA',
              html: '<p data-e2e-mia="close">rendered</p>',
            },
          ],
        }),
      });
    });

    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);
    await simulateGetFeatureInfo(page);

    const overlay = page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await page.locator('.sitmun-mia-popup-close').click();
    await expect(page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')).toHaveCount(0);
  });
});
