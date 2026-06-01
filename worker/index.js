/**
 * CopelandOS — Cloudflare Worker Backend
 * Handles: AI proxy, web search, Gmail, GitHub (Obsidian sync)
 * Deploy: wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS headers (allow your Cloudflare Pages domain) ──
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    try {
      const path = url.pathname;

      // ── Route: AI proxy ──────────────────────────────────
      if (path === '/api/ai') return await handleAI(request, env, respond);

      // ── Route: Web search ────────────────────────────────
      if (path === '/api/search') return await handleSearch(request, env, respond);

      // ── Route: Gmail — list ──────────────────────────────
      if (path === '/api/mail/list') return await handleMailList(request, env, respond);

      // ── Route: Gmail — read ──────────────────────────────
      if (path === '/api/mail/read') return await handleMailRead(request, env, respond);

      // ── Route: Gmail — send ──────────────────────────────
      if (path === '/api/mail/send') return await handleMailSend(request, env, respond);

      // ── Route: Obsidian/GitHub — save note ───────────────
      if (path === '/api/obsidian/save') return await handleObsidianSave(request, env, respond);

      // ── Route: Obsidian/GitHub — list notes ──────────────
      if (path === '/api/obsidian/list') return await handleObsidianList(request, env, respond);

      // ── Route: Idea pipeline — capture + auto-process ────
      if (path === '/api/idea') return await handleIdea(request, env, respond);

      // ── Route: OAuth callback (Gmail) ────────────────────
      if (path === '/auth/callback') return await handleOAuthCallback(request, env, respond, cors);

      // ── Route: health check ──────────────────────────────
      if (path === '/api/health') {
        return respond({
          status: 'ok',
          version: '4.0',
          capabilities: {
            search: !!(env.SERPER_KEY || env.GOOGLE_CSE_KEY),
            gmail: !!(env.GMAIL_CLIENT_ID),
            obsidian: !!(env.GITHUB_TOKEN),
            ai_providers: ['cerebras', 'groq', 'gemini', 'openrouter'].filter(p => env[p.toUpperCase() + '_KEY']),
          }
        });
      }

      return respond({ error: 'Not found' }, 404);
    } catch (e) {
      console.error('Worker error:', e);
      return respond({ error: e.message }, 500);
    }
  }
};

// ═══════════════════════════════════════════════════════
// AI PROXY
// Routes requests to best available provider
// ═══════════════════════════════════════════════════════
async function handleAI(request, env, respond) {
  const { messages, system, provider: preferredProvider } = await request.json();

  const providers = [
    { name: 'cerebras',    key: env.CEREBRAS_KEY,    fn: callCerebras },
    { name: 'groq',        key: env.GROQ_KEY,        fn: callGroq },
    { name: 'gemini',      key: env.GEMINI_KEY,      fn: callGemini },
    { name: 'openrouter',  key: env.OPENROUTER_KEY,  fn: callOpenRouter },
  ].filter(p => p.key);

  if (!providers.length) return respond({ error: 'No AI provider keys configured in Worker env' }, 503);

  // Honor preference if specified
  const ordered = preferredProvider
    ? [...providers.filter(p => p.name === preferredProvider), ...providers.filter(p => p.name !== preferredProvider)]
    : providers;

  let lastError;
  for (const p of ordered) {
    try {
      const text = await p.fn(messages, system, p.key, env);
      return respond({ text, provider: p.name });
    } catch (e) {
      console.warn(`AI provider ${p.name} failed:`, e.message);
      lastError = e;
    }
  }
  return respond({ error: `All AI providers failed: ${lastError?.message}` }, 503);
}

async function callCerebras(messages, system, key, env) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7
    })
  });
  if (!r.ok) throw new Error(`Cerebras ${r.status}: ${await r.text().then(t => t.slice(0, 100))}`);
  const d = await r.json();
  return d.choices[0].message.content;
}

async function callGroq(messages, system, key, env) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.GROQ_MODEL || 'llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7
    })
  });
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
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
      })
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const d = await r.json();
  return d.candidates[0].content.parts.map(p => p.text).join('');
}

async function callOpenRouter(messages, system, key, env) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      'HTTP-Referer': 'https://copelandos.pages.dev', 'X-Title': 'CopelandOS'
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || 'qwen/qwen3-coder:free',
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 2048, temperature: 0.7
    })
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
  const d = await r.json();
  return d.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════
// WEB SEARCH
// Uses Serper (2,500 free/mo) then falls back to Google CSE (100/day free)
// ═══════════════════════════════════════════════════════
async function handleSearch(request, env, respond) {
  const { query, type = 'search', num = 8 } = await request.json();
  if (!query) return respond({ error: 'query required' }, 400);

  // Try Serper first
  if (env.SERPER_KEY) {
    try {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': env.SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num })
      });
      if (r.ok) {
        const d = await r.json();
        const results = (d.organic || []).map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          date: item.date
        }));
        return respond({ results, source: 'serper', query });
      }
    } catch (e) { console.warn('Serper failed:', e.message); }
  }

  // Fallback: Google Custom Search Engine (100/day free)
  if (env.GOOGLE_CSE_KEY && env.GOOGLE_CSE_ID) {
    try {
      const params = new URLSearchParams({
        key: env.GOOGLE_CSE_KEY, cx: env.GOOGLE_CSE_ID,
        q: query, num: Math.min(num, 10)
      });
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      if (r.ok) {
        const d = await r.json();
        const results = (d.items || []).map(item => ({
          title: item.title, url: item.link,
          snippet: item.snippet
        }));
        return respond({ results, source: 'google_cse', query });
      }
    } catch (e) { console.warn('Google CSE failed:', e.message); }
  }

  return respond({ error: 'No search provider configured. Add SERPER_KEY or GOOGLE_CSE_KEY+GOOGLE_CSE_ID to Worker env.' }, 503);
}

// ═══════════════════════════════════════════════════════
// GMAIL — OAuth 2.0 flow
// ═══════════════════════════════════════════════════════

// Helper: get fresh Gmail access token via refresh token
async function getGmailToken(env) {
  const refresh = env.GMAIL_REFRESH_TOKEN;
  if (!refresh) throw new Error('GMAIL_REFRESH_TOKEN not set. Complete OAuth setup first.');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token'
    })
  });
  if (!r.ok) throw new Error(`Gmail token refresh failed: ${r.status}`);
  const d = await r.json();
  return d.access_token;
}

async function handleMailList(request, env, respond) {
  const { maxResults = 10, query = '' } = await request.json().catch(() => ({}));
  const token = await getGmailToken(env);

  const params = new URLSearchParams({ maxResults, q: query || 'is:unread' });
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`Gmail list: ${r.status}`);
  const d = await r.json();

  // Fetch subject/sender for each message
  const messages = await Promise.all(
    (d.messages || []).slice(0, maxResults).map(async msg => {
      const mr = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const md = await mr.json();
      const headers = Object.fromEntries((md.payload?.headers || []).map(h => [h.name, h.value]));
      return { id: msg.id, subject: headers.Subject, from: headers.From, date: headers.Date, snippet: md.snippet };
    })
  );

  return respond({ messages });
}

async function handleMailRead(request, env, respond) {
  const { id } = await request.json();
  if (!id) return respond({ error: 'message id required' }, 400);
  const token = await getGmailToken(env);

  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) throw new Error(`Gmail read: ${r.status}`);
  const d = await r.json();

  // Extract plain text body
  function extractBody(payload) {
    if (!payload) return '';
    if (payload.body?.data) return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }
      for (const part of payload.parts) {
        const found = extractBody(part);
        if (found) return found;
      }
    }
    return '';
  }

  const headers = Object.fromEntries((d.payload?.headers || []).map(h => [h.name, h.value]));
  return respond({
    id: d.id, subject: headers.Subject, from: headers.From,
    date: headers.Date, body: extractBody(d.payload)
  });
}

async function handleMailSend(request, env, respond) {
  const { to, subject, body, replyToId } = await request.json();
  if (!to || !subject || !body) return respond({ error: 'to, subject, body required' }, 400);
  const token = await getGmailToken(env);

  const email = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, '', body].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(email))).replace(/\+/g, '-').replace(/\//g, '_');

  const payload = { raw: encoded };
  if (replyToId) payload.threadId = replyToId;

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Gmail send: ${r.status} - ${await r.text()}`);
  const d = await r.json();
  return respond({ success: true, messageId: d.id });
}

async function handleOAuthCallback(request, env, respond, cors) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET,
      redirect_uri: `https://${new URL(request.url).hostname}/auth/callback`,
      grant_type: 'authorization_code'
    })
  });
  const d = await r.json();
  if (d.refresh_token) {
    // Show the refresh token — user needs to save this in Worker env as GMAIL_REFRESH_TOKEN
    return new Response(
      `<html><body style="font-family:monospace;background:#111;color:#eee;padding:40px">
        <h2 style="color:#2ec97a">✓ Gmail connected!</h2>
        <p>Copy this refresh token and add it to your Worker environment as <strong>GMAIL_REFRESH_TOKEN</strong>:</p>
        <p style="background:#222;padding:16px;border-radius:8px;word-break:break-all;color:#4aaef5">${d.refresh_token}</p>
        <p style="color:#666">Go to: Cloudflare Dashboard → Workers → copelandos-worker → Settings → Variables</p>
        <p style="color:#666">Then reload CopelandOS. Gmail will now work.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html', ...cors } }
    );
  }
  return new Response(`<html><body style="font-family:monospace;background:#111;color:#f55;padding:40px">OAuth failed: ${JSON.stringify(d)}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } });
}

// ═══════════════════════════════════════════════════════
// OBSIDIAN VIA GITHUB
// Writes .md files directly to your GitHub-synced vault repo
// ═══════════════════════════════════════════════════════
async function handleObsidianSave(request, env, respond) {
  const { title, folder = 'Inbox', content, agent, tags = [] } = await request.json();
  if (!title || !content) return respond({ error: 'title and content required' }, 400);
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return respond({ error: 'GITHUB_TOKEN and GITHUB_REPO not set. Add them to Worker env.' }, 503);
  }

  const now = new Date().toISOString().slice(0, 10);
  const safeName = title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '-');
  const filePath = `${env.VAULT_ROOT || 'Vault'}/${folder}/${safeName}.md`;

  const frontmatter = `---\ntags: [copelandos${agent ? ', ' + agent : ''}, ${folder.toLowerCase()}${tags.length ? ', ' + tags.join(', ') : ''}]\ndate: ${now}\nagent: ${agent || 'unknown'}\ncreated: ${new Date().toISOString()}\n---\n\n`;
  const fileContent = frontmatter + `# ${title}\n\n` + content;
  const encoded = btoa(unescape(encodeURIComponent(fileContent)));

  // Check if file exists (to get SHA for update)
  let sha;
  const checkR = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`,
    { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' } }
  );
  if (checkR.ok) { const checkD = await checkR.json(); sha = checkD.sha; }

  const body = {
    message: `CopelandOS: ${agent || 'agent'} → ${folder}/${safeName}`,
    content: encoded,
    branch: env.VAULT_BRANCH || 'main'
  };
  if (sha) body.sha = sha;

  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CopelandOS'
      },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) {
    const err = await r.text();
    return respond({ error: `GitHub write failed: ${r.status} - ${err.slice(0, 200)}` }, 500);
  }
  return respond({ success: true, path: filePath, url: `https://github.com/${env.GITHUB_REPO}/blob/main/${filePath}` });
}

async function handleObsidianList(request, env, respond) {
  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') || '';
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return respond({ files: [] });

  const path = `${env.VAULT_ROOT || 'Vault'}${folder ? '/' + folder : ''}`;
  const r = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
    { headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' } }
  );
  if (!r.ok) return respond({ files: [] });
  const d = await r.json();
  const files = Array.isArray(d) ? d.filter(f => f.name.endsWith('.md')).map(f => ({
    name: f.name, path: f.path, url: f.html_url, size: f.size
  })) : [];
  return respond({ files });
}

// ═══════════════════════════════════════════════════════
// IDEA PIPELINE
// Capture an idea → AI expands it → saves to Obsidian automatically
// ═══════════════════════════════════════════════════════
async function handleIdea(request, env, respond) {
  const { idea, context = '' } = await request.json();
  if (!idea) return respond({ error: 'idea required' }, 400);

  // Step 1: AI expands the idea
  const systemPrompt = `You are Chief of Staff for Copeland, an engineering student who builds AI tools, plays music, and applies for internships/scholarships.

When given a raw idea, you expand it into an actionable note with this exact structure:

## Idea: [title]

**One-line summary:** [what it is]

**Why it matters:** [why Copeland should pursue this, 2 sentences]

**Immediate next actions:**
- [ ] [specific action 1 - can do today]
- [ ] [specific action 2]
- [ ] [specific action 3]

**Resources needed:** [list what's needed]

**Category:** [Internship | Scholarship | Coding Project | Music | School | System Building | Other]

**Priority:** [High / Medium / Low] — [one sentence reason]

Be specific and actionable. No fluff.`;

  let expandedText = `# ${idea}\n\n${context}`;
  const providers = [
    { key: env.CEREBRAS_KEY, fn: callCerebras },
    { key: env.GROQ_KEY, fn: callGroq },
    { key: env.GEMINI_KEY, fn: callGemini },
  ].filter(p => p.key);

  for (const p of providers) {
    try {
      expandedText = await p.fn([{ role: 'user', content: idea + (context ? '\n\nContext: ' + context : '') }], systemPrompt, p.key, env);
      break;
    } catch (e) { console.warn('Idea expansion failed:', e.message); }
  }

  // Extract category for folder routing
  const categoryMatch = expandedText.match(/\*\*Category:\*\*\s*([^\n]+)/);
  const categoryRaw = categoryMatch?.[1]?.trim() || 'Ideas';
  const folderMap = {
    'internship': 'Internships', 'scholarship': 'Scholarships',
    'coding': 'Projects', 'music': 'Music', 'school': 'School',
    'system': 'Projects', 'other': 'Ideas'
  };
  const folder = Object.entries(folderMap).find(([k]) => categoryRaw.toLowerCase().includes(k))?.[1] || 'Ideas';

  // Extract title
  const titleMatch = expandedText.match(/## Idea: (.+)/) || expandedText.match(/# (.+)/);
  const title = titleMatch?.[1]?.trim() || idea.slice(0, 60);

  // Step 2: Save to GitHub/Obsidian
  let saved = false, savedPath = null;
  if (env.GITHUB_TOKEN && env.GITHUB_REPO) {
    try {
      const saveResp = await handleObsidianSave(
        new Request('https://worker/api/obsidian/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, folder, content: expandedText, agent: 'chief', tags: ['idea', 'auto'] })
        }),
        env,
        (data) => ({ json: () => data })
      );
      saved = true;
      savedPath = `${folder}/${title}`;
    } catch (e) { console.warn('Obsidian save failed:', e.message); }
  }

  return respond({ idea, expanded: expandedText, folder, title, saved, savedPath });
}
