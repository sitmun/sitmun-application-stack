import { test as base, expect, APIRequestContext } from '@playwright/test';

export type CreatedResource = {
  collection: 'roles' | 'users' | 'territories' | 'tasks' | 'cartographies';
  id: number;
};

type Fixtures = {
  createdResources: CreatedResource[];
};

async function deleteResource(
  request: APIRequestContext,
  resource: CreatedResource,
): Promise<void> {
  const response = await request.delete(`/backend/api/${resource.collection}/${resource.id}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
    },
  });
  if (response.ok() || response.status() === 404) {
    return;
  }
  // Referential integrity blocks delete with 422; H2 suite teardown can leave orphans.
  if (resource.collection === 'cartographies' && response.status() === 422) {
    console.warn(
      `Cleanup skipped for cartographies/${resource.id}: ${response.status()} ${await response.text()}`,
    );
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
