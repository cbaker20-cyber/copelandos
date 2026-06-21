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

## Idea capture and vault integration

Every captured idea automatically generates an Obsidian-compatible Inbox note via `writeIdeaNote`. The note includes:

- Idea text
- Source (siri, shortcuts, mobile-web, dashboard, manual)
- Tags and project
- Risk level and suggested action
- Idea ID and status

### Daily note append

`buildDailyIdeaAppend(idea)` returns a Markdown block suitable for appending to an existing daily note. The block includes a risk badge (🟢/🟡/🔴), source, skill, and suggested action. Callers are responsible for appending this to the daily note's content and calling `persistVaultDocument`.

### Convert idea to note type

`convertIdeaToNote(idea, noteType)` converts a captured idea into one of:

| `noteType` | Vault folder | Use case |
|-----------|-------------|----------|
| `project` | `Projects/` | Progress update on an active project |
| `decision` | `Decisions/` | Decision log with context and consequences |
| `research` | `Research/` | Research question and sources note |
| `meeting` | `BandCouncil/` | Meeting note with agenda and decisions |
| `email` | `Inbox/` | Email draft note (always marked `DRAFT — NOT SENT`) |
| `tasks` | `Projects/` | Task checklist |
| `idea` | `Inbox/` | Generic idea note (default) |

The convert endpoint is `POST /api/ideas/:id/convert` with body `{ "type": "research" }`.

## Security invariants

- Filenames always sanitized: no traversal, no null bytes, no OS-reserved characters.
- Content always scanned for credential patterns before any vault write.
- `containsPrivateStudentData: true` blocks the write entirely.
- Email notes always carry the `DRAFT — NOT SENT` header.
- GitHub vault writes require both `GITHUB_TOKEN` and `GITHUB_REPO`; absent = mock mode.
- No vault write is triggered automatically by high-risk ideas — `confirmationRequired` must be resolved first.
