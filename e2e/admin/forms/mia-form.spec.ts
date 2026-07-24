import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  saveUpdate,
  selectAutocompleteOption,
  selectFirstMatOption,
  touchAndClear,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';
import {
  addMiaParameter,
  createMiaWithChild,
  openMia,
} from '../helpers/mia-form';

const MIA_CREATE_PATH = '/#/tasksMoreInfoAdvanced/-1/16';
const SEEDED_QUERY_CHILD_ID = 38;
const SEEDED_MIA_PARENT_ID = 42;
const CARTOGRAPHY_SEARCH = 'Toponimia';
const CARTOGRAPHY_OPTION = /Toponimia 1:25\.000/;
const CHILD_TASK_SEARCH = 'Web API direct';
const CHILD_TASK_OPTION = /Web API direct \(template param\)/;

test.describe('MIA form', () => {
  test('disables save when name is cleared', async ({ page }) => {
    await gotoCreateForm(page, MIA_CREATE_PATH, 'name');
    await touchAndClear(page, 'name');
    await expect(page.getByTestId('form-save')).toBeDisabled();
  });

  test('creates and updates a MIA parent with included query child', async ({
    page,
    createdResources,
  }) => {
    const name = uniqueValue('e2e-mia');

    await gotoCreateForm(page, MIA_CREATE_PATH, 'name');
    await control(page, 'name').fill(name);
    await selectFirstMatOption(page, 'taskGroupId');
    await selectAutocompleteOption(
      page,
      page.getByRole('combobox', {
        name: /Cartography used|Cartografia utilitzada|Cartografía utilizada|Cartographie utilisée/i,
      }),
      CARTOGRAPHY_SEARCH,
      CARTOGRAPHY_OPTION,
    );
    await control(page, 'parentLayout').click();
    await page.getByRole('option', { name: /^(Tabs|Pestanyes|Pestañas|Onglets|Pestanhes)$/i }).click();

    await selectAutocompleteOption(
      page,
      page.getByRole('combobox', {
        name: /Add task|Afegir tasca|Añadir tarea|Ajouter une tâche/i,
      }),
      CHILD_TASK_SEARCH,
      CHILD_TASK_OPTION,
    );
    await expect(page.locator('.included-task-id')).toContainText(
      `ID: ${SEEDED_QUERY_CHILD_ID}`,
    );

    const id = await saveAndCaptureId(page, 'tasks');
    createdResources.push({ collection: 'tasks', id });

    await page.goto(`/#/tasksMoreInfoAdvanced/${id}/16`);
    await waitForFormReady(page, 'name');
    await expect(control(page, 'name')).toHaveValue(name);
    await expect(control(page, 'parentLayout').locator('.mat-mdc-select-value-text')).toContainText(
      /Tabs|Pestanyes|Pestañas|Onglets|Pestanhes/i,
    );
    await expect(page.locator('.included-task-id')).toContainText(
      `ID: ${SEEDED_QUERY_CHILD_ID}`,
    );

    await control(page, 'parentLayout').click();
    await page.getByRole('option', { name: /^(Scroll|Desplaçament|Défilement)$/i }).click();
    await saveUpdate(page, 'tasks', id);

    await page.reload();
    await waitForFormReady(page, 'name');
    await expect(control(page, 'parentLayout').locator('.mat-mdc-select-value-text')).toContainText(
      /Scroll|Desplaçament|Défilement/i,
    );
    await expect(page.locator('.included-task-id')).toContainText(
      `ID: ${SEEDED_QUERY_CHILD_ID}`,
    );
  });

  test('opens seeded MIA via deep tasks/:id/16 route', async ({ page }) => {
    await page.goto(`/#/tasks/${SEEDED_MIA_PARENT_ID}/16`);
    await waitForFormReady(page, 'name');
    await expect(control(page, 'name')).toBeVisible();
  });

  test('exposes cartography open-in-new and Parameters relation-grid add+reload', async ({
    page,
    createdResources,
  }) => {
    test.setTimeout(90_000);
    const { id } = await createMiaWithChild(page, {
      childSearch: CHILD_TASK_SEARCH,
      childOption: CHILD_TASK_OPTION,
      childId: SEEDED_QUERY_CHILD_ID,
    });
    createdResources.push({ collection: 'tasks', id });

    await openMia(page, id);

    const cartographyOpen = page.locator('a.related-entity-open-link[href*="/layers/"]');
    await expect(cartographyOpen).toBeVisible();
    await expect(cartographyOpen).toHaveAttribute('target', '_blank');
    await expect(cartographyOpen).toHaveAttribute('href', /layers\/\d+\/layersForm/);

    const paramLabel = uniqueValue('e2e-mia-param');
    const paramValue = uniqueValue('feature');
    await addMiaParameter(page, { label: paramLabel, value: paramValue });

    await page.reload();
    await waitForFormReady(page, 'name');
    await page.getByRole('tab', { name: /Parameters|Paràmetres|Parámetros|Paramètres/i }).click();
    const parametersGrid = page.locator('app-relation-grid');
    await expect(parametersGrid).toBeVisible();
    await expect(parametersGrid.locator('app-data-grid')).toBeVisible();
    await expect(parametersGrid).toContainText(paramLabel, {
      timeout: 15_000,
    });
  });

  test('ADMIN more-info-advanced render returns seeded parent', async ({ request }) => {
    const response = await request.post('/backend/api/tasks/template/more-info-advanced/render', {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: {
        appId: 1,
        terId: 1,
        miaTaskIds: [SEEDED_MIA_PARENT_ID],
        parameters: {},
      },
    });

    expect(
      response.status(),
      `render failed: ${response.status()} ${await response.text()}`,
    ).toBe(200);

    const json = (await response.json()) as {
      tasks?: Array<{ taskId?: number; title?: string; html?: string }>;
    };
    expect(json.tasks?.length).toBeGreaterThan(0);
    expect(json.tasks?.some((task) => task.taskId === SEEDED_MIA_PARENT_ID)).toBeTruthy();
  });
});
