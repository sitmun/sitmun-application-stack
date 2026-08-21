import { test, expect, type Page } from '@playwright/test';
import {
  APP_ID,
  isBackendRequest,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

/**
 * Print preview map sizing (#160).
 *
 * While the preview is active api-sitna adds `tc-ctl-prnmap-printing` plus a
 * format class to the map container and sizes it to the page through its own
 * `css/sitna.css`. `createPdf` then draws the captured canvas into a pdfmake
 * slot with both dimensions fixed, so a canvas that kept the browser window
 * shape is stretched to fill the page.
 *
 * The viewer component rule for `#mapa` contains an id, so it outweighed those
 * three-class rules and the map never resized. It is now guarded with
 * `:not(.tc-ctl-prnmap-printing)` in both map components.
 */

/** Sizes declared by api-sitna for `.tc-map.tc-ctl-prnmap-printing.<format>`. */
const PAGE_FORMATS = [
  { orientation: 'landscape', size: 'a4', width: '1040px', height: '704px' },
  { orientation: 'portrait', size: 'a4', width: '712px', height: '1034px' },
] as const;

/**
 * Deliberately far from both page shapes, so a map left at window size cannot
 * satisfy either expectation by accident.
 */
const WINDOW = { width: 1600, height: 700 };

async function loginAndOpenMap(page: Page): Promise<void> {
  const credentials = await readViewerCredentials();

  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();

  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

  const authenticate = page.waitForResponse(
    (response) => isBackendRequest(response, '/authenticate', 'POST') && response.ok(),
  );
  const account = page.waitForResponse(
    (response) => isBackendRequest(response, '/account', 'GET') && response.ok(),
  );

  await page.locator('form .login-button button').click();
  await Promise.all([authenticate, account]);
  await expect(page).toHaveURL(/\/user\/dashboard/);

  const profile = page.waitForResponse(
    (response) =>
      isBackendRequest(
        response,
        `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
        'GET',
      ) && response.ok(),
  );

  await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, {
    waitUntil: 'domcontentloaded',
  });

  const profileBody = (await (await profile).json()) as {
    tasks?: Array<{ 'ui-control'?: string }>;
  };
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.printMap'),
    'profile must include sitna.printMap (setup task-availability)',
  ).toBeTruthy();

  await page.locator('#tc-slot-print').waitFor({ state: 'attached', timeout: 90_000 });
}

/** Opens the left tools panel and expands the print control. */
async function openPrintPanel(page: Page): Promise<void> {
  await page.locator('#tools-tab').click();
  await expect(page.locator('.tc-left-panel')).not.toHaveClass(/tc-collapsed-left/);

  await page.locator('#tc-slot-print > h2').click();
  await expect(page.locator('#tc-slot-print')).not.toHaveClass(/tc-collapsed/);
}

test.use({ viewport: WINDOW });

test.describe('Viewer print preview', () => {
  test('sizes the map to the selected page format', async ({ page }) => {
    await loginAndOpenMap(page);

    const map = page.locator('#mapa');
    await expect(map, 'map should fill the window before any preview').toHaveCSS(
      'width',
      `${WINDOW.width}px`,
    );
    const windowedHeight = await map.evaluate(
      (element) => getComputedStyle(element).height,
    );

    await openPrintPanel(page);

    for (const format of PAGE_FORMATS) {
      const label = `${format.orientation} ${format.size.toUpperCase()}`;

      await page.selectOption('#print-design', format.orientation);
      await page.selectOption('#print-size', format.size);
      await page.locator('#tc-slot-print sitna-button.tc-ctl-prnmap-btn').click();
      await page
        .locator(
          `#mapa.tc-ctl-prnmap-printing.tc-ctl-prnmap-${format.orientation}-${format.size}`,
        )
        .waitFor({ timeout: 40_000 });

      await expect(map, `map must be ${label} wide while printing`).toHaveCSS(
        'width',
        format.width,
      );
      await expect(map, `map must be ${label} tall while printing`).toHaveCSS(
        'height',
        format.height,
      );

      await page.locator('.tc-ctl-prnmap-btn-close').click();
      await page
        .locator('#mapa:not(.tc-ctl-prnmap-printing)')
        .waitFor({ timeout: 20_000 });

      await expect(map, 'map must fill the window again after closing').toHaveCSS(
        'width',
        `${WINDOW.width}px`,
      );
      await expect(map).toHaveCSS('height', windowedHeight);
    }
  });
});
