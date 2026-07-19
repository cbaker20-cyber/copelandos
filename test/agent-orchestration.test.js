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
import { isAgentMutationRoute } from '../src/auth.js';
import worker from '../worker.js';
import { bearerAuthHeaders, withApiAuth } from './helpers/auth.js';

function makeRequest(path, options = {}) {
  const url = `https://worker.example${path}`;
  return new Request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

test.beforeEach(() => {
  resetAgentOrchestrationForTests();
});

test('bootstrap seeds project agents and Hermes router from config', () => {
  bootstrapAgentOrchestration();
  const agents = listAgents();
  assert.equal(agents.length, 6);
  assert.ok(agents.some((a) => a.id === 'agent-copelandos'));
  assert.ok(agents.some((a) => a.id === 'agent-hermes-router'));
  assert.ok(agents.some((a) => a.repository === 'cbaker20-cyber/copelandos'));
  assert.equal(getAgent('agent-connectome-perturbation')?.blocked, true);
});

test('registerAgent validates type and name', () => {
  bootstrapAgentOrchestration();
  const missingName = registerAgent({ agentType: 'cursor' });
  assert.equal(missingName.ok, false);
  assert.equal(missingName.status, 400);

  const badType = registerAgent({ name: 'Test', agentType: 'unknown' });
  assert.equal(badType.ok, false);
  assert.equal(badType.status, 400);

  const created = registerAgent({
    name: 'Custom Agent',
    agentType: 'supervisor',
    repository: 'cbaker20-cyber/example',
    objective: 'Monitor CI',
  });
  assert.equal(created.ok, true);
  assert.equal(created.agent.owner, 'copeland');
  assert.equal(created.agent.taskStatus, 'idle');
});

test('heartbeat, runs, and block/unblock update agent state', () => {
  bootstrapAgentOrchestration();
  const agentId = 'agent-jazz-backend';

  const heartbeat = recordAgentHeartbeat(agentId, { taskStatus: 'running' });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.agent.taskStatus, 'running');
  assert.ok(heartbeat.agent.heartbeatAt);

  const run = recordAgentRun(agentId, {
    status: 'success',
    summary: 'Tests passed',
  });
  assert.equal(run.ok, true);
  assert.equal(run.run.status, 'success');
  assert.ok(run.agent.lastSuccessfulRunAt);
  assert.equal(run.agent.executionHistory.length, 1);

  const blocked = blockAgent(agentId, 'Waiting on credentials');
  assert.equal(blocked.ok, true);
  assert.equal(blocked.agent.blocked, true);
  assert.equal(blocked.agent.taskStatus, 'blocked');

  const unblocked = unblockAgent(agentId);
  assert.equal(unblocked.ok, true);
  assert.equal(unblocked.agent.blocked, false);
  assert.equal(unblocked.agent.taskStatus, 'idle');
});

test('execution history is capped and failure sets failed status', () => {
  bootstrapAgentOrchestration();
  const agentId = 'agent-score-scanner';

  for (let i = 0; i < 55; i += 1) {
    recordAgentRun(agentId, { status: 'success', summary: `run-${i}` });
  }
  const agent = getAgent(agentId);
  assert.equal(agent.executionHistory.length, 50);

  recordAgentRun(agentId, { status: 'failure', error: 'timeout' });
  assert.equal(getAgent(agentId).taskStatus, 'failed');
});

test('orchestration snapshot reports health signals', () => {
  bootstrapAgentOrchestration();
  const snapshot = getOrchestrationSnapshot({ heartbeatStaleMs: 60_000 });
  assert.equal(snapshot.mode, 'orchestration-registry');
  assert.equal(snapshot.agentCount, 6);
  assert.ok(snapshot.byStatus);
  assert.ok(snapshot.agents.every((a) => a.health));
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

test('orchestration status includes live agent registry', async () => {
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.mode, 'orchestration-registry');
  assert.equal(data.automaticExecution, false);
  assert.ok(data.pipeline.includes('agent orchestration registry'));
  assert.ok(data.agents.length >= 6);
  assert.ok(data.agentTypes.length >= 4);
});

test('foundation status reports orchestration module', async () => {
  const response = await worker.fetch(makeRequest('/api/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.modules.orchestration.connected, true);
  assert.ok(data.modules.orchestration.agentCount >= 6);
});

test('listAgentTypes returns configured types', () => {
  const types = listAgentTypes();
  assert.ok(types.some((t) => t.id === 'hermes'));
  assert.ok(types.every((t) => Array.isArray(t.capabilities)));
});

test('updateAgent patches fields', () => {
  bootstrapAgentOrchestration();
  const result = updateAgent('agent-copelandos', {
    objective: 'Ship agent orchestration',
    priority: 'critical',
  });
  assert.equal(result.ok, true);
  assert.equal(result.agent.objective, 'Ship agent orchestration');
  assert.equal(result.agent.priority, 'critical');
});
