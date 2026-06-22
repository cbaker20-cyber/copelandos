# Obsidian And Cursor Workflow

CopelandOS should use Obsidian as memory and Cursor/Codex as implementation lanes. The system should never skip human review between memory, planning, code changes, and PRs.

## Target Flow

```text
capture idea
  -> classify risk and project
  -> write or update Obsidian note
  -> generate a Cursor/Codex task brief
  -> agent works on a branch
  -> draft PR opens
  -> PR/check status returns to CopelandOS
  -> morning report summarizes outcomes
```

## What Works Now

- `src/vault.js` can create daily notes, project updates, research notes, decision logs, meeting notes, email draft notes, task lists, and idea notes.
- Vault path handling blocks traversal and unsafe names.
- Content validation blocks obvious secrets and private student data flags.
- `/api/vault/write` evaluates permissions before persistence.
- `/api/obsidian/open` returns Obsidian URIs without executing local actions.
- Idea routes can generate Cursor/Codex prompts.

## Obsidian Git Workflow

Desktop:

1. Pull before editing.
2. Edit notes in Obsidian.
3. Let Obsidian Git auto-commit after a quiet period, or commit manually.
4. Push after edits.
5. Resolve conflicts before continuing agent work.

Mobile:

1. Prefer Working Copy or GitSync to handle Git on iOS/Android.
2. Pull before writing on mobile.
3. Edit in Obsidian.
4. Commit and push after writing.
5. Avoid large automatic mobile sync operations while the vault is open on another device.

The Obsidian Git plugin documentation warns that mobile support is experimental/unstable because mobile Git support relies on JavaScript Git and has memory limitations. The safer mobile pattern is a dedicated mobile Git app plus Obsidian editing.

Source: <https://github.com/Vinzent03/obsidian-git?tab=readme-ov-file>

## Vault Structure

```text
CopelandVault/
  Daily/
    2026-06-22.md
  Projects/
    CopelandOS/
      status.md
      decisions/
      task-briefs/
    Score Scanner/
    Band Council/
    JazzBackend/
    Connectome/
  Inbox/
    ideas/
  Research/
  Decisions/
  Drafts/
```

## Note Types

- Daily note: morning plan, overnight summary, blockers, next actions.
- Project update: current phase, what changed, PR links, open risks.
- Decision log: choice, alternatives, reason, reversal trigger.
- Research note: cited findings and open questions.
- Task list: reviewed actions for Cursor/Codex.
- Email draft note: copy to review before creating any Gmail draft.
- Idea note: capture payload plus classifier output.

## Cursor/Codex Task Queue

Each task brief should include:

- Project and repository.
- Issue or source idea.
- Required safety rules.
- Files likely to change.
- Tests to run.
- Forbidden actions.
- PR title and draft body outline.
- Definition of done.

Future queue item:

```json
{
  "id": "task_...",
  "projectId": "copelandos",
  "sourceIdeaId": "idea_...",
  "agent": "cursor",
  "status": "ready-for-agent",
  "branch": "cursor/...",
  "allowedActions": ["edit_docs", "run_tests", "open_draft_pr"],
  "blockedActions": ["send_email", "deploy", "merge_pr"]
}
```

## Review Status Back Into Memory

When read-only GitHub supervision is implemented, CopelandOS should summarize:

- Draft PR URL.
- Commit hash.
- Tests/checks run.
- Review comments.
- Open blockers.
- Whether the PR is ready for human review.

This should be a draft note or dashboard card, not an external message unless a human approves it.

## Safety Notes

- Never commit `.env`, `.dev.vars`, OAuth codes, tokens, or real private email content.
- Do not store private student data in Obsidian through CopelandOS.
- Gmail remains draft-only.
- Cursor/Codex tasks must open PRs; no direct pushes to `main`.
- Local actions require explicit allowlist and confirmation.
- Mobile Git conflicts should stop the workflow until resolved.
