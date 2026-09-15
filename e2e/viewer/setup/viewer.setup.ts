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
  FEATURE_INFO_TASK_ID,
  FULL_SCREEN_TASK_ID,
  generateViewerPassword,
  LAYER_CATALOG_TASK_ID,
  LEGEND_TASK_ID,
  MENORCA_APP_ID,
  MENORCA_TERRITORY_ID,
  MIA_CONTROL_TASK_ID,
  MIA_PARENT_TASK_ID,
  NAV_BAR_TASK_ID,
  OVERVIEW_MAP_TASK_ID,
  PRINT_MAP_TASK_ID,
  QUERYABLE_LEAF_CARTOGRAPHY_ID,
  SEARCH_TASK_ID,
  QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR,
  QUERYABLE_LEAF_TREE_NODE_DB_ID,
  ROLE_ID,
  SERVICE_ID,
  CCAVALLS_CARTOGRAPHY_ID,
  CCAVALLS_MIA_TASK_ID,
  CCAVALLS_TREE_NODE_DB_ID,
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

type PositionHal = {
  id?: number;
  name?: string;
  organization?: string;
  email?: string;
  createdDate?: string | null;
  territoryId?: number;
  _links?: { self?: { href?: string }; territory?: { href?: string } };
};

function localCivilNoonIso(dayOffset = 0): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    12,
    0,
    0,
  ).toISOString();
}

async function findUserPosition(
  request: APIRequestContext,
  userId: number,
  territoryId: number,
): Promise<PositionHal> {
  const positions = await request.get(
    `/backend/api/users/${userId}/positions?size=50&projection=view`,
    { headers: adminHeaders },
  );
  expect(
    positions.ok(),
    `list positions failed: ${positions.status()} ${await positions.text()}`,
  ).toBeTruthy();
  const body = (await positions.json()) as {
    _embedded?: Record<string, PositionHal[]>;
  };
  const items = Object.values(body._embedded ?? {}).flat();
  const match = items.find(
    (item) =>
      item.territoryId === territoryId ||
      (item._links?.territory?.href ?? '').includes(`/territories/${territoryId}`),
  );
  expect(
    match?._links?.self?.href,
    `position for territory ${territoryId} missing in ${JSON.stringify(body)}`,
  ).toBeTruthy();
  return match as PositionHal;
}

function positionIdOf(match: PositionHal): number {
  const selfHref = match._links?.self?.href;
  const idMatch = selfHref?.match(/\/user-positions\/(\d+)/);
  const positionId = match.id ?? (idMatch ? Number(idMatch[1]) : undefined);
  expect(positionId, 'position id missing').toBeTruthy();
  return positionId as number;
}

async function expireTerritoryPosition(
  request: APIRequestContext,
  userId: number,
  territoryId: number,
): Promise<void> {
  const match = await findUserPosition(request, userId, territoryId);
  const patch = await request.patch(`/backend/api/user-positions/${positionIdOf(match)}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { expirationDate: '2020-01-01T00:00:00.000Z' },
  });
  expect(patch.ok(), `expire position failed: ${patch.status()} ${await patch.text()}`).toBeTruthy();
}

async function setExpirationToday(
  request: APIRequestContext,
  userId: number,
  territoryId: number,
): Promise<void> {
  const match = await findUserPosition(request, userId, territoryId);
  const patch = await request.patch(`/backend/api/user-positions/${positionIdOf(match)}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { expirationDate: localCivilNoonIso(0) },
  });
  expect(
    patch.ok(),
    `set expirationDate to today failed: ${patch.status()} ${await patch.text()}`,
  ).toBeTruthy();
}

