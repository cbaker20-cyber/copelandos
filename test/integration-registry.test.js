import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkIntegrationAction,
  describeControlLoop,
  getIntegration,
  getIntegrationSummary,
  listIntegrations,
} from '../src/integrationRegistry.js';

test('integration registry lists command-center surfaces', () => {
  const integrations = listIntegrations();
  assert.ok(Array.isArray(integrations));
  assert.ok(integrations.length >= 8);
  assert.ok(integrations.some((integration) => integration.id === 'mobile-shortcuts'));
  assert.ok(integrations.some((integration) => integration.id === 'tool-mcp-registry'));
});

test('integration summary exposes the overnight architecture', () => {
  const summary = getIntegrationSummary();
  assert.equal(summary.version, 1);
  assert.ok(summary.totalIntegrations > 0);
  assert.ok(summary.architecture.includes('CopelandOS inbox'));
  assert.ok(summary.architecture.includes('draft PR'));
  assert.ok(summary.safetyBoundary.includes('no live connection is implied'));
});

test('unknown integrations are blocked by default', () => {
  const result = checkIntegrationAction('unknown-integration', 'capture_text_idea');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('mobile shortcut capture is allowed only as review-gated inbox work', () => {
  const result = checkIntegrationAction('mobile-shortcuts', 'capture_text_idea');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, false);
  assert.equal(result.confirmation_required, true);
});

test('mobile shortcuts cannot execute unsafe actions', () => {
  const result = checkIntegrationAction('mobile-shortcuts', 'execute_code');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test('provider router forbids fake connected state', () => {
  const result = checkIntegrationAction('provider-router', 'fake_connected_state');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test('tool registry integration blocks arbitrary shell', () => {
  const result = checkIntegrationAction('tool-mcp-registry', 'arbitrary_shell');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test('control loop never enables automatic execution', () => {
  const loop = describeControlLoop();
  assert.equal(loop.dispatchPolicy.automaticExecution, false);
  assert.equal(loop.dispatchPolicy.draftPrOnly, true);
  assert.equal(loop.dispatchPolicy.humanReviewRequired, true);
  assert.ok(loop.dispatchPolicy.blockedActions.includes('send_email'));
  assert.ok(loop.controlLoop.blockedUntil.length > 0);
});

test('getIntegration returns null for unregistered ids', () => {
  assert.equal(getIntegration('does-not-exist'), null);
});
