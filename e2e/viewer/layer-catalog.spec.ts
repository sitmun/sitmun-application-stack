import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import {
  APP_ID,
  CHECKBOX_LOAD_FOLDER_NODE_ID,
  CHECKBOX_LOAD_FOLDER_TITLE,
  isBackendRequest,
  NON_RADIO_LEAF_NODE_ID,
  NON_RADIO_LEAF_TITLE,
  NON_RADIO_ROOT_FOLDER_NODE_ID,
  NON_RADIO_ROOT_FOLDER_TITLE,
  QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR,
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
 * radio); title remains expand/collapse only. Capas GFI lives in WorkLayerManager
 * (Sitna `--icon-info` / “i”). Catalog meta uses `data-sitmun-lcat-meta` with
 * Material Icons `article` trailed after the title.
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

async function expandWorkLayerManager(page: Page): Promise<void> {
  // SITNA mounts WorkLayerManager on #tc-slot-wlm (the slot is .tc-ctl-wlm).
  const wlm = page.locator('#tc-slot-wlm');
  await wlm.waitFor({ state: 'attached', timeout: 30_000 });
  await wlm.evaluate((el) => el.classList.remove('tc-collapsed'));
}

/** Load Toponímia (single WMS name) into Capas via radio. */
async function loadQueryableLeafIntoCapas(page: Page): Promise<void> {
  await expandWorkLayerManager(page);
  await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
  await expandNodeByTitle(page, RADIO_FOLDER_TITLE);
  const radio = page.locator(
    `#tc-slot-toc input.sitmun-lcat-radio[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`,
  );
  await expect(radio).toBeVisible({ timeout: 30_000 });
  await radio.click();
  await expect(page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm[data-layer-id]')).toBeVisible({
    timeout: 90_000,
  });
}

/** Drive OpenLayers resolution so OGC scale ≈ target (SITNA getOgcScale). */
async function setMapOgcScale(page: Page, targetScale: number): Promise<void> {
  await page.evaluate((scale) => {
    const TC = (window as unknown as { TC?: { Map?: { get: (el: Element) => any } } }).TC;
    const mapEl = document.querySelector('.tc-map');
    if (!TC?.Map?.get || !mapEl) {
      throw new Error('TC.Map not available');
    }
    const map = TC.Map.get(mapEl);
    const mpu =
      typeof map.getMetersPerUnit === 'function' ? Number(map.getMetersPerUnit()) || 1 : 1;
    const resolution = (scale * 0.00028) / mpu;
    if (typeof map.setResolution === 'function') {
      map.setResolution(resolution);
    } else if (map.wrap?.map?.getView) {
      map.wrap.map.getView().setResolution(resolution);
    } else {
      throw new Error('Cannot set map resolution');
    }
    for (const ctl of map.controls || []) {
      if (typeof ctl.updateScale === 'function') {
        ctl.updateScale();
      }
    }
  }, targetScale);
}

