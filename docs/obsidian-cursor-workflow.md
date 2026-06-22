# Obsidian and Cursor Workflow

CopelandOS should connect idea capture, durable memory, and implementation prompts without turning notes into unreviewed actions. Obsidian is the private memory layer. Cursor/Codex are implementation/review agents that receive bounded prompts and open draft PRs.

## Desired Flow

```text
Captured idea
  -> classify and risk-score
  -> create plan
  -> save sanitized note or mock preview
  -> generate Cursor/Codex prompt
  -> run agent on feature branch
  -> open draft PR
  -> collect check/review status
  -> summarize in morning report
```

## Current Pieces

- `src/ideaApi.js`: captures ideas and generates prompt text for existing ideas.
- `src/planner.js`: creates plans, task briefs, Cursor prompts, and Codex prompts.
- `src/vault.js`: builds safe Markdown notes and Obsidian URIs.
- `src/foundationApi.js`: exposes vault write/open and agent prompt routes.
- `config/projects.json`: stores repo-level safe actions, forbidden actions, and forbidden claims.
- `config/integrations.json`: describes the command-center loop and which integrations are scaffolded.

## Vault Structure

Recommended private vault layout:

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
  Research/
  Music/
  Templates/
  Reports/
```

Obsidian Git references:

- https://github.com/Vinzent03/obsidian-git
- https://community.obsidian.md/plugins/obsidian-git

## Note Types

| Type | Purpose | Safe content |
|---|---|---|
| `idea` | Raw captured idea plus classification metadata | Short text, source, project, tags |
| `project` | Project update or implementation note | Public repo status, task summary, blockers |
| `decision` | Architecture/security decision log | Rationale, alternatives, safety constraints |
| `research` | Source-backed research notes | Citations, claims with provenance |
| `meeting` | Draft meeting notes | Non-private agenda and action items |
| `email` | Draft email note | Draft text only, marked `DRAFT - NOT SENT` |
| `tasks` | Checklist for a project | Repo-local tasks and review steps |

Do not store:

- API keys, tokens, OAuth codes, refresh tokens, or `.env` content.
- Real private email bodies.
- Private student data.
- Unverified research results.
- Local filesystem paths that reveal sensitive data.

## Obsidian Git Workflow

Desktop:

1. Open vault.
2. Pull before editing.
3. Write notes in bounded folders.
4. Commit and sync manually or through a reviewed plugin interval.
5. Resolve conflicts before new automation writes.

Mobile:

1. Treat mobile as capture-first.
2. Use Shortcuts to submit ideas to CopelandOS.
3. Use Obsidian mobile for reading and light edits only until sync is proven.
4. Avoid concurrent edits on the same note from phone and desktop.

CopelandOS:

1. When vault env vars are absent, return mock previews.
2. When configured, write only sanitized Markdown files.
3. Reject traversal, unsafe filenames, secrets, and private-student markers.
4. Return path and status; do not open desktop apps from the Worker.

## Cursor Prompt Lifecycle

1. Idea enters inbox with `status: new`.
2. Human reviews classification/risk.
3. Human triages to `ready-for-cursor` or `ready-for-codex`.
4. CopelandOS generates a bounded prompt containing:
   - repo.
   - project phase.
   - task.
   - constraints.
   - forbidden actions.
   - forbidden claims.
   - required tests.
5. Agent works on a branch.
6. Agent commits, pushes, and opens a draft PR.
7. CopelandOS later reads PR/check status through a read-only GitHub collector.

## Codex Prompt Lifecycle

Codex prompts should be used for:

- Architecture review.
- Security review.
- Test strategy.
- Risk lists.
- Migration planning.
- Debugging hard failures.

Codex prompts should not:

- Send mail.
- Deploy.
- Merge PRs.
- Create production credentials.
- Override project safety rules.

## Queue Data Model

Future persistent queue item:

```json
{
  "id": "task-...",
  "ideaId": "idea-...",
  "projectId": "copelandos",
  "kind": "cursor",
  "riskLevel": "safe",
  "status": "ready-for-agent",
  "prompt": "bounded prompt text",
  "branch": "cursor/...",
  "draftPrUrl": null,
  "checks": [],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Allowed statuses:

- `new`
- `triaged`
- `converted-to-note`
- `ready-for-cursor`
- `ready-for-codex`
- `draft-pr-opened`
- `checks-running`
- `needs-review`
- `blocked`
- `done`

## Morning Report Inputs

The morning report should combine:

- Ideas captured overnight.
- Tasks generated.
- Draft PR URLs.
- Check results.
- Review comments/blockers.
- Vault notes written or mock previews.
- Provider/tool/vault connection states.
- Next safe action for each project.

It must not include:

- Secrets.
- Private student details.
- Full email content.
- Claims that inaccessible repos were updated.

## Implementation Tasks

1. Persist idea inbox and task queue outside process memory.
2. Add a read-only GitHub status module for draft PR/check summaries.
3. Add `GET /api/morning-report` with safe summaries only.
4. Add dashboard queue cards and copy buttons for prompts.
5. Add vault conflict guidance and note templates.
6. Add tests proving mock vault writes do not imply live persistence.
