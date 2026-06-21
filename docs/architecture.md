# Architecture

## Trust zones

```text
Browser dashboard
  └─ HTTPS → canonical Cloudflare Worker (`worker.js`)
                ├─ permission engine
                ├─ command and project routers
                ├─ mobile idea capture and brain planner
                ├─ provider/model router
                ├─ Gmail draft API
                └─ GitHub-backed Obsidian vault

Optional local Windows agent
  └─ localhost by default + shared token + allowlist
       ├─ status and approved Git reads
       ├─ exact approved test commands
       ├─ approved app/URL launches
       └─ bounded local-vault writes
```

The Cloudflare Worker and local agent are separate trust zones. The Worker does not automatically reach into a PC. The dashboard reports the local agent as disconnected until a reviewed connection is explicitly configured.

## Modules

- **Jarvis dashboard:** command bar, central orb, missions, projects, integration status, and push-to-talk UI.
- **Command router:** interprets a small deterministic command set before any model request.
- **Mobile idea pipeline:** captures phone/Siri/Shortcuts ideas, classifies them, plans them, and stores them in an inbox without executing them.
- **Project command center:** reads `config/projects.json` and creates scoped Cursor/Codex prompts.
- **Obsidian memory:** builds safe notes and URIs; writes to a configured private GitHub vault or returns a mock preview.
- **GitHub supervisor:** route and UI placeholder only; currently reports not connected.
- **Cursor/Codex orchestrator:** generates bounded prompts; it does not run agents or merge work itself.
- **Gmail draft assistant:** reads Gmail when configured and creates drafts only after confirmation.
- **Band Council operations:** project policy forbids private student data and autonomous communication.
- **School planner / research librarian / music helper:** dashboard and project-policy modules awaiting data connectors.
- **Local Windows agent:** separate localhost service with exact allowlists.
- **Voice interface:** browser Web Speech API, push-to-talk only.
- **Model router:** chooses the first configured provider for a task category without revealing credentials.
- **Permission engine:** classifies every named action as SAFE, MEDIUM, or HIGH.

## Backend decision

`wrangler.toml` points to `worker.js`, so it remains canonical. `functions/api/[[route]].js` is retained only as legacy migration evidence. New routes must not be added there.

## Data flow

1. Dashboard fetches `/api/status`, `/api/projects`, `/api/brain/status`, and `/api/ideas`.
2. Phone/Siri/Shortcuts/mobile web posts an idea to `/api/capture/idea`.
3. The idea is sanitized, classified, assigned a skill/risk level, written to the in-memory inbox, and previewed/written to the vault if configured.
4. The human triages or plans the idea through `/api/ideas/:id/triage` and `/api/ideas/:id/plan`.
5. The system can convert the idea to a vault note or generate Cursor/Codex prompts, but it does not execute the idea.
6. HIGH actions stop with `confirmation_required`; MEDIUM actions require explicit confirmation; SAFE actions may proceed only through their bounded routes.

## Foundation API

| Route | Purpose |
|---|---|
| `GET /api/status` | Honest module/provider connection status |
| `GET /api/projects` / `GET /api/projects/:id` | Project registry |
| `POST /api/capture/idea` | Mobile/Siri idea capture |
| `GET /api/ideas` / `GET /api/ideas/:id` | Idea inbox |
| `GET /api/ideas/stats` | Inbox counts by status/risk/skill |
| `POST /api/ideas/:id/triage` | Human triage update |
| `POST /api/ideas/:id/plan` | Planner output and `planned` status |
| `POST /api/ideas/:id/convert` | Convert idea to a safe vault document |
| `POST /api/ideas/:id/cursor-prompt` | Generate a scoped Cursor task prompt |
| `POST /api/ideas/:id/codex-prompt` | Generate a scoped Codex task prompt |
| `POST /api/ideas/:id/dismiss` | Archive an idea without deleting it |
| `GET /api/project-queue` | Ideas grouped by project |
| `GET /api/brain/status` | Honest brain/planner/router registry status |
| `POST /api/command` | Deterministic command routing |
| `POST /api/vault/write` | Bounded GitHub/mock vault note |
| `POST /api/obsidian/open` | Return a safe Obsidian URI without opening it |
| `POST /api/email/draft` | Confirmed Gmail draft creation only |
| `GET /api/github/summary` | Explicit not-connected supervisor stub |
| `POST /api/agents/cursor-prompt` | Scoped Cursor prompt generation |
| `POST /api/agents/codex-prompt` | Scoped Codex prompt generation |
| `GET /api/remote/status` | Honest local-agent connection status |
| `POST /api/remote/request-action` | Permission classification; no remote execution without a connection |
| `POST /api/ai/route` | Provider/model selection without key exposure |
