import { expect, type Page, type Locator } from '@playwright/test';

export function control(page: Page, name: string): Locator {
  return page.locator(`[formControlName="${name}"]`);
}

export function uniqueValue(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function waitForFormReady(page: Page, primaryFieldName: string): Promise<Locator> {
  const primary = control(page, primaryFieldName);
  await primary.waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('form-save').waitFor({ state: 'visible', timeout: 15_000 });
  await page
    .getByText('Loading...', { exact: false })
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => {});
  return primary;
}

export async function gotoCreateForm(
  page: Page,
  hashPath: string,
  primaryFieldName: string,
): Promise<Locator> {
  await page.goto(hashPath);
  return waitForFormReady(page, primaryFieldName);
}

export async function touchAndClear(page: Page, fieldName: string): Promise<void> {
  const field = control(page, fieldName);
  await field.fill('x');
  await field.blur();
  await field.fill('');
  await field.blur();
  await page.keyboard.press('Tab');
}

export async function saveAndCaptureId(
  page: Page,
  collection: 'roles' | 'users' | 'territories' | 'tasks',
): Promise<number> {
  const responsePromise = page.waitForResponse((response) => {
    try {
      const pathname = new URL(response.url()).pathname;
      return response.request().method() === 'POST' && pathname === `/backend/api/${collection}`;
    } catch {
      return false;
    }
  });

  await dismissBlockingOverlays(page);
  await page.getByTestId('form-save').click();
  const response = await responsePromise;
  const bodyText = await response.text();
  expect(
    response.ok(),
    `POST /backend/api/${collection} failed: ${response.status()} ${bodyText}`,
  ).toBeTruthy();

  let body: { id?: number };
  try {
    body = JSON.parse(bodyText) as { id?: number };
  } catch {
    throw new Error(`POST /backend/api/${collection} returned non-JSON body: ${bodyText}`);
  }
  expect(typeof body.id, `POST body missing numeric id: ${bodyText}`).toBe('number');

  // BaseFormComponent finishes afterSave (markPristine) after the POST resolves.
  await expect(page.getByTestId('form-save')).toBeDisabled({ timeout: 15_000 });
  await dismissBlockingOverlays(page);
  return body.id as number;
}

export async function saveUpdate(
  page: Page,
  collection: 'roles' | 'users' | 'territories' | 'applications' | 'tasks' | 'languages',
  id: number,
): Promise<void> {
  const responsePromise = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url());
      const pathname = url.pathname;
      return (
        response.request().method() === 'PUT' &&
        (pathname === `/backend/api/${collection}/${id}` || pathname === `/api/${collection}/${id}`)
      );
    } catch {
      return false;
    }
  });

  await dismissBlockingOverlays(page);
  await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('form-save').click();
  const response = await responsePromise;
  expect(
    response.ok(),
    `PUT /backend/api/${collection}/${id} failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  await expect(page.getByTestId('form-save')).toBeDisabled({ timeout: 15_000 });
  await dismissBlockingOverlays(page);
}

export async function dismissBlockingOverlays(page: Page): Promise<void> {
  const backdrop = page.locator('.cdk-overlay-backdrop');
  if (await backdrop.count()) {
    await page.keyboard.press('Escape').catch(() => {});
    await backdrop
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {});
  }
  const notification = page.locator('.notification-content');
  if (await notification.count()) {
    await page.keyboard.press('Escape').catch(() => {});
    await notification
      .first()
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => {});
  }
}

export async function selectFirstTerritoryType(page: Page): Promise<void> {
  await control(page, 'typeId').click();
  const firstOption = page.locator('mat-option:not([aria-disabled="true"])').first();
  await firstOption.waitFor({ state: 'visible', timeout: 15_000 });
  await firstOption.click();
  // mat-select stores value on the control; the trigger should show non-empty text.
  await expect(control(page, 'typeId').locator('.mat-mdc-select-value-text')).not.toBeEmpty();
}

export async function selectFirstMatOption(
  page: Page,
  formControlName: string,
): Promise<void> {
  await control(page, formControlName).click();
  const firstOption = page.locator('mat-option:not([aria-disabled="true"])').first();
  await firstOption.waitFor({ state: 'visible', timeout: 15_000 });
  await firstOption.click();
  await expect(
    control(page, formControlName).locator('.mat-mdc-select-value-text'),
  ).not.toBeEmpty();
}

export async function selectAutocompleteOption(
  page: Page,
  input: Locator,
  searchText: string,
  optionText: string | RegExp,
): Promise<void> {
  await input.click();
  await input.fill(searchText);
  const option = page.locator('mat-option').filter({ hasText: optionText }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
}
