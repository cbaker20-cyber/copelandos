import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend uses honest setup states and no unsafe execution controls', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(html, /not connected/i);
  assert.match(html, /mock mode/i);
  assert.match(html, /ready for setup/i);
  assert.match(html, /local fallback/i);
  assert.doesNotMatch(html, /messages\/send/i);
  assert.doesNotMatch(html, /merge\s+PR/i);
  assert.doesNotMatch(html, /wrangler\s+(deploy|publish)/i);
});

test('frontend exposes mobile idea capture and prompt panels', async () => {
  const html = await readFile(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(html, /POST \/api\/capture\/idea/);
  assert.match(html, /Idea inbox/);
  assert.match(html, /AI brain pipeline/);
  assert.match(html, /Provider router/);
  assert.match(html, /Tool \+ MCP registry/);
  assert.match(html, /Cursor \/ Codex prompts/);
});
