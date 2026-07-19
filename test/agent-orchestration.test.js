import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resetAgentOrchestrationForTests,
  bootstrapAgentOrchestration,
  listAgents,
  getAgent,
  registerAgent,
  updateAgent,
  recordAgentHeartbeat,
  recordAgentRun,
  blockAgent,
  unblockAgent,
  getOrchestrationSnapshot,
  listAgentTypes,
} from '../src/agentOrchestration.js';
import {
  getAgentStorage,
  resetAgentStorageForTests,
} from '../src/agentOrchestrationStorage.js';
import { isAgentMutationRoute } from '../src/auth.js';
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

test.beforeEach(() => {
  resetAgentOrchestrationForTests();
});

test('bootstrap seeds project agents and Hermes router from config', async () => {
  await bootstrapAgentOrchestration(env);
  const agents = await listAgents(env);
  assert.equal(agents.length, 6);
  assert.ok(agents.some((a) => a.id === 'agent-copelandos'));
  assert.ok(agents.some((a) => a.id === 'agent-hermes-router'));
  assert.ok(agents.some((a) => a.repository === 'cbaker20-cyber/copelandos'));
  assert.equal((await getAgent(env, 'agent-connectome-perturbation'))?.blocked, true);
});

test('registerAgent validates type and name', async () => {
  await bootstrapAgentOrchestration(env);
  const missingName = await registerAgent(env, { agentType: 'cursor' });
  assert.equal(missingName.ok, false);
  assert.equal(missingName.status, 400);

  const badType = await registerAgent(env, { name: 'Test', agentType: 'unknown' });
  assert.equal(badType.ok, false);
  assert.equal(badType.status, 400);

  const created = await registerAgent(env, {
    name: 'Custom Agent',
    agentType: 'supervisor',
    repository: 'cbaker20-cyber/example',
    objective: 'Monitor CI',
  });
  assert.equal(created.ok, true);
  assert.equal(created.agent.owner, 'copeland');
  assert.equal(created.agent.taskStatus, 'idle');
});

test('heartbeat, runs, and block/unblock update agent state', async () => {
  await bootstrapAgentOrchestration(env);
  const agentId = 'agent-jazz-backend';

  const heartbeat = await recordAgentHeartbeat(env, agentId, { taskStatus: 'running' });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.agent.taskStatus, 'running');
  assert.ok(heartbeat.agent.heartbeatAt);

  const run = await recordAgentRun(env, agentId, {
    status: 'success',
    summary: 'Tests passed',
  });
  assert.equal(run.ok, true);
  assert.equal(run.run.status, 'success');
  assert.ok(run.agent.lastSuccessfulRunAt);
  assert.equal(run.agent.executionHistory.length, 1);

  const blocked = await blockAgent(env, agentId, 'Waiting on credentials');
  assert.equal(blocked.ok, true);
  assert.equal(blocked.agent.blocked, true);
  assert.equal(blocked.agent.taskStatus, 'blocked');

  const unblocked = await unblockAgent(env, agentId);
  assert.equal(unblocked.ok, true);
  assert.equal(unblocked.agent.blocked, false);
  assert.equal(unblocked.agent.taskStatus, 'idle');
});

test('execution history is capped and failure sets failed status', async () => {
  await bootstrapAgentOrchestration(env);
  const agentId = 'agent-score-scanner';

  for (let i = 0; i < 55; i += 1) {
    await recordAgentRun(env, agentId, { status: 'success', summary: `run-${i}` });
  }
  const agent = await getAgent(env, agentId);
  assert.equal(agent.executionHistory.length, 50);

  await recordAgentRun(env, agentId, { status: 'failure', error: 'timeout' });
  assert.equal((await getAgent(env, agentId)).taskStatus, 'failed');
});

test('orchestration snapshot reports health signals and persistence mode', async () => {
  await bootstrapAgentOrchestration(env);
  const snapshot = await getOrchestrationSnapshot(env, { heartbeatStaleMs: 60_000 });
  assert.equal(snapshot.mode, 'orchestration-registry');
  assert.equal(snapshot.persistence, 'memory');
  assert.equal(snapshot.agentCount, 6);
  assert.ok(snapshot.byStatus);
  assert.ok(snapshot.agents.every((a) => a.health));
});

test('KV storage persists agent state across bootstrap resets', async () => {
  const kv = createMockKv();
  const kvEnv = { AGENT_STATE_KV: kv };

  await bootstrapAgentOrchestration(kvEnv);
  await recordAgentHeartbeat(kvEnv, 'agent-copelandos', {
    taskStatus: 'running',
    objective: 'Persist this objective',
    metadata: { sprint: 'platform' },
  });
  await recordAgentRun(kvEnv, 'agent-copelandos', {
    status: 'success',
    summary: 'KV persistence test',
  });
  await blockAgent(kvEnv, 'agent-jazz-backend', 'KV block test');

  resetAgentOrchestrationForTests();
  resetAgentStorageForTests();

  const storage = getAgentStorage(kvEnv);
  assert.equal(storage.mode, 'kv');

  const reloadedAgent = await storage.getAgent('agent-copelandos');
  assert.equal(reloadedAgent.objective, 'Persist this objective');
  assert.equal(reloadedAgent.metadata.sprint, 'platform');
  assert.ok(reloadedAgent.heartbeatAt);
  assert.equal(reloadedAgent.executionHistory.length, 1);

  const reloadedBlocked = await storage.getAgent('agent-jazz-backend');
  assert.equal(reloadedBlocked.blocked, true);
  assert.equal(reloadedBlocked.blockedReason, 'KV block test');

  await bootstrapAgentOrchestration(kvEnv);
  const snapshot = await getOrchestrationSnapshot(kvEnv);
  assert.equal(snapshot.mode, 'persistent-orchestration');
  assert.equal(snapshot.persistence, 'kv');
});

