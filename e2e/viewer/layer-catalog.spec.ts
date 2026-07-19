import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  APP_ID,
  CHECKBOX_LOAD_FOLDER_NODE_ID,
  CHECKBOX_LOAD_FOLDER_TITLE,
  isBackendRequest,
  NON_RADIO_LEAF_NODE_ID,
  NON_RADIO_LEAF_TITLE,
  NON_RADIO_ROOT_FOLDER_NODE_ID,
  NON_RADIO_ROOT_FOLDER_TITLE,
  QUERYABLE_LEAF_NODE_ID,
  QUERYABLE_LEAF_TITLE,
  RADIO_FIRST_CHILD_NODE_ID,
  RADIO_FOLDER_NODE_ID,
  RADIO_FOLDER_TITLE,
  RADIO_FOLDER_TREE_NODE_DB_ID,
  RADIO_SECOND_CHILD_NODE_ID,
  readViewerCredentials,
  TERRITORY_ID,
} from './fixtures';

/**
 * Layer catalog DOM contract for #45.
 *
 * Non-radio folders never get child radios. Radio folders get native
 * `input.sitmun-lcat-radio` on children. `loadData` folders get a visible
 * `input.sitmun-lcat-load` control (checkbox, or radio when the folder is
 * radio); title remains expand/collapse only. Queryable leaves show
 * `.sitmun-lcat-gfi` after the select control; SITNA info uses
 * `data-sitmun-lcat-meta`.
 */
