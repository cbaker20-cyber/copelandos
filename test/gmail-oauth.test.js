import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GMAIL_OAUTH_SCOPES,
  buildGmailAuthUrl,
  consumeEnrollmentPickup,
  createEnrollmentPickup,
  createOAuthState,
  exchangeAuthorizationCode,
  resetEnrollmentPickups,
  sanitizeOAuthError,
  validateOAuthState,
  wantsLegacyHtmlEnrollment,
} from '../src/gmailOAuth.js';
import worker from '../worker.js';
import { bearerAuthHeaders, TEST_API_AUTH_TOKEN, withApiAuth } from './helpers/auth.js';

const OAUTH_ENV = {
  GMAIL_CLIENT_ID: 'test-client-id',
  GMAIL_CLIENT_SECRET: 'test-client-secret',
  API_AUTH_TOKEN: TEST_API_AUTH_TOKEN,
};

test.beforeEach(() => {
  resetEnrollmentPickups();
});

test('GMAIL_OAUTH_SCOPES stay draft-and-read only', () => {
  assert.deepEqual(GMAIL_OAUTH_SCOPES, [
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly',
  ]);
  assert.equal(GMAIL_OAUTH_SCOPES.some((scope) => scope.includes('gmail.modify')), false);
  assert.equal(GMAIL_OAUTH_SCOPES.some((scope) => scope.includes('gmail.send')), false);
});

test('createOAuthState and validateOAuthState round-trip', async () => {
  const created = await createOAuthState(OAUTH_ENV);
  assert.equal(created.ok, true);
  const validated = await validateOAuthState(created.state, OAUTH_ENV);
  assert.equal(validated.ok, true);
});

test('validateOAuthState rejects missing, tampered, and expired state', async () => {
  assert.equal((await validateOAuthState('', OAUTH_ENV)).ok, false);
  const created = await createOAuthState(OAUTH_ENV);
  const tampered = `${created.state}x`;
  assert.equal((await validateOAuthState(tampered, OAUTH_ENV)).ok, false);

  const [nonce, timestamp, signature] = created.state.split('.');
  const expired = `${nonce}.${Date.now() - (11 * 60 * 1000)}.${signature}`;
  assert.equal((await validateOAuthState(expired, OAUTH_ENV)).ok, false);
});

test('buildGmailAuthUrl includes signed state and minimized scopes', async () => {
  const state = (await createOAuthState(OAUTH_ENV)).state;
  const url = new URL(buildGmailAuthUrl('https://worker.example', OAUTH_ENV, state));
  assert.equal(url.searchParams.get('state'), state);
  assert.equal(url.searchParams.get('scope'), GMAIL_OAUTH_SCOPES.join(' '));
  assert.equal(url.searchParams.get('redirect_uri'), 'https://worker.example/api/auth/callback');
});

test('sanitizeOAuthError removes sensitive upstream fields', () => {
  const filtered = sanitizeOAuthError({
    error: 'invalid_grant',
    error_description: 'Bad Request',
    access_token: 'secret',
    refresh_token: 'secret',
  });
  assert.deepEqual(filtered, {
    error: 'invalid_grant',
    error_description: 'Bad Request',
  });
});

test('enrollment pickup is one-time and expires after consumption', () => {
  const pickupId = createEnrollmentPickup('refresh-token-value');
  assert.equal(consumeEnrollmentPickup(pickupId), 'refresh-token-value');
  assert.equal(consumeEnrollmentPickup(pickupId), null);
});

test('wantsLegacyHtmlEnrollment only enables deprecated HTML mode explicitly', () => {
  assert.equal(wantsLegacyHtmlEnrollment({}), false);
  assert.equal(wantsLegacyHtmlEnrollment({ GMAIL_OAUTH_LEGACY_HTML: 'true' }), true);
});

test('auth/gmail redirect includes OAuth state', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/auth/gmail', { headers: bearerAuthHeaders() }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.ok(location.searchParams.get('state'));
  assert.equal(location.searchParams.get('scope'), GMAIL_OAUTH_SCOPES.join(' '));
});

test('auth/callback rejects missing or invalid OAuth state', async () => {
  const missingState = await worker.fetch(
    new Request('https://worker.example/api/auth/callback?code=test-code', { headers: bearerAuthHeaders() }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  assert.equal(missingState.status, 400);

  const invalidState = await worker.fetch(
    new Request('https://worker.example/api/auth/callback?code=test-code&state=bad.state.value', {
      headers: bearerAuthHeaders(),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  assert.equal(invalidState.status, 400);
});

test('secure callback flow never renders refresh token in HTML', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return Response.json({ refresh_token: 'super-secret-refresh-token' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const state = (await createOAuthState(OAUTH_ENV)).state;
  const response = await worker.fetch(
    new Request(`https://worker.example/api/auth/callback?code=auth-code&state=${encodeURIComponent(state)}`, {
      headers: bearerAuthHeaders(),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Gmail enrollment succeeded/);
  assert.equal(html.includes('super-secret-refresh-token'), false);
  assert.match(html, /pickup/);
});

test('authenticated pickup returns refresh token once', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return Response.json({ refresh_token: 'pickup-secret-token' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const state = (await createOAuthState(OAUTH_ENV)).state;
  const callback = await worker.fetch(
    new Request(`https://worker.example/api/auth/callback?code=auth-code&state=${encodeURIComponent(state)}`, {
      headers: bearerAuthHeaders(),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  const html = await callback.text();
  const match = html.match(/"pickupId":"([^"]+)"/);
  assert.ok(match, 'pickupId should be present in secure enrollment HTML');

  const pickupResponse = await worker.fetch(
    new Request('https://worker.example/api/auth/enrollment/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearerAuthHeaders() },
      body: JSON.stringify({ pickupId: match[1] }),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  const pickup = await pickupResponse.json();
  assert.equal(pickupResponse.status, 200);
  assert.equal(pickup.refresh_token, 'pickup-secret-token');

  const secondPickup = await worker.fetch(
    new Request('https://worker.example/api/auth/enrollment/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...bearerAuthHeaders() },
      body: JSON.stringify({ pickupId: match[1] }),
    }),
    withApiAuth(OAUTH_ENV),
    {},
  );
  assert.equal(secondPickup.status, 410);
});

test('legacy HTML enrollment remains available when explicitly enabled', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return Response.json({ refresh_token: 'legacy-visible-token' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const state = (await createOAuthState(OAUTH_ENV)).state;
  const response = await worker.fetch(
    new Request(`https://worker.example/api/auth/callback?code=auth-code&state=${encodeURIComponent(state)}`, {
      headers: bearerAuthHeaders(),
    }),
    withApiAuth({ ...OAUTH_ENV, GMAIL_OAUTH_LEGACY_HTML: 'true' }),
    {},
  );
  const html = await response.text();
  assert.match(html, /Deprecated/);
  assert.match(html, /legacy-visible-token/);
});

test('exchangeAuthorizationCode returns safe errors without upstream secrets', async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: 'invalid_grant', refresh_token: 'leak', access_token: 'leak' }),
    { status: 400 },
  );
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await exchangeAuthorizationCode({
    code: 'bad-code',
    origin: 'https://worker.example',
    env: OAUTH_ENV,
  });
  assert.equal(result.ok, false);
  assert.equal(result.body.details.refresh_token, undefined);
  assert.equal(result.body.details.access_token, undefined);
});