function capasPathColor(page: Page, notVisible: boolean) {
  const sel = notVisible
    ? '#tc-slot-wlm li.tc-ctl-wlm-elm-notvisible .tc-ctl-wlm-path'
    : '#tc-slot-wlm li.tc-ctl-wlm-elm:not(.tc-ctl-wlm-elm-notvisible) .tc-ctl-wlm-path';
  return page.locator(sel).first().evaluate((el) => getComputedStyle(el).color);
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
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

  test('queryable leaf shows trailing meta article glyph after title', async ({
    page,
  }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);

    const leaf = page.locator(`#tc-slot-toc li[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`);
    await expect(leaf).toBeVisible({ timeout: 30_000 });
    await expect(leaf.getByText(QUERYABLE_LEAF_TITLE, { exact: true })).toBeVisible();

    await expect(leaf.locator(':scope > .sitmun-lcat-gfi, :scope > sitna-toggle.sitmun-lcat-gfi')).toHaveCount(0);

    const meta = leaf.locator(':scope > [data-sitmun-lcat-meta]');
    await expect(meta).toBeVisible();
    await expect(meta).toHaveAttribute('checked-icon-text', 'article');

    const select = leaf.locator(
      `:scope > label.sitmun-lcat-radio-label input[data-layer-name="${QUERYABLE_LEAF_NODE_ID}"]`,
    );
    await expect(select).toBeVisible();
    const order = await leaf.evaluate((li) => {
      const children = [...li.children].filter((el) => el.tagName !== 'UL');
      return children.map((el) => {
        if (el.matches('label.sitmun-lcat-radio-label')) return 'select';
        if (el.matches('[data-sitmun-lcat-meta]')) return 'meta';
        if (el.matches('.tc-ctl-lcat-node-title, span')) return 'title';
        return el.className || el.tagName;
      });
    });
    const selectIdx = order.indexOf('select');
    const titleIdx = order.indexOf('title');
    const metaIdx = order.indexOf('meta');
    expect(selectIdx).toBeGreaterThanOrEqual(0);
    expect(titleIdx).toBeGreaterThan(selectIdx);
    expect(metaIdx).toBeGreaterThan(titleIdx);

    const sibling = page.locator(
      `#tc-slot-toc li[data-layer-name="${RADIO_SECOND_CHILD_NODE_ID}"]`,
    );
    await expect(sibling.locator(':scope > .sitmun-lcat-gfi')).toHaveCount(0);
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

    // Catalog GFI moved to Capas (WLM); trailing control on the leaf is meta only.
    await expect(leaf.locator(':scope > .sitmun-lcat-gfi, :scope > sitna-toggle.sitmun-lcat-gfi')).toHaveCount(
      0,
    );
    await expect(leaf.locator(':scope > [data-sitmun-lcat-meta]')).toBeVisible();

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
      const title = li.querySelector(
        ':scope > .tc-ctl-lcat-node-title, :scope > span',
      ) as HTMLElement | null;
      const meta = li.querySelector(':scope > [data-sitmun-lcat-meta]') as HTMLElement | null;
      const tree = li.closest('.tc-ctl-lcat-tree') as HTMLElement | null;
      const liBox = li.getBoundingClientRect();
      const labelBox = label?.getBoundingClientRect();
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
        liRight: liBox.right,
        selectLeft: labelBox?.left ?? null,
        selectWidth: labelBox?.width ?? null,
        gutterRight: liBox.left + paddingLeft,
        selectRight: labelBox?.right ?? null,
        titleLeft: titleBox?.left ?? null,
        titleRight: titleBox?.right ?? null,
        metaLeft: metaBox?.left ?? null,
        metaRight: metaBox?.right ?? null,
        metaWidth: metaBox?.width ?? null,
        metaHeight: metaBox?.height ?? null,
        metaTopGap: metaBox ? metaBox.top - liBox.top : null,
        metaBottomGap: metaBox ? liBox.bottom - metaBox.bottom : null,
        metaBorder: meta ? getComputedStyle(meta).borderTopWidth : null,
        metaBg: meta ? getComputedStyle(meta).backgroundColor : null,
        labelHeight: labelBox?.height ?? null,
        selectTitleCenterDelta:
          labelBox && titleBox ? Math.abs(center(labelBox) - center(titleBox)) : null,
        metaTitleCenterDelta:
          metaBox && titleBox ? Math.abs(center(metaBox) - center(titleBox)) : null,
        selectMetaCenterDelta:
          labelBox && metaBox ? Math.abs(center(labelBox) - center(metaBox)) : null,
      };
    });

    // Nest step = type-icon width; select column = slot (18); row ~20.
    // Title flex-grows; trailing meta hugs the row’s right edge (GFI is Capas-only).
    expect(geometry.slot).toBe(18);
    expect(geometry.indent).toBe(geometry.icon);
    expect(geometry.paddingLeft).toBeCloseTo(geometry.expectedPadding, 0);
    expect(geometry.minHeight).toBe(20);
    expect(geometry.selectLeft).not.toBeNull();
    expect(geometry.selectLeft!).toBeGreaterThanOrEqual(geometry.gutterRight - 1);
    expect(geometry.selectWidth!).toBeGreaterThanOrEqual(17);
    expect(geometry.selectWidth!).toBeLessThanOrEqual(19);
    expect(geometry.selectRight).not.toBeNull();
    expect(geometry.titleLeft).not.toBeNull();
    expect(geometry.titleRight).not.toBeNull();
    expect(geometry.titleLeft!).toBeGreaterThanOrEqual(geometry.selectRight! - 1);
    expect(geometry.metaLeft).not.toBeNull();
    expect(geometry.metaLeft!).toBeGreaterThanOrEqual(geometry.titleRight! - 1);
    expect(geometry.metaWidth!).toBeGreaterThanOrEqual(18);
    expect(geometry.metaHeight!).toBeGreaterThanOrEqual(18);
    expect(geometry.selectTitleCenterDelta).not.toBeNull();
    expect(geometry.selectTitleCenterDelta!).toBeLessThanOrEqual(3);
    expect(geometry.metaTitleCenterDelta).not.toBeNull();
    expect(geometry.metaTitleCenterDelta!).toBeLessThanOrEqual(3);
    expect(geometry.selectMetaCenterDelta).not.toBeNull();
    expect(geometry.selectMetaCenterDelta!).toBeLessThanOrEqual(3);
    expect(geometry.labelHeight).not.toBeNull();
    expect(geometry.labelHeight!).toBeGreaterThanOrEqual(17);
    expect(parseFloat(geometry.metaBorder ?? '0')).toBeGreaterThanOrEqual(1);
    expect(geometry.metaBg).not.toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)/);
    expect(geometry.metaTopGap).not.toBeNull();
    expect(geometry.metaBottomGap).not.toBeNull();
    expect(Math.abs(geometry.metaTopGap! - geometry.metaBottomGap!)).toBeLessThanOrEqual(2);
    expect(geometry.liRight - geometry.metaRight!).toBeLessThanOrEqual(6);

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
          radioHasGfi: Boolean(radio.querySelector(':scope > .sitmun-lcat-gfi')),
          checkboxHasGfi: Boolean(checkbox.querySelector(':scope > .sitmun-lcat-gfi')),
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

