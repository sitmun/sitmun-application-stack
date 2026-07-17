import { test as base, expect, APIRequestContext } from '@playwright/test';

export type CreatedResource = {
  collection: 'roles' | 'users' | 'territories';
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
