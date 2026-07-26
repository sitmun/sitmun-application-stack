import { expect, test as setup } from '@playwright/test';
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
    data: { type: 'ED', appPrivate: false },
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

  const createUser = await request.post('/backend/api/users', {
    headers: adminHeaders,
    data: {
      username,
      password,
      administrator: false,
      blocked: false,
      firstName: 'E2E',
      lastName: 'Edition',
      email: 'e2e-edition@example.com',
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
  expect(userId).toBeTruthy();

  const userSelf =
    created._links?.self?.href ??
    createUser.headers()['location'] ??
    `http://localhost/api/users/${userId}`;
  const apiOrigin = new URL(userSelf).origin;

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