test.describe('Capas WLM contrast and layout (#92 / #142)', () => {
  test('Capas notvisible path uses #777777 (#92)', async ({ page }) => {
    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);

    const capasLi = page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm[data-layer-id]').first();
    await expect(capasLi).toBeVisible();

    // Visible (in scale): path stays maroon.
    await setMapOgcScale(page, Math.floor(QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR / 2));
    await expect
      .poll(async () => capasLi.evaluate((li) => li.classList.contains('tc-ctl-wlm-elm-notvisible')), {
        timeout: 15_000,
      })
      .toBe(false);
    expect(await capasPathColor(page, false)).toBe('rgb(102, 0, 0)');

    // Out of scale: SITNA toggles notvisible; path must be WCAG gray #777777.
    await setMapOgcScale(page, QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR * 5);
    await expect
      .poll(async () => capasLi.evaluate((li) => li.classList.contains('tc-ctl-wlm-elm-notvisible')), {
        timeout: 15_000,
      })
      .toBe(true);
    expect(await capasPathColor(page, true)).toBe('rgb(119, 119, 119)');
  });

  test('Capas and Capas disponibles do not overlap (#142)', async ({ page }) => {
    await loginAndOpenMap(page);
    await expandNodeByTitle(page, NON_RADIO_ROOT_FOLDER_TITLE);
    await expandNodeByTitle(page, RADIO_FOLDER_TITLE);
    await expandNodeByTitle(page, CHECKBOX_LOAD_FOLDER_TITLE);
    await loadQueryableLeafIntoCapas(page);

    // Second Capas row via non-radio leaf-load (harness: stub GetMap + workLayerManager).
    const leafLoad = page.locator(
      `#tc-slot-toc input.sitmun-lcat-leaf-load[data-layer-name="${NON_RADIO_LEAF_NODE_ID}"]`,
    );
    if ((await leafLoad.count()) > 0) {
      await leafLoad.click();
      await expect
        .poll(async () => page.locator('#tc-slot-wlm li.tc-ctl-wlm-elm').count(), {
          timeout: 60_000,
        })
        .toBeGreaterThanOrEqual(1);
    }

    await expandWorkLayerManager(page);
    await page.locator('#tc-slot-toc').evaluate((el) => {
      el.classList.remove('tc-collapsed');
    });

    const boxes = await page.evaluate(() => {
      const wlm = document.querySelector('#tc-slot-wlm');
      const lcat = document.querySelector('#tc-slot-toc');
      if (!wlm || !lcat) {
        return null;
      }
      const wlmBox = wlm.getBoundingClientRect();
      const lcatBox = lcat.getBoundingClientRect();
      const content = wlm.querySelector('.tc-ctl-wlm-content') as HTMLElement | null;
      return {
        wlmBottom: wlmBox.bottom,
        lcatTop: lcatBox.top,
        overflowY: content ? getComputedStyle(content).overflowY : null,
      };
    });
    expect(boxes).not.toBeNull();
    expect(boxes!.wlmBottom).toBeLessThanOrEqual(boxes!.lcatTop + 1);
    expect(['auto', 'scroll', 'overlay']).toContain(boxes!.overflowY);
  });

  test('tools-panel splitter resizes Capas without overlapping catalog', async ({ page }) => {
    await loginAndOpenMap(page);
    await loadQueryableLeafIntoCapas(page);
    await expandWorkLayerManager(page);

    // Capas expanded → usable splitter after WLM (hidden while Capas is collapsed).
    const splitter = page.locator(
      '#tc-slot-wlm + .sitmun-tools-panel-splitter, .sitmun-tools-panel-splitter[data-sitmun-split-above="tc-slot-wlm"]',
    );
    await expect(splitter).toBeVisible();

    const before = await page.locator('#tc-slot-wlm').evaluate((el) => el.getBoundingClientRect().height);
    const box = await splitter.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 80, { steps: 8 });
    await page.mouse.up();

    const after = await page.evaluate(() => {
      const wlm = document.querySelector('#tc-slot-wlm') as HTMLElement | null;
      const lcat = document.querySelector('#tc-slot-toc') as HTMLElement | null;
      if (!wlm || !lcat) {
        return null;
      }
      let storedWlm: number | null = null;
      try {
        const raw = window.localStorage.getItem('sitmun.toolsPanel.paneHeights');
        storedWlm = raw ? (JSON.parse(raw) as Record<string, number>)['tc-slot-wlm'] ?? null : null;
      } catch {
        storedWlm = null;
      }
      return {
        height: wlm.getBoundingClientRect().height,
        resized: wlm.classList.contains('sitmun-pane-resized'),
        wlmBottom: wlm.getBoundingClientRect().bottom,
        lcatTop: lcat.getBoundingClientRect().top,
        storedWlm,
        splitterCount: document.querySelectorAll('.sitmun-tools-panel-splitter').length,
      };
    });
    expect(after).not.toBeNull();
    expect(after!.resized).toBe(true);
    expect(after!.height).toBeGreaterThan(before + 40);
    expect(after!.wlmBottom).toBeLessThanOrEqual(after!.lcatTop + 1);
    expect(after!.storedWlm).toBeGreaterThan(before + 40);
    expect(after!.splitterCount).toBeGreaterThanOrEqual(1);
  });
});

type ChromeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  sel: string;
};

type MapChromeLayout = {
  candidates: ChromeBox[];
  leftStack: ChromeBox[];
  capasGlyphCount: number;
  capasTransform: string;
  capasPanel: ChromeBox | null;
  capasTab: ChromeBox | null;
  overviewTab: ChromeBox | null;
  search: ChromeBox | null;
  slider: ChromeBox | null;
  mapBox: ChromeBox | null;
  opacities: Record<string, number>;
  wlmActionBoxes: ChromeBox[];
  svDisplay: string;
  threedDisplay: string;
};

const ISSUE135_SHOT_DIR = path.join('test-results', 'issue135');

const LEFT_STACK_ORDER = [
  '#tools-tab',
  '#legend-tab',
  '.tc-ctl-fscreen',
  'button.tc-ctl-fscreen-btn',
  '.tc-ctl-sv',
  '.tc-ctl-nav-home-btn',
  '.tc-ctl-nav .tc-ctl-nav-btn-zoomin',
  '.tc-ctl-nav .tc-ctl-nav-btn-zoomout',
  '.tc-ctl-3d',
] as const;

