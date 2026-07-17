import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page, Response } from '@playwright/test';

export const APP_ID = 1;
export const TERRITORY_ID = 1;
export const ROLE_ID = 1;
export const SERVICE_ID = 3;

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
  if (!fixture.username || !fixture.password || !fixture.userId) {
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
