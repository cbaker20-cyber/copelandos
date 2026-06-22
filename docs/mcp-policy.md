# CopelandOS MCP Integration Policy

## Core principle: allowlist-first

No MCP server may be installed or activated without being explicitly listed in `config/mcp-servers.json` and reviewed by a human. Random or auto-discovered MCP servers are never permitted.

## Registry (`config/mcp-servers.json`)

The MCP server registry contains the allowlist of approved servers. Each entry specifies:
- `id` — unique identifier
- `displayName` — human-readable name
- `package` — npm package name
- `status` — `allowed`, `allowed-with-confirmation`, `scaffold-only`, or `blocked`
- `riskLevel` — `safe`, `medium`, or `high`
- `allowedOperations` — explicit list of permitted operations
- `blockedOperations` — explicit list of blocked operations
- `requiredConfig` — environment variables or config needed
- `note` — human-readable context

## Server statuses

| Status | Meaning |
|---|---|
| `allowed` | Permitted with no additional confirmation for listed operations |
| `allowed-with-confirmation` | Permitted but requires explicit human confirmation |
| `scaffold-only` | Architecture defined; not active in this deployment |
| `blocked` | Never permitted; listed only for documentation |

## Current registry

| Server | Status | Risk |
|---|---|---|
| Filesystem (read-only) | allowed | safe |
| GitHub MCP | allowed-with-confirmation | medium |
| Obsidian MCP | scaffold-only | safe |
| Web Search MCP | scaffold-only | safe |
| CopelandOS Local Agent MCP | scaffold-only | medium |

## Permanently blocked patterns

These patterns are never permitted regardless of server status:
- Any server not in this registry
- Any server allowing arbitrary shell execution
- Any server allowing file deletion
- Any server allowing screen/mouse/keyboard control
- Any server requiring root/admin privileges
- Any server that sends email without human review

## Tool registry (`config/tools.json`)

Individual tools within servers also have an explicit allowlist. See the tool registry for per-tool allowed and blocked actions.

High-risk blocked tools and actions return `confirmation_required` with `blocked: true`; confirmation is a stop signal, not permission to execute. Action routes that can touch the local agent consult this registry in addition to the permission engine.

## Adding a new MCP server

1. Research the server's capabilities and risks
2. Add it to `config/mcp-servers.json` with status `scaffold-only`
3. Open a PR with the reasoning and risk assessment
4. Get human review
5. Upgrade status to `allowed` or `allowed-with-confirmation` if approved
6. Update tests

Never install an MCP server before completing this process.

## API

- `GET /api/mcp/registry` — List all registered MCP servers
- `POST /api/mcp/check` — Check if a server/operation is permitted
- `GET /api/tools` — List all tools with categories
- `POST /api/tools/check` — Check if a tool action is permitted
