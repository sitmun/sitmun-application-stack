import type { Browser, Page } from '@playwright/test';

export const VIEWER_URL = 'http://localhost:4400';
export const ADMIN_URL = 'http://localhost:4300';

/** Fresh viewer/public context — no admin storageState bleed. */
export async function withViewerPage(
  browser: Browser,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL: VIEWER_URL });
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await context.close();
  }
}
