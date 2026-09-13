import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  touchAndClear,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';
import type { APIRequestContext, ConsoleMessage, Page } from '@playwright/test';

const FEATURE_INFORMATION_TAB =
  /Alphanumeric information|Información alfanumérica|Informació alfanumèrica|Informacion alfanumerica|Information alphanumérique/i;

const TERRITORIES_TAB = /Territories|Territorios|Territoris|Territòris|Territoires/i;
const PERMISSIONS_TAB = /Permissions|Permisos|Autorisations/i;
const TREES_TAB = /^Trees$|^Árboles$|^Arboles$|^Arbres$/i;

const SPLIT_ERROR = /raw\.split is not a function|parseLayerList/i;

function collectSplitErrors(page: Page): string[] {
  const errors: string[] = [];
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && SPLIT_ERROR.test(msg.text())) {
      errors.push(msg.text());
    }
  };
  const onPageError = (error: Error) => {
    if (SPLIT_ERROR.test(error.message)) {
      errors.push(error.message);
    }
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return errors;
}

async function selectServiceByName(page: Page, name: string | RegExp): Promise<void> {
  await control(page, 'serviceId').click();
  const option = page.getByRole('option', { name }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await expect(
    control(page, 'serviceId').locator('.mat-mdc-select-value-text'),
  ).not.toBeEmpty();
}

type CartographyRelation = 'availabilities' | 'permissions' | 'treeNodes';

function cartographyRelationName(url: string, cartographyId: number): CartographyRelation | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(
      new RegExp(`/api/cartographies/${cartographyId}/(availabilities|permissions|treeNodes)(?:/|$)`),
    );
    return (match?.[1] as CartographyRelation | undefined) ?? null;
  } catch {
    return null;
  }
}

