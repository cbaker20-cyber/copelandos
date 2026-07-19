/**
 * Structured planning memory — durable plans linked to agents, tasks, and execution.
 *
 * Persists reasoning summaries, planning history, completed/blocked objectives,
 * dependencies, and execution context for resume-after-restart autonomous work.
 */

import memoryConfig from '../config/planning-memory.json' with { type: 'json' };
import { getAgent } from './agentOrchestration.js';
import { getTask } from './taskQueue.js';
import {
  getPlanningMemoryStorage,
  resetPlanningMemoryStorageForTests,
  resetPlanningMemoryStorageDegradedForTests,
  markPlanningMemoryStorageDegraded,
  writePlanningMemoryMeta,
} from './planningMemoryStorage.js';

const VALID_STATUSES = new Set(['active', 'completed', 'superseded', 'blocked']);
const VALID_DEPENDENCY_TYPES = new Set(['agent', 'task', 'idea', 'plan']);
const MAX_OBJECTIVE_LENGTH = 2000;
const MAX_RATIONALE_LENGTH = 2000;
const MAX_TEXT_LENGTH = 1000;

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStatus(value) {
  const s = String(value || 'active').toLowerCase();
  return VALID_STATUSES.has(s) ? s : 'active';
}

function buildLinks(input = {}) {
  return {
    agentId: input.agentId || null,
    taskId: input.taskId || null,
    ideaId: input.ideaId || null,
  };
}

function normalizePlan(plan) {
  if (!plan) return plan;
  const executionContext = Array.isArray(plan.executionContext)
    ? plan.executionContext
    : (Array.isArray(plan.executionSummaries) ? plan.executionSummaries : []);
  return {
    ...plan,
    reasoningSummaries: Array.isArray(plan.reasoningSummaries) ? plan.reasoningSummaries : [],
    completedObjectives: Array.isArray(plan.completedObjectives) ? plan.completedObjectives : [],
    blockedObjectives: Array.isArray(plan.blockedObjectives) ? plan.blockedObjectives : [],
    executionContext,
    executionSummaries: Array.isArray(plan.executionSummaries) ? plan.executionSummaries : executionContext,
    decisions: Array.isArray(plan.decisions) ? plan.decisions : [],
    dependencies: Array.isArray(plan.dependencies) ? plan.dependencies : [],
    planningHistory: Array.isArray(plan.planningHistory) ? plan.planningHistory : [],
  };
}

function buildPlanRecord(input) {
  const ts = nowIso();
  const normalized = normalizePlan({
    id: input.id,
    objective: String(input.objective || '').slice(0, MAX_OBJECTIVE_LENGTH),
    rationale: String(input.rationale || '').slice(0, MAX_RATIONALE_LENGTH),
    status: normalizeStatus(input.status),
    links: buildLinks(input.links || input),
    planningHistory: input.planningHistory || [],
    reasoningSummaries: input.reasoningSummaries || [],
    completedObjectives: input.completedObjectives || [],
    blockedObjectives: input.blockedObjectives || [],
    decisions: input.decisions || [],
    dependencies: input.dependencies || [],
    executionContext: input.executionContext || input.executionSummaries || [],
    executionSummaries: input.executionSummaries || input.executionContext || [],
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    createdAt: input.createdAt || ts,
    updatedAt: input.updatedAt || ts,
  });
  return {
    ...normalized,
    planningHistory: normalized.planningHistory.slice(0, memoryConfig.defaults.maxPlanningHistory),
    reasoningSummaries: normalized.reasoningSummaries.slice(0, memoryConfig.defaults.maxReasoningSummaries),
    completedObjectives: normalized.completedObjectives.slice(0, memoryConfig.defaults.maxCompletedObjectives),
    blockedObjectives: normalized.blockedObjectives.slice(0, memoryConfig.defaults.maxBlockedObjectives),
    decisions: normalized.decisions.slice(0, memoryConfig.defaults.maxDecisions),
    dependencies: normalized.dependencies.slice(0, memoryConfig.defaults.maxDependencies),
    executionContext: normalized.executionContext.slice(0, memoryConfig.defaults.maxExecutionContext),
    executionSummaries: normalized.executionSummaries.slice(0, memoryConfig.defaults.maxExecutionSummaries),
  };
}

async function getStorage(env) {
  try {
    return getPlanningMemoryStorage(env);
  } catch {
    markPlanningMemoryStorageDegraded();
    return getPlanningMemoryStorage(env);
  }
}

