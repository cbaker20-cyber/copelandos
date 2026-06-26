export function renderCommandCenterHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#05070d">
  <title>CopelandOS Live Console</title>
  <style>
    :root{color-scheme:dark;--bg:#05070d;--panel:#0b1321;--line:#1e3a52;--hot:#6fdfff;--ok:#6ef0ad;--warn:#ffc96f;--bad:#ff7885;--text:#ecf8ff;--muted:#90a8ba;--dim:#536a7d;--violet:#9b8cff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(111,223,255,.22),transparent 32rem),radial-gradient(circle at 90% 20%,rgba(155,140,255,.18),transparent 28rem),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}main{width:min(1180px,calc(100% - 28px));margin:auto;padding:24px 0 84px}.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;align-items:stretch}.panel{border:1px solid rgba(111,223,255,.18);border-radius:22px;background:linear-gradient(145deg,rgba(12,22,36,.92),rgba(6,12,22,.86));box-shadow:0 24px 80px rgba(0,0,0,.36);overflow:hidden}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:start;padding:18px 18px 0}.title{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.sub{color:var(--muted);font-size:12px;margin-top:4px;line-height:1.45}.badge{border:1px solid rgba(111,223,255,.28);border-radius:999px;padding:5px 8px;color:var(--muted);font:10px ui-monospace,monospace;text-transform:uppercase;white-space:nowrap}.badge.ok{color:var(--ok);border-color:rgba(110,240,173,.35)}.badge.warn{color:var(--warn);border-color:rgba(255,201,111,.35)}.badge.bad{color:var(--bad);border-color:rgba(255,120,133,.35)}.orb-wrap{min-height:315px;display:grid;place-items:center;position:relative}.orb{width:min(260px,58vw);aspect-ratio:1;border-radius:50%;position:relative;background:radial-gradient(circle,rgba(111,223,255,.32),rgba(79,140,255,.12) 42%,transparent 68%);filter:drop-shadow(0 0 44px rgba(111,223,255,.28))}.orb:before,.orb:after{content:"";position:absolute;border-radius:50%;border:1px dashed rgba(111,223,255,.38);inset:0;animation:spin 18s linear infinite}.orb:after{inset:18%;border-color:rgba(155,140,255,.45);animation-direction:reverse;animation-duration:11s}.core{position:absolute;inset:38%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,var(--hot) 18%,#258fff 60%,#102b55);box-shadow:0 0 28px var(--hot)}@keyframes spin{to{transform:rotate(360deg)}}h1{font-size:clamp(32px,7vw,72px);line-height:.92;letter-spacing:-.07em;margin:0}.copy{padding:22px}.copy p{color:var(--muted);line-height:1.65;max-width:62ch}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}.full{grid-column:1/-1}.form{padding:16px 18px 18px;display:grid;gap:10px}label{font-size:11px;color:var(--muted);display:grid;gap:6px}input,textarea,select{width:100%;border:1px solid rgba(111,223,255,.2);border-radius:12px;background:rgba(3,8,15,.72);color:var(--text);padding:10px 11px;font:14px inherit}textarea{min-height:110px;resize:vertical}button{border:1px solid rgba(111,223,255,.28);border-radius:12px;background:rgba(111,223,255,.08);color:var(--text);padding:10px 12px;cursor:pointer;font-weight:750}button.primary{background:linear-gradient(135deg,var(--hot),#88f2d0);color:#041019;border-color:transparent}button:hover{filter:brightness(1.08)}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.log{margin-top:14px;min-height:190px;max-height:380px;overflow:auto;border:1px solid rgba(111,223,255,.14);border-radius:18px;background:rgba(2,6,12,.72);padding:12px;font:12px ui-monospace,monospace;white-space:pre-wrap}.pillbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.pill{border:1px solid rgba(111,223,255,.17);border-radius:999px;padding:7px 9px;color:var(--muted);font:11px ui-monospace,monospace}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.shortcut-code{font:12px ui-monospace,monospace;word-break:break-all;color:#cdefff;background:rgba(3,8,15,.78);border:1px solid rgba(111,223,255,.14);padding:10px;border-radius:12px}.small{font-size:12px;color:var(--muted);line-height:1.5}@media(max-width:900px){.hero,.grid,.row{grid-template-columns:1fr}main{width:min(100% - 18px,1180px);padding-top:12px}.orb-wrap{min-height:220px}.grid{gap:10px}.panel{border-radius:18px}}
  </style>
</head>
<body>
<main>
  <section class="hero">
    <article class="panel">
      <div class="copy">
        <div class="badge ok">live console</div>
        <h1>CopelandOS<br>works here.</h1>
        <p>This Worker page is the fallback command center. It can capture ideas, create Gmail drafts, save Obsidian/GitHub-vault notes, test the provider/router status, and show the exact iPhone Shortcut payload. No sends, merges, deploys, deletes, or shell actions happen from here.</p>
        <div class="pillbar" id="signal-pills"><span class="pill">loading status…</span></div>
      </div>
    </article>
    <article class="panel"><div class="orb-wrap"><div class="orb"><span class="core"></span></div></div></article>
  </section>

  <section class="grid">
    <article class="panel">
      <div class="panel-head"><div><div class="title">Idea capture</div><div class="sub">Works from dashboard or iPhone Shortcuts.</div></div><span class="badge ok">safe</span></div>
      <form class="form" id="idea-form">
        <label>Idea<textarea id="idea-text" placeholder="Tell CopelandOS what to remember or plan…"></textarea></label>
        <div class="row"><label>Source<select id="idea-source"><option>dashboard</option><option>ios-shortcuts</option><option>siri</option><option>mobile-web</option></select></label><label>Urgency<select id="idea-urgency"><option>medium</option><option>low</option><option>high</option></select></label></div>
        <button class="primary" type="submit">Capture idea</button>
      </form>
    </article>

    <article class="panel">
      <div class="panel-head"><div><div class="title">Gmail draft</div><div class="sub">Creates a reviewable draft only. Never sends.</div></div><span class="badge warn">draft</span></div>
      <form class="form" id="mail-form">
        <label>To<input id="mail-to" autocomplete="email" placeholder="person@example.com"></label>
        <label>Subject<input id="mail-subject" placeholder="Draft subject"></label>
        <label>Body<textarea id="mail-body" placeholder="Write the draft here…"></textarea></label>
        <button class="primary" type="submit">Create Gmail draft</button>
      </form>
    </article>

    <article class="panel">
      <div class="panel-head"><div><div class="title">Obsidian note</div><div class="sub">GitHub vault write if configured; otherwise safe preview.</div></div><span class="badge ok">memory</span></div>
      <form class="form" id="note-form">
        <label>Title<input id="note-title" placeholder="Note title"></label>
        <div class="row"><label>Folder<select id="note-folder"><option>Inbox</option><option>Projects</option><option>School</option><option>BandCouncil</option><option>Music</option><option>Research</option><option>Decisions</option><option>Ideas</option></select></label><label>Agent<input id="note-agent" value="copelandos"></label></div>
        <label>Content<textarea id="note-content" placeholder="Markdown note content…"></textarea></label>
        <button class="primary" type="submit">Save / preview note</button>
      </form>
    </article>

    <article class="panel full">
      <div class="panel-head"><div><div class="title">iPhone Shortcut setup</div><div class="sub">Create a Shortcut with “Get Contents of URL” using this endpoint and JSON body.</div></div><button id="copy-shortcut" type="button">Copy payload</button></div>
      <div class="form">
        <div class="shortcut-code" id="shortcut-url"></div>
        <div class="shortcut-code" id="shortcut-body"></div>
        <div class="small">Shortcuts action: URL = endpoint above → Get Contents of URL → Method POST → Request Body JSON. Map the shared text or dictated text into the <code>text</code> field. If you later set <code>CAPTURE_TOKEN</code>, add an Authorization header: <code>Bearer YOUR_TOKEN</code>.</div>
      </div>
    </article>

    <article class="panel full">
      <div class="panel-head"><div><div class="title">Command log</div><div class="sub">Everything returns here so you can see what worked.</div></div><button id="refresh-status" type="button">Refresh status</button></div>
      <div class="form"><div class="log" id="log">CopelandOS console loaded.\n</div></div>
    </article>
  </section>
</main>
<script>
const $ = id => document.getElementById(id);
const log = (label, data) => { const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2); $('log').textContent += `\n[${label}] ${text}\n`; $('log').scrollTop = $('log').scrollHeight; };
async function api(path, options = {}) { const r = await fetch(path, options); const text = await r.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Non-JSON response (${r.status})`); } if (!r.ok) { const e = new Error(data.error || data.message || `HTTP ${r.status}`); e.data = data; throw e; } return data; }
async function loadStatus(){ try { const status = await api('/api/status'); const modules = status.modules || {}; $('signal-pills').innerHTML = [ ['Worker','ok',true], ['Gmail','warn',modules.gmail?.connected], ['Vault','ok',modules.vault?.connected], ['Providers','warn',modules.modelRouter?.connected], ['Local','warn',modules.localAgent?.connected] ].map(([name, cls, on]) => `<span class="pill ${on ? cls : ''}">${name}: ${on ? 'connected' : 'not connected'}</span>`).join(''); log('status', status.modules); } catch(e){ log('status-error', e.message); } }
$('idea-form').addEventListener('submit', async e => { e.preventDefault(); try { const data = await api('/api/capture/idea', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text:$('idea-text').value, source:$('idea-source').value, urgency:$('idea-urgency').value, tags:['console'] }) }); $('idea-text').value=''; log('idea captured', data); } catch(err){ log('idea error', err.data || err.message); } });
$('mail-form').addEventListener('submit', async e => { e.preventDefault(); try { const data = await api('/api/email/draft', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ to:$('mail-to').value, subject:$('mail-subject').value, body:$('mail-body').value, confirmed:true }) }); log('gmail draft', data); } catch(err){ log('gmail error', err.data || err.message); } });
$('note-form').addEventListener('submit', async e => { e.preventDefault(); try { const data = await api('/api/obsidian/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title:$('note-title').value, folder:$('note-folder').value, content:$('note-content').value, agent:$('note-agent').value, tags:['console'] }) }); log('vault note', data); } catch(err){ log('vault error', err.data || err.message); } });
function renderShortcut(){ const body = { text:'Shortcut Input or Dictated Text', source:'ios-shortcuts', urgency:'medium', tags:['ios','shortcut'] }; $('shortcut-url').textContent = `${location.origin}/api/capture/idea`; $('shortcut-body').textContent = JSON.stringify(body, null, 2); }
$('copy-shortcut').addEventListener('click', async () => { const payload = `${$('shortcut-url').textContent}\n\n${$('shortcut-body').textContent}`; await navigator.clipboard?.writeText(payload); log('shortcut', 'Copied endpoint and JSON payload.'); });
$('refresh-status').addEventListener('click', loadStatus);
renderShortcut(); loadStatus();
</script>
</body>
</html>`;
}
