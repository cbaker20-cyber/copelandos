# Obsidian And Cursor Workflow

CopelandOS should make memory and implementation work flow together without blurring their trust boundaries. Obsidian is durable private memory. Cursor and Codex are draft-PR production tools. Neither should bypass review.

## Workflow

```text
capture idea
  -> classify and triage
  -> convert to Obsidian note when useful
  -> generate Cursor/Codex prompt when implementation is approved
  -> agent works on a branch
  -> draft PR opens
  -> CopelandOS reports status and blockers
  -> final learnings become an Obsidian project update
```

## Obsidian Git Vault

Current Worker support:

- `POST /api/vault/write` creates typed vault documents.
- `src/vault.js` builds daily notes, project updates, decision logs, research notes, meeting notes, email-draft notes, task lists, and idea notes.
- If `GITHUB_TOKEN` and `GITHUB_REPO` are missing, the Worker returns a mock preview instead of pretending persistence happened.
- Content marked as private student data is blocked.
- Email notes are draft-only and include `DRAFT - NOT SENT`.

Suggested vault layout:

```text
CopelandVault/
  Daily/
  Inbox/
  Projects/
  Research/
  Decisions/
  BandCouncil/
  Music/
  Templates/
```

## Obsidian Git Setup Notes

The Obsidian Git community plugin supports commit/pull/push workflows, automatic commit-and-sync, and startup pulls. Its documentation also notes mobile setup differences and common use of Working Copy on iOS for more reliable cloning.

References:

- Obsidian Git plugin: https://github.com/Vinzent03/obsidian-git
- Obsidian community plugin page: https://community.obsidian.md/plugins/obsidian-git
- Getting started docs with mobile notes: https://github.com/Vinzent03/obsidian-git/blob/master/docs/Getting%20Started.md

Recommended policy:

- Use a private vault repo.
- Keep `.env`, `.dev.vars`, credentials, and private student data out of the vault.
- Commit small, descriptive changes.
- Pull before editing on a second device.
- Resolve conflicts manually in Obsidian or a Git client.

## Cursor / Codex Queue

Current Worker support:

- `POST /api/agents/cursor-prompt`
- `POST /api/agents/codex-prompt`
- `POST /api/ideas/:id/cursor-prompt`
- `POST /api/ideas/:id/codex-prompt`

Prompt rules:

- Inspect the repository first.
- Work on a branch.
- Add or update tests.
- Open a draft PR.
- Stop on blockers instead of guessing.
- Do not merge, deploy, send email, commit secrets, or claim untested behavior.

## Morning Memory Loop

After an overnight run, CopelandOS should produce a morning report with:

- Captured ideas.
- Converted notes.
- Draft PRs opened.
- Checks run.
- Blockers.
- Repositories that were inaccessible.
- Safety notes.
- Next review actions.

The morning report can be saved as a daily note only after human review or through a safe vault write.

## Implementation Roadmap

1. Persist the idea inbox beyond in-memory storage.
2. Add a `GET /api/morning-report` scaffold that assembles local status only.
3. Add read-only GitHub PR summaries with no merge/close permissions.
4. Add a vault note template for sprint reports.
5. Add tests proving private student data and obvious secrets are blocked before vault persistence.
