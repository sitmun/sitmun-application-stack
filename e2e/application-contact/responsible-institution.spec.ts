import { test, expect } from '@playwright/test';
import {
  control,
  saveUpdate,
  uniqueValue,
  waitForFormReady,
} from '../admin/helpers/form';

const VIEWER_URL = 'http://localhost:4400';
const APPLICATION_ID = 2;
const APPLICATION_TITLE = 'SITMUN - Municipal';

test.describe('Responsible institution admin → viewer', () => {
  test('persists institution in admin and shows it in viewer details', async ({
    page,
  }) => {
    const institution = uniqueValue('e2e-institution');

    await page.goto(`/#/application/${APPLICATION_ID}/applicationForm`);
    await waitForFormReady(page, 'name');

    // Seeded app 2 can have an empty required description; fill it so the form can save.
    const description = control(page, 'description');
    if (!(await description.inputValue()).trim()) {
      await description.fill(uniqueValue('e2e-app-desc'));
    }

    const institutionField = control(page, 'responsibleInstitutionName');
    await institutionField.waitFor({ state: 'visible', timeout: 15_000 });
    await institutionField.fill(institution);

    await saveUpdate(page, 'applications', APPLICATION_ID);

    await page.reload();
    await waitForFormReady(page, 'name');
    await expect(control(page, 'responsibleInstitutionName')).toHaveValue(
      institution,
    );

    await page.goto(`${VIEWER_URL}/auth/login`);
    await expect(page.locator('h1')).toBeVisible();

    const dashboardApps = page.waitForResponse((response) => {
      try {
        const pathname = new URL(response.url()).pathname;
        return (
          response.request().method() === 'GET' &&
          pathname === '/backend/api/config/client/dashboard/applications' &&
          response.ok()
        );
      } catch {
        return false;
      }
    });

    await page.getByRole('button', { name: /Acceso público|Public access/i }).click();
    await dashboardApps;
    await expect(page).toHaveURL(/\/public\/dashboard/);

    const card = page
      .locator('mat-card.dashboard-item')
      .filter({ hasText: APPLICATION_TITLE });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole('button', { name: /View details|Ver detalles|Veure detalls|Voir les détails/i }).click();

    await expect(page.locator('#application-responsible-institution')).toContainText(
      institution,
      { timeout: 15_000 },
    );
  });
});