async function clearCreatedDate(
  request: APIRequestContext,
  userId: number,
  territoryId: number,
  apiOrigin: string,
): Promise<void> {
  const match = await findUserPosition(request, userId, territoryId);
  const positionId = positionIdOf(match);
  const put = await request.put(`/backend/api/user-positions/${positionId}`, {
    headers: adminHeaders,
    data: {
      user: `${apiOrigin}/api/users/${userId}`,
      territory: `${apiOrigin}/api/territories/${territoryId}`,
      name: match.name ?? 'cargo',
      organization: match.organization ?? 'org',
      email: match.email ?? null,
      createdDate: null,
    },
  });
  expect(put.ok(), `clear createdDate failed: ${put.status()} ${await put.text()}`).toBeTruthy();
  const reloaded = await request.get(`/backend/api/user-positions/${positionId}`, {
    headers: adminHeaders,
  });
  expect(reloaded.ok()).toBeTruthy();
  const body = (await reloaded.json()) as { createdDate?: string | null };
  expect(body.createdDate, 'PUT createdDate: null must stay null').toBeNull();
}

async function grantTerritory(
  request: APIRequestContext,
  apiOrigin: string,
  userId: number,
  territoryId: number,
  appliesToChildrenTerritories = false,
): Promise<void> {
  const createConfig = await request.post('/backend/api/user-configurations', {
    headers: adminHeaders,
    data: {
      user: `${apiOrigin}/api/users/${userId}`,
      territory: `${apiOrigin}/api/territories/${territoryId}`,
      role: `${apiOrigin}/api/roles/${ROLE_ID}`,
      appliesToChildrenTerritories,
    },
  });
  expect(
    createConfig.status(),
    `create user-configuration ter ${territoryId} failed: ${createConfig.status()}`,
  ).toBe(201);
}

