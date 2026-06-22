# Obsidian and Cursor Workflow

CopelandOS should turn captured ideas into durable notes and scoped implementation work while preserving human review. Obsidian is the private memory layer. Cursor and Codex are task execution surfaces. GitHub PRs are the review boundary.

## Workflow

```text
CopelandOS inbox item
  -> classifier project/risk tags
  -> planner task brief
  -> safe vault note preview
  -> Obsidian Git vault write if configured
  -> Cursor or Codex prompt
  -> branch + tests + draft PR
  -> morning report links review status
```

## Obsidian Git Vault

The Obsidian Git plugin demonstrates the common pattern of automatic commit-and-sync for Markdown vaults. CopelandOS should stay stricter:

- Private vault repository only.
- Narrow GitHub token permissions.
- `VAULT_ROOT` and `VAULT_BRANCH` configured explicitly.
- No private student data.
- No secrets, OAuth codes, refresh tokens, or copied private emails.
- GitHub write failures return safe error summaries.
- When credentials are absent, vault writes return a preview with `connected: false`.

Suggested vault folders:

```text
CopelandVault/
  Daily/
  Projects/
  BandCouncil/
  Music/
  Research/
  Decisions/
  Inbox/
  Reports/
  Templates/
```

## Cursor/Codex Task Queue

Generated prompts should be specific enough to hand to an agent, but not treated as execution:

- Repository and branch.
- Issue or source document.
- Exact task.
- Allowed actions.
- Forbidden actions and claims.
- Required tests/checks.
- Draft PR expectation.
- Stop conditions for blockers.

The current APIs support:

- `POST /api/agents/cursor-prompt`
- `POST /api/agents/codex-prompt`
- `POST /api/ideas/:id/cursor-prompt`

## Note Types

| Note type | Use |
|---|---|
| Daily note | Morning report and end-of-day digest |
| Project update | PR status, checks, blockers, next task |
| Decision log | Architecture decisions and tradeoffs |
| Research note | Source-backed references |
| Email draft note | Draft-only communications |
| Task list | Human-reviewed implementation queue |
| Idea note | Captured idea with classifier output |

## Morning Report Draft

```markdown
# Morning Report - YYYY-MM-DD

## Overnight Summary
- CopelandOS:
- Score Scanner:
- Band Council:
- JazzBackend:
- Connectome:

## Draft PRs
- Repository:
- Branch:
- Tests:
- Review blockers:

## Safety Notes
- No email sent.
- No deploys.
- No merges.
- No secrets committed.
- No private student data stored.

## Next Review Actions
- [ ] Review PR diff
- [ ] Confirm tests/checks
- [ ] Decide whether to request changes
```

## Privacy Boundaries

Band Council and school operations notes must avoid private student records. Use roles, crews, and generic placeholders until a human chooses where to store sensitive details. Email remains draft-only and should be clearly labeled `DRAFT - NOT SENT`.

## Acceptance Checks

- Vault writes reject unsafe filenames and obvious credential patterns.
- Email draft notes are labeled draft-only.
- Generated Cursor/Codex prompts include forbidden actions.
- Integration registry blocks `auto_merge` and `send_email` for task and mobile surfaces.
