import { expect, test, type Page } from '@playwright/test';
import {
  APP_ID,
  isBackendRequest,
  NON_RADIO_ROOT_FOLDER_TITLE,
  RADIO_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

const FOLDER_DB_ID = 1;
const FOLDER_DESCRIPTION = 'Carrers, números de portal i illes urbanes del municipi.';
const METADATA_URL = 'https://ide.example.cat/geonetwork/srv/cat/catalog.search#/metadata/adreces';
const DATASET_URL = 'https://ide.example.cat/descarrega/adreces.zip';

async function patchFolderInfo(page: Page): Promise<void> {
  const login = await page.request.post('/backend/api/authenticate/admin', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();
  const response = await page.request.patch(`/backend/api/tree-nodes/${FOLDER_DB_ID}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: {
      description: FOLDER_DESCRIPTION,
      metadataURL: METADATA_URL,
      datasetURL: DATASET_URL,
    },
  });
  const body = (await response.json()) as Record<string, unknown>;
  expect(response.ok(), `patch tree-node ${FOLDER_DB_ID} failed: ${response.status()} ${JSON.stringify(body)}`).toBeTruthy();
  expect(body['description'], JSON.stringify(body)).toBe(FOLDER_DESCRIPTION);
  expect(body['metadataURL']).toBe(METADATA_URL);
  expect(body['datasetURL']).toBe(DATASET_URL);
}

async function openCatalog(page: Page): Promise<void> {
  const credentials = await readViewerCredentials();
  await page.goto('/auth/login');
  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('form .login-button button').click();
  await expect(page).toHaveURL(/\/user\/dashboard/);

  const profile = page.waitForResponse(
    (response) =>
      isBackendRequest(response, `/config/client/profile/${APP_ID}/${TERRITORY_ID}`, 'GET') &&
      response.ok(),
  );
  await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, { waitUntil: 'domcontentloaded' });
  const profileResponse = await profile;
  const profileBody = (await profileResponse.json()) as {
    trees?: Array<{ nodes?: Record<string, Record<string, unknown>> }>;
  };
  const node = profileBody.trees
    ?.flatMap((tree) => Object.entries(tree.nodes ?? {}))
    .find(([id]) => id === 'node/1')?.[1];
  expect(node?.['description'], JSON.stringify(node)).toBe(FOLDER_DESCRIPTION);
  expect(node?.['metadataURL']).toBe(METADATA_URL);
  expect(node?.['datasetURL']).toBe(DATASET_URL);
  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('.tc-tools-panel').evaluate((panel) => {
    panel.classList.remove('tc-collapsed-right');
  });
  await expect(page.locator('.tc-tools-panel')).not.toHaveClass(/tc-collapsed-right/);
  await expect(page.locator('#tc-slot-toc .tc-ctl-lcat-tree')).toBeVisible({ timeout: 30_000 });
}

function folderRow(page: Page, title: string) {
  return page.locator('#tc-slot-toc li.tc-ctl-lcat-node').filter({
    has: page.locator(':scope > span, :scope > .tc-ctl-lcat-node-title').filter({
      hasText: new RegExp(`^${title}$`),
    }),
  });
}

test('folder information window follows the folder kind', async ({ page }) => {
  await patchFolderInfo(page);
  await openCatalog(page);

  const filled = folderRow(page, NON_RADIO_ROOT_FOLDER_TITLE);
  const empty = folderRow(page, RADIO_FOLDER_TITLE);
  await expect(filled).toBeVisible();
  await filled.getByRole('button', { name: /Expandir|Expand|Desplegar/i }).click();
  await expect(empty).toBeVisible();

  await expect(filled.locator(':scope > .tc-ctl-lcat-btn-info')).toBeVisible();
  await expect(empty.locator(':scope > .tc-ctl-lcat-btn-info')).toHaveCount(0);

  await page.screenshot({
    path: '/tmp/sitmun-issue-173-implemented/01-catalog.png',
  });

  await filled.locator(':scope > .tc-ctl-lcat-btn-info').click();
  const dialog = page.locator('#tc-slot-toc .tc-ctl-lcat-info');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(FOLDER_DESCRIPTION);
  await expect(dialog.locator('a.tc-file-link').nth(0)).toHaveAttribute('href', METADATA_URL);
  await expect(dialog.locator('a.tc-file-link').nth(1)).toHaveAttribute('href', DATASET_URL);
  await expect(dialog).toContainText(
    /Descripció del grup de capes|Descripción del grupo de capas|Layer group description/,
  );
  await expect(dialog).not.toContainText(/ID de la capa|Layer ID|Identificador de capa/);

  await page.screenshot({
    path: '/tmp/sitmun-issue-173-implemented/02-folder-window.png',
  });
});
