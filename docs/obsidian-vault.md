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

The vault module creates daily notes, captured idea inbox notes, project updates, decision logs, research notes, meeting notes, email-draft notes, and task lists. Email notes always include `DRAFT — NOT SENT`.

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns and obvious private-student-data patterns are blocked.

## Idea capture notes

`POST /api/capture/idea` creates two vault-safe documents:

- `Inbox/idea-YYYY-MM-DD-<id>.md` for the captured idea.
- `Daily/YYYY-MM-DD.md` append content under `Captured ideas`.

When the vault is not connected, both writes return mock previews and the dashboard labels the vault as mock mode.

## Idea conversions

`POST /api/ideas/:id/convert` accepts:

- `project` for a project update.
- `decision` for a decision log.
- `research` for a research note.
- `meeting` for a meeting note.
- `tasks` for a task list.
- `email` for a draft-only email note.
- `idea` for an inbox idea note.
- `daily` for a daily-note append.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.
