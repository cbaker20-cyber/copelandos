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

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian. Idea capture templates live at `templates/idea-capture.md` and `templates/idea-triage.md`.

`config/vault.json` documents the expected folder structure, conversion types, and safety switches for Git-backed vault setup.

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns and content explicitly marked as private student data are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.

## Git-backed setup

1. Create a private GitHub repository for the vault, for example `cbaker20-cyber/copeland-vault`.
2. Create the folders listed in `config/vault.json`, or let CopelandOS create files under those folders when the GitHub connector is configured.
3. Store `GITHUB_TOKEN`, `GITHUB_REPO`, and optionally `VAULT_ROOT` / `VAULT_BRANCH` as Cloudflare secrets or local environment variables. Do not commit them.
4. Keep Obsidian Git sync pointed at the private vault repository.
5. Confirm dashboard status says `Configured` only when the Worker sees the required env vars.

## Captured ideas

`POST /api/capture/idea` creates an inbox idea and builds an Obsidian note preview immediately. With no vault env vars, the response is `mode: "mock"` and includes the sanitized target path. With GitHub vault env vars, it writes under `CopelandVault/Inbox/`.

Captured ideas can later be converted with `POST /api/ideas/:id/convert` using:

- `project-update`
- `decision-log`
- `research-note`
- `meeting-note`
- `task-list`
- `email-draft-note`

Email draft notes stay visibly draft-only. Conversion writes still reject path traversal, obvious secrets, and obvious private-student data.

## Daily note append

The vault layer exposes `buildDailyIdeaAppend(idea)` and `writeDailyIdeaAppend(idea)` so a later cron or confirmed workflow can append captured ideas to a daily note. This PR returns the append block as a safe preview; it does not overwrite a daily note automatically.
