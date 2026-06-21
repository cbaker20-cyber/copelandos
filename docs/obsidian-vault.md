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

The vault module creates daily notes, project updates, decision logs, research notes, meeting notes, email-draft notes, task lists, and captured idea inbox notes. Email notes always include `DRAFT — NOT SENT`.

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian. Idea-specific templates live at `templates/idea-capture.md` and `templates/idea-triage.md`. Non-secret setup policy lives in `config/vault.json`.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns, obvious private-student-data phrases, and content explicitly marked as private student data are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.

## Idea Inbox

`POST /api/capture/idea` writes the idea to the Worker inbox and prepares two vault documents:

- `Inbox/idea-YYYY-MM-DD-<id>.md` — full captured idea note.
- `Daily/YYYY-MM-DD.md` — append-only daily capture entry when GitHub vault mode is configured.

Without `GITHUB_TOKEN` and `GITHUB_REPO`, the API returns `mode: "mock"` with the exact paths and document preview. This is intentional setup mode, not a fake connection.

## Conversion Types

`POST /api/ideas/:id/convert` supports:

- `project-update`
- `decision-log`
- `research-note`
- `meeting-note`
- `task-list`
- `email-draft-note`
- `idea-note`

Short aliases (`project`, `decision`, `research`, `meeting`, `tasks`, `email`, `idea`) remain accepted for API ergonomics.