async function savePlan(env, plan) {
  const storage = await getStorage(env);
  plan.updatedAt = nowIso();
  await storage.putPlan(plan);
  return { ...plan };
}

async function loadPlan(env, planId) {
  const storage = await getStorage(env);
  const plan = normalizePlan(await storage.getPlan(planId));
  if (!plan) return { ok: false, error: 'Planning memory not found', status: 404 };
  return { ok: true, plan };
}

export function resetPlanningMemoryForTests() {
  resetPlanningMemoryStorageForTests();
  resetPlanningMemoryStorageDegradedForTests();
}

export async function createPlanningMemory(env, payload) {
  const objective = String(payload?.objective || '').trim();
  if (!objective) {
    return { ok: false, error: 'objective is required', status: 400 };
  }

  const links = buildLinks({
    agentId: payload.agentId || payload.links?.agentId,
    taskId: payload.taskId || payload.links?.taskId,
    ideaId: payload.ideaId || payload.links?.ideaId,
  });

  if (links.agentId) {
    const agent = await getAgent(env, links.agentId);
    if (!agent) return { ok: false, error: 'Linked agent not found', status: 404 };
  }

  if (links.taskId) {
    const task = await getTask(env, links.taskId);
    if (!task) return { ok: false, error: 'Linked task not found', status: 404 };
  }

  const plan = buildPlanRecord({
    id: generateId('plan'),
    objective,
    rationale: payload.rationale || '',
    status: payload.status || 'active',
    links,
    metadata: payload.metadata,
  });

  if (payload.initialHistory) {
    plan.planningHistory.unshift({
      id: generateId('hist'),
      recordedAt: nowIso(),
      summary: String(payload.initialHistory.summary || 'Initial plan').slice(0, MAX_TEXT_LENGTH),
      steps: Array.isArray(payload.initialHistory.steps) ? payload.initialHistory.steps.slice(0, 20) : [],
      planSnapshot: payload.initialHistory.planSnapshot && typeof payload.initialHistory.planSnapshot === 'object'
        ? payload.initialHistory.planSnapshot
        : {},
    });
  }

  const storage = await getStorage(env);
  await savePlan(env, plan);
  await writePlanningMemoryMeta(storage);

  return { ok: true, plan: await storage.getPlan(plan.id) };
}

export async function getPlanningMemory(env, planId) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return null;
  return loaded.plan;
}

export async function listPlanningMemories(env, { status = null, agentId = null, taskId = null, ideaId = null, limit = 50 } = {}) {
  const storage = await getStorage(env);
  const ids = await storage.listPlanIds();
  const plans = [];

  for (const id of ids) {
    const plan = await storage.getPlan(id);
    if (!plan) continue;
    if (status && plan.status !== status) continue;
    if (agentId && plan.links.agentId !== agentId) continue;
    if (taskId && plan.links.taskId !== taskId) continue;
    if (ideaId && plan.links.ideaId !== ideaId) continue;
    plans.push(plan);
  }

  plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return plans.slice(0, Math.min(Math.max(1, limit), 100));
}

export async function updatePlanningMemory(env, planId, patch) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const plan = loaded.plan;

  if (patch.objective !== undefined) {
    const objective = String(patch.objective).trim();
    if (!objective) return { ok: false, error: 'objective cannot be empty', status: 400 };
    plan.objective = objective.slice(0, MAX_OBJECTIVE_LENGTH);
  }

  if (patch.rationale !== undefined) {
    plan.rationale = String(patch.rationale).slice(0, MAX_RATIONALE_LENGTH);
  }

  if (patch.status !== undefined) {
    const nextStatus = normalizeStatus(patch.status);
    if (nextStatus === 'completed' && plan.status !== 'completed') {
      plan.completedObjectives.unshift({
        id: generateId('obj-done'),
        objective: plan.objective,
        summary: patch.completionSummary ? String(patch.completionSummary).slice(0, MAX_TEXT_LENGTH) : null,
        completedAt: nowIso(),
      });
      if (plan.completedObjectives.length > memoryConfig.defaults.maxCompletedObjectives) {
        plan.completedObjectives.length = memoryConfig.defaults.maxCompletedObjectives;
      }
    }
    if (nextStatus === 'blocked' && plan.status !== 'blocked') {
      plan.blockedObjectives.unshift({
        id: generateId('obj-blocked'),
        objective: plan.objective,
        reason: patch.blockedReason ? String(patch.blockedReason).slice(0, MAX_TEXT_LENGTH) : null,
        blockedAt: nowIso(),
      });
      if (plan.blockedObjectives.length > memoryConfig.defaults.maxBlockedObjectives) {
        plan.blockedObjectives.length = memoryConfig.defaults.maxBlockedObjectives;
      }
    }
    plan.status = nextStatus;
  }

  if (patch.links !== undefined && typeof patch.links === 'object') {
    plan.links = buildLinks({ ...plan.links, ...patch.links });
  }

  if (patch.metadata !== undefined && typeof patch.metadata === 'object') {
    plan.metadata = { ...plan.metadata, ...patch.metadata };
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved };
}

