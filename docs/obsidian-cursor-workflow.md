# Obsidian and Cursor Workflow

The Obsidian/Cursor workflow turns reviewed ideas into durable notes and scoped implementation prompts. It does not run agents, merge code, deploy services, or write unreviewed content outside the configured vault path.

## Flow

1. Capture an idea in CopelandOS.
2. Review or triage the inbox item.
3. Ask the planner for next steps.
4. Convert the idea into a vault note preview or GitHub-backed vault write.
5. Generate a Cursor or Codex prompt with project boundaries and forbidden actions.
6. Open a branch and draft PR outside the CopelandOS runtime.
7. Feed test results and review status back into CopelandOS when a read-only connector exists.

## Vault boundary

- Vault writes use sanitized folders and filenames.
- Obvious secrets and private student data are blocked.
- Without `GITHUB_TOKEN` and `GITHUB_REPO`, vault writes return mock previews.
- A connected vault does not imply that any other integration is connected.

## Cursor prompt boundary

- Prompt generation is a scaffolded handoff.
- Prompts should include repo, task, safe actions, forbidden actions, tests, and review instructions.
- CopelandOS does not run Cursor tasks itself and does not mark PRs ready or merge them.

## Review return path

The future review-status integration should be read-only: PR number, branch, checks, blockers, and next human review action. It must not approve, dismiss reviews, merge, delete branches, or deploy.
