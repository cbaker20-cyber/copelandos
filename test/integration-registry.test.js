import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getIntegrationStatus,
  getIntegrationSummary,
  listIntegrationStatuses,
} from '../src/integrationRegistry.js';

test('integration registry lists the full command-center flow', () => {
  const summary = getIntegrationSummary({});

  assert.ok(summary.total >= 7);
  assert.deepEqual(summary.flow, [
    'phone/Siri/Shortcut/share sheet',
    'CopelandOS inbox',
    'classifier',
    'planner',
    'provider router or AI council',
    'safe tool registry',
    'Obsidian memory',
    'Cursor/Codex task',
    'draft PR',
    'review status back into CopelandOS',
  ]);
});

test('scaffold-only integrations do not become connected or configured by default', () => {
  const shortcut = getIntegrationStatus('ios-shortcuts', { ALLOWED_ORIGIN: 'https://example.com' });

  assert.ok(shortcut);
  assert.equal(shortcut.status, 'scaffold-only');
  assert.equal(shortcut.configured, false);
  assert.equal(shortcut.connected, false);
  assert.ok(shortcut.blockedActions.includes('send_email'));
});

test('Obsidian vault integration requires both GitHub env vars', () => {
  const missingRepo = getIntegrationStatus('obsidian-git-vault', { GITHUB_TOKEN: 'token' });
  const configured = getIntegrationStatus('obsidian-git-vault', {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/private-vault',
  });

  assert.equal(missingRepo.configured, false);
  assert.equal(configured.configured, true);
  assert.equal(configured.connected, false);
});

test('provider router config follows provider credentials without claiming a connection', () => {
  const router = getIntegrationStatus('provider-router', { GROQ_API_KEY: 'test-key' });

  assert.equal(router.configured, true);
  assert.equal(router.connected, false);
  assert.ok(router.message.includes('live connection checks are not performed'));
});

test('active safety registry is visible without secrets', () => {
  const integrations = listIntegrationStatuses({});
  const registry = integrations.find((integration) => integration.id === 'safe-tool-mcp-registry');

  assert.ok(registry);
  assert.equal(registry.configured, true);
  assert.equal(registry.connected, false);
  assert.ok(registry.blockedActions.includes('arbitrary_shell'));
});
