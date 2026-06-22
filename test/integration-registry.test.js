import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkIntegrationPermission,
  getIntegration,
  getIntegrationRegistrySummary,
  listIntegrationStatuses,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry lists command-center integrations', () => {
  const integrations = listIntegrations();
  assert.ok(Array.isArray(integrations));
  assert.ok(integrations.length >= 10);
  assert.ok(integrations.some(integration => integration.id === 'iphone-shortcuts'));
  assert.ok(integrations.some(integration => integration.id === 'tool-mcp-registry'));
});

test('integration registry filters by category', () => {
  const brainIntegrations = listIntegrations({ category: 'brain' });
  assert.ok(brainIntegrations.length > 0);
  assert.ok(brainIntegrations.every(integration => integration.category === 'brain'));
});

test('unknown integrations are blocked by default', () => {
  const result = checkIntegrationPermission('random-integration', 'run_anything');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('scaffold-only integrations are not executable', () => {
  const result = checkIntegrationPermission('iphone-shortcuts', 'post_idea');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.scaffold, true);
});

test('blocked integration operations cannot be approved accidentally', () => {
  const result = checkIntegrationPermission('gmail-draft', 'send_message');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('allowlisted confirmation integrations remain review-first', () => {
  const result = checkIntegrationPermission('gmail-draft', 'create_draft');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.confirmation_required, true);
});

test('internal integrations can be available without secrets', () => {
  const statuses = listIntegrationStatuses({});
  const inbox = statuses.find(integration => integration.id === 'copelandos-inbox');
  assert.equal(inbox.configured, true);
  assert.equal(inbox.connected, true);
  assert.equal(inbox.available, true);
});

test('external integrations never claim live connections from env alone', () => {
  const statuses = listIntegrationStatuses({
    GMAIL_CLIENT_ID: 'client',
    GMAIL_CLIENT_SECRET: 'secret',
    GMAIL_REFRESH_TOKEN: 'refresh',
  });
  const gmail = statuses.find(integration => integration.id === 'gmail-draft');
  assert.equal(gmail.configured, true);
  assert.equal(gmail.connected, false);
});

test('registry summary includes the control-loop architecture', () => {
  const summary = getIntegrationRegistrySummary();
  assert.ok(Array.isArray(summary.architecture));
  assert.ok(summary.architecture.includes('CopelandOS inbox'));
  assert.ok(summary.scaffoldedIntegrations.includes('iphone-shortcuts'));
});

test('public lookup does not expose secret values', () => {
  const vault = getIntegration('obsidian-vault');
  assert.ok(vault);
  const [status] = listIntegrationStatuses({ GITHUB_TOKEN: 'secret', GITHUB_REPO: 'owner/repo' }, { category: 'memory' });
  assert.deepEqual(status.requiredEnvVars, vault.requiredEnvVars);
  assert.equal(JSON.stringify(status).includes('secret'), false);
});
