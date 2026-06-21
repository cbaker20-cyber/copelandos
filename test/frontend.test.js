import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend uses honest integration status labels', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(html, /not connected/i);
  assert.match(html, /mock mode/i);
  assert.match(html, /ready for setup/i);
  assert.doesNotMatch(html, /connected badge/i);
});

test('frontend escapes dynamic API data before rendering', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(html, /function escapeHtml/);
  assert.match(html, /escapeHtml\(idea\.text/);
  assert.match(html, /escapeHtml\(p\.id\)/);
});
