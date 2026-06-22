# Obsidian and Cursor Workflow

CopelandOS should use Obsidian as durable memory and Cursor/Codex as reviewable task execution surfaces. The boundary is simple: memory and prompts are safe to prepare; task execution, PR creation, email sending, deployment, and merges require separate reviewed systems.

## Desired Flow

```text
captured idea
  -> classifier labels risk and project
  -> planner creates task brief
  -> Obsidian note records context
  -> Cursor/Codex prompt is generated
  -> branch and draft PR are created by a supervised agent
  -> PR/check status returns to dashboard and morning report
```

## Current CopelandOS Pieces

- `src/vault.js` builds daily notes, project updates, decisions, research notes, meeting notes, email-draft notes, task lists, and idea notes.
- Vault persistence returns mock previews unless `GITHUB_TOKEN` and `GITHUB_REPO` are configured.
- Unsafe paths, obvious secrets, and private student data flags are blocked.
- `templates/vault/` provides reusable Markdown note formats.
- `POST /api/agents/cursor-prompt` and `POST /api/agents/codex-prompt` generate scoped prompts from registry projects.
- Idea-specific Cursor/Codex prompt generation is available from the inbox.

## Vault Layout

```text
CopelandVault/
  Daily/
  Inbox/
  Projects/
    CopelandOS/
    ScoreScanner/
    JazzBackend/
    BandCouncil/
    Connectome/
  Decisions/
  Research/
  Tasks/
  Drafts/
  Templates/
```

## Mobile Git Notes

The Obsidian Git plugin supports desktop automatic commit-and-sync, but its project README warns that mobile support is experimental and unstable because mobile Git is implemented through JavaScript rather than native Git: <https://github.com/Vinzent03/obsidian-git>.

For iPhone workflows, GitSync is a useful reference because it supports mobile repository sync through widgets, Siri Shortcuts, schedules, and manual triggers: <https://gitsync.viscouspotenti.al/>. CopelandOS should document this as an optional external workflow, not bundle or require it.

## Capture to Vault

Recommended note path pattern:

```text
Inbox/YYYY-MM-DD-idea-slug.md
```

Recommended metadata:

```yaml
source: siri
project: copelandos
urgency: medium
risk: safe
status: new
created: 2026-06-22
```

Privacy rules:

- Do not store private student data.
- Do not store secrets, tokens, refresh tokens, OAuth codes, real email content, or `.env` data.
- Do not make the vault public.
- Avoid copied copyrighted content; store links and your own summaries instead.

## Cursor/Codex Task Queue

Each queued task should include:

- Repository and branch target
- Issue or source idea
- Current working scope
- Explicit safety constraints
- Tests/checks to run
- PR body template
- Stop conditions and blockers

The generated task should not include provider keys, private vault contents, or student information.

## Morning Sync

The morning report should write or preview one daily note:

```text
Daily/YYYY-MM-DD.md
```

Sections:

- Overnight summary
- Draft PRs opened
- Tests/checks run
- Blockers
- Safety notes
- Next review actions

Email delivery remains optional draft-only. The default delivery target is the dashboard, then Obsidian.
