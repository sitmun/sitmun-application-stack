import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  uniqueValue,
} from '../helpers/form';

async function selectServiceByName(
  page: import('@playwright/test').Page,
  name: string | RegExp,
): Promise<void> {
  await control(page, 'serviceId').click();
  const option = page.getByRole('option', { name }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await expect(
    control(page, 'serviceId').locator('.mat-mdc-select-value-text'),
  ).not.toBeEmpty();
}

test.describe('Layers list delete', () => {
  test('creates a layer then deletes it from the list', async ({ page, request }) => {
    const name = uniqueValue('e2e-layer-del');
    const layerSet = uniqueValue('e2e-wms-layer');

    await gotoCreateForm(page, '/#/layers/-1/layersForm', 'name');
    await control(page, 'name').fill(name);
    await selectServiceByName(page, /^PNOA$/);
    await control(page, 'joinedLayers').fill(layerSet);
    await control(page, 'joinedLayers').blur();
    await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 15_000 });

    const id = await saveAndCaptureId(page, 'cartographies');

    await page.goto('/#/layers');
    const search = page.getByLabel(/Search|Buscar|Cercar|Rechercher/i);
    await search.waitFor({ state: 'visible', timeout: 15_000 });
    // data-grid quickSearch listens to keyup (not Enter-only).
    await search.click();
    await search.fill('');
    await search.pressSequentially(name, { delay: 30 });

    const row = page.locator('.ag-center-cols-container .ag-row').filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    const checkbox = row.locator('input[type="checkbox"]').first();
    await checkbox.check({ force: true });

    const deleteBtn = page
      .locator('button')
      .filter({ has: page.locator('mat-icon', { hasText: 'delete' }) })
      .first();
    await expect(deleteBtn).toBeEnabled({ timeout: 10_000 });

    const deleteResponsePromise = page.waitForResponse((response) => {
      try {
        const pathname = new URL(response.url()).pathname;
        return (
          response.request().method() === 'DELETE' &&
          pathname === `/backend/api/cartographies/${id}`
        );
      } catch {
        return false;
      }
    });

    await deleteBtn.click();
    const confirm = page
      .locator('mat-dialog-container button')
      .filter({ has: page.locator('mat-icon', { hasText: 'check' }) })
      .first();
    await confirm.waitFor({ state: 'visible', timeout: 10_000 });
    await confirm.click();

    const deleteResponse = await deleteResponsePromise;
    expect(
      deleteResponse.status(),
      `DELETE cartographies/${id}: ${await deleteResponse.text()}`,
    ).toBe(204);

    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: name }),
    ).toHaveCount(0, { timeout: 20_000 });

    const getAfter = await request.get(`/backend/api/cartographies/${id}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(getAfter.status()).toBe(404);
  });
});
