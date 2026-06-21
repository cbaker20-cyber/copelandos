import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { chooseProvider, chooseFallbacks, chooseCouncilProviders, getLocalFallback, getNoSubscriptionRoute, listAllProviderStatuses } from '../src/providerRouter.js';

describe('provider router — no configured provider', () => {
  it('returns ok: false when no provider is configured', () => {
    const result = chooseProvider({ taskType: 'coding' }, {});
    assert.equal(result.ok, false, 'not ok when nothing configured');
    assert.equal(result.provider, null);
    assert.ok(Array.isArray(result.tried));
  });

  it('does not fake a connection for an empty env', () => {
    const result = chooseProvider({ taskType: 'reasoning' }, {});
    assert.equal(result.ok, false);
    assert.equal(result.provider, null, 'provider is null — not faked');
  });

  it('includes localFallback in failure result', () => {
    const result = chooseProvider({ taskType: 'coding' }, {});
    assert.ok(result.localFallback, 'has localFallback');
    assert.equal(result.localFallback.provider, 'ollama');
  });

  it('includes noSubscriptionRoute in failure result', () => {
    const result = chooseProvider({ taskType: 'general' }, {});
    assert.ok(result.noSubscriptionRoute, 'has noSubscriptionRoute');
    assert.ok(Array.isArray(result.noSubscriptionRoute.available));
    assert.ok(result.noSubscriptionRoute.available.length > 0, 'at least one free provider listed');
  });
});

describe('provider router — with configured provider', () => {
  it('selects a provider when env var is set', () => {
    const result = chooseProvider({ taskType: 'general' }, { GROQ_KEY: 'mock-key' });
    assert.equal(result.ok, true);
    assert.equal(result.provider, 'groq');
    assert.ok(result.model, 'has model');
    assert.ok(result.explanation, 'has explanation');
  });

  it('falls back to the next configured provider', () => {
    const env = { OPENAI_API_KEY: 'mock-openai-key' };
    const result = chooseProvider({ taskType: 'coding' }, env);
    assert.equal(result.ok, true);
    assert.ok(result.provider, 'has provider');
  });
});

describe('provider router — fallback chain', () => {
  it('returns a fallback chain with configured status for each provider', () => {
    const env = { GROQ_KEY: 'mock' };
    const fallbacks = chooseFallbacks({ taskType: 'general' }, env);
    assert.ok(Array.isArray(fallbacks));
    assert.ok(fallbacks.length > 0);
    const groq = fallbacks.find((f) => f.provider === 'groq');
    assert.ok(groq, 'groq in fallback chain');
    assert.equal(groq.configured, true, 'groq marked as configured');
    const openai = fallbacks.find((f) => f.provider === 'openai');
    if (openai) assert.equal(openai.configured, false, 'openai not configured in this env');
  });
});

describe('provider router — council providers', () => {
  it('reports council not possible with no providers', () => {
    const result = chooseCouncilProviders({}, {});
    assert.equal(result.councilPossible, false);
    assert.ok(result.message);
  });

  it('reports council possible with two providers', () => {
    const env = { GROQ_KEY: 'k1', CEREBRAS_KEY: 'k2' };
    const result = chooseCouncilProviders({}, env);
    assert.equal(result.councilPossible, true);
    assert.ok(result.available.length >= 2);
  });
});

describe('provider router — local fallback', () => {
  it('always returns an Ollama entry', () => {
    const fb = getLocalFallback({}, {});
    assert.equal(fb.provider, 'ollama');
    assert.equal(fb.offline, true);
  });

  it('marks ollama as configured when OLLAMA_BASE_URL is set', () => {
    const fb = getLocalFallback({}, { OLLAMA_BASE_URL: 'http://localhost:11434' });
    assert.equal(fb.configured, true);
  });

  it('marks ollama as not configured when env is empty', () => {
    const fb = getLocalFallback({}, {});
    assert.equal(fb.configured, false);
  });
});

describe('provider router — status list', () => {
  it('returns all providers with correct structure', () => {
    const statuses = listAllProviderStatuses({});
    assert.ok(Array.isArray(statuses));
    assert.ok(statuses.length >= 5, 'at least 5 providers');
    for (const s of statuses) {
      assert.ok(s.provider);
      assert.ok(s.displayName);
      assert.equal(typeof s.configured, 'boolean');
      assert.equal(typeof s.freeOption, 'boolean');
    }
  });

  it('marks all providers as not configured for empty env', () => {
    const statuses = listAllProviderStatuses({});
    assert.ok(statuses.every((s) => s.configured === false), 'none configured for empty env');
  });
});
