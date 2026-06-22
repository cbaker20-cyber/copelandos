# Obsidian Cursor Workflow

This workflow connects CopelandOS memory, Obsidian Git, and Cursor/Codex task prompts while keeping human review in the loop.

## Goal

Turn mobile ideas into durable notes and scoped implementation prompts:

```text
captured idea
  -> classifier
  -> planner
  -> Obsidian note
  -> Cursor or Codex prompt
  -> branch
  -> tests
  -> draft PR
  -> review status note
```

## Vault Layout

Recommended private vault structure:

```text
CopelandVault/
  Daily/
  Inbox/
  Projects/
    CopelandOS/
    ScoreScanner/
    BandCouncil/
    JazzBackend/
    Connectome/
  Decisions/
  Tasks/
  Research/
  Templates/
```

## Obsidian Git Practices

- Use a private GitHub repository for the vault.
- Pull before writing on a new device.
- Commit and sync after edits.
- Keep `.obsidian`, `.trash`, and editor state out of sync if they cause conflicts.
- Use narrow credentials and rotate them if exposed.
- Never store secrets, OAuth tokens, refresh tokens, real email content, or private student data.

The Worker vault module should write only sanitized Markdown paths. When GitHub vault credentials are absent, it should return a mock preview instead of claiming persistence.

## Idea To Note

1. Capture an idea from mobile or dashboard.
2. Review classifier output.
3. Convert to a note type:
   - `idea` for raw inbox memory.
   - `project` for project state.
   - `decision` for architecture decisions.
   - `research` for cited background.
   - `tasks` for action lists.
4. Persist through `POST /api/vault/write` only after content passes safety checks.
5. Keep the idea status updated.

## Note To Cursor Task

Cursor prompt should include:

- Repository.
- Current phase.
- Task source.
- Requested task.
- Safe actions.
- Forbidden actions.
- Forbidden claims.
- Required tests/checks.
- Draft PR expectation.

The current routes generate prompts only:

- `POST /api/ideas/:id/cursor-prompt`
- `POST /api/ideas/:id/codex-prompt`
- `POST /api/agents/cursor-prompt`
- `POST /api/agents/codex-prompt`

They do not execute Cursor, start Codex, push code, merge PRs, deploy, or install packages.

## Review Status Back To Vault

For each draft PR, add a short project update:

```markdown
# Project Update: CopelandOS

- Branch:
- Draft PR:
- Summary:
- Tests/checks run:
- Safety notes:
- Blockers:
- Next step:
```

No automation should mark a PR ready for review, merge it, or claim success without check results.

## Morning Report Input

The morning report should read from:

- Captured idea count.
- Project registry next recommended tasks.
- Draft PR links and checks when a read-only connector exists.
- Vault decisions and project updates.
- Known blockers.

Until a read-only GitHub connector exists, PR status should be written manually or by the automation run summary.

## Source Notes

- Obsidian Git plugin: https://github.com/Vinzent03/obsidian-git
- Obsidian community Git plugin page: https://community.obsidian.md/plugins/obsidian-git
- Obsidian URI docs: https://help.obsidian.md/Extending+Obsidian/Obsidian+URI
