import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  checkIntegrationAction,
  getIntegration,
  getIntegrationSummary,
  listIntegrations,
} from '../src/integrations.js';

test('integration registry lists command-center workflow surfaces', () => {
  const integrations = listIntegrations();
  assert.ok(integrations.length >= 7);
  assert.ok(integrations.some((item) => item.id === 'mobile-shortcuts'));
  assert.ok(integrations.some((item) => item.id === 'obsidian-git-vault'));
  assert.ok(integrations.some((item) => item.id === 'cursor-codex-task-queue'));
});

test('integration registry never marks scaffolded external services as connected', () => {
  const mobile = getIntegration('mobile-shortcuts', { ALLOWED_ORIGIN: 'https://copelandos.example' });
  const vault = getIntegration('obsidian-git-vault', { GITHUB_TOKEN: 'token', GITHUB_REPO: 'owner/private-vault' });
  assert.equal(mobile.configured, true);
  assert.equal(mobile.connected, false);
  assert.equal(vault.configured, true);
  assert.equal(vault.connected, false);
});

test('integration summary exposes architecture without secrets', () => {
  const summary = getIntegrationSummary({ GITHUB_TOKEN: 'secret-token', GITHUB_REPO: 'owner/private-vault' });
  assert.ok(summary.policy.toLowerCase().includes('allowlist'));
  assert.ok(summary.architecture.includes('copelandos-inbox'));
  assert.ok(!JSON.stringify(summary).includes('secret-token'));
});

test('integration action checks block unsafe workflow actions', () => {
  const result = checkIntegrationAction('cursor-codex-task-queue', 'auto_merge');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('integration action checks allow scoped capture', () => {
  const result = checkIntegrationAction('mobile-shortcuts', 'capture_text');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
});

test('integration API lists integrations and filters by category', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations?category=capture'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(result.integrations.length > 0);
  assert.ok(result.integrations.every((item) => item.category === 'capture'));
});

test('integration API blocks unsafe action checks', async () => {
  const request = new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'tool-mcp-registry', action: 'arbitrary_shell' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});
