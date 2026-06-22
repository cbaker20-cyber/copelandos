import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listProviderStatuses,
  chooseProvider,
  chooseFallbacks,
  chooseCouncilProviders,
  explainRoutingDecision,
  getLocalFallback,
  getNoSubscriptionRoute,
} from '../src/providerRouter.js';

test('provider router returns fallback chain for reasoning task', () => {
  const result = chooseFallbacks({ taskType: 'reasoning' }, {});
  assert.ok(result.fallbacks !== undefined || result.unconfigured !== undefined);
  assert.ok(Array.isArray(result.unconfigured));
});

test('no configured provider does not fake a connection', () => {
  const result = chooseProvider({ taskType: 'reasoning' }, {});
  assert.equal(result.ok, false);
  assert.equal(result.provider, null);
  assert.ok(result.error);
});

test('configured provider is selected correctly', () => {
  const env = { GROQ_API_KEY: 'test-key-abc' };
  const result = chooseProvider({ taskType: 'fast' }, env);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'groq');
  assert.ok(result.displayName);
});

test('provider status shows not-connected when env var absent', () => {
  const statuses = listProviderStatuses({});
  const groq = statuses.find(p => p.id === 'groq');
  assert.ok(groq);
  assert.equal(groq.configured, false);
  assert.equal(groq.connected, false);
  assert.equal(groq.status, 'not-connected');
});

test('provider status shows configured when env var present', () => {
  const statuses = listProviderStatuses({ GROQ_API_KEY: 'some-key' });
  const groq = statuses.find(p => p.id === 'groq');
  assert.ok(groq);
  assert.equal(groq.configured, true);
  assert.equal(groq.status, 'configured');
});

test('legacy env var (GROQ_KEY) also configures the provider', () => {
  const statuses = listProviderStatuses({ GROQ_KEY: 'legacy-key' });
  const groq = statuses.find(p => p.id === 'groq');
  assert.ok(groq);
  assert.equal(groq.configured, true);
});

test('local fallback is always represented even when not running', () => {
  const local = getLocalFallback({}, {});
  assert.ok(local);
  assert.equal(local.id, 'ollama');
  assert.ok(local.message);
  assert.equal(local.offline, true);
  assert.equal(local.privacyTier, 'local');
  assert.equal(local.costTier, 'free');
});

test('no-subscription route returns free providers when configured', () => {
  const result = getNoSubscriptionRoute({}, { GROQ_API_KEY: 'key', CEREBRAS_API_KEY: 'key2' });
  assert.equal(result.available, true);
  assert.ok(result.providers.length > 0);
  assert.ok(result.message.includes('free-tier'));
});

test('no-subscription route message is helpful when no free providers configured', () => {
  const result = getNoSubscriptionRoute({}, {});
  assert.equal(result.available, false);
  assert.ok(result.message.toLowerCase().includes('groq') || result.message.toLowerCase().includes('free'));
});

test('council providers returns helpful message when none configured', () => {
  const result = chooseCouncilProviders({}, {});
  assert.equal(result.ok, false);
  assert.ok(result.message);
  assert.ok(result.localFallback);
});

test('explain routing decision provides honest status', () => {
  const result = explainRoutingDecision({ taskType: 'coding' }, {});
  assert.ok(result.honestStatus);
  assert.equal(result.decision, 'no-provider-configured');
  assert.ok(Array.isArray(result.unconfiguredProviders));
  assert.ok(result.localFallback);
});

test('provider router explains decision when provider is configured', () => {
  const env = { ANTHROPIC_API_KEY: 'sk-test' };
  const result = explainRoutingDecision({ taskType: 'reasoning' }, env);
  assert.equal(result.decision, 'provider-selected');
  assert.ok(result.selected);
  assert.ok(result.reason);
});

test('provider router honors tool-calling constraints', () => {
  const env = { CEREBRAS_API_KEY: 'key', GEMINI_API_KEY: 'key2' };
  const result = chooseProvider({ taskType: 'fast', requiresToolCalling: true }, env);
  assert.equal(result.ok, true);
  assert.notEqual(result.provider, 'cerebras');
  assert.equal(result.supportsToolCalling, true);
});

test('provider router can avoid rate-limited providers', () => {
  const env = { GROQ_API_KEY: 'key', CEREBRAS_API_KEY: 'key2' };
  const result = chooseProvider({ taskType: 'fast', rateLimitedProviders: ['groq'] }, env);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'cerebras');
});

test('provider router supports no-paid provider constraint', () => {
  const env = { ANTHROPIC_API_KEY: 'paid', GEMINI_API_KEY: 'free' };
  const result = chooseProvider({ taskType: 'reasoning', noPaidProviders: true }, env);
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'gemini-flash');
});
