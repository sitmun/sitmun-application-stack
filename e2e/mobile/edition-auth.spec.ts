import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { BACKEND } from './fixtures';
import { loadMobileFixture, mobileAccessToken, mobileTokens } from './helpers';

test.describe('edition mobile authentication', () => {
  test('mobile login returns access_token without cookie; viewer login stays cookie-only', async ({
    request,
  }) => {
    const fixture = await loadMobileFixture();

    const mobile = await request.post(`${BACKEND}/api/authenticate/mobile`, {
      data: { username: fixture.username, password: fixture.password },
    });
    expect(mobile.status(), await mobile.text()).toBe(200);
    const mobileBody = await mobile.json();
    expect(mobileBody.access_token).toBeTruthy();
    expect(mobileBody.token_type).toBe('Bearer');
    expect(mobileBody.expires_in).toBeGreaterThan(0);
    expect(mobileBody.expires_in).toBeGreaterThanOrEqual(3500);
    expect(mobileBody.expires_in).toBeLessThanOrEqual(3700);
    expect(mobileBody.id_token).toBeUndefined();
    expect(mobile.headers()['set-cookie'] ?? '').not.toMatch(/access_token=/);
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/184-mobile-live.json',
      JSON.stringify(
        {
          status: mobile.status(),
          expires_in: mobileBody.expires_in,
          setCookie: mobile.headers()['set-cookie'] ?? '',
        },
        null,
        2,
      ),
    );

    const viewer = await request.post(`${BACKEND}/api/authenticate`, {
      data: { username: 'admin', password: 'admin' },
    });
    expect(viewer.status()).toBe(200);
    expect(await viewer.text()).toBe('');
    expect(viewer.headers()['set-cookie'] ?? '').toMatch(/viewer_access_token=/);

    const admin = await request.post(`${BACKEND}/api/authenticate/admin`, {
      data: { username: 'admin', password: 'admin' },
    });
    expect(admin.status()).toBe(200);
    expect(await admin.text()).toBe('');
    expect(admin.headers()['set-cookie'] ?? '').toMatch(/admin_access_token=/);
  });

  test('bad credentials return 401', async ({ request }) => {
    const fixture = await loadMobileFixture();
    const response = await request.post(`${BACKEND}/api/authenticate/mobile`, {
      data: { username: fixture.username, password: 'wrong-password' },
    });
    expect(response.status()).toBe(401);
  });

  test('mobile login is forbidden when every grant is expired', async ({ request }) => {
    const fixture = await loadMobileFixture();
    const response = await request.post(`${BACKEND}/api/authenticate/mobile`, {
      data: { username: fixture.expiryUsername, password: fixture.expiryPassword },
    });
    expect(response.status(), await response.text()).toBe(403);
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/184-mobile-expired.json',
      JSON.stringify({ status: response.status() }, null, 2),
    );
  });

  test('access_token exchanges for proxy_token and lists only ED apps without mbtilesUrl', async ({
    request,
  }) => {
    const { access_token, proxy_token } = await mobileTokens(request);
    expect(proxy_token).toBeTruthy();
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/refresh-mobile-proxy.json',
      JSON.stringify({ status: 200, hasProxyToken: true }, null, 2),
    );

    const apps = await request.get(`${BACKEND}/api/config/client/application`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(apps.status(), await apps.text()).toBe(200);
    const page = await apps.json();
    expect((page.content ?? []).length).toBeGreaterThan(0);
    for (const app of page.content ?? []) {
      expect(app.type).toBe('ED');
      expect(typeof app.name).toBe('string');
      expect(app.name.trim().length).toBeGreaterThan(0);
      expect(app.config?.mbtilesUrl).toBeUndefined();
    }
  });

  test('mobile access_token cannot call account or admin write APIs', async ({ request }) => {
    const access_token = await mobileAccessToken(request);

    const account = await request.get(`${BACKEND}/api/account`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(account.status()).toBeGreaterThanOrEqual(400);

    const users = await request.get(`${BACKEND}/api/users`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(users.status()).toBeGreaterThanOrEqual(400);
  });

  test('edition Bearer to /refresh does not mint a viewer cookie', async ({ request }) => {
    const access_token = await mobileAccessToken(request);
    const refresh = await request.post(`${BACKEND}/api/authenticate/refresh`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(refresh.status()).toBeGreaterThanOrEqual(400);
    expect(refresh.headers()['set-cookie'] ?? '').not.toMatch(/viewer_access_token=/);
    await mkdir('test-results', { recursive: true });
    await writeFile(
      'test-results/refresh-mobile.json',
      JSON.stringify(
        {
          status: refresh.status(),
          setCookie: refresh.headers()['set-cookie'] ?? '',
        },
        null,
        2,
      ),
    );
  });
});
