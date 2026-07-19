import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resetTaskQueueForTests,
  enqueueTask,
  getTask,
  listTasks,
  claimTask,
  startTask,
  completeTask,
  failTask,
  cancelTask,
  retryTask,
  getQueueSnapshot,
  listTaskTypes,
} from '../src/taskQueue.js';
import {
  resetTaskQueueStorageForTests,
  getTaskQueueStorage,
} from '../src/taskQueueStorage.js';
import { resetAgentOrchestrationForTests, bootstrapAgentOrchestration } from '../src/agentOrchestration.js';
import { isTaskMutationRoute } from '../src/auth.js';
import worker from '../worker.js';
import { bearerAuthHeaders, withApiAuth } from './helpers/auth.js';

function makeRequest(path, options = {}) {
  const url = `https://worker.example${path}`;
  return new Request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

function createMockKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const val = store.get(key);
      if (val == null) return null;
      if (type === 'json') return JSON.parse(val);
      return val;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix }) {
      const keys = Array.from(store.keys())
        .filter((name) => name.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

const env = {};

test.beforeEach(() => {
  resetAgentOrchestrationForTests();
  resetTaskQueueForTests();
  bootstrapAgentOrchestration();
});

test('enqueueTask validates task type and objective', async () => {
  const missingObjective = await enqueueTask(env, { taskType: 'agent-objective' });
  assert.equal(missingObjective.ok, false);

  const badType = await enqueueTask(env, { taskType: 'unknown', objective: 'do work' });
  assert.equal(badType.ok, false);

  const created = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Run npm test on copelandos',
    assignedAgentId: 'agent-copelandos',
    priority: 'high',
  });
  assert.equal(created.ok, true);
  assert.equal(created.task.status, 'pending');
  assert.equal(created.task.assignedAgentId, 'agent-copelandos');
});

test('idempotency key deduplicates active tasks', async () => {
  const first = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Deploy review',
    idempotencyKey: 'deploy-review-1',
  });
  const second = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Deploy review duplicate',
    idempotencyKey: 'deploy-review-1',
  });
  assert.equal(first.task.id, second.task.id);
  assert.equal(second.deduplicated, true);
});

test('claim, start, complete lifecycle records agent run', async () => {
  const created = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Fix failing test',
    assignedAgentId: 'agent-jazz-backend',
  });

  const claimed = await claimTask(env, created.task.id, { agentId: 'agent-jazz-backend' });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.task.status, 'claimed');
  assert.equal(claimed.task.attempts, 1);

  const started = await startTask(env, created.task.id);
  assert.equal(started.task.status, 'running');

  const completed = await completeTask(env, created.task.id, { summary: 'All tests pass' });
  assert.equal(completed.task.status, 'completed');
  assert.ok(completed.task.completedAt);
});

test('failTask schedules retry then moves to dead letter', async () => {
  const created = await enqueueTask(env, {
    taskType: 'plan-review',
    objective: 'Review security plan',
    assignedAgentId: 'agent-copelandos',
    maxAttempts: 2,
  });

  await claimTask(env, created.task.id, { agentId: 'agent-copelandos' });
  await startTask(env, created.task.id);

  const firstFail = await failTask(env, created.task.id, { error: 'timeout' });
  assert.equal(firstFail.task.status, 'failed');
  assert.ok(firstFail.task.nextRetryAt);
  assert.equal(firstFail.willRetry, true);

  await retryTask(env, created.task.id);
  await claimTask(env, created.task.id, { agentId: 'agent-copelandos' });
  await startTask(env, created.task.id);

  const secondFail = await failTask(env, created.task.id, { error: 'timeout again' });
  assert.equal(secondFail.task.status, 'dead_letter');
  assert.equal(secondFail.willRetry, false);
});

test('cancelTask stops pending work', async () => {
  const created = await enqueueTask(env, {
    taskType: 'vault-sync',
    objective: 'Sync daily note',
  });
  const cancelled = await cancelTask(env, created.task.id, { reason: 'No longer needed' });
  assert.equal(cancelled.task.status, 'cancelled');
});

