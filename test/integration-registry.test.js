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
  assert.equal(result.errors.length, 0);
  assert.ok(result.integrationCount >= 10);
  assert.equal(result.controlLoopSteps, 10);
});

test('integration registry never marks scaffolded integrations connected', () => {
  const shortcut = getIntegration('iphone-shortcuts', { ALLOWED_ORIGIN: 'https://example.com' });
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

test('checkIntegration blocks scaffold-only systems', () => {
  const result = checkIntegration('draft-pr', { GITHUB_TOKEN: 'token' });
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
  assert.equal(result.scaffold, true);
});

test('checkIntegration allows implemented internal systems', () => {
  const result = checkIntegration('safe-tool-registry', {});
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.connected, false);
});

test('unknown integration fails closed', () => {
  const result = checkIntegration('unknown-system', {});
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
});

test('control loop maps every step to registered integration status', () => {
  const loop = getControlLoop({});
  assert.equal(loop.length, 10);
  assert.ok(loop.every((step) => step.integration));
  assert.deepEqual(loop.map((step) => step.step), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('integration summary reports zero connected integrations by default', () => {
  const summary = getIntegrationSummary({});
  assert.ok(summary.total >= 10);
  assert.ok(summary.implemented > 0);
  assert.equal(summary.connected, 0);
  assert.match(summary.statusPolicy, /never marked connected/i);
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
