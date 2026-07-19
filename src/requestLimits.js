import { getProtectedRouteClasses } from './auth.js';

export const LIMITS = {
  MAX_BODY_BYTES: 64 * 1024,
  MAX_TEXT_FIELD: 16 * 1024,
  MAX_SHORT_FIELD: 512,
  MAX_EMAIL_FIELD: 320,
  MAX_MESSAGES: 50,
  MAX_MESSAGE_CONTENT: 16 * 1024,
  MAX_SEARCH_RESULTS: 20,
  PROVIDER_RATE_LIMIT: { windowMs: 60_000, maxRequests: 30 },
};

const PROVIDER_EXTRA_ROUTES = new Set(['/api/idea']);

export function isProviderBackedRoute(path) {
  return getProtectedRouteClasses(path).includes('provider') || PROVIDER_EXTRA_ROUTES.has(path);
}

export function getClientKey(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'anonymous';
}

export function checkBodySize(request, maxBytes = LIMITS.MAX_BODY_BYTES) {
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      body: { ok: false, error: 'Request body too large.' },
    };
  }
  return { ok: true };
}

export async function parseJsonBody(request, maxBytes = LIMITS.MAX_BODY_BYTES) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
    return { ok: true, body: {} };
  }

  const sizeCheck = checkBodySize(request, maxBytes);
  if (!sizeCheck.ok) return sizeCheck;

  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return {
        ok: false,
        status: 413,
        body: { ok: false, error: 'Request body too large.' },
      };
    }
    if (!text.trim()) return { ok: true, body: {} };
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, status: 400, body: { ok: false, error: 'JSON body must be an object.' } };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, body: { ok: false, error: 'Invalid JSON body.' } };
  }
}

function fieldTooLong(field, max) {
  return { ok: false, status: 400, body: { ok: false, error: `${field} exceeds the ${max} character limit.` } };
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, status: 400, body: { ok: false, error: `${field} is required.` } };
  }
  return null;
}

function checkStringLength(value, field, max) {
  if (typeof value === 'string' && value.length > max) return fieldTooLong(field, max);
  return null;
}

