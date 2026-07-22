import { test as setup, expect, type APIRequestContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  APP_ID,
  BLOCKED_CONTACT_APP_ID,
  BLOCKED_CONTACT_EMAIL,
  BLOCKED_CONTACT_INSTITUTION,
  CATALOG_LEAF_SERVICE_IDS,
  CONTACT_APP_ID,
  CONTACT_EMAIL,
  CONTACT_INSTITUTION,
  BASEMAP_SELECTOR_TASK_ID,
  FULL_SCREEN_TASK_ID,
  generateViewerPassword,
  LAYER_CATALOG_TASK_ID,
  LEGEND_TASK_ID,
  NAV_BAR_TASK_ID,
  OVERVIEW_MAP_TASK_ID,
  QUERYABLE_LEAF_CARTOGRAPHY_ID,
  SEARCH_TASK_ID,
  QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR,
  QUERYABLE_LEAF_TREE_NODE_DB_ID,
  ROLE_ID,
  SERVICE_ID,
  STREET_VIEW_TASK_ID,
  THREE_D_TASK_ID,
  TERRITORY_ID,
  uniqueViewerUsername,
  UPSTREAM_PASSWORD,
  UPSTREAM_URL,
  UPSTREAM_USER,
  VIEWER_FIXTURE_FILE,
  WORK_LAYER_MANAGER_TASK_ID,
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

  const rewriteServiceToStub = async (serviceId: number) => {
    const serviceResponse = await request.get(`/backend/api/services/${serviceId}`, {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(serviceResponse.ok(), `get service ${serviceId} failed: ${serviceResponse.status()}`).toBeTruthy();
    const service = (await serviceResponse.json()) as {
      name: string;
      type: string;
      blocked: boolean;
    };

    const updateService = await request.put(`/backend/api/services/${serviceId}`, {
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
      `update service ${serviceId} failed: ${updateService.status()}`,
    ).toBeTruthy();
  };

  await rewriteServiceToStub(SERVICE_ID);
  for (const serviceId of CATALOG_LEAF_SERVICE_IDS) {
    await rewriteServiceToStub(serviceId);
  }

  // Profile tasks require territory availability. Seed STM_AVAIL_TSK omits
  // sitna.layerCatalog / sitna.legend / workLayerManager / sitna.basemapSelector
  // and map-chrome nav/fullscreen/streetView/overview needed for #135 checks.
  for (const taskId of [
    LAYER_CATALOG_TASK_ID,
    LEGEND_TASK_ID,
    WORK_LAYER_MANAGER_TASK_ID,
    BASEMAP_SELECTOR_TASK_ID,
    FULL_SCREEN_TASK_ID,
    NAV_BAR_TASK_ID,
    OVERVIEW_MAP_TASK_ID,
    SEARCH_TASK_ID,
    STREET_VIEW_TASK_ID,
    THREE_D_TASK_ID,
  ]) {
    const createAvailability = await request.post('/backend/api/task-availabilities', {
      headers: adminHeaders,
      data: {
        task: `${apiOrigin}/api/tasks/${taskId}`,
        territory: `${apiOrigin}/api/territories/${TERRITORY_ID}`,
      },
    });
    expect(
      createAvailability.status(),
      `create task-availability for task ${taskId} failed: ${createAvailability.status()} ${await createAvailability.text()}`,
    ).toBe(201);
  }

  // Catalog matrix fixtures (#45): radio Ortofotos needs loadData for title activation;
  // clear Infrarrojo load-by-default so title-click selection is observable; enable
  // loadData on a non-radio folder for data-sitmun-load-folder decoration.
  const patchTreeNode = async (id: number, data: Record<string, unknown>) => {
    const response = await request.patch(`/backend/api/tree-nodes/${id}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data,
    });
    expect(
      response.ok(),
      `patch tree-node ${id} failed: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
  };
  await patchTreeNode(2, { loadData: true, radio: true });
  await patchTreeNode(5, { loadData: true });
  await patchTreeNode(7, { loadData: true });
  await patchTreeNode(9, { active: false });
  // GFI catalog marker: node queryableActive + layer queryableFeatureEnabled.
  await patchTreeNode(QUERYABLE_LEAF_TREE_NODE_DB_ID, {
    queryableActive: true,
    metadataURL: 'https://example.com/e2e-layer-meta',
  });
  const patchCartography = await request.patch(
    `/backend/api/cartographies/${QUERYABLE_LEAF_CARTOGRAPHY_ID}`,
    {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: {
        queryableFeatureEnabled: true,
        // Capas #92: profile maxScaleDenominator → virtual WMS MaxScaleDenominator
        maximumScale: QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR,
      },
    },
  );
  expect(
    patchCartography.ok(),
    `patch cartography ${QUERYABLE_LEAF_CARTOGRAPHY_ID} failed: ${patchCartography.status()} ${await patchCartography.text()}`,
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
