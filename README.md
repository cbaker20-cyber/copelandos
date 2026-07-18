# CopelandOS

CopelandOS is a secure foundation for a personal operations system: one Jarvis-style dashboard coordinating project status, planning, model routing, Obsidian memory, Gmail drafts, and an optional permissioned Windows bridge.

It is not complete, and disconnected integrations say so. The current foundation deliberately does not send email, merge PRs, deploy, install software, run arbitrary shell commands, or control the screen, mouse, or keyboard.

## Canonical architecture

- `worker.js` is the only canonical Cloudflare Worker backend.
- `frontend/index.html` is the responsive dashboard served by Wrangler assets.
- `src/` contains pure routing, permission, project, and vault modules.
- `config/` contains non-secret project and provider policy.
- `local-agent/` is an optional localhost-only Node service with a shared token and explicit allowlist.
- `functions/api/[[route]].js` is legacy migration evidence, not a second active backend. Do not add features there.

See [architecture](docs/architecture.md), [deployment](docs/deployment.md), [security model](docs/security-model.md), [roadmap](ROADMAP.md), and [project state](PROJECT_STATE.md).

## What works in this foundation

- Five-project registry and safe prompt generation.
- Model selection across environment-configured providers with clear missing-provider errors.
- SAFE/MEDIUM/HIGH permission decisions; HIGH actions never execute automatically.
- GitHub-backed or mock-mode Obsidian vault document creation with path and secret checks.
- Draft-only Gmail routes with explicit medium-risk confirmation.
- Foundation API routes for status, projects, commands, vault notes, prompts, remote status, and provider routing.
- Local Windows-agent skeleton for allowlisted status, launches, exact tests, and vault writes.
- Push-to-talk browser voice input with visible state; no always-on microphone.

## Quick checks

```bash
npm test
node --check worker.js
node --check local-agent/server.js
```

## Local dashboard

Serve the repository root with any static server and open `frontend/index.html`, or use Wrangler after configuring placeholder-free local variables outside Git:

```bash
npx wrangler dev
```

The dashboard works in honest offline/demo mode when integrations are absent. Provider keys and OAuth credentials belong only in Cloudflare secrets or local environment variables.

## Local agent

Review and edit `local-agent/allowlist.json`, set a long `LOCAL_AGENT_TOKEN`, then run:

```bash
npm run local-agent
```

It binds to `127.0.0.1:43120` by default. See [local-agent/README.md](local-agent/README.md) and [local-agent protocol](docs/local-agent-protocol.md).

## Manual setup still required

- Cloudflare deployment and exact `ALLOWED_ORIGIN`.
- Any AI provider keys/models.
- Gmail OAuth credentials and refresh token; Gmail remains draft-only.
- A private GitHub vault repository or local vault path.
- Local-agent token and reviewed allowlist.
- GitHub supervision connector; current API reports it as not connected.
