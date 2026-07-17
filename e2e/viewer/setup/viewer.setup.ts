import { test as setup, expect, type APIRequestContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  APP_ID,
  BLOCKED_CONTACT_APP_ID,
  BLOCKED_CONTACT_EMAIL,
  BLOCKED_CONTACT_INSTITUTION,
  CONTACT_APP_ID,
  CONTACT_EMAIL,
  CONTACT_INSTITUTION,
  generateViewerPassword,
  ROLE_ID,
  SERVICE_ID,
  TERRITORY_ID,
  uniqueViewerUsername,
  UPSTREAM_PASSWORD,
  UPSTREAM_URL,
  UPSTREAM_USER,
  VIEWER_FIXTURE_FILE,
} from '../fixtures';

const adminHeaders = {
  'X-SITMUN-Client': 'admin',
  'Content-Type': 'application/json',
};

async function createUser(
  request: APIRequestContext,
  options: { username: string; password: string; email: string; firstName: string },
): Promise<{ userId: number; userSelf: string; apiOrigin: string }> {
  const createUser = await request.post('/backend/api/users', {
    headers: adminHeaders,
    data: {
      username: options.username,
      password: options.password,
      administrator: false,
      blocked: false,
      firstName: options.firstName,
      lastName: 'Viewer',
      email: options.email,
    },
  });
  expect(createUser.status(), `create user failed: ${createUser.status()}`).toBe(201);

  const createdUser = (await createUser.json()) as {
    id?: number;
    _links?: { self?: { href?: string } };
  };
  let userId = createdUser.id;
  if (!userId) {
    const location = createUser.headers()['location'];
    const match = location?.match(/\/users\/(\d+)/);
    userId = match ? Number(match[1]) : undefined;
  }
  expect(userId, 'created user id missing').toBeTruthy();

  const userSelf =
    createdUser._links?.self?.href ??
    createUser.headers()['location'] ??
    `http://localhost/api/users/${userId}`;
  const apiOrigin = new URL(userSelf).origin;

  return { userId: userId as number, userSelf, apiOrigin };
}

setup('provision viewer user and secured WMS service', async ({ request }) => {
  await mkdir(path.dirname(VIEWER_FIXTURE_FILE), { recursive: true });

  const login = await request.post('/backend/api/authenticate/admin', {
    data: {
      username: 'admin',
      password: 'admin',
    },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();

  const account = await request.get('/backend/api/account', {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(account.ok(), `admin account check failed: ${account.status()}`).toBeTruthy();

  const username = uniqueViewerUsername();
  const password = generateViewerPassword();

  const loginUser = await createUser(request, {
    username,
    password,
    email: 'e2e-viewer-login@example.com',
    firstName: 'E2E',
  });
  const userId = loginUser.userId;
  const apiOrigin = loginUser.apiOrigin;

  const createConfig = await request.post('/backend/api/user-configurations', {
    headers: adminHeaders,
    data: {
      user: `${apiOrigin}/api/users/${userId}`,
      territory: `${apiOrigin}/api/territories/${TERRITORY_ID}`,
      role: `${apiOrigin}/api/roles/${ROLE_ID}`,
      appliesToChildrenTerritories: false,
    },
  });
  expect(
    createConfig.status(),
    `create user-configuration failed: ${createConfig.status()}`,
  ).toBe(201);

  const makeApplicationPrivate = await request.patch(
    `/backend/api/applications/${APP_ID}`,
    {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: true },
    },
  );
  expect(
    makeApplicationPrivate.ok(),
    `make application private failed: ${makeApplicationPrivate.status()}`,
  ).toBeTruthy();

  const eligiblePoc = await createUser(request, {
    username: uniqueViewerUsername(),
    password: generateViewerPassword(),
    email: CONTACT_EMAIL,
    firstName: 'EligiblePoc',
  });
  const blockedPoc = await createUser(request, {
    username: uniqueViewerUsername(),
    password: generateViewerPassword(),
    email: BLOCKED_CONTACT_EMAIL,
    firstName: 'BlockedPoc',
  });

  for (const [appId, institution, pocUserId] of [
    [CONTACT_APP_ID, CONTACT_INSTITUTION, eligiblePoc.userId],
    [BLOCKED_CONTACT_APP_ID, BLOCKED_CONTACT_INSTITUTION, blockedPoc.userId],
  ] as const) {
    const patchApp = await request.patch(`/backend/api/applications/${appId}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: {
        appPrivate: false,
        responsibleInstitutionName: institution,
      },
    });
    expect(
      patchApp.ok(),
      `patch application ${appId} failed: ${patchApp.status()} ${await patchApp.text()}`,
    ).toBeTruthy();

    const assignCreator = await request.put(
      `/backend/api/applications/${appId}/creator`,
      {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'text/uri-list',
        },
        data: `${apiOrigin}/api/users/${pocUserId}`,
      },
    );
    expect(
      assignCreator.ok(),
      `assign creator for application ${appId} failed: ${assignCreator.status()} ${await assignCreator.text()}`,
    ).toBeTruthy();
  }

  const blockUser = await request.patch(`/backend/api/users/${blockedPoc.userId}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { blocked: true },
  });
  expect(
    blockUser.ok(),
    `block PoC user failed: ${blockUser.status()} ${await blockUser.text()}`,
  ).toBeTruthy();

  const serviceResponse = await request.get(`/backend/api/services/${SERVICE_ID}`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(serviceResponse.ok(), `get service failed: ${serviceResponse.status()}`).toBeTruthy();
  const service = (await serviceResponse.json()) as {
    name: string;
    type: string;
    blocked: boolean;
  };

  const updateService = await request.put(`/backend/api/services/${SERVICE_ID}`, {
    headers: adminHeaders,
    data: {
      name: service.name,
      type: service.type,
      blocked: service.blocked,
      serviceURL: UPSTREAM_URL,
      isProxied: true,
      authenticationMode: 'HTTP Basic authentication',
      user: UPSTREAM_USER,
      password: UPSTREAM_PASSWORD,
    },
  });
  expect(
    updateService.ok(),
    `update service failed: ${updateService.status()}`,
  ).toBeTruthy();

  await writeFile(
    VIEWER_FIXTURE_FILE,
    JSON.stringify(
      {
        username,
        password,
        userId,
        eligiblePocUserId: eligiblePoc.userId,
        blockedPocUserId: blockedPoc.userId,
      },
      null,
      2,
    ),
    'utf8',
  );
});
