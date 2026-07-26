import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const adminAuthFile = path.join(process.cwd(), 'e2e/.auth/admin.json');

/**
 * Cross-stack MIA / Plantilla suite: shared H2, admin, viewer, proxy, WMS stub.
 * Do not run concurrently with admin, viewer, application-contact, or mobile suites.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: [
    {
      command: 'npm run e2e:backend',
      url: 'http://localhost:18080/api/dashboard/health',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:wms-stub',
      url: 'http://127.0.0.1:18093/health',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: 'npm run e2e:proxy',
      url: 'http://localhost:18082/actuator/health',
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:admin',
      url: 'http://localhost:4300',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:viewer:app',
      url: 'http://localhost:4400',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /admin\/auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'viewer-setup',
      testMatch: /viewer\/setup\/.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mia-cross',
      testMatch: /mia-cross\/.*\.spec\.ts/,
      dependencies: ['setup', 'viewer-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
    },
  ],
});
