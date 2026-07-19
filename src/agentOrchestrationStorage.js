/**
 * Pluggable storage for agent orchestration state.
 *
 * Persists heartbeat, execution history, blocked state, objectives, priorities,
 * ownership, and metadata. Uses Cloudflare KV when AGENT_STATE_KV is bound;
 * otherwise falls back to in-memory storage (isolate lifetime only).
 */

const AGENT_PREFIX = 'agent:';
const META_KEY = 'agent-registry:meta';
const SCHEMA_VERSION = 1;

const memoryAgents = new Map();

function agentKey(id) {
  return `${AGENT_PREFIX}${id}`;
}

export function resetAgentStorageForTests() {
  memoryAgents.clear();
}

function createMemoryStorage() {
  return {
    mode: 'memory',
    async getMeta() {
      return memoryAgents.get(META_KEY) || null;
    },
    async putMeta(meta) {
      memoryAgents.set(META_KEY, structuredClone(meta));
    },
    async getAgent(id) {
      const agent = memoryAgents.get(id);
      return agent ? structuredClone(agent) : null;
    },
    async putAgent(agent) {
      memoryAgents.set(agent.id, structuredClone(agent));
    },
    async deleteAgent(id) {
      memoryAgents.delete(id);
    },
    async listAgentIds() {
      return Array.from(memoryAgents.keys()).filter((id) => id !== META_KEY);
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
    async getAgent(id) {
      return (await kv.get(agentKey(id), 'json')) || null;
    },
    async putAgent(agent) {
      await kv.put(agentKey(agent.id), JSON.stringify(agent));
    },
    async deleteAgent(id) {
      await kv.delete(agentKey(id));
    },
    async listAgentIds() {
      const ids = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: AGENT_PREFIX, cursor });
        for (const entry of page.keys) {
          ids.push(entry.name.slice(AGENT_PREFIX.length));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return ids;
    },
  };
}

let defaultMemoryStorage = createMemoryStorage();
let degradedToMemory = false;

export function getAgentStorage(env = {}) {
  if (env.AGENT_STATE_KV && !degradedToMemory) {
    return createKvStorage(env.AGENT_STATE_KV);
  }
  return defaultMemoryStorage;
}

export function markAgentStorageDegraded() {
  degradedToMemory = true;
}

export function resetAgentStorageDegradedForTests() {
  degradedToMemory = false;
}

export function getAgentSchemaVersion() {
  return SCHEMA_VERSION;
}

export async function writeRegistryMeta(storage) {
  await storage.putMeta({
    schemaVersion: SCHEMA_VERSION,
    persistence: storage.mode,
    updatedAt: new Date().toISOString(),
  });
}

export function __setAgentStorageForTests(storage) {
  defaultMemoryStorage = storage;
}
