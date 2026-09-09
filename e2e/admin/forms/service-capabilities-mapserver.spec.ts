import { test, expect } from '../fixtures';
import { control, gotoCreateForm } from '../helpers/form';

const MAPSERVER_SERVICE_URL =
  'https://pcivil.icgc.cat/ogc/geoservei?map=/opt/idec/dades/pcivil/risc_quimic.map';

const CAPABILITIES_TITLE = 'E2E MapServer Risc Quimic';

const CAPABILITIES_STUB = {
  success: true,
  type: 'OGC:WMS 1.3.0',
  asJson: {
    WMS_Capabilities: {
      version: '1.3.0',
      Service: {
        Title: CAPABILITIES_TITLE,
        Abstract: 'E2E capabilities stub',
      },
      Capability: {
        Layer: {
          CRS: ['EPSG:4326'],
        },
      },
    },
  },
};

async function selectServiceTypeWms(page: import('@playwright/test').Page): Promise<void> {
  const typeSelect = control(page, 'type');
  await typeSelect.scrollIntoViewIfNeeded();
  await typeSelect.locator('.mat-mdc-select-trigger').click({ force: true });
  const option = page.getByRole('option', { name: 'WMS', exact: true });
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await expect(typeSelect.locator('.mat-mdc-select-value-text')).toContainText('WMS');
}

test.describe('Service form MapServer capabilities', () => {
  test('builds GetCapabilities with & when service URL already has ?map=', async ({ page }) => {
    await gotoCreateForm(page, '/#/service/-1/serviceForm', 'name');
    await selectServiceTypeWms(page);
    await control(page, 'serviceURL').fill(MAPSERVER_SERVICE_URL);

    await expect(page.locator('.sitmun-service-form-metadata-button')).toBeVisible();

    await page.route('**/helpers/capabilities**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const requestUrl = new URL(route.request().url());
      const upstreamRaw = requestUrl.searchParams.get('url');
      expect(upstreamRaw, 'helpers/capabilities must send a single url query param').toBeTruthy();

      const questionMarks = (upstreamRaw!.match(/\?/g) ?? []).length;
      expect(questionMarks, `upstream must not use a second ?: ${upstreamRaw}`).toBe(1);

      const upstream = new URL(upstreamRaw!);
      expect(upstream.searchParams.get('map')).toBe(
        '/opt/idec/dades/pcivil/risc_quimic.map',
      );
      expect(upstream.searchParams.get('request')).toBe('GetCapabilities');
      expect(upstream.searchParams.get('service')).toBe('WMS');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(CAPABILITIES_STUB),
      });
    });

    await page.locator('.sitmun-service-form-metadata-button').click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await dialog.locator('button').filter({ has: page.locator('mat-icon', { hasText: 'check' }) }).click();

    await expect(control(page, 'name')).toHaveValue(CAPABILITIES_TITLE, { timeout: 15_000 });
    await expect(control(page, 'description')).toHaveValue('E2E capabilities stub');
  });
});
