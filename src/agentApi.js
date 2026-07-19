/**
 * HTTP handlers for autonomous agent orchestration.
 */

import {
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
} from './agentOrchestration.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handleAgentRequest({ path, request, body, json }) {
  if (path === '/api/agents') {
    const guard = methodGuard(request, ['GET', 'POST'], json);
    if (guard) return guard;

    if (request.method === 'GET') {
      return json({
        ok: true,
        agents: listAgents(),
        agentTypes: listAgentTypes(),
      });
    }

    const result = registerAgent(body || {});
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status);
    }
    return json({ ok: true, agent: result.agent }, 201);
  }

  const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
  if (agentMatch) {
    const agentId = decodeURIComponent(agentMatch[1]);
    const guard = methodGuard(request, ['GET', 'PATCH'], json);
    if (guard) return guard;

    if (request.method === 'GET') {
      const agent = getAgent(agentId);
      if (!agent) return json({ ok: false, error: 'Agent not found' }, 404);
      return json({ ok: true, agent });
    }

    const result = updateAgent(agentId, body || {});
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status);
    }
    return json({ ok: true, agent: result.agent });
  }

  const actionMatch = path.match(/^\/api\/agents\/([^/]+)\/(heartbeat|runs|block|unblock)$/);
  if (actionMatch) {
    const agentId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const guard = methodGuard(request, ['POST'], json);
    if (guard) return guard;

    if (action === 'heartbeat') {
      const result = recordAgentHeartbeat(agentId, body || {});
      if (!result.ok) return json({ ok: false, error: result.error }, result.status);
      return json({ ok: true, agent: result.agent });
    }

    if (action === 'runs') {
      const result = recordAgentRun(agentId, body || {});
      if (!result.ok) return json({ ok: false, error: result.error }, result.status);
      return json({ ok: true, agent: result.agent, run: result.run });
    }

    if (action === 'block') {
      const reason = body?.reason;
      const result = blockAgent(agentId, reason);
      if (!result.ok) return json({ ok: false, error: result.error }, result.status);
      return json({ ok: true, agent: result.agent });
    }

    if (action === 'unblock') {
      const result = unblockAgent(agentId);
      if (!result.ok) return json({ ok: false, error: result.error }, result.status);
      return json({ ok: true, agent: result.agent });
    }
  }

  return null;
}

export function buildOrchestrationStatusPayload() {
  const snapshot = getOrchestrationSnapshot();
  return {
    ok: true,
    mode: snapshot.mode,
    automaticExecution: false,
    agentCount: snapshot.agentCount,
    blockedCount: snapshot.blockedCount,
    staleHeartbeatCount: snapshot.staleHeartbeatCount,
    byStatus: snapshot.byStatus,
    pipeline: [
      'mobile capture',
      'idea inbox',
      'deterministic classifier',
      'skill selection',
      'planner',
      'optional mock council',
      'provider router',
      'tool/MCP safety registry',
      'agent orchestration registry',
      'vault memory',
      'Cursor/Codex prompt generation',
    ],
    agents: snapshot.agents.map((a) => ({
      id: a.id,
      name: a.name,
      agentType: a.agentType,
      repository: a.repository,
      objective: a.objective,
      taskStatus: a.taskStatus,
      priority: a.priority,
      owner: a.owner,
      blocked: a.blocked,
      heartbeatAt: a.heartbeatAt,
      lastSuccessfulRunAt: a.lastSuccessfulRunAt,
      health: a.health,
    })),
    agentTypes: snapshot.agentTypes,
    updatedAt: snapshot.updatedAt,
  };
}