async function captureIssue135Shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  clip?: { x: number; y: number; width: number; height: number },
): Promise<void> {
  fs.mkdirSync(ISSUE135_SHOT_DIR, { recursive: true });
  const filePath = path.join(ISSUE135_SHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false, ...(clip ? { clip } : {}) });
  await testInfo.attach(name, { path: filePath, contentType: 'image/png' });
}

async function readMapChromeLayout(page: Page): Promise<MapChromeLayout> {
  return page.evaluate(() => {
    const pick = (sel: string): ChromeBox | null => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) {
        return null;
      }
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return null;
      }
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) {
        return null;
      }
      return { x: b.x, y: b.y, width: b.width, height: b.height, sel };
    };

    const leftSelectors = [
      '#tools-tab',
      '#legend-tab',
      '.tc-ctl-fscreen',
      'button.tc-ctl-fscreen-btn',
      '.tc-ctl-sv',
      '.tc-ctl-nav-home-btn',
      '.tc-ctl-nav .tc-ctl-nav-btn-zoomin',
      '.tc-ctl-nav .tc-ctl-nav-btn-zoomout',
      '.tc-ctl-3d',
    ];
    const leftStack = leftSelectors
      .map((sel) => pick(sel))
      .filter(Boolean) as ChromeBox[];

    // Prefer host .tc-ctl-fscreen over nested button when both match.
    const fscreenHost = leftStack.find((b) => b.sel === '.tc-ctl-fscreen');
    const leftDeduped = fscreenHost
      ? leftStack.filter((b) => b.sel !== 'button.tc-ctl-fscreen-btn')
      : leftStack;

    const capasH1 = pick('.tc-tools-panel > h1');
    const overviewTab =
      pick('#ovmap-tab') ?? pick('.tc-ovmap-panel > h1');
    const search = pick('.tc-ctl-search-content');
    const slider =
      pick('.tc-ctl-nav-slider') ?? pick('.ol-zoomslider') ?? pick('.tc-ctl-nav-bar');
    const candidates = [...leftDeduped, capasH1, overviewTab].filter(Boolean) as ChromeBox[];

    const capasEl = document.querySelector('.tc-tools-panel > h1') as HTMLElement | null;
    let capasGlyphCount = 0;
    let capasTransform = 'none';
    if (capasEl) {
      capasTransform = getComputedStyle(capasEl).transform;
      const bg = getComputedStyle(capasEl).backgroundImage;
      if (bg && bg !== 'none') {
        capasGlyphCount += 1;
      }
      const before = getComputedStyle(capasEl, '::before');
      const after = getComputedStyle(capasEl, '::after');
      if (before.content && before.content !== 'none' && before.content !== '""') {
        capasGlyphCount += 1;
      }
      if (after.content && after.content !== 'none' && after.content !== '""') {
        capasGlyphCount += 1;
      }
    }

    const toolsPanel = document.querySelector('.tc-tools-panel') as HTMLElement | null;
    let capasPanel: ChromeBox | null = null;
    if (toolsPanel && !toolsPanel.classList.contains('tc-collapsed-right')) {
      const content =
        (toolsPanel.querySelector('.tc-panel-content') as HTMLElement | null) ?? toolsPanel;
      const style = getComputedStyle(content);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        const b = content.getBoundingClientRect();
        if (b.width >= 2 && b.height >= 2) {
          capasPanel = {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            sel: '.tc-tools-panel .tc-panel-content',
          };
        }
      }
    }

    const opacityOf = (sel: string): number => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) {
        return 0;
      }
      return Number.parseFloat(getComputedStyle(el).opacity || '0');
    };

    const wlmActionBoxes = [
      pick('#tc-slot-wlm .tc-ctl-wlm-btn-info'),
      pick('#tc-slot-wlm .tc-ctl-wlm-btn-visibility'),
      pick('#tc-slot-wlm .tc-ctl-wlm-btn-zoom'),
      pick('#tc-slot-wlm .tc-ctl-wlm-btn-del'),
      pick('#tc-slot-wlm input[type="range"]'),
    ].filter(Boolean) as ChromeBox[];

    const sv = document.querySelector('.tc-ctl-sv');
    const threed = document.querySelector('.tc-ctl-3d');
    const mapBox =
      pick('.tc-map') ?? pick('#mapa') ?? pick('sitmun-map') ?? null;
    return {
      candidates,
      leftStack: leftDeduped,
      capasGlyphCount,
      capasTransform,
      capasPanel,
      capasTab: capasH1,
      overviewTab,
      search,
      slider,
      mapBox,
      opacities: {
        '#tools-tab': opacityOf('#tools-tab'),
        '#legend-tab': opacityOf('#legend-tab'),
        '.tc-ctl-fscreen': opacityOf('.tc-ctl-fscreen'),
        'button.tc-ctl-fscreen-btn': opacityOf('button.tc-ctl-fscreen-btn'),
      },
      wlmActionBoxes,
      svDisplay: sv ? getComputedStyle(sv).display : 'none',
      threedDisplay: threed ? getComputedStyle(threed).display : 'none',
    };
  });
}

function assertNoOverlap(
  boxes: ChromeBox[],
  viewportLabel: string,
  label: string,
): void {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(
        boxesOverlap(a, b),
        `${label}: ${a.sel} overlaps ${b.sel} at ${viewportLabel}`,
      ).toBe(false);
    }
  }
}

