# Overnight Control Loop

This document defines the safe automation loop for overnight CopelandOS project work.

## Loop

```text
1. Capture
   phone / Siri / Shortcut / Share Sheet / dashboard

2. Inbox
   validate input, store idea, assign status

3. Classify
   deterministic rules first, AI critique later

4. Plan
   select skill, risk, roles, and human-confirmation requirements

5. Route
   choose provider or mock council with honest configured/connected state

6. Authorize
   check tool and MCP allowlists before any side effect

7. Remember
   write sanitized Obsidian note only when vault is configured

8. Queue
   generate Cursor/Codex task prompt with repo constraints

9. Implement
   branch, tests, commit, push, draft PR

10. Report
   checks, blocked items, PR links, and next steps back to CopelandOS
```

## State Machine

| State | Meaning | Allowed transitions |
|---|---|---|
| `captured` | Idea arrived in the inbox | `classified`, `dismissed` |
| `classified` | Category/risk/skill assigned | `planned`, `needs-human-review` |
| `planned` | Steps and warnings generated | `queued`, `vault-drafted`, `blocked` |
| `queued` | Cursor/Codex prompt created | `running`, `blocked` |
| `running` | Agent is implementing on a branch | `draft-pr-open`, `checks-failed`, `blocked` |
| `draft-pr-open` | Branch is pushed and PR is open | `needs-review`, `changes-requested` |
| `needs-review` | Human review required | `closed`, `blocked` |
| `blocked` | Missing access, data, provenance, or approval | `planned`, `closed` |

## Safety Invariants

- CORS is not authentication.
- Gmail is draft-only.
- No provider is marked connected without evidence.
- No MCP server is available unless listed in `config/mcp-servers.json`.
- No tool action is allowed unless listed in `config/tools.json`.
- No arbitrary shell, deploy, merge, email send, deletion, or screen control.
- No private student data is stored.
- No scientific or OMR results are claimed without source data and tests.

## Morning Report Template

```markdown
# Morning Report - YYYY-MM-DD

## Summary
- What changed:
- Draft PRs:
- Checks run:

## Project Status
| Project | Branch | PR | Checks | Blockers |
|---|---|---|---|---|
| CopelandOS | | | | |
| Score Scanner | | | | |
| Band Council | | | | |
| JazzBackend | | | | |
| Connectome | | | | |

## Safety Notes
- Secrets:
- Private data:
- Unsupported claims:

## Next Steps
- [ ] 
```

## Dashboard Requirements

- Show the control-loop stage for each active item.
- Show disconnected/configured/connected separately.
- Show blocked reasons prominently.
- Link to docs, generated prompts, and PRs.
- Keep mobile tap targets large and keyboard focus visible.
- Avoid decorative assets that imply a proprietary character or franchise.
