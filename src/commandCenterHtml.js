export function renderCommandCenterHtml() {
  return `<!doctype html>
<html lang="en" data-theme="lunar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#dfe4dc">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="CopelandOS">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>CopelandOS</title>
  <style>
    :root{
      color-scheme:dark;
      --bg0:#111513;--bg1:#252c29;--bg2:#778078;
      --text:#f2f4ec;--muted:#bdc5ba;--dim:#8e998f;
      --glass:rgba(246,248,238,.14);--glass2:rgba(246,248,238,.08);--line:rgba(255,255,255,.22);
      --accent:#dce8a7;--accent2:#b8d7ff;--good:#a7e8bd;--warn:#ecd99b;--bad:#f0a8a8;
      --shadow:0 28px 85px rgba(0,0,0,.30);--blur:blur(26px) saturate(1.24);
      --radius-xl:34px;--radius-lg:26px;--radius-md:18px;
    }
    html[data-theme="solar"]{color-scheme:light;--bg0:#d8ded7;--bg1:#eef1ea;--bg2:#f8faf4;--text:#19201e;--muted:#52605a;--dim:#758078;--glass:rgba(255,255,255,.56);--glass2:rgba(255,255,255,.36);--line:rgba(120,130,120,.24);--shadow:0 30px 80px rgba(65,75,65,.16)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;overflow-x:hidden;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:radial-gradient(circle at 12% -8%,rgba(220,232,167,.22),transparent 34rem),radial-gradient(circle at 96% 12%,rgba(184,215,255,.18),transparent 32rem),radial-gradient(circle at 50% 105%,rgba(255,255,255,.10),transparent 38rem),linear-gradient(135deg,var(--bg0),var(--bg1) 48%,var(--bg2));background-attachment:fixed}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 46%,rgba(255,255,255,.08) 47%,transparent 49%),radial-gradient(circle at 20% 32%,rgba(255,255,255,.10) 0 1px,transparent 2px),radial-gradient(circle at 72% 64%,rgba(220,232,167,.11) 0 1px,transparent 2px);background-size:220px 220px,92px 92px,124px 124px;opacity:.55;mask-image:linear-gradient(to bottom,black 0%,black 72%,transparent 100%)}
    .shell{position:relative;z-index:1;width:min(1180px,calc(100% - 18px));margin:0 auto;padding:calc(12px + env(safe-area-inset-top)) 0 calc(120px + env(safe-area-inset-bottom))}.topbar{position:sticky;top:calc(8px + env(safe-area-inset-top));z-index:20;border:1px solid var(--line);border-radius:30px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow);padding:12px;margin-bottom:16px}.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}.brand-left{display:flex;align-items:center;gap:12px;min-width:0}.mark{width:42px;aspect-ratio:1;border-radius:42% 58% 48% 52%;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.95),rgba(220,232,167,.35) 28%,transparent 54%),conic-gradient(from 160deg,rgba(220,232,167,.38),rgba(184,215,255,.28),rgba(255,255,255,.18),rgba(220,232,167,.38));border:1px solid rgba(255,255,255,.34);box-shadow:0 15px 38px rgba(0,0,0,.18)}h1{margin:0;font-size:18px;letter-spacing:.08em}.subline{font:10px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.16em;color:var(--muted);white-space:nowrap}.nav{display:flex;gap:8px;overflow:auto;padding-top:12px;-webkit-overflow-scrolling:touch}.tab,.btn,button{appearance:none;border:1px solid var(--line);border-radius:999px;background:var(--glass2);color:var(--text);padding:10px 13px;font-weight:760;text-decoration:none;white-space:nowrap;cursor:pointer;touch-action:manipulation}.tab:focus,.tab:hover,.btn.primary,button.primary{border-color:rgba(220,232,167,.38);background:linear-gradient(135deg,rgba(220,232,167,.30),rgba(184,215,255,.22));box-shadow:0 16px 34px rgba(0,0,0,.16)}.section{scroll-margin-top:128px;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.wide{grid-column:1/-1}.panel{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:var(--radius-xl);background:linear-gradient(145deg,var(--glass),var(--glass2));backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow)}.panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,rgba(255,255,255,.38),transparent 26%),linear-gradient(90deg,transparent,rgba(220,232,167,.08),transparent);opacity:.55}.panel>*{position:relative;z-index:1}.hero{min-height:410px;padding:24px;display:grid;grid-template-columns:1fr .72fr;gap:18px;align-items:center}.hero h2{font-size:clamp(42px,7vw,82px);letter-spacing:-.075em;line-height:.91;margin:0 0 16px}.hero p,.muted{color:var(--muted);line-height:1.65}.orb-wrap{min-height:310px;display:grid;place-items:center;perspective:1000px}.orb{width:min(330px,68vw);aspect-ratio:1;border-radius:38% 62% 53% 47%;background:radial-gradient(circle at 42% 32%,rgba(255,255,255,.95),rgba(220,232,167,.33) 22%,transparent 43%),conic-gradient(from 145deg,rgba(220,232,167,.30),rgba(184,215,255,.28),rgba(255,255,255,.14),rgba(220,232,167,.30));filter:drop-shadow(0 42px 64px rgba(0,0,0,.22));transform:rotateX(58deg) rotateZ(-17deg)}.orb:before,.orb:after{content:"";position:absolute;inset:-5%;border-radius:inherit;border:1px solid rgba(255,255,255,.24)}.orb:after{inset:18%;border-color:rgba(220,232,167,.22)}.head{display:flex;align-items:start;justify-content:space-between;gap:10px;padding:18px 18px 0}.title{font:780 12px ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}.badge,.pill{border:1px solid var(--line);border-radius:999px;background:var(--glass2);color:var(--muted);padding:5px 8px;font:10px ui-monospace,monospace;text-transform:uppercase;white-space:nowrap}.ok{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}.form{padding:16px;display:grid;gap:11px}label{font-size:11px;color:var(--muted);display:grid;gap:6px}input,textarea,select{width:100%;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.12);color:var(--text);padding:13px 14px;font:16px inherit;backdrop-filter:blur(18px)}html[data-theme="solar"] input,html[data-theme="solar"] textarea,html[data-theme="solar"] select{background:rgba(255,255,255,.52)}textarea{min-height:112px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dock{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;display:flex;gap:9px;padding:10px;border:1px solid var(--line);border-radius:28px;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);box-shadow:var(--shadow)}.dock a{width:46px;height:46px;border-radius:16px;display:grid;place-items:center;text-decoration:none;color:var(--text);background:linear-gradient(145deg,rgba(255,255,255,.22),rgba(255,255,255,.07));border:1px solid rgba(255,255,255,.18);font-size:20px}.dock a:hover{transform:translateY(-2px);background:linear-gradient(145deg,rgba(220,232,167,.28),rgba(184,215,255,.16))}.code,.log{font:12px ui-monospace,monospace;border:1px solid var(--line);border-radius:20px;background:rgba(0,0,0,.12);padding:12px;white-space:pre-wrap;word-break:break-word;color:var(--muted)}html[data-theme="solar"] .code,html[data-theme="solar"] .log{background:rgba(255,255,255,.38)}.log{min-height:190px;max-height:360px;overflow:auto}.list{display:grid;gap:8px;padding:0;margin:0;list-style:none}.list li{border:1px solid var(--line);border-radius:18px;background:var(--glass2);padding:10px;color:var(--muted)}.switch{display:flex;align-items:center;gap:8px}.switch button{padding:9px 11px}.mini{font-size:12px;color:var(--muted);line-height:1.55}@media(max-width:780px){.shell{width:min(100% - 12px,1180px);padding-top:6px}.grid,.hero,.row{grid-template-columns:1fr}.hero{padding:18px 16px;min-height:auto}.panel{border-radius:26px}.topbar{border-radius:24px}.orb{width:min(260px,72vw)}.dock a{width:43px;height:43px}.dock{max-width:calc(100% - 16px);overflow-x:auto}.subline{white-space:normal}.brand{align-items:start}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-left"><span class="mark" aria-hidden="true"></span><div><h1>COPELANDOS</h1><div class="subline">Mobile control surface</div></div></div><div class="switch"><button id="theme-lunar" type="button">Moon</button><button id="theme-solar" type="button">Sun</button></div></div>
      <nav class="nav" aria-label="Sections"><a class="tab" href="#home">Home</a><a class="tab" href="#phone">Phone</a><a class="tab" href="#capture">Capture</a><a class="tab" href="#plan">Plan</a><a class="tab" href="#system">System</a></nav>
    </header>

    <section id="home" class="section">
      <article class="panel hero">
        <div><span class="badge ok" id="status-badge">checking</span><h2>Clear input.<br>Safe action.</h2><p>CopelandOS is now shaped around a phone-first control surface: capture, route, plan, and draft from one calm interface. The design borrows the useful parts from glass taskbar styling: blur, rounded dock geometry, and restrained motion.</p><div class="row"><a class="btn primary" href="#phone">Connect phone</a><button id="refresh-status" type="button">Refresh status</button></div></div>
        <div class="orb-wrap"><div class="orb" aria-hidden="true"></div></div>
      </article>
    </section>

    <section id="phone" class="section grid">
      <article class="panel"><div class="head"><div><div class="title">iPhone setup</div><div class="muted">Use the deployed Worker URL, then add to Home Screen.</div></div><span class="badge ok">PWA</span></div><div class="form"><div class="code" id="current-url"></div><button class="primary" id="copy-current" type="button">Copy app URL</button><ul class="list"><li>Open this URL in Safari on iPhone.</li><li>Share button → Add to Home Screen.</li><li>Name it CopelandOS.</li><li>Use Moon/Sun depending on room brightness.</li></ul></div></article>
      <article class="panel"><div class="head"><div><div class="title">Siri Shortcut capture</div><div class="muted">Fastest phone connection: Ask for Input → URL Encode → Get Contents of URL.</div></div><button id="copy-shortcut" type="button">Copy</button></div><div class="form"><div class="code" id="shortcut-url"></div><label>Test text<input id="shortcut-test" value="Test capture from iPhone"></label><button class="primary" id="test-get-capture" type="button">Test capture URL</button><div class="mini">If CAPTURE_TOKEN is enabled later, add token=YOUR_TOKEN to the URL.</div></div></article>
    </section>

    <section id="capture" class="section grid">
      <article class="panel"><div class="head"><div><div class="title">Capture</div><div class="muted">Dump ideas here from desktop or phone.</div></div><span class="badge ok">safe</span></div><form class="form" id="idea-form"><label>Idea<textarea id="idea-text" placeholder="What should be captured, planned, or remembered?"></textarea></label><div class="row"><label>Source<select id="idea-source"><option>mobile-web</option><option>dashboard</option><option>ios-shortcuts</option><option>siri</option></select></label><label>Urgency<select id="idea-urgency"><option>medium</option><option>low</option><option>high</option></select></label></div><button class="primary" type="submit">Capture</button></form></article>
      <article class="panel"><div class="head"><div><div class="title">Action routing</div><div class="muted">Get the safe next move before doing work.</div></div></div><form class="form" id="route-form"><label>Task<textarea id="route-task" placeholder="What should CopelandOS figure out?"></textarea></label><button class="primary" type="submit">Route task</button></form></article>
    </section>

    <section id="plan" class="section grid">
      <article class="panel"><div class="head"><div><div class="title">Planner</div><div class="muted">Turn a messy goal into steps.</div></div></div><form class="form" id="plan-form"><label>Goal<textarea id="plan-task" placeholder="Finish the CopelandOS phone interface and Rainmeter pairing..."></textarea></label><button class="primary" type="submit">Create plan</button></form></article>
      <article class="panel"><div class="head"><div><div class="title">AI prompt</div><div class="muted">Routes through the configured provider stack.</div></div><span class="badge warn">bounded</span></div><form class="form" id="ai-form"><label>Ask<textarea id="ai-task" placeholder="Ask a small focused question..."></textarea></label><button class="primary" type="submit">Ask</button></form></article>
    </section>

    <section id="system" class="section grid">
      <article class="panel"><div class="head"><div><div class="title">System status</div><div class="muted">Worker capabilities and phone-readiness.</div></div></div><div class="form"><div class="log" id="status-log">Loading...</div></div></article>
      <article class="panel"><div class="head"><div><div class="title">Overnight control loop</div><div class="muted">Read-only capture to morning-report roadmap.</div></div><span class="badge" id="loop-badge">loading</span></div><div class="form"><div class="log" id="loop-log">Loading...</div></div></article>
      <article class="panel"><div class="head"><div><div class="title">Rainmeter pairing</div><div class="muted">Keep Rainmeter light: clock, capture URL, launcher. No animated dashboard.</div></div></div><div class="form"><div class="code">C:\AI\Ops\rainmeter\copelandos-phone.ini</div><button id="copy-rainmeter-note" type="button">Copy Rainmeter plan</button><div class="mini">Use Rainmeter only as a desktop skin that opens this page and displays the Shortcut URL. The Worker stays the brain.</div></div></article>
      <article class="panel wide"><div class="head"><div><div class="title">Activity</div><div class="muted">Local response log.</div></div><button id="clear-log" type="button">Clear</button></div><div class="form"><div class="log" id="activity-log"></div></div></article>
    </section>
  </main>

  <nav class="dock" aria-label="Quick dock"><a href="#home" title="Home">⌂</a><a href="#phone" title="Phone">▣</a><a href="#capture" title="Capture">✎</a><a href="#plan" title="Plan">☑</a><a href="#system" title="System">⚙</a><a href="/api/health" title="Health">✓</a></nav>

  <script>
    const $ = (id) => document.getElementById(id);
    const activity = $('activity-log');
    function log(msg, data){
      const line = '[' + new Date().toLocaleTimeString() + '] ' + msg + (data ? '\n' + JSON.stringify(data, null, 2) : '');
      activity.textContent = line + '\n\n' + activity.textContent;
    }
    function setTheme(theme){ document.documentElement.dataset.theme = theme; localStorage.setItem('copelandos-theme', theme); document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'solar' ? '#e8ece3' : '#151a18'); }
    setTheme(localStorage.getItem('copelandos-theme') || 'lunar');
    $('theme-lunar').onclick = () => setTheme('lunar');
    $('theme-solar').onclick = () => setTheme('solar');
    function shortcutUrl(text){
      return location.origin + '/api/capture/idea?text=' + encodeURIComponent(text || 'SHORTCUT_TEXT') + '&source=ios-shortcuts&urgency=medium&tags=ios,shortcut';
    }
    function refreshUrls(){ $('current-url').textContent = location.origin + '/console'; $('shortcut-url').textContent = shortcutUrl('SHORTCUT_TEXT'); }
    async function copyText(text){ await navigator.clipboard.writeText(text); log('Copied to clipboard'); }
    $('copy-current').onclick = () => copyText($('current-url').textContent);
    $('copy-shortcut').onclick = () => copyText($('shortcut-url').textContent);
    $('copy-rainmeter-note').onclick = () => copyText('Rainmeter: one clock, one capture button opening ' + location.origin + '/console, one status line from ' + location.origin + '/api/health');
    $('clear-log').onclick = () => activity.textContent = '';
    async function api(path, options){
      const res = await fetch(path, options || {});
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = { raw:text }; }
      if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    }
    async function refreshStatus(){
      try{
        const data = await api('/api/health');
        $('status-badge').textContent = data.ok ? 'online' : 'check';
        $('status-log').textContent = JSON.stringify(data, null, 2);
        log('Status refreshed', data.capabilities || data);
      }catch(error){
        $('status-badge').textContent = 'offline';
        $('status-log').textContent = error.message;
        log('Status failed: ' + error.message);
      }
    }
    async function refreshLoop(){
      try{
        const data = await api('/api/integrations/control-loop');
        $('loop-badge').textContent = 'read-only';
        $('loop-badge').className = 'badge ok';
        $('loop-log').textContent = data.steps.map(step => step.step + '. ' + step.name + ' - ' + (step.integration ? step.integration.status : 'unknown')).join('\n');
      }catch(error){
        $('loop-badge').textContent = 'not loaded';
        $('loop-badge').className = 'badge';
        $('loop-log').textContent = error.message;
      }
    }
    $('refresh-status').onclick = refreshStatus;
    $('test-get-capture').onclick = async () => {
      const url = shortcutUrl($('shortcut-test').value);
      try { const data = await api(url.replace(location.origin,'')); log('GET capture ok', data); } catch(error){ log('GET capture failed: ' + error.message); }
    };
    $('idea-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      try{
        const body = { text:$('idea-text').value, idea:$('idea-text').value, source:$('idea-source').value, urgency:$('idea-urgency').value, tags:['dashboard'] };
        const data = await api('/api/capture/idea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        log('Captured idea', data);
      }catch(error){ log('Capture failed: ' + error.message); }
    });
    $('route-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      try{ const data = await api('/api/plan/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:$('route-task').value})}); log('Route brief', data); }catch(error){ log('Route failed: ' + error.message); }
    });
    $('plan-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      try{ const data = await api('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:$('plan-task').value})}); log('Plan created', data); }catch(error){ log('Plan failed: ' + error.message); }
    });
    $('ai-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      try{ const data = await api('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskType:'reasoning',messages:[{role:'user',content:$('ai-task').value}]})}); log('AI response', data); }catch(error){ log('AI failed: ' + error.message); }
    });
    refreshUrls();
    refreshStatus();
    refreshLoop();
  </script>
</body>
</html>`;
}
