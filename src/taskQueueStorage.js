/**
 * Pluggable storage for the task queue.
 *
 * Uses Cloudflare KV when TASK_QUEUE_KV is bound; otherwise falls back to an
 * in-memory Map (Worker isolate lifetime only). See docs/task-queue.md.
 */

const TASK_PREFIX = 'task:';
const IDEMPOTENCY_PREFIX = 'idempotency:';
const memoryTasks = new Map();
const memoryIdempotency = new Map();

function taskKey(id) {
  return `${TASK_PREFIX}${id}`;
}

function idempotencyKey(key) {
  return `${IDEMPOTENCY_PREFIX}${key}`;
}

export function resetTaskQueueStorageForTests() {
  memoryTasks.clear();
  memoryIdempotency.clear();
}

function createMemoryStorage() {
  return {
    mode: 'memory',
    async getTask(id) {
      return memoryTasks.get(id) ? structuredClone(memoryTasks.get(id)) : null;
    },
    async putTask(task) {
      memoryTasks.set(task.id, structuredClone(task));
      if (task.idempotencyKey) {
        memoryIdempotency.set(task.idempotencyKey, task.id);
      }
    },
    async deleteTask(id) {
      const existing = memoryTasks.get(id);
      memoryTasks.delete(id);
      if (existing?.idempotencyKey) {
        memoryIdempotency.delete(existing.idempotencyKey);
      }
    },
    async listTaskIds() {
      return Array.from(memoryTasks.keys());
    },
    async getTaskIdByIdempotencyKey(key) {
      return memoryIdempotency.get(key) || null;
    },
  };
}

function createKvStorage(kv) {
  return {
    mode: 'kv',
    async getTask(id) {
      const raw = await kv.get(taskKey(id), 'json');
      return raw || null;
    },
    async putTask(task) {
      await kv.put(taskKey(task.id), JSON.stringify(task));
      if (task.idempotencyKey) {
        await kv.put(idempotencyKey(task.idempotencyKey), task.id);
      }
    },
    async deleteTask(id) {
      const existing = await kv.get(taskKey(id), 'json');
      await kv.delete(taskKey(id));
      if (existing?.idempotencyKey) {
        await kv.delete(idempotencyKey(existing.idempotencyKey));
      }
    },
    async listTaskIds() {
      const ids = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: TASK_PREFIX, cursor });
        for (const entry of page.keys) {
          ids.push(entry.name.slice(TASK_PREFIX.length));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return ids;
    },
    async getTaskIdByIdempotencyKey(key) {
      return (await kv.get(idempotencyKey(key))) || null;
    },
  };
}

let defaultMemoryStorage = createMemoryStorage();

export function getTaskQueueStorage(env = {}) {
  if (env.TASK_QUEUE_KV) {
    return createKvStorage(env.TASK_QUEUE_KV);
  }
  return defaultMemoryStorage;
}

export function __setTaskQueueStorageForTests(storage) {
  defaultMemoryStorage = storage;
}
