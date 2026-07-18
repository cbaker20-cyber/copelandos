const STATE_TTL_MS = 10 * 60 * 1000;
const PICKUP_TTL_MS = 5 * 60 * 1000;

export const GMAIL_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const pickupStore = new Map();

function getStateSecret(env) {
  return (env.GMAIL_OAUTH_STATE_SECRET || env.GMAIL_CLIENT_SECRET || env.API_AUTH_TOKEN || '').trim();
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function base64url(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(signature);
}

export async function createOAuthState(env) {
  const secret = getStateSecret(env);
  if (!secret) {
    return { ok: false, error: 'OAuth state secret is not configured. Set GMAIL_CLIENT_SECRET or GMAIL_OAUTH_STATE_SECRET.' };
  }
  const nonce = crypto.randomUUID();
  const timestamp = String(Date.now());
  const signature = await signPayload(`${nonce}.${timestamp}`, secret);
  return { ok: true, state: `${nonce}.${timestamp}.${signature}` };
}

export async function validateOAuthState(state, env) {
  if (!state || typeof state !== 'string') {
    return { ok: false, error: 'Missing OAuth state.' };
  }
  const parts = state.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'Invalid OAuth state.' };
  }
  const [nonce, timestamp, signature] = parts;
  const issuedAt = Number(timestamp);
  const age = Date.now() - issuedAt;
  if (!nonce || !Number.isFinite(issuedAt) || age < 0 || age > STATE_TTL_MS) {
    return { ok: false, error: 'OAuth state expired.' };
  }
  const secret = getStateSecret(env);
  if (!secret) {
    return { ok: false, error: 'OAuth state secret is not configured.' };
  }
  const expected = await signPayload(`${nonce}.${timestamp}`, secret);
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, error: 'Invalid OAuth state.' };
  }
  return { ok: true };
}

export function buildGmailAuthUrl(origin, env, state) {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GMAIL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GMAIL_OAUTH_SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('include_granted_scopes', 'true');
  return authUrl.toString();
}

export function createEnrollmentPickup(refreshToken) {
  const pickupId = crypto.randomUUID();
  pickupStore.set(pickupId, {
    refreshToken,
    expiresAt: Date.now() + PICKUP_TTL_MS,
  });
  return pickupId;
}

export function consumeEnrollmentPickup(pickupId) {
  const entry = pickupStore.get(pickupId);
  if (!entry) return null;
  pickupStore.delete(pickupId);
  if (Date.now() > entry.expiresAt) return null;
  return entry.refreshToken;
}

export function resetEnrollmentPickups() {
  pickupStore.clear();
}

export function sanitizeOAuthError(data) {
  const allowed = ['error', 'error_description'];
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.includes(key)));
}

export function parseOAuthCallbackQuery(searchParams) {
  const error = searchParams.get('error');
  if (error) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'OAuth authorization was denied or failed.',
        details: sanitizeOAuthError({
          error,
          error_description: searchParams.get('error_description') || '',
        }),
      },
    };
  }
  const code = searchParams.get('code');
  if (!code) {
    return { ok: false, status: 400, body: { ok: false, error: 'Missing OAuth code.' } };
  }
  return { ok: true, code, state: searchParams.get('state') };
}

export function wantsLegacyHtmlEnrollment(env) {
  return String(env.GMAIL_OAUTH_LEGACY_HTML || '').toLowerCase() === 'true';
}

export function renderLegacyOAuthTokenPage(refreshToken, headers) {
  const escaped = escapeHtml(refreshToken);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gmail connected</title></head><body style="background:#0a0a0c;color:#eee;font-family:ui-monospace,monospace;padding:32px;max-width:780px"><h2 style="color:#6ef0ad">Gmail draft access connected</h2><p><strong>Deprecated:</strong> This page exposes a refresh token in HTML. Prefer the pickup flow documented in docs/gmail-oauth.md.</p><p>Add this secret in Cloudflare Workers settings:</p><p><strong>Name:</strong> GMAIL_REFRESH_TOKEN</p><pre style="background:#111827;padding:16px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:#6fdfff">${escaped}</pre></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

export function renderSecureEnrollmentPage(pickupId, headers) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gmail connected</title></head><body style="background:#0a0a0c;color:#eee;font-family:ui-monospace,monospace;padding:32px;max-width:780px"><h2 style="color:#6ef0ad">Gmail enrollment succeeded</h2><p>The refresh token was <strong>not</strong> rendered in this browser page.</p><p>Retrieve it once with an authenticated pickup request:</p><pre style="background:#111827;padding:16px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:#6fdfff">curl -X POST https://&lt;worker&gt;/api/auth/enrollment/pickup \\
  -H "Authorization: Bearer &lt;API_AUTH_TOKEN&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{"pickupId":"${escapeHtml(pickupId)}"}'</pre><p>The pickup expires in five minutes and can be consumed only once.</p></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

export async function exchangeAuthorizationCode({ code, origin, env }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, status: 400, body: { ok: false, error: 'OAuth token exchange failed.', details: sanitizeOAuthError(data) } };
  }
  if (!data.refresh_token) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'OAuth succeeded but no refresh token was returned. Re-run consent with prompt=consent.',
        details: sanitizeOAuthError(data),
      },
    };
  }
  return { ok: true, refreshToken: data.refresh_token, scopes: GMAIL_OAUTH_SCOPES };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
