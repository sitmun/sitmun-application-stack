import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page, Response } from '@playwright/test';

export const APP_ID = 1;
export const TERRITORY_ID = 1;
export const ROLE_ID = 1;
export const SERVICE_ID = 3;
/** WMS services backing Topográficos leaves used by catalog E2E. */
export const CATALOG_LEAF_SERVICE_IDS = [4, 5] as const;

/** Seed UI tasks required for Capas / layer catalog / legend (missing from STM_AVAIL_TSK). */
export const LAYER_CATALOG_TASK_ID = 11;
export const LEGEND_TASK_ID = 12;
export const WORK_LAYER_MANAGER_TASK_ID = 31;
/** Seed STM_TASK id for sitna.basemapSelector (STM_TSK_UI TUI_ID 2). */
export const BASEMAP_SELECTOR_TASK_ID = 2;
/**
 * Map chrome tasks for #135 left-toolbar stack (missing from STM_AVAIL_TSK).
 * Mirrors partner Menorca profile 12/4: navBar, fullScreen, streetView, threed.
 */
export const FULL_SCREEN_TASK_ID = 9;
export const NAV_BAR_TASK_ID = 16;
/** Bottom-right overview (folded map) tab for #135 right-chrome checks. */
export const OVERVIEW_MAP_TASK_ID = 18;
/** Search control — must stay clear of the left icon column (#135). */
export const SEARCH_TASK_ID = 24;
export const STREET_VIEW_TASK_ID = 26;
export const THREE_D_TASK_ID = 27;
/** Seed UI control sitna.moreInfoAdvanced (STM_TASK 43 / STM_TSK_UI 34). */
export const MIA_CONTROL_TASK_ID = 43;
/** Seed MIA parent on Toponímia cartography GEO_ID 6 (STM_TASK 42, typeId 16). */
export const MIA_PARENT_TASK_ID = 42;
/** Seed Feature Information control — needed for identify → MIA callback path. */
export const FEATURE_INFO_TASK_ID = 8;

/**
 * Catalog E2E uses the visible Topográficos branch (Ortofotos is filtered out of the
 * seed catalog in H2). node/2 = radio+loadData; node/5 = checkbox loadData only.
 */
export const RADIO_FOLDER_NODE_ID = 'node/2';
export const RADIO_FOLDER_TITLE = 'Topográfico 1:50.000';
export const RADIO_FIRST_CHILD_NODE_ID = 'node/3';
export const RADIO_SECOND_CHILD_NODE_ID = 'node/4';
export const CHECKBOX_LOAD_FOLDER_NODE_ID = 'node/5';
export const CHECKBOX_LOAD_FOLDER_TITLE = 'Topográfico 1:25.000';
/** Non-radio cartography leaf under checkbox-load folder (seed GEO_ID 5). */
export const NON_RADIO_LEAF_NODE_ID = 'node/6';
export const NON_RADIO_LEAF_TITLE = '1:25.000 ICGC';
export const NON_RADIO_ROOT_FOLDER_NODE_ID = 'node/1';
export const NON_RADIO_ROOT_FOLDER_TITLE = 'Topográficos';
export const RADIO_FOLDER_TREE_NODE_DB_ID = 2;
export const CHECKBOX_LOAD_FOLDER_TREE_NODE_DB_ID = 5;
/** Toponímia leaf under radio folder; seed cartography GEO_ID 6. */
export const QUERYABLE_LEAF_NODE_ID = 'node/3';
export const QUERYABLE_LEAF_TREE_NODE_DB_ID = 3;
export const QUERYABLE_LEAF_CARTOGRAPHY_ID = 6;
export const QUERYABLE_LEAF_TITLE = 'Toponímia';
/** Non-radio leaf under Topográfico 1:25.000 (seed GEO_ID 5). */
export const NON_RADIO_LEAF_CARTOGRAPHY_ID = 5;
/**
 * Profile maxScaleDenominator for Capas #92 E2E (Toponímia).
 * Zoomed-out OGC scales above this mark the Capas row notvisible.
 */
export const QUERYABLE_LEAF_MAX_SCALE_DENOMINATOR = 100_000;

/** Public applications used for responsible-institution / PoC email assertions. */
export const CONTACT_APP_ID = 2;
export const BLOCKED_CONTACT_APP_ID = 3;
export const CONTACT_APP_TITLE = 'SITMUN - Municipal';
export const BLOCKED_CONTACT_APP_TITLE = 'SITMUN - Supramunicipal';
export const CONTACT_INSTITUTION = 'E2E Eligible Institution';
export const BLOCKED_CONTACT_INSTITUTION = 'E2E Blocked Institution';
export const CONTACT_EMAIL = 'e2e-eligible-poc@example.com';
export const BLOCKED_CONTACT_EMAIL = 'e2e-blocked-poc@example.com';

