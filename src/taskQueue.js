/**
 * Persistent task queue with retries, dead-letter handling, and agent assignment.
 *
 * Storage is pluggable via taskQueueStorage.js (KV when TASK_QUEUE_KV is bound).
 * Task types and retry defaults come from config/task-queue.json.
 */

import queueConfig from '../config/task-queue.json' with { type: 'json' };
import { getAgent, recordAgentRun } from './agentOrchestration.js';
import { getTaskQueueStorage, resetTaskQueueStorageForTests } from './taskQueueStorage.js';

const VALID_STATUSES = new Set([
  'pending',
  'claimed',
  'running',
  'completed',
  'failed',
  'dead_letter',
  'cancelled',
]);

const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);
const MAX_OBJECTIVE_LENGTH = 2000;
const MAX_ERROR_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const ACTIVE_STATUSES = new Set(['pending', 'claimed', 'running']);

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `task-${crypto.randomUUID()}`;
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePriority(value) {
  const p = String(value || 'normal').toLowerCase();
  return VALID_PRIORITIES.has(p) ? p : 'normal';
}

function getTaskType(typeId) {
  return queueConfig.taskTypes.find((t) => t.id === typeId) || null;
}

function priorityRank(priority) {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority] ?? 2;
}

function computeRetryDelayMs(attempts) {
  const base = queueConfig.defaults.baseRetryDelayMs;
  const max = queueConfig.defaults.maxRetryDelayMs;
  const delay = base * (2 ** Math.max(0, attempts - 1));
  return Math.min(delay, max);
}

function buildTaskRecord(input) {
  const ts = nowIso();
  const maxAttempts = Number.isFinite(input.maxAttempts)
    ? Math.max(1, Math.min(10, input.maxAttempts))
    : queueConfig.defaults.maxAttempts;

  return {
    id: input.id,
    taskType: input.taskType,
    objective: String(input.objective || '').slice(0, MAX_OBJECTIVE_LENGTH),
    assignedAgentId: input.assignedAgentId || null,
    priority: normalizePriority(input.priority),
    status: input.status || 'pending',
    attempts: input.attempts ?? 0,
    maxAttempts,
    nextRetryAt: input.nextRetryAt || null,
    lastError: input.lastError || null,
    idempotencyKey: input.idempotencyKey || null,
    result: input.result ?? null,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    claimedAt: input.claimedAt || null,
    completedAt: input.completedAt || null,
    createdAt: input.createdAt || ts,
    updatedAt: input.updatedAt || ts,
  };
}

async function saveTask(env, task) {
  const storage = getTaskQueueStorage(env);
  task.updatedAt = nowIso();
  await storage.putTask(task);
  return { ...task };
}

export function resetTaskQueueForTests() {
  resetTaskQueueStorageForTests();
}

export function listTaskTypes() {
  return queueConfig.taskTypes.map((t) => ({ ...t }));
}

export async function enqueueTask(env, payload) {
  const storage = getTaskQueueStorage(env);
  const taskType = String(payload?.taskType || '').trim();
  if (!getTaskType(taskType)) {
    return { ok: false, error: 'Unknown task type', status: 400 };
  }

  const objective = String(payload?.objective || '').trim();
  if (!objective) {
    return { ok: false, error: 'objective is required', status: 400 };
  }

  const idempotencyKey = payload?.idempotencyKey
    ? String(payload.idempotencyKey).trim().slice(0, MAX_IDEMPOTENCY_KEY_LENGTH)
    : null;

  if (idempotencyKey) {
    const existingId = await storage.getTaskIdByIdempotencyKey(idempotencyKey);
    if (existingId) {
      const existing = await storage.getTask(existingId);
      if (existing && ACTIVE_STATUSES.has(existing.status)) {
        return { ok: true, task: existing, deduplicated: true };
      }
    }
  }

  if (payload?.assignedAgentId) {
    const agent = getAgent(payload.assignedAgentId);
    if (!agent) {
      return { ok: false, error: 'Assigned agent not found', status: 404 };
    }
    if (agent.blocked) {
      return { ok: false, error: 'Assigned agent is blocked', status: 409 };
    }
  }

  const task = buildTaskRecord({
    id: generateId(),
    taskType,
    objective,
    assignedAgentId: payload.assignedAgentId || null,
    priority: payload.priority,
    maxAttempts: payload.maxAttempts,
    idempotencyKey,
    metadata: payload.metadata,
  });

  await saveTask(env, task);
  return { ok: true, task };
}

export async function getTask(env, taskId) {
  const task = await getTaskQueueStorage(env).getTask(taskId);
  return task ? { ...task } : null;
}

