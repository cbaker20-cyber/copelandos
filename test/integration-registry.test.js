import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  getCommandCenterSummary,
  getControlLoop,
  getIntegration,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry lists command-center integrations', () => {
  const integrations = listIntegrations();
  assert.ok(integrations.length >= 8);
  assert.ok(integrations.some(item => item.id === 'mobile-shortcuts'));
  assert.ok(integrations.some(item => item.id === 'cursor-codex-queue'));
});

test('integration registry never fakes connected states', () => {
  const integrations = listIntegrations({}, {
    OPENAI_API_KEY: 'test-key',
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/repo',
  });

  assert.ok(integrations.some(item => item.configured));
  assert.ok(integrations.every(item => item.connected === false));
});

test('integration detail reports missing env vars without exposing values', () => {
  const integration = getIntegration('obsidian-vault', { GITHUB_TOKEN: 'token' });
  assert.ok(integration);
  assert.equal(integration.connected, false);
  assert.equal(integration.configured, false);
  assert.ok(integration.configuredEnvVars.includes('GITHUB_TOKEN'));
  assert.ok(integration.missingEnvVars.includes('GITHUB_REPO'));
  assert.ok(!JSON.stringify(integration).includes('token'));
});

test('command-center summary includes the overnight control loop', () => {
  const summary = getCommandCenterSummary();
  const loop = getControlLoop();

  assert.ok(loop.includes('phone_or_siri_shortcut'));
  assert.ok(loop.includes('draft_pr'));
  assert.deepEqual(summary.controlLoop, loop);
  assert.equal(summary.connected.length, 0);
  assert.ok(summary.honestStatus.includes('never marked connected'));
});

test('GET /api/integrations returns registry and safety policy', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.integrations));
  assert.ok(Array.isArray(result.controlLoop));
  assert.equal(result.safetyPolicy.noFakeConnectedStates, true);
});

test('GET /api/status includes command-center summary', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/status'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.commandCenter.connected.length, 0);
  assert.ok(result.commandCenter.controlLoop.includes('safe_tool_registry'));
});
