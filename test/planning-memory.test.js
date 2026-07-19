import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resetPlanningMemoryForTests,
  createPlanningMemory,
  getPlanningMemory,
  listPlanningMemories,
  updatePlanningMemory,
  appendPlanningHistory,
  addPlanningDecision,
  addPlanningDependency,
  appendReasoningSummary,
  recordCompletedObjective,
  recordBlockedObjective,
  appendExecutionContext,
  appendExecutionSummary,
  getResumableContext,
  getPlanningMemorySnapshot,
} from '../src/planningMemory.js';
import {
  resetPlanningMemoryStorageForTests,
  getPlanningMemoryStorage,
} from '../src/planningMemoryStorage.js';
import {
  resetAgentOrchestrationForTests,
  bootstrapAgentOrchestration,
  recordAgentHeartbeat,
} from '../src/agentOrchestration.js';
import {
  resetTaskQueueForTests,
  enqueueTask,
  completeTask,
  claimTask,
  startTask,
} from '../src/taskQueue.js';
import { isPlanningMemoryMutationRoute } from '../src/auth.js';
import worker from '../worker.js';
import { bearerAuthHeaders, withApiAuth } from './helpers/auth.js';

const env = {};

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

test.beforeEach(async () => {
  resetPlanningMemoryForTests();
  resetAgentOrchestrationForTests();
  resetTaskQueueForTests();
  await bootstrapAgentOrchestration(env);
});

test('createPlanningMemory requires objective and validates links', async () => {
  const missing = await createPlanningMemory(env, {});
  assert.equal(missing.ok, false);

  const badAgent = await createPlanningMemory(env, {
    objective: 'Test plan',
    agentId: 'agent-nonexistent',
  });
  assert.equal(badAgent.ok, false);
  assert.equal(badAgent.status, 404);

  const created = await createPlanningMemory(env, {
    objective: 'Ship structured planning memory',
    rationale: 'Enable resumable autonomous work',
    agentId: 'agent-copelandos',
    initialHistory: {
      summary: 'Phase 1: storage adapter',
      steps: ['Create storage', 'Add API', 'Write tests'],
    },
  });
  assert.equal(created.ok, true);
  assert.equal(created.plan.links.agentId, 'agent-copelandos');
  assert.equal(created.plan.planningHistory.length, 1);
});

test('append history, decisions, dependencies, and execution summaries', async () => {
  const created = await createPlanningMemory(env, {
    objective: 'Full lifecycle test',
    rationale: 'Validate all persisted fields',
    agentId: 'agent-jazz-backend',
  });
  const planId = created.plan.id;

  const history = await appendPlanningHistory(env, planId, {
    summary: 'Revised approach after review',
    steps: ['Add KV adapter', 'Link task queue'],
  });
  assert.equal(history.ok, true);
  assert.equal(history.plan.planningHistory.length, 1);

  const decision = await addPlanningDecision(env, planId, {
    text: 'Use KV storage adapter pattern',
    rationale: 'Matches agent and task queue conventions',
    recordedBy: 'operator',
  });
  assert.equal(decision.ok, true);
  assert.ok(decision.decision.id);

  const dependency = await addPlanningDependency(env, planId, {
    type: 'agent',
    id: 'agent-copelandos',
    description: 'Platform agent owns orchestration',
  });
  assert.equal(dependency.ok, true);

  const execution = await appendExecutionSummary(env, planId, {
    status: 'success',
    summary: 'Storage module implemented',
    source: 'manual',
  });
  assert.equal(execution.ok, true);
  assert.equal(execution.plan.executionSummaries.length, 1);
  assert.equal(execution.plan.executionContext.length, 1);
});

