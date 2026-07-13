import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  INTEGRATION_IDS,
  INTEGRATION_STATUSES,
  assertNoSecretsInStatus,
  buildIntegrationStatuses,
  buildTruthDashboardStatus,
  isAllowedIntegrationStatus,
} from '../src/integrationStatus.js';

test('integration status values are limited to the allowed set', () => {
  const integrations = buildIntegrationStatuses({});
  for (const id of INTEGRATION_IDS) {
    assert.ok(integrations[id], `missing integration: ${id}`);
    assert.ok(isAllowedIntegrationStatus(integrations[id].status), `${id} has invalid status: ${integrations[id].status}`);
    assert.ok(INTEGRATION_STATUSES.includes(integrations[id].status));
  }
});

test('missing OpenClaw config returns not_configured', () => {
  const integrations = buildIntegrationStatuses({});
  assert.equal(integrations.openclaw_worker.status, 'not_configured');
});

test('OpenClaw config with URL only returns needs_user_action', () => {
  const integrations = buildIntegrationStatuses({ OPENCLAW_WORKER_URL: 'http://127.0.0.1:18789' });
  assert.equal(integrations.openclaw_worker.status, 'needs_user_action');
});

test('OpenClaw config with URL and token returns configured', () => {
  const integrations = buildIntegrationStatuses({
    OPENCLAW_WORKER_URL: 'http://127.0.0.1:18789',
    OPENCLAW_TOKEN: 'test-token-value-not-real',
  });
  assert.equal(integrations.openclaw_worker.status, 'configured');
});

test('local agent absent returns not_configured', () => {
  const integrations = buildIntegrationStatuses({});
  assert.equal(integrations.local_agent.status, 'not_configured');
});

test('local agent URL without token returns needs_user_action', () => {
  const integrations = buildIntegrationStatuses({ LOCAL_AGENT_URL: 'http://127.0.0.1:43120' });
  assert.equal(integrations.local_agent.status, 'needs_user_action');
});

test('provider pool with no keys returns not_configured', () => {
  const integrations = buildIntegrationStatuses({});
  assert.equal(integrations.free_provider_pool.status, 'not_configured');
  assert.equal(integrations.ai_provider_router.status, 'mock_mode');
});

test('provider pool with one free key returns configured partial state', () => {
  const integrations = buildIntegrationStatuses({ GROQ_API_KEY: 'test-key' });
  assert.equal(integrations.free_provider_pool.status, 'configured');
  assert.equal(integrations.free_provider_pool.partial, true);
  assert.ok(integrations.free_provider_pool.configuredCount >= 1);
});

test('FreeBuff placeholder does not claim availability', () => {
  const integrations = buildIntegrationStatuses({ GROQ_API_KEY: 'test-key' });
  assert.equal(integrations.free_provider_pool.freebuff.status, 'not_configured');
  assert.match(integrations.free_provider_pool.freebuff.note, /pending/i);
});

test('truth dashboard returns safety_mode true', () => {
  const truth = buildTruthDashboardStatus({});
  assert.equal(truth.safety_mode, true);
  assert.equal(truth.ok, true);
  assert.ok(Array.isArray(truth.warnings));
  assert.ok(Array.isArray(truth.missing_setup));
});

test('status response contains no secrets', () => {
  const env = {
    GROQ_API_KEY: 'sk-test-secret-key-value',
    GITHUB_TOKEN: 'ghp_testsecrettokenvalue',
    GMAIL_REFRESH_TOKEN: 'refresh-secret-token',
    OPENCLAW_TOKEN: 'openclaw-secret-token',
    LOCAL_AGENT_TOKEN: 'local-agent-secret-token',
  };
  const truth = buildTruthDashboardStatus(env);
  assert.equal(assertNoSecretsInStatus(truth), true);
  const serialized = JSON.stringify(truth);
  assert.equal(serialized.includes('sk-test-secret-key-value'), false);
  assert.equal(serialized.includes('ghp_testsecrettokenvalue'), false);
  assert.equal(serialized.includes('refresh-secret-token'), false);
});

test('GET /api/integrations/status returns truth dashboard fields', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/status'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.safety_mode, true);
  assert.equal(result.integrations.openclaw_worker.status, 'not_configured');
  assert.equal(result.integrations.local_agent.status, 'not_configured');
  assert.ok(result.warnings.length > 0);
  assert.ok(result.missing_setup.some((item) => item.id === 'openclaw_worker'));
});

test('GET /api/status includes integration statuses and safety_mode', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/status'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.safety_mode, true);
  assert.ok(result.integrations);
  assert.equal(result.modules.openclawWorker.status, 'not_configured');
});
