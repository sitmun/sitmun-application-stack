import { test, expect, type Page } from '@playwright/test';
import {
  APP_ID,
  isBackendRequest,
  MIA_PARENT_TASK_ID,
  NON_RADIO_ROOT_FOLDER_TITLE,
  QUERYABLE_LEAF_NODE_ID,
  RADIO_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

/**
 * More Info Advanced map render contract (#162):
 * after FeatureInfo-shaped identify results for Toponímia, viewer opens the MIA
 * overlay and POSTs /more-info-advanced/render with appId/terId + lang.
 *
 * Identify is driven through the same FeatureInfo.responseCallback path the
 * map-click handler uses (WMS GetFeatureInfo stub coverage remains a follow-up).
 */

async function loginAndOpenMap(page: Page): Promise<void> {
  const credentials = await readViewerCredentials();

  await page.addInitScript(() => {
    localStorage.setItem('language', 'ca');
  });

  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();

  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

  const authenticate = page.waitForResponse(
    (response) => isBackendRequest(response, '/authenticate', 'POST') && response.ok(),
  );
  const account = page.waitForResponse(
    (response) => isBackendRequest(response, '/account', 'GET') && response.ok(),
  );

  await page.locator('form .login-button button').click();
  await Promise.all([authenticate, account]);
  await expect(page).toHaveURL(/\/user\/dashboard/);

  const profile = page.waitForResponse(
    (response) =>
      isBackendRequest(
        response,
        `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
        'GET',
      ) && response.ok(),
  );

  await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  const profileResponse = await profile;
  const profileBody = (await profileResponse.json()) as {
    tasks?: Array<{ 'ui-control'?: string; typeId?: number; cartographyId?: string }>;
  };
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.moreInfoAdvanced'),
    'profile must include sitna.moreInfoAdvanced (setup task-availability)',
  ).toBeTruthy();
  expect(
    profileBody.tasks?.some(
      (task) => task.typeId === 16 && String(task.cartographyId) === '6',
    ),
    'profile must include MIA parent on cartography 6',
  ).toBeTruthy();

  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('.tc-tools-panel').evaluate((panel) => {
    panel.classList.remove('tc-collapsed-right');
  });
}

async function expandNodeByTitle(page: Page, title: string): Promise<void> {
  const item = page.locator('#tc-slot-toc li').filter({
    has: page.locator(':scope > span, :scope > .tc-ctl-lcat-node-title').filter({
      hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    }),
  });
  await expect(item).toBeVisible({ timeout: 30_000 });
  const branch = item.locator(':scope > ul').first();
  if ((await branch.count()) > 0 && (await branch.isVisible())) {
    return;
  }
  await item.getByRole('button', { name: /Expandir|Expand|Desplegar/i }).click();
  await expect(branch).toBeVisible({ timeout: 15_000 });
}

async function loadQueryableLeafIntoCapas(page: Page): Promise<void> {
  const wlm = page.locator('#tc-slot-wlm');
  await wlm.waitFor({ state: 'attached', timeout: 30_000 });
  await wlm.evaluate((el) => el.classList.remove('tc-collapsed'));
  await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
  await expandNodeByTitle(page, RADIO_FOLDER_TITLE);
  const radio = page.locator(
    `#tc-slot-toc input.sitmun-lcat-radio[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`,
  );
  await expect(radio).toBeVisible({ timeout: 30_000 });
  await radio.click();
  await expect(page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm[data-layer-id]')).toBeVisible({
    timeout: 90_000,
  });
}

async function triggerMiaViaFeatureInfoCallback(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {
      TC?: {
        Map?: { get: (el: Element) => { controls?: Array<{ responseCallback?: (o: unknown) => void }> } };
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
    if (!fi?.responseCallback) {
      throw new Error('FeatureInfo control with responseCallback not found');
    }
    fi.responseCallback({
      services: [
        {
          layers: [
            {
              name: '34_TOPO_TX',
              features: [
                {
                  getData: () => ({ id: 1, name: 'e2e-mia' }),
                },
              ],
            },
          ],
        },
      ],
    });
  });
}

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

    await triggerMiaViaFeatureInfoCallback(page);

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
});