test('bootstrap adds new seeded agents without overwriting persisted state', async () => {
  const kv = createMockKv();
  const kvEnv = { AGENT_STATE_KV: kv };

  await bootstrapAgentOrchestration(kvEnv);
  await updateAgent(kvEnv, 'agent-copelandos', {
    objective: 'Custom persisted objective',
    priority: 'critical',
    owner: 'operator',
  });

  resetAgentOrchestrationForTests();
  await bootstrapAgentOrchestration(kvEnv);

  const agent = await getAgent(kvEnv, 'agent-copelandos');
  assert.equal(agent.objective, 'Custom persisted objective');
  assert.equal(agent.priority, 'critical');
  assert.equal(agent.owner, 'operator');
});

test('agent mutation routes require authentication', () => {
  assert.equal(isAgentMutationRoute('/api/agents', 'POST'), true);
  assert.equal(isAgentMutationRoute('/api/agents', 'GET'), false);
  assert.equal(isAgentMutationRoute('/api/agents/agent-jazz-backend', 'PATCH'), true);
  assert.equal(isAgentMutationRoute('/api/agents/agent-jazz-backend', 'GET'), false);
  assert.equal(isAgentMutationRoute('/api/agents/agent-jazz-backend/heartbeat', 'POST'), true);
});

test('GET /api/agents is public and returns seeded registry', async () => {
  const response = await worker.fetch(makeRequest('/api/agents'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.agents.length >= 6);
  assert.ok(data.agentTypes.some((t) => t.id === 'cursor'));
});

test('POST /api/agents requires bearer token', async () => {
  const request = makeRequest('/api/agents', {
    method: 'POST',
    body: JSON.stringify({ name: 'Denied', agentType: 'cursor' }),
  });
  const response = await worker.fetch(request, withApiAuth(), {});
  assert.equal(response.status, 401);
});

test('POST /api/agents registers agent when authorized', async () => {
  const request = makeRequest('/api/agents', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({
      name: 'Ops Supervisor',
      agentType: 'supervisor',
      repository: 'cbaker20-cyber/copelandos',
      objective: 'Summarize open PRs',
    }),
  });
  const response = await worker.fetch(request, withApiAuth(), {});
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.agent.agentType, 'supervisor');
});

test('agent heartbeat and run endpoints update state when authorized', async () => {
  const heartbeatRequest = makeRequest('/api/agents/agent-copelandos/heartbeat', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ taskStatus: 'running' }),
  });
  const heartbeatResponse = await worker.fetch(heartbeatRequest, withApiAuth(), {});
  const heartbeat = await heartbeatResponse.json();
  assert.equal(heartbeatResponse.status, 200);
  assert.equal(heartbeat.agent.taskStatus, 'running');

  const runRequest = makeRequest('/api/agents/agent-copelandos/runs', {
    method: 'POST',
    headers: bearerAuthHeaders(),
    body: JSON.stringify({ status: 'success', summary: 'Platform tests green' }),
  });
  const runResponse = await worker.fetch(runRequest, withApiAuth(), {});
  const run = await runResponse.json();
  assert.equal(runResponse.status, 200);
  assert.equal(run.run.status, 'success');
  assert.ok(run.agent.lastSuccessfulRunAt);
});

test('orchestration status includes live agent registry and persistence', async () => {
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.mode, 'orchestration-registry');
  assert.equal(data.persistence, 'memory');
  assert.equal(data.automaticExecution, false);
  assert.ok(data.pipeline.includes('agent orchestration registry'));
  assert.ok(data.agents.length >= 6);
  assert.ok(data.agentTypes.length >= 4);
});

test('foundation status reports orchestration module with persistence', async () => {
  const response = await worker.fetch(makeRequest('/api/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.modules.orchestration.connected, true);
  assert.equal(data.modules.orchestration.persistence, 'memory');
  assert.ok(data.modules.orchestration.agentCount >= 6);
});

test('listAgentTypes returns configured types', () => {
  const types = listAgentTypes();
  assert.ok(types.some((t) => t.id === 'hermes'));
  assert.ok(types.every((t) => Array.isArray(t.capabilities)));
});

test('updateAgent patches fields', async () => {
  await bootstrapAgentOrchestration(env);
  const result = await updateAgent(env, 'agent-copelandos', {
    objective: 'Ship agent orchestration',
    priority: 'critical',
  });
  assert.equal(result.ok, true);
  assert.equal(result.agent.objective, 'Ship agent orchestration');
  assert.equal(result.agent.priority, 'critical');
});
