import projectRegistry from './config/projects.json' with { type: 'json' };
import modelConfig from './config/models.json' with { type: 'json' };
import { handleFoundationRequest } from './src/foundationApi.js';
import { evaluatePermission } from './src/permissions.js';
import { getProviderCredential, routeModel } from './src/modelRouter.js';
import { handleIdeaRequest } from './src/ideaApi.js';
import { listSkills, publicSkillSummary } from './src/skills.js';
import { createPlan, createTaskBrief } from './src/planner.js';
import { listProviderStatuses, chooseProvider, explainRoutingDecision, getLocalFallback, getNoSubscriptionRoute } from './src/providerRouter.js';
import { listTools, listMcpServers, checkToolPermission, checkMcpPermission, getRegistrySummary } from './src/toolRegistry.js';
import { createCouncilPrompt, createRolePrompt, createMockCouncilResult, produceFinalPlan } from './src/council.js';
import planningRoles from './config/planning-roles.json' with { type: 'json' };

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

    // Serve frontend HTML for root
    if (path === '/' || path === '/index.html') {
      return new Response('CopelandOS worker running. Open your Pages URL to use the app.', {status: 200});
    }

    try {
      // ── /api/health ──────────────────────────────────────
      if (path === '/api/health') {
        return json({
          ok: true,
          capabilities: {
            ai: !!(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.CEREBRAS_API_KEY || env.CEREBRAS_KEY || env.GROQ_API_KEY || env.GROQ_KEY || env.GEMINI_API_KEY || env.GEMINI_KEY || env.OPENROUTER_API_KEY || env.OPENROUTER_KEY || env.OLLAMA_BASE_URL),
            search: !!env.SERPER_KEY,
            gmail: !!env.GMAIL_REFRESH_TOKEN,
            obsidian: !!(env.GITHUB_TOKEN && env.GITHUB_REPO),
            ai_providers: Object.keys(modelConfig.providers).filter((provider) => routeModel('reasoning', env, {
              ...modelConfig,
              routes: { reasoning: [provider] },
            }).ok),
          }
        });
      }

      let body = {};
      if (request.method === 'POST') {
        body = await request.json().catch(() => ({}));
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

      // ── Brain pipeline: idea capture ──────────────────────
      if (
        path.startsWith('/api/capture/') ||
        path.startsWith('/api/ideas') ||
        path === '/api/brain/status' ||
        path === '/api/project-queue' ||
        path === '/api/orchestration/status'
      ) {
        const ideaResponse = await handleIdeaRequest({ path, request, body, env, json });
        if (ideaResponse) return ideaResponse;
      }

      // ── /api/skills ───────────────────────────────────────
      if (path === '/api/skills') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, skills: listSkills().map(publicSkillSummary) });
      }

      // ── /api/plan ─────────────────────────────────────────
      if (path === '/api/plan') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        const plan = createPlan(body.task);
        return json({ ok: true, plan });
      }

      // ── /api/plan/brief ───────────────────────────────────
      if (path === '/api/plan/brief') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        const brief = createTaskBrief(body.task);
        return json({ ok: true, brief });
      }

      // ── /api/providers ────────────────────────────────────
      if (path === '/api/providers') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        const statuses = listProviderStatuses(env);
        return json({ ok: true, providers: statuses });
      }

      // ── /api/providers/route ──────────────────────────────
      if (path === '/api/providers/route') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        const taskProfile = { taskType: body.taskType || 'reasoning' };
        const decision = explainRoutingDecision(taskProfile, env);
        return json({ ok: true, decision });
      }

      // ── /api/providers/local-fallback ─────────────────────
      if (path === '/api/providers/local-fallback') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, localFallback: getLocalFallback({}, env) });
      }

      // ── /api/providers/no-subscription ───────────────────
      if (path === '/api/providers/no-subscription') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, ...getNoSubscriptionRoute({}, env) });
      }

      // ── /api/tools ────────────────────────────────────────
      if (path === '/api/tools') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        const url2 = new URL(request.url);
        const category = url2.searchParams.get('category') || '';
        const family = url2.searchParams.get('family') || '';
        return json({ ok: true, tools: listTools({ category: category || null, family: family || null }) });
      }

      // ── /api/tools/check ─────────────────────────────────
      if (path === '/api/tools/check') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.toolId) return json({ ok: false, error: 'toolId is required.' }, 400);
        return json(checkToolPermission(body.toolId, body.action || null));
      }

      // ── /api/mcp/registry ─────────────────────────────────
      if (path === '/api/mcp/registry') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, servers: listMcpServers(), policy: 'allowlist-first' });
      }

      // ── /api/mcp/check ────────────────────────────────────
      if (path === '/api/mcp/check') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.serverId) return json({ ok: false, error: 'serverId is required.' }, 400);
        return json(checkMcpPermission(body.serverId, body.operation || null));
      }

      // ── /api/registry/summary ────────────────────────────
      if (path === '/api/registry/summary') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, ...getRegistrySummary() });
      }

      // ── /api/council ─────────────────────────────────────
      if (path === '/api/council/roles') {
        if (request.method !== 'GET') return json({ ok: false, error: 'Method not allowed. Use GET.' }, 405);
        return json({ ok: true, roles: planningRoles.roles, selectionRules: planningRoles.selectionRules });
      }

      if (path === '/api/council/role-prompt') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.roleId || !body.task) return json({ ok: false, error: 'roleId and task are required.' }, 400);
        try {
          return json({ ok: true, roleId: body.roleId, prompt: createRolePrompt(body.roleId, body.task) });
        } catch (error) {
          return json({ ok: false, error: error.message }, 400);
        }
      }

      if (path === '/api/council') {
        if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
        if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
        const { selectRoles } = await import('./src/planner.js');
        const roles = selectRoles(body.task);
        const prompt = createCouncilPrompt(body.task, roles);
        const mockResults = roles.map(r => createMockCouncilResult(r.id, body.task));
        const finalPlan = produceFinalPlan(mockResults, body.task);
        return json({ ok: true, task: body.task, roles: roles.map(r => r.id), prompt, mockResults, finalPlan, mode: 'mock' });
      }

      // ── /api/ai ───────────────────────────────────────────
      if (path === '/api/ai') {
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

      // ── /api/search ───────────────────────────────────────
      if (path === '/api/search') {
        if (!env.SERPER_KEY) return json({ error: 'SERPER_KEY not set' }, 503);
        const r = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': env.SERPER_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: body.query, num: body.num || 6 }),
        });
        if (!r.ok) return json({ error: 'Serper ' + r.status }, 500);
        const d = await r.json();
        return json({
          query: body.query,
          results: (d.organic || []).map(i => ({
            title: i.title, url: i.link, snippet: i.snippet, date: i.date || null
          })),
          answerBox: d.answerBox || null,
        });
      }

      // ── /api/mail/list ────────────────────────────────────
      if (path === '/api/mail/list') {
        const token = await getGmailToken(env);
        const params = new URLSearchParams({ maxResults: body.maxResults || 15, q: body.query || 'in:inbox' });
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return json({ error: 'Gmail list failed: ' + r.status }, 500);
        const d = await r.json();
        const messages = await Promise.all(
          (d.messages || []).slice(0, 15).map(async msg => {
            const mr = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const md = await mr.json();
            const h = Object.fromEntries((md.payload?.headers || []).map(h => [h.name, h.value]));
            return { id: msg.id, subject: h.Subject || '(no subject)', from: h.From || '', date: h.Date || '', snippet: md.snippet || '' };
          })
        );
        return json({ messages });
      }

      // ── /api/mail/read ────────────────────────────────────
      if (path === '/api/mail/read') {
        const token = await getGmailToken(env);
        const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${body.id}?format=full`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return json({ error: 'Gmail read failed' }, 500);
        const d = await r.json();
        const h = Object.fromEntries((d.payload?.headers || []).map(h => [h.name, h.value]));
        return json({ id: d.id, subject: h.Subject, from: h.From, date: h.Date, body: extractEmailBody(d.payload) });
      }

      // ── /api/mail/send ────────────────────────────────────
      if (path === '/api/mail/send') {
        const permission = evaluatePermission('create_gmail_draft', { confirmed: body.confirmed === true });
        if (!permission.allowed) return json(permission, 409);
        return json({ ...(await createGmailDraft(body, env)), permission });
      }

      // ── /api/obsidian/save ────────────────────────────────
      if (path === '/api/obsidian/save') {
        if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: 'GITHUB_TOKEN and GITHUB_REPO not set' }, 503);
        const { title, folder = 'Inbox', content, agent = 'unknown', tags = [] } = body;
        const now = new Date().toISOString().slice(0,10);
        const safe = title.replace(/[<>:"/\\|?*]/g,'_').replace(/\s+/g,'-').slice(0,80);
        const root = env.VAULT_ROOT || 'Vault';
        const filePath = `${root}/${folder}/${safe}.md`;
        const fm = `---\ntags: [copelandos, ${agent}${tags.length?', '+tags.join(', '):''}, ${folder.toLowerCase()}]\ndate: ${now}\nagent: ${agent}\n---\n\n`;
        const fileContent = fm + `# ${title}\n\n` + content;
        const encoded = btoa(unescape(encodeURIComponent(fileContent)));
        let sha;
        const check = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`, {
          headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' }
        });
        if (check.ok) sha = (await check.json()).sha;
        const putBody = { message: `CopelandOS [${agent}]: ${folder}/${safe}`, content: encoded, branch: env.VAULT_BRANCH || 'main' };
        if (sha) putBody.sha = sha;
        const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'CopelandOS' },
          body: JSON.stringify(putBody),
        });
        if (!r.ok) return json({ error: 'GitHub write failed: ' + r.status }, 500);
        return json({ success: true, path: filePath });
      }

      // ── /api/obsidian/list ────────────────────────────────
      if (path === '/api/obsidian/list') {
        if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ files: [] });
        const root = env.VAULT_ROOT || 'Vault';
        const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${root}`, {
          headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' }
        });
        if (!r.ok) return json({ files: [] });
        const items = await r.json();
        const folders = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];
        const allFiles = [];
        for (const folder of folders) {
          const fr = await fetch(folder.url, { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' } });
          if (!fr.ok) continue;
          const files = await fr.json();
          (Array.isArray(files) ? files : []).filter(f => f.name.endsWith('.md')).forEach(f =>
            allFiles.push({ name: f.name, path: f.path, url: f.html_url, folder: folder.name })
          );
        }
        return json({ files: allFiles });
      }

      // ── /api/idea ─────────────────────────────────────────
      if (path === '/api/idea') {
        const { idea, context = '' } = body;
        const sys = `You are Chief of Staff for Copeland, an engineering student who builds AI tools, plays music, and applies for internships/scholarships.
Expand this raw idea into an actionable note:

## Idea: [title]
**Summary:** [one sentence]
**Why this matters:** [2 sentences]
**Next actions:**
- [ ] [action doable today]
- [ ] [action]
- [ ] [action]
**Resources:** [what's needed]
**Category:** [Internship | Scholarship | Coding Project | Music | School | AI System | Other]
**Priority:** [High/Medium/Low] — [one sentence reason]`;

        let expanded = `## Idea: ${idea}\n\n${context}`;
        const providers = [
          { key: env.CEREBRAS_KEY, fn: callCerebras },
          { key: env.GROQ_KEY, fn: callGroq },
          { key: env.GEMINI_KEY, fn: callGemini },
        ].filter(p => p.key);

        for (const p of providers) {
          try {
            expanded = await p.fn([{ role:'user', content: idea + (context?'\nContext: '+context:'') }], sys, p.key, env);
            break;
          } catch(e) {}
        }

        const catMatch = expanded.match(/\*\*Category:\*\*\s*([^\n]+)/i);
        const cat = (catMatch?.[1] || '').toLowerCase();
        const folderMap = { internship:'Internships', scholarship:'Scholarships', coding:'Projects', music:'Music', school:'School', ai:'Projects', other:'Ideas' };
        const folder = Object.entries(folderMap).find(([k]) => cat.includes(k))?.[1] || 'Ideas';
        const titleMatch = expanded.match(/## Idea: (.+)/);
        const title = titleMatch?.[1]?.trim() || idea.slice(0,60);

        let saved = false, filePath = null;
        if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
          try {
            const saveReq = new Request(url.origin + '/api/obsidian/save', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, folder, content: expanded, agent: 'chief', tags: ['idea','auto'] })
            });
            const saveResp = await fetch(saveReq);
            const saveData = await saveResp.json();
            saved = saveData.success; filePath = saveData.path;
          } catch(e) {}
        }
        return json({ idea, title, expanded, folder, saved, path: filePath });
      }

      // ── /api/auth/gmail ───────────────────────────────────
      if (path === '/api/auth/gmail') {
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', env.GMAIL_CLIENT_ID || '');
        authUrl.searchParams.set('redirect_uri', url.origin + '/api/auth/callback');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        return Response.redirect(authUrl.toString(), 302);
      }

      // ── /api/auth/callback ────────────────────────────────
      if (path === '/api/auth/callback') {
        const code = url.searchParams.get('code');
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, redirect_uri: url.origin + '/api/auth/callback', grant_type: 'authorization_code' }),
        });
        const d = await r.json();
        if (d.refresh_token) {
          return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background:#0a0a0c;color:#eee;font-family:monospace;padding:40px;max-width:600px"><h2 style="color:#2ec97a">✓ Gmail connected!</h2><p>Add this to Cloudflare → Settings → Variables:</p><p><strong>Name:</strong> GMAIL_REFRESH_TOKEN</p><pre style="background:#1a1a1d;padding:16px;border-radius:8px;word-break:break-all;color:#4aaef5;overflow-wrap:anywhere">${d.refresh_token}</pre><p style="color:#aaa">After adding it, redeploy (push any change to GitHub).</p></body></html>`,
            { headers: { 'Content-Type': 'text/html', ...cors } });
        }
        return new Response('OAuth failed: ' + JSON.stringify(d), { status: 400 });
      }

      // Fallback
      return new Response(JSON.stringify({status:'ok'}), {headers:{'Content-Type':'application/json',...cors}});

    } catch(e) {
      return json({ error: e.message }, 500);
    }
  }
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
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  const origin = request.headers.get('Origin');
  if (origin && isOriginAllowed(request, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

// ── AI PROVIDERS ─────────────────────────────────────────
async function callOpenAI(messages, system, key, env, model) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  return (await r.json()).choices?.[0]?.message?.content || '';
}

async function callAnthropic(messages, system, key, env, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, system: system || undefined, messages, max_tokens: 2048 }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}`);
  return ((await r.json()).content || []).map((part) => part.text || '').join('');
}

async function callOllama(messages, system, key, env, model) {
  const base = new URL(env.OLLAMA_BASE_URL);
  if (base.username || base.password || !['http:', 'https:'].includes(base.protocol)) throw new Error('Unsafe OLLAMA_BASE_URL');
  const r = await fetch(new URL('/api/chat', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  return (await r.json()).message?.content || '';
}

async function callCerebras(messages, system, key, env, model) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || env?.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error('Cerebras rate limited');
  if (!r.ok) throw new Error('Cerebras ' + r.status);
  return (await r.json()).choices[0].message.content;
}

async function callGroq(messages, system, key, env, model) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || env?.GROQ_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error('Groq rate limited');
  if (!r.ok) throw new Error('Groq ' + r.status);
  return (await r.json()).choices[0].message.content;
}

async function callGemini(messages, system, key, env, model) {
  const selectedModel = model || env?.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: messages.map(m => ({ role: m.role==='assistant'?'model':'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 2048, temperature: 0.7 } }),
  });
  if (r.status === 429) throw new Error('Gemini rate limited');
  if (!r.ok) throw new Error('Gemini ' + r.status);
  return (await r.json()).candidates[0].content.parts.map(p => p.text).join('');
}

async function callOpenRouter(messages, system, key, env, model) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://copelandos.pages.dev', 'X-Title': 'CopelandOS' },
    body: JSON.stringify({ model: model || env?.OPENROUTER_MODEL || 'qwen/qwen3-coder:free', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error('OpenRouter rate limited');
  if (!r.ok) throw new Error('OpenRouter ' + r.status);
  return (await r.json()).choices[0].message.content;
}

// ── GMAIL HELPERS ─────────────────────────────────────────
async function getGmailToken(env) {
  if (!env.GMAIL_REFRESH_TOKEN) throw new Error('Gmail not connected. Visit /api/auth/gmail');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Gmail token failed');
  return d.access_token;
}

async function createGmailDraft({ to, subject, body, threadId }, env) {
  if (!to || !subject || !body) throw new Error('to, subject, body required');
  const token = await getGmailToken(env);
  const raw = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_');
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
    for (const p of payload.parts) { if (p.mimeType === 'text/plain' && p.body?.data) return decode64(p.body.data); }
    for (const p of payload.parts) { const t = extractEmailBody(p); if (t) return t; }
  }
  return '';
}

function decode64(data) {
  try { return decodeURIComponent(escape(atob(data.replace(/-/g,'+').replace(/_/g,'/')))); }
  catch { return atob(data.replace(/-/g,'+').replace(/_/g,'/')); }
}
