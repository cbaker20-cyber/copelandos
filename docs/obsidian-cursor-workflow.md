# Obsidian Cursor Workflow

CopelandOS should treat Obsidian as durable memory and Cursor/Codex as implementation workers. The handoff is always draft-first: an idea becomes a reviewed note or task brief, then a scoped branch and draft PR.

## Vault Layout

Recommended private vault folders:

```text
CopelandVault/
  Daily/
  Projects/
  Decisions/
  Research/
  Meetings/
  Tasks/
  Ideas/
```

The current vault module can create daily notes, project updates, decision logs, research notes, meeting notes, draft email notes, task lists, and idea notes. Persistence is mock mode unless `GITHUB_TOKEN` and `GITHUB_REPO` are configured.

## Git Sync Rules

- Pull before editing on desktop.
- Commit small note changes with useful messages.
- Push after review.
- Exclude workspace caches such as `.obsidian/workspace.json` and `.trash/` from the vault repository.
- Treat mobile Git support as experimental; use mobile capture into CopelandOS rather than relying on mobile Git as the primary sync path.
- Resolve conflicts manually in Obsidian or a Git client; do not let CopelandOS auto-resolve vault conflicts.

The Obsidian Git plugin supports commit, pull, push, commit-and-sync, and auto-pull workflows, but its README warns that mobile Git support is unstable. CopelandOS should therefore keep the phone path as inbox capture and let desktop or server-side Git do reviewed persistence.

## Idea To Task

```text
captured idea
  -> deterministic classifier
  -> risk level + skill + suggested action
  -> optional Obsidian idea note
  -> planner brief
  -> Cursor/Codex prompt
  -> branch + draft PR
```

The generated prompt should include:

- repository and project phase,
- current safe actions,
- forbidden actions and forbidden claims,
- tests/checks expected,
- draft PR requirement,
- instruction to stop on blockers rather than guessing.

## Morning Report

A morning report should be a generated draft note, not a sent message:

```text
status endpoint
  + project registry
  + GitHub summary when configured
  + idea inbox counts
  + recent vault notes
  -> draft daily note
  -> user review
  -> optional commit to vault
```

Suggested sections:

- `Top Priorities`
- `Open PRs`
- `Blocked Work`
- `Captured Ideas`
- `Safety Notes`
- `Next Reviewed Actions`

## Privacy Boundaries

- Do not store private student data.
- Do not store secrets, OAuth codes, refresh tokens, private email bodies, or `.env` content.
- Email-related notes are drafts only and must never imply a message was sent.
- GitHub issue/PR summaries should omit confidential context unless the target vault is private and reviewed.

Sources: [Obsidian Git plugin](https://github.com/Vinzent03/obsidian-git), [Obsidian Git community plugin page](https://community.obsidian.md/plugins/obsidian-git), and the local CopelandOS docs `docs/obsidian-vault.md` and `docs/cursor-codex-workflow.md`.
