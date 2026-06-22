# Obsidian and Cursor Workflow

CopelandOS should make Obsidian the durable private memory and Cursor/Codex the bounded implementation queue. The Worker should coordinate drafts and prompts, not silently execute local actions.

## End-to-End Flow

```text
captured idea
  -> classified inbox item
  -> human triage
  -> planner output
  -> vault note preview/write
  -> Cursor or Codex prompt
  -> branch and draft PR
  -> checks and review status
  -> morning report
```

## Vault Structure

```text
CopelandVault/
  Daily/
  Inbox/
  Projects/
    CopelandOS/
    ScoreScanner/
    JazzBackend/
    BandCouncil/
    Connectome/
  Research/
  Decisions/
  Drafts/
  Templates/
```

The vault module already rejects unsafe filenames, credential-like content, and notes explicitly marked as private student data. `GITHUB_TOKEN`, `GITHUB_REPO`, and `VAULT_BRANCH` should point at a private vault repo with narrow write access.

## Mobile Git Notes

The Obsidian Git plugin is useful on desktop, but its own docs call mobile support experimental/unstable because mobile Obsidian cannot use native Git and relies on JavaScript Git implementation constraints. For iPhone, prefer a dedicated Git app such as Working Copy or GitSync to sync the vault folder, while Obsidian edits the local folder.

Sources:

- [Obsidian Git plugin](https://github.com/Vinzent03/obsidian-git)
- [GitSync mobile Git client](https://gitsync.viscouspotenti.al/)

## Cursor/Codex Queue Contract

Queue records should eventually include:

- `id`
- `sourceIdeaId`
- `projectId`
- `repo`
- `branch`
- `agent`: `cursor` or `codex`
- `prompt`
- `status`: `drafted`, `queued`, `running`, `draft-pr-open`, `needs-review`, `blocked`, `closed`
- `checkStatus`
- `prUrl`
- `safetyNotes`
- `createdAt`
- `updatedAt`

Current code generates prompt text through:

- `/api/ideas/:id/cursor-prompt`
- `/api/ideas/:id/codex-prompt`
- `/api/agents/cursor-prompt`
- `/api/agents/codex-prompt`

These routes produce task briefs; they do not execute Cursor, Codex, GitHub, or local shell actions.

## Prompt Requirements

Every generated implementation prompt should include:

- repository name,
- task source,
- requested task,
- safe actions,
- forbidden actions,
- forbidden claims,
- required tests/checks,
- "open a draft PR, do not merge",
- "stop on blockers instead of guessing".

## Morning Memory Sync

At the end of an overnight loop:

1. Read project registry.
2. Read PR/check status where credentials allow.
3. Summarize what changed, what passed, what failed, and what is blocked.
4. Write a vault daily note if vault is configured.
5. Display the same status in CopelandOS.

No private student data, secrets, email content, or raw provider prompts should be written to the vault.
