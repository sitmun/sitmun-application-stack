import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/mobile',
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
    baseURL: 'http://localhost:18081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run e2e:backend:mobile',
      url: 'http://localhost:18080/api/dashboard/health',
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:mbtiles',
      url: 'http://127.0.0.1:18084/actuator/health',
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:proxy:mobile',
      url: 'http://localhost:18082/actuator/health',
      timeout: 120_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run e2e:wmts-stub',
      url: 'http://127.0.0.1:18094/health',
      timeout: 30_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      command: 'npm run e2e:mobile:gateway',
      url: 'http://127.0.0.1:18081/health',
      timeout: 30_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
  projects: [
    {
      name: 'mobile-setup',
      testMatch: /setup\/.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-api',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['mobile-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
