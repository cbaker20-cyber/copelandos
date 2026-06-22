# Obsidian Cursor Workflow

CopelandOS memory should be durable, private, and reviewable. Obsidian is the human-readable memory layer; Cursor/Codex prompts are generated from triaged notes and ideas; draft PR status eventually comes back into CopelandOS.

## Vault Layout

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

## Current Implementation

- `src/vault.js` builds daily notes, project updates, decisions, research notes, meeting notes, email draft notes, task lists, and idea notes.
- Vault persistence uses a GitHub repository only when `GITHUB_TOKEN` and `GITHUB_REPO` are configured.
- Without vault credentials, writes return a mock preview and `connected: false`.
- Unsafe filenames, obvious credential patterns, and content explicitly marked as private student data are blocked.
- Obsidian URI helpers return `obsidian://` links but do not execute local actions.

## Recommended Git Workflow

1. Keep the vault in a private Git repository.
2. Use the Obsidian Git community plugin for automatic commit-and-sync and pull-on-startup.
3. Keep CopelandOS-generated notes in predictable folders (`Inbox/`, `Projects/`, `Daily/`).
4. Review generated notes in Obsidian before turning them into tasks.
5. Generate Cursor/Codex prompts from reviewed notes or inbox items.
6. Open a feature branch and draft PR for implementation work.
7. Store the PR link and review outcome back into a project update note.

## Cursor/Codex Task Queue

Generated prompts should include:

- Repository and project id.
- Current phase and issue source.
- Requested task.
- Safe actions and forbidden actions.
- Tests/checks required before a PR.
- Reminder to stop on blockers instead of guessing.

Generated prompts should not include secrets, real email content, private student data, OAuth codes, or `.env` values.

## Conflict Handling

- Pull before writing from a local vault.
- Prefer small notes per event/task to avoid merge conflicts.
- If a conflict occurs, resolve it manually in Obsidian or Git before further CopelandOS writes.
- Do not let CopelandOS force-push or rewrite vault history.

## References

- Obsidian Git plugin repository: <https://github.com/Vinzent03/obsidian-git>
- Obsidian Git features: <https://publish.obsidian.md/git-doc/Features>
- Existing CopelandOS vault docs: `docs/obsidian-vault.md`
