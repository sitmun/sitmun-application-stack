import { test, expect } from '../fixtures';

/**
 * Boot 4.1.1 / Hibernate 7 regression: paged cartography list with EntityGraph+styles bag
 * returned 500, which blanked MIA (and other) forms that call fetchAllRawItems(size=10000).
 */
test.describe('Cartography collection list', () => {
  test('GET /api/cartographies?size=10000 returns 200 for admin', async ({ request }) => {
    const response = await request.get('/backend/api/cartographies?size=10000', {
      headers: { 'X-SITMUN-Client': 'admin' },
    });
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    const items = body?._embedded?.cartographies ?? body;
    expect(Array.isArray(items) ? items.length : 0).toBeGreaterThan(0);
  });
});
