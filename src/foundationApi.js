import { routeCommand } from './commandRouter.js';
import { evaluatePermission, listPermissionRules } from './permissions.js';
import { listProviderStatuses, routeModel } from './modelRouter.js';
import { getProject, listProjects, publicProjectSummary } from './projects.js';
import { routeHermesTask } from './hermesAgent.js';
import { getAutomationIntegration, listAutomationIntegrations, routeAutomationTask } from './automationIntegrations.js';
import {
  checkIntegration,
  getControlLoop,
  getIntegrationSummary,
  getMorningReportPlan,
  listIntegrations,
  validateIntegrationRegistry,
} from './integrationRegistry.js';
import {
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  persistVaultDocument,
  writeDailyNote,
  writeDecisionLog,
  writeEmailDraftNote,
  writeMeetingNote,
  writeProjectUpdate,
  writeResearchNote,
  writeTaskList,
  writeIdeaNote,
} from './vault.js';

function methodNotAllowed(json, allowed) {
  return json({ ok: false, error: `Method not allowed. Use ${allowed}.` }, 405);
}

function permissionBlocked(json, permission) {
  return json(permission, 409);
}

function buildPrompt(kind, project, task) {
  const agent = kind === 'cursor' ? 'Cursor implementation agent' : 'Codex architecture and security agent';
  return [
    `You are the ${agent} for ${project.displayName}.`,
    `Repository: ${project.repo}`,
    `Current phase: ${project.currentPhase}`,
    `Task source: ${project.taskSource}`,
    `Requested task: ${task || project.nextRecommendedTask}`,
    `Safe actions: ${project.safeActions.join(', ')}`,
    `Forbidden actions: ${project.forbiddenActions.join(', ')}`,
    `Forbidden claims: ${project.forbiddenClaims.join(', ')}`,
    'Inspect the repository and open PRs before acting. Use a branch and draft PR. Stop on blockers instead of guessing.',
  ].join('\n');
}

function createVaultDocument(body) {
  const options = { containsPrivateStudentData: body.containsPrivateStudentData === true };
  switch (body.type) {
    case 'daily': return writeDailyNote(body.date || new Date().toISOString().slice(0, 10), body.content, options);
    case 'project': return writeProjectUpdate(body.projectId, body.content, options);
    case 'decision': return writeDecisionLog(body.title, body.content, options);
    case 'research': return writeResearchNote(body.topic || body.title, body.content, options);
    case 'meeting': return writeMeetingNote(body.title, body.content, options);
    case 'email': return writeEmailDraftNote(body.subject || body.title, body.content, options);
    case 'tasks': return writeTaskList(body.projectId, body.tasks, options);
    case 'idea': return writeIdeaNote(body.idea || { text: body.content, source: 'manual', tags: [], status: 'new' }, options);
    default: throw new Error('Unsupported vault note type.');
  }
}

