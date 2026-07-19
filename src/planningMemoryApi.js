/**
 * HTTP handlers for structured planning memory.
 */

import {
  createPlanningMemory,
  getPlanningMemory,
  listPlanningMemories,
  updatePlanningMemory,
  appendPlanningHistory,
  addPlanningDecision,
  addPlanningDependency,
  appendExecutionSummary,
  getResumableContext,
  getPlanningMemorySnapshot,
} from './planningMemory.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handlePlanningMemoryRequest({ path, request, body, env, json }) {
  if (path === '/api/planning-memory/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const snapshot = await getPlanningMemorySnapshot(env);
    return json({ ok: true, planningMemory: snapshot });
  }

  if (path === '/api/planning-memory/resume') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const url = new URL(request.url);
    const result = await getResumableContext(env, {
      agentId: url.searchParams.get('agentId') || null,
      taskId: url.searchParams.get('taskId') || null,
      ideaId: url.searchParams.get('ideaId') || null,
    });
    if (!result.ok) return json({ ok: false, error: result.error }, result.status);
    return json(result);
  }

  if (path === '/api/planning-memory') {
    const guard = methodGuard(request, ['GET', 'POST'], json);
    if (guard) return guard;

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const plans = await listPlanningMemories(env, {
        status: url.searchParams.get('status') || null,
        agentId: url.searchParams.get('agentId') || null,
        taskId: url.searchParams.get('taskId') || null,
        ideaId: url.searchParams.get('ideaId') || null,
        limit: parseInt(url.searchParams.get('limit') || '50', 10),
      });
      return json({ ok: true, plans });
    }

    const result = await createPlanningMemory(env, body || {});
    if (!result.ok) return json({ ok: false, error: result.error }, result.status);
    return json({ ok: true, plan: result.plan }, 201);
  }

  const actionMatch = path.match(/^\/api\/planning-memory\/([^/]+)\/(history|decisions|dependencies|executions)$/);
  if (actionMatch) {
    const planId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const guard = methodGuard(request, ['POST'], json);
    if (guard) return guard;

    const payload = body && typeof body === 'object' ? body : {};
    let result;

    switch (action) {
      case 'history':
        result = await appendPlanningHistory(env, planId, payload);
        break;
      case 'decisions':
        result = await addPlanningDecision(env, planId, payload);
        break;
      case 'dependencies':
        result = await addPlanningDependency(env, planId, payload);
        break;
      case 'executions':
        result = await appendExecutionSummary(env, planId, payload);
        break;
      default:
        return null;
    }

    if (!result.ok) return json({ ok: false, error: result.error }, result.status);
    return json({ ok: true, ...result });
  }

  const planMatch = path.match(/^\/api\/planning-memory\/([^/]+)$/);
  if (planMatch) {
    const planId = decodeURIComponent(planMatch[1]);
    const guard = methodGuard(request, ['GET', 'PATCH'], json);
    if (guard) return guard;

    if (request.method === 'GET') {
      const plan = await getPlanningMemory(env, planId);
      if (!plan) return json({ ok: false, error: 'Planning memory not found' }, 404);
      return json({ ok: true, plan });
    }

    const result = await updatePlanningMemory(env, planId, body || {});
    if (!result.ok) return json({ ok: false, error: result.error }, result.status);
    return json({ ok: true, plan: result.plan });
  }

  return null;
}

export async function buildPlanningMemoryStatusSummary(env) {
  return getPlanningMemorySnapshot(env);
}
