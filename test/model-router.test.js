import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { routeModel } from '../src/modelRouter.js';

const config = JSON.parse(await readFile(new URL('../config/models.json', import.meta.url), 'utf8'));

test('model router falls back to the next configured provider', () => {
  const result = routeModel('fast', { GEMINI_API_KEY: 'configured-for-test' }, config);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'gemini');
  assert.equal(result.taskType, 'fast');
});

test('model router returns a clear error with no configured provider', () => {
  const result = routeModel('security_review', {}, config);
  assert.equal(result.ok, false);
  assert.match(result.error, /No configured provider/);
  assert.ok(result.tried.length > 0);
});

test('model router supports an explicitly configured local fallback', () => {
  const result = routeModel('local_fallback', { OLLAMA_BASE_URL: 'http://127.0.0.1:11434' }, config);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'ollama');
  assert.equal(result.local, true);
});