export async function listTasks(env, { status = null, assignedAgentId = null, limit = 50 } = {}) {
  const storage = getTaskQueueStorage(env);
  const ids = await storage.listTaskIds();
  const tasks = [];

  for (const id of ids) {
    const task = await storage.getTask(id);
    if (!task) continue;
    if (status && task.status !== status) continue;
    if (assignedAgentId && task.assignedAgentId !== assignedAgentId) continue;
    tasks.push(task);
  }

  tasks.sort((a, b) => {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pa - pb;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const capped = tasks.slice(0, Math.min(Math.max(1, limit), 100));
  return capped.map((t) => ({ ...t }));
}

async function loadMutableTask(env, taskId) {
  const task = await getTaskQueueStorage(env).getTask(taskId);
  if (!task) return { ok: false, error: 'Task not found', status: 404 };
  return { ok: true, task };
}

export async function claimTask(env, taskId, payload = {}) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (!['pending', 'failed'].includes(task.status)) {
    return { ok: false, error: `Task cannot be claimed from status: ${task.status}`, status: 409 };
  }

  if (task.nextRetryAt && new Date(task.nextRetryAt).getTime() > Date.now()) {
    return { ok: false, error: 'Task is waiting for retry window', status: 409 };
  }

  const agentId = payload.agentId || task.assignedAgentId;
  if (!agentId) {
    return { ok: false, error: 'agentId is required to claim task', status: 400 };
  }

  const agent = getAgent(agentId);
  if (!agent) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }
  if (agent.blocked) {
    return { ok: false, error: 'Agent is blocked', status: 409 };
  }

  task.assignedAgentId = agentId;
  task.status = 'claimed';
  task.claimedAt = nowIso();
  task.attempts += 1;
  task.lastError = null;

  const saved = await saveTask(env, task);
  return { ok: true, task: saved };
}

export async function startTask(env, taskId, payload = {}) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (!['claimed', 'pending'].includes(task.status)) {
    return { ok: false, error: `Task cannot start from status: ${task.status}`, status: 409 };
  }

  if (payload.agentId && task.assignedAgentId && payload.agentId !== task.assignedAgentId) {
    return { ok: false, error: 'Task is assigned to a different agent', status: 409 };
  }

  task.status = 'running';
  if (!task.claimedAt) task.claimedAt = nowIso();
  const saved = await saveTask(env, task);
  return { ok: true, task: saved };
}

export async function completeTask(env, taskId, payload = {}) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (!['claimed', 'running'].includes(task.status)) {
    return { ok: false, error: `Task cannot complete from status: ${task.status}`, status: 409 };
  }

  task.status = 'completed';
  task.completedAt = nowIso();
  task.result = payload.result ?? { summary: payload.summary ? String(payload.summary).slice(0, 500) : 'completed' };
  task.lastError = null;
  task.nextRetryAt = null;

  const saved = await saveTask(env, task);

  if (task.assignedAgentId) {
    recordAgentRun(task.assignedAgentId, {
      status: 'success',
      summary: `Task ${task.id} completed`,
      metadata: { taskId: task.id, taskType: task.taskType },
    });
  }

  return { ok: true, task: saved };
}

export async function failTask(env, taskId, payload = {}) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (!['claimed', 'running'].includes(task.status)) {
    return { ok: false, error: `Task cannot fail from status: ${task.status}`, status: 409 };
  }

  const errorMessage = payload.error ? String(payload.error).slice(0, MAX_ERROR_LENGTH) : 'Task failed';
  task.lastError = errorMessage;

  if (task.attempts >= task.maxAttempts) {
    task.status = 'dead_letter';
    task.nextRetryAt = null;
  } else {
    task.status = 'failed';
    const delayMs = computeRetryDelayMs(task.attempts);
    task.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
  }

  const saved = await saveTask(env, task);

  if (task.assignedAgentId) {
    recordAgentRun(task.assignedAgentId, {
      status: 'failure',
      summary: `Task ${task.id} failed`,
      error: errorMessage,
      metadata: { taskId: task.id, taskType: task.taskType, attempts: task.attempts },
    });
  }

  return { ok: true, task: saved, willRetry: task.status === 'failed' };
}

export async function cancelTask(env, taskId, payload = {}) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (['completed', 'cancelled'].includes(task.status)) {
    return { ok: false, error: `Task cannot be cancelled from status: ${task.status}`, status: 409 };
  }

  task.status = 'cancelled';
  task.completedAt = nowIso();
  task.lastError = payload.reason ? String(payload.reason).slice(0, MAX_ERROR_LENGTH) : null;
  task.nextRetryAt = null;

  const saved = await saveTask(env, task);
  return { ok: true, task: saved };
}

export async function retryTask(env, taskId) {
  const loaded = await loadMutableTask(env, taskId);
  if (!loaded.ok) return loaded;

  const task = loaded.task;
  if (!['failed', 'dead_letter'].includes(task.status)) {
    return { ok: false, error: `Task cannot be retried from status: ${task.status}`, status: 409 };
  }

  task.status = 'pending';
  task.nextRetryAt = null;
  task.lastError = null;
  task.claimedAt = null;
  task.completedAt = null;
  task.result = null;

  const saved = await saveTask(env, task);
  return { ok: true, task: saved };
}

export async function getQueueSnapshot(env) {
  const storage = getTaskQueueStorage(env);
  const ids = await storage.listTaskIds();
  const byStatus = {};
  let retryScheduled = 0;

  for (const id of ids) {
    const task = await storage.getTask(id);
    if (!task) continue;
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    if (task.status === 'failed' && task.nextRetryAt) retryScheduled += 1;
  }

  return {
    mode: storage.mode === 'kv' ? 'persistent-queue' : 'memory-queue',
    persistence: storage.mode,
    taskCount: ids.length,
    byStatus,
    retryScheduled,
    taskTypes: listTaskTypes(),
    defaults: { ...queueConfig.defaults },
    updatedAt: nowIso(),
  };
}