test('reasoning summaries, objectives, and execution context persist', async () => {
  const created = await createPlanningMemory(env, {
    objective: 'Extended memory fields',
    agentId: 'agent-copelandos',
  });
  const planId = created.plan.id;

  const reasoning = await appendReasoningSummary(env, planId, {
    summary: 'Prioritize resume context aggregation',
    source: 'planner',
  });
  assert.equal(reasoning.ok, true);

  const decision = await addPlanningDecision(env, planId, {
    text: 'Mirror decisions into reasoning summaries',
    rationale: 'Single source for resume',
  });
  assert.equal(decision.ok, true);
  assert.ok(decision.plan.reasoningSummaries.length >= 2);

  const completed = await recordCompletedObjective(env, planId, {
    objective: 'Phase 1 complete',
    summary: 'Storage and API shipped',
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.plan.status, 'completed');
  assert.equal(completed.plan.completedObjectives.length, 1);

  const blockedPlan = await createPlanningMemory(env, {
    objective: 'Blocked follow-up',
    agentId: 'agent-copelandos',
  });
  const blocked = await recordBlockedObjective(env, blockedPlan.plan.id, {
    reason: 'Waiting on KV namespace',
  });
  assert.equal(blocked.ok, true);
  assert.equal(blocked.plan.status, 'blocked');

  const context = await appendExecutionContext(env, planId, {
    status: 'partial',
    summary: 'Docs in progress',
    source: 'agent',
    agentRunId: 'run-123',
  });
  assert.equal(context.ok, true);
  assert.equal(context.context.agentRunId, 'run-123');
});

test('status patch records completed and blocked objectives', async () => {
  const created = await createPlanningMemory(env, {
    objective: 'Auto-record on status change',
    agentId: 'agent-copelandos',
  });

  const completed = await updatePlanningMemory(env, created.plan.id, {
    status: 'completed',
    completionSummary: 'All acceptance criteria met',
  });
  assert.equal(completed.plan.completedObjectives.length, 1);
  assert.equal(completed.plan.completedObjectives[0].summary, 'All acceptance criteria met');

  const blockedPlan = await createPlanningMemory(env, {
    objective: 'Dependency blocked',
    agentId: 'agent-copelandos',
  });
  const blocked = await updatePlanningMemory(env, blockedPlan.plan.id, {
    status: 'blocked',
    blockedReason: 'Upstream agent offline',
  });
  assert.equal(blocked.plan.blockedObjectives.length, 1);
  assert.equal(blocked.plan.blockedObjectives[0].reason, 'Upstream agent offline');
});

test('normalizePlan migrates legacy executionSummaries-only records', async () => {
  const created = await createPlanningMemory(env, {
    objective: 'Legacy migration',
    agentId: 'agent-copelandos',
  });
  const storage = getPlanningMemoryStorage(env);
  const legacy = await storage.getPlan(created.plan.id);
  delete legacy.executionContext;
  delete legacy.reasoningSummaries;
  delete legacy.completedObjectives;
  delete legacy.blockedObjectives;
  await storage.putPlan(legacy);

  const reloaded = await getPlanningMemory(env, created.plan.id);
  assert.ok(Array.isArray(reloaded.executionContext));
  assert.ok(Array.isArray(reloaded.reasoningSummaries));
  assert.ok(Array.isArray(reloaded.completedObjectives));
  assert.ok(Array.isArray(reloaded.blockedObjectives));
});

test('getResumableContext links agent, task, and planning memory', async () => {
  const task = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Resume context test task',
    assignedAgentId: 'agent-copelandos',
  });

  const plan = await createPlanningMemory(env, {
    objective: 'Resume after cold start',
    rationale: 'Agent should pick up where it left off',
    agentId: 'agent-copelandos',
    taskId: task.task.id,
  });

  await addPlanningDecision(env, plan.plan.id, { text: 'Prioritize tests before deploy' });

  const resume = await getResumableContext(env, { agentId: 'agent-copelandos' });
  assert.equal(resume.ok, true);
  assert.equal(resume.resume.agent.id, 'agent-copelandos');
  assert.equal(resume.resume.plans.length, 1);
  assert.equal(resume.resume.plans[0].id, plan.plan.id);
  assert.ok(resume.resume.plans[0].linkedAgent);
  assert.ok(resume.resume.plans[0].linkedTask);
  assert.equal(resume.resume.plans[0].decisions.length, 1);
  assert.ok(resume.resume.memory);
  assert.ok(resume.resume.memory.reasoningSummaries.length >= 1);
  assert.ok(resume.resume.memory.executionContext.length >= 0);
});

test('task completion syncs execution summary when planningMemoryId is set', async () => {
  const plan = await createPlanningMemory(env, {
    objective: 'Task-linked plan',
    agentId: 'agent-copelandos',
  });

  const task = await enqueueTask(env, {
    taskType: 'agent-objective',
    objective: 'Complete with planning link',
    assignedAgentId: 'agent-copelandos',
    metadata: { planningMemoryId: plan.plan.id },
  });

  await claimTask(env, task.task.id, { agentId: 'agent-copelandos' });
  await startTask(env, task.task.id);
  await completeTask(env, task.task.id, { summary: 'All tests green' });

  const reloaded = await getPlanningMemory(env, plan.plan.id);
  assert.equal(reloaded.executionSummaries.length, 1);
  assert.equal(reloaded.executionContext.length, 1);
  assert.equal(reloaded.executionSummaries[0].source, 'task');
  assert.equal(reloaded.executionSummaries[0].status, 'success');
  assert.equal(reloaded.executionContext[0].taskAttempt, 1);
});

test('KV storage persists planning memory across resets', async () => {
  const kv = createMockKv();
  const kvEnv = { PLANNING_MEMORY_KV: kv };

  const created = await createPlanningMemory(kvEnv, {
    objective: 'KV persisted plan',
    rationale: 'Survives cold start',
    agentId: 'agent-copelandos',
  });
  await addPlanningDecision(kvEnv, created.plan.id, { text: 'Bind PLANNING_MEMORY_KV' });

  resetPlanningMemoryForTests();
  resetPlanningMemoryStorageForTests();

  const storage = getPlanningMemoryStorage(kvEnv);
  assert.equal(storage.mode, 'kv');

  const reloaded = await storage.getPlan(created.plan.id);
  assert.equal(reloaded.objective, 'KV persisted plan');
  assert.equal(reloaded.decisions.length, 1);

  const resume = await getResumableContext(kvEnv, { agentId: 'agent-copelandos' });
  assert.equal(resume.resume.plans.length, 1);
});

