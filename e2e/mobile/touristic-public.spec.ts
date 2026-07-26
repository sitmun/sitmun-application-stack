import { expect, test } from '@playwright/test';
import { BACKEND, TOURISTIC_APP_ID } from './fixtures';

test.describe('touristic public client configuration', () => {
  test('anonymous client lists touristic applications without tokens', async ({ request }) => {
    const apps = await request.get(`${BACKEND}/api/config/client/application`);
    expect(apps.status(), await apps.text()).toBe(200);
    const page = await apps.json();
    const touristic = (page.content ?? []).filter((app: { type?: string }) => app.type === 'T');
    expect(touristic.length).toBeGreaterThan(0);
    expect(touristic.some((app: { id?: number }) => app.id === TOURISTIC_APP_ID)).toBeTruthy();
  });

  test('anonymous profile for private application is denied', async ({ request }) => {
    const adminLogin = await request.post(`${BACKEND}/api/authenticate/admin`, {
      data: { username: 'admin', password: 'admin' },
    });
    expect(adminLogin.ok()).toBeTruthy();

    const patch = await request.patch(`${BACKEND}/api/applications/${TOURISTIC_APP_ID}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: true },
    });
    expect(patch.ok(), await patch.text()).toBeTruthy();

    const profile = await request.get(
      `${BACKEND}/api/config/client/profile/${TOURISTIC_APP_ID}/1`,
    );
    expect(profile.status()).toBe(403);

    const restore = await request.patch(`${BACKEND}/api/applications/${TOURISTIC_APP_ID}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: false },
    });
    expect(restore.ok()).toBeTruthy();
  });
});
