import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

test('wrangler.toml is the sole config and points to worker.js with frontend assets', () => {
  assert.equal(existsSync('wrangler.jsonc'), false, 'wrangler.jsonc must not exist; wrangler.toml is canonical');

  const toml = readFileSync('wrangler.toml', 'utf8');
  assert.match(toml, /^main\s*=\s*"worker\.js"/m);
  assert.match(toml, /\[assets\]/);
  assert.match(toml, /directory\s*=\s*"\.\/frontend"/);
});

test('legacy Pages function is marked deprecated', () => {
  const legacy = readFileSync('functions/api/[[route]].js', 'utf8');
  assert.match(legacy, /DEPRECATED/i);
  assert.match(legacy, /worker\.js/);
  assert.match(legacy, /docs\/deployment\.md/);
});

test('deployment documentation describes single-Worker topology', () => {
  const doc = readFileSync('docs/deployment.md', 'utf8');
  assert.match(doc, /one Cloudflare Worker/i);
  assert.match(doc, /wrangler\.toml/);
  assert.match(doc, /functions\/api/);
});

test('worker.js exports a fetch handler', async () => {
  const worker = await import('../worker.js');
  assert.equal(typeof worker.default.fetch, 'function');
});
