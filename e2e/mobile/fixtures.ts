import path from 'node:path';

export const MOBILE_FIXTURE_FILE = path.join(process.cwd(), 'e2e', '.auth', 'mobile.json');
export const EDITION_APP_ID = 1;
export const EDITION_TERRITORY_ID = 1;
export const EDITION_ROLE_ID = 1;
export const TOURISTIC_APP_ID = 6;
export const WMTS_SERVICE_ID = 1;
export const WMTS_LAYER_ID = 1;
export const WMTS_UPSTREAM_URL = 'http://127.0.0.1:18094/wmts';

export const BACKEND = 'http://localhost:18081/backend';
export const MIDDLEWARE = 'http://localhost:18081/middleware';
export const GATEWAY = 'http://localhost:18081';

export function uniqueEditionUsername(): string {
  return `e2e-edition-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function generateEditionPassword(): string {
  return `E2e!${Date.now().toString(36)}A1`;
}

export type MobileFixture = {
  username: string;
  password: string;
  appId: number;
  territoryId: number;
  serviceId: number;
  layerId: number;
};
