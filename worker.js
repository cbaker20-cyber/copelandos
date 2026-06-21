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
          caps: {
            ai: !!(env.CEREBRAS_KEY || env.GROQ_KEY || env.GEMINI_KEY),
            search: !!env.SERPER_KEY,
            gmail: !!env.GMAIL_REFRESH_TOKEN,
            obsidian: !!(env.GITHUB_TOKEN && env.GITHUB_REPO),
            ai_providers: ['cerebras','groq','gemini','openrouter']
              .filter(p => env[p.toUpperCase()+'_KEY']),
          }
        });
      }

      let body = {};
      if (request.method === 'POST') {
        body = await request.json().catch(() => ({}));
      }

      // ── /api/ai ───────────────────────────────────────────
      if (path === '/api/ai') {
        const { messages, system } = body;
        const providers = [
          { name: 'cerebras',   key: env.CEREBRAS_KEY,   fn: callCerebras },
          { name: 'groq',       key: env.GROQ_KEY,       fn: callGroq },
          { name: 'gemini',     key: env.GEMINI_KEY,     fn: callGemini },
          { name: 'openrouter', key: env.OPENROUTER_KEY, fn: callOpenRouter },
        ].filter(p => p.key);

        if (!providers.length) return json({ error: 'No AI keys set. Add CEREBRAS_KEY or GROQ_KEY in Cloudflare → Settings → Variables.' }, 503);

        let lastErr;
        for (const p of providers) {
          try {
            const text = await p.fn(messages, system, p.key, env);
            return json({ text, provider: p.name });
          } catch(e) { lastErr = e; }
        }
        return json({ error: 'All providers failed: ' + lastErr?.message }, 503);
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
        if (!body.to || !body.subject || !body.body) return json({ error: 'to, subject, body required' }, 400);
        const token = await getGmailToken(env);
        const raw = [`To: ${body.to}`, `Subject: ${body.subject}`, 'Content-Type: text/plain; charset=utf-8', '', body.body].join('\r\n');
        const encoded = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_');
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: { raw: encoded } }),
        });
        if (!r.ok) return json({ error: 'Gmail draft failed: ' + r.status }, 502);
        const draft = await r.json();
        return json({ success: true, draft: true, id: draft.id });
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
async function callCerebras(messages, system, key, env) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env?.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error('Cerebras rate limited');
  if (!r.ok) throw new Error('Cerebras ' + r.status);
  return (await r.json()).choices[0].message.content;
}

async function callGroq(messages, system, key, env) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env?.GROQ_MODEL || 'llama-4-scout-17b-16e-instruct', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
  });
  if (r.status === 429) throw new Error('Groq rate limited');
  if (!r.ok) throw new Error('Groq ' + r.status);
  return (await r.json()).choices[0].message.content;
}

async function callGemini(messages, system, key, env) {
  const model = env?.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: messages.map(m => ({ role: m.role==='assistant'?'model':'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 2048, temperature: 0.7 } }),
  });
  if (r.status === 429) throw new Error('Gemini rate limited');
  if (!r.ok) throw new Error('Gemini ' + r.status);
  return (await r.json()).candidates[0].content.parts.map(p => p.text).join('');
}

async function callOpenRouter(messages, system, key, env) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://copelandos.pages.dev', 'X-Title': 'CopelandOS' },
    body: JSON.stringify({ model: env?.OPENROUTER_MODEL || 'qwen/qwen3-coder:free', messages: [{ role:'system', content:system }, ...messages], max_tokens: 2048, temperature: 0.7 }),
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