export async function appendPlanningHistory(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const plan = loaded.plan;
  const entry = {
    id: generateId('hist'),
    recordedAt: nowIso(),
    summary: String(payload?.summary || 'Plan updated').slice(0, MAX_TEXT_LENGTH),
    steps: Array.isArray(payload?.steps) ? payload.steps.slice(0, 20).map((s) => String(s).slice(0, 500)) : [],
    planSnapshot: payload?.planSnapshot && typeof payload.planSnapshot === 'object' ? payload.planSnapshot : {},
  };

  plan.planningHistory.unshift(entry);
  if (plan.planningHistory.length > memoryConfig.defaults.maxPlanningHistory) {
    plan.planningHistory.length = memoryConfig.defaults.maxPlanningHistory;
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, entry };
}

export async function addPlanningDecision(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const text = String(payload?.text || '').trim();
  if (!text) return { ok: false, error: 'decision text is required', status: 400 };

  const plan = loaded.plan;
  const decision = {
    id: generateId('dec'),
    text: text.slice(0, MAX_TEXT_LENGTH),
    rationale: payload?.rationale ? String(payload.rationale).slice(0, MAX_TEXT_LENGTH) : null,
    recordedAt: nowIso(),
    recordedBy: payload?.recordedBy ? String(payload.recordedBy).slice(0, 128) : 'operator',
  };

  plan.decisions.unshift(decision);
  plan.reasoningSummaries.unshift({
    id: generateId('reason'),
    summary: decision.text,
    recordedAt: decision.recordedAt,
    source: 'operator',
    metadata: { decisionId: decision.id, rationale: decision.rationale },
  });
  if (plan.reasoningSummaries.length > memoryConfig.defaults.maxReasoningSummaries) {
    plan.reasoningSummaries.length = memoryConfig.defaults.maxReasoningSummaries;
  }

  if (plan.decisions.length > memoryConfig.defaults.maxDecisions) {
    plan.decisions.length = memoryConfig.defaults.maxDecisions;
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, decision };
}

export async function addPlanningDependency(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const type = String(payload?.type || '').toLowerCase();
  const refId = String(payload?.id || payload?.refId || '').trim();
  if (!VALID_DEPENDENCY_TYPES.has(type) || !refId) {
    return { ok: false, error: 'dependency requires type (agent|task|idea|plan) and id', status: 400 };
  }

  const plan = loaded.plan;
  const dependency = {
    type,
    id: refId,
    description: payload?.description ? String(payload.description).slice(0, MAX_TEXT_LENGTH) : null,
    recordedAt: nowIso(),
  };

  plan.dependencies.push(dependency);
  if (plan.dependencies.length > memoryConfig.defaults.maxDependencies) {
    plan.dependencies.length = memoryConfig.defaults.maxDependencies;
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, dependency };
}

export async function appendReasoningSummary(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const summary = String(payload?.summary || '').trim();
  if (!summary) return { ok: false, error: 'summary is required', status: 400 };

  const plan = loaded.plan;
  const entry = {
    id: generateId('reason'),
    summary: summary.slice(0, MAX_TEXT_LENGTH),
    recordedAt: nowIso(),
    source: ['planner', 'agent', 'operator', 'task'].includes(payload?.source) ? payload.source : 'operator',
    metadata: payload?.metadata && typeof payload.metadata === 'object' ? { ...payload.metadata } : {},
  };

  plan.reasoningSummaries.unshift(entry);
  if (plan.reasoningSummaries.length > memoryConfig.defaults.maxReasoningSummaries) {
    plan.reasoningSummaries.length = memoryConfig.defaults.maxReasoningSummaries;
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, reasoning: entry };
}

