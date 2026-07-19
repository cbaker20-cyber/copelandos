# Dream Integrations

This document records the long-term integration map without implying that the integrations are connected today. The source of truth for machine-readable status is `config/integrations.json` and `src/integrationRegistry.js`.

## Current boundary

- CopelandOS can capture ideas, classify them, plan next steps, route providers, prepare prompts, and write safe vault previews.
- External integrations remain disconnected unless a future PR adds credentials, a live read-only probe, tests, and explicit status handling.
- Gmail remains draft-only. No route may send email.
- GitHub, PR, deploy, local computer, shell, MCP install, and screen-control actions are not automatic.

## Target loop

1. Capture from phone, Siri Shortcut, share sheet, or dashboard.
2. Store in the CopelandOS idea inbox.
3. Classify risk, project, and skill.
4. Draft a reviewable plan.
5. Route to a configured provider or local fallback when needed.
6. Check tool/MCP permission before any action.
7. Save approved memory to Obsidian-compatible vault storage.
8. Generate scoped Cursor/Codex prompts.
9. Prepare draft PRs only after tests and review notes exist.
10. Report morning status back inside CopelandOS.

## Fail-closed requirements

- `connected` must stay `false` for scaffold-only entries.
- Presence of an environment variable means `configured`, not connected.
- Unknown integration IDs fail closed.
- Any integration that would send, merge, deploy, delete, install, run shell, or control the screen remains blocked until a separate reviewed design exists.
