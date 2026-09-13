import { type APIRequestContext, type Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  control,
  dismissBlockingOverlays,
  gotoCreateForm,
  saveAndCaptureId,
  uniqueValue,
  waitForFormReady,
} from '../helpers/form';

const ADMIN_HEADERS = {
  'X-SITMUN-Client': 'admin',
};

const SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#f00"/></svg>';

const SVG_UPLOAD = {
  name: 'icon.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(SVG_MARKUP),
};

function expectSvgDataUri(value: string | null | undefined, label: string): void {
  expect(value, label).toMatch(/^data:image\/svg\+xml;base64,/);
}

async function selectTouristicType(page: Page): Promise<void> {
  await control(page, 'type').click();
  const option = page.getByRole('option', { name: /tourist/i }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await expect(control(page, 'type').locator('.mat-mdc-select-value-text')).not.toBeEmpty();
}

async function uploadSvg(fileInput: ReturnType<Page['locator']>): Promise<void> {
  await expect(fileInput).toHaveAttribute('accept', /\.svg/i, { timeout: 15_000 });
  await fileInput.setInputFiles(SVG_UPLOAD);
}

async function storedImage(
  request: APIRequestContext,
  collection: 'trees' | 'tree-nodes',
  id: number,
): Promise<string> {
  const response = await request.get(`/backend/api/${collection}/${id}`, {
    headers: ADMIN_HEADERS,
  });
  expect(response.ok(), `GET ${collection}/${id}: ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as { image?: string };
  return body.image ?? '';
}

async function createTouristicTreeWithMenu(
  request: APIRequestContext,
  treeName: string,
  menuName: string,
  childName: string,
): Promise<{ treeId: number; menuId: number }> {
  const treeResponse = await request.post('/backend/api/trees', {
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'application/json',
    },
    data: { name: treeName, type: 'touristic' },
  });
  expect(
    treeResponse.ok(),
    `POST trees: ${treeResponse.status()} ${await treeResponse.text()}`,
  ).toBeTruthy();
  const tree = (await treeResponse.json()) as { id: number };
  expect(typeof tree.id).toBe('number');

  const menuResponse = await request.post('/backend/api/tree-nodes', {
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      name: menuName,
      type: 'menu',
      tree: `http://localhost:18080/api/trees/${tree.id}`,
    },
  });
  expect(
    menuResponse.ok(),
    `POST menu node: ${menuResponse.status()} ${await menuResponse.text()}`,
  ).toBeTruthy();
  const menu = (await menuResponse.json()) as { id: number };
  expect(typeof menu.id).toBe('number');

  const childResponse = await request.post('/backend/api/tree-nodes', {
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'application/json',
    },
    data: {
      name: childName,
      type: 'list',
      tree: `http://localhost:18080/api/trees/${tree.id}`,
      parent: `http://localhost:18080/api/tree-nodes/${menu.id}`,
    },
  });
  expect(
    childResponse.ok(),
    `POST list child: ${childResponse.status()} ${await childResponse.text()}`,
  ).toBeTruthy();

  return { treeId: tree.id, menuId: menu.id };
}

test.describe('Tree SVG images', () => {
  test('persists a Details-tab SVG local file without rasterizing', async ({
    page,
    request,
    createdResources,
  }) => {
    const name = uniqueValue('e2e-tree-svg');
    await gotoCreateForm(page, '/#/trees/-1/treesForm', 'name');
    await control(page, 'name').fill(name);
    await selectTouristicType(page);

    const fileInput = page.locator('form input[type="file"]').first();
    await uploadSvg(fileInput);
    await expect(page.locator('#treeImgPreview')).toHaveAttribute(
      'src',
      /^data:image\/svg\+xml/,
    );

    const id = await saveAndCaptureId(page, 'trees');
    createdResources.push({ collection: 'trees', id });
    expectSvgDataUri(await storedImage(request, 'trees', id), 'POST persist');

    await page.goto(`/#/trees/${id}/treesForm`);
    await waitForFormReady(page, 'name');
    await expect(page.locator('#treeImgPreview')).toHaveAttribute(
      'src',
      /^data:image\/svg\+xml/,
    );
    expectSvgDataUri(await storedImage(request, 'trees', id), 'reload persist');
  });

  test('persists a touristic menu-node SVG local file without rasterizing', async ({
    page,
    request,
    createdResources,
  }) => {
    test.setTimeout(90_000);
    const treeName = uniqueValue('e2e-tree-node-svg');
    const menuName = uniqueValue('e2e-menu-svg');
    const childName = uniqueValue('e2e-list-svg');
    const { treeId, menuId } = await createTouristicTreeWithMenu(
      request,
      treeName,
      menuName,
      childName,
    );
    createdResources.push({ collection: 'trees', id: treeId });

    await page.goto(`/#/trees/${treeId}/treesForm`);
    await waitForFormReady(page, 'name');
    await page.locator('.mat-mdc-tab').nth(1).click();

    const menuRow = page.locator(`mat-tree-node[data-node-id="${menuId}"]`);
    await menuRow.waitFor({ state: 'visible', timeout: 20_000 });
    await menuRow.click();

    const appearance = page
      .locator('mat-expansion-panel-header')
      .filter({ has: page.locator('mat-icon', { hasText: 'image' }) })
      .first();
    await appearance.waitFor({ state: 'visible', timeout: 15_000 });
    if ((await appearance.getAttribute('aria-expanded')) !== 'true') {
      await appearance.click();
    }

    const fileInput = page.locator('.detail-panel input[type="file"]');
    await uploadSvg(fileInput);
    await expect(page.locator('#treeNodeImgPreview')).toHaveAttribute(
      'src',
      /^data:image\/svg\+xml/,
    );

    const apply = page
      .locator('.detail-header-toolbar button')
      .filter({ has: page.locator('mat-icon', { hasText: 'save' }) })
      .first();
    if (await apply.isEnabled()) {
      await apply.click();
    }

    const nodePut = page.waitForResponse((response) => {
      try {
        const pathname = new URL(response.url()).pathname;
        return (
          response.request().method() === 'PUT' &&
          pathname === `/backend/api/tree-nodes/${menuId}`
        );
      } catch {
        return false;
      }
    });
    await dismissBlockingOverlays(page);
    await expect(page.getByTestId('form-save')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('form-save').click();
    const putResponse = await nodePut;
    expect(
      putResponse.ok(),
      `PUT tree-nodes/${menuId}: ${putResponse.status()} ${await putResponse.text()}`,
    ).toBeTruthy();

    expectSvgDataUri(await storedImage(request, 'tree-nodes', menuId), 'node persist');
  });
});
