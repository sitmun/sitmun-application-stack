import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('root Docker build context excludes installed Node dependencies', async () => {
  const dockerignore = await readFile(new URL('../.dockerignore', import.meta.url), 'utf8');
  const patterns = new Set(dockerignore.split(/\r?\n/));

  assert.ok(patterns.has('node_modules/'), 'missing node_modules/ exclusion');
  assert.ok(patterns.has('**/node_modules/'), 'missing **/node_modules/ exclusion');
});
