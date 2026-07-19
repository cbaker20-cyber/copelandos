const GMAIL_PREFIXES = ['/api/mail/', '/api/email/draft', '/api/auth/gmail', '/api/auth/callback', '/api/auth/enrollment/pickup'];
const VAULT_WRITE_EXACT = new Set(['/api/vault/write', '/api/obsidian/save', '/api/idea']);
const VAULT_WRITE_PREFIXES = ['/api/capture/idea'];
const PROVIDER_EXACT = new Set(['/api/ai', '/api/search', '/api/hermes/route', '/api/automation/route']);

const IDEA_CONVERT_PATTERN = /^\/api\/ideas\/[^/]+\/convert$/;
const CAPTURE_PATH = '/api/capture/idea';
const AGENT_ACTION_PATTERN = /^\/api\/agents\/[^/]+\/(heartbeat|runs|block|unblock)$/;
const TASK_ACTION_PATTERN = /^\/api\/tasks\/[^/]+\/(claim|start|complete|fail|cancel|retry)$/;

export const PROTECTED_CLASSES = ['gmail', 'vault_write', 'provider', 'agent_mutation', 'task_mutation'];

export function isAgentMutationRoute(path, method) {
  if (path === '/api/agents' && method === 'POST') return true;
  if (method === 'PATCH' && /^\/api\/agents\/[^/]+$/.test(path)) return true;
  if (method === 'POST' && AGENT_ACTION_PATTERN.test(path)) return true;
  return false;
}

export function isTaskMutationRoute(path, method) {
  if (path === '/api/tasks' && method === 'POST') return true;
  if (method === 'POST' && TASK_ACTION_PATTERN.test(path)) return true;
  return false;
}

export function getProtectedRouteClasses(path) {
  const classes = [];
  if (GMAIL_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    classes.push('gmail');
  }
  if (
    VAULT_WRITE_EXACT.has(path) ||
    VAULT_WRITE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix)) ||
    IDEA_CONVERT_PATTERN.test(path)
  ) {
    classes.push('vault_write');
  }
  if (PROVIDER_EXACT.has(path)) {
    classes.push('provider');
  }
  return classes;
}

export function isProtectedRoute(path) {
  return getProtectedRouteClasses(path).length > 0;
}

export function extractBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export function isCaptureTokenPresented(request, captureToken) {
  const auth = request.headers.get('Authorization') || '';
  const queryToken = new URL(request.url).searchParams.get('token') || '';
  return auth === `Bearer ${captureToken}` || queryToken === captureToken;
}

export function isApiAuthorized(request, env, path = new URL(request.url).pathname) {
  const configured = (env.API_AUTH_TOKEN || '').trim();
  const presented = extractBearerToken(request);

  if (configured) {
    if (presented && presented === configured) return { ok: true };
    if (!presented) return { ok: false, reason: 'missing' };
    return { ok: false, reason: 'invalid' };
  }

  const captureToken = (env.CAPTURE_TOKEN || '').trim();
  if (path === CAPTURE_PATH || path.startsWith(`${CAPTURE_PATH}/`)) {
    if (captureToken && isCaptureTokenPresented(request, captureToken)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'not_configured' };
}

export function checkApiAccess(request, env) {
  const path = new URL(request.url).pathname;
  if (!isProtectedRoute(path) && !isAgentMutationRoute(path, request.method) && !isTaskMutationRoute(path, request.method)) {
    return { ok: true };
  }
  const auth = isApiAuthorized(request, env);
  if (auth.ok) return { ok: true };
  if (auth.reason === 'not_configured') {
    return {
      ok: false,
      status: 503,
      body: { ok: false, error: 'API authentication is not configured. Set API_AUTH_TOKEN.' },
    };
  }
  return {
    ok: false,
    status: 401,
    body: { ok: false, error: 'Authentication required. Send Authorization: Bearer <API_AUTH_TOKEN>.' },
  };
}
