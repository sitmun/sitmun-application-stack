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

test.describe('User form', () => {
  test('disables save when username is cleared', async ({ page }) => {
    await gotoCreateForm(page, '/#/user/-1/userForm', 'username');
    await touchAndClear(page, 'username');
    await expect(page.getByTestId('form-save')).toBeDisabled();
  });

  test('creates and updates a user', async ({ page, createdResources }) => {
    const username = uniqueValue('e2euser').replace(/-/g, '').slice(0, 50);
    const firstName = uniqueValue('e2e-fn');

    await gotoCreateForm(page, '/#/user/-1/userForm', 'username');
    await control(page, 'username').fill(username);

    const id = await saveAndCaptureId(page, 'users');
    createdResources.push({ collection: 'users', id });

    await page.goto(`/#/user/${id}/userForm`);
    await waitForFormReady(page, 'username');
    await expect(control(page, 'username')).toHaveValue(username);

    await control(page, 'firstName').fill(firstName);
    await saveUpdate(page, 'users', id);

    await page.reload();
    await waitForFormReady(page, 'username');
    await expect(control(page, 'firstName')).toHaveValue(firstName);
  });
});
