import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import {
  checkIntegration,
  getControlLoop,
  getIntegration,
  getIntegrationSummary,
  getMorningReportPlan,
  listIntegrations,
  validateIntegrationRegistry,
} from '../src/integrationRegistry.js';

test('integration registry validates ids and control-loop references', () => {
  const result = validateIntegrationRegistry();
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.integrationCount >= 10);
  assert.equal(result.controlLoopSteps, 10);
});

test('no integration fakes connected=true', () => {
  const integrations = listIntegrations({ env: { ALLOWED_ORIGIN: 'https://app.example', GITHUB_TOKEN: 'token', GITHUB_REPO: 'owner/repo' } });
  assert.ok(integrations.length >= 10);
  assert.equal(integrations.every((integration) => integration.connected === false), true);

  const summary = getIntegrationSummary({ ALLOWED_ORIGIN: 'https://app.example', GITHUB_TOKEN: 'token', GITHUB_REPO: 'owner/repo' });
  assert.equal(summary.connected, 0);
});

test('scaffold-only integrations fail closed even when configured', () => {
  const shortcut = getIntegration('iphone-shortcuts', { ALLOWED_ORIGIN: 'https://app.example' });
  assert.ok(shortcut);
  assert.equal(shortcut.configured, true);
  assert.equal(shortcut.connected, false);
  assert.equal(shortcut.status, 'scaffold-only');

  const result = checkIntegration('iphone-shortcuts', { ALLOWED_ORIGIN: 'https://app.example' });
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
  assert.equal(result.scaffold, true);
});

test('unknown integration fails closed', () => {
  const result = checkIntegration('random-external-system', {});
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
});

test('implemented internal integrations are ready without pretending external connectivity', () => {
  const result = checkIntegration('safe-tool-registry', {});
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.connected, false);
  assert.match(result.reason, /internal module/i);
});

test('control loop maps expected ordered steps', () => {
  const loop = getControlLoop({});
  assert.deepEqual(loop.map((step) => step.name), [
    'Capture',
    'Classify',
    'Plan',
    'Route',
    'Council',
    'Authorize Tools',
    'Remember',
    'Queue Work',
    'Draft PR',
    'Report Back',
  ]);
  assert.equal(loop.every((step) => step.integration && step.integration.connected === false), true);
});

test('morning report plan stays dashboard-first and draft-safe', () => {
  const plan = getMorningReportPlan();
  assert.ok(plan.sections.includes('tests_checks'));
  assert.match(plan.delivery, /dashboard-first/i);
  assert.match(plan.safety, /unsent draft/i);
});

test('GET /api/integrations returns honest disconnected roadmap entries', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(result.integrations.length >= 10);
  assert.equal(result.summary.connected, 0);
  assert.equal(result.integrations.every((integration) => integration.connected === false), true);
});

test('POST /api/integrations/check fails closed for scaffold-only and unknown integrations', async () => {
  const scaffoldResponse = await worker.fetch(new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'draft-pr' }),
  }), { GITHUB_TOKEN: 'token' }, {});
  const scaffold = await scaffoldResponse.json();
  assert.equal(scaffoldResponse.status, 200);
  assert.equal(scaffold.ok, false);
  assert.equal(scaffold.allowed, false);
  assert.equal(scaffold.connected, false);
  assert.equal(scaffold.scaffold, true);

  const unknownResponse = await worker.fetch(new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'unknown-system' }),
  }), {}, {});
  const unknown = await unknownResponse.json();
  assert.equal(unknownResponse.status, 200);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.connected, false);
});

test('control-loop route returns expected steps', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.deepEqual(result.steps.map((step) => step.step), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(result.steps.map((step) => step.integrationId), [
    'iphone-shortcuts',
    'classifier',
    'planner',
    'provider-router',
    'ai-council',
    'safe-tool-registry',
    'obsidian-memory',
    'cursor-codex-task',
    'draft-pr',
    'morning-report',
  ]);
  assert.equal(result.steps.every((step) => step.integration.connected === false), true);
});

test('/api/status does not claim external integrations are connected', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/status'), {
    ALLOWED_ORIGIN: 'https://app.example',
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/repo',
  }, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.modules.integrations.connected, false);
  assert.equal(result.modules.integrations.summary.connected, 0);
  assert.match(result.modules.integrations.summary.statusPolicy, /never marked connected/i);
});
