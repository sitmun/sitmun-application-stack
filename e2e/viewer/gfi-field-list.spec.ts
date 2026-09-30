import { expect, test, type Page } from '@playwright/test';
import { QUERYABLE_LEAF_CARTOGRAPHY_ID } from './fixtures';
import {
  enableCapasGfi,
  identifyAtMapCenter,
  loadQueryableLeafIntoCapas,
  loginAndOpenMap,
} from './helpers/mia';

const LAYER_NAME = '34_TOPO_TX';
const TASK_NAME = 'E2E extra field';

type FieldSeed = { name: string; label: string; format: 'T'; order: number };

type ProfileBody = {
  layers?: Array<{
    layers?: string[];
    featureInfoFields?: Array<{ name?: string; label?: string }>;
  }>;
  tasks?: Array<{ name?: string }>;
};

async function identifyWithFieldList(page: Page, featureInfoFields: FieldSeed[]) {
  // The viewer service worker fetches the profile. page.route does not see that.
  await page.context().route(/\/config\/client\/profile\//, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as {
      layers?: Array<{ id?: string; layers?: string[]; featureInfoFields?: unknown }>;
      tasks?: Array<Record<string, unknown>>;
    };
    const layer = body.layers?.find(
      (item) => Array.isArray(item.layers) && item.layers.includes(LAYER_NAME),
    );
    if (!layer) {
      throw new Error(`profile has no layer whose names include ${LAYER_NAME}`);
    }
    layer.featureInfoFields = featureInfoFields;
    body.tasks = body.tasks ?? [];
    body.tasks.push({
      id: 'e2e-more-info',
      name: TASK_NAME,
      'ui-control': 'sitmun.moreInfo',
      cartographyId: String(QUERYABLE_LEAF_CARTOGRAPHY_ID),
      command: 'https://example.org/item/$ID$',
      parameters: {
        ID: { label: '$ID$', value: 'id' },
      },
    });
    await route.fulfill({
      status: response.status(),
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  const profileSeen = page.waitForResponse(
    (response) =>
      response.url().includes('/config/client/profile/') && response.ok(),
  );
  await loginAndOpenMap(page);
  const profileBody = (await (await profileSeen).json()) as ProfileBody;
  await loadQueryableLeafIntoCapas(page);
  await enableCapasGfi(page);

  const gfi = page.waitForResponse(
    (response) =>
      /REQUEST=GetFeatureInfo/i.test(response.url()) &&
      /34_TOPO_TX/i.test(response.url()) &&
      response.ok(),
    { timeout: 60_000 },
  );
  await identifyAtMapCenter(page);
  await gfi;

  const table = page.locator('.tc-ctl-popup .tc-ctl-finfo-layers table').first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  return { profileBody, table };
}

/**
 * Include-list identify still grows when a sitmun.moreInfo task is present:
 * listed properties stay, omitted service properties stay hidden, and the
 * task appends its own row using the full payload.
 */
test.describe('GetFeatureInfo include list and more-info', () => {
  test('more-info adds a row while omitted properties stay hidden', async ({ page }) => {
    const { profileBody, table } = await identifyWithFieldList(page, [
      { name: 'name', label: 'Place', format: 'T', order: 0 },
    ]);
    const seeded = profileBody.layers?.find((item) => item.layers?.includes(LAYER_NAME));
    expect(seeded?.featureInfoFields?.some((field) => field.label === 'Place')).toBeTruthy();
    expect(profileBody.tasks?.some((task) => task.name === TASK_NAME)).toBeTruthy();

    await expect(table.locator('th', { hasText: /^Place$/ })).toBeVisible();
    await expect(table.locator('td', { hasText: 'e2e-gfi-click' })).toBeVisible();
    await expect(table.locator('th', { hasText: TASK_NAME })).toBeVisible();
    await expect(table.locator('a.sitmun-more-info-link')).toHaveAttribute(
      'href',
      'https://example.org/item/1',
    );
    await expect(table.locator('th', { hasText: /^id$/ })).toHaveCount(0);
  });

  test('empty field list keeps the original properties and the more-info row', async ({
    page,
  }) => {
    const { profileBody, table } = await identifyWithFieldList(page, []);
    const seeded = profileBody.layers?.find((item) => item.layers?.includes(LAYER_NAME));
    expect(seeded?.featureInfoFields).toHaveLength(0);
    expect(profileBody.tasks?.some((task) => task.name === TASK_NAME)).toBe(true);

    await expect(table.locator('th', { hasText: /^id$/ })).toBeVisible();
    await expect(
      table.locator('tr', { has: page.locator('th', { hasText: /^id$/ }) }).locator('td'),
    ).toHaveText('1');
    await expect(table.locator('th', { hasText: /^name$/ })).toBeVisible();
    await expect(
      table.locator('tr', { has: page.locator('th', { hasText: /^name$/ }) }).locator('td'),
    ).toHaveText('e2e-gfi-click');
    await expect(table.locator('th', { hasText: TASK_NAME })).toBeVisible();
    await expect(table.locator('a.sitmun-more-info-link')).toHaveAttribute(
      'href',
      'https://example.org/item/1',
    );
  });

  test('listed fields stay when one name misses the feature', async ({ page }) => {
    const { profileBody, table } = await identifyWithFieldList(page, [
      { name: 'name', label: 'Place', format: 'T', order: 0 },
      { name: 'missing-attr', label: 'Missing', format: 'T', order: 1 },
    ]);
    const seeded = profileBody.layers?.find((item) => item.layers?.includes(LAYER_NAME));
    const labels = seeded?.featureInfoFields?.map((field) => field.label) ?? [];
    expect(labels).toEqual(expect.arrayContaining(['Place', 'Missing']));

    await expect(
      table.locator('tr', { has: page.locator('th', { hasText: /^Place$/ }) }).locator('td'),
    ).toHaveText('e2e-gfi-click');
    await expect(
      table.locator('tr', { has: page.locator('th', { hasText: /^Missing$/ }) }).locator('td'),
    ).toHaveText('');
    await expect(table.locator('th', { hasText: /^id$/ })).toHaveCount(0);
    await expect(table.locator('th', { hasText: /^name$/ })).toHaveCount(0);
    await expect(table.locator('a.sitmun-more-info-link')).toHaveAttribute(
      'href',
      'https://example.org/item/1',
    );
    await expect(table.locator('tr')).toHaveCount(3);
  });
});
