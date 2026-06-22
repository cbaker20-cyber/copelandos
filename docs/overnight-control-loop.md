# Overnight Control Loop

The overnight control loop is an autonomous project sprint pattern with strict safety boundaries. It should help CopelandOS turn captured ideas into reviewed draft PRs and morning summaries, but it must never send email, merge, deploy, delete, expose secrets, or fabricate completed work.

## Loop Goals

- Capture late-night ideas from phone, dashboard, or manual input.
- Classify and prioritize work across CopelandOS, Score Scanner, Band Council, JazzBackend, and Connectome.
- Route tasks to the right planning profile and provider if configured.
- Generate bounded Cursor/Codex prompts.
- Produce branch commits and draft PRs when repo access exists.
- Record evidence: changed files, tests run, blockers, and next steps.
- Report status back to CopelandOS in the morning.

## Safety Invariants

- CORS is not authentication.
- Gmail remains draft-only; never call the Gmail message send endpoint.
- Unknown tools and unknown MCP servers are blocked.
- Arbitrary shell is not a CopelandOS user-facing capability.
- No secrets, `.env`, `.dev.vars`, OAuth codes, API keys, real email bodies, or private student data.
- No fake provider/tool/vault/GitHub connected states.
- No claims that PDF/photo OMR, research results, or external repo PRs exist without implementation evidence.
- No automatic deploy, merge, or branch deletion.

## State Machine

```text
capture
  -> classify
  -> plan
  -> route
  -> permission-check
  -> create-memory-artifact
  -> create-agent-task
  -> implement-on-branch
  -> test
  -> open-draft-pr
  -> collect-status
  -> morning-report
```

Stop states:

- `needs-human-confirmation`: medium/high risk.
- `blocked-access`: repo, issue, push, or PR access missing.
- `blocked-safety`: secret/private data/high-risk action detected.
- `blocked-tests`: tests fail and cannot be fixed safely.
- `blocked-provenance`: research/data source missing.

## Current Repo Loop

CopelandOS can run this subset now:

1. Capture an idea.
2. Classify it.
3. Create a plan or task brief.
4. Check provider/tool/vault registry status.
5. Generate a Cursor/Codex prompt.
6. Write a mock or configured vault note.
7. Open a draft PR through the automation workflow after code changes.

## Multi-Repo Overnight Sprint Protocol

For each repo:

1. Read the issue.
2. Inspect repository structure.
3. Stay on the designated branch.
4. Make the smallest useful foundation change.
5. Add tests when code/config behavior changes.
6. Run repo-relevant checks.
7. Commit and push to the feature branch.
8. Open a draft PR with:
   - Summary.
   - What works now.
   - What is proposed/scaffolded.
   - Tests/checks run.
   - Safety notes.
   - Next steps.
9. If access is blocked, record exact evidence and do not invent work.

## Morning Report Schema

Future route: `GET /api/morning-report`.

Draft response:

```json
{
  "ok": true,
  "generatedAt": "ISO-8601",
  "summary": "One paragraph",
  "projects": [
    {
      "id": "copelandos",
      "repo": "cbaker20-cyber/copelandos",
      "status": "draft-pr-opened",
      "branch": "cursor/...",
      "draftPrUrl": "https://github.com/...",
      "checks": ["npm test", "node --check worker.js"],
      "blockers": [],
      "nextSteps": ["Review PR", "Connect persistent inbox storage"]
    }
  ],
  "capturedIdeas": [],
  "safetyEvents": [],
  "blockedRepos": []
}
```

## Dashboard Polish

Mobile-first dashboard sections:

- **Command Bar**: capture, search, ask status.
- **Overnight Status**: running/completed/blocked cards.
- **Project Rail**: repo status and latest draft PR.
- **Inbox**: idea cards with source/risk/project.
- **Provider Health**: configured/not-configured and no fake connected badges.
- **Tool Safety**: blocked high-risk actions visible by design.
- **Vault Memory**: mock vs private GitHub vault mode.
- **Morning Report**: concise evidence and next steps.

## Review Status Backfeed

Read-only GitHub collector should eventually gather:

- Draft PR URL.
- Branch name.
- Commit SHA.
- Changed files count.
- Check conclusion.
- Review comment count.
- Mergeable state as informational only.

It must not:

- Merge.
- Enable auto-merge.
- Close PRs.
- Delete branches.
- Edit labels unless explicitly requested.
- Request reviewers unless explicitly requested.

## Suggested Tests

- Integration registry route never reports `connected: true` from static config.
- Morning report redacts known secret patterns.
- Morning report omits private student data markers.
- Blocked repo is represented as `blocked-access`.
- High-risk idea cannot become an executable task.
- Draft email idea remains draft-only.
- Provider route does not call unconfigured providers.
- Tool/MCP unknown IDs fail closed.

## References

- Apple Shortcuts Share Sheet and widgets: https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios
- Obsidian Git plugin: https://github.com/Vinzent03/obsidian-git
- MCP tools security considerations: https://modelcontextprotocol.io/specification/draft/server/tools
- OpenRouter fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
- LiteLLM reliability/fallbacks: https://docs.litellm.ai/docs/proxy/reliability