async function loginAndOpenMap(page: Page): Promise<void> {
  const credentials = await readViewerCredentials();

  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();

  await page.locator('input[name="username"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);

  const authenticate = page.waitForResponse(
    (response) => isBackendRequest(response, '/authenticate', 'POST') && response.ok(),
  );
  const account = page.waitForResponse(
    (response) => isBackendRequest(response, '/account', 'GET') && response.ok(),
  );

  await page.locator('form .login-button button').click();
  await Promise.all([authenticate, account]);
  await expect(page).toHaveURL(/\/user\/dashboard/);

  const profile = page.waitForResponse(
    (response) =>
      isBackendRequest(
        response,
        `/config/client/profile/${APP_ID}/${TERRITORY_ID}`,
        'GET',
      ) && response.ok(),
  );

  await page.goto(`/user/map/${APP_ID}/${TERRITORY_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  const profileResponse = await profile;
  const profileBody = (await profileResponse.json()) as {
    tasks?: Array<{ 'ui-control'?: string }>;
  };
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.layerCatalog'),
    'profile must include sitna.layerCatalog (setup task-availability)',
  ).toBeTruthy();

  // Collapsed tools panel is translateX(100%); the Capas tab sticks out but is
  // often not a stable Playwright click target. Open via the same class toggle
  // SITNA uses once the TOC slot is mounted.
  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('.tc-tools-panel').evaluate((panel) => {
    panel.classList.remove('tc-collapsed-right');
  });
  await expect(page.locator('.tc-tools-panel')).not.toHaveClass(/tc-collapsed-right/);

  await expect(page.getByText(NON_RADIO_ROOT_FOLDER_TITLE, { exact: true })).toBeVisible({
    timeout: 90_000,
  });
}

async function expandNodeByTitle(page: Page, title: string): Promise<void> {
  // Match the LI whose own title span equals `title` (not an ancestor that contains it).
  const item = page.locator('#tc-slot-toc li').filter({
    has: page.locator(':scope > span, :scope > .tc-ctl-lcat-node-title').filter({
      hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    }),
  });
  await expect(item).toBeVisible({ timeout: 30_000 });
  const branch = item.locator(':scope > ul').first();
  if ((await branch.count()) > 0 && (await branch.isVisible())) {
    return;
  }
  await item.getByRole('button', { name: /Expandir|Expand|Desplegar/i }).click();
  await expect(branch).toBeVisible({ timeout: 15_000 });
}

function folderByTitle(page: Page, title: string) {
  return page.locator('#tc-slot-toc li').filter({
    has: page.locator(':scope > span, :scope > .tc-ctl-lcat-node-title').filter({
      hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    }),
  });
}

async function expandNode(page: Page, nodeId: string): Promise<void> {
  const li = page.locator(`#tc-slot-toc li[data-layer-name="${nodeId}"]`);
  await expect(li).toBeVisible({ timeout: 30_000 });
  const branch = li.locator(':scope > ul').first();
  if ((await branch.count()) > 0 && (await branch.isVisible())) {
    return;
  }
  await li.locator('.tc-ctl-lcat-node-title, span').first().click();
  await expect(branch).toBeVisible({ timeout: 15_000 });
}

async function patchTreeNodeLoadData(
  request: APIRequestContext,
  nodeDbId: number,
  loadData: boolean,
): Promise<void> {
  const login = await request.post('/backend/api/authenticate/admin', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(login.ok(), `admin login failed: ${login.status()}`).toBeTruthy();

  const response = await request.patch(`/backend/api/tree-nodes/${nodeDbId}`, {
    headers: {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/merge-patch+json',
    },
    data: { loadData },
  });
  expect(
    response.ok(),
    `patch tree-node ${nodeDbId} failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

test.describe('Viewer layer catalog loadData / radio', () => {
  test('radio folder children get radios; non-radio folders do not', async ({ page }) => {
    await loginAndOpenMap(page);

    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const radioFolder = folderByTitle(page, RADIO_FOLDER_TITLE);
    await expect(radioFolder).toHaveAttribute('data-sitmun-radio-folder', 'true');

    const radios = radioFolder.locator('input.sitmun-lcat-radio');
    await expect(radios).toHaveCount(2);
    await expect(
      radioFolder.locator(
        `input.sitmun-lcat-radio[data-layer-name="${RADIO_FIRST_CHILD_NODE_ID}"]`,
      ),
    ).toBeVisible();
    await expect(
      radioFolder.locator(
        `input.sitmun-lcat-radio[data-layer-name="${RADIO_SECOND_CHILD_NODE_ID}"]`,
      ),
    ).toBeVisible();

    const nonRadioRoot = folderByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expect(nonRadioRoot).not.toHaveAttribute('data-sitmun-radio-folder', 'true');
  });

  test('checkbox-load folder shows a visible load checkbox without radios', async ({
    page,
  }) => {
    await loginAndOpenMap(page);

    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);

    const loadFolder = folderByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);
    await expect(loadFolder).toHaveAttribute('data-sitmun-load-folder', 'true');
    const loadLabel = loadFolder.locator(':scope > label.sitmun-lcat-load-label');
    await expect(loadLabel).toBeVisible();
    const loadControl = loadLabel.locator(
      `input.sitmun-lcat-load[data-layer-name="${CHECKBOX_LOAD_FOLDER_NODE_ID}"]`,
    );
    await expect(loadControl).toBeVisible();
    await expect(loadControl).toHaveAttribute('type', 'checkbox');
    await expect(loadFolder.locator('input.sitmun-lcat-radio')).toHaveCount(0);
    await expect(loadFolder).not.toHaveAttribute('data-sitmun-radio-folder', 'true');
    await expect(loadFolder).toHaveAttribute('data-sitmun-lcat-control', 'true');
  });

  test('radio folder load control with loadData is type=radio and selects the first ordered child', async ({
    page,
  }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const radioFolder = folderByTitle(page, RADIO_FOLDER_TITLE);
    const loadLabel = radioFolder.locator(':scope > label.sitmun-lcat-load-label');
    const loadControl = loadLabel.locator(
      `input.sitmun-lcat-load[data-layer-name="${RADIO_FOLDER_NODE_ID}"]`,
    );
    const firstRadio = radioFolder.locator(
      `input.sitmun-lcat-radio[data-layer-name="${RADIO_FIRST_CHILD_NODE_ID}"]`,
    );
    const secondRadio = radioFolder.locator(
      `input.sitmun-lcat-radio[data-layer-name="${RADIO_SECOND_CHILD_NODE_ID}"]`,
    );

    await expect(loadLabel).toBeVisible();
    await expect(loadControl).toBeVisible();
    await expect(loadControl).toHaveAttribute('type', 'radio');

    // Empty folder: load control selects the first ordered child.
    await loadControl.click();
    await expect(firstRadio).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
    await expect(secondRadio).toHaveAttribute('aria-checked', 'false');

    await secondRadio.click();
    await expect(secondRadio).toHaveAttribute('aria-checked', 'true');
    // Any child loaded → load control unloads the group (does not jump to first).
    await loadControl.click();
    await expect(firstRadio).toHaveAttribute('aria-checked', 'false', { timeout: 30_000 });
    await expect(secondRadio).toHaveAttribute('aria-checked', 'false');
  });

  test('queryable leaf shows GFI i after select and meta when info is available', async ({
    page,
  }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const leaf = page.locator(`#tc-slot-toc li[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`);
    await expect(leaf).toBeVisible({ timeout: 30_000 });
    await expect(leaf.getByText(QUERYABLE_LEAF_TITLE, { exact: true })).toBeVisible();

    const gfi = leaf.locator(':scope > i.sitmun-lcat-gfi');
    await expect(gfi).toBeVisible();
    await expect(gfi).toHaveText('i');

    const select = leaf.locator(
      `:scope > label.sitmun-lcat-radio-label input[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`,
    );
    await expect(select).toBeVisible();
    const order = await leaf.evaluate((li) => {
      const children = [...li.children].filter((el) => el.tagName !== 'UL');
      return children.map((el) => {
        if (el.matches('label.sitmun-lcat-radio-label')) return 'select';
        if (el.matches('i.sitmun-lcat-gfi')) return 'gfi';
        if (el.matches('[data-sitmun-lcat-meta]')) return 'meta';
        if (el.matches('.tc-ctl-lcat-node-title, span')) return 'title';
        return el.className || el.tagName;
      });
    });
    const selectIdx = order.indexOf('select');
    const gfiIdx = order.indexOf('gfi');
    const titleIdx = order.indexOf('title');
    expect(selectIdx).toBeGreaterThanOrEqual(0);
    expect(gfiIdx).toBeGreaterThan(selectIdx);
    expect(titleIdx).toBeGreaterThan(gfiIdx);

    const sibling = page.locator(
      `#tc-slot-toc li[data-layer-name="${RADIO_SECOND_CHILD_NODE_ID}"]`,
    );
    await expect(sibling.locator(':scope > i.sitmun-lcat-gfi')).toHaveCount(0);

    const meta = leaf.locator('[data-sitmun-lcat-meta]');
    if ((await meta.count()) > 0) {
      await expect(meta.first()).toBeVisible();
    }
  });

  test('catalog row geometry uses shared icon/control rhythm', async ({ page }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const radioFolder = page.locator(
      `#tc-slot-toc li[data-layer-name="${RADIO_FOLDER_NODE_ID}"]`,
    );
    const leaf = page.locator(`#tc-slot-toc li[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`);
    await expect(leaf).toBeVisible({ timeout: 30_000 });
    await expect(radioFolder).toHaveAttribute('data-sitmun-lcat-level', '1');
    await expect(leaf).toHaveAttribute('data-sitmun-lcat-level', '2');

    const geometry = await leaf.evaluate((li) => {
      const styles = getComputedStyle(li);
      const slot = parseFloat(styles.getPropertyValue('--sitmun-lcat-slot')) || 18;
      const icon = parseFloat(styles.getPropertyValue('--sitmun-lcat-icon')) || 16;
      const indent =
        parseFloat(styles.getPropertyValue('--sitmun-lcat-indent')) || icon;
      const rootAlign = parseFloat(styles.getPropertyValue('--sitmun-lcat-root-align')) || 5;
      const level = Number(li.getAttribute('data-sitmun-lcat-level') ?? '0');
      const paddingLeft = parseFloat(styles.paddingLeft);
      const minHeight = parseFloat(styles.minHeight);
      const label = li.querySelector(
        ':scope > label.sitmun-lcat-radio-label, :scope > label.sitmun-lcat-load-label, :scope > label.sitmun-lcat-leaf-load-label',
      ) as HTMLElement | null;
      const gfi = li.querySelector(':scope > i.sitmun-lcat-gfi') as HTMLElement | null;
      const title = li.querySelector(
        ':scope > .tc-ctl-lcat-node-title, :scope > span',
      ) as HTMLElement | null;
      const meta = li.querySelector('[data-sitmun-lcat-meta]') as HTMLElement | null;
      const tree = li.closest('.tc-ctl-lcat-tree') as HTMLElement | null;
      const liBox = li.getBoundingClientRect();
      const labelBox = label?.getBoundingClientRect();
      const gfiBox = gfi?.getBoundingClientRect();
      const titleBox = title?.getBoundingClientRect();
      const metaBox = meta?.getBoundingClientRect();
      const treeBox = tree?.getBoundingClientRect();
      const iconLeft = liBox.left + rootAlign + level * indent;
      const center = (box: DOMRect) => (box.top + box.bottom) / 2;
      return {
        slot,
        icon,
        indent,
        rootAlign,
        level,
        paddingLeft,
        expectedPadding: rootAlign + (level + 1) * indent,
        minHeight,
        iconLeft,
        treeLeft: treeBox?.left ?? null,
        selectLeft: labelBox?.left ?? null,
        selectWidth: labelBox?.width ?? null,
        gutterRight: liBox.left + paddingLeft,
        gfiLeft: gfiBox?.left ?? null,
        gfiWidth: gfiBox?.width ?? null,
        gfiRight: gfiBox?.right ?? null,
        selectRight: labelBox?.right ?? null,
        titleLeft: titleBox?.left ?? null,
        metaLeft: metaBox?.left ?? null,
        metaWidth: metaBox?.width ?? null,
        metaHeight: metaBox?.height ?? null,
        labelHeight: labelBox?.height ?? null,
        selectTitleCenterDelta:
          labelBox && titleBox ? Math.abs(center(labelBox) - center(titleBox)) : null,
      };
    });

    // Nest step = type-icon width; select/GFI columns = slot (18); row ~20.
    expect(geometry.slot).toBe(18);
    expect(geometry.indent).toBe(geometry.icon);
    expect(geometry.paddingLeft).toBeCloseTo(geometry.expectedPadding, 0);
    expect(geometry.minHeight).toBeGreaterThanOrEqual(19);
    expect(geometry.minHeight).toBeLessThanOrEqual(22);
    expect(geometry.selectLeft).not.toBeNull();
    expect(geometry.selectLeft!).toBeGreaterThanOrEqual(geometry.gutterRight - 1);
    expect(geometry.selectWidth!).toBeGreaterThanOrEqual(17);
    expect(geometry.selectWidth!).toBeLessThanOrEqual(19);
    expect(geometry.gfiLeft).not.toBeNull();
    expect(geometry.gfiWidth!).toBeGreaterThanOrEqual(17);
    expect(geometry.gfiWidth!).toBeLessThanOrEqual(19);
    expect(geometry.selectRight).not.toBeNull();
    expect(geometry.titleLeft).not.toBeNull();
    expect(geometry.gfiLeft!).toBeGreaterThanOrEqual(geometry.selectRight! - 1);
    expect(geometry.titleLeft!).toBeGreaterThanOrEqual(geometry.gfiRight! - 1);
    expect(geometry.titleLeft!).toBeCloseTo(geometry.gutterRight + 2 * geometry.slot, 0);
    expect(geometry.selectTitleCenterDelta).not.toBeNull();
    expect(geometry.selectTitleCenterDelta!).toBeLessThanOrEqual(3);
    expect(geometry.labelHeight).not.toBeNull();
    expect(geometry.labelHeight!).toBeGreaterThanOrEqual(17);

    if (geometry.metaLeft != null) {
      expect(geometry.metaLeft).toBeGreaterThanOrEqual(geometry.titleLeft! - 1);
      expect(geometry.metaWidth!).toBeGreaterThanOrEqual(18);
      expect(geometry.metaHeight!).toBeGreaterThanOrEqual(18);
    }

    // Absent icons leave no empty slots (no select/GFI spacers on folders).
    const folderLayout = await page.evaluate(
      ({ radioId, checkboxId }) => {
        const radio = document.querySelector(
          `#tc-slot-toc li[data-layer-name="${radioId}"]`,
        ) as HTMLElement | null;
        const checkbox = document.querySelector(
          `#tc-slot-toc li[data-layer-name="${checkboxId}"]`,
        ) as HTMLElement | null;
        if (!radio || !checkbox) {
          return null;
        }
        const hasSpacer = (li: HTMLElement) =>
          Array.from(li.children).some(
            (c) =>
              (c as HTMLElement).classList?.contains('sitmun-lcat-select-slot') ||
              (c as HTMLElement).classList?.contains('sitmun-lcat-gfi-slot'),
          );
        return {
          radioHasSpacer: hasSpacer(radio),
          checkboxHasSpacer: hasSpacer(checkbox),
          radioHasGfi: Boolean(radio.querySelector(':scope > i.sitmun-lcat-gfi')),
          checkboxHasGfi: Boolean(checkbox.querySelector(':scope > i.sitmun-lcat-gfi')),
        };
      },
      { radioId: RADIO_FOLDER_NODE_ID, checkboxId: CHECKBOX_LOAD_FOLDER_NODE_ID },
    );
    expect(folderLayout).not.toBeNull();
    expect(folderLayout!.radioHasSpacer).toBe(false);
    expect(folderLayout!.checkboxHasSpacer).toBe(false);
    expect(folderLayout!.radioHasGfi).toBe(false);
    expect(folderLayout!.checkboxHasGfi).toBe(false);

    // Icon-to-icon step = parent type-icon width (nested ul pulled back; not stacked pad).
    const indent = await radioFolder.evaluate((folder) => {
      const child = folder.querySelector(
        ':scope > ul.tc-ctl-lcat-branch > li, :scope > ul > li',
      ) as HTMLElement | null;
      if (!child) {
        return null;
      }
      const parentStyles = getComputedStyle(folder);
      const childStyles = getComputedStyle(child);
      const icon = parseFloat(parentStyles.getPropertyValue('--sitmun-lcat-icon')) || 16;
      const nest =
        parseFloat(parentStyles.getPropertyValue('--sitmun-lcat-indent')) || icon;
      const rootAlign =
        parseFloat(parentStyles.getPropertyValue('--sitmun-lcat-root-align')) || 5;
      const parentLevel = Number(folder.getAttribute('data-sitmun-lcat-level') ?? '0');
      const childLevel = Number(child.getAttribute('data-sitmun-lcat-level') ?? '0');
      const parentIconLeft =
        folder.getBoundingClientRect().left + rootAlign + parentLevel * nest;
      const childIconLeft =
        child.getBoundingClientRect().left + rootAlign + childLevel * nest;
      return {
        step: childIconLeft - parentIconLeft,
        nest,
        padStep:
          parseFloat(childStyles.paddingLeft) - parseFloat(parentStyles.paddingLeft),
      };
    });
    expect(indent).not.toBeNull();
    expect(indent!.step).toBeCloseTo(indent!.nest, 0);
    expect(indent!.padStep).toBeCloseTo(indent!.nest, 0);
  });

  test('non-radio cartography leaf has load checkbox; radio leaf keeps radio only', async ({
    page,
  }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const plainLeaf = page.locator(
      `#tc-slot-toc li[data-layer-name="${NON_RADIO_LEAF_NODE_ID}"]`,
    );
    await expect(plainLeaf).toBeVisible({ timeout: 30_000 });
    await expect(plainLeaf.getByText(NON_RADIO_LEAF_TITLE, { exact: true })).toBeVisible();
    const leafLoad = plainLeaf.locator(
      `:scope > label.sitmun-lcat-leaf-load-label input.sitmun-lcat-leaf-load[data-layer-name="${NON_RADIO_LEAF_NODE_ID}"]`,
    );
    await expect(leafLoad).toBeVisible();
    await expect(leafLoad).toHaveAttribute('type', 'checkbox');
    await expect(plainLeaf.locator('input.sitmun-lcat-radio')).toHaveCount(0);

    const radioLeaf = page.locator(
      `#tc-slot-toc li[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`,
    );
    await expect(
      radioLeaf.locator(`input.sitmun-lcat-radio[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`),
    ).toBeVisible();
    await expect(radioLeaf.locator('input.sitmun-lcat-leaf-load')).toHaveCount(0);

    // Folder loaded-state must not italicize titles.
    const rootFolder = folderByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await rootFolder.evaluate((li) => li.classList.add('tc-checked'));
    const folderStyle = await rootFolder
      .locator(':scope > .tc-ctl-lcat-node-title, :scope > span')
      .first()
      .evaluate((el) => getComputedStyle(el).fontStyle);
    expect(folderStyle).toBe('normal');

    // Vertical center: leaf-load select vs title (same rhythm as radio rows).
    const centers = await plainLeaf.evaluate((li) => {
      const select = li.querySelector(
        ':scope > label.sitmun-lcat-leaf-load-label input',
      ) as HTMLElement | null;
      const title = li.querySelector(
        ':scope > .tc-ctl-lcat-node-title, :scope > span',
      ) as HTMLElement | null;
      if (!select || !title) {
        return null;
      }
      const mid = (el: HTMLElement) => {
        const b = el.getBoundingClientRect();
        return (b.top + b.bottom) / 2;
      };
      return Math.abs(mid(select) - mid(title));
    });
    expect(centers).not.toBeNull();
    expect(centers!).toBeLessThanOrEqual(3);
  });

  test('non-radio leaf load checkbox reflects selection after toggle', async ({ page }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);

    const leafLoad = page.locator(
      `#tc-slot-toc input.sitmun-lcat-leaf-load[data-layer-name="${NON_RADIO_LEAF_NODE_ID}"]`,
    );
    await expect(leafLoad).toBeVisible({ timeout: 30_000 });
    await expect(leafLoad).toHaveAttribute('aria-checked', 'false');

    await leafLoad.click();
    await expect(leafLoad).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });

    await leafLoad.click();
    await expect(leafLoad).toHaveAttribute('aria-checked', 'false', { timeout: 30_000 });
  });

  test('catalog tree stamps alternating zebra on visible rows', async ({ page }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const tree = page.locator('#tc-slot-toc .tc-ctl-lcat-tree');
    await expect(tree.locator('li[data-sitmun-lcat-zebra]').first()).toBeVisible({
      timeout: 30_000,
    });

    const stripes = await tree.evaluate((treeEl) => {
      const rows = [...treeEl.querySelectorAll('li[data-sitmun-lcat-zebra]')];
      return rows.map((li) => li.getAttribute('data-sitmun-lcat-zebra'));
    });
    expect(stripes.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < stripes.length; i++) {
      expect(stripes[i]).toBe(String(i % 2));
    }

    // Zebra must be a row band (::before), not a fill on the whole expanded <li>.
    const band = await tree.evaluate((treeEl) => {
      const folder = treeEl.querySelector(
        'li.tc-ctl-lcat-node[data-sitmun-lcat-zebra="1"]:not(.tc-collapsed)',
      ) as HTMLElement | null;
      if (!folder) {
        return null;
      }
      const before = getComputedStyle(folder, '::before');
      const liBg = getComputedStyle(folder).backgroundColor;
      return {
        beforeContent: before.content,
        beforeHeight: parseFloat(before.height),
        liHeight: folder.getBoundingClientRect().height,
        liBg,
      };
    });
    expect(band).not.toBeNull();
    expect(band!.beforeContent).not.toBe('none');
    expect(band!.beforeHeight).toBeGreaterThan(0);
    expect(band!.beforeHeight).toBeLessThanOrEqual(24);
    expect(band!.liHeight).toBeGreaterThan(band!.beforeHeight + 10);
    expect(band!.liBg).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);

    const titleBg = await tree.evaluate((treeEl) => {
      const title = treeEl.querySelector(
        'li[data-sitmun-lcat-zebra="1"] > .tc-ctl-lcat-node-title, li[data-sitmun-lcat-zebra="1"] > span',
      );
      return title ? getComputedStyle(title).backgroundColor : null;
    });
    expect(titleBg).not.toBeNull();
    expect(titleBg!).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);
  });

  test('radio folder without loadData has no load control; title does not select', async ({
    page,
    request,
  }) => {
    await patchTreeNodeLoadData(request, RADIO_FOLDER_TREE_NODE_DB_ID, false);
    try {
      await loginAndOpenMap(page);
      await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
      await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

      const radioFolder = folderByTitle(page, RADIO_FOLDER_TITLE);
      const firstRadio = radioFolder.locator(
        `input.sitmun-lcat-radio[data-layer-name="${RADIO_FIRST_CHILD_NODE_ID}"]`,
      );
      const secondRadio = radioFolder.locator(
        `input.sitmun-lcat-radio[data-layer-name="${RADIO_SECOND_CHILD_NODE_ID}"]`,
      );

      await expect(radioFolder.locator('input.sitmun-lcat-load')).toHaveCount(0);
      await expect(firstRadio).toHaveAttribute('aria-checked', 'false');
      await expect(secondRadio).toHaveAttribute('aria-checked', 'false');

      // Title toggles expand/collapse only; it must not select a child.
      await radioFolder.locator(':scope > .tc-ctl-lcat-node-title, :scope > span').first().click();

      await expect
        .poll(async () => firstRadio.getAttribute('aria-checked'), { timeout: 3_000 })
        .toBe('false');
      await expect(secondRadio).toHaveAttribute('aria-checked', 'false');

      // Title click collapses the branch; re-open before exercising child radios.
      await expandNodeByTitle(page, RADIO_FOLDER_TITLE);
      await secondRadio.click();
      await expect(secondRadio).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
    } finally {
      await patchTreeNodeLoadData(request, RADIO_FOLDER_TREE_NODE_DB_ID, true);
    }
  });
});
