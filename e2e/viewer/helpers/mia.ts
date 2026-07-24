import { expect, type Page } from '@playwright/test';
import {
  APP_ID,
  isBackendRequest,
  NON_RADIO_ROOT_FOLDER_TITLE,
  QUERYABLE_LEAF_NODE_ID,
  RADIO_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from '../fixtures';

export async function loginAndOpenMap(
  page: Page,
  options?: { appId?: number; territoryId?: number },
): Promise<void> {
  const appId = options?.appId ?? APP_ID;
  const territoryId = options?.territoryId ?? TERRITORY_ID;
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
        `/config/client/profile/${appId}/${territoryId}`,
        'GET',
      ) && response.ok(),
  );

  await page.goto(`/user/map/${appId}/${territoryId}`, {
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

export async function expandNodeByTitle(page: Page, title: string): Promise<void> {
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

export async function loadQueryableLeafIntoCapas(page: Page): Promise<void> {
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

/** Simulated GetFeatureInfo — injects FeatureInfo.responseCallback (not a real WMS GFI). */
export async function simulateGetFeatureInfo(
  page: Page,
  attrs: Record<string, unknown> = { id: 1, name: 'e2e-mia' },
): Promise<void> {
  await page.evaluate((featureAttrs) => {
    const w = window as unknown as {
      TC?: {
        Map?: {
          get: (el: Element) => {
            controls?: Array<{ responseCallback?: (o: unknown) => void }>;
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
                  getData: () => featureAttrs,
                },
              ],
            },
          ],
        },
      ],
    });
  }, attrs);
}

export async function openPublicDashboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'ca');
  });
  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();
  const dashboardApps = page.waitForResponse(
    (response) => isBackendRequest(response, '/config/client/dashboard/applications', 'GET') && response.ok(),
  );
  await page
    .getByRole('button', { name: /Acceso público|Accés públic|Public access/i })
    .click();
  await dashboardApps;
  await expect(page).toHaveURL(/\/public\/dashboard/);
}

/** Enable Capas GFI toggle so map clicks issue GetFeatureInfo for the loaded leaf. */
export async function enableCapasGfi(page: Page): Promise<void> {
  const gfi = page.locator('#tc-slot-wlm sitna-toggle.sitmun-wlm-gfi, #tc-slot-wlm .sitmun-wlm-gfi').first();
  await expect(gfi).toBeVisible({ timeout: 30_000 });
  const checked = await gfi.evaluate((el) => el.hasAttribute('checked'));
  if (!checked) {
    await gfi.click();
  }
}
