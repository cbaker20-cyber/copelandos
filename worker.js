import projectRegistry from './config/projects.json' with { type: 'json' };
import modelConfig from './config/models.json' with { type: 'json' };
import { handleFoundationRequest } from './src/foundationApi.js';
import { evaluatePermission } from './src/permissions.js';
import { getProviderCredential, routeModel } from './src/modelRouter.js';
import { handleIdeaRequest } from './src/ideaApi.js';
import { listSkills, publicSkillSummary } from './src/skills.js';
import { createPlan, createTaskBrief, selectRoles } from './src/planner.js';
import { listProviderStatuses, explainRoutingDecision, getLocalFallback, getNoSubscriptionRoute } from './src/providerRouter.js';
import { listTools, listMcpServers, checkToolPermission, checkMcpPermission, getRegistrySummary } from './src/toolRegistry.js';
import { createCouncilPrompt, createMockCouncilResult, produceFinalPlan } from './src/council.js';
import { persistVaultDocument, writeGenericVaultNote } from './src/vault.js';
import { renderCommandCenterHtml } from './src/commandCenterHtml.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = corsHeaders(request, env);

    if (!isOriginAllowed(request, env)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', Vary: 'Origin' },
      });
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (path === '/' || path === '/index.html' || path === '/console') {
      return new Response(renderCommandCenterHtml(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
      });
    }

    try {
      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        body = await request.json().catch(() => ({}));
      }

      if (path === '/api/health') {
        return json({
          ok: true,
          capabilities: {
            ai: !!(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.CEREBRAS_API_KEY || env.CEREBRAS_KEY || env.GROQ_API_KEY || env.GROQ_KEY || env.GEMINI_API_KEY || env.GEMINI_KEY || env.OPENROUTER_API_KEY || env.OPENROUTER_KEY || env.OLLAMA_BASE_URL),
            search: !!env.SERPER_KEY,
            gmail: !!env.GMAIL_REFRESH_TOKEN,
            obsidian: !!(env.GITHUB_TOKEN && env.GITHUB_REPO),
            shortcutCapture: !env.CAPTURE_TOKEN ? 'open-local-or-same-origin' : 'bearer-token-required',
            ai_providers: Object.keys(modelConfig.providers).filter((provider) => routeModel('reasoning', env, {
              ...modelConfig,
              routes: { reasoning: [provider] },
            }).ok),
          },
        });
      }

      const foundationResponse = await handleFoundationRequest({
        path,
        request,
        body,
        env,
        json,
        projectRegistry,
        modelConfig,
        createEmailDraft: createGmailDraft,
      });
      if (foundationResponse) return foundationResponse;

      if (path.startsWith('/api/capture/') || path.startsWith('/api/ideas')) {
        if (path === '/api/capture/idea' && !isCaptureAuthorized(request, env)) {
          return json({ ok: false, error: 'Capture token required.' }, 401);
        }
        const ideaResponse = await handleIdeaRequest({ path, request, body, env, json });
        if (ideaResponse) return ideaResponse;
      }

      if (path === '/api/skills') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, skills: listSkills().map(publicSkillSummary) });
      }

      if (path === '/api/plan') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        return json({ ok: true, plan: createPlan(body.task) });
      }

      if (path === '/api/plan/brief') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        return json({ ok: true, brief: createTaskBrief(body.task) });
      }

      if (path === '/api/providers') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, providers: listProviderStatuses(env) });
      }

      if (path === '/api/providers/route') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        return json({ ok: true, decision: explainRoutingDecision({ taskType: body.taskType || 'reasoning' }, env) });
      }

      if (path === '/api/providers/local-fallback') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, localFallback: getLocalFallback({}, env) });
      }

      if (path === '/api/providers/no-subscription') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, ...getNoSubscriptionRoute({}, env) });
      }

      if (path === '/api/tools') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        const category = url.searchParams.get('category') || '';
        const family = url.searchParams.get('family') || '';
        return json({ ok: true, tools: listTools({ category: category || null, family: family || null }) });
      }

      if (path === '/api/tools/check') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.toolId) return json({ ok: false, error: 'toolId is required.' }, 400);
        return json(checkToolPermission(body.toolId, body.action || null));
      }

      if (path === '/api/mcp/registry') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, servers: listMcpServers(), policy: 'allowlist-first' });
      }

      if (path === '/api/mcp/check') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.serverId) return json({ ok: false, error: 'serverId is required.' }, 400);
        return json(checkMcpPermission(body.serverId, body.operation || null));
      }

      if (path === '/api/registry/summary') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, ...getRegistrySummary() });
      }

      if (path === '/api/council') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        const roles = selectRoles(body.task);
        const prompt = createCouncilPrompt(body.task, roles);
        const mockResults = roles.map((role) => createMockCouncilResult(role.id, body.task));
        const finalPlan = produceFinalPlan(mockResults, body.task);
        return json({ ok: true, task: body.task, roles: roles.map((role) => role.id), prompt, mockResults, finalPlan, mode: 'mock' });
      }

      if (path === '/api/ai') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        const { messages, system } = body;
        if (!Array.isArray(messages)) return json({ error: 'messages must be an array' }, 400);
        const selected = routeModel(body.taskType || 'reasoning', env, modelConfig);
        if (!selected.ok) return json({ error: selected.error, tried: selected.tried }, 503);
        const clients = {
          openai: callOpenAI,
          anthropic: callAnthropic,
          cerebras: callCerebras,
          groq: callGroq,
          gemini: callGemini,
          openrouter: callOpenRouter,
          ollama: callOllama,
        };
        try {
          const key = getProviderCredential(env, selected.provider, modelConfig);
          const text = await clients[selected.provider](messages, system, key, env, selected.model);
          return json({ text, provider: selected.provider, model: selected.model, taskType: selected.taskType });
        } catch (error) {
          return json({ error: `${selected.provider} request failed: ${error.message}` }, 503);
        }
      }

      if (path === '/api/search') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!env.SERPER_KEY) return json({ error: 'SERPER_KEY not set' }, 503);
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': env.SERPER_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: body.query, num: body.num || 6 }),
        });
        if (!response.ok) return json({ error: `Serper ${response.status}` }, 500);
        const data = await response.json();
        return json({
          query: body.query,
          results: (data.organic || []).map((item) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            date: item.date || null,
          })),
          answerBox: data.answerBox || null,
        });
      }

      if (path === '/api/mail/list') {
        const token = await getGmailToken(env);
        const params = new URLSearchParams({ maxResults: String(body.maxResults || 15), q: body.query || 'in:inbox' });
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return json({ error: `Gmail list failed: ${response.status}` }, 500);
        const data = await response.json();
        const messages = await Promise.all((data.messages || []).slice(0, 15).map(async (message) => {
          const metaResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const metadata = await metaResponse.json();
          const headers = Object.fromEntries((metadata.payload?.headers || []).map((header) => [header.name, header.value]));
          return { id: message.id, subject: headers.Subject || '(no subject)', from: headers.From || '', date: headers.Date || '', snippet: metadata.snippet || '' };
        }));
        return json({ ok: true, messages });
      }

      if (path === '/api/mail/read') {
        const token = await getGmailToken(env);
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${body.id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return json({ error: 'Gmail read failed' }, 500);
        const data = await response.json();
        const headers = Object.fromEntries((data.payload?.headers || []).map((header) => [header.name, header.value]));
        return json({ ok: true, id: data.id, subject: headers.Subject, from: headers.From, date: headers.Date, body: extractEmailBody(data.payload) });
      }

      if (path === '/api/mail/send') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        const permission = evaluatePermission('create_gmail_draft', { confirmed: body.confirmed === true });
        if (!permission.allowed) return json(permission, 409);
        return json({ ...(await createGmailDraft(body, env)), permission });
      }

      if (path === '/api/obsidian/save') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        const permission = evaluatePermission('write_vault_note');
        if (!permission.allowed) return json(permission, 409);
        try {
          const document = writeGenericVaultNote({
            title: body.title || 'CopelandOS Note',
            folder: body.folder || 'Inbox',
            content: body.content || '',
            agent: body.agent || 'copelandos',
            tags: body.tags || [],
          }, { containsPrivateStudentData: body.containsPrivateStudentData === true });
          const result = await persistVaultDocument(document, env);
          return json({ ok: true, success: true, ...result, permission });
        } catch (error) {
          return json({ ok: false, success: false, error: error.message, permission }, 400);
        }
      }

      if (path === '/api/obsidian/list') {
        if (request.method !== 'POST' && request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET or POST.' }, 405);
        if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ ok: true, connected: false, files: [] });
        const root = encodeURIComponent(env.VAULT_ROOT || 'CopelandVault');
        const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${root}`, {
          headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' },
        });
        if (!response.ok) return json({ ok: true, connected: true, files: [] });
        const items = await response.json();
        return json({
          ok: true,
          connected: true,
          files: (Array.isArray(items) ? items : [])
            .filter((item) => item.name?.endsWith?.('.md') || item.type === 'dir')
            .map((item) => ({ name: item.name, path: item.path, type: item.type, url: item.html_url || null })),
        });
      }

      if (path === '/api/idea') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        const { idea, context = '' } = body;
        if (!idea) return json({ ok: false, error: 'idea is required.' }, 400);
        const system = `You are Chief of Staff for Copeland. Expand a raw idea into an actionable markdown note with title, summary, next actions, resources, category, and priority.`;
        let expanded = `## Idea: ${idea}\n\n${context}`.trim();
        const providers = [
          { key: env.CEREBRAS_KEY || env.CEREBRAS_API_KEY, fn: callCerebras },
          { key: env.GROQ_KEY || env.GROQ_API_KEY, fn: callGroq },
          { key: env.GEMINI_KEY || env.GEMINI_API_KEY, fn: callGemini },
        ].filter((provider) => provider.key);
        for (const provider of providers) {
          try {
            expanded = await provider.fn([{ role: 'user', content: `${idea}${context ? `\nContext: ${context}` : ''}` }], system, provider.key, env);
            break;
          } catch (error) {
            // Keep the deterministic fallback when providers are missing/rate-limited.
          }
        }
        const titleMatch = expanded.match(/## Idea:\s*(.+)/);
        const title = titleMatch?.[1]?.trim() || String(idea).slice(0, 60);
        const document = writeGenericVaultNote({ title, folder: 'Ideas', content: expanded, agent: 'chief', tags: ['idea', 'auto'] });
        const vault = await persistVaultDocument(document, env);
        return json({ ok: true, idea, title, expanded, folder: 'Ideas', saved: vault.connected, path: vault.path, vault });
      }

      if (path === '/api/auth/gmail') {
        if (!env.GMAIL_CLIENT_ID) return json({ ok: false, error: 'GMAIL_CLIENT_ID is not configured.' }, 503);
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', env.GMAIL_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.compose');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        return Response.redirect(authUrl.toString(), 302);
      }

      if (path === '/api/auth/callback') {
        const code = url.searchParams.get('code');
        if (!code) return json({ ok: false, error: 'Missing OAuth code.' }, 400);
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GMAIL_CLIENT_ID,
            client_secret: env.GMAIL_CLIENT_SECRET,
            redirect_uri: `${url.origin}/api/auth/callback`,
            grant_type: 'authorization_code',
          }),
        });
        const data = await response.json();
        if (data.refresh_token) return renderOAuthTokenPage(data.refresh_token, cors);
        return json({ ok: false, error: 'OAuth failed', details: sanitizeOAuthError(data) }, 400);
      }

      return json({ ok: true, status: 'CopelandOS Worker online', console: `${url.origin}/console` });
    } catch (error) {
      return json({ ok: false, error: error.message }, 500);
    }
  },
};

function isOriginAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const allowed = (env.ALLOWED_ORIGIN || '').trim();
  return Boolean(allowed) && origin === allowed;
}

function corsHeaders(request, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
  const origin = request.headers.get('Origin');
  if (origin && isOriginAllowed(request, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function isCaptureAuthorized(request, env) {
  if (!env.CAPTURE_TOKEN) return true;
  const auth = request.headers.get('Authorization') || '';
  const token = new URL(request.url).searchParams.get('token') || '';
  return auth === `Bearer ${env.CAPTURE_TOKEN}` || token === env.CAPTURE_TOKEN;
}

async function callOpenAI(messages, system, key, env, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  return (await response.json()).choices?.[0]?.message?.content || '';
}

async function callAnthropic(messages, system, key, env, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, system: system || undefined, messages, max_tokens: 2048 }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  return ((await response.json()).content || []).map((part) => part.text || '').join('');
}

async function callOllama(messages, system, key, env, model) {
  const base = new URL(env.OLLAMA_BASE_URL);
  if (base.username || base.password || !['http:', 'https:'].includes(base.protocol)) throw new Error('Unsafe OLLAMA_BASE_URL');
  const response = await fetch(new URL('/api/chat', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false, messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages] }),
  });
  if (!response.ok) throw new Error(`Ollama ${response.status}`);
  return (await response.json()).message?.content || '';
}

