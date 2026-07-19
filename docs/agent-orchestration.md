# Agent Orchestration

Autonomous agent registry for CopelandOS. Tracks specialized agents with repository assignment, objectives, task status, execution history, heartbeat, blocked state, priority, and owner.

## Architecture

```text
config/agent-types.json     → agent type capabilities (data-driven)
config/projects.json        → bootstrap project agents on first access
src/agentOrchestration.js   → in-memory registry + execution history
src/agentApi.js             → HTTP handlers
worker.js                   → routes /api/agents/*
```

The registry is intentionally **in-memory** for this phase. It resets on Worker cold start. Future work should persist to KV or D1 and add a dispatch loop (see [Roadmap](#future-extension-points)).

### Seeded agents

On first access, the registry bootstraps:

- One `cursor` agent per project in `config/projects.json`
- One `hermes` router agent (`agent-hermes-router`)

No workflows are hard-coded. Agent types and project metadata come from JSON configuration.

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/agents` | Public | List agents and configured types |
| `GET /api/agents/:id` | Public | Agent detail with execution history |
| `POST /api/agents` | Bearer | Register a new agent |
| `PATCH /api/agents/:id` | Bearer | Update objective, status, priority, owner |
| `POST /api/agents/:id/heartbeat` | Bearer | Record liveness and optional status |
| `POST /api/agents/:id/runs` | Bearer | Append execution history entry |
| `POST /api/agents/:id/block` | Bearer | Block agent with optional reason |
| `POST /api/agents/:id/unblock` | Bearer | Clear blocked state |
| `GET /api/orchestration/status` | Public | Live orchestration snapshot |

Mutations require `Authorization: Bearer <API_AUTH_TOKEN>`. Reads are public (metadata only).

### Agent record

```json
{
  "id": "agent-copelandos",
  "name": "CopelandOS Agent",
  "agentType": "cursor",
  "repository": "cbaker20-cyber/copelandos",
  "objective": "Coordinate projects, drafts, memory, research, and permissioned local actions.",
  "taskStatus": "idle",
  "priority": "high",
  "owner": "platform",
  "blocked": false,
  "blockedReason": null,
  "heartbeatAt": "2026-07-18T12:00:00.000Z",
  "lastSuccessfulRunAt": "2026-07-18T11:30:00.000Z",
  "executionHistory": [],
  "metadata": { "projectId": "copelandos", "seeded": true }
}
```

Valid `taskStatus` values: `idle`, `planning`, `running`, `blocked`, `completed`, `failed`, `offline`.

Valid `priority` values: `low`, `normal`, `high`, `critical`.

### Run payload

```json
{
  "status": "success",
  "summary": "npm test passed",
  "error": null,
  "metadata": { "pr": "https://github.com/..." }
}
```

Execution history is capped at 50 entries per agent. Successful runs update `lastSuccessfulRunAt`.

## Operational behavior

1. **Cold start:** Registry re-seeds from `config/projects.json` and `config/agent-types.json`.
2. **Heartbeat:** Agents should POST heartbeat on a schedule; stale heartbeats are flagged in `/api/orchestration/status` (default threshold: 15 minutes).
3. **Blocked state:** Operators can block agents without deleting them. Blocked agents keep their history.
4. **No automatic execution:** `automaticExecution` remains `false`. This registry tracks state; it does not dispatch work.

## Migration

No database migration is required. Existing routes are backwards compatible:

- `GET /api/orchestration/status` adds `mode`, `agents`, and `agentTypes` while keeping `automaticExecution: false` and the pipeline list.
- `GET /api/status` adds `modules.orchestration`.

Clients that ignore new fields continue to work.

## Future extension points

1. **Persistent task queue** — durable queue with retries and dead-letter handling (next platform priority).
2. **KV/D1 persistence** — survive cold starts; optional sync from project registry.
3. **Dispatch loop** — supervisor agent assigns objectives without hard-coded workflows.
4. **Structured planning memory** — link agent runs to idea inbox and vault notes.
5. **Health monitoring** — export heartbeat staleness and failure rates to observability tooling.

## Security

- Agent mutations require `API_AUTH_TOKEN` (same fail-closed model as other protected routes).
- Public reads expose registry metadata only; no secrets or OAuth tokens.
- CORS remains origin-restricted; it is not authentication.

See [auth-model.md](auth-model.md).
