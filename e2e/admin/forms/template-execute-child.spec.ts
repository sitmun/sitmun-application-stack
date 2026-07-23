import { test, expect } from '../fixtures';

/**
 * Minimal Plantilla dry-run: ADMIN template APIs without required appId/terId (god mode).
 * TipTap/CSV stay in Jest; map MIA render stays in viewer E2E.
 *
 * Seed note: H2 has no typeId 15 Plantilla rows, and POST /api/tasks often drops
 * `properties` (JsonView), so creating a disposable child is unreliable. Use a seeded
 * Query task with scope `web-api-query-no-proxy` (resolveDirect → 200, no JDBC).
 */
test.describe('Plantilla template dry-run', () => {
  test('preview accepts ADMIN body without appId/terId', async ({ request }) => {
    const body = {
      templateTaskId: null,
      templateHtml: '<p>e2e-preview</p>',
      context: {},
      knownTaskReferences: [],
    };

    const response = await request.post('/backend/api/tasks/template/preview', {
      headers: {
        'X-SITMUN-Client': 'admin',
        'Content-Type': 'application/json',
      },
      data: body,
    });

    expect(
      response.status(),
      `preview failed: ${response.status()} ${await response.text()}`,
    ).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('html');
    expect(JSON.stringify(body)).not.toMatch(/"appId"|"terId"/);
  });

  test('execute-child accepts ADMIN body without appId/terId', async ({ request }) => {
    const headers = {
      'X-SITMUN-Client': 'admin',
      'Content-Type': 'application/json',
    };

    // Seeded STM_TASK id 38: web-api-query-no-proxy (resolveDirect; no JDBC).
    const seeded = await request.get('/backend/api/tasks/38?projection=view', {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(
      seeded.ok(),
      `seeded query task 38 missing: ${seeded.status()} ${await seeded.text()}`,
    ).toBeTruthy();
    const seededTask = await seeded.json();
    expect(String(seededTask.properties?.scope ?? '').toLowerCase()).toBe(
      'web-api-query-no-proxy',
    );
    const linkedTaskId = 38;
    const body = {
      templateTaskId: null,
      linkedTaskId,
      parameters: { codigo: 'e2e' },
      childTaskParameters: null,
    };

    const response = await request.post('/backend/api/tasks/template/execute-child', {
      headers,
      data: body,
    });

    expect(
      response.status(),
      `execute-child failed: ${response.status()} ${await response.text()}`,
    ).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty('taskId', linkedTaskId);
    expect(json).toHaveProperty('status');
    expect(JSON.stringify(body)).not.toMatch(/"appId"|"terId"/);
  });
});
