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

The vault module creates daily notes, project updates, decision logs, research notes, meeting notes, email-draft notes, and task lists. Email notes always include `DRAFT — NOT SENT`.

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns and content explicitly marked as private student data are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.