async function callCerebras(messages, system, key, env, model) {
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || env?.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (response.status === 429) throw new Error('Cerebras rate limited');
  if (!response.ok) throw new Error(`Cerebras ${response.status}`);
  return (await response.json()).choices[0].message.content;
}

async function callGroq(messages, system, key, env, model) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || env?.GROQ_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (response.status === 429) throw new Error('Groq rate limited');
  if (!response.ok) throw new Error(`Groq ${response.status}`);
  return (await response.json()).choices[0].message.content;
}

async function callGemini(messages, system, key, env, model) {
  const selectedModel = model || env?.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });
  if (response.status === 429) throw new Error('Gemini rate limited');
  if (!response.ok) throw new Error(`Gemini ${response.status}`);
  return (await response.json()).candidates[0].content.parts.map((part) => part.text).join('');
}

async function callOpenRouter(messages, system, key, env, model) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://copelandos.pages.dev', 'X-Title': 'CopelandOS' },
    body: JSON.stringify({ model: model || env?.OPENROUTER_MODEL || 'qwen/qwen3-coder:free', messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (response.status === 429) throw new Error('OpenRouter rate limited');
  if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
  return (await response.json()).choices[0].message.content;
}

async function getGmailToken(env) {
  if (!env.GMAIL_REFRESH_TOKEN) throw new Error('Gmail not connected. Visit /api/auth/gmail.');
  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET) throw new Error('Gmail OAuth client is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!data.access_token) throw new Error('Gmail token failed.');
  return data.access_token;
}

async function createGmailDraft({ to, subject, body, threadId }, env) {
  if (!to || !subject || !body) throw new Error('to, subject, body required');
  const token = await getGmailToken(env);
  const raw = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const message = { raw: encoded };
  if (threadId) message.threadId = threadId;
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error(`Gmail draft failed (${response.status}).`);
  const draft = await response.json();
  return { ok: true, success: true, draft: true, id: draft.id };
}

function extractEmailBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) return decode64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) if (part.mimeType === 'text/plain' && part.body?.data) return decode64(part.body.data);
    for (const part of payload.parts) {
      const text = extractEmailBody(part);
      if (text) return text;
    }
  }
  return '';
}

function decode64(data) {
  try { return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/')))); }
  catch { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); }
}

function sanitizeOAuthError(data) {
  const allowed = ['error', 'error_description'];
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.includes(key)));
}

function renderOAuthTokenPage(refreshToken, cors) {
  const escaped = escapeHtml(refreshToken);
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gmail connected</title></head><body style="background:#0a0a0c;color:#eee;font-family:ui-monospace,monospace;padding:32px;max-width:780px"><h2 style="color:#6ef0ad">Gmail draft access connected</h2><p>Add this secret in Cloudflare Workers settings:</p><p><strong>Name:</strong> GMAIL_REFRESH_TOKEN</p><pre style="background:#111827;padding:16px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:#6fdfff">${escaped}</pre><p>This enables draft creation only. CopelandOS still does not send emails from the console.</p></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
