import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from '../functions/api/[[route]].js';
import { parseOAuthCallbackQuery } from '../src/gmailOAuth.js';
import { securityHeaders, validateRouteBody } from '../src/requestLimits.js';
import worker from '../worker.js';
import { bearerAuthHeaders, TEST_API_AUTH_TOKEN, withApiAuth } from './helpers/auth.js';

const OAUTH_ENV = {
  GMAIL_CLIENT_ID: 'test-client-id',
  GMAIL_CLIENT_SECRET: 'test-client-secret',
  API_AUTH_TOKEN: TEST_API_AUTH_TOKEN,
};

test('parseOAuthCallbackQuery handles provider-side denial safely', () => {
  const params = new URLSearchParams({
    error: 'access_denied',
    error_description: 'The user denied access',
    state: 'ignored-when-error',
  });
  const result = parseOAuthCallbackQuery(params);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.match(result.body.error, /denied or failed/);
  assert.equal(result.body.details.error, 'access_denied');
  assert.equal(result.body.details.access_token, undefined);
});

test('validateRouteBody rejects malformed enrollment pickup IDs', () => {
  const result = validateRouteBody('/api/auth/enrollment/pickup', { pickupId: 'not-a-uuid' });
  assert.equal(result.ok, false);
  assert.match(result.body.error, /valid UUID/);
});

test('legacy Pages function returns 410 for non-health routes', async () => {
  const response = await onRequest({
    request: new Request('https://pages.example/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'a@example.com' }),
    }),
    env: {},
  });
  const result = await response.json();
  assert.equal(response.status, 410);
  assert.match(result.error, /deprecated/i);
  assert.equal(result.canonical, 'worker.js');
});

test('legacy Pages function still exposes health for migration checks', async () => {
  const response = await onRequest({
    request: new Request('https://pages.example/api/health'),
    env: {},
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
});

test('worker CORS rejection includes security headers', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  }), { ALLOWED_ORIGIN: 'https://app.example' }, {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
});

test('worker OAuth callback returns safe error when Google denies consent', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/auth/callback?error=access_denied&error_description=denied', {
      headers: bearerAuthHeaders(),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  const result = await response.json();
  assert.equal(response.status, 400);
  assert.match(result.error, /denied or failed/);
  assert.equal(result.details.error, 'access_denied');
});

test('security header set matches documented baseline', () => {
  const headers = securityHeaders();
  assert.ok(headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
  assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
});