async function listEmbeddedTerritories(
  request: APIRequestContext,
): Promise<Array<{ id: number }>> {
  const response = await request.get('/backend/api/territories?size=20', {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(response.ok(), `GET territories: ${response.status()} ${await response.text()}`).toBeTruthy();
  const body = (await response.json()) as { _embedded?: { territories?: Array<{ id?: number }> } };
  return (body._embedded?.territories ?? []).filter(
    (item): item is { id: number } => typeof item.id === 'number',
  );
}

async function openLayersRelationTab(page: Page, name: RegExp): Promise<void> {
  const tab = page.getByRole('tab', { name }).first();
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
}

async function openFeatureInformationTab(page: Page): Promise<void> {
  const tab = page.getByRole('tab', { name: FEATURE_INFORMATION_TAB });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
  await expect(
    page.getByRole('tabpanel', { name: FEATURE_INFORMATION_TAB }),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Layers form', () => {
  test('disables save when required fields are cleared', async ({ page }) => {
    await gotoCreateForm(page, '/#/layers/-1/layersForm', 'name');
    await selectServiceByName(page, /^PNOA$/);
    await control(page, 'name').fill(uniqueValue('e2e-layer'));
    await control(page, 'joinedLayers').fill('layer-a');
    await touchAndClear(page, 'name');
    await touchAndClear(page, 'joinedLayers');
    await expect(page.getByTestId('form-save')).toBeDisabled();
  });

  test('creates and reloads a layer', async ({ page, createdResources }) => {
    const name = uniqueValue('e2e-layer');
    const layerSet = uniqueValue('e2e-wms-layer');

    await gotoCreateForm(page, '/#/layers/-1/layersForm', 'name');
    await control(page, 'name').fill(name);
    await selectServiceByName(page, /^PNOA$/);
    await control(page, 'joinedLayers').fill(layerSet);
    await control(page, 'joinedLayers').blur();
    await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 15_000 });

    const id = await saveAndCaptureId(page, 'cartographies');
    createdResources.push({ collection: 'cartographies', id });

    await page.goto(`/#/layers/${id}/layersForm`);
    await waitForFormReady(page, 'name');
    await expect(control(page, 'name')).toHaveValue(name);
    await expect(control(page, 'joinedLayers')).toHaveValue(layerSet);
  });

  test('Feature Information character count does not throw raw.split', async ({ page }) => {
    const splitErrors = collectSplitErrors(page);

    await gotoCreateForm(page, '/#/layers/-1/layersForm', 'name');
    await control(page, 'name').fill(uniqueValue('e2e-layer-gfi'));
    await selectServiceByName(page, /^PNOA$/);
    await control(page, 'joinedLayers').fill('layer-a,layer-b');

    await openFeatureInformationTab(page);

    const useAllLayers = control(page, 'queryableFeatureAvailable');
    await useAllLayers.waitFor({ state: 'visible', timeout: 10_000 });
    // Leave "use all layers" OFF so the queryable CSV field (+ characterCount hint) renders.
    const toggle = useAllLayers.locator('button[role="switch"]').or(useAllLayers.getByRole('switch'));
    const switchEl = (await toggle.count()) ? toggle.first() : useAllLayers;
    if ((await switchEl.getAttribute('aria-checked')) === 'true') {
      await switchEl.click();
    }

    // New layers keep joinedQueryableLayers disabled; hint still renders via characterCount:500.
    await expect(control(page, 'joinedQueryableLayers')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/0\/500/).first()).toBeVisible({ timeout: 10_000 });

    // Toggle "use all layers" to force another CD cycle while the hint remains in the tree.
    await switchEl.click();
    await switchEl.click();
    await expect(control(page, 'joinedQueryableLayers')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/0\/500/).first()).toBeVisible({ timeout: 10_000 });

    expect(
      splitErrors,
      `characterCount probe must not throw; got: ${splitErrors.slice(0, 3).join(' | ')}`,
    ).toEqual([]);
  });

  test('defers relation collection GETs until the tab is selected', async ({
    page,
    request,
    createdResources,
  }) => {
    const name = uniqueValue('e2e-layer-lazy');
    const layerSet = uniqueValue('e2e-wms-layer');

    await gotoCreateForm(page, '/#/layers/-1/layersForm', 'name');
    await control(page, 'name').fill(name);
    await selectServiceByName(page, /^PNOA$/);
    await control(page, 'joinedLayers').fill(layerSet);
    await control(page, 'joinedLayers').blur();
    await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 15_000 });

    const id = await saveAndCaptureId(page, 'cartographies');
    createdResources.push({ collection: 'cartographies', id });

    const territories = await listEmbeddedTerritories(request);
    const linked = territories.slice(0, Math.min(5, territories.length));
    for (const territory of linked) {
      const create = await request.post('/backend/api/cartography-availabilities', {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/json',
        },
        data: {
          cartography: `http://localhost:18080/api/cartographies/${id}`,
          territory: `http://localhost:18080/api/territories/${territory.id}`,
        },
      });
      expect(
        [201, 409].includes(create.status()),
        `link availability territory ${territory.id}: ${create.status()} ${await create.text()}`,
      ).toBeTruthy();
    }

    const relationGets: Record<'availabilities' | 'permissions' | 'treeNodes', string[]> = {
      availabilities: [],
      permissions: [],
      treeNodes: [],
    };
    page.on('request', (req) => {
      if (req.method() !== 'GET') {
        return;
      }
      const relation = cartographyRelationName(req.url(), id);
      if (relation) {
        relationGets[relation].push(req.url());
      }
    });

    await page.goto(`/#/layers/${id}/layersForm`);
    await waitForFormReady(page, 'name');
    await expect(control(page, 'name')).toHaveValue(name);

    expect(
      relationGets.availabilities,
      'availabilities must not load on Details',
    ).toEqual([]);
    expect(relationGets.permissions, 'permissions must not load on Details').toEqual([]);
    expect(relationGets.treeNodes, 'treeNodes must not load on Details').toEqual([]);

    await openLayersRelationTab(page, TERRITORIES_TAB);
    await expect
      .poll(() => relationGets.availabilities.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(relationGets.permissions).toEqual([]);
    expect(relationGets.treeNodes).toEqual([]);

    await openLayersRelationTab(page, PERMISSIONS_TAB);
    await expect
      .poll(() => relationGets.permissions.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(relationGets.treeNodes).toEqual([]);

    await openLayersRelationTab(page, TREES_TAB);
    await expect.poll(() => relationGets.treeNodes.length, { timeout: 15_000 }).toBeGreaterThan(0);
  });
});
