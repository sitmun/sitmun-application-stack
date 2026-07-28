import { test, expect, type Page } from '@playwright/test';
import {
  APP_ID,
  CHECKBOX_LOAD_FOLDER_TITLE,
  isBackendRequest,
  NON_RADIO_LEAF_NODE_ID,
  NON_RADIO_ROOT_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

/**
 * Map Legend task (#164): DiBa/ArcGIS-style WMS exposes Style/LegendURL (Capas “i”
 * works) but denies DescribeLayer so native sitna.legend getLegend stays empty.
 * Stub mirrors CAE1M/PCE5M; see scripts/e2e-wms-stub.mjs.
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
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.legend'),
    'profile must include sitna.legend (setup task-availability)',
  ).toBeTruthy();
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.layerCatalog'),
    'profile must include sitna.layerCatalog (setup task-availability)',
  ).toBeTruthy();

  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
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

/**
 * Open the left Legend drawer (not Capas / tools). Collapsed content uses
 * `left: -340px`, so Playwright toBeVisible alone is not enough — require an
 * on-screen panel content box and legend-tab active (tools-tab hidden).
 */
async function openLegendPanel(page: Page): Promise<void> {
  const leftPanel = page.locator('section.tc-left-panel');
  await leftPanel.waitFor({ state: 'attached', timeout: 30_000 });

  const legendTab = page.locator('#legend-tab');
  await expect(legendTab).toBeAttached({ timeout: 30_000 });
  await legendTab.evaluate((tab) => tab.classList.remove('tc-hidden'));

  const panelContent = leftPanel.locator(':scope > .tc-panel-content');
  const alreadyOpen = await leftPanel.evaluate(
    (el) =>
      !el.classList.contains('tc-collapsed-left') &&
      !el.classList.contains('tc-collapsed'),
  );
  if (!alreadyOpen) {
    await legendTab.click({ force: true });
  } else {
    // Panel open on tools: switch to legend content.
    const toolsVisible = await page.locator('#tools-tab').evaluate((el) => {
      return !el.classList.contains('tc-hidden');
    });
    if (toolsVisible) {
      // Collapse then reopen on legend-tab so script.js shows .tc-ctl-legend.
      await page.locator('#tools-tab').click({ force: true });
      await expect(leftPanel).toHaveClass(/tc-collapsed-left/, { timeout: 10_000 });
      await legendTab.evaluate((tab) => tab.classList.remove('tc-hidden'));
      await legendTab.click({ force: true });
    }
  }

  await expect(leftPanel).not.toHaveClass(/tc-collapsed-left/, { timeout: 15_000 });
  await expect(leftPanel).not.toHaveClass(/tc-collapsed/);
  await expect(page.locator('#tools-tab')).toHaveClass(/tc-hidden/, { timeout: 10_000 });
  await expect(legendTab).not.toHaveClass(/tc-hidden/);

  await expect
    .poll(
      async () => {
        const box = await panelContent.boundingBox();
        return box != null && box.x >= -1 && box.width > 100;
      },
      { timeout: 15_000, message: 'left legend panel content must be on-screen' },
    )
    .toBe(true);

  // SITNA applies `.tc-ctl-legend` on `#tc-slot-legend` itself (not a child).
  await expect(
    page.locator('#tc-slot-legend.tc-ctl-legend h2, #tc-slot-legend h2').first(),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('Map Legend task (#164)', () => {
  test('shows symbology from capabilities LegendURL when DescribeLayer is denied', async ({
    page,
  }) => {
    await loginAndOpenMap(page);
    // Match issue repro: load layer first, then open Legend task.
    await loadNonRadioLeafIntoCapas(page);

    // Capas path: capabilities Style/LegendURL (stub /legend). SITNA magnifier
    // keeps the URL on data-img; the <img> may stay hidden until enlarge.
    const capasLi = page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm[data-layer-id]').first();
    await expect(capasLi).toBeVisible({ timeout: 30_000 });
    const capasLegendImg = capasLi.locator('.tc-ctl-wlm-legend img, .tc-ctl-wlm-custom-legend img');
    await expect(capasLegendImg.first()).toBeAttached({ timeout: 60_000 });
    await expect(capasLegendImg.first()).toHaveAttribute(
      'data-img',
      /18093\/legend|\/legend\?layer=/i,
    );

    await openLegendPanel(page);

    // Handler refreshes tree ~100ms after the drawer opens (LAYERADD while collapsed).
    const legendImg = page.locator(
      '#tc-slot-legend sitna-layer-legend img, #tc-slot-legend .tc-ctl-legend-watch img, section.tc-left-panel .tc-ctl-legend img',
    );
    await expect(legendImg.first()).toBeAttached({ timeout: 60_000 });
    const src =
      (await legendImg.first().getAttribute('src')) ||
      (await legendImg.first().getAttribute('data-img'));
    expect(src, 'legend task must show a non-empty image src').toBeTruthy();
    expect(src!).toMatch(/legend|data:image|\.png|base64|18093/i);
  });
});
