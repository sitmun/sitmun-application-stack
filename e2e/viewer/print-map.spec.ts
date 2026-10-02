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
 * CSS. `createPdf` then draws the captured canvas into a pdfmake slot with
 * both dimensions fixed, so a canvas that kept the browser window shape is
 * stretched to fill the page.
 *
 * The viewer component rule for `#mapa` contains an id, so it outweighed those
 * three-class rules. It is now guarded with `:not(.tc-ctl-prnmap-printing)`.
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

/** Widths named in sitmun-viewer-app#182. Tall enough to show the header and the page top. */
const PREVIEW_WIDTHS = [1276, 1600, 1920] as const;
const PREVIEW_WINDOW_HEIGHT = 1080;

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

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

  /**
   * Preview buttons (#182). api-sitna pins `.tc-ctl-prnmap-tools` to the
   * viewport origin. The map starts under the header, so those buttons must
   * sit on the page and leave the header controls clickable.
   */
  test('keeps preview buttons on the page and off the header', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: PREVIEW_WINDOW_HEIGHT });
    await loginAndOpenMap(page);
    await openPrintPanel(page);

    const menu = page.locator('mat-toolbar button').filter({
      has: page.locator('mat-icon', { hasText: 'menu' }),
    });
    const headerButtons = page.locator('mat-toolbar .toolbar-right button');

    for (const width of PREVIEW_WIDTHS) {
      await page.setViewportSize({ width, height: PREVIEW_WINDOW_HEIGHT });

      for (const format of PAGE_FORMATS) {
        const label = `${format.orientation} ${format.size.toUpperCase()} at ${width}px`;

        await page.selectOption('#print-design', format.orientation);
        await page.selectOption('#print-size', format.size);
        await page.locator('#tc-slot-print sitna-button.tc-ctl-prnmap-btn').click();
        const map = page.locator(
          `#mapa.tc-ctl-prnmap-printing.tc-ctl-prnmap-${format.orientation}-${format.size}`,
        );
        await map.waitFor({ timeout: 40_000 });

        const toolsBox = await page.locator('.tc-ctl-prnmap-tools').boundingBox();
        const headerBox = await page.locator('mat-toolbar').boundingBox();
        const mapBox = await map.boundingBox();
        expect(toolsBox, `${label} tools`).not.toBeNull();
        expect(headerBox, `${label} header`).not.toBeNull();
        expect(mapBox, `${label} map`).not.toBeNull();

        expect(overlaps(toolsBox!, headerBox!), `${label} tools overlap the header`).toBe(
          false,
        );

        const buttonCount = await headerButtons.count();
        for (let index = 0; index < buttonCount; index++) {
          const buttonBox = await headerButtons.nth(index).boundingBox();
          expect(buttonBox, `${label} header button ${index}`).not.toBeNull();
          expect(
            overlaps(toolsBox!, buttonBox!),
            `${label} tools overlap a header button`,
          ).toBe(false);
        }

        expect(Math.abs(toolsBox!.y - mapBox!.y), `${label} tools sit on the page top`).toBeLessThan(
          12,
        );
        const rightGap = mapBox!.x + mapBox!.width - (toolsBox!.x + toolsBox!.width);
        expect(rightGap, `${label} tools stay inside the page`).toBeGreaterThanOrEqual(0);
        expect(rightGap, `${label} tools sit at the page's right edge`).toBeLessThan(32);

        await menu.click();
        await expect(page.getByRole('menu'), `${label} header menu opens`).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('menu')).toBeHidden();

        await page.locator('.tc-ctl-prnmap-btn-close').click();
        await page.locator('#mapa:not(.tc-ctl-prnmap-printing)').waitFor({ timeout: 20_000 });
      }
    }
  });

  /**
   * Portrait A4 cutoff (#181). The page is 1034px under the header, and a short
   * window clips it. Reloading after each resize matters. A resize of an
   * already laid-out map stretches the preview and hides the cutoff.
   */
  test('scrolls a portrait A4 page that is taller than the window', async ({ page }) => {
    const heights = [650, 800, 960, 1080] as const;
    await page.setViewportSize({ width: 1276, height: heights[0] });
    await loginAndOpenMap(page);

    for (const height of heights) {
      await page.setViewportSize({ width: 1276, height });
      await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.locator('#tc-slot-print').waitFor({ state: 'attached', timeout: 90_000 });

      const panel = page.locator('.tc-left-panel');
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.locator('#tools-tab').click();
        const collapsed = await panel.evaluate((element) =>
          element.classList.contains('tc-collapsed-left'),
        );
        if (!collapsed) {
          break;
        }
      }
      await expect(panel).not.toHaveClass(/tc-collapsed-left/);
      await page.locator('#tc-slot-print > h2').click();
      await expect(page.locator('#tc-slot-print')).not.toHaveClass(/tc-collapsed/);

      await page.selectOption('#print-design', 'portrait');
      await page.selectOption('#print-size', 'a4');
      await page.locator('#tc-slot-print sitna-button.tc-ctl-prnmap-btn').click();
      const map = page.locator('#mapa.tc-ctl-prnmap-printing.tc-ctl-prnmap-portrait-a4');
      await map.waitFor({ timeout: 40_000 });
      await expect(map, `portrait A4 at ${height}px keeps the page height`).toHaveCSS(
        'height',
        '1034px',
      );

      const before = await map.boundingBox();
      expect(before, `portrait A4 at ${height}px`).not.toBeNull();
      const beforeBottom = before!.y + before!.height;
      expect(beforeBottom, `portrait A4 at ${height}px starts past the window`).toBeGreaterThan(
        height,
      );

      let after = before!;
      for (let step = 0; step < 12; step++) {
        if (after.y + after.height <= height + 1) {
          break;
        }
        const marginX = Math.max(after.x - 30, 8);
        await page.mouse.move(marginX, Math.min(height / 2, height - 40));
        await page.mouse.wheel(0, 500);
        const next = await map.boundingBox();
        expect(next, `portrait A4 at ${height}px while wheeling`).not.toBeNull();
        after = next!;
      }

      expect(
        after.y + after.height,
        `portrait A4 at ${height}px bottom is inside the window`,
      ).toBeLessThanOrEqual(height + 1);
      expect(after.y, `portrait A4 at ${height}px moves up`).toBeLessThan(before!.y);
    }
  });
});
