import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getControlLoop,
  getIntegration,
  getIntegrationSummary,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry exposes the full command-center control loop', () => {
  const loop = getControlLoop();
  assert.deepEqual(loop.map((step) => step.id), [
    'mobile-intake',
    'copelandos-inbox',
    'idea-classifier',
    'planner',
    'provider-router',
    'tool-allowlist',
    'obsidian-memory',
    'cursor-codex-task',
    'draft-pr-review',
    'morning-report',
  ]);
});

test('external integrations are not reported as connected without live probes', () => {
  const integrations = listIntegrations({ GITHUB_TOKEN: 'token', GITHUB_REPO: 'owner/vault' });
  assert.equal(integrations.some((integration) => integration.connected), false);

  const obsidian = integrations.find((integration) => integration.id === 'obsidian-memory');
  assert.equal(obsidian.configured, true);
  assert.equal(obsidian.connectionStatus, 'configured-not-probed');
});

test('missing required environment variables are surfaced without secret values', () => {
  const github = getIntegration('draft-pr-review', {});
  assert.equal(github.configured, false);
  assert.deepEqual(github.missingEnvVars, ['GITHUB_TOKEN']);
  assert.equal(JSON.stringify(github).includes('token'), false);
});

test('summary separates ready scaffold from configured external services', () => {
  const summary = getIntegrationSummary({ GITHUB_TOKEN: 'token', GITHUB_REPO: 'repo' });
  assert.equal(summary.totalIntegrations >= 10, true);
  assert.ok(summary.ready.includes('provider-router'));
  assert.ok(summary.configuredExternal.includes('obsidian-memory'));
  assert.ok(summary.honestStatus.includes('connected=true'));
});