test('getQueueSnapshot reports counts by status', async () => {
  await enqueueTask(env, { taskType: 'agent-objective', objective: 'Task A' });
  const created = await enqueueTask(env, { taskType: 'agent-objective', objective: 'Task B' });
  await cancelTask(env, created.task.id);

  const snapshot = await getQueueSnapshot(env);
  assert.equal(snapshot.mode, 'memory-queue');
  assert.equal(snapshot.persistence, 'memory');
  assert.ok(snapshot.byStatus.pending >= 1);
  assert.ok(snapshot.byStatus.cancelled >= 1);
});

test('KV storage adapter persists tasks across storage instances', async () => {
  const kv = createMockKv();
  const kvEnv = { TASK_QUEUE_KV: kv };

  const created = await enqueueTask(kvEnv, {
    taskType: 'agent-objective',
    objective: 'Persistent task',
  });
  assert.equal(created.ok, true);

  const storage = getTaskQueueStorage(kvEnv);
  assert.equal(storage.mode, 'kv');

  const reloaded = await storage.getTask(created.task.id);
  assert.equal(reloaded.objective, 'Persistent task');
});

test('task mutation routes require authentication', () => {
  assert.equal(isTaskMutationRoute('/api/tasks', 'POST'), true);
  assert.equal(isTaskMutationRoute('/api/tasks', 'GET'), false);
  assert.equal(isTaskMutationRoute('/api/tasks/task-1/claim', 'POST'), true);
  assert.equal(isTaskMutationRoute('/api/tasks/queue/status', 'GET'), false);
});

test('GET /api/tasks is public', async () => {
  await enqueueTask(env, { taskType: 'agent-objective', objective: 'Public list test' });
  const response = await worker.fetch(makeRequest('/api/tasks'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.tasks.length >= 1);
  assert.ok(data.taskTypes.some((t) => t.id === 'agent-objective'));
});

test('POST /api/tasks requires bearer token', async () => {
  const request = makeRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ taskType: 'agent-objective', objective: 'Denied' }),
  });
  const response = await worker.fetch(request, withApiAuth(), {});
  assert.equal(response.status, 401);
});

test('authorized enqueue and claim flow via HTTP', async () => {
  const enqueueRequest = makeRequest('/api/tasks', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({
      taskType: 'agent-objective',
      objective: 'HTTP lifecycle test',
      assignedAgentId: 'agent-copelandos',
    }),
  });
  const enqueueResponse = await worker.fetch(enqueueRequest, withApiAuth(), {});
  const enqueued = await enqueueResponse.json();
  assert.equal(enqueueResponse.status, 201);
  const taskId = enqueued.task.id;

  const claimRequest = makeRequest(`/api/tasks/${taskId}/claim`, {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ agentId: 'agent-copelandos' }),
  });
  const claimResponse = await worker.fetch(claimRequest, withApiAuth(), {});
  const claimed = await claimResponse.json();
  assert.equal(claimResponse.status, 200);
  assert.equal(claimed.task.status, 'claimed');
});

test('orchestration status includes task queue summary', async () => {
  await enqueueTask(env, { taskType: 'agent-objective', objective: 'Status test' });
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.taskQueue);
  assert.ok(data.pipeline.includes('persistent task queue'));
});

test('foundation status reports task queue module', async () => {
  const response = await worker.fetch(makeRequest('/api/status'), {}, {});
  const data = await response.json();
  assert.equal(data.modules.taskQueue.connected, true);
  assert.equal(data.modules.taskQueue.persistence, 'memory');
});

test('listTaskTypes returns configured types', () => {
  const types = listTaskTypes();
  assert.ok(types.some((t) => t.id === 'plan-review'));
});

test('blocks enqueue to blocked agent', async () => {
  const result = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Should fail',
    assignedAgentId: 'agent-connectome-perturbation',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
});

test.after(() => {
  resetTaskQueueStorageForTests();
});
