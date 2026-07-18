# CopelandOS v5 — Full Setup Guide

## Architecture

```
Your Browser
       │
       ▼
Cloudflare Worker (`worker.js` + `frontend/` assets via `wrangler.toml`)
       │
       ├── Dashboard (/, /index.html, /console)
       ├── Foundation + Brain API (/api/*)
       ├── AI Providers (Cerebras, Groq, Gemini, OpenRouter, …)
       ├── Web Search (Serper)
       ├── Gmail (OAuth 2.0 refresh token, draft-only)
       └── GitHub (writes .md files to your Obsidian vault repo)
```

**Why this way?**

- API keys live in the Worker env — never exposed in the browser
- One URL serves dashboard and API on the same origin
- Cloudflare free tier: 100,000 req/day

For the full deployment reference, see [docs/deployment.md](docs/deployment.md).

---

## Step 1 — Clone the repository

Your repo already exists. The canonical layout:

```
copelandos/
├── frontend/          ← dashboard UI (served by Wrangler assets)
├── worker.js          ← canonical backend
├── wrangler.toml      ← Worker + static asset config
└── local-agent/       ← optional localhost bridge
```

---

## Step 2 — Deploy the Worker

### Install Wrangler (one time)

```powershell
npm install -g wrangler
wrangler login
```

### Deploy

```powershell
wrangler deploy
```

It will print a URL like:

`https://copelandos.YOUR-SUBDOMAIN.workers.dev`

That single URL serves both the dashboard and the API. Save it.

---

## Step 3 — Set Worker environment variables

Go to: **Cloudflare Dashboard → Workers & Pages → copelandos → Settings → Variables**

Or use the CLI:

```powershell
# AI providers (get all free, no credit card)
wrangler secret put CEREBRAS_KEY    # cloud.cerebras.ai
wrangler secret put GROQ_KEY        # console.groq.com
wrangler secret put GEMINI_KEY      # aistudio.google.com
wrangler secret put OPENROUTER_KEY  # openrouter.ai

# Web search
wrangler secret put SERPER_KEY      # serper.dev → 2,500 free/month

# Security — set to your Worker URL for same-origin deployment
wrangler secret put ALLOWED_ORIGIN  # https://copelandos.YOUR-SUBDOMAIN.workers.dev
```

**Test it's working:**

Open `https://copelandos.YOUR-SUBDOMAIN.workers.dev/api/health`

You should see JSON with capabilities listed.

---

## Step 4 — Connect Gmail (15 minutes)

### 4a. Create Google Cloud project

1. Go to `console.cloud.google.com`
2. Create new project: "CopelandOS"
3. APIs & Services → Enable → search "Gmail API" → Enable

### 4b. Create OAuth credentials

1. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URIs: `https://copelandos.YOUR-SUBDOMAIN.workers.dev/api/auth/callback`
4. Copy the Client ID and Client Secret

### 4c. Add to Worker

```powershell
wrangler secret put GMAIL_CLIENT_ID      # paste client ID
wrangler secret put GMAIL_CLIENT_SECRET  # paste client secret
```

### 4d. Run OAuth flow

Open in browser:

```
https://copelandos.YOUR-SUBDOMAIN.workers.dev/api/auth/gmail
```

Sign in with your Gmail account. You'll be redirected back and shown a **refresh token**.

### 4e. Save refresh token

```powershell
wrangler secret put GMAIL_REFRESH_TOKEN  # paste the token shown
```

Gmail is now connected for inbox access and draft creation. CopelandOS does not send mail; review and send saved drafts in Gmail.

---

## Step 5 — Connect Obsidian vault via GitHub

### Option A: Use your existing vault repo

If your Obsidian vault is already on GitHub (synced with Obsidian Git plugin):

```powershell
wrangler secret put GITHUB_TOKEN  # GitHub PAT with repo scope
wrangler secret put GITHUB_REPO   # e.g. "copeland/my-obsidian-vault"
```

### Option B: Create a new vault repo

1. Create new GitHub repo: `obsidian-vault`
2. Create a `Vault/` folder with a README.md
3. Install Obsidian Git plugin in Obsidian, point it to this repo
4. Set `GITHUB_REPO` to `YOUR_USERNAME/obsidian-vault`

### Create GitHub Personal Access Token

1. GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate new token → check `repo` scope → copy
3. `wrangler secret put GITHUB_TOKEN`

Now every time an agent saves to vault, it commits directly to your GitHub repo, and Obsidian Git syncs it to your local Obsidian app automatically.

---

## Step 6 — Get Serper key (web search)

1. Go to `serper.dev`
2. Sign up → API Keys → Copy key
3. `wrangler secret put SERPER_KEY`

Free tier: **2,500 searches/month** — enough for personal use.

---

## Step 7 — Open CopelandOS

1. Go to your Worker URL (e.g. `https://copelandos.YOUR-SUBDOMAIN.workers.dev`)
2. The dashboard loads from the same origin — no separate Worker URL configuration needed
3. Use the command bar, idea inbox, and integration panels

---

## What each button does

| Button | What it does |
|--------|-------------|
| 🔍 (toolbar) | Next message will include live Google search results |
| 📬 (toolbar) | Next message will include your inbox as context |
| 📁 Vault | Saves AI response as .md file to GitHub → Obsidian |
| ✉️ Email | Opens compose with the AI response pre-filled |
| 💡 Capture idea | AI expands idea → auto-saves to Obsidian |

---

## Idea Pipeline (the key feature)

When you click **💡 Capture idea** and type something like:

> "build a script that monitors scholarship deadlines and emails me weekly"

The system:

1. Sends it to the AI (Chief of Staff prompt)
2. Gets back: summary, why it matters, 3 immediate actions, resources needed, priority
3. Auto-commits it as a `.md` file to your GitHub vault repo
4. Obsidian Git picks it up next sync

Your ideas go from thought → structured note with action plan in ~5 seconds.

---

## Vault folder structure (auto-created)

```
Vault/
├── Research/      ← Scout outputs
├── Emails/        ← Secretary outputs
├── Projects/      ← Engineer outputs
├── Tasks/         ← Chief of Staff outputs
├── Internships/   ← idea pipeline
├── Scholarships/  ← idea pipeline
├── Music/         ← idea pipeline
└── Ideas/         ← uncategorized
```

---

## Complete environment variable checklist

```
CEREBRAS_KEY        ✓ or ✗
GROQ_KEY            ✓ or ✗
GEMINI_KEY          ✓ or ✗
OPENROUTER_KEY      ✓ or ✗
SERPER_KEY          ✓ or ✗
GMAIL_CLIENT_ID     ✓ or ✗
GMAIL_CLIENT_SECRET ✓ or ✗
GMAIL_REFRESH_TOKEN ✓ or ✗
GITHUB_TOKEN        ✓ or ✗
GITHUB_REPO         ✓ or ✗
ALLOWED_ORIGIN      ✓ or ✗
```

Hit `/api/health` on your worker to see which are active at any time.
