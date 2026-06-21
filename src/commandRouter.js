import { evaluatePermission } from './permissions.js';
import { getProject, publicProjectSummary } from './projects.js';
import { routeModel } from './modelRouter.js';

export function routeCommand(command, { registry, models, env = {} }) {
  const input = String(command || '').trim();
  const lower = input.toLowerCase();
  if (!input) return { ok: false, error: 'Command is required.' };

  if (lower === 'status' || lower === 'system status') {
    return {
      ok: true,
      command: 'status',
      permission: evaluatePermission('read_status'),
      message: 'CopelandOS foundation is available. Integration status is reported separately.',
    };
  }

  if (lower === 'projects' || lower === 'list projects') {
    return {
      ok: true,
      command: 'projects',
      permission: evaluatePermission('read_status'),
      projects: (registry.projects || []).map(publicProjectSummary),
    };
  }

  const projectMatch = input.match(/^project\s+([a-z0-9-]+)$/i);
  if (projectMatch) {
    const project = getProject(registry, projectMatch[1]);
    return project
      ? { ok: true, command: 'project', permission: evaluatePermission('read_status'), project }
      : { ok: false, error: `Unknown project '${projectMatch[1]}'.` };
  }

  const modelMatch = input.match(/^model\s+([a-z_-]+)$/i);
  if (modelMatch) {
    return {
      ok: true,
      command: 'model',
      permission: evaluatePermission('read_status'),
      route: routeModel(modelMatch[1], env, models),
    };
  }

  const openMatch = input.match(/^open\s+(https?:\/\/\S+)$/i);
  if (openMatch) {
    return {
      ok: true,
      command: 'open_url',
      permission: evaluatePermission('open_url'),
      url: openMatch[1],
      execute: false,
      message: 'URL validated. A client may open it after showing the destination.',
    };
  }

  return {
    ok: true,
    command: 'plan',
    permission: evaluatePermission('generate_plan'),
    input,
    next: 'Route this request to a configured model after the user reviews the proposed action.',
    modelRoute: routeModel('planning', env, models),
  };
}
