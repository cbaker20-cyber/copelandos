# Overnight Control Loop

The overnight loop is a safe automation pattern for ambitious project work. It can inspect issues, create branches, make scoped changes, run checks, push work, and open draft PRs. It must not merge, deploy, send email, delete files, claim unsupported results, or hide blockers.

## Loop

```text
issue queue
  -> repo access check
  -> branch check
  -> context scan
  -> scoped plan
  -> implementation/docs
  -> commit before tests
  -> tests/checks
  -> fix if needed
  -> push branch
  -> draft PR
  -> morning report
```

## Project Queue

| Project | Source issue | Safe overnight target |
|---|---:|---|
| CopelandOS | #32 | Mobile command-center docs, integration registry, provider/tool routing roadmap, tested config API |
| Score Scanner | #19 | Hardware/software blueprint only; do not claim PDF/photo OMR |
| Band Council Agent | #8 | Privacy-safe event playbook and templates |
| JazzBackend | #4 | Tests/docs plan for rhythm, chord, key, and MusicXML stability |
| Connectome Perturbation | #4 | Documentation-only provenance and methods plan |

## Repo Access Rules

- If a repo cannot be resolved by authenticated `gh` or `git ls-remote`, record the blocker instead of inventing work.
- Work only on the designated feature branch for that repo.
- Commit and push each logical unit before broader testing.
- Open draft PRs where tooling permits.
- Keep unsupported sibling-repo plans out of the primary repo unless the primary issue asks for orchestration docs.

## CopelandOS Control Surfaces

- `GET /api/status`: foundation and integration summary.
- `GET /api/projects`: project registry.
- `GET /api/integrations`: command-center integration registry.
- `POST /api/integrations/check`: integration action preflight.
- `GET /api/tools`: tool allowlist.
- `POST /api/tools/check`: tool action preflight.
- `GET /api/mcp/registry`: MCP allowlist.
- `POST /api/providers/route`: provider routing explanation.
- `POST /api/capture/idea`: inbox capture.

## Morning Report Workflow

The morning report should be generated as a draft note or dashboard panel:

1. List repo access status.
2. Link branches and draft PRs.
3. State what works now.
4. State what was scaffolded.
5. List tests/checks run.
6. List safety notes.
7. List blockers and next steps.

Do not email the report automatically. If an email is useful, create a Gmail draft only after confirmation.

## Safety Checklist

- No secrets, `.env`, `.dev.vars`, OAuth codes, or refresh tokens committed.
- No private student data stored.
- No Gmail send endpoint calls.
- No deployment commands.
- No PR merges or auto-merge.
- No arbitrary shell execution exposed to users or tools.
- No PDF/photo OMR claims for Score Scanner unless implemented and tested.
- No Connectome scientific claims without dataset/source/provenance.
- No fake provider, tool, MCP, or GitHub connection states.

## Failure Handling

If checks fail:

- Preserve the failing output in the run summary.
- Fix within the same scope when feasible.
- Re-run the relevant checks.
- If blocked by access, credentials, missing data, or external repo visibility, stop that repo's work and report the blocker clearly.