export const PROXY_PATH = `/middleware/proxy/${APP_ID}/${TERRITORY_ID}/WMS/${SERVICE_ID}`;
export const CAPABILITIES_URL = `${PROXY_PATH}?SERVICE=WMS&REQUEST=GetCapabilities`;

export const UPSTREAM_USER = 'e2e-wms';
export const UPSTREAM_PASSWORD = 'e2e-wms-secret';
export const UPSTREAM_URL = 'http://127.0.0.1:18093/wms';

export const VIEWER_FIXTURE_FILE = path.join(
  process.cwd(),
  'e2e/.auth/viewer-fixture.json',
);

export type ViewerFixture = {
  username: string;
  password: string;
  userId: number;
  eligiblePocUserId: number;
  blockedPocUserId: number;
};

export type CapabilitiesResult = {
  status: number;
  contentType: string | null;
  body: string;
};

export function isBackendRequest(
  response: Response,
  apiPath: string,
  method?: string,
): boolean {
  const pathname = new URL(response.url()).pathname;
  const expected = `/backend/api${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
  if (pathname !== expected) {
    return false;
  }
  if (method && response.request().method() !== method) {
    return false;
  }
  return true;
}

export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
    timeout: 60_000,
  });
}

export async function waitForMiddlewareUrlInIndexedDb(page: Page): Promise<string> {
  await page.waitForFunction(
    async () => {
      return await new Promise<boolean>((resolve) => {
        const open = indexedDB.open('sitmun-sw-db');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('config')) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction('config', 'readonly');
          const request = tx.objectStore('config').get('middleware_url');
          request.onerror = () => {
            db.close();
            resolve(false);
          };
          request.onsuccess = () => {
            const value = request.result as { value?: string } | undefined;
            db.close();
            resolve(Boolean(value?.value));
          };
        };
      });
    },
    null,
    { timeout: 60_000 },
  );

  const middlewareUrl = await page.evaluate(async () => {
    return await new Promise<string | null>((resolve) => {
      const open = indexedDB.open('sitmun-sw-db');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('config', 'readonly');
        const request = tx.objectStore('config').get('middleware_url');
        request.onerror = () => {
          db.close();
          resolve(null);
        };
        request.onsuccess = () => {
          const value = request.result as { value?: string } | undefined;
          db.close();
          resolve(value?.value ?? null);
        };
      };
    });
  });

  if (!middlewareUrl) {
    throw new Error('middleware_url missing from IndexedDB');
  }

  await page.evaluate(async (url) => {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'MIDDLEWARE_URL', url });
  }, middlewareUrl);

  return middlewareUrl;
}

export async function waitForProxyTokenInIndexedDb(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      return await new Promise<boolean>((resolve) => {
        const open = indexedDB.open('sitmun-sw-db');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('tokens')) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction('tokens', 'readonly');
          const request = tx.objectStore('tokens').get('proxy_token');
          request.onerror = () => {
            db.close();
            resolve(false);
          };
          request.onsuccess = () => {
            const value = request.result as { token?: string } | undefined;
            db.close();
            resolve(Boolean(value?.token));
          };
        };
      });
    },
    null,
    { timeout: 30_000 },
  );
}

export async function hasProxyTokenInIndexedDb(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    return await new Promise<boolean>((resolve) => {
      const open = indexedDB.open('sitmun-sw-db');
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('tokens')) {
          db.close();
          resolve(false);
          return;
        }
        const tx = db.transaction('tokens', 'readonly');
        const request = tx.objectStore('tokens').get('proxy_token');
        request.onerror = () => {
          db.close();
          resolve(false);
        };
        request.onsuccess = () => {
          const value = request.result as { token?: string } | undefined;
          db.close();
          resolve(Boolean(value?.token));
        };
      };
    });
  });
}

export async function fetchCapabilities(page: Page): Promise<CapabilitiesResult> {
  return page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: 'same-origin' });
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: await response.text(),
    };
  }, CAPABILITIES_URL);
}

export async function readViewerCredentials(): Promise<ViewerFixture> {
  const raw = await readFile(VIEWER_FIXTURE_FILE, 'utf8');
  const fixture = JSON.parse(raw) as ViewerFixture;
  if (
    !fixture.username ||
    !fixture.password ||
    !fixture.userId ||
    !fixture.eligiblePocUserId ||
    !fixture.blockedPocUserId
  ) {
    throw new Error('viewer fixture is incomplete');
  }
  return fixture;
}

export function uniqueViewerUsername(): string {
  return `e2ev${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(
    0,
    50,
  );
}

export function generateViewerPassword(): string {
  return `E2eV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!`;
}
