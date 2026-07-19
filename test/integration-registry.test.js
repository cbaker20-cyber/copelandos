import assert from 'node:assert/strict';
import test from 'node:test';

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
  const integrations = listIntegrations({
    env: {
      CAPTURE_TOKEN: 'capture-token',
      GITHUB_TOKEN: 'github-token',
      GITHUB_REPO: 'owner/repo',
    },
  });
  assert.ok(integrations.length > 0);
  assert.equal(integrations.every((integration) => integration.connected === false), true);
  assert.equal(getIntegrationSummary({ GITHUB_TOKEN: 'github-token', GITHUB_REPO: 'owner/repo' }).connected, 0);
});

test('configured scaffold-only integrations remain disconnected', () => {
  const shortcut = getIntegration('iphone-shortcuts', { CAPTURE_TOKEN: 'capture-token' });
  assert.ok(shortcut);
  assert.equal(shortcut.configured, true);
  assert.equal(shortcut.connected, false);
  assert.equal(shortcut.status, 'scaffold-only');
  assert.match(shortcut.honestStatus, /no live connection probe/i);
});

test('implemented internal integrations are ready without pretending external connectivity', () => {
  const inbox = getIntegration('copelandos-inbox', {});
  assert.ok(inbox);
  assert.equal(inbox.ready, true);
  assert.equal(inbox.connected, false);
  assert.match(inbox.honestStatus, /internal module/i);
});

test('scaffold-only integrations fail closed', () => {
  const result = checkIntegration('draft-pr', { GITHUB_TOKEN: 'token' });
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
  assert.equal(result.scaffold, true);
});

test('unknown integration fails closed', () => {
  const result = checkIntegration('unknown-system', {});
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
});

test('implemented internal systems can be checked without external connectivity', () => {
  const result = checkIntegration('safe-tool-registry', {});
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.connected, false);
});

test('control loop maps every step to registered integration status', () => {
  const loop = getControlLoop({});
  assert.equal(loop.length, 10);
  assert.ok(loop.every((step) => step.integration));
  assert.deepEqual(loop.map((step) => step.step), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
});

test('category filtering returns only matching integrations', () => {
  const mobile = listIntegrations({ category: 'mobile-capture', env: {} });
  assert.ok(mobile.length >= 2);
  assert.ok(mobile.every((integration) => integration.category === 'mobile-capture'));
});

test('morning report plan is dashboard-first and draft-safe', () => {
  const plan = getMorningReportPlan();
  assert.ok(plan.sections.includes('tests_checks'));
  assert.match(plan.delivery, /dashboard-first/i);
  assert.match(plan.safety, /unsent draft/i);
});
