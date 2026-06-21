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
  Inbox/          ← idea captures and email drafts land here
  Templates/
```

## Idea inbox integration

Captured ideas are written to `Inbox/` as dated markdown notes using `writeIdeaNote(idea)`. Each idea note includes:

- Source (Siri, Shortcuts, mobile-web, dashboard, manual)
- Tags
- Risk level badge
- Status
- Project association
- The idea text
- Suggested next action

Ideas can be appended to daily notes using `buildDailyIdeaAppend(idea)`, which returns a single-line bullet with time, source, risk badge, and tags for daily log tracking.

Ideas can be converted to other note types via `convertIdeaToNote(idea, type)`:

| Type | Folder | Notes |
|------|--------|-------|
| `idea` | Inbox | Default — raw capture |
| `research` | Research | Promotes idea to research note |
| `decision` | Decisions | Decision log with context |
| `meeting` | BandCouncil | Meeting note with agenda slots |
| `email` | Inbox | Draft email — always shows `DRAFT — NOT SENT` |
| `tasks` | Projects | Checkbox task list |
| `project` | Projects | Project update note |

## Security guarantees

- Email notes always include `DRAFT — NOT SENT` — no auto-send
- `validateVaultContent` blocks API keys, GitHub tokens, and private key patterns
- `sanitizePathSegment` blocks path traversal (`..`), null bytes, and backslashes
- Content explicitly marked `containsPrivateStudentData: true` is blocked
- Filenames are normalized (NFKC), stripped of special characters, and limited to 80 characters
- Path traversal in idea IDs is neutralized by the sanitization pipeline

## Vault persistence modes

| Mode | When | Behavior |
|------|------|----------|
| Mock | No `GITHUB_TOKEN` or `GITHUB_REPO` | Returns preview with `connected: false` |
| GitHub | Both env vars present | Writes to private GitHub repo via API |

GitHub mode requires a private vault repository, narrow token permissions (`contents:write`), and configured `VAULT_ROOT` / `VAULT_BRANCH` environment variables.

## Obsidian URI builders

The worker generates Obsidian deep-link URIs but never opens them automatically:

- `buildObsidianOpenUri(vault, file)` — open an existing note
- `buildObsidianNewUri(vault, file, content)` — create a new note
- `buildObsidianDailyUri(vault)` — open today's daily note

The browser or local agent decides whether to follow these URIs.

## Templates

Reusable Markdown templates live in `templates/vault/` for direct use inside Obsidian. The `templates/idea-capture.md` and `templates/idea-triage.md` templates match the API structure.
