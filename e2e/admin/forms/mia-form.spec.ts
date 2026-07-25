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
  addChildMapping,
  addMiaParameter,
  addMiaParameterRow,
  changeChildMappingMiaParam,
  createMiaWithChild,
  expectChildTaskMapping,
  getMiaTaskProperties,
  gotoMiaDetailsTab,
  openMia,
  putMiaTaskProperties,
  saveMiaParameters,
  saveMiaUpdate,
} from '../helpers/mia-form';
import { createPlantilla } from '../helpers/template';

const MIA_CREATE_PATH = '/#/tasksMoreInfoAdvanced/-1/16';
const SEEDED_QUERY_CHILD_ID = 38;
const SEEDED_MIA_PARENT_ID = 42;
const CARTOGRAPHY_SEARCH = 'Toponimia';
const CARTOGRAPHY_OPTION = /Toponimia 1:25\.000/;
const CHILD_TASK_SEARCH = 'Web API direct';
const CHILD_TASK_OPTION = /Web API direct \(template param\)/;
const CHILD_PARAM_LABEL = 'codigo';

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

  test('persists child parameter mapping through reload', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(120_000);
    const { id } = await createMiaWithChild(page, {
      childSearch: CHILD_TASK_SEARCH,
      childOption: CHILD_TASK_OPTION,
      childId: SEEDED_QUERY_CHILD_ID,
    });
    createdResources.push({ collection: 'tasks', id });

    await openMia(page, id);
    const paramLabel = uniqueValue('e2e-map-param');
    const paramValue = uniqueValue('feature');
    await addMiaParameter(page, { label: paramLabel, value: paramValue });
    await addChildMapping(page, {
      miaParamLabel: paramLabel,
      childParamLabel: CHILD_PARAM_LABEL,
    });
    await saveMiaUpdate(page, id);

    await expectChildTaskMapping(request, id, SEEDED_QUERY_CHILD_ID, {
      [CHILD_PARAM_LABEL]: paramValue,
    });

    await openMia(page, id);
    await gotoMiaDetailsTab(page);
    const row = page.locator('.mapping-row').first();
    await expect(row.locator('mat-select').nth(0)).toContainText(paramLabel);
    await expect(row.locator('mat-select').nth(1)).toContainText(CHILD_PARAM_LABEL);
  });

  test('keeps edited mapping after a subsequent Parameters save', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(150_000);
    const { id } = await createMiaWithChild(page, {
      childSearch: CHILD_TASK_SEARCH,
      childOption: CHILD_TASK_OPTION,
      childId: SEEDED_QUERY_CHILD_ID,
    });
    createdResources.push({ collection: 'tasks', id });

    await openMia(page, id);
    const firstLabel = uniqueValue('e2e-map-a');
    const firstValue = uniqueValue('feature-a');
    const secondLabel = uniqueValue('e2e-map-b');
    const secondValue = uniqueValue('feature-b');
    // Add both params in one Parameters save so Details dropdowns see both.
    await addMiaParameterRow(page, { label: firstLabel, value: firstValue });
    await addMiaParameterRow(page, { label: secondLabel, value: secondValue });
    await saveMiaParameters(page, {
      taskId: id,
      request,
      expectedLabels: [firstLabel, secondLabel],
    });
    await addChildMapping(page, {
      miaParamLabel: firstLabel,
      childParamLabel: CHILD_PARAM_LABEL,
    });
    await saveMiaUpdate(page, id);

    await changeChildMappingMiaParam(page, { miaParamLabel: secondLabel });
    // Parameters save must keep the unsaved mapping edit (Maps ahead of properties).
    await addMiaParameter(page, {
      label: uniqueValue('e2e-map-c'),
      value: uniqueValue('feature-c'),
      taskId: id,
      request,
    });

    await expectChildTaskMapping(request, id, SEEDED_QUERY_CHILD_ID, {
      [CHILD_PARAM_LABEL]: secondValue,
    });
  });

  test('drops orphan childTaskParameters keys on save', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(120_000);
    const { id } = await createMiaWithChild(page, {
      childSearch: CHILD_TASK_SEARCH,
      childOption: CHILD_TASK_OPTION,
      childId: SEEDED_QUERY_CHILD_ID,
    });
    createdResources.push({ collection: 'tasks', id });

    await openMia(page, id);
    const paramLabel = uniqueValue('e2e-orphan-param');
    const paramValue = uniqueValue('feature');
    await addMiaParameter(page, { label: paramLabel, value: paramValue });
    await addChildMapping(page, {
      miaParamLabel: paramLabel,
      childParamLabel: CHILD_PARAM_LABEL,
    });
    await saveMiaUpdate(page, id);

    await putMiaTaskProperties(request, id, {
      childTaskParameters: {
        [String(SEEDED_QUERY_CHILD_ID)]: { [CHILD_PARAM_LABEL]: paramValue },
        '99999': { fake: paramValue },
      },
    });

    await openMia(page, id);
    await control(page, 'parentLayout').click();
    await page.getByRole('option', { name: /^(Scroll|Desplaçament|Défilement)$/i }).click();
    await saveMiaUpdate(page, id);

    const properties = await getMiaTaskProperties(request, id);
    const childTaskParameters = properties.childTaskParameters as
      | Record<string, Record<string, string>>
      | undefined;
    expect(childTaskParameters?.[String(SEEDED_QUERY_CHILD_ID)]).toEqual({
      [CHILD_PARAM_LABEL]: paramValue,
    });
    expect(childTaskParameters?.['99999']).toBeUndefined();
  });

  test('disables Add mapping when included child has no parameters', async ({
    page,
    createdResources,
  }) => {
    test.setTimeout(150_000);
    const plantilla = await createPlantilla(page, {
      html: '<p>e2e empty-params plantilla</p>',
    });
    createdResources.push({ collection: 'tasks', id: plantilla.id });

    const { id } = await createMiaWithChild(page, {
      childSearch: plantilla.name,
      childOption: new RegExp(
        `${plantilla.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(ID: ${plantilla.id}\\)`,
      ),
      childId: plantilla.id,
    });
    createdResources.push({ collection: 'tasks', id });

    await openMia(page, id);
    await addMiaParameter(page, {
      label: uniqueValue('e2e-empty-child'),
      value: uniqueValue('feature'),
    });
    await gotoMiaDetailsTab(page);
    await expect(page.locator('.mapping-actions-row button').first()).toBeDisabled();
  });
});
