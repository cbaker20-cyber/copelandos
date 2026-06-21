# Tool Permissions

| Risk | Examples | Default behavior |
|---|---|---|
| SAFE | Read status, summarize, search, draft text, write bounded vault note, plan, prepare an allowlisted URL | May execute |
| MEDIUM | Create issue/draft/task, update status, run an exact allowlisted test, start configured Cursor/tunnel, open project folder | Requires explicit confirmation |
| HIGH | Send email, merge PR, delete, deploy, install, arbitrary shell, change secrets, publish, private-student access, screen/mouse/keyboard control | Return `confirmation_required`; never execute automatically |

Unknown action names are HIGH. A client-provided `confirmed: true` never overrides HIGH classification.

The local agent performs a second allowlist check after permission classification. A confirmed test action still fails unless repository ID and test ID exactly match `local-agent/allowlist.json`.
