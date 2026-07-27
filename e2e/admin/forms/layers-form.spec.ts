import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  touchAndClear,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';
import type { ConsoleMessage, Page } from '@playwright/test';

const FEATURE_INFORMATION_TAB =
  /Alphanumeric information|Información alfanumérica|Informació alfanumèrica|Informacion alfanumerica|Information alphanumérique/i;

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
});
