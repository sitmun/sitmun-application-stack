import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { control, gotoCreateForm, saveAndCaptureId, uniqueValue, waitForFormReady } from './form';

export const POSITIONS_TAB =
  /Data associated to territory|Puestos por territorio|Positions par territoire/i;
export const ADMIN_HEADERS = { 'X-SITMUN-Client': 'admin' };
export const TERRITORY_URI = 'http://localhost:18080/api/territories/1';
export const EN_CREATED_DATE_HEADER = 'Valid from';
export const EN_EXPIRATION_DATE_HEADER = 'Valid until';
export const ES_CREATED_DATE_HEADER = 'Fecha de alta';
export const ES_EXPIRATION_DATE_HEADER = 'Fecha de baja';
export const EMPTY_CREATED_DATE = /Not set|No informada|Non renseignée|Non informada/i;
export const EMPTY_EXPIRATION_DATE = /Active|Activo|Actiu|Actif/i;
export const EXPIRATION_HEADER_TOOLTIP =
  /last day|último día|darrer dia|dernier jour|darrèr dia/i;

export function expectCreatedThenExpiration(
  headers: string[],
  created: string,
  expiration: string,
): void {
  const createdAt = headers.indexOf(created);
  const expirationAt = headers.indexOf(expiration);
  expect(createdAt, `headers=${headers.join('|')}`).toBeGreaterThan(-1);
  expect(expirationAt, `headers=${headers.join('|')}`).toBe(createdAt + 1);
}

type PositionBody = {
  user: string;
  territory: string;
  name: string;
  organization: string;
  createdDate?: string | null;
  expirationDate?: string | null;
};

export function userUri(id: number): string {
  return `http://localhost:18080/api/users/${id}`;
}

export async function createUserViaForm(
  page: Page,
  prefix: string,
): Promise<{ id: number; username: string }> {
  const username = uniqueValue(prefix).replace(/-/g, '').slice(0, 50);
  await gotoCreateForm(page, '/#/user/-1/userForm', 'username');
  await control(page, 'username').fill(username);
  const id = await saveAndCaptureId(page, 'users');
  return { id, username };
}

export async function postPosition(
  request: APIRequestContext,
  id: number,
  extra: Partial<PositionBody> = {},
): Promise<number> {
  const created = await request.post('/backend/api/user-positions', {
    headers: ADMIN_HEADERS,
    data: {
      user: userUri(id),
      territory: TERRITORY_URI,
      name: extra.name ?? 'Cargo',
      organization: extra.organization ?? 'Org',
      ...extra,
    },
  });
  expect(created.ok(), `POST position failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const location = created.headers()['location'] ?? '';
  const positionId = Number(location.match(/\/(\d+)$/)?.[1]);
  expect(positionId, `missing position id from ${location}`).toBeGreaterThan(0);
  return positionId;
}

export async function putPosition(
  request: APIRequestContext,
  userId: number,
  positionId: number,
  extra: Partial<PositionBody> = {},
): Promise<void> {
  const updated = await request.put(`/backend/api/user-positions/${positionId}`, {
    headers: ADMIN_HEADERS,
    data: {
      user: userUri(userId),
      territory: TERRITORY_URI,
      name: extra.name ?? 'Cargo',
      organization: extra.organization ?? 'Org',
      ...extra,
    },
  });
  expect(updated.ok(), `PUT position failed: ${updated.status()} ${await updated.text()}`).toBeTruthy();
}

export async function postThenSetDates(
  request: APIRequestContext,
  userId: number,
  extra: Partial<PositionBody> = {},
): Promise<number> {
  const positionId = await postPosition(request, userId, extra);
  if (extra.createdDate !== undefined || extra.expirationDate !== undefined) {
    await putPosition(request, userId, positionId, extra);
  }
  return positionId;
}

export async function openPositions(page: Page, userId: number): Promise<void> {
  await page.goto(`/#/user/${userId}/userForm`);
  await waitForFormReady(page, 'username');
  await page.getByRole('tab', { name: POSITIONS_TAB }).click();
  await expect(page.locator('app-relation-grid .ag-header-cell-text').first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function headerTexts(page: Page): Promise<string[]> {
  return (await page.locator('app-relation-grid .ag-header-cell-text').allTextContents())
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
}

export async function saveShot(page: Page, name: string): Promise<void> {
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/${name}` });
}

export async function editAltaCell(page: Page, isoDate: string): Promise<void> {
  const cell = page.locator('app-relation-grid .ag-cell[col-id="createdDate"]').first();
  await expect(cell).toBeVisible({ timeout: 15_000 });
  await cell.dblclick();
  const editor = page.locator('app-relation-grid .ag-cell-inline-editing input').first();
  if ((await editor.count()) === 0 || !(await editor.isVisible())) {
    await cell.click();
    await page.keyboard.press('F2');
  }
  await expect(page.locator('app-relation-grid .ag-cell-inline-editing input').first()).toBeVisible({
    timeout: 5_000,
  });
  await page.locator('app-relation-grid .ag-cell-inline-editing input').first().fill(isoDate);
  await page.keyboard.press('Enter');
}

export async function savePositionUpdate(page: Page): Promise<void> {
  const putResponse = page.waitForResponse((response) => {
    try {
      return (
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.includes('/user-positions/')
      );
    } catch {
      return false;
    }
  });
  await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('form-save').click();
  const saved = await putResponse;
  expect(saved.ok(), `PUT position failed: ${saved.status()} ${await saved.text()}`).toBeTruthy();
}
