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

The vault module creates daily notes, Inbox idea notes, project updates, decision logs, research notes, meeting notes, email-draft notes, and task lists. Email notes always include `DRAFT — NOT SENT`.

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns and content explicitly marked as private student data are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.

## Git-Backed Vault Setup

1. Create a private GitHub repository for the vault, for example `cbaker20-cyber/CopelandVault`.
2. Add the folders above and copy `templates/idea-capture.md`, `templates/idea-triage.md`, and `templates/vault/*.md` into `Templates/`.
3. Configure Cloudflare secrets outside Git:
   - `GITHUB_TOKEN`: fine-grained token for contents read/write on the private vault repository.
   - `GITHUB_REPO`: `owner/repo` for the private vault.
   - Optional `VAULT_ROOT`: defaults to `CopelandVault`.
   - Optional `VAULT_BRANCH`: defaults to `main`.
4. Leave these values out of `.env`, `.dev.vars`, screenshots, issues, and PR descriptions.

## Idea Capture Memory

`POST /api/capture/idea` stores the idea in the in-memory inbox and also builds two vault documents:

- `Inbox/idea-YYYY-MM-DD-<id>.md`: a sanitized idea note.
- `Daily/YYYY-MM-DD.md`: an append payload under `## Captured ideas`.

Without vault credentials, both return mock previews. With vault credentials, the daily document is appended safely instead of replacing existing content.

## Conversion Types

`POST /api/ideas/:id/convert` accepts:

- `project-update`
- `decision-log`
- `research-note`
- `meeting-note`
- `task-list`
- `email-draft-note`
- `idea-note`

Short aliases such as `project`, `decision`, `research`, `meeting`, `tasks`, `email`, and `idea` are also accepted for API clients.
