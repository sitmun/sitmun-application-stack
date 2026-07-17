import { test, expect } from '../fixtures';
import {
  control,
  gotoCreateForm,
  saveAndCaptureId,
  saveUpdate,
  touchAndClear,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';

test.describe('Role form', () => {
  test('disables save when name is cleared', async ({ page }) => {
    await gotoCreateForm(page, '/#/role/-1/roleForm', 'name');
    await touchAndClear(page, 'name');
    await expect(page.getByTestId('form-save')).toBeDisabled();
  });

  test('creates and updates a role', async ({ page, createdResources }) => {
    const name = uniqueValue('e2e-role');
    const description = uniqueValue('e2e-role-desc');
    const updatedDescription = uniqueValue('e2e-role-updated');

    await gotoCreateForm(page, '/#/role/-1/roleForm', 'name');
    await control(page, 'name').fill(name);
    await control(page, 'description').fill(description);

    const id = await saveAndCaptureId(page, 'roles');
    createdResources.push({ collection: 'roles', id });

    await page.goto(`/#/role/${id}/roleForm`);
    await waitForFormReady(page, 'name');
    await expect(control(page, 'name')).toHaveValue(name);
    await expect(control(page, 'description')).toHaveValue(description);

    await control(page, 'description').fill(updatedDescription);
    await saveUpdate(page, 'roles', id);

    await page.reload();
    await waitForFormReady(page, 'name');
    await expect(control(page, 'description')).toHaveValue(updatedDescription);
  });
});
