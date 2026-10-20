import { expect, test } from '../fixtures';
import { control, dismissBlockingOverlays, gotoCreateForm } from '../helpers/form';

test.describe('Service form type list', () => {
  test('offers only WMS, WFS, and WMTS', async ({ page }) => {
    await gotoCreateForm(page, '/#/service/-1/serviceForm', 'name');
    const typeSelect = control(page, 'type');
    await typeSelect.scrollIntoViewIfNeeded();
    await dismissBlockingOverlays(page);
    await typeSelect.locator('.mat-mdc-select-trigger').click({ force: true });
    const options = page.getByRole('option');
    await options.first().waitFor({ state: 'visible', timeout: 15_000 });
    const names = (await options.allTextContents())
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .sort();
    expect(names).toEqual(['WFS', 'WMS', 'WMTS']);
  });
});
