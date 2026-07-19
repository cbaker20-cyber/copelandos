/**
 * Autonomous agent orchestration with pluggable durable storage.
 *
 * Agent state (heartbeat, execution history, blocked state, objectives,
 * priorities, ownership, metadata) persists via agentOrchestrationStorage.js.
 * Bind AGENT_STATE_KV for cross-cold-start durability. See docs/agent-orchestration.md.
 */

import agentTypesConfig from '../config/agent-types.json' with { type: 'json' };
import projectsConfig from '../config/projects.json' with { type: 'json' };
import {
  getAgentStorage,
  resetAgentStorageForTests,
  resetAgentStorageDegradedForTests,
  writeRegistryMeta,
  markAgentStorageDegraded,
} from './agentOrchestrationStorage.js';

const MAX_EXECUTION_HISTORY = 50;
const DEFAULT_HEARTBEAT_STALE_MS = 15 * 60 * 1000;

const VALID_STATUSES = new Set([
  'idle',
  'planning',
  'running',
  'blocked',
  'completed',
  'failed',
  'offline',
]);

const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);

let bootstrapComplete = false;

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizePriority(value) {
  const p = String(value || 'normal').toLowerCase();
  return VALID_PRIORITIES.has(p) ? p : 'normal';
}

function normalizeStatus(value) {
  const s = String(value || 'idle').toLowerCase();
  return VALID_STATUSES.has(s) ? s : 'idle';
}

function getAgentType(typeId) {
  return agentTypesConfig.types.find((t) => t.id === typeId) || null;
}

function projectStateToAgentStatus(state) {
  const normalized = String(state || '').toLowerCase();
  if (normalized === 'blocked' || normalized === 'paused') return 'blocked';
  if (normalized === 'archived') return 'offline';
  return 'idle';
}

function buildAgentRecord(input) {
  const type = getAgentType(input.agentType);
  const ts = nowIso();
  return {
    id: input.id,
    name: input.name,
    agentType: input.agentType,
    repository: input.repository || null,
    objective: input.objective || '',
    taskStatus: normalizeStatus(input.taskStatus),
    priority: normalizePriority(input.priority),
    owner: input.owner || type?.defaultOwner || 'platform',
    blocked: Boolean(input.blocked),
    blockedReason: input.blocked ? (input.blockedReason || null) : null,
    heartbeatAt: input.heartbeatAt || null,
    lastSuccessfulRunAt: input.lastSuccessfulRunAt || null,
    executionHistory: Array.isArray(input.executionHistory) ? input.executionHistory.slice(0, MAX_EXECUTION_HISTORY) : [],
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    createdAt: input.createdAt || ts,
    updatedAt: input.updatedAt || ts,
  };
}

function buildSeededAgents() {
  const seeded = [];

  for (const project of projectsConfig.projects || []) {
    const id = `agent-${slugify(project.id)}`;
    const projectState = project.status?.state || 'idle';
    const blocked = projectState === 'blocked';
    seeded.push(buildAgentRecord({
      id,
      name: `${project.displayName} Agent`,
      agentType: 'cursor',
      repository: project.repo || null,
      objective: project.goal || project.nextRecommendedTask || '',
      taskStatus: blocked ? 'blocked' : projectStateToAgentStatus(projectState),
      priority: project.id === 'copelandos' ? 'high' : 'normal',
      owner: 'platform',
      blocked,
      blockedReason: blocked ? 'Project marked blocked in registry' : null,
      metadata: {
        projectId: project.id,
        projectState,
        seeded: true,
      },
    }));
  }

  seeded.push(buildAgentRecord({
    id: 'agent-hermes-router',
    name: 'Hermes Router',
    agentType: 'hermes',
    repository: 'local/copeland-os',
    objective: 'Route objectives to specialized agents and automation handlers',
    taskStatus: 'idle',
    priority: 'high',
    owner: 'platform',
    metadata: { role: 'router', seeded: true },
  }));

  return seeded;
}

async function getStorage(env) {
  try {
    return getAgentStorage(env);
  } catch {
    markAgentStorageDegraded();
    return getAgentStorage(env);
  }
}

async function saveAgent(env, agent) {
  const storage = await getStorage(env);
  agent.updatedAt = nowIso();
  await storage.putAgent(agent);
  return { ...agent, executionHistory: [...agent.executionHistory] };
}

