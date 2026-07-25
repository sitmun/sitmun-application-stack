import { expect, type Page } from '@playwright/test';
import {
  APP_ID,
  isBackendRequest,
  MIA_PARENT_TASK_ID,
  NON_RADIO_ROOT_FOLDER_TITLE,
  QUERYABLE_LEAF_NODE_ID,
  RADIO_FOLDER_TITLE,
  readViewerCredentials,
  TERRITORY_ID,
} from '../fixtures';

export async function loginAndOpenMap(
  page: Page,
  options?: { appId?: number; territoryId?: number },
): Promise<void> {
  const appId = options?.appId ?? APP_ID;
  const territoryId = options?.territoryId ?? TERRITORY_ID;
  const credentials = await readViewerCredentials();

  await page.addInitScript(() => {
    localStorage.setItem('language', 'ca');
  });

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
        `/config/client/profile/${appId}/${territoryId}`,
        'GET',
      ) && response.ok(),
  );

  await page.goto(`/user/map/${appId}/${territoryId}`, {
    waitUntil: 'domcontentloaded',
  });
  const profileResponse = await profile;
  const profileBody = (await profileResponse.json()) as {
    tasks?: Array<{ 'ui-control'?: string; typeId?: number; cartographyId?: string }>;
  };
  expect(
    profileBody.tasks?.some((task) => task['ui-control'] === 'sitna.moreInfoAdvanced'),
    'profile must include sitna.moreInfoAdvanced (setup task-availability)',
  ).toBeTruthy();
  expect(
    profileBody.tasks?.some(
      (task) => task.typeId === 16 && String(task.cartographyId) === '6',
    ),
    'profile must include MIA parent on cartography 6',
  ).toBeTruthy();

  await page.locator('#tc-slot-toc').waitFor({ state: 'attached', timeout: 90_000 });
  await page.locator('.tc-tools-panel').evaluate((panel) => {
    panel.classList.remove('tc-collapsed-right');
  });
}