export async function recordCompletedObjective(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const plan = loaded.plan;
  const entry = {
    id: generateId('obj-done'),
    objective: String(payload?.objective || plan.objective).slice(0, MAX_OBJECTIVE_LENGTH),
    summary: payload?.summary ? String(payload.summary).slice(0, MAX_TEXT_LENGTH) : null,
    completedAt: nowIso(),
  };

  plan.completedObjectives.unshift(entry);
  if (plan.completedObjectives.length > memoryConfig.defaults.maxCompletedObjectives) {
    plan.completedObjectives.length = memoryConfig.defaults.maxCompletedObjectives;
  }
  plan.status = 'completed';

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, completedObjective: entry };
}

export async function recordBlockedObjective(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const plan = loaded.plan;
  const entry = {
    id: generateId('obj-blocked'),
    objective: String(payload?.objective || plan.objective).slice(0, MAX_OBJECTIVE_LENGTH),
    reason: payload?.reason ? String(payload.reason).slice(0, MAX_TEXT_LENGTH) : 'Blocked by operator',
    blockedAt: nowIso(),
  };

  plan.blockedObjectives.unshift(entry);
  if (plan.blockedObjectives.length > memoryConfig.defaults.maxBlockedObjectives) {
    plan.blockedObjectives.length = memoryConfig.defaults.maxBlockedObjectives;
  }
  plan.status = 'blocked';

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, blockedObjective: entry };
}

export async function appendExecutionContext(env, planId, payload) {
  const loaded = await loadPlan(env, planId);
  if (!loaded.ok) return loaded;

  const plan = loaded.plan;
  const context = {
    id: generateId('ctx'),
    recordedAt: nowIso(),
    status: ['success', 'failure', 'partial', 'running'].includes(payload?.status) ? payload.status : 'unknown',
    summary: String(payload?.summary || '').slice(0, MAX_TEXT_LENGTH),
    source: ['task', 'agent', 'manual'].includes(payload?.source) ? payload.source : 'manual',
    linkedTaskId: payload?.linkedTaskId || plan.links.taskId || null,
    linkedAgentId: payload?.linkedAgentId || plan.links.agentId || null,
    agentRunId: payload?.agentRunId || null,
    taskAttempt: Number.isFinite(payload?.taskAttempt) ? payload.taskAttempt : null,
    metadata: payload?.metadata && typeof payload.metadata === 'object' ? { ...payload.metadata } : {},
  };

  plan.executionContext.unshift(context);
  plan.executionSummaries.unshift({ ...context, id: generateId('exec') });
  if (plan.executionContext.length > memoryConfig.defaults.maxExecutionContext) {
    plan.executionContext.length = memoryConfig.defaults.maxExecutionContext;
  }
  if (plan.executionSummaries.length > memoryConfig.defaults.maxExecutionSummaries) {
    plan.executionSummaries.length = memoryConfig.defaults.maxExecutionSummaries;
  }

  const saved = await savePlan(env, plan);
  return { ok: true, plan: saved, context };
}

/** @deprecated Use appendExecutionContext — kept for backwards compatibility */
export async function appendExecutionSummary(env, planId, payload) {
  const result = await appendExecutionContext(env, planId, payload);
  if (!result.ok) return result;
  return { ok: true, plan: result.plan, summary: result.context };
}

async function resolveDependency(env, dependency) {
  const resolved = { ...dependency };
  if (dependency.type === 'agent') {
    const agent = await getAgent(env, dependency.id);
    resolved.resolved = agent
      ? { id: agent.id, name: agent.name, taskStatus: agent.taskStatus, blocked: agent.blocked }
      : null;
  } else if (dependency.type === 'task') {
    const task = await getTask(env, dependency.id);
    resolved.resolved = task
      ? { id: task.id, status: task.status, objective: task.objective }
      : null;
  } else {
    resolved.resolved = null;
  }
  return resolved;
}