async function ensureBootstrap(env) {
  if (bootstrapComplete) return;

  let storage;
  try {
    storage = await getStorage(env);
    const existingIds = new Set(await storage.listAgentIds());
    const seeded = buildSeededAgents();

    if (existingIds.size === 0) {
      for (const agent of seeded) {
        await storage.putAgent(agent);
      }
      await writeRegistryMeta(storage);
    } else {
      for (const agent of seeded) {
        if (!existingIds.has(agent.id)) {
          await storage.putAgent(agent);
        }
      }
    }

    bootstrapComplete = true;
  } catch {
    markAgentStorageDegraded();
    storage = await getStorage(env);
    const existingIds = new Set(await storage.listAgentIds());
    if (existingIds.size === 0) {
      for (const agent of buildSeededAgents()) {
        await storage.putAgent(agent);
      }
    }
    bootstrapComplete = true;
  }
}

export function resetAgentOrchestrationForTests() {
  bootstrapComplete = false;
  resetAgentStorageForTests();
  resetAgentStorageDegradedForTests();
}

export async function bootstrapAgentOrchestration(env = {}) {
  await ensureBootstrap(env);
}

export function listAgentTypes() {
  return agentTypesConfig.types.map((t) => ({ ...t }));
}

function compareAgents(a, b) {
  const priorityRank = { critical: 0, high: 1, normal: 2, low: 3 };
  const pa = priorityRank[a.priority] ?? 2;
  const pb = priorityRank[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
}

export async function listAgents(env = {}, { includeOffline = true } = {}) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const ids = await storage.listAgentIds();
  const rows = [];

  for (const id of ids) {
    const agent = await storage.getAgent(id);
    if (!agent) continue;
    if (!includeOffline && agent.taskStatus === 'offline') continue;
    rows.push({ ...agent, executionHistory: [...agent.executionHistory] });
  }

  return rows.sort(compareAgents);
}

export async function getAgent(env, agentId) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const agent = await storage.getAgent(agentId);
  if (!agent) return null;
  return { ...agent, executionHistory: [...agent.executionHistory] };
}

export async function registerAgent(env, payload) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);

  const agentType = String(payload?.agentType || '').trim();
  if (!getAgentType(agentType)) {
    return { ok: false, error: 'Unknown agent type', status: 400 };
  }

  const name = String(payload?.name || '').trim();
  if (!name) {
    return { ok: false, error: 'name is required', status: 400 };
  }

  const id = String(payload?.id || `agent-${slugify(name)}-${Date.now().toString(36)}`).trim();
  if (await storage.getAgent(id)) {
    return { ok: false, error: 'Agent id already exists', status: 409 };
  }

  const record = buildAgentRecord({
    id,
    name,
    agentType,
    repository: payload.repository ?? null,
    objective: payload.objective ?? '',
    taskStatus: payload.taskStatus ?? 'idle',
    priority: payload.priority ?? 'normal',
    owner: payload.owner,
    blocked: payload.blocked ?? false,
    blockedReason: payload.blockedReason ?? null,
    metadata: payload.metadata ?? {},
  });

  const saved = await saveAgent(env, record);
  return { ok: true, agent: saved };
}

export async function updateAgent(env, agentId, patch) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const existing = await storage.getAgent(agentId);
  if (!existing) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }

  if (patch.agentType !== undefined) {
    if (!getAgentType(patch.agentType)) {
      return { ok: false, error: 'Unknown agent type', status: 400 };
    }
    existing.agentType = patch.agentType;
  }

  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) return { ok: false, error: 'name cannot be empty', status: 400 };
    existing.name = name;
  }

  if (patch.repository !== undefined) existing.repository = patch.repository;
  if (patch.objective !== undefined) existing.objective = String(patch.objective);
  if (patch.taskStatus !== undefined) existing.taskStatus = normalizeStatus(patch.taskStatus);
  if (patch.priority !== undefined) existing.priority = normalizePriority(patch.priority);
  if (patch.owner !== undefined) existing.owner = String(patch.owner).trim() || existing.owner;
  if (patch.metadata !== undefined && typeof patch.metadata === 'object') {
    existing.metadata = { ...existing.metadata, ...patch.metadata };
  }

  if (patch.blocked !== undefined) {
    existing.blocked = Boolean(patch.blocked);
    if (!existing.blocked) {
      existing.blockedReason = null;
      if (existing.taskStatus === 'blocked') {
        existing.taskStatus = 'idle';
      }
    }
  }

  if (patch.blockedReason !== undefined && existing.blocked) {
    existing.blockedReason = patch.blockedReason ? String(patch.blockedReason) : null;
  }

  const saved = await saveAgent(env, existing);
  return { ok: true, agent: saved };
}

