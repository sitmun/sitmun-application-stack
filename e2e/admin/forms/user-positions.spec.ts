import { test, expect } from '../fixtures';
import {
  ADMIN_HEADERS,
  POSITIONS_TAB,
  createUserViaForm,
  editAltaCell,
  headerTexts,
  openPositions,
  postPosition,
  postThenSetDates,
  putPosition,
  savePositionUpdate,
  saveShot,
} from '../helpers/user-positions';
import { waitForFormReady, uniqueValue } from '../helpers/form';

test.describe('User Positions tab', () => {
  test('shows Alta immediately before Baja', async ({ page, request, createdResources }) => {
    const { id } = await createUserViaForm(page, 'e2epos');
    createdResources.push({ collection: 'users', id });
    await postPosition(request, id);

    await openPositions(page, id);
    const headers = await headerTexts(page);
    const alta = headers.indexOf('Alta');
    const baja = headers.indexOf('Baja');
    expect(alta, `headers=${headers.join('|')}`).toBeGreaterThan(-1);
    expect(baja, `headers=${headers.join('|')}`).toBe(alta + 1);
    expect(headers).not.toContain('Caducidad');
    expect(headers).not.toContain('Expiration');
    await expect(page.locator('app-relation-grid')).toContainText(/Active|Activo/i);

    await saveShot(page, 'admin-positions-review.png');
    await saveShot(page, 'admin-regression.png');
  });

  test('empty Alta shows the unknown-start placeholder', async ({ page, request, createdResources }) => {
    const { id } = await createUserViaForm(page, 'e2enull');
    createdResources.push({ collection: 'users', id });
    const positionId = await postThenSetDates(request, id, { createdDate: '2010-06-01T00:00:00.000Z' });
    await putPosition(request, id, positionId, { createdDate: null });

    await openPositions(page, id);
    await expect(page.locator('app-relation-grid')).toContainText(/Unknown start|Inicio desconocido/i, {
      timeout: 15_000,
    });
    await saveShot(page, 'admin-null-alta.png');
  });

  test('edits Alta and it persists after reload', async ({ page, request, createdResources }) => {
    const { id } = await createUserViaForm(page, 'e2ealta');
    createdResources.push({ collection: 'users', id });
    await postPosition(request, id, { createdDate: '2010-06-01T00:00:00.000Z' });

    await openPositions(page, id);
    await editAltaCell(page, '1995-03-15');
    await savePositionUpdate(page);

    await page.reload();
    await openPositions(page, id);
    await expect(page.locator('app-relation-grid .ag-cell[col-id="createdDate"]').first()).toContainText(
      /1995/,
    );
    await saveShot(page, 'admin-edit-alta.png');
  });

  test('Baja header tooltip states the inclusive last civil day', async ({
    page,
    request,
    createdResources,
  }) => {
    const { id } = await createUserViaForm(page, 'e2ebaja');
    createdResources.push({ collection: 'users', id });
    const today = new Date().toISOString().slice(0, 10);
    await postPosition(request, id, { expirationDate: `${today}T00:00:00.000Z` });

    await openPositions(page, id);
    const bajaHeader = page.locator('.ag-header-cell[col-id="expirationDate"]').first();
    await expect(bajaHeader).toBeVisible();
    await bajaHeader.hover();
    await expect
      .poll(
        async () =>
          (await bajaHeader.getAttribute('title')) ??
          (await bajaHeader.locator('[title]').first().getAttribute('title')),
        { timeout: 8_000 },
      )
      .toMatch(/calendar day|día civil|dia civ/i);
    await saveShot(page, 'admin-baja-today.png');
  });

  test('hides Positions for the built-in public user', async ({ page, request }) => {
    const list = await request.get('/backend/api/users?size=200', { headers: ADMIN_HEADERS });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as {
      _embedded?: { users?: Array<{ id?: number; username?: string }> };
    };
    const publicUser = body._embedded?.users?.find((user) => user.username === 'public');
    expect(publicUser?.id, 'seed public user missing').toBeTruthy();

    await page.goto(`/#/user/${publicUser!.id}/userForm`);
    await waitForFormReady(page, 'username');
    await expect(page.getByRole('tab', { name: POSITIONS_TAB })).toHaveCount(0);
    await saveShot(page, 'admin-public.png');
  });

  test('locale es headers are Alta then Baja', async ({ page, request, createdResources }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'es');
    });
    const { id } = await createUserViaForm(page, 'e2ees');
    createdResources.push({ collection: 'users', id });
    await postPosition(request, id);
    await openPositions(page, id);
    const headers = await headerTexts(page);
    expect(headers.indexOf('Baja'), `headers=${headers.join('|')}`).toBe(headers.indexOf('Alta') + 1);
    expect(headers).not.toContain('Caducidad');
    await saveShot(page, 'admin-es.png');
  });

  test('locale en placeholders resolve', async ({ page, request, createdResources }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'en');
    });
    const { id } = await createUserViaForm(page, 'e2een');
    createdResources.push({ collection: 'users', id });
    await postThenSetDates(request, id, { createdDate: null, expirationDate: null });
    await openPositions(page, id);
    await expect(page.locator('app-relation-grid')).toContainText('Unknown start');
    await expect(page.locator('app-relation-grid')).toContainText('Active');
    await saveShot(page, 'admin-en.png');
  });

  test('pre-2000 Alta still renders in the grid', async ({ page, request, createdResources }) => {
    const { id } = await createUserViaForm(page, 'e2eold');
    createdResources.push({ collection: 'users', id });
    await postThenSetDates(request, id, { createdDate: '1995-06-15T00:00:00.000Z' });
    await openPositions(page, id);
    await expect(page.locator('app-relation-grid .ag-cell[col-id="createdDate"]').first()).toContainText(
      /1995/,
    );
    await saveShot(page, 'admin-old-alta.png');
  });

  test('viewer cannot write Alta through client position', async ({
    page,
    request,
    createdResources,
    playwright,
  }) => {
    const username = uniqueValue('e2evw').replace(/-/g, '').slice(0, 50);
    const password = `Pw${crypto.randomUUID().slice(0, 10)}`;
    const createdUser = await request.post('/backend/api/users', {
      headers: ADMIN_HEADERS,
      data: {
        username,
        password,
        administrator: false,
        blocked: false,
        firstName: 'Vw',
        lastName: 'Pos',
        email: `${username.slice(0, 20)}@ex.com`,
      },
    });
    expect(createdUser.status(), await createdUser.text()).toBe(201);
    const userBody = (await createdUser.json()) as { id?: number };
    const id = userBody.id as number;
    expect(id).toBeGreaterThan(0);
    createdResources.push({ collection: 'users', id });

    const positionId = await postThenSetDates(request, id, { createdDate: '2010-06-01T00:00:00.000Z' });
    const before = await request.get(`/backend/api/user-positions/${positionId}`, {
      headers: ADMIN_HEADERS,
    });
    expect(before.ok()).toBeTruthy();
    const beforeBody = (await before.json()) as { createdDate?: string };
    expect(beforeBody.createdDate).toBeTruthy();

    const viewer = await playwright.request.newContext({ baseURL: 'http://localhost:4300' });
    try {
      const login = await viewer.post('/backend/api/authenticate', { data: { username, password } });
      expect(login.ok(), `viewer login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
      const write = await viewer.post('/backend/api/config/client/territory/position', {
        data: {
          id: positionId,
          name: 'Hacked',
          organization: 'Hacked',
          createdDate: '1999-01-01T00:00:00.000Z',
        },
      });
      expect(
        write.ok() || write.status() === 400 || write.status() === 403,
        `unexpected viewer write status ${write.status()} ${await write.text()}`,
      ).toBeTruthy();
    } finally {
      await viewer.dispose();
    }

    const after = await request.get(`/backend/api/user-positions/${positionId}`, {
      headers: ADMIN_HEADERS,
    });
    expect(after.ok()).toBeTruthy();
    const afterBody = (await after.json()) as { createdDate?: string };
    expect(afterBody.createdDate?.slice(0, 10)).toBe(beforeBody.createdDate?.slice(0, 10));
    await openPositions(page, id);
    await expect(page.locator('app-relation-grid .ag-cell[col-id="createdDate"]').first()).toContainText(
      /2010/,
    );
    await saveShot(page, 'admin-viewer-write.png');
  });

  test('opens a 20-row Positions grid under 3s', async ({ page, request, createdResources }) => {
    const { id } = await createUserViaForm(page, 'e2eperf');
    createdResources.push({ collection: 'users', id });

    for (let i = 0; i < 20; i += 1) {
      await postPosition(request, id, { name: `Cargo ${i}` });
    }

    await page.goto(`/#/user/${id}/userForm`);
    await waitForFormReady(page, 'username');
    const started = Date.now();
    await page.getByRole('tab', { name: POSITIONS_TAB }).click();
    await expect(page.locator('app-relation-grid .ag-center-cols-container .ag-row')).toHaveCount(20, {
      timeout: 15_000,
    });
    const elapsed = Date.now() - started;
    await saveShot(page, 'admin-positions-perf.png');
    expect(elapsed, `Positions tab open ${elapsed}ms`).toBeLessThan(3000);
  });
});