export async function getResumableContext(env, { agentId = null, taskId = null, ideaId = null, includeCompleted = false } = {}) {
  if (!agentId && !taskId && !ideaId) {
    return { ok: false, error: 'agentId, taskId, or ideaId is required', status: 400 };
  }

  const allPlans = await listPlanningMemories(env, {
    agentId,
    taskId,
    ideaId,
    limit: 50,
  });

  const plans = includeCompleted
    ? allPlans.filter((p) => p.status !== 'superseded')
    : allPlans.filter((p) => p.status === 'active' || p.status === 'blocked');

  const agent = agentId ? await getAgent(env, agentId) : null;
  const task = taskId ? await getTask(env, taskId) : null;

  const enrichedPlans = [];
  const aggregated = {
    reasoningSummaries: [],
    completedObjectives: [],
    blockedObjectives: [],
    executionContext: [],
  };

  for (const rawPlan of plans) {
    const plan = normalizePlan(rawPlan);
    const dependencies = [];
    for (const dep of plan.dependencies) {
      dependencies.push(await resolveDependency(env, dep));
    }

    let linkedAgent = null;
    if (plan.links.agentId) {
      const a = await getAgent(env, plan.links.agentId);
      if (a) {
        linkedAgent = {
          id: a.id,
          name: a.name,
          taskStatus: a.taskStatus,
          objective: a.objective,
          heartbeatAt: a.heartbeatAt,
          lastSuccessfulRunAt: a.lastSuccessfulRunAt,
          recentRuns: a.executionHistory.slice(0, 5),
        };
      }
    }

    let linkedTask = null;
    if (plan.links.taskId) {
      const t = await getTask(env, plan.links.taskId);
      if (t) {
        linkedTask = {
          id: t.id,
          status: t.status,
          objective: t.objective,
          attempts: t.attempts,
          lastError: t.lastError,
        };
      }
    }

    enrichedPlans.push({
      ...plan,
      dependencies,
      linkedAgent,
      linkedTask,
    });

    aggregated.reasoningSummaries.push(...plan.reasoningSummaries.slice(0, 5));
    aggregated.completedObjectives.push(...plan.completedObjectives.slice(0, 5));
    aggregated.blockedObjectives.push(...plan.blockedObjectives.slice(0, 5));
    aggregated.executionContext.push(...plan.executionContext.slice(0, 5));
  }

  return {
    ok: true,
    resume: {
      agentId,
      taskId,
      ideaId,
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        taskStatus: agent.taskStatus,
        objective: agent.objective,
        heartbeatAt: agent.heartbeatAt,
        lastSuccessfulRunAt: agent.lastSuccessfulRunAt,
        executionHistory: agent.executionHistory.slice(0, 10),
      } : null,
      task: task ? {
        id: task.id,
        status: task.status,
        objective: task.objective,
        assignedAgentId: task.assignedAgentId,
        attempts: task.attempts,
        lastError: task.lastError,
      } : null,
      plans: enrichedPlans,
      planCount: enrichedPlans.length,
      memory: {
        reasoningSummaries: aggregated.reasoningSummaries.slice(0, 20),
        completedObjectives: aggregated.completedObjectives.slice(0, 20),
        blockedObjectives: aggregated.blockedObjectives.slice(0, 20),
        executionContext: aggregated.executionContext.slice(0, 20),
      },
      updatedAt: nowIso(),
    },
  };
}

export async function getPlanningMemorySnapshot(env) {
  const storage = await getStorage(env);
  const ids = await storage.listPlanIds();
  const byStatus = {};

  for (const id of ids) {
    const plan = await storage.getPlan(id);
    if (!plan) continue;
    byStatus[plan.status] = (byStatus[plan.status] || 0) + 1;
  }

  return {
    mode: storage.mode === 'kv' ? 'persistent-planning-memory' : 'memory-planning-memory',
    persistence: storage.mode,
    planCount: ids.length,
    byStatus,
    updatedAt: nowIso(),
  };
}

/**
 * Link task lifecycle events to planning memory when task.metadata.planningMemoryId is set.
 */
export async function syncTaskExecutionToPlanningMemory(env, task, { status, summary, error = null }) {
  const planId = task?.metadata?.planningMemoryId;
  if (!planId) return null;

  return appendExecutionContext(env, planId, {
    status: status === 'success' ? 'success' : status === 'failure' ? 'failure' : 'partial',
    summary: summary || (error ? `Task failed: ${error}` : 'Task updated'),
    source: 'task',
    linkedTaskId: task.id,
    linkedAgentId: task.assignedAgentId,
    taskAttempt: task.attempts,
    metadata: { taskStatus: task.status, taskType: task.taskType },
  });
}
