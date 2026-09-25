import { expect, type Page } from '@playwright/test';

import { test } from '../fixtures';
import { createPlantilla, openPlantilla } from '../helpers/template';

const ADMIN_HEADERS = { 'X-SITMUN-Client': 'admin' };
const ROLES_TAB = /^(Roles|Rols|Rôles|Ròtles)$/i;
const TERRITORIES_TAB = /^(Territories|Territorios|Territoris|Territoires|Territòris)$/i;

async function namedResource(
  request: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<string> {
  const response = await request.get(path, { headers: ADMIN_HEADERS });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { name?: string };
  expect(body.name, `${path} has no name`).toBeTruthy();
  return body.name as string;
}

async function addFromPicker(page: Page, tabName: RegExp, label: string): Promise<void> {
  await page.getByRole('tab', { name: tabName }).click();
  const grid = page.locator('.mat-mdc-tab-body-active app-relation-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await grid
    .locator('button')
    .filter({ has: page.locator('mat-icon', { hasText: 'add_circle_outline' }) })
    .click();

  const dialog = page.locator('mat-dialog-container');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('input').first().fill(label);
  await dialog.locator('input').first().dispatchEvent('keyup');
  const row = dialog.locator('.ag-center-cols-container .ag-row', { hasText: label }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.locator('input.ag-checkbox-input').click();
  await dialog
    .locator('button')
    .filter({ has: page.locator('mat-icon', { hasText: 'add_circle_outline' }) })
    .click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(grid).toContainText(label, { timeout: 15_000 });
}

test.describe('Plantilla role and territory tabs', () => {
  test('keeps a role and a territory assigned on the task form after reload', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(90_000);
    const roleName = await namedResource(request, '/backend/api/roles/1');
    const territoryName = await namedResource(request, '/backend/api/territories/1');

    const plantilla = await createPlantilla(page, { html: '<p>e2e-relations</p>' });
    createdResources.push({ collection: 'tasks', id: plantilla.id });

    await addFromPicker(page, ROLES_TAB, roleName);
    await addFromPicker(page, TERRITORIES_TAB, territoryName);

    await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('form-save').click();
    await expect(page.getByTestId('form-save')).toBeDisabled({ timeout: 30_000 });

    await openPlantilla(page, plantilla.id);

    await page.getByRole('tab', { name: ROLES_TAB }).click();
    await expect(page.locator('.mat-mdc-tab-body-active app-relation-grid')).toContainText(roleName, {
      timeout: 15_000,
    });

    await page.getByRole('tab', { name: TERRITORIES_TAB }).click();
    await expect(page.locator('.mat-mdc-tab-body-active app-relation-grid')).toContainText(territoryName, {
      timeout: 15_000,
    });
  });
});
