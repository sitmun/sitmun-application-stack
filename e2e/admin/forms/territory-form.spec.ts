import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  saveUpdate,
  selectFirstTerritoryType,
  touchAndClear,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';

test.describe('Territory form', () => {
  test('disables save when required fields are cleared', async ({ page }) => {
    await gotoCreateForm(page, '/#/territory/-1/territoryForm', 'name');
    await touchAndClear(page, 'name');
    await touchAndClear(page, 'code');
    await expect(page.getByTestId('form-save')).toBeDisabled();
  });

  test('creates and updates a territory', async ({ page, createdResources }) => {
    const name = uniqueValue('e2e-territory');
    const code = uniqueValue('e2ecode').replace(/-/g, '').slice(0, 50);
    const description = uniqueValue('e2e-territory-desc');

    await gotoCreateForm(page, '/#/territory/-1/territoryForm', 'name');
    await control(page, 'name').fill(name);
    await control(page, 'code').fill(code);
    await selectFirstTerritoryType(page);

    const id = await saveAndCaptureId(page, 'territories');
    createdResources.push({ collection: 'territories', id });

    const delayedGet = `**/backend/api/territories/${id}*`;
    await page.route(delayedGet, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });

    try {
      await page.goto(`/#/territory/${id}/territoryForm`);
      await expect(control(page, 'name')).toBeHidden({ timeout: 2_000 });
      await waitForFormReady(page, 'name');
    } finally {
      await page.unroute(delayedGet);
    }

    await expect(control(page, 'name')).toHaveValue(name);
    await expect(control(page, 'code')).toHaveValue(code);

    await control(page, 'description').fill(description);
    await expect(control(page, 'description')).toHaveValue(description);
    await expect(page.getByTestId('form-save')).toBeEnabled();
    await saveUpdate(page, 'territories', id);

    await page.reload();
    await waitForFormReady(page, 'name');
    await expect(control(page, 'description')).toHaveValue(description);
  });

  test('enables save on duplicate with suggested copy name (#384)', async ({
    page,
    createdResources,
  }) => {
    const name = uniqueValue('e2e-territory-dup');
    const code = uniqueValue('e2edup').replace(/-/g, '').slice(0, 50);

    await gotoCreateForm(page, '/#/territory/-1/territoryForm', 'name');
    await control(page, 'name').fill(name);
    await control(page, 'code').fill(code);
    await selectFirstTerritoryType(page);

    const sourceId = await saveAndCaptureId(page, 'territories');
    createdResources.push({ collection: 'territories', id: sourceId });

    await page.goto(`/#/territory/-1/territoryForm/${sourceId}`);
    await waitForFormReady(page, 'name');

    await expect(control(page, 'name')).toHaveValue(`copy_${name}`);
    await expect(control(page, 'code')).toHaveValue(code);
    await expect(page.getByTestId('form-save')).toBeEnabled();

    const duplicateId = await saveAndCaptureId(page, 'territories');
    createdResources.push({ collection: 'territories', id: duplicateId });
    expect(duplicateId).not.toBe(sourceId);
  });
});
