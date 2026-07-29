import { expect, type Page } from '@playwright/test';
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

export const PLANTILLA_CREATE_PATH = '/#/taskTemplate/-1/15';

export async function switchTemplateEditorToHtml(page: Page): Promise<void> {
  const editor = page.locator('app-template-editor').first();
  await editor.scrollIntoViewIfNeeded();
  const htmlMode = editor.getByRole('button', { name: /^HTML$/i });
  await expect(htmlMode).toBeVisible({ timeout: 15_000 });
  await htmlMode.click();
  await expect(editor.locator('textarea.template-editor-source')).toBeVisible({ timeout: 15_000 });
}

export async function setTemplateHtml(page: Page, html: string): Promise<void> {
  await switchTemplateEditorToHtml(page);
  const source = page.locator('app-template-editor textarea.template-editor-source');
  await source.fill(html);
  await source.dispatchEvent('input');
  await source.blur();
}

export async function createPlantilla(
  page: Page,
  options: { name?: string; html: string },
): Promise<{ id: number; name: string }> {
  const name = options.name ?? uniqueValue('e2e-plantilla');
  // Hash-route reuse can keep the prior Plantilla form; bounce via list first.
  await page.goto('/#/tasksTemplate');
  await expect(page).toHaveURL(/#\/tasksTemplate(?:\/|$|\?)/);
  await expect(page.locator('app-tasks-template').first()).toBeVisible({ timeout: 15_000 });
  await gotoCreateForm(page, PLANTILLA_CREATE_PATH, 'name');
  await expect(page).toHaveURL(/taskTemplate\/-1\/15/);
  await expect(control(page, 'name')).toHaveValue('');
  await control(page, 'name').fill(name);
  await selectFirstMatOption(page, 'taskGroupId');
  await setTemplateHtml(page, options.html);
  // TipTap HTML mode binds via (input); ensure Angular form control sees the value.
  await page.locator('app-template-editor').evaluate((el, html) => {
    const textarea = el.querySelector('textarea.template-editor-source') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value = html;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, options.html);
  // TipTap validation is async; wait until the Angular form accepts the HTML.
  await expect
    .poll(async () => page.getByTestId('form-save').isEnabled(), { timeout: 20_000 })
    .toBeTruthy();
  await expect(page.locator('.template-editor-errors')).toHaveCount(0);
  const id = await saveAndCaptureId(page, 'tasks');
  return { id, name };
}

export async function assertPlantillaHtmlPersisted(
  request: import('@playwright/test').APIRequestContext,
  taskId: number,
  expectedSnippet: string,
): Promise<void> {
  const response = await request.get(`/backend/api/tasks/${taskId}`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const task = (await response.json()) as { properties?: { templateHtml?: string } };
  expect(task.properties?.templateHtml ?? '', `task ${taskId} missing templateHtml`).toContain(
    expectedSnippet,
  );
}

export async function linkNestedPlantilla(
  page: Page,
  childName: string,
  childId: number,
): Promise<void> {
  const input = page.locator('.add-linked-task-field input');
  await selectAutocompleteOption(
    page,
    input,
    childName,
    new RegExp(`${childName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${childId}\\)`),
  );
  await expect(page.locator('.linked-tasks-table')).toContainText(`ID: ${childId}`);
}

export async function setReferenceAlias(page: Page, taskId: number, alias: string): Promise<void> {
  const row = page.locator('.linked-tasks-table tbody tr').filter({ hasText: `ID: ${taskId}` });
  const aliasInput = row.locator('.reference-alias-field input');
  await aliasInput.fill(alias);
  await row.locator('.reference-alias-apply-button').click();
  await expect(aliasInput).toHaveValue(alias);
}

export async function savePlantillaUpdate(page: Page, id: number): Promise<void> {
  await saveUpdate(page, 'tasks', id);
}

export async function openPlantilla(page: Page, id: number): Promise<void> {
  await page.goto(`/#/taskTemplate/${id}/15`);
  await waitForFormReady(page, 'name');
}

export async function renderPlantillaPreview(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^(Render|Renderitza|Renderizar|Rendre)$/i })
    .click();
  await expect(page.locator('.preview-panel.ql-editor')).toBeVisible({ timeout: 30_000 });
}

export async function executeNestedPlantillaCard(page: Page, childId: number): Promise<void> {
  const card = page.locator('app-query-execution-card').filter({ hasText: `ID: ${childId}` });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole('button', { name: /Ejecutar plantilla|Execute template/i }).click();
  await expect(card.locator('.template-result-panel')).toBeVisible({ timeout: 30_000 });
}
