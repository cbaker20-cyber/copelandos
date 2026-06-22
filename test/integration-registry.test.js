import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  getIntegration,
  getIntegrationStatus,
  getIntegrationSummary,
  listIntegrationStatuses,
} from '../src/integrationRegistry.js';

test('integration registry includes the mobile command-center entrypoint', () => {
  const integration = getIntegration('iphone-shortcuts');
  assert.ok(integration);
  assert.equal(integration.surface, 'mobile');
  assert.ok(integration.allowedInboundRoutes.includes('/api/capture/idea'));
  assert.ok(integration.blockedActions.includes('send_email'));
});

test('unknown integration fails closed', () => {
  const status = getIntegrationStatus('unknown-live-connector', {});
  assert.equal(status.ok, false);
  assert.equal(status.configured, false);
  assert.equal(status.connected, false);
});

test('env-gated vault integration is configured only when all required vars exist', () => {
  const missing = getIntegrationStatus('obsidian-git-vault', { GITHUB_TOKEN: 'token' });
  assert.equal(missing.configured, false);
  assert.equal(missing.connected, false);

  const configured = getIntegrationStatus('obsidian-git-vault', {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/private-vault',
  });
  assert.equal(configured.configured, true);
  assert.equal(configured.connected, false);
  assert.ok(configured.reason.includes('does not probe'));
});

test('provider router integration accepts any configured provider signal', () => {
  const unconfigured = getIntegrationStatus('provider-router', {});
  assert.equal(unconfigured.configured, false);

  const configured = getIntegrationStatus('provider-router', { GROQ_API_KEY: 'test-key' });
  assert.equal(configured.configured, true);
  assert.equal(configured.connected, false);
});

test('integration summary exposes the planned control loop', () => {
  const summary = getIntegrationSummary({});
  assert.ok(Array.isArray(summary.controlLoop));
  assert.deepEqual(summary.connected, []);
  assert.ok(summary.controlLoop.includes('copelandos-inbox'));
  assert.ok(summary.safetyInvariant.includes('never claims live connectivity'));
});

test('integration statuses can be filtered by surface', () => {
  const mobile = listIntegrationStatuses({}, { surface: 'mobile' });
  assert.ok(mobile.length > 0);
  assert.ok(mobile.every(integration => integration.surface === 'mobile'));
});

test('GET /api/integrations returns registry without fake connections', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(result.summary.controlLoop.includes('draft-pr'));
  assert.ok(result.integrations.every(integration => integration.connected === false));
});

test('GET /api/integrations/:id returns one integration status', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/safe-tool-registry'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.integration.id, 'safe-tool-registry');
  assert.ok(result.integration.blockedActions.includes('arbitrary_shell'));
});
