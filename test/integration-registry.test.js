import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  getControlLoop,
  getIntegration,
  getIntegrationSummary,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry lists the command-center control loop', () => {
  const integrations = listIntegrations({});
  assert.ok(integrations.length >= 10);
  assert.ok(integrations.some((item) => item.id === 'iphone-shortcuts'));
  assert.ok(integrations.some((item) => item.id === 'tool-mcp-registry'));
});

test('internal integrations are available but external scaffolds are not connected', () => {
  const inbox = getIntegration('copelandos-inbox', {});
  const shortcuts = getIntegration('iphone-shortcuts', {});

  assert.equal(inbox.connected, true);
  assert.equal(inbox.runtimeStatus, 'available-in-worker');
  assert.equal(shortcuts.connected, false);
  assert.equal(shortcuts.runtimeStatus, 'scaffold-only');
});

test('configured external integrations are honest about live probe status', () => {
  const vault = getIntegration('obsidian-git-vault', {
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPO: 'owner/private-vault',
  });

  assert.equal(vault.configured, true);
  assert.equal(vault.connected, false);
  assert.equal(vault.runtimeStatus, 'configured-not-probed');
  assert.match(vault.honestStatus, /does not perform a live probe/i);
});

test('control loop preserves phone to morning report order', () => {
  const loop = getControlLoop({});
  assert.equal(loop[0].id, 'iphone-shortcuts');
  assert.equal(loop.at(-1).id, 'morning-report');
  assert.equal(loop[0].next, 'copelandos-inbox');
});

test('integration summary counts scaffolded and not configured systems', () => {
  const summary = getIntegrationSummary({});
  assert.ok(summary.total >= 10);
  assert.ok(summary.connected > 0);
  assert.ok(summary.scaffolded.includes('iphone-shortcuts'));
  assert.ok(summary.notConfigured.includes('obsidian-git-vault'));
});

test('foundation API exposes integrations without faking external connections', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(result.summary);
  assert.equal(result.integrations.find((item) => item.id === 'draft-pr-status').connected, false);
});

test('foundation API exposes ordered control loop', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.controlLoop[0].id, 'iphone-shortcuts');
  assert.equal(result.controlLoop.at(-1).id, 'morning-report');
});