export async function handleFoundationRequest({
  path,
  request,
  body,
  env,
  json,
  projectRegistry,
  modelConfig,
  createEmailDraft,
}) {
  if (path === '/api/status') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const providerStatuses = listProviderStatuses(env, modelConfig);
    const integrations = listAutomationIntegrations(env);
    return json({
      ok: true,
      system: 'CopelandOS',
      foundation: true,
      complete: false,
      canonicalBackend: 'worker.js',
      modules: {
        projects: { connected: true, count: projectRegistry.projects?.length || 0 },
        hermes: { connected: true, mode: 'router-only', endpoint: '/api/hermes/route' },
        automations: { connected: true, endpoint: '/api/automation/integrations', count: integrations.length, configured: integrations.filter((item) => item.connected).map((item) => item.id) },
        integrations: { connected: false, summary: getIntegrationSummary(env) },
        modelRouter: { connected: providerStatuses.some((item) => item.configured), providers: providerStatuses },
        gmail: { connected: Boolean(env.GMAIL_REFRESH_TOKEN), mode: 'draft-only' },
        vault: { connected: Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO), mode: env.GITHUB_TOKEN ? 'github' : 'mock' },
        localAgent: { connected: false, configured: Boolean(env.LOCAL_AGENT_URL), message: 'Local agent status requires an explicit local connection.' },
        githubSupervisor: { connected: false, configured: Boolean(env.GITHUB_TOKEN), message: 'Live GitHub summary is not queried by this foundation route.' },
      },
    });
  }

  if (path === '/api/hermes/route') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    return json(routeHermesTask(body, env));
  }

  if (path === '/api/automation/integrations') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({ ok: true, integrations: listAutomationIntegrations(env) });
  }

  if (path === '/api/automation/route') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    return json(routeAutomationTask(body.task || body.text || '', env));
  }

  if (path.startsWith('/api/automation/integrations/')) {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const id = decodeURIComponent(path.slice('/api/automation/integrations/'.length));
    const integration = getAutomationIntegration(id, env);
    return integration ? json({ ok: true, integration }) : json({ ok: false, error: 'Automation integration not found.' }, 404);
  }

  if (path === '/api/projects') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({ ok: true, projects: listProjects(projectRegistry).map(publicProjectSummary) });
  }

  if (path.startsWith('/api/projects/')) {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const id = decodeURIComponent(path.slice('/api/projects/'.length));
    const project = getProject(projectRegistry, id);
    return project ? json({ ok: true, project }) : json({ ok: false, error: 'Project not found.' }, 404);
  }

  if (path === '/api/command') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    return json(routeCommand(body.command, { registry: projectRegistry, models: modelConfig, env }));
  }

  if (path === '/api/ai/route') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    return json(routeModel(body.taskType, env, modelConfig));
  }

  if (path === '/api/integrations') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({
      ok: true,
      integrations: listIntegrations({ env }),
      summary: getIntegrationSummary(env),
      validation: validateIntegrationRegistry(),
    });
  }

  if (path === '/api/integrations/check') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    if (!body.integrationId) return json({ ok: false, error: 'integrationId is required.' }, 400);
    return json(checkIntegration(body.integrationId, env));
  }

  if (path === '/api/integrations/control-loop') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({
      ok: true,
      architecture: 'phone/Siri/Shortcut/share sheet -> CopelandOS inbox -> classifier -> planner -> provider router / AI council -> safe tool registry -> Obsidian memory -> Cursor/Codex task -> draft PR -> review status back into CopelandOS',
      loop: getControlLoop(env),
      morningReport: getMorningReportPlan(),
    });
  }

  if (path === '/api/vault/write') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    const permission = evaluatePermission('write_vault_note');
    if (!permission.allowed) return permissionBlocked(json, permission);
    try {
      const document = createVaultDocument(body);
      const result = await persistVaultDocument(document, env);
      return json({ ...result, permission });
    } catch (error) {
      return json({ ok: false, error: error.message }, 400);
    }
  }

  if (path === '/api/obsidian/open') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    const permission = evaluatePermission('open_obsidian_uri');
    if (!permission.allowed) return permissionBlocked(json, permission);
    const vault = body.vault || env.OBSIDIAN_VAULT || 'CopelandVault';
    const mode = body.mode || 'open';
    const uri = mode === 'daily'
      ? buildObsidianDailyUri(vault)
      : mode === 'new'
        ? buildObsidianNewUri(vault, body.file, body.content)
        : buildObsidianOpenUri(vault, body.file);
    return json({ ok: true, execute: false, uri, permission });
  }

  if (path === '/api/email/draft') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    const permission = evaluatePermission('create_gmail_draft', { confirmed: body.confirmed === true });
    if (!permission.allowed) return permissionBlocked(json, permission);
    const result = await createEmailDraft(body, env);
    return json({ ...result, permission });
  }

  if (path === '/api/github/summary') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({
      ok: true,
      connected: false,
      configured: Boolean(env.GITHUB_TOKEN),
      projects: projectRegistry.projects.map(({ id, repo }) => ({ id, repo, status: 'not_queried' })),
      message: 'Live GitHub supervision is intentionally not connected in this foundation route.',
    });
  }

  if (path === '/api/agents/cursor-prompt' || path === '/api/agents/codex-prompt') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    const project = getProject(projectRegistry, body.projectId);
    if (!project) return json({ ok: false, error: 'Project not found.' }, 404);
    const kind = path.includes('cursor') ? 'cursor' : 'codex';
    return json({ ok: true, kind, projectId: project.id, prompt: buildPrompt(kind, project, body.task) });
  }

  if (path === '/api/remote/status') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({
      ok: true,
      connected: false,
      configured: Boolean(env.LOCAL_AGENT_URL),
      transport: 'localhost-or-tailscale',
      message: 'No live local-agent probe is performed by default.',
    });
  }

  if (path === '/api/remote/request-action') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    const permission = evaluatePermission(body.action, { confirmed: body.confirmed === true });
    if (!permission.allowed) return permissionBlocked(json, permission);
    return json({
      ok: false,
      connected: false,
      queued: false,
      permission,
      message: 'Action was authorized but not executed because no local agent is connected.',
    }, 503);
  }

  if (path === '/api/permissions') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({ ok: true, rules: listPermissionRules() });
  }

  return null;
}