export function validateRouteBody(path, body) {
  if (path === '/api/ai') {
    if (!Array.isArray(body.messages)) {
      return { ok: false, status: 400, body: { ok: false, error: 'messages must be an array.' } };
    }
    if (body.messages.length > LIMITS.MAX_MESSAGES) {
      return fieldTooLong('messages', LIMITS.MAX_MESSAGES);
    }
    for (const [index, message] of body.messages.entries()) {
      if (!message || typeof message !== 'object') {
        return { ok: false, status: 400, body: { ok: false, error: `messages[${index}] must be an object.` } };
      }
      const contentError = checkStringLength(message.content, `messages[${index}].content`, LIMITS.MAX_MESSAGE_CONTENT);
      if (contentError) return contentError;
    }
    const systemError = checkStringLength(body.system, 'system', LIMITS.MAX_TEXT_FIELD);
    if (systemError) return systemError;
    return { ok: true };
  }

  if (path === '/api/search') {
    const required = requireString(body.query, 'query');
    if (required) return required;
    const queryError = checkStringLength(body.query, 'query', LIMITS.MAX_SHORT_FIELD);
    if (queryError) return queryError;
    const num = Number(body.num ?? 6);
    if (!Number.isFinite(num) || num < 1 || num > LIMITS.MAX_SEARCH_RESULTS) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: `num must be between 1 and ${LIMITS.MAX_SEARCH_RESULTS}.` },
      };
    }
    return { ok: true };
  }

  if (path === '/api/mail/send' || path === '/api/email/draft') {
    for (const field of ['to', 'subject', 'body']) {
      const required = requireString(body[field], field);
      if (required) return required;
    }
    const toError = checkStringLength(body.to, 'to', LIMITS.MAX_EMAIL_FIELD);
    if (toError) return toError;
    const subjectError = checkStringLength(body.subject, 'subject', LIMITS.MAX_SHORT_FIELD);
    if (subjectError) return subjectError;
    const bodyError = checkStringLength(body.body, 'body', LIMITS.MAX_TEXT_FIELD);
    if (bodyError) return bodyError;
    return { ok: true };
  }

  if (path === '/api/obsidian/save' || path === '/api/vault/write') {
    const titleError = checkStringLength(body.title, 'title', LIMITS.MAX_SHORT_FIELD);
    if (titleError) return titleError;
    const folderError = checkStringLength(body.folder, 'folder', LIMITS.MAX_SHORT_FIELD);
    if (folderError) return folderError;
    const contentError = checkStringLength(body.content, 'content', LIMITS.MAX_TEXT_FIELD);
    if (contentError) return contentError;
    return { ok: true };
  }

  if (path === '/api/idea') {
    const required = requireString(body.idea, 'idea');
    if (required) return required;
    const ideaError = checkStringLength(body.idea, 'idea', LIMITS.MAX_TEXT_FIELD);
    if (ideaError) return ideaError;
    const contextError = checkStringLength(body.context, 'context', LIMITS.MAX_TEXT_FIELD);
    if (contextError) return contextError;
    return { ok: true };
  }

  if (path === '/api/plan' || path === '/api/plan/brief' || path === '/api/council') {
    const required = requireString(body.task, 'task');
    if (required) return required;
    const taskError = checkStringLength(body.task, 'task', LIMITS.MAX_TEXT_FIELD);
    if (taskError) return taskError;
    return { ok: true };
  }

  if (path === '/api/mail/read') {
    const required = requireString(body.id, 'id');
    if (required) return required;
    const idError = checkStringLength(body.id, 'id', LIMITS.MAX_SHORT_FIELD);
    if (idError) return idError;
    return { ok: true };
  }

  if (path === '/api/integrations/check') {
    const required = requireString(body.integrationId, 'integrationId');
    if (required) return required;
    const idError = checkStringLength(body.integrationId, 'integrationId', LIMITS.MAX_SHORT_FIELD);
    if (idError) return idError;
    return { ok: true };
  }

  if (path === '/api/mail/list') {
    const queryError = checkStringLength(body.query, 'query', LIMITS.MAX_SHORT_FIELD);
    if (queryError) return queryError;
    const maxResults = Number(body.maxResults ?? 15);
    if (!Number.isFinite(maxResults) || maxResults < 1 || maxResults > LIMITS.MAX_SEARCH_RESULTS) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: `maxResults must be between 1 and ${LIMITS.MAX_SEARCH_RESULTS}.` },
      };
    }
    return { ok: true };
  }

  if (path === '/api/auth/enrollment/pickup') {
    const required = requireString(body.pickupId, 'pickupId');
    if (required) return required;
    if (!/^[0-9a-f-]{36}$/i.test(body.pickupId)) {
      return { ok: false, status: 400, body: { ok: false, error: 'pickupId must be a valid UUID.' } };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function createRateLimiter({ windowMs, maxRequests }, store = new Map()) {
  return {
    check(key) {
      const now = Date.now();
      const entry = store.get(key) || { timestamps: [] };
      entry.timestamps = entry.timestamps.filter((timestamp) => now - timestamp < windowMs);
      if (entry.timestamps.length >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.timestamps[0] + windowMs - now) / 1000));
        return {
          ok: false,
          status: 429,
          retryAfterSec,
          body: { ok: false, error: 'Rate limit exceeded. Try again later.' },
        };
      }
      entry.timestamps.push(now);
      store.set(key, entry);
      return { ok: true };
    },
    reset() {
      store.clear();
    },
  };
}

const defaultProviderLimiter = createRateLimiter(LIMITS.PROVIDER_RATE_LIMIT);

export function checkProviderRateLimit(request, path, limiter = defaultProviderLimiter) {
  if (!isProviderBackedRoute(path)) return { ok: true };
  return limiter.check(`provider:${getClientKey(request)}`);
}

export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  };
}

export function safeInternalError() {
  return { ok: false, error: 'Internal server error.' };
}
