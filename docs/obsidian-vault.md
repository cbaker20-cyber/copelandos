# Obsidian Vault

## Default structure

```text
CopelandVault/
  Daily/
  Projects/
  School/
  BandCouncil/
  Music/
  Research/
  Decisions/
  Inbox/
  Templates/
```

The vault module creates daily notes, captured idea notes, project updates, decision logs, research notes, meeting notes, email-draft notes, and task lists. Email notes always include `DRAFT — NOT SENT`.

Captured ideas create an `Inbox/idea-*.md` document preview and a daily-note append document. In GitHub mode the daily append updates `Daily/YYYY-MM-DD.md` if it exists, or creates it if it does not. In mock mode both writes return safe previews without pretending persistence happened.

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

Idea conversion supports `project-update`, `decision-log`, `research-note`, `meeting-note`, `task-list`, `email-draft-note`, and `idea-note` aliases through `POST /api/ideas/:id/convert`.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns, explicit private-student flags, and obvious private-student records are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.