async function createTerritory(
  request: APIRequestContext,
  name: string,
): Promise<number> {
  const types = await request.get('/backend/api/territory-types?size=1', {
    headers: adminHeaders,
  });
  expect(types.ok(), `list territory-types failed: ${types.status()}`).toBeTruthy();
  const typeBody = (await types.json()) as {
    _embedded?: Record<string, Array<{ _links?: { self?: { href?: string } } }>>;
  };
  const typeHref = Object.values(typeBody._embedded ?? {}).flat()[0]?._links?.self?.href;
  expect(typeHref, 'territory type href missing').toBeTruthy();
  const created = await request.post('/backend/api/territories', {
    headers: adminHeaders,
    data: {
      name,
      code: name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'e2echild',
      blocked: false,
      territorialAuthorityName: 'E2E',
      territorialAuthorityEmail: 'e2e@example.com',
      type: typeHref,
    },
  });
  if (created.status() !== 201) {
    throw new Error(`create territory failed: ${created.status()} ${await created.text()}`);
  }
  const createdTerritory = (await created.json()) as {
    id?: number;
    _links?: { self?: { href?: string } };
  };
  let territoryId = createdTerritory.id;
  if (!territoryId) {
    const location = created.headers()['location'] ?? createdTerritory._links?.self?.href;
    const match = location?.match(/\/territories\/(\d+)/);
    territoryId = match ? Number(match[1]) : undefined;
  }
  expect(territoryId, 'created territory id missing').toBeTruthy();
  return territoryId as number;
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

  for (const territoryId of [TERRITORY_ID, MENORCA_TERRITORY_ID]) {
    const createConfig = await request.post('/backend/api/user-configurations', {
      headers: adminHeaders,
      data: {
        user: `${apiOrigin}/api/users/${userId}`,
        territory: `${apiOrigin}/api/territories/${territoryId}`,
        role: `${apiOrigin}/api/roles/${ROLE_ID}`,
        appliesToChildrenTerritories: false,
      },
    });
    expect(
      createConfig.status(),
      `create user-configuration ter ${territoryId} failed: ${createConfig.status()}`,
    ).toBe(201);
  }

  const expiryUsername = uniqueViewerUsername();
  const expiryPassword = generateViewerPassword();
  const expiryUser = await createUser(request, {
    username: expiryUsername,
    password: expiryPassword,
    email: 'e2e-viewer-expiry@example.com',
    firstName: 'Expiry',
  });
  for (const territoryId of [TERRITORY_ID, MENORCA_TERRITORY_ID]) {
    await grantTerritory(request, apiOrigin, expiryUser.userId, territoryId);
  }
  await expireTerritoryPosition(request, expiryUser.userId, MENORCA_TERRITORY_ID);

  const destBaseline = process.env.SITMUN_DEST_BASELINE === '1';
  let expirationTodayUsername = 'dest-skip';
  let expirationTodayPassword = 'dest-skip';
  let nullCreatedDateUsername = 'dest-skip';
  let nullCreatedDatePassword = 'dest-skip';
  let childrenUsername = 'dest-skip';
  let childrenPassword = 'dest-skip';
  let parentTerritoryId = TERRITORY_ID;
  let childTerritoryId = MENORCA_TERRITORY_ID;

  if (!destBaseline) {
  const expirationTodayUsernameLive = uniqueViewerUsername();
  const expirationTodayPasswordLive = generateViewerPassword();
  const expirationTodayUser = await createUser(request, {
    username: expirationTodayUsernameLive,
    password: expirationTodayPasswordLive,
    email: 'e2e-viewer-expiration-today@example.com',
    firstName: 'ExpirationToday',
  });
  await grantTerritory(request, apiOrigin, expirationTodayUser.userId, TERRITORY_ID);
  await setExpirationToday(request, expirationTodayUser.userId, TERRITORY_ID);
  expirationTodayUsername = expirationTodayUsernameLive;
  expirationTodayPassword = expirationTodayPasswordLive;

  const nullCreatedDateUsernameLive = uniqueViewerUsername();
  const nullCreatedDatePasswordLive = generateViewerPassword();
  const nullCreatedDateUser = await createUser(request, {
    username: nullCreatedDateUsernameLive,
    password: nullCreatedDatePasswordLive,
    email: 'e2e-viewer-null-created-date@example.com',
    firstName: 'NullCreatedDate',
  });
  await grantTerritory(request, apiOrigin, nullCreatedDateUser.userId, TERRITORY_ID);
  await clearCreatedDate(request, nullCreatedDateUser.userId, TERRITORY_ID, apiOrigin);
  nullCreatedDateUsername = nullCreatedDateUsernameLive;
  nullCreatedDatePassword = nullCreatedDatePasswordLive;

  const enableChildrenAccess = await request.patch(`/backend/api/applications/${APP_ID}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { accessParentTerritory: true, accessChildrenTerritory: true },
  });
  expect(
    enableChildrenAccess.ok(),
    `enable children access failed: ${enableChildrenAccess.status()} ${await enableChildrenAccess.text()}`,
  ).toBeTruthy();

  parentTerritoryId = await createTerritory(request, `e2e-parent-${Date.now()}`);
  childTerritoryId = await createTerritory(request, `e2e-child-${Date.now()}`);
  const linkMembers = await request.put(`/backend/api/territories/${parentTerritoryId}/members`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'text/uri-list',
    },
    data: `${apiOrigin}/api/territories/${childTerritoryId}`,
  });
  expect(
    [200, 204].includes(linkMembers.status()),
    `link territory members failed: ${linkMembers.status()} ${await linkMembers.text()}`,
  ).toBeTruthy();

  childrenUsername = uniqueViewerUsername();
  childrenPassword = generateViewerPassword();
  const childrenUser = await createUser(request, {
    username: childrenUsername,
    password: childrenPassword,
    email: 'e2e-viewer-children@example.com',
    firstName: 'Children',
  });
  await grantTerritory(request, apiOrigin, childrenUser.userId, parentTerritoryId, true);
  }

  const kickedUsername = uniqueViewerUsername();
  const kickedPassword = generateViewerPassword();
  const kickedUser = await createUser(request, {
    username: kickedUsername,
    password: kickedPassword,
    email: 'e2e-viewer-kicked@example.com',
    firstName: 'Kicked',
  });
  for (const territoryId of [TERRITORY_ID, MENORCA_TERRITORY_ID]) {
    await grantTerritory(request, apiOrigin, kickedUser.userId, territoryId);
    await expireTerritoryPosition(request, kickedUser.userId, territoryId);
  }

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
  // sitna.printMap is omitted too; print preview sizing is checked in #160.
  const mapChromeTaskIds = [
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
    FEATURE_INFO_TASK_ID,
    MIA_CONTROL_TASK_ID,
    MIA_PARENT_TASK_ID,
    PRINT_MAP_TASK_ID,
    CCAVALLS_MIA_TASK_ID,
  ];
  for (const territoryId of [TERRITORY_ID, MENORCA_TERRITORY_ID]) {
    for (const taskId of mapChromeTaskIds) {
      const createAvailability = await request.post('/backend/api/task-availabilities', {
        headers: adminHeaders,
        data: {
          task: `${apiOrigin}/api/tasks/${taskId}`,
          territory: `${apiOrigin}/api/territories/${territoryId}`,
        },
      });
      const status = createAvailability.status();
      // May already be seeded in STM_AVAIL_TSK (unique ter+task).
      expect(
        [201, 409].includes(status),
        `create task-availability task ${taskId} ter ${territoryId} failed: ${status} ${await createAvailability.text()}`,
      ).toBeTruthy();
    }
  }

  // Seed STM_TASK 20 carries a `div: "print"` parameter naming a container the
  // viewer never renders, so api-sitna throws while building the control and no
  // print button appears. The seed logo is an external URL; drop both so the print
  // preview is exercised without leaving the local stack (#160).
  const patchPrintTask = await request.patch(`/backend/api/tasks/${PRINT_MAP_TASK_ID}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: {
      properties: {
        parameters: [{ name: 'legend', type: 'object', value: '{"visible":true}' }],
      },
    },
  });
  expect(
    patchPrintTask.ok(),
    `patch print task failed: ${patchPrintTask.status()} ${await patchPrintTask.text()}`,
  ).toBeTruthy();

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

  // queryableActive only — leave active false so Capas does not auto-load on Menorca
  // (solrustic E2E loads the leaf explicitly; avoids stray GFI on other maps).
  await patchTreeNode(CCAVALLS_TREE_NODE_DB_ID, {
    queryableActive: true,
  });
  const patchCcavalls = await request.patch(
    `/backend/api/cartographies/${CCAVALLS_CARTOGRAPHY_ID}`,
    {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: {
        queryableFeatureEnabled: true,
        queryableFeatureAvailable: true,
      },
    },
  );
  expect(
    patchCcavalls.ok(),
    `patch cartography ${CCAVALLS_CARTOGRAPHY_ID} failed: ${patchCcavalls.status()} ${await patchCcavalls.text()}`,
  ).toBeTruthy();

  const makeMenorcaAppPrivate = await request.patch(
    `/backend/api/applications/${MENORCA_APP_ID}`,
    {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: true },
    },
  );
  expect(
    makeMenorcaAppPrivate.ok(),
    `make Menorca app private failed: ${makeMenorcaAppPrivate.status()}`,
  ).toBeTruthy();

  await writeFile(
    VIEWER_FIXTURE_FILE,
    JSON.stringify(
      {
        username,
        password,
        userId,
        expiryUsername,
        expiryPassword,
        expirationTodayUsername,
        expirationTodayPassword,
        nullCreatedDateUsername,
        nullCreatedDatePassword,
        childrenUsername,
        childrenPassword,
        childrenParentTerritoryId: parentTerritoryId,
        childrenChildTerritoryId: childTerritoryId,
        kickedUsername,
        kickedPassword,
        eligiblePocUserId: eligiblePoc.userId,
        blockedPocUserId: blockedPoc.userId,
      },
      null,
      2,
    ),
    'utf8',
  );
});
