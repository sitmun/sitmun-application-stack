import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  saveUpdate,
  selectAutocompleteOption,
  selectFirstMatOption,
  uniqueValue,
  waitForFormReady,
} from './form';

export const MIA_CREATE_PATH = '/#/tasksMoreInfoAdvanced/-1/16';
export const CARTOGRAPHY_SEARCH = 'Toponimia';
export const CARTOGRAPHY_OPTION = /Toponimia 1:25\.000/;
export const ROLE_ID = 1;
export const TERRITORY_ID = 1;

export async function createMiaWithChild(
  page: Page,
  options: {
    name?: string;
    childSearch: string;
    childOption: string | RegExp;
    childId: number;
  },
): Promise<{ id: number; name: string }> {
  const name = options.name ?? uniqueValue('e2e-mia');
  await gotoCreateForm(page, MIA_CREATE_PATH, 'name');
  await control(page, 'name').fill(name);
  await selectFirstMatOption(page, 'taskGroupId');
  await selectAutocompleteOption(
    page,
    page.getByRole('combobox', {
      name: /Cartography used|Cartografia utilitzada|Cartografía utilizada|Cartographie utilisée/i,
    }),
    CARTOGRAPHY_SEARCH,
    CARTOGRAPHY_OPTION,
  );
  await control(page, 'parentLayout').click();
  await page.getByRole('option', { name: /^(Tabs|Pestanyes|Pestañas|Onglets|Pestanhes)$/i }).click();
  await selectAutocompleteOption(
    page,
    page.getByRole('combobox', {
      name: /Add task|Afegir tasca|Añadir tarea|Ajouter une tâche/i,
    }),
    options.childSearch,
    options.childOption,
  );
  await expect(page.locator('.included-task-id')).toContainText(`ID: ${options.childId}`);
  const id = await saveAndCaptureId(page, 'tasks');
  return { id, name };
}

export async function openMia(page: Page, id: number): Promise<void> {
  await page.goto(`/#/tasksMoreInfoAdvanced/${id}/16`);
  await waitForFormReady(page, 'name');
}

export async function addMiaParameter(
  page: Page,
  options: { label: string; value: string },
): Promise<void> {
  await page.getByRole('tab', { name: /Parameters|Paràmetres|Parámetros|Paramètres/i }).click();
  await expect(page.locator('app-relation-grid')).toBeVisible({ timeout: 15_000 });
  await page
    .locator('app-relation-grid button')
    .filter({ has: page.locator('mat-icon', { hasText: 'add_circle_outline' }) })
    .first()
    .click();
  const dialog = page.locator('mat-dialog-container').last();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('[formControlName="label"]').fill(options.label);
  await dialog.locator('[formControlName="value"]').fill(options.value);
  await dialog
    .locator('mat-dialog-actions button')
    .filter({ has: page.locator('mat-icon', { hasText: 'add_circle_outline' }) })
    .click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('app-relation-grid')).toContainText(options.label, {
    timeout: 15_000,
  });

  const putPromise = page.waitForResponse((response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      return (
        response.request().method() === 'PUT' &&
        /\/backend\/api\/tasks\/\d+$/.test(pathname)
      );
    } catch {
      return false;
    }
  });
  await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId('form-save').click();
  const put = await putPromise;
  expect(put.ok(), `PUT task after parameter add failed: ${put.status()}`).toBeTruthy();
  await expect(page.getByTestId('form-save')).toBeDisabled({ timeout: 15_000 });
}

/** Ensure Plantilla exposes a child param label for MIA mapping UI. */
export async function putPlantillaParameter(
  request: APIRequestContext,
  taskId: number,
  options: { variable: string; label: string; templateHtml: string },
): Promise<void> {
  const get = await request.get(`/backend/api/tasks/${taskId}`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(get.ok(), await get.text()).toBeTruthy();
  const task = (await get.json()) as {
    name?: string;
    properties?: Record<string, unknown>;
  };
  const put = await request.put(`/backend/api/tasks/${taskId}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/json',
    },
    data: {
      name: task.name,
      properties: {
        ...(task.properties ?? {}),
        templateHtml: options.templateHtml,
        parameters: [
          {
            variable: options.variable,
            label: options.label,
            type: 'string',
            required: false,
          },
        ],
      },
    },
  });
  expect(put.ok(), `put plantilla params: ${put.status()} ${await put.text()}`).toBeTruthy();
}

export async function addChildMapping(
  page: Page,
  options: { miaParamLabel: string; childParamLabel: string },
): Promise<void> {
  const addRow = page.locator('.mapping-actions-row button').first();
  await expect(addRow).toBeEnabled({ timeout: 15_000 });
  await addRow.click();
  const row = page.locator('.mapping-row').last();
  await row.locator('mat-select').nth(0).click();
  await page.getByRole('option', { name: options.miaParamLabel, exact: true }).click();
  await row.locator('mat-select').nth(1).click();
  await page.getByRole('option', { name: options.childParamLabel, exact: true }).click();
}

export async function ensureMiaViewerAccess(
  request: APIRequestContext,
  taskId: number,
): Promise<void> {
  const headers = {
    'X-SITMUN-Client': 'admin',
    'Content-Type': 'application/json',
  };

  const availability = await request.post('/backend/api/task-availabilities', {
    headers,
    data: {
      task: `http://localhost/api/tasks/${taskId}`,
      territory: `http://localhost/api/territories/${TERRITORY_ID}`,
    },
  });
  expect(
    [201, 409].includes(availability.status()),
    `task-availability ${taskId}: ${availability.status()} ${await availability.text()}`,
  ).toBeTruthy();

  const roles = await request.put(`/backend/api/tasks/${taskId}/roles`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'text/uri-list',
    },
    data: `http://localhost/api/roles/${ROLE_ID}`,
  });
  expect(
    roles.ok() || roles.status() === 204,
    `attach role for task ${taskId}: ${roles.status()} ${await roles.text()}`,
  ).toBeTruthy();
}

export async function saveMiaUpdate(page: Page, id: number): Promise<void> {
  await saveUpdate(page, 'tasks', id);
}

export { uniqueValue };
