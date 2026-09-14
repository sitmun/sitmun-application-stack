import { test, expect } from '../admin/fixtures';
import { createPlantilla } from '../admin/helpers/template';
import {
  copyTaskRoles,
  createDocumentExportTask,
  createMiaWithChild,
  ensureMiaViewerAccess,
  uniqueValue,
} from '../admin/helpers/mia-form';
import {
  APP_ID,
  isBackendRequest,
  MIA_PARENT_TASK_ID,
  TERRITORY_ID,
} from '../viewer/fixtures';
import {
  loadQueryableLeafIntoCapas,
  openPublicDashboard,
  simulateGetFeatureInfo,
} from '../viewer/helpers/mia';
import { withViewerPage } from './helpers/viewer-context';
import { expectOverlayContains, exportMiaOverlayPdf } from './helpers/overlay';

test.describe('Public-user MIA render', () => {
  test('public map renders seeded MIA after simulated GFI', async ({
    browser,
    request,
  }) => {
    const makePublic = await request.patch(`/backend/api/applications/${APP_ID}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: false },
    });
    expect(makePublic.ok(), await makePublic.text()).toBeTruthy();

    try {
      await withViewerPage(browser, async (viewer) => {
        await openPublicDashboard(viewer);

        const profile = viewer.waitForResponse(
          (response) =>
            isBackendRequest(
              response,
              `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
              'GET',
            ) && response.ok(),
        );
        await viewer.goto(`/public/map/${APP_ID}/${TERRITORY_ID}`, {
          waitUntil: 'domcontentloaded',
        });
        const profileBody = (await (await profile).json()) as {
          tasks?: Array<{ 'ui-control'?: string; typeId?: number; cartographyId?: string }>;
        };
        expect(
          profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.moreInfoAdvanced'),
        ).toBeTruthy();

        await viewer.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
        await viewer.locator('.tc-tools-panel').evaluate((panel) => {
          panel.classList.remove('tc-collapsed-right');
        });
        await loadQueryableLeafIntoCapas(viewer);

        const render = viewer.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/tasks/template/more-info-advanced/render'),
        );
        await simulateGetFeatureInfo(viewer);
        const renderResponse = await render;
        expect(renderResponse.status(), await renderResponse.text()).toBe(200);
        const json = (await renderResponse.json()) as {
          tasks?: Array<{ taskId?: number }>;
        };
        expect(json.tasks?.some((task) => task.taskId === MIA_PARENT_TASK_ID)).toBeTruthy();

        await expect(
          viewer.locator('.sitmun-mia-popup-overlay.sitmun-mia-popup-visible'),
        ).toBeVisible({ timeout: 15_000 });
        await expect(viewer.locator(`[data-mia-task-id="${MIA_PARENT_TASK_ID}"]`)).toBeVisible({
          timeout: 15_000,
        });
      });
    } finally {
      const restore = await request.patch(`/backend/api/applications/${APP_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/merge-patch+json',
        },
        data: { appPrivate: true },
      });
      expect(restore.ok(), await restore.text()).toBeTruthy();
    }
  });

  test('public overlay download bar exports PDF', async ({
    page,
    browser,
    request,
    createdResources,
  }) => {
    const marker = uniqueValue('PUBPDF');
    const bodyText = `public-pdf-${marker}`;
    const plantilla = await createPlantilla(page, {
      html: `<p data-e2e-public-pdf="${marker}">${bodyText}</p>`,
    });
    createdResources.push({ collection: 'tasks', id: plantilla.id });
    await ensureMiaViewerAccess(request, plantilla.id);
    await copyTaskRoles(request, MIA_PARENT_TASK_ID, plantilla.id);

    const mia = await createMiaWithChild(page, {
      childSearch: plantilla.name,
      childOption: new RegExp(
        `${plantilla.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${plantilla.id}\\)`,
      ),
      childId: plantilla.id,
    });
    createdResources.push({ collection: 'tasks', id: mia.id });
    await ensureMiaViewerAccess(request, mia.id);
    await copyTaskRoles(request, MIA_PARENT_TASK_ID, mia.id);

    const exportTask = await createDocumentExportTask(request);
    createdResources.push({ collection: 'tasks', id: exportTask.id });
    await ensureMiaViewerAccess(request, exportTask.id);
    await copyTaskRoles(request, MIA_PARENT_TASK_ID, exportTask.id);

    const makePublic = await request.patch(`/backend/api/applications/${APP_ID}`, {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/merge-patch+json',
      },
      data: { appPrivate: false },
    });
    expect(makePublic.ok(), await makePublic.text()).toBeTruthy();

    try {
      await withViewerPage(browser, async (viewer) => {
        await openPublicDashboard(viewer);
        const profile = viewer.waitForResponse(
          (response) =>
            isBackendRequest(
              response,
              `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
              'GET',
            ) && response.ok(),
        );
        await viewer.goto(`/public/map/${APP_ID}/${TERRITORY_ID}`, {
          waitUntil: 'domcontentloaded',
        });
        const profileBody = (await (await profile).json()) as {
          tasks?: Array<{ typeId?: number; id?: string; layer?: string }>;
        };
        expect(
          profileBody.tasks?.some(
            (task) => task.typeId === 17 && String(task.id ?? '').includes(String(exportTask.id)),
          ),
          'public profile must include the disposable type-17 task',
        ).toBeTruthy();

        await viewer.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
        await viewer.locator('.tc-tools-panel').evaluate((panel) => {
          panel.classList.remove('tc-collapsed-right');
        });
        await loadQueryableLeafIntoCapas(viewer);

        const render = viewer.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/tasks/template/more-info-advanced/render'),
        );
        await simulateGetFeatureInfo(viewer);
        expect((await render).status()).toBe(200);

        await expectOverlayContains(viewer, { miaName: mia.name, text: bodyText });
        const exportResponse = await exportMiaOverlayPdf(viewer);
        expect(exportResponse.status(), await exportResponse.text()).toBe(200);
        expect(exportResponse.headers()['content-type'] ?? '').toMatch(/application\/pdf/i);
        expect(exportResponse.request().postData() ?? '').toContain('<output>pdf</output>');
      });
    } finally {
      const restore = await request.patch(`/backend/api/applications/${APP_ID}`, {
        headers: {
          'X-SITMUN-Client': 'admin',
          'Content-Type': 'application/merge-patch+json',
        },
        data: { appPrivate: true },
      });
      expect(restore.ok(), await restore.text()).toBeTruthy();
    }
  });
});
