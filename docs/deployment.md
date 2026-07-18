# Deployment

## Canonical production topology

CopelandOS deploys as **one Cloudflare Worker** that serves both the dashboard and the API.

```text
Browser
  └─ HTTPS → Cloudflare Worker (wrangler.toml)
                ├─ worker.js        → /api/* routes, /console, OAuth callbacks
                └─ frontend/ assets → /, /index.html, CSS, static files
```

### Configuration

| File | Role |
|---|---|
| `wrangler.toml` | **Canonical** Wrangler config: `main = "worker.js"`, `[assets] directory = "./frontend"` |
| `worker.js` | Canonical backend entry point |
| `frontend/` | Static dashboard served by Wrangler assets |

There is no separate Cloudflare Pages deployment in the canonical topology. A Worker URL is the single production origin.

### Deploy

```bash
npm install -g wrangler   # once
wrangler login            # once
wrangler deploy
```

Wrangler prints a URL like `https://copelandos.<account>.workers.dev`. That URL serves the dashboard and API on the same origin.

### Environment variables

Set secrets in the Cloudflare dashboard or with `wrangler secret put <NAME>`.

| Variable | Purpose |
|---|---|
| `ALLOWED_ORIGIN` | Exact browser origin allowed for cross-origin API calls (no trailing slash). Set to the Worker URL when the dashboard and API share the same origin, or to a separate frontend origin if you host one elsewhere. |
| Provider keys | `CEREBRAS_KEY`, `GROQ_KEY`, `GEMINI_KEY`, `OPENROUTER_KEY`, etc. |
| `SERPER_KEY` | Web search |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Gmail draft access |
| `GITHUB_TOKEN`, `GITHUB_REPO` | Obsidian vault sync |

See `.env.example` for the full list. Never commit real values.

### Health check

```bash
curl https://copelandos.<account>.workers.dev/api/health
```

### Local development

```bash
npx wrangler dev
```

Opens the Worker with assets at `http://127.0.0.1:8787` by default. The dashboard uses same-origin `/api/*` calls, so CORS is not required for local same-origin use.

Alternatively, serve `frontend/` with any static server for UI-only work; API calls will fail unless you configure a Worker URL.

## Legacy artifacts (do not deploy)

### `functions/api/[[route]].js`

A Cloudflare Pages Function from an earlier architecture. It is **not** the active backend. It is retained in the repository only as migration evidence. Do not add routes or features here.

### `wrangler.jsonc` (removed)

Cloudflare PR #1 added a static-only `wrangler.jsonc` without `main = "worker.js"`. That configuration would deploy assets without the canonical API. `wrangler.toml` supersedes it and is the only Wrangler config file.

## Gmail OAuth redirect

Register this redirect URI in Google Cloud Console:

```text
https://copelandos.<account>.workers.dev/api/auth/callback
```

Start enrollment at `/api/auth/gmail` on the deployed Worker.

## Optional local agent

The local Windows agent (`local-agent/`) runs separately on `127.0.0.1:43120`. It is not part of the Cloudflare deployment. See [local-agent/README.md](../local-agent/README.md).
