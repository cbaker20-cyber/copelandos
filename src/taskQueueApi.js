/**
 * HTTP handlers for the persistent task queue.
 */

import {
  enqueueTask,
  getTask,
  listTasks,
  claimTask,
  startTask,
  completeTask,
  failTask,
  cancelTask,
  retryTask,
  getQueueSnapshot,
  listTaskTypes,
} from './taskQueue.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handleTaskQueueRequest({ path, request, body, env, json }) {
  if (path === '/api/tasks/queue/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const snapshot = await getQueueSnapshot(env);
    return json({ ok: true, queue: snapshot });
  }

  if (path === '/api/tasks') {
    const guard = methodGuard(request, ['GET', 'POST'], json);
    if (guard) return guard;

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || null;
      const assignedAgentId = url.searchParams.get('assignedAgentId') || null;
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const tasks = await listTasks(env, { status, assignedAgentId, limit });
      return json({ ok: true, tasks, taskTypes: listTaskTypes() });
    }

    const result = await enqueueTask(env, body || {});
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status);
    }
    return json({
      ok: true,
      task: result.task,
      deduplicated: result.deduplicated || false,
    }, result.deduplicated ? 200 : 201);
  }

  const actionMatch = path.match(/^\/api\/tasks\/([^/]+)\/(claim|start|complete|fail|cancel|retry)$/);
  if (actionMatch) {
    const taskId = decodeURIComponent(actionMatch[1]);
    const action = actionMatch[2];
    const guard = methodGuard(request, ['POST'], json);
    if (guard) return guard;

    const payload = body && typeof body === 'object' ? body : {};
    let result;

    switch (action) {
      case 'claim':
        result = await claimTask(env, taskId, payload);
        break;
      case 'start':
        result = await startTask(env, taskId, payload);
        break;
      case 'complete':
        result = await completeTask(env, taskId, payload);
        break;
      case 'fail':
        result = await failTask(env, taskId, payload);
        break;
      case 'cancel':
        result = await cancelTask(env, taskId, payload);
        break;
      case 'retry':
        result = await retryTask(env, taskId);
        break;
      default:
        return null;
    }

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status);
    }
    return json({ ok: true, ...result });
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;

    const task = await getTask(env, taskId);
    if (!task) return json({ ok: false, error: 'Task not found' }, 404);
    return json({ ok: true, task });
  }

  return null;
}

export async function buildTaskQueueStatusSummary(env) {
  return getQueueSnapshot(env);
}
