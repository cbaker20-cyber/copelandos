# Structured Planning Memory

Durable planning context for resumable autonomous work. Links planning history, task rationale, decisions, dependencies, and execution summaries to the agent registry and task queue.

## Architecture

```text
config/planning-memory.json       → caps and defaults (data-driven)
src/planningMemoryStorage.js      → memory or KV storage adapter
src/planningMemory.js             → planning memory logic + resume context
src/planningMemoryApi.js          → HTTP handlers
worker.js                         → routes /api/planning-memory/*
```

Integrates with:

- **Agent registry** — `links.agentId`; resume context includes agent state and recent execution history
- **Task queue** — `links.taskId`; task completion/failure auto-appends execution summaries when `task.metadata.planningMemoryId` is set
- **Idea inbox** — `links.ideaId` for future brain-pipeline linking

### Persistence modes

| Mode | Binding | Behavior |
|---|---|---|
| `memory` | None (default) | Isolate lifetime |
| `kv` | `PLANNING_MEMORY_KV` | Survives cold starts |

```bash
wrangler kv namespace create PLANNING_MEMORY
# Uncomment PLANNING_MEMORY_KV in wrangler.toml
```

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/planning-memory` | Public | List plans (filter by `status`, `agentId`, `taskId`, `ideaId`) |
| `GET /api/planning-memory/:id` | Public | Plan detail |
| `GET /api/planning-memory/resume` | Public | Resumable context for `agentId`, `taskId`, or `ideaId` |
| `GET /api/planning-memory/status` | Public | Snapshot (counts, persistence mode) |
| `POST /api/planning-memory` | Bearer | Create planning memory |
| `PATCH /api/planning-memory/:id` | Bearer | Update objective, rationale, status, links |
| `POST /api/planning-memory/:id/history` | Bearer | Append planning history entry |
| `POST /api/planning-memory/:id/decisions` | Bearer | Record a decision |
| `POST /api/planning-memory/:id/dependencies` | Bearer | Add a dependency |
| `POST /api/planning-memory/:id/executions` | Bearer | Append execution summary |

### Plan record

```json
{
  "id": "plan-abc123",
  "objective": "Implement structured planning memory",
  "rationale": "Agents need context after cold starts",
  "status": "active",
  "links": {
    "agentId": "agent-copelandos",
    "taskId": "task-xyz",
    "ideaId": null
  },
  "planningHistory": [
    {
      "id": "hist-1",
      "recordedAt": "2026-07-18T12:00:00.000Z",
      "summary": "Initial plan",
      "steps": ["Storage adapter", "API routes", "Tests"],
      "planSnapshot": {}
    }
  ],
  "decisions": [
    {
      "id": "dec-1",
      "text": "Use KV adapter pattern",
      "rationale": "Consistent with agents and task queue",
      "recordedAt": "2026-07-18T12:05:00.000Z",
      "recordedBy": "operator"
    }
  ],
  "dependencies": [
    { "type": "agent", "id": "agent-hermes-router", "description": "Router agent", "recordedAt": "..." }
  ],
  "executionSummaries": [
    {
      "id": "exec-1",
      "status": "success",
      "summary": "Tests passing",
      "source": "task",
      "linkedTaskId": "task-xyz",
      "linkedAgentId": "agent-copelandos"
    }
  ]
}
```

Valid `status` values: `active`, `completed`, `superseded`, `blocked`.

### Resume context

`GET /api/planning-memory/resume?agentId=agent-copelandos` returns:

- Current agent state and recent execution history
- Linked task status (if any)
- Active plans with resolved dependencies, decisions, planning history, and execution summaries

Use this endpoint after a cold start to restore autonomous work context.

### Task queue integration

When enqueueing a task, set `metadata.planningMemoryId` to link execution:

```json
{
  "taskType": "agent-objective",
  "objective": "Run tests",
  "assignedAgentId": "agent-copelandos",
  "metadata": { "planningMemoryId": "plan-abc123" }
}
```

Task `complete` and `fail` lifecycle events automatically append execution summaries to the linked plan.

## Migration

### Enabling KV persistence

1. `wrangler kv namespace create PLANNING_MEMORY`
2. Uncomment `PLANNING_MEMORY_KV` in `wrangler.toml`
3. Redeploy

In-memory plans are not auto-migrated. Create new plans or POST existing data after binding.

### Backwards compatibility

- New routes only; existing APIs unchanged
- `GET /api/orchestration/status` adds `planningMemory` summary and pipeline step
- `GET /api/status` adds `modules.planningMemory`

## Future extension points

1. **Auto-link from idea inbox** — create planning memory when ideas are planned
2. **Vault export** — write plan snapshots to Obsidian for human review
3. **Dispatch loop** — supervisor reads resume context before assigning work

## Security

- Mutations require `API_AUTH_TOKEN` (fail-closed)
- Public reads expose planning metadata only
- No secrets in plan payloads

See [auth-model.md](auth-model.md).
