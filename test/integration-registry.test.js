import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getIntegration,
  getIntegrationFlow,
  getIntegrationStatus,
  getIntegrationSummary,
  listIntegrationStatuses,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry exposes the overnight control-loop flow', () => {
  const flow = getIntegrationFlow();
  assert.ok(flow.includes('phone/Siri/Shortcut/share-sheet'));
  assert.ok(flow.includes('draft-pr'));
  assert.ok(flow.includes('morning-report'));
});

test('integration registry can filter by layer', () => {
  const captureIntegrations = listIntegrations({ layer: 'capture' });
  assert.ok(captureIntegrations.length > 0);
  assert.ok(captureIntegrations.every((integration) => integration.layer === 'capture'));
});

test('external storage integration requires vault env vars but never fakes live connection', () => {
  const withoutEnv = getIntegrationStatus('obsidian-git-vault', {});
  assert.equal(withoutEnv.configured, false);
  assert.equal(withoutEnv.connected, false);
  assert.equal(withoutEnv.status, 'missing-required-config');

  const withEnv = getIntegrationStatus('obsidian-git-vault', {
    GITHUB_TOKEN: 'test-token',
    GITHUB_REPO: 'owner/private-vault',
  });
  assert.equal(withEnv.configured, true);
  assert.equal(withEnv.connected, false);
  assert.equal(withEnv.status, 'configured-not-verified');
});

test('provider router records optional configured provider env vars', () => {
  const status = getIntegrationStatus('provider-router', {
    GROQ_API_KEY: 'test-key',
    OLLAMA_BASE_URL: 'http://localhost:11434',
  });
  assert.equal(status.connected, false);
  assert.ok(status.configuredOptionalEnvVars.includes('GROQ_API_KEY'));
  assert.ok(status.configuredOptionalEnvVars.includes('OLLAMA_BASE_URL'));
});

test('summary reports no live connections from config alone', () => {
  const summary = getIntegrationSummary({ GITHUB_TOKEN: 'token', GITHUB_REPO: 'repo' });
  assert.equal(summary.connected.length, 0);
  assert.ok(summary.implemented.includes('copelandos-inbox'));
  assert.ok(summary.scaffoldOnly.includes('cursor-codex-task-queue'));
  assert.ok(summary.honestStatus.toLowerCase().includes('not reported connected'));
});

test('unknown integration returns null', () => {
  assert.equal(getIntegration('not-real'), null);
});

test('status list includes all integration ids exactly once', () => {
  const ids = listIntegrationStatuses({}).map((status) => status.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.includes('tool-mcp-registry'));
});
