import { expect, test as setup, type APIRequestContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  EDITION_APP_ID,
  EDITION_ROLE_ID,
  EDITION_TERRITORY_ID,
  generateEditionPassword,
  MOBILE_FIXTURE_FILE,
  TOURISTIC_APP_ID,
  uniqueEditionUsername,
  WMTS_LAYER_ID,
  WMTS_SERVICE_ID,
  WMTS_UPSTREAM_URL,
} from '../fixtures';

const adminHeaders = {
  'X-SITMUN-Client': 'admin',
  'Content-Type': 'application/json',
};

async function createEditionUser(
  request: APIRequestContext,
  options: { username: string; password: string; email: string },
): Promise<{ userId: number; apiOrigin: string }> {
  const createUser = await request.post('/backend/api/users', {
    headers: adminHeaders,
    data: {
      username: options.username,
      password: options.password,
      administrator: false,
      blocked: false,
      firstName: 'E2E',
      lastName: 'Edition',
      email: options.email,
    },
  });
  expect(createUser.status(), `create user failed: ${createUser.status()}`).toBe(201);
  const created = (await createUser.json()) as {
    id?: number;
    _links?: { self?: { href?: string } };
  };
  let userId = created.id;
  if (!userId) {
    const location = createUser.headers()['location'];
    const match = location?.match(/\/users\/(\d+)/);
    userId = match ? Number(match[1]) : undefined;
  }
  expect(userId, 'created user id missing').toBeTruthy();
  const userSelf =
    created._links?.self?.href ??
    createUser.headers()['location'] ??
    `http://localhost/api/users/${userId}`;
  return { userId: userId as number, apiOrigin: new URL(userSelf).origin };
}

async function expireTerritoryPosition(
  request: APIRequestContext,
  userId: number,
  territoryId: number,
): Promise<void> {
  const positions = await request.get(
    `/backend/api/users/${userId}/positions?size=50&projection=view`,
    { headers: adminHeaders },
  );
  expect(
    positions.ok(),
    `list positions failed: ${positions.status()} ${await positions.text()}`,
  ).toBeTruthy();
  const body = (await positions.json()) as {
    _embedded?: Record<
      string,
      Array<{
        id?: number;
        territoryId?: number;
        _links?: { self?: { href?: string }; territory?: { href?: string } };
      }>
    >;
  };
  const items = Object.values(body._embedded ?? {}).flat();
  const match = items.find(
    (item) =>
      item.territoryId === territoryId ||
      (item._links?.territory?.href ?? '').includes(`/territories/${territoryId}`),
  );
  const selfHref = match?._links?.self?.href;
  expect(selfHref, `position for territory ${territoryId} missing`).toBeTruthy();
  const idMatch = selfHref?.match(/\/user-positions\/(\d+)/);
  const positionId = match?.id ?? (idMatch ? Number(idMatch[1]) : undefined);
  expect(positionId, 'position id missing').toBeTruthy();
  const patch = await request.patch(`/backend/api/user-positions/${positionId}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { expirationDate: '2020-01-01T00:00:00.000Z' },
  });
  expect(patch.ok(), `expire position failed: ${patch.status()} ${await patch.text()}`).toBeTruthy();
}

setup('provision edition mobile ED application and user', async ({ request }) => {
  await mkdir(path.dirname(MOBILE_FIXTURE_FILE), { recursive: true });

  const login = await request.post('/backend/api/authenticate/admin', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();

  const patchApp = await request.patch(`/backend/api/applications/${EDITION_APP_ID}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { type: 'ED', appPrivate: false, title: null },
  });
  expect(patchApp.ok(), `patch application type failed: ${patchApp.status()}`).toBeTruthy();

  const serviceResponse = await request.get(`/backend/api/services/${WMTS_SERVICE_ID}`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(serviceResponse.ok(), `get service failed: ${serviceResponse.status()}`).toBeTruthy();
  const service = (await serviceResponse.json()) as {
    name: string;
    type: string;
    blocked: boolean;
  };

  const updateService = await request.put(`/backend/api/services/${WMTS_SERVICE_ID}`, {
    headers: adminHeaders,
    data: {
      name: service.name,
      type: service.type,
      blocked: service.blocked,
      serviceURL: WMTS_UPSTREAM_URL,
      isProxied: true,
      authenticationMode: null,
    },
  });
  expect(
    updateService.ok(),
    `update WMTS service failed: ${updateService.status()} ${await updateService.text()}`,
  ).toBeTruthy();

  const username = uniqueEditionUsername();
  const password = generateEditionPassword();
  const loginUser = await createEditionUser(request, {
    username,
    password,
    email: 'e2e-edition@example.com',
  });
  const userId = loginUser.userId;
  const apiOrigin = loginUser.apiOrigin;

  const createConfig = await request.post('/backend/api/user-configurations', {
    headers: adminHeaders,
    data: {
      user: `${apiOrigin}/api/users/${userId}`,
      territory: `${apiOrigin}/api/territories/${EDITION_TERRITORY_ID}`,
      role: `${apiOrigin}/api/roles/${EDITION_ROLE_ID}`,
      appliesToChildrenTerritories: false,
    },
  });
  expect(createConfig.status(), `create user-configuration failed: ${createConfig.status()}`).toBe(
    201,
  );

  const expiryUsername = uniqueEditionUsername();
  const expiryPassword = generateEditionPassword();
  const expiryUser = await createEditionUser(request, {
    username: expiryUsername,
    password: expiryPassword,
    email: 'e2e-edition-expiry@example.com',
  });
  const expiryConfig = await request.post('/backend/api/user-configurations', {
    headers: adminHeaders,
    data: {
      user: `${apiOrigin}/api/users/${expiryUser.userId}`,
      territory: `${apiOrigin}/api/territories/${EDITION_TERRITORY_ID}`,
      role: `${apiOrigin}/api/roles/${EDITION_ROLE_ID}`,
      appliesToChildrenTerritories: false,
    },
  });
  expect(
    expiryConfig.status(),
    `create expiry user-configuration failed: ${expiryConfig.status()}`,
  ).toBe(201);
  await expireTerritoryPosition(request, expiryUser.userId, EDITION_TERRITORY_ID);

  // Seed touristic app 6 has no availableRoles; attach role 1 and keep it public so
  // the anonymous `public` principal can list type T applications.
  const patchTouristic = await request.patch(`/backend/api/applications/${TOURISTIC_APP_ID}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { appPrivate: false },
  });
  expect(
    patchTouristic.ok(),
    `patch touristic app failed: ${patchTouristic.status()} ${await patchTouristic.text()}`,
  ).toBeTruthy();

  const assignTouristicRole = await request.put(
    `/backend/api/applications/${TOURISTIC_APP_ID}/availableRoles`,
    {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'text/uri-list',
      },
      data: `${apiOrigin}/api/roles/${EDITION_ROLE_ID}`,
    },
  );
  expect(
    assignTouristicRole.ok(),
    `assign touristic role failed: ${assignTouristicRole.status()} ${await assignTouristicRole.text()}`,
  ).toBeTruthy();

  await writeFile(
    MOBILE_FIXTURE_FILE,
    JSON.stringify(
      {
        username,
        password,
        expiryUsername,
        expiryPassword,
        appId: EDITION_APP_ID,
        territoryId: EDITION_TERRITORY_ID,
        serviceId: WMTS_SERVICE_ID,
        layerId: WMTS_LAYER_ID,
      },
      null,
      2,
    ),
    'utf8',
  );
});
