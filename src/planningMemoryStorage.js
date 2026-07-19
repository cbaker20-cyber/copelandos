/**
 * Pluggable storage for structured planning memory.
 *
 * Uses Cloudflare KV when PLANNING_MEMORY_KV is bound; otherwise in-memory.
 */

const PLAN_PREFIX = 'plan:';
const META_KEY = 'planning-memory:meta';
const SCHEMA_VERSION = 1;

const memoryPlans = new Map();

function planKey(id) {
  return `${PLAN_PREFIX}${id}`;
}

export function resetPlanningMemoryStorageForTests() {
  memoryPlans.clear();
}

function createMemoryStorage() {
  return {
    mode: 'memory',
    async getMeta() {
      return memoryPlans.get(META_KEY) || null;
    },
    async putMeta(meta) {
      memoryPlans.set(META_KEY, structuredClone(meta));
    },
    async getPlan(id) {
      const plan = memoryPlans.get(id);
      return plan ? structuredClone(plan) : null;
    },
    async putPlan(plan) {
      memoryPlans.set(plan.id, structuredClone(plan));
    },
    async deletePlan(id) {
      memoryPlans.delete(id);
    },
    async listPlanIds() {
      return Array.from(memoryPlans.keys()).filter((id) => id !== META_KEY);
    },
  };
}

function createKvStorage(kv) {
  return {
    mode: 'kv',
    async getMeta() {
      return (await kv.get(META_KEY, 'json')) || null;
    },
    async putMeta(meta) {
      await kv.put(META_KEY, JSON.stringify(meta));
    },
    async getPlan(id) {
      return (await kv.get(planKey(id), 'json')) || null;
    },
    async putPlan(plan) {
      await kv.put(planKey(plan.id), JSON.stringify(plan));
    },
    async deletePlan(id) {
      await kv.delete(planKey(id));
    },
    async listPlanIds() {
      const ids = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: PLAN_PREFIX, cursor });
        for (const entry of page.keys) {
          ids.push(entry.name.slice(PLAN_PREFIX.length));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return ids;
    },
  };
}

let defaultMemoryStorage = createMemoryStorage();
let degradedToMemory = false;

export function getPlanningMemoryStorage(env = {}) {
  if (env.PLANNING_MEMORY_KV && !degradedToMemory) {
    return createKvStorage(env.PLANNING_MEMORY_KV);
  }
  return defaultMemoryStorage;
}

export function markPlanningMemoryStorageDegraded() {
  degradedToMemory = true;
}

export function resetPlanningMemoryStorageDegradedForTests() {
  degradedToMemory = false;
}

export function getPlanningMemorySchemaVersion() {
  return SCHEMA_VERSION;
}

export async function writePlanningMemoryMeta(storage) {
  await storage.putMeta({
    schemaVersion: SCHEMA_VERSION,
    persistence: storage.mode,
    updatedAt: new Date().toISOString(),
  });
}
