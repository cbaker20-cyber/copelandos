# Ultimate CopelandOS AI assistant team

CopelandOS is cloud/connectors/GitHub-first. No local agents, no PC bridge, and no real-desktop control are part of this plan.

## Core idea

Hermes should build a large shared context pack for each project, then hand that same context to specialist agents. The context pack is the single source of truth for current project state, instructions, constraints, recent decisions, and next actions.

## Shared context endpoints

```text
GET  /api/context/status
POST /api/context/pack
POST /api/hermes/route with { "withContext": true }
```

## Context sources

- Project registry: repos, phases, safe actions, forbidden actions, next tasks.
- GitHub connector: PRs, issues, branches, CI, changed files, review comments.
- CopelandVault: daily notes, project updates, decisions, captured ideas.
- Google Workspace: Gmail drafts, Calendar obligations, Drive/Docs/Sheets context.
- Conversation context: current instructions and recent decisions.
- Automation registry: Mimo, Ornith, GitHub Actions, Google Workspace, Slack, n8n/Make/Zapier previews.

## Agent team

- Hermes: Chief router and context compiler.
- Architect: repo architecture and system design.
- Engineer: code, tests, and PR prompts.
- Secretary: Gmail, Calendar, Drive, Sheets, and Band Council operations.
- Researcher: source-grounded evidence and citations.
- Tutor: Mimo-style lessons and quizzes.
- Ornith 1.0: experimental harness/eval designer, sandbox-required.

## Big context model strategy

Use the largest configured cloud context window for synthesis. Prefer model routing in this order when available:

1. Gemini/OpenRouter large-context model for giant project context.
2. Groq/Cerebras for fast smaller subtasks.
3. GitHub/Cursor/Codex-style coding agents for repo-specific implementation prompts.
4. Deterministic templates when no AI provider is configured.

## Hard rules

- No local agents.
- No PC bridge.
- No live desktop control.
- No tool fires webhooks, sends email, posts Slack, edits Calendar/Drive, deletes files, deploys, or merges without explicit approval.
- Secrets stay in Cloudflare Worker secrets or connector settings, never GitHub.
