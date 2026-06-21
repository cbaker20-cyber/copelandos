import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { executeAllowedAction, validateActionRequest } from './actions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function json(response, status, data, cors = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...cors });
  response.end(JSON.stringify(data));
}

function secureEqual(left, right) {
  const a = createHash('sha256').update(String(left || '')).digest();
  const b = createHash('sha256').update(String(right || '')).digest();
  return timingSafeEqual(a, b);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Request body exceeds 64 KiB.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

export async function loadAllowlist(file = path.join(HERE, 'allowlist.json')) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export function createLocalAgent({ token, allowlist, allowedOrigin = '' }) {
  if (!token || token.length < 24) throw new Error('LOCAL_AGENT_TOKEN must be at least 24 characters.');

  return createServer(async (request, response) => {
    const origin = request.headers.origin || '';
    const cors = origin && allowedOrigin && origin === allowedOrigin
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : { Vary: 'Origin' };
    if (origin && origin !== allowedOrigin) return json(response, 403, { ok: false, error: 'Origin not allowed.' }, cors);
    if (request.method === 'OPTIONS') return json(response, 204, {}, { ...cors, 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });

    const provided = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secureEqual(provided, token)) return json(response, 401, { ok: false, error: 'Unauthorized.' }, cors);

    if (request.method === 'GET' && request.url === '/v1/status') {
      const result = await executeAllowedAction('read_status', {}, allowlist);
      return json(response, 200, { ...result, agent: 'copelandos-local', connected: true }, cors);
    }

    if (request.method !== 'POST' || request.url !== '/v1/action') {
      return json(response, 404, { ok: false, error: 'Route not found.' }, cors);
    }

    try {
      const body = await readJsonBody(request);
      const permission = validateActionRequest(body.action, body.payload, allowlist, { confirmed: body.confirmed === true });
      if (!permission.allowed) return json(response, permission.confirmation_required ? 409 : 403, permission, cors);
      const result = await executeAllowedAction(body.action, body.payload, allowlist);
      return json(response, 200, { ...result, permission }, cors);
    } catch (error) {
      return json(response, 400, { ok: false, error: error.message }, cors);
    }
  });
}

async function main() {
  const allowlist = await loadAllowlist(process.env.LOCAL_AGENT_ALLOWLIST || path.join(HERE, 'allowlist.json'));
  const host = process.env.LOCAL_AGENT_HOST || '127.0.0.1';
  const tailscaleAllowed = process.env.ALLOW_TAILSCALE_BIND === 'true';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !tailscaleAllowed) {
    throw new Error('Non-local binding requires ALLOW_TAILSCALE_BIND=true and a reviewed network policy.');
  }
  const port = Number(process.env.LOCAL_AGENT_PORT || 43120);
  const server = createLocalAgent({
    token: process.env.LOCAL_AGENT_TOKEN,
    allowlist,
    allowedOrigin: process.env.LOCAL_AGENT_ALLOWED_ORIGIN || '',
  });
  server.listen(port, host, () => {
    console.log(`CopelandOS local agent listening on http://${host}:${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