export async function recordAgentHeartbeat(env, agentId, payload = {}) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const existing = await storage.getAgent(agentId);
  if (!existing) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }

  const ts = nowIso();
  existing.heartbeatAt = ts;

  if (payload.taskStatus !== undefined) {
    existing.taskStatus = normalizeStatus(payload.taskStatus);
  } else if (!existing.blocked && existing.taskStatus === 'offline') {
    existing.taskStatus = 'idle';
  }

  if (payload.objective !== undefined) {
    existing.objective = String(payload.objective);
  }

  if (payload.metadata !== undefined && typeof payload.metadata === 'object') {
    existing.metadata = { ...existing.metadata, ...payload.metadata };
  }

  const saved = await saveAgent(env, existing);
  return { ok: true, agent: saved };
}

function appendExecution(agent, entry) {
  const record = {
    id: entry.id || `run-${Date.now().toString(36)}`,
    startedAt: entry.startedAt || nowIso(),
    finishedAt: entry.finishedAt || nowIso(),
    status: entry.status === 'success' ? 'success' : entry.status === 'failure' ? 'failure' : 'unknown',
    summary: entry.summary ? String(entry.summary).slice(0, 500) : '',
    error: entry.error ? String(entry.error).slice(0, 500) : null,
    metadata: entry.metadata && typeof entry.metadata === 'object' ? { ...entry.metadata } : {},
  };

  agent.executionHistory.unshift(record);
  if (agent.executionHistory.length > MAX_EXECUTION_HISTORY) {
    agent.executionHistory.length = MAX_EXECUTION_HISTORY;
  }

  if (record.status === 'success') {
    agent.lastSuccessfulRunAt = record.finishedAt;
    if (!agent.blocked && agent.taskStatus !== 'running') {
      agent.taskStatus = 'idle';
    }
  } else if (record.status === 'failure' && !agent.blocked) {
    agent.taskStatus = 'failed';
  }

  return record;
}

export async function recordAgentRun(env, agentId, payload) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const existing = await storage.getAgent(agentId);
  if (!existing) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }

  const run = appendExecution(existing, payload || {});
  const saved = await saveAgent(env, existing);
  return { ok: true, agent: saved, run };
}

export async function blockAgent(env, agentId, reason) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const existing = await storage.getAgent(agentId);
  if (!existing) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }

  existing.blocked = true;
  existing.blockedReason = reason ? String(reason).slice(0, 500) : 'Blocked by operator';
  existing.taskStatus = 'blocked';

  const saved = await saveAgent(env, existing);
  return { ok: true, agent: saved };
}

export async function unblockAgent(env, agentId) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const existing = await storage.getAgent(agentId);
  if (!existing) {
    return { ok: false, error: 'Agent not found', status: 404 };
  }

  existing.blocked = false;
  existing.blockedReason = null;
  if (existing.taskStatus === 'blocked') {
    existing.taskStatus = 'idle';
  }

  const saved = await saveAgent(env, existing);
  return { ok: true, agent: saved };
}

export async function getOrchestrationSnapshot(env = {}, { heartbeatStaleMs = DEFAULT_HEARTBEAT_STALE_MS } = {}) {
  await ensureBootstrap(env);
  const storage = await getStorage(env);
  const all = await listAgents(env);
  const now = Date.now();
  const staleThreshold = now - heartbeatStaleMs;

  const enriched = all.map((agent) => {
    const heartbeatStale =
      agent.heartbeatAt != null && new Date(agent.heartbeatAt).getTime() < staleThreshold;
    const heartbeatMissing = agent.heartbeatAt == null && agent.agentType !== 'hermes';
    return {
      ...agent,
      health: {
        heartbeatStale,
        heartbeatMissing,
        blocked: agent.blocked,
        lastSuccessfulRunAt: agent.lastSuccessfulRunAt,
      },
    };
  });

  const byStatus = {};
  for (const agent of enriched) {
    byStatus[agent.taskStatus] = (byStatus[agent.taskStatus] || 0) + 1;
  }

  return {
    mode: storage.mode === 'kv' ? 'persistent-orchestration' : 'orchestration-registry',
    persistence: storage.mode,
    agentCount: enriched.length,
    blockedCount: enriched.filter((a) => a.blocked).length,
    staleHeartbeatCount: enriched.filter((a) => a.health.heartbeatStale || a.health.heartbeatMissing).length,
    byStatus,
    agents: enriched,
    agentTypes: listAgentTypes(),
    heartbeatStaleMs,
    updatedAt: nowIso(),
  };
}
