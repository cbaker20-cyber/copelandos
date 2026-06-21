# CopelandOS AI Brain

## Overview

The AI Brain is the central intelligence layer of CopelandOS. It captures ideas from any source (phone, Siri, Shortcuts, dashboard), classifies them, plans what to do, routes tasks to the best available AI provider, and optionally calls an AI council for hard decisions.

## Pipeline

```
Phone / Siri / Shortcuts
  → POST /api/capture/idea
  → Idea inbox (ideaStore.js)
  → Classifier (ideaClassifier.js)
  → Skill selection (skills.js)
  → Planner (planner.js)
  → [optional] AI Council (council.js)
  → Provider Router (providerRouter.js)
  → Tool / MCP Safety Registry (toolRegistry.js)
  → Obsidian / vault memory (vault.js)
  → Dashboard display (frontend/index.html)
  → Generated Cursor / Codex task prompt (planner.js)
```

## Modules

### Idea Capture (`src/ideaStore.js`)

Accepts ideas from any source and stores them safely in memory (or vault).

- Validates and sanitizes all input fields
- Generates safe, non-guessable IDs
- Runs the classifier immediately on capture
- Never executes ideas automatically

### Idea Classifier (`src/ideaClassifier.js`)

Deterministic rule-based classifier. No AI call required for basic classification.

**Risk levels:**
- `safe` — proceed with suggested action
- `medium` — human confirmation recommended
- `high` — human confirmation required, never auto-executed

**Categories:** school, coding, music, research, email, planning, memory, local-action, design, other

### Skill Registry (`config/skills.json`, `src/skills.js`)

17 skills matched by keyword scoring:

| Skill | Default Risk | Default Action |
|---|---|---|
| School Writing | safe | draft_text |
| Lab Analysis | safe | write_vault_note |
| Math / Statistics | safe | draft_text |
| Coding | medium | generate_cursor_prompt |
| Repo Review | safe | summarize |
| GitHub Issue / PR Planning | medium | create_github_issue |
| Music Theory | safe | draft_text |
| Score Scanning | safe | generate_cursor_prompt |
| Jazz Generation | safe | generate_cursor_prompt |
| Band Council Drafting | medium | draft_text |
| Research Notes | safe | write_vault_note |
| Design Polish | safe | generate_cursor_prompt |
| Obsidian Memory | safe | write_vault_note |
| Email Drafting | medium | create_gmail_draft |
| Schedule Planning | safe | draft_text |
| Personal Planning | safe | draft_text |
| Local Computer Action | high | confirmation_required |

### Planner (`src/planner.js`)

Functions:
- `classifyTask(input)` — classify a task string
- `chooseSkill(task)` — select the best skill
- `chooseCouncilMode(task, classification)` — decide if council is needed
- `createPlan(task)` — full plan with roles and classification
- `createTaskBrief(task, plan)` — concise brief for humans/AI
- `createCursorPrompt(task, options)` — Cursor implementation prompt
- `createCodexPrompt(task, options)` — Codex architecture/security prompt

**Council mode triggers:**
- Risk level is `high`
- Complexity score ≥ 3 (based on keywords like "architecture", "migrate", "security", "deploy")

## API Endpoints

```
POST /api/capture/idea         — Capture a new idea
GET  /api/ideas                — List ideas (query: ?status=, ?limit=)
GET  /api/ideas/:id            — Get a single idea
POST /api/ideas/:id/triage     — Triage an idea (update status, notes)
POST /api/ideas/:id/convert    — Convert idea to a vault note
POST /api/ideas/:id/cursor-prompt — Generate a Cursor prompt for the idea
POST /api/ideas/:id/codex-prompt  — Generate a Codex prompt for the idea
POST /api/plan                 — Plan any task
GET  /api/skills               — List the skill registry
GET  /api/tools                — List the tool registry
GET  /api/mcp                  — List the MCP server registry
GET  /api/providers            — List provider statuses and routing
```

## Safety Guarantees

- Ideas are never auto-executed.
- High-risk actions always return `confirmation_required: true`.
- Medium-risk actions require `confirmed: true` in the request body.
- All captured text is sanitized before storage.
- Vault writes check for secrets and path traversal.
- No real AI provider calls are made without a configured env var.

## Future Enhancements (Next PRs)

- AI-powered classifier (layer on top of deterministic rules)
- KV-backed persistent idea inbox
- Real council mode with multi-provider API calls
- Google Calendar integration for schedule planning
- GitHub issue auto-draft from ideas
