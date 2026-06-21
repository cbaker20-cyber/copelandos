/**
 * CopelandOS — Cloudflare Pages Function
 * File: functions/api/[[route]].js
 * This single file handles ALL /api/* routes.
 * Cloudflare auto-deploys it when you push to GitHub.
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const route = url.pathname.replace('/api/', '');
  const cors = corsHeaders(request, env);

  if (!isOriginAllowed(request, env)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', Vary: 'Origin' },
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  try {
    // ── GET /api/health ─────────────────────────────────
    if (route === 'health') {
      return json({
        ok: true,
        capabilities: {
          ai:       !!(env.CEREBRAS_KEY || env.GROQ_KEY || env.GEMINI_KEY || env.OPENROUTER_KEY),
          search:   !!(env.SERPER_KEY),
          gmail:    !!(env.GMAIL_REFRESH_TOKEN),
          obsidian: !!(env.GITHUB_TOKEN && env.GITHUB_REPO),
          providers: ['cerebras','groq','gemini','openrouter'].filter(p => env[p.toUpperCase()+'_KEY']),
        }
      });
    }

    // All other routes require POST + JSON body
    let body = {};
    if (request.method === 'POST') {
      body = await request.json().catch(() => ({}));
    }

    // ── POST /api/ai ─────────────────────────────────────
    if (route === 'ai') return json(await handleAI(body, env));

    // ── POST /api/search ──────────────────────────────────
    if (route === 'search') return json(await handleSearch(body, env));

    // ── POST /api/mail/list ───────────────────────────────
    if (route === 'mail/list') return json(await handleMailList(body, env));

    // ── POST /api/mail/read ───────────────────────────────
    if (route === 'mail/read') return json(await handleMailRead(body, env));

    // ── POST /api/mail/send ───────────────────────────────
    if (route === 'mail/send') return json(await handleMailSend(body, env));

    // ── POST /api/obsidian/save ───────────────────────────
    if (route === 'obsidian/save') return json(await handleObsidianSave(body, env));

    // ── POST /api/obsidian/list ───────────────────────────
    if (route === 'obsidian/list') return json(await handleObsidianList(env));

    // ── POST /api/idea ────────────────────────────────────
    if (route === 'idea') return json(await handleIdea(body, env));

    // ── GET /api/auth/gmail ───────────────────────────────
    if (route === 'auth/gmail') return gmailAuthRedirect(request, env);

    // ── GET /api/auth/callback ────────────────────────────
    if (route === 'auth/callback') return gmailAuthCallback(request, env, cors);

    return json({ error: 'Unknown route: ' + route }, 404);

  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
}

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

// ═══════════════════════════════════════
// AI — rotates through available providers
// ═══════════════════════════════════════
async function handleAI({ messages, system }, env) {
  const providers = [
    { name: 'cerebras',   key: env.CEREBRAS_KEY,   fn: callCerebras },
    { name: 'groq',       key: env.GROQ_KEY,       fn: callGroq },
    { name: 'gemini',     key: env.GEMINI_KEY,     fn: callGemini },
    { name: 'openrouter', key: env.OPENROUTER_KEY, fn: callOpenRouter },
  ].filter(p => p.key);

  if (!providers.length) throw new Error('No AI keys in environment. Add CEREBRAS_KEY or GROQ_KEY in Cloudflare Pages → Settings → Environment Variables.');

  let lastErr;
  for (const p of providers) {
    try {
      const text = await p.fn(messages, system, p.key, env);
      return { text, provider: p.name };
    } catch (e) {
      console.warn(p.name, 'failed:', e.message);
      lastErr = e;
    }
  }
  throw new Error('All AI providers failed. Last error: ' + lastErr?.message);
}

async function callCerebras(messages, system, key, env) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7,
    }),
  });
  if (r.status === 429) throw new Error('Cerebras rate limited');
  if (!r.ok) throw new Error(`Cerebras ${r.status}`);
  const d = await r.json();
  return d.choices[0].message.content;
}

async function callGroq(messages, system, key, env) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7,
    }),
  });
  if (r.status === 429) throw new Error('Groq rate limited');
  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const d = await r.json();
  return d.choices[0].message.content;
}

async function callGemini(messages, system, key, env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  );
  if (r.status === 429) throw new Error('Gemini rate limited');
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates[0].content.parts.map(p => p.text).join('');
}

async function callOpenRouter(messages, system, key, env) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://copelandos.pages.dev', 'X-Title': 'CopelandOS',
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || 'qwen/qwen3-coder:free',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7,
    }),
  });
  if (r.status === 429) throw new Error('OpenRouter rate limited');
  if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
  const d = await r.json();
  return d.choices[0].message.content;
}

// ═══════════════════════════════════════
// WEB SEARCH — Serper (Google results)
// ═══════════════════════════════════════
async function handleSearch({ query, num = 6 }, env) {
  if (!env.SERPER_KEY) throw new Error('SERPER_KEY not set. Add it in Cloudflare Pages → Settings → Environment Variables. Free at serper.dev');

  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': env.SERPER_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num }),
  });
  if (!r.ok) throw new Error(`Serper ${r.status}`);
  const d = await r.json();

  return {
    query,
    results: (d.organic || []).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      date: item.date || null,
    })),
    answerBox: d.answerBox || null,
    knowledgeGraph: d.knowledgeGraph || null,
  };
}

// ═══════════════════════════════════════
// GMAIL
// ═══════════════════════════════════════
async function getToken(env) {
  if (!env.GMAIL_REFRESH_TOKEN) throw new Error('Gmail not connected. Visit /api/auth/gmail to connect.');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Gmail token refresh failed: ' + JSON.stringify(d));
  return d.access_token;
}

async function handleMailList({ maxResults = 15, query = '' }, env) {
  const token = await getToken(env);
  const params = new URLSearchParams({ maxResults, q: query || 'in:inbox' });
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Gmail list ${r.status}`);
  const d = await r.json();

  const messages = await Promise.all(
    (d.messages || []).slice(0, maxResults).map(async msg => {
      const mr = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const md = await mr.json();
      const h = Object.fromEntries((md.payload?.headers || []).map(h => [h.name, h.value]));
      return { id: msg.id, subject: h.Subject || '(no subject)', from: h.From || '', date: h.Date || '', snippet: md.snippet || '' };
    })
  );
  return { messages };
}

async function handleMailRead({ id }, env) {
  if (!id) throw new Error('id required');
  const token = await getToken(env);
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Gmail read ${r.status}`);
  const d = await r.json();

  function extractBody(payload) {
    if (!payload) return '';
    if (payload.body?.data) return decodeBase64(payload.body.data);
    if (payload.parts) {
      for (const p of payload.parts) {
        if (p.mimeType === 'text/plain' && p.body?.data) return decodeBase64(p.body.data);
      }
      for (const p of payload.parts) { const t = extractBody(p); if (t) return t; }
    }
    return '';
  }

  const h = Object.fromEntries((d.payload?.headers || []).map(h => [h.name, h.value]));
  return { id: d.id, subject: h.Subject, from: h.From, date: h.Date, body: extractBody(d.payload) };
}

async function handleMailSend({ to, subject, body, threadId }, env) {
  if (!to || !subject || !body) throw new Error('to, subject, body required');
  const token = await getToken(env);

  const raw = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', '', body].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_');

  const message = { raw: encoded };
  if (threadId) message.threadId = threadId;

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!r.ok) throw new Error(`Gmail draft ${r.status}`);
  const d = await r.json();
  return { success: true, draft: true, id: d.id };
}

function gmailAuthRedirect(request, env) {
  const base = new URL(request.url).origin;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GMAIL_CLIENT_ID);
  url.searchParams.set('redirect_uri', base + '/api/auth/callback');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return Response.redirect(url.toString(), 302);
}

async function gmailAuthCallback(request, env, CORS) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  const base = new URL(request.url).origin;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: base + '/api/auth/callback',
      grant_type: 'authorization_code',
    }),
  });
  const d = await r.json();

  const html = d.refresh_token
    ? `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gmail Connected</title>
        <style>body{background:#0a0a0c;color:#eee;font-family:monospace;padding:40px;max-width:600px}
        h2{color:#2ec97a}pre{background:#1a1a1d;padding:16px;border-radius:8px;word-break:break-all;color:#4aaef5;font-size:13px;overflow-wrap:anywhere}
        ol{line-height:2;color:#aaa}strong{color:#eee}</style></head><body>
        <h2>✓ Gmail connected!</h2>
        <p>Copy this refresh token and add it to your Cloudflare Pages environment variables:</p>
        <p><strong>Variable name:</strong> GMAIL_REFRESH_TOKEN</p>
        <pre>${d.refresh_token}</pre>
        <ol>
          <li>Go to <strong>Cloudflare Dashboard</strong></li>
          <li>Workers &amp; Pages → your Pages project</li>
          <li>Settings → Environment Variables → Add variable</li>
          <li>Name: <code>GMAIL_REFRESH_TOKEN</code> — paste the token above</li>
          <li>Save → Redeploy (push any change to GitHub)</li>
          <li>Come back to CopelandOS — Gmail will work</li>
        </ol>
      </body></html>`
    : `<!DOCTYPE html><html><body style="background:#0a0a0c;color:#f55;font-family:monospace;padding:40px">
        OAuth failed: ${JSON.stringify(d)}
      </body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html', ...CORS } });
}

// ═══════════════════════════════════════
// OBSIDIAN via GitHub
// ═══════════════════════════════════════
async function handleObsidianSave({ title, folder = 'Inbox', content, agent = 'unknown', tags = [] }, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPO not set in environment variables.');
  }

  const now = new Date().toISOString().slice(0, 10);
  const safe = title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-').slice(0, 80);
  const root = env.VAULT_ROOT || 'Vault';
  const path = `${root}/${folder}/${safe}.md`;

  const fm = `---\ntags: [copelandos, ${agent}${tags.length ? ', ' + tags.join(', ') : ''}]\ndate: ${now}\nagent: ${agent}\nfolder: ${folder}\n---\n\n`;
  const fileContent = fm + `# ${title}\n\n` + content;
  const encoded = btoa(unescape(encodeURIComponent(fileContent)));

  // Check if file already exists (need SHA to update)
  let sha;
  const check = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' },
  });
  if (check.ok) sha = (await check.json()).sha;

  const body = {
    message: `CopelandOS [${agent}]: ${folder}/${safe}`,
    content: encoded,
    branch: env.VAULT_BRANCH || 'main',
  };
  if (sha) body.sha = sha;

  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'CopelandOS',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`GitHub write failed (${r.status}): ${err.slice(0, 200)}`);
  }

  return {
    success: true,
    path,
    githubUrl: `https://github.com/${env.GITHUB_REPO}/blob/main/${encodeURIComponent(path)}`,
  };
}

async function handleObsidianList(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return { files: [] };
  const root = env.VAULT_ROOT || 'Vault';

  const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${root}`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' },
  });
  if (!r.ok) return { files: [] };
  const items = await r.json();

  // Get files from all subfolders
  const folders = Array.isArray(items) ? items.filter(i => i.type === 'dir') : [];
  const allFiles = [];

  for (const folder of folders) {
    const fr = await fetch(folder.url, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' },
    });
    if (!fr.ok) continue;
    const files = await fr.json();
    (Array.isArray(files) ? files : [])
      .filter(f => f.name.endsWith('.md'))
      .forEach(f => allFiles.push({ name: f.name, path: f.path, url: f.html_url, folder: folder.name }));
  }

  return { files: allFiles };
}

// ═══════════════════════════════════════
// IDEA PIPELINE
// ═══════════════════════════════════════
async function handleIdea({ idea, context = '' }, env) {
  if (!idea) throw new Error('idea required');

  const sys = `You are Chief of Staff for Copeland, an engineering student who builds AI tools, plays music, and applies for internships/scholarships.

Expand this raw idea into an actionable Obsidian note. Use this EXACT format:

## Idea: [clear title for this idea]

**Summary:** [one sentence]

**Why this matters:** [2 sentences — why Copeland should do this now]

**Next actions:**
- [ ] [specific action — doable today or this week]
- [ ] [specific action]
- [ ] [specific action]

**Resources:** [what's needed to execute]

**Category:** [one of: Internship | Scholarship | Coding Project | Music | School | AI System | Other]

**Priority:** [High / Medium / Low] — [one sentence reason]

Be specific. No filler. Every action must be concrete.`;

  let expanded = `## Idea: ${idea}\n\n${context}`;

  // Try to expand with AI
  try {
    const result = await handleAI({ messages: [{ role: 'user', content: idea + (context ? '\n\nContext: ' + context : '') }], system: sys }, env);
    expanded = result.text;
  } catch (e) {
    expanded = `## Idea: ${idea}\n\n${context}\n\n_(AI expansion failed: ${e.message})_`;
  }

  // Detect category → folder
  const catMatch = expanded.match(/\*\*Category:\*\*\s*([^\n]+)/i);
  const cat = (catMatch?.[1] || '').toLowerCase();
  const folderMap = { internship: 'Internships', scholarship: 'Scholarships', coding: 'Projects', music: 'Music', school: 'School', 'ai system': 'Projects', other: 'Ideas' };
  const folder = Object.entries(folderMap).find(([k]) => cat.includes(k))?.[1] || 'Ideas';

  const titleMatch = expanded.match(/## Idea: (.+)/);
  const title = titleMatch?.[1]?.trim() || idea.slice(0, 60);

  // Auto-save to Obsidian if GitHub is configured
  let saved = false, path = null, githubUrl = null;
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    try {
      const saved_result = await handleObsidianSave({ title, folder, content: expanded, agent: 'chief', tags: ['idea', 'auto-captured'] }, env);
      saved = true; path = saved_result.path; githubUrl = saved_result.githubUrl;
    } catch (e) { console.warn('Vault save failed:', e.message); }
  }

  return { idea, title, expanded, folder, saved, path, githubUrl };
}

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
function decodeBase64(data) {
  try {
    return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  }
}
