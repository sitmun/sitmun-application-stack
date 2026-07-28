import { test, expect, type Page } from '@playwright/test';
import {
  APP_ID,
  CHECKBOX_LOAD_FOLDER_TITLE,
  isBackendRequest,
  NON_RADIO_LEAF_NODE_ID,
  NON_RADIO_LEAF_TITLE,
  NON_RADIO_ROOT_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

/**
 * No base map (#167): empty VECTOR basemap clears raster background to white
 * while operational catalog layers remain visible.
 */
async function loginAndOpenMap(page: Page): Promise<void> {
  const credentials = await readViewerCredentials();

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
    tasks?: Array<{ 'ui-control'?: string }>;
  };
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.basemapSelector'),
    'profile must include sitna.basemapSelector (setup task-availability)',
  ).toBeTruthy();
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.layerCatalog'),
    'profile must include sitna.layerCatalog (setup task-availability)',
  ).toBeTruthy();

  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('#tc-slot-bms').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('.tc-tools-panel').evaluate((panel) => {
    panel.classList.remove('tc-collapsed-right');
  });
  await expect(page.locator('.tc-tools-panel')).not.toHaveClass(/tc-collapsed-right/);

  await expect(page.getByText(NON_RADIO_ROOT_FOLDER_TITLE, { exact: true })).toBeVisible({
    timeout: 90_000,
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

async function expandWorkLayerManager(page: Page): Promise<void> {
  const wlm = page.locator('#tc-slot-wlm');
  await wlm.waitFor({ state: 'attached', timeout: 30_000 });
  await wlm.evaluate((el) => el.classList.remove('tc-collapsed'));
}

async function expandBasemapSelector(page: Page): Promise<void> {
  const bms = page.locator('#tc-slot-bms');
  await bms.waitFor({ state: 'attached', timeout: 30_000 });
  await bms.evaluate((el) => el.classList.remove('tc-collapsed'));
  // Accordion may re-collapse siblings; ensure BMS content is shown.
  const heading = bms.locator(':scope > h2').first();
  if (await heading.count()) {
    const collapsed = await bms.evaluate((el) => el.classList.contains('tc-collapsed'));
    if (collapsed) {
      await heading.click({ force: true });
    }
  }
  await expect(bms).not.toHaveClass(/tc-collapsed/, { timeout: 10_000 });
}

async function loadNonRadioLeafIntoCapas(page: Page): Promise<void> {
  await expandWorkLayerManager(page);
  await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
  await expandNodeByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);

  const leafLoad = page.locator(
    `#tc-slot-toc input.sitmun-lcat-leaf-load[data-layer-name="${NON_RADIO_LEAF_NODE_ID}"]`,
  );
  await expect(leafLoad).toBeVisible({ timeout: 30_000 });
  await leafLoad.click();
  await expect(leafLoad).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
  await expect(page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm[data-layer-id]')).toBeVisible({
    timeout: 90_000,
  });
}

test.describe('No base map (#167)', () => {
  test('selecting No base map shows white background and keeps operational layers', async ({
    page,
  }) => {
    await loginAndOpenMap(page);

    await loadNonRadioLeafIntoCapas(page);
    await expect(
      page.getByText(NON_RADIO_LEAF_TITLE, { exact: true }).first(),
    ).toBeVisible();

    await expandBasemapSelector(page);

    const noneNode = page.locator('li.tc-ctl-bms-node[data-layer-id="sitmun-no-base-map"]');
    await expect(noneNode).toBeVisible({ timeout: 30_000 });
    await noneNode.locator('label').click();

    const bg = await page.locator('.ol-viewport').evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bg).toMatch(/rgb\(\s*255,\s*255,\s*255\s*\)|#fff/i);

    await expect(
      page.getByText(NON_RADIO_LEAF_TITLE, { exact: true }).first(),
    ).toBeVisible();
  });
});
