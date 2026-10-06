import type { Locator, Page, Request } from '@playwright/test';

import { test, expect } from '../fixtures';
import { control, dismissBlockingOverlays, gotoCreateForm } from '../helpers/form';

const SERVICE_URL = 'http://127.0.0.1:9/wms';

const ACCESS_CHECK_PATH = /\/api\/services\/[^/]+\/access-check$/;

type AccessCheckBody = {
  status: 'up' | 'auth_failed' | 'server_error';
  observer: 'backend';
  elapsedMs: number;
  observedAt: string;
};

type AccessCheckCase = {
  title: string;
  body: AccessCheckBody;
  visibleText: readonly string[];
};

const OBSERVED_AT = '2026-10-05T11:30:00';

const ACCESS_CHECKS: readonly AccessCheckCase[] = [
  {
    title: 'reports up with observer backend and a time',
    body: { status: 'up', observer: 'backend', elapsedMs: 128, observedAt: OBSERVED_AT },
    visibleText: ['Operativo', 'Comprobación', '128 ms', '11:30'],
  },
  {
    title: 'reports auth_failed when the check classifies an upstream 401',
    body: { status: 'auth_failed', observer: 'backend', elapsedMs: 15, observedAt: OBSERVED_AT },
    visibleText: ['Autenticación rechazada', 'Comprobación'],
  },
  {
    title: 'reports server_error when the check classifies an upstream 500',
    body: { status: 'server_error', observer: 'backend', elapsedMs: 15, observedAt: OBSERVED_AT },
    visibleText: ['Error del servidor', 'Comprobación'],
  },
];

function isAccessCheckPost(request: Request): boolean {
  if (request.method() !== 'POST') {
    return false;
  }
  try {
    return ACCESS_CHECK_PATH.test(new URL(request.url()).pathname);
  } catch {
    return false;
  }
}

function isCapabilitiesPost(request: Request): boolean {
  return request.method() === 'POST' && request.url().includes('helpers/capabilities');
}

async function selectServiceTypeWms(page: Page): Promise<void> {
  const typeSelect = control(page, 'type');
  await typeSelect.scrollIntoViewIfNeeded();
  await dismissBlockingOverlays(page);
  // Required-marker span in mdc-notched-outline covers the type mat-select trigger.
  await typeSelect.locator('.mat-mdc-select-trigger').click({ force: true });
  const option = page.getByRole('option', { name: 'WMS', exact: true });
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await expect(typeSelect.locator('.mat-mdc-select-value-text')).toContainText('WMS');
}

async function openWmsServiceForm(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lang', 'es');
  });
  await gotoCreateForm(page, '/#/service/-1/serviceForm', 'name');
  await selectServiceTypeWms(page);
  await control(page, 'serviceURL').fill(SERVICE_URL);
}

async function openAccessProbe(page: Page): Promise<Locator> {
  const probe = page.getByRole('button', { name: 'Probar acceso', exact: true });
  const monitor = page.getByRole('tab', { name: 'Monitorización', exact: true });
  await expect(monitor).toBeVisible();
  await expect(page.getByRole('tab').last()).toContainText('Monitorización');
  await monitor.click();
  await expect(probe).toBeVisible();
  await expect(probe).toBeEnabled();
  return probe;
}

test.describe('Service form access check', () => {
  for (const accessCheck of ACCESS_CHECKS) {
    test(accessCheck.title, async ({ page }) => {
      await openWmsServiceForm(page);
      const probe = await openAccessProbe(page);

      const capabilitiesPosts: string[] = [];
      page.on('request', (request) => {
        if (isCapabilitiesPost(request)) {
          capabilitiesPosts.push(new URL(request.url()).pathname);
        }
      });

      await page.route(
        (url) => ACCESS_CHECK_PATH.test(url.pathname),
        async (route) => {
          expect(route.request().method()).toBe('POST');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(accessCheck.body),
          });
        },
      );

      const accessCheckRequest = page.waitForRequest(isAccessCheckPost);
      await probe.click();
      const request = await accessCheckRequest;
      expect(new URL(request.url()).pathname).toMatch(ACCESS_CHECK_PATH);
      expect(capabilitiesPosts).toEqual([]);

      const panel = page.getByRole('tabpanel').filter({ has: probe });
      for (const text of accessCheck.visibleText) {
        await expect(panel).toContainText(text);
      }
    });
  }
});