function assertLeftStackOrder(
  leftStack: ChromeBox[],
  viewportLabel: string,
  slider: ChromeBox | null = null,
): void {
  const orderIndex = (sel: string) => LEFT_STACK_ORDER.indexOf(sel as (typeof LEFT_STACK_ORDER)[number]);
  const ordered = [...leftStack].sort((a, b) => orderIndex(a.sel) - orderIndex(b.sel));
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i]!;
    const b = ordered[i + 1]!;
    expect(
      a.y < b.y,
      `left stack order at ${viewportLabel}: ${a.sel} (y=${a.y}) should be above ${b.sel} (y=${b.y})`,
    ).toBe(true);
  }

  const home = leftStack.find((b) => b.sel === '.tc-ctl-nav-home-btn');
  const zoomIn = leftStack.find((b) => b.sel === '.tc-ctl-nav .tc-ctl-nav-btn-zoomin');
  const zoomOut = leftStack.find((b) => b.sel === '.tc-ctl-nav .tc-ctl-nav-btn-zoomout');
  const threed = leftStack.find((b) => b.sel === '.tc-ctl-3d');
  if (home && zoomIn) {
    expect(
      boxesOverlap(home, zoomIn),
      `BAD stack: home overlaps zoom+ at ${viewportLabel}`,
    ).toBe(false);
  }
  const fscreen =
    leftStack.find((b) => b.sel === '.tc-ctl-fscreen') ??
    leftStack.find((b) => b.sel === 'button.tc-ctl-fscreen-btn');
  const sv = leftStack.find((b) => b.sel === '.tc-ctl-sv');
  if (fscreen && sv) {
    expect(
      boxesOverlap(fscreen, sv),
      `BAD stack: fscreen overlaps Street View at ${viewportLabel}`,
    ).toBe(false);
  }
  if (zoomIn && zoomOut && threed) {
    expect(
      zoomIn.y < zoomOut.y && zoomOut.y < threed.y,
      `zoom order at ${viewportLabel}: + (${zoomIn.y}) < − (${zoomOut.y}) < 3D (${threed.y})`,
    ).toBe(true);
  }
  if (slider && zoomIn && zoomOut) {
    expect(
      zoomIn.y < slider.y && slider.y < zoomOut.y,
      `slider between +/− at ${viewportLabel}: + (${zoomIn.y}) < slider (${slider.y}) < − (${zoomOut.y})`,
    ).toBe(true);
  }
}

function assertSearchRightOfTools(
  layout: MapChromeLayout,
  viewportLabel: string,
): void {
  const tools = layout.leftStack.find((b) => b.sel === '#tools-tab');
  expect(layout.search, `search must be visible at ${viewportLabel}`).toBeTruthy();
  expect(tools, `tools tab must be visible at ${viewportLabel}`).toBeTruthy();
  if (!layout.search || !tools) {
    return;
  }
  expect(
    layout.search.x + 0.5 >= tools.x + tools.width,
    `search must sit right of tools at ${viewportLabel}: search.x=${layout.search.x} tools.right=${tools.x + tools.width}`,
  ).toBe(true);
  for (const tool of layout.leftStack) {
    expect(
      boxesOverlap(layout.search, tool),
      `search overlaps ${tool.sel} at ${viewportLabel}`,
    ).toBe(false);
  }
}

function assertOpaqueLeftChrome(layout: MapChromeLayout, viewportLabel: string): void {
  for (const sel of ['#tools-tab', '#legend-tab'] as const) {
    expect(
      layout.opacities[sel]! >= 0.99,
      `${sel} opacity at ${viewportLabel}: ${layout.opacities[sel]}`,
    ).toBe(true);
  }
  const fscreenOpacity = Math.max(
    layout.opacities['.tc-ctl-fscreen'] ?? 0,
    layout.opacities['button.tc-ctl-fscreen-btn'] ?? 0,
  );
  if (layout.leftStack.some((b) => b.sel.includes('fscreen'))) {
    expect(
      fscreenOpacity >= 0.99,
      `fscreen opacity at ${viewportLabel}: ${fscreenOpacity}`,
    ).toBe(true);
  }
}

/** Overview hides only on very short heights; must stay visible at 768×576. */
const OVERVIEW_MIN_VIEWPORT_HEIGHT = 401;

