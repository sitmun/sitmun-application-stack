import { test as base, expect, APIRequestContext } from '@playwright/test';

export type CreatedResource = {
  collection: 'roles' | 'users' | 'territories' | 'tasks' | 'cartographies' | 'trees';
  id: number;
};

type Fixtures = {
  createdResources: CreatedResource[];
};

const ADMIN_HEADERS = {
  'X-SITMUN-Client': 'admin',
};

type HalItem = {
  id?: number;
  _links?: { self?: { href?: string } };
};

function halId(item: HalItem): number | undefined {
  if (typeof item.id === 'number') {
    return item.id;
  }
  const href = item._links?.self?.href;
  const match = href?.match(/\/(\d+)(?:\?|$)/);
  return match ? Number(match[1]) : undefined;
}

async function listEmbedded(
  request: APIRequestContext,
  path: string,
  rel: string,
): Promise<HalItem[]> {
  const response = await request.get(path, { headers: ADMIN_HEADERS });
  if (!response.ok()) {
    return [];
  }
  const body = (await response.json()) as { _embedded?: Record<string, HalItem[]> };
  const items = body._embedded?.[rel];
  return Array.isArray(items) ? items : [];
}

async function unlinkCartographyDependents(
  request: APIRequestContext,
  cartographyId: number,
): Promise<void> {
  const nodes = await listEmbedded(
    request,
    `/backend/api/cartographies/${cartographyId}/treeNodes?size=2000`,
    'tree-nodes',
  );
  for (const node of nodes) {
    const nodeId = halId(node);
    if (nodeId == null) {
      continue;
    }
    await request.delete(`/backend/api/tree-nodes/${nodeId}/cartography`, {
      headers: ADMIN_HEADERS,
    });
  }

  const tasks = await listEmbedded(
    request,
    `/backend/api/tasks?cartography.id=${cartographyId}&size=2000`,
    'tasks',
  );
  for (const task of tasks) {
    const taskId = halId(task);
    if (taskId == null) {
      continue;
    }
    await request.delete(`/backend/api/tasks/${taskId}/cartography`, {
      headers: ADMIN_HEADERS,
    });
  }

  await request.put(`/backend/api/cartographies/${cartographyId}/permissions`, {
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'text/uri-list',
    },
    data: '',
  });
}

async function deleteResource(
  request: APIRequestContext,
  resource: CreatedResource,
): Promise<void> {
  if (resource.collection === 'cartographies') {
    await unlinkCartographyDependents(request, resource.id);
  }
  const response = await request.delete(`/backend/api/${resource.collection}/${resource.id}`, {
    headers: ADMIN_HEADERS,
  });
  if (response.ok() || response.status() === 404) {
    return;
  }
  throw new Error(
    `Cleanup failed for ${resource.collection}/${resource.id}: ${response.status()} ${await response.text()}`,
  );
}

export const test = base.extend<Fixtures>({
  createdResources: async ({ request }, use) => {
    const createdResources: CreatedResource[] = [];
    await use(createdResources);
    for (const resource of [...createdResources].reverse()) {
      await deleteResource(request, resource);
    }
  },
});

export { expect };
