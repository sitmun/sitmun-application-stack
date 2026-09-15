import { expect, test } from '@playwright/test';

const STUB = 'http://127.0.0.1:18093';
const FRAME_NAME = 'sitmun-e2e-gfi-embed';

async function nestedFrameUrl(
  page: import('@playwright/test').Page,
  src: string
): Promise<string> {
  await page.evaluate(
    ({ iframeSrc, name }) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('name', name);
      iframe.name = name;
      iframe.style.visibility = 'hidden';
      iframe.src = iframeSrc;
      document.body.appendChild(iframe);
    },
    { iframeSrc: src, name: FRAME_NAME }
  );
  const locator = page.locator(`iframe[name="${FRAME_NAME}"]`);
  await locator.waitFor({ state: 'attached' });
  const handle = await locator.elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) {
    throw new Error(`missing content frame for ${FRAME_NAME}`);
  }
  await frame.waitForLoadState('load');
  return frame.url();
}

test.describe('HTML GFI nested browsing context', () => {
  test('allowed embed commits a cross-origin nested document', async ({ page }) => {
    await page.goto('/');
    await expect(nestedFrameUrl(page, `${STUB}/embed/allow`)).resolves.toBe(`${STUB}/embed/allow`);
  });

  test('X-Frame-Options DENY does not commit the nested document URL', async ({ page }) => {
    await page.goto('/');
    const url = await nestedFrameUrl(page, `${STUB}/embed/deny`);
    expect(url).not.toBe(`${STUB}/embed/deny`);
  });
});