function assertRightChrome(
  layout: MapChromeLayout,
  viewport: { width: number; height: number },
  viewportLabel: string,
): void {
  expect(layout.capasTab, `Capas tab must be visible at ${viewportLabel}`).toBeTruthy();
  const capas = layout.capasTab!;
  const tools = layout.leftStack.find((b) => b.sel === '#tools-tab');
  const mapRight = layout.mapBox
    ? layout.mapBox.x + layout.mapBox.width
    : viewport.width;
  const mapBottom = layout.mapBox
    ? layout.mapBox.y + layout.mapBox.height
    : viewport.height;
  const mapMidX = layout.mapBox
    ? layout.mapBox.x + layout.mapBox.width / 2
    : viewport.width / 2;
  expect(
    Math.abs(capas.width - 40) <= 4 && Math.abs(capas.height - 40) <= 4,
    `Capas size at ${viewportLabel}: ${capas.width}x${capas.height} (want ~40x40)`,
  ).toBe(true);
  expect(
    capas.x > mapMidX,
    `Capas must be on the right at ${viewportLabel}: x=${capas.x}`,
  ).toBe(true);
  if (tools) {
    expect(
      Math.abs(capas.y - tools.y) <= 4,
      `Capas must align with tools at ${viewportLabel}: capas.y=${capas.y} tools.y=${tools.y}`,
    ).toBe(true);
  }
  const capasRightGap = mapRight - (capas.x + capas.width);
  expect(
    Math.abs(capasRightGap - 20) <= 8,
    `Capas right inset at ${viewportLabel}: ${capasRightGap} (want ~20)`,
  ).toBe(true);

  if (viewport.height < OVERVIEW_MIN_VIEWPORT_HEIGHT) {
    expect(
      layout.overviewTab,
      `overview must hide before clipping/Capas overlap at ${viewportLabel}`,
    ).toBeNull();
    return;
  }

  expect(layout.overviewTab, `overview tab must be visible at ${viewportLabel}`).toBeTruthy();
  const overview = layout.overviewTab!;
  expect(
    Math.abs(overview.width - 40) <= 4 && Math.abs(overview.height - 40) <= 4,
    `overview size at ${viewportLabel}: ${overview.width}x${overview.height} (want ~40x40; clipped/broken if smaller)`,
  ).toBe(true);
  // Fully inside the map — rejects the corner-clipped "broken" glyph.
  expect(
    overview.x >= (layout.mapBox?.x ?? 0) - 1 &&
      overview.y >= (layout.mapBox?.y ?? 0) - 1 &&
      overview.x + overview.width <= mapRight + 1 &&
      overview.y + overview.height <= mapBottom + 1,
    `overview must stay inside map at ${viewportLabel} (not clipped)`,
  ).toBe(true);
  const overviewRightGap = mapRight - (overview.x + overview.width);
  const overviewBottomGap = mapBottom - (overview.y + overview.height);
  expect(
    Math.abs(overviewRightGap - 20) <= 8,
    `overview right inset at ${viewportLabel}: ${overviewRightGap} (want ~20)`,
  ).toBe(true);
  expect(
    Math.abs(overviewBottomGap - 80) <= 10,
    `overview bottom inset at ${viewportLabel}: ${overviewBottomGap} (want ~80)`,
  ).toBe(true);
  expect(
    boxesOverlap(capas, overview),
    `Capas must not cover overview at ${viewportLabel}`,
  ).toBe(false);
}

function leftChromeClip(
  leftStack: ChromeBox[],
): { x: number; y: number; width: number; height: number } | undefined {
  if (leftStack.length === 0) {
    return undefined;
  }
  const minX = Math.min(...leftStack.map((b) => b.x));
  const minY = Math.min(...leftStack.map((b) => b.y));
  const maxX = Math.max(...leftStack.map((b) => b.x + b.width));
  const maxY = Math.max(...leftStack.map((b) => b.y + b.height));
  const pad = 8;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.max(2, maxX - minX + pad * 2),
    height: Math.max(2, maxY - minY + pad * 2),
  };
}

async function readTabChrome(page: Page, sel: '#tools-tab' | '#legend-tab') {
  return page.locator(sel).evaluate((el) => {
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return {
      backgroundColor: s.backgroundColor,
      backgroundImage: s.backgroundImage,
      top: s.top,
      y: b.y,
      visible: s.display !== 'none' && s.visibility !== 'hidden' && b.width > 0,
    };
  });
}

