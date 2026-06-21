import {
  captureIdea,
  listIdeas,
  getIdea,
  triageIdea,
  convertIdeaSpec,
  markConverted,
  VALID_SOURCES,
  VALID_STATUSES,
} from './ideaStore.js';
import {
  writeProjectUpdate,
  writeDecisionLog,
  writeResearchNote,
  writeMeetingNote,
  writeEmailDraftNote,
  writeDailyNote,
  writeTaskList,
  writeIdeaNote,
  persistVaultDocument,
} from './vault.js';
import { createPlan, createTaskBrief, createCursorPrompt, createCodexPrompt } from './planner.js';
import { listSkills, publicSkillSummary } from './skills.js';
import { listTools, publicToolSummary, listMcpServers } from './toolRegistry.js';
import { listAllProviderStatuses, explainRoutingDecision } from './providerRouter.js';
import { getProject } from './projects.js';
import projectRegistry from '../config/projects.json' with { type: 'json' };

function methodNotAllowed(json, allowed) {
  return json({ ok: false, error: `Method not allowed. Use ${allowed}.` }, 405);
}

/**
 * Convert an idea-convert spec into a vault document using the appropriate writer.
 */
function createVaultDocumentFromSpec(spec) {
  const options = {};
  switch (spec.type) {
    case 'project': return writeProjectUpdate(spec.ideaId, spec.content, options);
    case 'decision': return writeDecisionLog(spec.title, spec.content, options);
    case 'research': return writeResearchNote(spec.title, spec.content, options);
    case 'meeting': return writeMeetingNote(spec.title, spec.content, options);
    case 'email': return writeEmailDraftNote(spec.title, spec.content, options);
    case 'daily': return writeDailyNote(new Date().toISOString().slice(0, 10), spec.content, options);
    case 'tasks': return writeTaskList(spec.ideaId, spec.content, options);
    default: return writeResearchNote(spec.title, spec.content, options);
  }
}

/**
 * Handle all /api/capture/* and /api/ideas/* routes and related brain routes.
 * Returns null if the path does not match.
 */
export async function handleIdeaCaptureRequest({ path, request, body, env, json }) {
  // POST /api/capture/idea
  if (path === '/api/capture/idea') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    try {
      const idea = captureIdea(body);
      return json({ ok: true, idea });
    } catch (error) {
      return json({ ok: false, error: error.message }, 400);
    }
  }

  // GET /api/ideas
  if (path === '/api/ideas') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 200 ? limitParam : 50;
    const ideas = listIdeas({ status, limit });
    return json({
      ok: true,
      ideas,
      count: ideas.length,
      validStatuses: [...VALID_STATUSES],
      validSources: [...VALID_SOURCES],
    });
  }

  // Routes for specific idea IDs
  const ideaMatch = path.match(/^\/api\/ideas\/([^/]+)(\/[a-z-]*)?$/);
  if (ideaMatch) {
    const id = decodeURIComponent(ideaMatch[1]);
    const subPath = ideaMatch[2] || '';

    // GET /api/ideas/:id
    if (!subPath && request.method === 'GET') {
      const idea = getIdea(id);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      return json({ ok: true, idea });
    }

    // POST /api/ideas/:id/triage
    if (subPath === '/triage') {
      if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
      const idea = getIdea(id);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const updated = triageIdea(id, body);
      return json({ ok: true, idea: updated });
    }

    // POST /api/ideas/:id/convert
    if (subPath === '/convert') {
      if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
      const idea = getIdea(id);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const spec = convertIdeaSpec(id, body);
      if (!spec) return json({ ok: false, error: 'Could not generate vault spec.' }, 500);

      try {
        const document = createVaultDocumentFromSpec(spec);
        const result = await persistVaultDocument(document, env);
        const updated = markConverted(id, result.path);
        return json({ ok: true, idea: updated, vault: result });
      } catch (error) {
        return json({ ok: false, error: error.message }, 400);
      }
    }

    // POST /api/ideas/:id/cursor-prompt
    if (subPath === '/cursor-prompt') {
      if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
      const idea = getIdea(id);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const projectId = body.projectId || idea.project;
      const project = projectId ? getProject(projectRegistry, projectId) : null;
      const plan = createPlan(idea.text);
      const prompt = createCursorPrompt(idea.text, {
        project,
        plan,
        files: body.files || [],
        prTitle: body.prTitle,
      });
      const brief = createTaskBrief(idea.text, plan);
      return json({ ok: true, ideaId: id, kind: 'cursor', prompt, brief, plan });
    }

    // POST /api/ideas/:id/codex-prompt
    if (subPath === '/codex-prompt') {
      if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
      const idea = getIdea(id);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const projectId = body.projectId || idea.project;
      const project = projectId ? getProject(projectRegistry, projectId) : null;
      const plan = createPlan(idea.text);
      const prompt = createCodexPrompt(idea.text, {
        project,
        plan,
        files: body.files || [],
      });
      const brief = createTaskBrief(idea.text, plan);
      return json({ ok: true, ideaId: id, kind: 'codex', prompt, brief, plan });
    }
  }

  // GET /api/skills
  if (path === '/api/skills') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({ ok: true, skills: listSkills().map(publicSkillSummary) });
  }

  // GET /api/tools
  if (path === '/api/tools') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const url = new URL(request.url);
    const family = url.searchParams.get('family') || undefined;
    const category = url.searchParams.get('category') || undefined;
    return json({ ok: true, tools: listTools({ family, category }).map(publicToolSummary) });
  }

  // GET /api/mcp
  if (path === '/api/mcp') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    return json({ ok: true, ...listMcpServers() });
  }

  // POST /api/plan
  if (path === '/api/plan') {
    if (request.method !== 'POST') return methodNotAllowed(json, 'POST');
    if (!body.task) return json({ ok: false, error: 'task is required.' }, 400);
    const plan = createPlan(body.task);
    const brief = createTaskBrief(body.task, plan);
    return json({ ok: true, plan, brief });
  }

  // GET /api/providers
  if (path === '/api/providers') {
    if (request.method !== 'GET') return methodNotAllowed(json, 'GET');
    const url = new URL(request.url);
    const taskType = url.searchParams.get('taskType') || 'general';
    const statuses = listAllProviderStatuses(env);
    const routing = explainRoutingDecision({ taskType }, env);
    return json({ ok: true, providers: statuses, routing });
  }

  return null;
}
