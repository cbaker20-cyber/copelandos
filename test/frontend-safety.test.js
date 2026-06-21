import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');

test('frontend keeps safe data rendering assumptions', () => {
  assert.match(html, /function escapeHtml/);
  assert.match(html, /not connected/i);
  assert.match(html, /mock mode/i);
  assert.match(html, /ready for setup/i);
  assert.match(html, /@media \(max-width: 760px\)/);
});

test('frontend wires real brain pipeline endpoints', () => {
  for (const endpoint of [
    '/api/capture/idea',
    '/api/ideas/stats',
    '/api/brain/status',
    '/api/project-queue',
    '/api/ideas/${ideaId}/triage',
    '/api/ideas/${ideaId}/convert',
    '/api/ideas/${ideaId}/cursor-prompt',
    '/api/ideas/${ideaId}/codex-prompt',
  ]) {
    assert.ok(html.includes(endpoint), `missing ${endpoint}`);
  }
});
