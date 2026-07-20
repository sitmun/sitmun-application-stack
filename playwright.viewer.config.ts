import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/viewer',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4400',
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
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:wms-stub',
      url: 'http://127.0.0.1:18093/health',
      timeout: 30_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: 'npm run e2e:proxy',
      url: 'http://localhost:18082/actuator/health',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:viewer:app',
      url: 'http://localhost:4400',
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
  ],
  projects: [
    {
      name: 'viewer-setup',
      testMatch: /setup\/.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'viewer-public',
      testMatch: /(public-access|language-chrome)\.spec\.ts/,
      dependencies: ['viewer-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'viewer-password',
      testMatch: /password-access\.spec\.ts/,
      dependencies: ['viewer-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'viewer-catalog',
      testMatch: /layer-catalog\.spec\.ts/,
      dependencies: ['viewer-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
