# CopelandOS MCP Integration Policy

## Policy: Allowlist-First

CopelandOS uses an **allowlist-first** policy for MCP (Model Context Protocol) servers. No MCP server is installed or activated by default. Each server must be:

1. Explicitly listed in `config/mcp-servers.json`
2. Reviewed and approved (status: `approved`)
3. Limited to specific allowed capabilities

## Why Allowlist-First?

- Prevents arbitrary code execution via untrusted MCP servers
- Maintains the security model: confirmation-required for all risky actions
- Ensures every capability is documented and auditable
- Protects against supply-chain attacks from unreviewed servers

## Registry (`config/mcp-servers.json`)

Three lists are maintained:

### `allowlistedServers` — Approved for use
Only servers on this list may be used. Each entry specifies allowed capabilities and blocked capabilities.

### `pendingReview` — Awaiting approval
These servers have been proposed but not yet reviewed. Do not install or activate them.

### `blocked` — Permanently blocked categories
These server types are blocked regardless of implementation:
- **arbitrary-shell** — No arbitrary shell execution
- **screen-control** — No screen, mouse, or keyboard automation
- **email-send** — No email sending (Gmail is draft-only)
- **package-install** — Package installation requires explicit human approval
- **deploy-control** — Deployment requires explicit human approval

## Current Allowlist

| Server | Status | Allowed Capabilities |
|---|---|---|
| `filesystem-read-only` | Approved | read_file, list_directory, stat_file |
| `cursor-task-generation` | Approved | generate_cursor_prompt, generate_codex_prompt |

## Current Pending Review

| Server | Notes |
|---|---|
| `github-supervisor` | Read-only PR/issue/CI data. Requires scoped GITHUB_TOKEN. |

## Checking Server Status

Use the API:
```
GET /api/mcp
```

Or use the `checkMcpServer(serverId)` function:
```js
import { checkMcpServer } from './src/toolRegistry.js';
const result = checkMcpServer('filesystem-read-only');
// { allowed: true, status: 'approved', server: { ... } }
```

## Adding a New MCP Server

To add a new MCP server:

1. Open `config/mcp-servers.json`
2. Add an entry to `pendingReview` with:
   - `id` — unique identifier
   - `displayName` — human-readable name
   - `description` — what it does
   - `proposedCapabilities` — what actions you want to allow
   - `blockedCapabilities` — what must remain blocked
   - `notes` — security notes and rationale
3. Open a PR for review
4. After review, move to `allowlistedServers` with `status: "approved"`

## Tool Registry

Individual tools (not just MCP servers) are also managed via `config/tools.json` and `src/toolRegistry.js`.

Tool categories:
- `read-only` — safe reads, no confirmation needed
- `draft-only` — Gmail draft creation only
- `safe-write` — vault writes with sanitization
- `confirmation-required` — medium/high risk, explicit confirmation needed
- `blocked` — permanently blocked, always return `confirmation_required`

## API Endpoint

```
GET /api/tools              — List all tools
GET /api/tools?family=gmail — List tools by family
GET /api/tools?category=blocked — List blocked tools
GET /api/mcp                — List MCP server registry
```
