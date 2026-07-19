# Persistent Task Queue

Durable work queue for CopelandOS autonomous operations. Tasks are assigned to orchestrated agents, support retries with exponential backoff, and move to a dead-letter state after max attempts.

## Architecture

```text
config/task-queue.json      → task types and retry defaults (data-driven)
src/taskQueueStorage.js     → memory or KV storage adapter
src/taskQueue.js            → queue logic (enqueue, claim, complete, fail, retry)
src/taskQueueApi.js         → HTTP handlers
worker.js                   → routes /api/tasks/*
```

### Persistence modes

| Mode | When | Behavior |
|---|---|---|
| `memory` | Default (no KV binding) | Survives warm requests within a Worker isolate; resets on cold start |
| `kv` | `TASK_QUEUE_KV` bound in `wrangler.toml` | Tasks survive cold starts and deploys |

Enable KV persistence:

```bash
wrangler kv namespace create TASK_QUEUE
# Add binding to wrangler.toml (see commented example)
```

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/tasks` | Public | List tasks (optional `status`, `assignedAgentId`, `limit`) |
| `GET /api/tasks/:id` | Public | Task detail |
| `GET /api/tasks/queue/status` | Public | Queue snapshot (counts, persistence mode) |
| `POST /api/tasks` | Bearer | Enqueue a task |
| `POST /api/tasks/:id/claim` | Bearer | Claim task for an agent |
| `POST /api/tasks/:id/start` | Bearer | Mark task running |
| `POST /api/tasks/:id/complete` | Bearer | Mark task completed |
| `POST /api/tasks/:id/fail` | Bearer | Record failure (retry or dead letter) |
| `POST /api/tasks/:id/cancel` | Bearer | Cancel pending/claimed task |
| `POST /api/tasks/:id/retry` | Bearer | Re-queue failed/dead-letter task |

Mutations require `Authorization: Bearer <API_AUTH_TOKEN>`.

### Task record

```json
{
  "id": "task-abc123",
  "taskType": "agent-objective",
  "objective": "Run npm test and open draft PR",
  "assignedAgentId": "agent-copelandos",
  "priority": "high",
  "status": "pending",
  "attempts": 0,
  "maxAttempts": 3,
  "nextRetryAt": null,
  "lastError": null,
  "idempotencyKey": "copelandos-test-run-1",
  "result": null,
  "metadata": {},
  "createdAt": "2026-07-18T12:00:00.000Z",
  "updatedAt": "2026-07-18T12:00:00.000Z"
}
```

Valid `status` values: `pending`, `claimed`, `running`, `completed`, `failed`, `dead_letter`, `cancelled`.

### Lifecycle

```text
enqueue → pending
pending → claim → claimed → start → running → complete → completed
running → fail → failed (retry scheduled) → retry → pending
failed/dead_letter (max attempts) → dead_letter
pending/claimed → cancel → cancelled
```

Retry delay uses exponential backoff from `config/task-queue.json` (`baseRetryDelayMs`, `maxRetryDelayMs`).

### Idempotency

`POST /api/tasks` accepts an optional `idempotencyKey`. If an active task (`pending`, `claimed`, `running`) already exists with the same key, the existing task is returned with `deduplicated: true`.

## Agent integration

- Tasks may be assigned to an agent at enqueue time or at claim time.
- `complete` and `fail` append entries to the assigned agent's execution history via the orchestration registry.
- Enqueue to a blocked agent returns `409`.

`automaticExecution` remains `false` — agents poll or are invoked externally; the queue does not auto-dispatch.

## Migration

No breaking changes:

- New routes under `/api/tasks/*`.
- `GET /api/orchestration/status` adds `taskQueue` summary and pipeline step.
- `GET /api/status` adds `modules.taskQueue`.

Existing clients that ignore new fields continue to work.

### Enabling KV persistence

1. Create KV namespace: `wrangler kv namespace create TASK_QUEUE`
2. Uncomment and fill `TASK_QUEUE_KV` binding in `wrangler.toml`
3. Redeploy — new tasks persist across cold starts
4. In-memory tasks from before binding are not migrated (empty KV starts fresh)

## Future extension points

1. **Agent state persistence (KV/D1)** — persist agent registry across cold starts.
2. **Dispatch loop** — supervisor polls queue and assigns work without hard-coded workflows.
3. **Structured planning memory** — link tasks to idea inbox and vault notes.
4. **Health monitoring** — metrics for queue depth, retry rate, dead-letter count.
5. **Scheduled reconciliation** — Cloudflare Cron Trigger to re-queue stale claimed tasks.

## Security

- Task mutations require `API_AUTH_TOKEN` (fail-closed).
- Public reads expose task metadata only; no secrets in payloads.
- Idempotency keys are operator-supplied; not authentication.

See [auth-model.md](auth-model.md).
