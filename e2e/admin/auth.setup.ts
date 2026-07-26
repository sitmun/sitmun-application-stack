import { test as setup, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const adminAuthFile = path.join(process.cwd(), 'e2e/.auth/admin.json');

setup('authenticate admin via API', async ({ request }) => {
  await mkdir(path.dirname(adminAuthFile), { recursive: true });

  const login = await request.post('/backend/api/authenticate/admin', {
    data: {
      username: 'admin',
      password: 'admin',
    },
  });
  expect(login.ok(), `admin login failed: ${login.status()} ${await login.text()}`).toBeTruthy();

  const account = await request.get('/backend/api/account', {
    headers: {
      'X-SITMUN-Client': 'admin',
    },
  });
  expect(account.ok(), `account check failed: ${account.status()} ${await account.text()}`).toBeTruthy();

  await request.storageState({ path: adminAuthFile });
});
