# Architecture

## Trust zones

```text
Browser dashboard
  └─ HTTPS → canonical Cloudflare Worker (`worker.js`)
                ├─ permission engine
                ├─ command and project routers
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
- **AI brain pipeline:** captures mobile ideas, classifies them, plans next steps, routes providers, writes vault memory, and generates Cursor/Codex task prompts without executing the ideas.

## Backend decision

`wrangler.toml` points to `worker.js`, so it remains canonical. `functions/api/[[route]].js` is retained only as legacy migration evidence. New routes must not be added there.

## Data flow

1. Dashboard fetches `/api/status` and `/api/projects`.
2. A typed or transcribed command is posted to `/api/command`.
3. Deterministic routing returns a status/project response or a proposed plan/model route.
4. Action routes consult the permission engine.
5. HIGH actions stop with `confirmation_required`; MEDIUM actions require explicit confirmation; SAFE actions may proceed.

## Brain pipeline flow

```text
Siri / Shortcuts / mobile web / dashboard
  -> POST /api/capture/idea
  -> in-memory idea inbox
  -> deterministic classifier + skill registry
  -> plan mode and optional mock council
  -> provider router status/fallback selection
  -> allowlisted tool/MCP registry
  -> Obsidian vault idea note + daily append preview/write
  -> dashboard inbox and generated Cursor/Codex prompts
```

Captured ideas are planning inputs only. Prompt generation, vault writing, provider routing, and tool checks do not run deploys, merges, deletes, email sends, arbitrary shell commands, or local UI automation.

## Foundation API

| Route | Purpose |
|---|---|
| `GET /api/status` | Honest module/provider connection status |
| `GET /api/projects` / `GET /api/projects/:id` | Project registry |
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
| `POST /api/capture/idea` | Mobile/dashboard idea capture |
| `GET /api/ideas` / `GET /api/ideas/:id` | Idea inbox |
| `POST /api/ideas/:id/triage` | Human-reviewed triage |
| `POST /api/ideas/:id/plan` | Plan mode for one idea |
| `POST /api/ideas/:id/convert` | Convert idea to an Obsidian/vault note type |
| `POST /api/ideas/:id/cursor-prompt` | Cursor task prompt generation |
| `POST /api/ideas/:id/codex-prompt` | Codex task prompt generation |
| `GET /api/brain/status` | Brain pipeline status |
| `GET /api/project-queue` | Project-scoped idea queues |
| `GET /api/orchestration/status` | Multi-project orchestration status |
