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
  Inbox/        ← ideas and email drafts land here
  Templates/
```

The vault module creates daily notes, project updates, decision logs, research notes, meeting notes, email-draft notes, task lists, and idea inbox notes. Email notes always include `DRAFT — NOT SENT`.

## Idea Inbox notes

Captured ideas can be saved to the `Inbox/` folder using `writeIdeaNote(idea)`. These notes include:

- Source (siri, shortcuts, mobile-web, dashboard, manual)
- Classification metadata (category, skill, risk level, urgency)
- Original idea text
- Suggested action

Use `POST /api/ideas/:id/convert` to convert an idea into any note type:
- `project` → Projects folder
- `decision` → Decisions folder
- `research` → Research folder
- `meeting` → BandCouncil folder
- `email` → Inbox folder (draft-only)
- `daily` → Daily folder
- `tasks` → Projects folder

## Daily note idea append

Use `buildDailyIdeaAppend(idea)` to generate a formatted one-line entry for the daily note:

```
- [18:30] **Idea (siri):** Remember to write the catalase lab analysis... — _Lab Analysis_
```

## Templates

- `templates/idea-capture.md` — Template for new idea inbox notes
- `templates/idea-triage.md` — Template for triaged idea notes

Reusable Markdown versions live in `templates/vault/` for direct use inside Obsidian.

## Safety

When `GITHUB_TOKEN` and `GITHUB_REPO` are absent, writes return a mock preview with `connected: false`; this supports setup/testing without pretending persistence occurred.

GitHub mode requires a private vault repository, narrow token permissions, configured `VAULT_ROOT`/`VAULT_BRANCH`, and human review. Filenames reject traversal, separators, nulls, and unsafe characters. Obvious credential patterns and content explicitly marked as private student data are blocked.

Obsidian URI builders support `open`, `new`, and `daily` links. The Worker only returns URIs; the browser or local agent decides whether to open them.