test('planning memory mutation routes require authentication', () => {
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory', 'GET'), false);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/plan-1/decisions', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/plan-1/reasoning', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/plan-1/context', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/plan-1/objectives/complete', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/plan-1/objectives/block', 'POST'), true);
  assert.equal(isPlanningMemoryMutationRoute('/api/planning-memory/resume', 'GET'), false);
});

test('POST new planning memory routes via HTTP', async () => {
  const createRequest = makeRequest('/api/planning-memory', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({
      objective: 'HTTP extended routes',
      agentId: 'agent-copelandos',
    }),
  });
  const createResponse = await worker.fetch(createRequest, withApiAuth(), {});
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  const planId = created.plan.id;

  const reasoningRequest = makeRequest(`/api/planning-memory/${planId}/reasoning`, {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ summary: 'HTTP reasoning entry', source: 'agent' }),
  });
  const reasoningResponse = await worker.fetch(reasoningRequest, withApiAuth(), {});
  const reasoning = await reasoningResponse.json();
  assert.equal(reasoningResponse.status, 200);
  assert.ok(reasoning.reasoning);

  const contextRequest = makeRequest(`/api/planning-memory/${planId}/context`, {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ status: 'running', summary: 'In flight', source: 'agent' }),
  });
  const contextResponse = await worker.fetch(contextRequest, withApiAuth(), {});
  const context = await contextResponse.json();
  assert.equal(contextResponse.status, 200);
  assert.ok(context.context);

  const completeRequest = makeRequest(`/api/planning-memory/${planId}/objectives/complete`, {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ summary: 'Done via HTTP' }),
  });
  const completeResponse = await worker.fetch(completeRequest, withApiAuth(), {});
  const completed = await completeResponse.json();
  assert.equal(completeResponse.status, 200);
  assert.equal(completed.plan.status, 'completed');
});

test('GET /api/planning-memory/resume is public', async () => {
  await createPlanningMemory(env, {
    objective: 'Public resume test',
    agentId: 'agent-copelandos',
  });

  const response = await worker.fetch(
    makeRequest('/api/planning-memory/resume?agentId=agent-copelandos'),
    {},
    {},
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.resume.plans.length >= 1);
});

test('POST /api/planning-memory requires bearer token', async () => {
  const request = makeRequest('/api/planning-memory', {
    method: 'POST',
    body: JSON.stringify({ objective: 'Denied' }),
  });
  const response = await worker.fetch(request, withApiAuth(), {});
  assert.equal(response.status, 401);
});

test('authorized create and update via HTTP', async () => {
  const createRequest = makeRequest('/api/planning-memory', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({
      objective: 'HTTP planning memory',
      rationale: 'API test',
      agentId: 'agent-copelandos',
    }),
  });
  const createResponse = await worker.fetch(createRequest, withApiAuth(), {});
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);

  const patchRequest = makeRequest(`/api/planning-memory/${created.plan.id}`, {
    method: 'PATCH',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ status: 'completed' }),
  });
  const patchResponse = await worker.fetch(patchRequest, withApiAuth(), {});
  const patched = await patchResponse.json();
  assert.equal(patchResponse.status, 200);
  assert.equal(patched.plan.status, 'completed');
});

test('orchestration status includes planning memory summary', async () => {
  await createPlanningMemory(env, { objective: 'Status test', agentId: 'agent-copelandos' });
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.planningMemory);
  assert.ok(data.pipeline.includes('structured planning memory'));
});

test('foundation status reports planning memory module', async () => {
  const response = await worker.fetch(makeRequest('/api/status'), {}, {});
  const data = await response.json();
  assert.equal(data.modules.planningMemory.connected, true);
  assert.equal(data.modules.planningMemory.persistence, 'memory');
});

test('listPlanningMemories filters by agent and status', async () => {
  await createPlanningMemory(env, { objective: 'Active plan', agentId: 'agent-copelandos' });
  const completed = await createPlanningMemory(env, { objective: 'Done plan', agentId: 'agent-jazz-backend' });
  await updatePlanningMemory(env, completed.plan.id, { status: 'completed' });

  const active = await listPlanningMemories(env, { agentId: 'agent-copelandos', status: 'active' });
  assert.equal(active.length, 1);
  assert.equal(active[0].objective, 'Active plan');
});

test('getPlanningMemorySnapshot reports counts', async () => {
  await createPlanningMemory(env, { objective: 'Snapshot A' });
  await createPlanningMemory(env, { objective: 'Snapshot B' });
  const snapshot = await getPlanningMemorySnapshot(env);
  assert.equal(snapshot.persistence, 'memory');
  assert.ok(snapshot.planCount >= 2);
  assert.ok(snapshot.byStatus.active >= 2);
});
