# Obsidian And Cursor Workflow

CopelandOS memory should use Obsidian as the human-readable source of truth and Cursor/Codex prompts as the bridge from captured intent to reviewable code work.

## Memory Flow

```text
Captured idea
  -> classifier and risk label
  -> reviewed inbox item
  -> vault note draft
  -> private Obsidian Git vault
  -> project task prompt
  -> draft PR
  -> PR/check summary back into daily note
```

## Obsidian Git Setup

The Obsidian Git community plugin documents pull, commit, and push workflows inside the vault, including auto-pull on startup and commit-and-sync commands. Sources: [Obsidian Git docs](https://publish.obsidian.md/git-doc/Start+here), [Obsidian Git repository](https://github.com/Vinzent03/obsidian-git).

Recommended CopelandOS vault layout:

```text
CopelandVault/
  Daily/
  Projects/
    CopelandOS/
    Score Scanner/
    Band Council/
    JazzBackend/
    Connectome/
  Decisions/
  Ideas/
  Research/
  Drafts/
  Templates/
```

Recommended `.gitignore` patterns for the vault:

```gitignore
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.trash/
```

## Write Policy

- Pull/sync before major editing sessions.
- Use `writeIdeaNote`, `writeProjectUpdate`, `writeDecisionLog`, or `writeTaskList` for structured notes.
- Reject obvious secrets and private student data before persistence.
- Mock vault writes are acceptable in development and must be labeled as mock/previews.
- Do not store OAuth codes, refresh tokens, raw email bodies, or `.env` content.

## Cursor/Codex Task Queue

`/api/agents/cursor-prompt`, `/api/agents/codex-prompt`, `/api/ideas/:id/cursor-prompt`, and `/api/ideas/:id/codex-prompt` should generate reviewable prompts with:

- repository and project phase,
- requested task,
- safe actions,
- forbidden actions,
- forbidden claims,
- draft PR requirement,
- stop-on-blocker instruction.

The queue is prompt generation only. It must not run local IDE actions, execute shell commands, mark PRs ready, merge, deploy, or install packages.

## Morning Report Draft

The morning report should be an Obsidian daily note draft with:

- overnight inbox captures,
- project registry state,
- PRs opened or blocked,
- checks run and failures,
- safety notes,
- next recommended human review steps.

No email version should be sent. If an email summary is wanted later, CopelandOS can create a Gmail draft only after human confirmation.

## Next Implementation Tasks

- Add a `writeMorningReport` helper in `src/vault.js`.
- Add a read-only `/api/reports/morning` route that drafts, not sends.
- Add vault note tests for report path safety and private-data rejection.
- Add GitHub status ingestion only after a scoped read-only connector is designed.
