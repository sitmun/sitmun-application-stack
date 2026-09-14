import { expect, type Page, type Response } from '@playwright/test';

export async function waitForMiaRender(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/tasks/template/more-info-advanced/render'),
  );
}

export async function waitForMiaExport(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/api/tasks/template/export'),
  );
}

export async function exportMiaOverlayPdf(page: Page): Promise<Response> {
  await expect(page.locator('.sitmun-mia-download-bar')).toBeVisible({ timeout: 15_000 });
  const exportResponse = waitForMiaExport(page);
  await page.locator('.sitmun-mia-download-toggle').click();
  await page.locator('.sitmun-mia-download-options .sitmun-mia-download-btn').first().click();
  return exportResponse;
}

/** When several MIA parents match the layer, activate the tab for our created task. */
export async function activateMiaTab(page: Page, miaName: string): Promise<void> {
  const tab = page.locator('.sitmun-mia-main-tab', { hasText: miaName });
  if ((await tab.count()) > 0) {
    await tab.first().click();
  }
}

export async function expectOverlayContains(
  page: Page,
  options: { miaName?: string; text: string | RegExp },
): Promise<void> {
  await expect(page.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible')).toBeVisible({
    timeout: 15_000,
  });
  if (options.miaName) {
    await activateMiaTab(page, options.miaName);
  }
  await expect(page.locator('.sitmun-mia-popup-overlay')).toContainText(options.text, {
    timeout: 15_000,
  });
}
