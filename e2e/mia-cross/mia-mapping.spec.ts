import { test, expect } from '../admin/fixtures';
import {
  createMiaWithChild,
  ensureMiaViewerAccess,
  uniqueValue,
} from '../admin/helpers/mia-form';
import {
  loadQueryableLeafIntoCapas,
  loginAndOpenMap,
  simulateGetFeatureInfo,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';
import { expectOverlayContains, waitForMiaRender } from './helpers/overlay';

const SEEDED_QUERY_CHILD_ID = 38;
const CHILD_TASK_SEARCH = 'Web API direct';
const CHILD_TASK_OPTION = /Web API direct \(template param\)/;

async function putMiaMapping(
  request: import('@playwright/test').APIRequestContext,
  miaId: number,
  options: { featureField: string; childParam: string; childTaskId: number },
): Promise<void> {
  const get = await request.get(`/backend/api/tasks/${miaId}`, {
    headers: { 'X-SITMUN-Client': 'admin' },
  });
  expect(get.ok(), await get.text()).toBeTruthy();
  const task = (await get.json()) as {
    name?: string;
    properties?: Record<string, unknown>;
  };
  const put = await request.put(`/backend/api/tasks/${miaId}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/json',
    },
    data: {
      name: task.name,
      properties: {
        ...(task.properties ?? {}),
        moreInfoAdvanced: true,
        parentLayout: (task.properties as { parentLayout?: string } | undefined)?.parentLayout ?? 'tabs',
        childTaskOrderIds: [options.childTaskId],
        parameters: [
          {
            label: 'Feature name',
            value: options.featureField,
            description: 'e2e mapping',
          },
        ],
        childTaskParameters: {
          [String(options.childTaskId)]: {
            [options.childParam]: options.featureField,
          },
        },
      },
    },
  });
  expect(put.ok(), `put mia mapping: ${put.status()} ${await put.text()}`).toBeTruthy();
}

test.describe('MIA parameter mapping', () => {
  test('mapping substitutes feature attr into child URL in overlay', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const mappedValue = uniqueValue('mapped');

    const mia = await createMiaWithChild(page, {
      childSearch: CHILD_TASK_SEARCH,
      childOption: CHILD_TASK_OPTION,
      childId: SEEDED_QUERY_CHILD_ID,
    });
    createdResources.push({ collection: 'tasks', id: mia.id });
    await putMiaMapping(request, mia.id, {
      featureField: 'name',
      childParam: 'codigo',
      childTaskId: SEEDED_QUERY_CHILD_ID,
    });
    await ensureMiaViewerAccess(request, mia.id);

    await withViewerPage(browser, async (viewer) => {
      await loginAndOpenMap(viewer);
      await loadQueryableLeafIntoCapas(viewer);

      const render = waitForMiaRender(viewer);
      await simulateGetFeatureInfo(viewer, { id: 1, name: mappedValue });
      const renderResponse = await render;
      expect(renderResponse.status()).toBe(200);
      expect(JSON.stringify(await renderResponse.json())).toContain(mappedValue);

      await expectOverlayContains(viewer, { miaName: mia.name, text: mappedValue });
    });
  });
});
