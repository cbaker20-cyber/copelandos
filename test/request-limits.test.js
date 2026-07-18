import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIMITS,
  checkBodySize,
  checkProviderRateLimit,
  createRateLimiter,
  getClientKey,
  isProviderBackedRoute,
  parseJsonBody,
  safeInternalError,
  securityHeaders,
  validateRouteBody,
} from '../src/requestLimits.js';
import worker from '../worker.js';
import { bearerAuthHeaders, TEST_API_AUTH_TOKEN, withApiAuth } from './helpers/auth.js';

function jsonRequest(path, body, options = {}) {
  return new Request(`https://worker.example${path}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bearerAuthHeaders(),
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

test('isProviderBackedRoute includes provider and idea routes', () => {
  assert.equal(isProviderBackedRoute('/api/ai'), true);
  assert.equal(isProviderBackedRoute('/api/search'), true);
  assert.equal(isProviderBackedRoute('/api/idea'), true);
  assert.equal(isProviderBackedRoute('/api/projects'), false);
});

test('checkBodySize rejects oversized Content-Length', () => {
  const request = new Request('https://worker.example/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': String(LIMITS.MAX_BODY_BYTES + 1) },
    body: '{}',
  });
  const result = checkBodySize(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
});

test('parseJsonBody rejects invalid JSON', async () => {
  const request = new Request('https://worker.example/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  });
  const result = await parseJsonBody(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Invalid JSON/);
});

test('parseJsonBody rejects non-object JSON bodies', async () => {
  const request = new Request('https://worker.example/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '["array"]',
  });
  const result = await parseJsonBody(request);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('validateRouteBody enforces AI message limits', () => {
  const result = validateRouteBody('/api/ai', {
    messages: [{ role: 'user', content: 'x'.repeat(LIMITS.MAX_MESSAGE_CONTENT + 1) }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('validateRouteBody requires search query', () => {
  const missing = validateRouteBody('/api/search', {});
  assert.equal(missing.ok, false);
  const valid = validateRouteBody('/api/search', { query: 'copelandos security' });
  assert.equal(valid.ok, true);
});

test('validateRouteBody enforces Gmail draft field lengths', () => {
  const result = validateRouteBody('/api/email/draft', {
    to: 'a@example.com',
    subject: 'ok',
    body: 'b'.repeat(LIMITS.MAX_TEXT_FIELD + 1),
  });
  assert.equal(result.ok, false);
  assert.match(result.body.error, /body exceeds/);
});

test('createRateLimiter blocks after maxRequests', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
  assert.equal(limiter.check('client-a').ok, true);
  assert.equal(limiter.check('client-a').ok, true);
  const blocked = limiter.check('client-a');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limiter.check('client-b').ok, true);
});

test('checkProviderRateLimit only applies to provider-backed routes', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
  const request = new Request('https://worker.example/api/projects', {
    headers: { 'CF-Connecting-IP': '203.0.113.10' },
  });
  assert.equal(checkProviderRateLimit(request, '/api/projects', limiter).ok, true);
  assert.equal(checkProviderRateLimit(request, '/api/ai', limiter).ok, true);
  assert.equal(checkProviderRateLimit(request, '/api/ai', limiter).ok, false);
});

test('getClientKey prefers CF-Connecting-IP', () => {
  const request = new Request('https://worker.example/api/health', {
    headers: { 'CF-Connecting-IP': '203.0.113.5', 'X-Forwarded-For': '198.51.100.1' },
  });
  assert.equal(getClientKey(request), '203.0.113.5');
});

test('securityHeaders include baseline hardening values', () => {
  const headers = securityHeaders();
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
});

test('safeInternalError does not expose exception details', () => {
  assert.deepEqual(safeInternalError(), { ok: false, error: 'Internal server error.' });
});

test('worker rejects oversized request bodies before route handlers', async () => {
  const request = new Request('https://worker.example/api/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(LIMITS.MAX_BODY_BYTES + 10),
    },
    body: JSON.stringify({ task: 'ignored' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 413);
  assert.match(result.error, /too large/i);
});

test('worker rejects invalid JSON with a safe error response', async () => {
  const request = new Request('https://worker.example/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.equal(result.error, 'Invalid JSON body.');
});

test('worker enforces strict POST method on mail list', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/mail/list', {
      method: 'GET',
      headers: bearerAuthHeaders(),
    }),
    withApiAuth({ GMAIL_REFRESH_TOKEN: 'token', GMAIL_CLIENT_ID: 'id', GMAIL_CLIENT_SECRET: 'secret' }),
    {},
  );
  assert.equal(response.status, 405);
});

test('worker applies security headers to JSON responses', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health'), {}, {});
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.ok(response.headers.get('Content-Security-Policy'));
});

test('worker rate limits provider-backed routes', async () => {
  const env = withApiAuth();
  const ip = '203.0.113.77';
  const makeAiRequest = () => worker.fetch(
    jsonRequest('/api/ai', { messages: [{ role: 'user', content: 'hello' }] }, {
      headers: { ...bearerAuthHeaders(), 'CF-Connecting-IP': ip },
    }),
    env,
    {},
  );

  for (let index = 0; index < LIMITS.PROVIDER_RATE_LIMIT.maxRequests; index += 1) {
    const response = await makeAiRequest();
    assert.notEqual(response.status, 429, `request ${index + 1} should not be rate limited yet`);
  }

  const blocked = await makeAiRequest();
  const result = await blocked.json();
  assert.equal(blocked.status, 429);
  assert.match(result.error, /Rate limit exceeded/);
  assert.ok(Number(blocked.headers.get('Retry-After')) >= 1);
});

test('worker returns generic provider failure without upstream details', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('secret upstream body', { status: 500 });
  try {
    const response = await worker.fetch(
      jsonRequest('/api/ai', { messages: [{ role: 'user', content: 'hello' }] }, {
        headers: { ...bearerAuthHeaders(), 'CF-Connecting-IP': '203.0.113.88' },
      }),
      withApiAuth({ OPENAI_API_KEY: 'test-key' }),
      {},
    );
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.error, 'openai request failed.');
    assert.equal(JSON.stringify(result).includes('secret upstream body'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('worker validates search query length on provider route', async () => {
  const response = await worker.fetch(
    jsonRequest('/api/search', { query: 'q'.repeat(LIMITS.MAX_SHORT_FIELD + 1) }, {
      headers: { ...bearerAuthHeaders(), 'CF-Connecting-IP': '203.0.113.99' },
    }),
    withApiAuth({ SERPER_KEY: 'serper-key' }),
    {},
  );
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /query exceeds/);
});