export async function expandNodeByTitle(page: Page, title: string): Promise<void> {
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

export async function loadQueryableLeafIntoCapas(page: Page): Promise<void> {
  const wlm = page.locator('#tc-slot-wlm');
  await wlm.waitFor({ state: 'attached', timeout: 30_000 });
  await wlm.evaluate((el) => el.classList.remove('tc-collapsed'));
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

export type MiaGfiFeatureAttrs = Record<string, unknown>;

export type MiaGfiSimulateLayer = {
  name: string;
  features: MiaGfiFeatureAttrs[];
};

function getFeatureInfoControl(page: Page): Promise<{
  ok: true;
} | { ok: false; error: string }> {
  return page.evaluate(() => {
    const w = window as unknown as {
      TC?: {
        Map?: {
          get: (el: Element) => {
            controls?: Array<{ responseCallback?: (o: unknown) => void }>;
          };
        };
        control?: { FeatureInfo?: new () => unknown };
      };
    };
    const mapEl = document.querySelector('.tc-map');
    if (!w.TC?.Map?.get || !mapEl) {
      return { ok: false as const, error: 'TC.Map not available' };
    }
    const map = w.TC.Map.get(mapEl);
    const FeatureInfo = w.TC.control?.FeatureInfo;
    const fi = (map.controls || []).find(
      (ctl) => FeatureInfo && ctl instanceof (FeatureInfo as unknown as Function),
    );
    if (!fi?.responseCallback) {
      return {
        ok: false as const,
        error: 'FeatureInfo control with responseCallback not found',
      };
    }
    return { ok: true as const };
  });
}

/** Simulated GetFeatureInfo — injects FeatureInfo.responseCallback (not a real WMS GFI). */
export async function simulateGetFeatureInfo(
  page: Page,
  attrs: MiaGfiFeatureAttrs = { id: 1, name: 'e2e-mia' },
): Promise<void> {
  await simulateGetFeatureInfoLayers(page, [
    { name: '34_TOPO_TX', features: [attrs] },
  ]);
}

/**
 * Simulated multi-layer / multi-feature GetFeatureInfo via responseCallback.
 * Feature objects are kept on window.__sitmunE2eMiaFeatures for selection helpers.
 */
export async function simulateGetFeatureInfoLayers(
  page: Page,
  layers: MiaGfiSimulateLayer[],
): Promise<void> {
  const ready = await getFeatureInfoControl(page);
  if (!ready.ok) {
    throw new Error(ready.error);
  }

  await page.evaluate((layerDefs) => {
    const w = window as unknown as {
      TC?: {
        Map?: {
          get: (el: Element) => {
            controls?: Array<{ responseCallback?: (o: unknown) => void }>;
          };
        };
        control?: { FeatureInfo?: new () => unknown };
      };
      __sitmunE2eMiaFeatures?: unknown[];
      __sitmunE2eMiaFeatureInfo?: { responseCallback?: (o: unknown) => void };
    };
    const mapEl = document.querySelector('.tc-map');
    if (!w.TC?.Map?.get || !mapEl) {
      throw new Error('TC.Map not available');
    }
    const map = w.TC.Map.get(mapEl);
    const FeatureInfo = w.TC.control?.FeatureInfo;
    const fi = (map.controls || []).find(
      (ctl) => FeatureInfo && ctl instanceof (FeatureInfo as unknown as Function),
    );
    if (!fi?.responseCallback) {
      throw new Error('FeatureInfo control with responseCallback not found');
    }

    const allFeatures: Array<{ getData: () => Record<string, unknown> }> = [];
    const services = [
      {
        layers: layerDefs.map((layer) => {
          const features = layer.features.map((attrs) => {
            const feature = { getData: () => attrs };
            allFeatures.push(feature);
            return feature;
          });
          return { name: layer.name, features };
        }),
      },
    ];
    w.__sitmunE2eMiaFeatures = allFeatures;
    w.__sitmunE2eMiaFeatureInfo = fi;
    fi.responseCallback({ services });
  }, layers);
}

/**
 * Fire SITNA popup.tc as if FeatureInfo selected another GFI feature (by index
 * into window.__sitmunE2eMiaFeatures from the last simulateGetFeatureInfoLayers).
 */
export async function selectMiaGfiFeature(
  page: Page,
  featureIndex: number,
): Promise<void> {
  await page.evaluate((index) => {
    const w = window as unknown as {
      TC?: {
        Map?: {
          get: (el: Element) => {
            trigger?: (name: string, data: unknown) => void;
            controls?: unknown[];
          };
        };
        control?: { FeatureInfo?: new () => unknown };
      };
      __sitmunE2eMiaFeatures?: unknown[];
      __sitmunE2eMiaFeatureInfo?: unknown;
    };
    const features = w.__sitmunE2eMiaFeatures;
    const fi = w.__sitmunE2eMiaFeatureInfo;
    if (!features?.[index]) {
      throw new Error(`E2E MIA feature index ${index} missing`);
    }
    if (!fi) {
      throw new Error('E2E FeatureInfo control missing');
    }
    const mapEl = document.querySelector('.tc-map');
    if (!w.TC?.Map?.get || !mapEl) {
      throw new Error('TC.Map not available');
    }
    const map = w.TC.Map.get(mapEl);
    if (typeof map.trigger !== 'function') {
      throw new Error('map.trigger not available');
    }
    map.trigger('popup.tc', {
      control: {
        caller: fi,
        currentFeature: features[index],
      },
    });
  }, featureIndex);
}

export async function openPublicDashboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'ca');
  });
  await page.goto('/auth/login');
  await expect(page.locator('h1')).toBeVisible();
  const dashboardApps = page.waitForResponse(
    (response) => isBackendRequest(response, '/config/client/dashboard/applications', 'GET') && response.ok(),
  );
  await page
    .getByRole('button', { name: /Acceso público|Accés públic|Public access/i })
    .click();
  await dashboardApps;
  await expect(page).toHaveURL(/\/public\/dashboard/);
}

/** Enable Capas GFI toggle so map clicks issue GetFeatureInfo for the loaded leaf. */
export async function enableCapasGfi(page: Page): Promise<void> {
  const gfi = page.locator('#tc-slot-wlm sitna-toggle.sitmun-wlm-gfi, #tc-slot-wlm .sitmun-wlm-gfi').first();
  await expect(gfi).toBeVisible({ timeout: 30_000 });
  const checked = await gfi.evaluate((el) => el.hasAttribute('checked'));
  if (!checked) {
    await gfi.click();
  }
}

export type MiaRenderDeferred = {
  resolve: (body: unknown) => void;
};

/**
 * Hold each /more-info-advanced/render POST until the test resolves its deferred.
 * Gate on `deferreds.length` (event-driven) — do not sleep around the 350ms open delay.
 */
export async function installMiaRenderDeferredRoute(
  page: Page,
): Promise<MiaRenderDeferred[]> {
  const deferreds: MiaRenderDeferred[] = [];
  await page.route(
    '**/api/tasks/template/more-info-advanced/render**',
    async (route) => {
      const body = await new Promise<unknown>((resolve) => {
        deferreds.push({ resolve });
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
  return deferreds;
}

export function miaRenderTasksBody(
  marker: string,
  taskId: number = MIA_PARENT_TASK_ID,
): unknown {
  return {
    tasks: [
      {
        taskId,
        title: 'E2E MIA',
        html: `<p data-e2e-mia-marker="${marker}">${marker}</p>`,
      },
    ],
  };
}
