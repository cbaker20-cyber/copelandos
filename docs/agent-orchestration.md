# Agent Orchestration

Autonomous agent registry for CopelandOS. Tracks specialized agents with repository assignment, objectives, task status, execution history, heartbeat, blocked state, priority, and owner.

## Architecture

```text
config/agent-types.json           → agent type capabilities (data-driven)
config/projects.json              → bootstrap project agents on first access
src/agentOrchestrationStorage.js  → memory or KV storage adapter
src/agentOrchestration.js         → registry logic + execution history
src/agentApi.js                   → HTTP handlers
worker.js                         → routes /api/agents/*
```

### Persistence modes

| Mode | When | Behavior |
|---|---|---|
| `memory` | Default (no KV binding) | Survives warm requests within a Worker isolate; resets on cold start |
| `kv` | `AGENT_STATE_KV` bound in `wrangler.toml` | Agent state survives cold starts and deploys |

Enable KV persistence:

```bash
wrangler kv namespace create AGENT_STATE
# Add binding to wrangler.toml (see commented example)
```

### Persisted fields

Each agent record durably stores:

- `heartbeatAt` — last heartbeat timestamp
- `executionHistory` — up to 50 run entries
- `blocked` / `blockedReason` — operator block state
- `objective` — current work objective
- `priority` — `low`, `normal`, `high`, `critical`
- `owner` — responsible party
- `metadata` — extensible key-value context

### Seeded agents

On first access, the registry bootstraps:

- One `cursor` agent per project in `config/projects.json`
- One `hermes` router agent (`agent-hermes-router`)

New projects added to `config/projects.json` are synced on bootstrap (missing agents only). **Existing persisted agent state is never overwritten** by config re-seeding.

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

1. **Cold start (memory):** Registry re-seeds from `config/projects.json` and `config/agent-types.json`.
2. **Cold start (KV):** Registry loads persisted agents from KV; seeds only missing project agents.
3. **Graceful degradation:** If KV reads fail, the registry falls back to in-memory storage for the isolate lifetime.
4. **Heartbeat:** Agents should POST heartbeat on a schedule; stale heartbeats are flagged in `/api/orchestration/status` (default threshold: 15 minutes).
5. **Blocked state:** Operators can block agents without deleting them. Blocked agents keep their history.
6. **No automatic execution:** `automaticExecution` remains `false`. This registry tracks state; it does not dispatch work.

## Migration

### Enabling KV persistence

1. Create KV namespace: `wrangler kv namespace create AGENT_STATE`
2. Uncomment and fill `AGENT_STATE_KV` binding in `wrangler.toml`
3. Redeploy — first request seeds agents into KV
4. In-memory agent state from before binding is not auto-migrated (empty KV starts fresh)

### Backwards compatibility

- Existing API routes unchanged; `GET /api/orchestration/status` adds `persistence` field.
- `GET /api/status` adds `modules.orchestration.persistence`.
- Mode changes from `orchestration-registry` to `persistent-orchestration` when KV is bound.
- Clients that ignore new fields continue to work.

## Future extension points

1. **Persistent task queue** — implemented; see [task-queue.md](task-queue.md).
2. **Dispatch loop** — supervisor agent assigns objectives without hard-coded workflows.
3. **Structured planning memory** — link agent runs to idea inbox and vault notes.
4. **Health monitoring** — export heartbeat staleness and failure rates to observability tooling.

## Security

- Agent mutations require `API_AUTH_TOKEN` (same fail-closed model as other protected routes).
- Public reads expose registry metadata only; no secrets or OAuth tokens.
- CORS remains origin-restricted; it is not authentication.

See [auth-model.md](auth-model.md).
