import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkApiAccess,
  extractBearerToken,
  getProtectedRouteClasses,
  isProtectedRoute,
  isApiAuthorized,
} from '../src/auth.js';
import worker from '../worker.js';

const TEST_TOKEN = 'test-api-auth-token-32chars-min';

function authHeaders(token = TEST_TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

test('classifies protected route groups', () => {
  assert.deepEqual(getProtectedRouteClasses('/api/mail/send'), ['gmail']);
  assert.deepEqual(getProtectedRouteClasses('/api/email/draft'), ['gmail']);
  assert.deepEqual(getProtectedRouteClasses('/api/vault/write'), ['vault_write']);
  assert.deepEqual(getProtectedRouteClasses('/api/capture/idea'), ['vault_write']);
  assert.deepEqual(getProtectedRouteClasses('/api/ideas/abc/convert'), ['vault_write']);
  assert.deepEqual(getProtectedRouteClasses('/api/ai'), ['provider']);
  assert.deepEqual(getProtectedRouteClasses('/api/idea'), ['vault_write']);
  assert.equal(isProtectedRoute('/api/projects'), false);
  assert.equal(isProtectedRoute('/api/health'), false);
});

test('extractBearerToken reads Authorization header only', () => {
  const request = new Request('https://worker.example/api/ai', {
    headers: { Authorization: 'Bearer secret-token' },
  });
  assert.equal(extractBearerToken(request), 'secret-token');
  assert.equal(extractBearerToken(new Request('https://worker.example/api/ai?token=leak')), '');
});

test('isApiAuthorized fails closed when API_AUTH_TOKEN is unset', () => {
  const request = new Request('https://worker.example/api/ai', {
    headers: authHeaders(),
  });
  assert.equal(isApiAuthorized(request, {}).ok, false);
  assert.equal(isApiAuthorized(request, {}).reason, 'not_configured');
});

test('isApiAuthorized accepts a matching bearer token', () => {
  const request = new Request('https://worker.example/api/ai', {
    headers: authHeaders(TEST_TOKEN),
  });
  assert.equal(isApiAuthorized(request, { API_AUTH_TOKEN: TEST_TOKEN }).ok, true);
});

test('protected routes return 503 when API_AUTH_TOKEN is not configured', async () => {
  const request = new Request('https://worker.example/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });
  const response = await worker.fetch(request, { ALLOWED_ORIGIN: 'https://app.example' }, {});
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.match(result.error, /API authentication is not configured/);
});

test('protected routes return 401 without a bearer token', async () => {
  const request = new Request('https://worker.example/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });
  const response = await worker.fetch(request, { API_AUTH_TOKEN: TEST_TOKEN }, {});
  const result = await response.json();
  assert.equal(response.status, 401);
  assert.match(result.error, /Authentication required/);
});

test('protected routes return 401 for an invalid bearer token', async () => {
  const request = new Request('https://worker.example/api/vault/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders('wrong-token') },
    body: JSON.stringify({ type: 'daily', content: 'note' }),
  });
  const response = await worker.fetch(request, { API_AUTH_TOKEN: TEST_TOKEN }, {});
  assert.equal(response.status, 401);
});

test('public routes remain accessible without API_AUTH_TOKEN', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.capabilities.apiAuth, 'not-configured');
});

test('health reports bearer-token-required when API_AUTH_TOKEN is set', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health'), { API_AUTH_TOKEN: TEST_TOKEN }, {});
  const result = await response.json();
  assert.equal(result.capabilities.apiAuth, 'bearer-token-required');
});

test('Gmail routes require authentication before touching OAuth', async () => {
  const request = new Request('https://worker.example/api/auth/gmail');
  const response = await worker.fetch(request, { API_AUTH_TOKEN: TEST_TOKEN }, {});
  assert.equal(response.status, 401);
});

test('capture route accepts CAPTURE_TOKEN when API_AUTH_TOKEN is not configured', () => {
  const request = new Request('https://worker.example/api/capture/idea?token=shortcut-only', {
    headers: { Authorization: 'Bearer shortcut-only' },
  });
  assert.equal(isApiAuthorized(request, { CAPTURE_TOKEN: 'shortcut-only' }, '/api/capture/idea').ok, true);
});

test('checkApiAccess allows public paths without credentials', () => {
  const request = new Request('https://worker.example/api/projects');
  assert.equal(checkApiAccess(request, {}).ok, true);
});
