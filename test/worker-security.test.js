import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';


test('rejects an unconfigured cross-origin preflight', async () => {
  const request = new Request('https://worker.example/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example' },
  });
  const response = await worker.fetch(request, {}, {});

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('allows only the exact configured origin', async () => {
  const request = new Request('https://worker.example/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example' },
  });
  const response = await worker.fetch(request, { ALLOWED_ORIGIN: 'https://app.example' }, {});

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example');
  assert.equal(response.headers.get('Vary'), 'Origin');
});

test('the mail compatibility route creates a Gmail draft', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return Response.json({ access_token: 'test-access-token' });
    }
    if (String(url).endsWith('/gmail/v1/users/me/drafts')) {
      return Response.json({ id: 'draft-123' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const request = new Request('https://worker.example/api/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://app.example',
    },
    body: JSON.stringify({
      to: 'recipient@example.com',
      subject: 'Draft subject',
      body: 'Draft body',
      confirmed: true,
    }),
  });
  const env = {
    ALLOWED_ORIGIN: 'https://app.example',
    GMAIL_CLIENT_ID: 'test-client',
    GMAIL_CLIENT_SECRET: 'test-secret',
    GMAIL_REFRESH_TOKEN: 'test-refresh',
  };

  const response = await worker.fetch(request, env, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.draft, true);
  assert.equal(result.id, 'draft-123');
  assert.equal(result.permission.risk, 'MEDIUM');
  assert.equal(calls.some(call => call.url.endsWith('/messages/send')), false);
  assert.equal(calls.some(call => call.url.endsWith('/drafts')), true);
});

test('Gmail draft creation requires an explicit medium-risk confirmation', async () => {
  const request = new Request('https://worker.example/api/email/draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://app.example',
    },
    body: JSON.stringify({ to: 'recipient@example.com', subject: 'Draft', body: 'Body' }),
  });
  const response = await worker.fetch(request, { ALLOWED_ORIGIN: 'https://app.example' }, {});
  const result = await response.json();

  assert.equal(response.status, 409);
  assert.equal(result.confirmation_required, true);
  assert.equal(result.risk, 'MEDIUM');
});