test.describe('Map chrome responsive (#135)', () => {
  test('capture status shots for GitHub progress update', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndOpenMap(page);

    // Partner-reported viewport matrix from #135.
    for (const viewport of [
      { width: 480, height: 360 },
      { width: 768, height: 576 },
      { width: 1024, height: 768 },
    ] as const) {
      const tag = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);

      await page.evaluate(() => {
        document.querySelector('.tc-tools-panel')?.classList.add('tc-collapsed-right');
        document.querySelector('.tc-ovmap-panel')?.classList.add('tc-collapsed-right');
        document.querySelector('.tc-left-panel')?.classList.add('tc-collapsed-left');
      });
      await page.waitForTimeout(350);
      await captureIssue135Shot(page, testInfo, `status-${tag}-01-default-COLLAPSED.png`);

      await page.locator('.tc-tools-panel > h1').click();
      await page.waitForTimeout(350);
      if (viewport.width === 480) {
        const capas = await page.evaluate(() => {
          const panel = document.querySelector('.tc-tools-panel') as HTMLElement;
          const h1 = document.querySelector('.tc-tools-panel > h1') as HTMLElement;
          const pb = panel.getBoundingClientRect();
          const hb = h1.getBoundingClientRect();
          const hs = getComputedStyle(h1);
          return {
            panelW: pb.width,
            closeTop: hs.top,
            closeX: hb.x,
            panelX: pb.x,
            gap: pb.x - (hb.x + hb.width),
          };
        });
        expect(capas.panelW, 'Capas drawer ≤160px at 480').toBeLessThanOrEqual(161);
        expect(capas.closeTop).toBe('56px');
        expect(Math.abs(capas.gap - 20), `Capas close gap ${capas.gap}`).toBeLessThanOrEqual(2);
      }
      if (viewport.width === 480 || viewport.width === 768) {
        const contentTop = await page.evaluate(() => {
          const panel = document.querySelector('.tc-tools-panel') as HTMLElement;
          const content = document.querySelector(
            '.tc-tools-panel > .tc-panel-content',
          ) as HTMLElement;
          return {
            panelY: panel.getBoundingClientRect().y,
            contentY: content.getBoundingClientRect().y,
            marginTop: getComputedStyle(content).marginTop,
          };
        });
        expect(
          contentTop.marginTop,
          `Capas open must not reserve empty SITNA header slot at ${tag}`,
        ).toBe('0px');
        expect(
          Math.abs(contentTop.contentY - contentTop.panelY) <= 1,
          `Capas content must start at panel top (no seam gap) at ${tag}: contentY=${contentTop.contentY} panelY=${contentTop.panelY}`,
        ).toBe(true);
      }
      await captureIssue135Shot(page, testInfo, `status-${tag}-02-capas-OPEN-close.png`);

      await page.locator('.tc-tools-panel > h1').click();
      await page.waitForTimeout(350);
      // Overview may be CSS-hidden on very short heights; still attempt open shot.
      const overviewTab = page.locator('.tc-ovmap-panel > h1');
      if (await overviewTab.isVisible()) {
        await overviewTab.click();
        await page.waitForTimeout(400);
        await captureIssue135Shot(page, testInfo, `status-${tag}-03-overview-OPEN-close.png`);
        await overviewTab.click();
        await page.waitForTimeout(350);
      } else {
        await captureIssue135Shot(page, testInfo, `status-${tag}-03-overview-HIDDEN.png`);
      }

      const toolsTab = page.locator('#tools-tab');
      if (await toolsTab.isVisible()) {
        await toolsTab.click();
        await page.waitForTimeout(350);
        if (viewport.width === 480) {
          const left = await page.evaluate(() => {
            const panel = document.querySelector('.tc-left-panel') as HTMLElement;
            const tools = document.querySelector('#tools-tab') as HTMLElement;
            const pb = panel.getBoundingClientRect();
            const tb = tools.getBoundingClientRect();
            const ts = getComputedStyle(tools);
            return {
              panelW: pb.width,
              closeTop: ts.top,
              closeRight: ts.right,
              closeX: tb.x,
              panelRight: pb.x + pb.width,
              gap: tb.x - (pb.x + pb.width),
              closeY: tb.y,
              contentY: (
                document.querySelector(
                  '.tc-left-panel > .tc-panel-content',
                ) as HTMLElement
              ).getBoundingClientRect().y,
            };
          });
          expect(left.panelW, 'left drawer ≤160px at 480').toBeLessThanOrEqual(161);
          expect(left.closeTop, 'left close at drawer top').toBe('8px');
          expect(left.closeRight).toBe('-60px');
          expect(Math.abs(left.gap - 20), `left close gap ${left.gap}`).toBeLessThanOrEqual(2);
          expect(
            Math.abs(left.closeY - left.contentY - 8) <= 2,
            `left close y=${left.closeY} vs content y=${left.contentY}`,
          ).toBe(true);
        }
        await captureIssue135Shot(page, testInfo, `status-${tag}-04-left-tools-OPEN-close.png`);
        await toolsTab.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('left panel close control is red arrow at opener height for tools and legend', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndOpenMap(page);

    const assertCloseAtOpenerHeight = async (
      sel: '#tools-tab' | '#legend-tab',
      expectedTopPx: number,
    ) => {
      const before = await readTabChrome(page, sel);
      expect(before.visible, `${sel} opener must be visible`).toBe(true);

      await page.locator(sel).click();
      await expect(page.locator('.tc-left-panel')).not.toHaveClass(/tc-collapsed-left/);

      await expect
        .poll(async () => {
          const chrome = await readTabChrome(page, sel);
          return (
            chrome.visible &&
            /closeIcon/.test(chrome.backgroundImage) &&
            /rgba?\(181,\s*24,\s*24/.test(chrome.backgroundColor)
          );
        }, { message: `${sel} close must become red closeIcon` })
        .toBe(true);

      const open = await readTabChrome(page, sel);
      expect(
        Math.abs(Number.parseFloat(open.top) - expectedTopPx) <= 1,
        `${sel} close top ${open.top} must match opener ladder ${expectedTopPx}px`,
      ).toBe(true);
      expect(
        Math.abs(open.y - before.y) <= 2,
        `${sel} close y=${open.y} must match opener y=${before.y}`,
      ).toBe(true);

      await page.locator(sel).click();
      await expect(page.locator('.tc-left-panel')).toHaveClass(/tc-collapsed-left/);
    };

    await assertCloseAtOpenerHeight('#tools-tab', 64);
    await assertCloseAtOpenerHeight('#legend-tab', 108);
  });

  test('Capas and overview close stay at opener height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndOpenMap(page);

    const assertRightCloseAtOpenerHeight = async (
      panelSel: '.tc-tools-panel' | '.tc-ovmap-panel',
      tabSel: string,
    ) => {
      await page.evaluate((sel) => {
        document.querySelector(sel)?.classList.add('tc-collapsed-right');
      }, panelSel);

      const before = await page.locator(tabSel).evaluate((el) => {
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { y: b.y, visible: b.width > 0 && s.visibility !== 'hidden' };
      });
      expect(before.visible, `${tabSel} opener must be visible`).toBe(true);

      await page.locator(tabSel).click();
      await expect(page.locator(panelSel)).not.toHaveClass(/tc-collapsed-right/);

      const open = await page.locator(`${panelSel} > h1`).evaluate((el) => {
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return {
          y: b.y,
          backgroundColor: s.backgroundColor,
          backgroundImage: s.backgroundImage,
        };
      });
      expect(
        open.backgroundImage,
        `${panelSel} close must use right-facing mapaCerrarReverse`,
      ).toMatch(/mapaCerrarReverse/);
      expect(
        open.backgroundColor,
        `${panelSel} close must be red (#b51818)`,
      ).toMatch(/rgba?\(181,\s*24,\s*24/);
      expect(
        Math.abs(open.y - before.y) <= 3,
        `${panelSel} close y=${open.y} must match opener y=${before.y}`,
      ).toBe(true);

      if (panelSel === '.tc-ovmap-panel') {
        const contentShadow = await page
          .locator(`${panelSel} > #tc-slot-ovmap`)
          .evaluate((el) => getComputedStyle(el).boxShadow);
        expect(
          contentShadow,
          'open overview must keep a Capas-like content edge',
        ).toMatch(/rgba?\(0,\s*0,\s*0/);
        expect(contentShadow, 'open overview edge must not be none').not.toBe('none');
      }

      await page.locator(`${panelSel} > h1`).click();
      await expect(page.locator(panelSel)).toHaveClass(/tc-collapsed-right/);
    };

    await assertRightCloseAtOpenerHeight('.tc-tools-panel', '.tc-tools-panel > h1');
    await assertRightCloseAtOpenerHeight(
      '.tc-ovmap-panel',
      '.tc-ovmap-panel > h1',
    );
  });

  const viewports = [
    { width: 480, height: 360 },
    { width: 768, height: 576 },
    { width: 1024, height: 768 },
  ] as const;

  for (const viewport of viewports) {
    test(`chrome does not overlap at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      const tag = `${viewport.width}x${viewport.height}`;

      // Login at a desktop size so the login button stays in-viewport.
      await page.setViewportSize({ width: 1280, height: 800 });
      await loginAndOpenMap(page);
      await page.setViewportSize(viewport);

      const collapseRightChrome = async () => {
        await page.evaluate(() => {
          const tools = document.querySelector('.tc-tools-panel');
          tools?.classList.add('tc-collapsed-right');
          const ov = document.querySelector('.tc-ovmap-panel');
          ov?.classList.add('tc-collapsed-right');
          ov?.classList.remove('tc-disabled');
        });
      };

      // Default chrome: Capas + overview panels collapsed; overview tab visible.
      await collapseRightChrome();
      await page.waitForTimeout(350);
      await captureIssue135Shot(page, testInfo, `e2e-like-${tag}-capas-COLLAPSED.png`);

      const collapsedLayout = await readMapChromeLayout(page);
      expect(
        collapsedLayout.capasPanel,
        `Capas panel must not be expanded at ${tag}`,
      ).toBeNull();
      await expect(
        page.locator('.tc-ovmap-panel'),
        `overview panel must stay collapsed at ${tag}`,
      ).toHaveClass(/tc-collapsed-right/);
      // Overview body rides off-screen with translateX(100%); tab stays visible.
      await expect
        .poll(async () => {
          const box = await page.locator('#tc-slot-ovmap').boundingBox();
          if (!box) {
            return true;
          }
          return box.x >= viewport.width - 2;
        }, `overview mini-map must stay off-screen when collapsed at ${tag}`)
        .toBe(true);
      expect(
        collapsedLayout.leftStack.some((b) => b.sel === '#tools-tab'),
        `tools tab must stay visible/upright at ${tag}`,
      ).toBe(true);
      expect(
        await page.locator('#tools-tab').evaluate((el) => getComputedStyle(el).transform),
        `tools tab must not mirror/rotate at ${tag}`,
      ).toMatch(/none|matrix\(1,\s*0,\s*0,\s*1/);
      if (viewport.width <= 480) {
        expect(collapsedLayout.svDisplay).toBe('none');
        expect(collapsedLayout.threedDisplay).toBe('none');
      }
      expect(collapsedLayout.capasGlyphCount).toBeLessThanOrEqual(1);
      assertNoOverlap(collapsedLayout.candidates, tag, 'Capas COLLAPSED chrome');
      assertNoOverlap(collapsedLayout.leftStack, tag, 'Capas COLLAPSED left stack');
      assertLeftStackOrder(collapsedLayout.leftStack, tag, collapsedLayout.slider);
      assertSearchRightOfTools(collapsedLayout, tag);
      assertOpaqueLeftChrome(collapsedLayout, tag);
      assertRightChrome(collapsedLayout, viewport, tag);

      // Capas OPEN (partner-equivalent collision guards).
      await page.locator('.tc-tools-panel').evaluate((panel) => {
        panel.classList.remove('tc-collapsed-right');
      });
      await captureIssue135Shot(page, testInfo, `partner-like-${tag}-capas-OPEN.png`);

      const openLayout = await readMapChromeLayout(page);
      await captureIssue135Shot(
        page,
        testInfo,
        `left-chrome-${tag}.png`,
        leftChromeClip(openLayout.leftStack),
      );

      expect(
        openLayout.leftStack.some((b) => b.sel === '.tc-ctl-nav-home-btn'),
        `home control must be visible at ${tag} (enable sitna.navBar in setup)`,
      ).toBe(true);
      expect(
        openLayout.leftStack.some((b) => b.sel === '.tc-ctl-nav .tc-ctl-nav-btn-zoomin'),
        `zoom+ must be visible at ${tag}`,
      ).toBe(true);

      assertNoOverlap(openLayout.leftStack, tag, 'Capas OPEN left stack');
      assertLeftStackOrder(openLayout.leftStack, tag, openLayout.slider);
      assertSearchRightOfTools(openLayout, tag);
      assertOpaqueLeftChrome(openLayout, tag);

      if (openLayout.capasPanel) {
        for (const tool of openLayout.leftStack) {
          expect(
            boxesOverlap(tool, openLayout.capasPanel),
            `worst-case: ${tool.sel} overlaps Capas panel at ${tag}`,
          ).toBe(false);
        }
      }
      if (openLayout.wlmActionBoxes.length >= 2) {
        assertNoOverlap(openLayout.wlmActionBoxes, tag, 'Capas OPEN WLM actions');
      }

      await collapseRightChrome();
    });
  }
});
