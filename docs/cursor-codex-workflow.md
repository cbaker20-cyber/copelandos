# Cursor and Codex Workflow

## Roles

- **Codex:** architecture, backend modules, tests, security reviews, and local-agent boundaries.
- **Cursor:** UI polish, bounded implementation tasks, automation iteration, and bug fixes.
- **CopelandOS:** creates scoped prompts and reports status; it does not merge or deploy.
- **GitHub:** source of truth for branches, PRs, checks, and review.
- **Obsidian:** durable private memory after a safe, reviewed write.

## Prompt templates

### Cursor implementation

> Inspect the repository and open PRs first. Implement only `[task]` on a branch. Read the repo task source and security rules. Add tests, run them, open a draft PR, and stop on blockers. Do not merge, deploy, send messages, commit secrets, or expand scope.

### Cursor UI

> Improve only the CopelandOS dashboard UI. Preserve API contracts, push-to-talk-only voice, visible disconnected states, mobile responsiveness, and keyboard accessibility. Run tests and visually verify localhost. Open a draft PR.

### Codex architecture

> Review the current architecture and propose the smallest modular change for `[goal]`. Keep `worker.js` canonical, enforce permission classification, add tests, and document trust boundaries. Do not create a competing backend.

### Codex security review

> Inspect the diff for secret exposure, wildcard CORS, authentication gaps, unsafe local actions, path traversal, arbitrary shell, autonomous email, and fake connection states. Report blockers with exact files and tests.

### PR review

> Inspect the actual PR patch and CI. Verify scope, tests, secrets, generated files, permission behavior, and documented limitations. Recommend merge, changes, or closure with evidence. Do not merge automatically.
