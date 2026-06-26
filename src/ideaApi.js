import {
  validateIdeaInput,
  createIdea,
  getIdea,
  getIdeaStats,
  getProjectQueues,
  listIdeas,
  planIdea,
  dismissIdea,
  triageIdea,
  updateIdea,
  VALID_STATUSES,
} from './ideaStore.js';
import { classify, classifyWithContext } from './ideaClassifier.js';
import { createPlan, createCursorPrompt, createCodexPrompt } from './planner.js';
import { appendIdeaToDailyNote, convertIdeaToNote, normalizeIdeaNoteType, persistVaultDocument, writeIdeaNote } from './vault.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

function captureBodyFromRequest(request, body) {
  if (request.method !== 'GET') return body;
  const url = new URL(request.url);
  return {
    text: url.searchParams.get('text') || url.searchParams.get('q') || '',
    source: url.searchParams.get('source') || 'ios-shortcuts',
    urgency: url.searchParams.get('urgency') || 'medium',
    project: url.searchParams.get('project') || undefined,
    tags: (url.searchParams.get('tags') || 'ios,shortcut')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

async function captureIdea({ request, body, env, json }) {
  const capture = captureBodyFromRequest(request, body);
  const validation = validateIdeaInput(capture);
  if (!validation.ok) return json({ ok: false, error: validation.error }, 400);

  const classification = classifyWithContext(validation.text, {
    project: validation.project,
    tags: validation.tags,
  });

  const idea = createIdea(validation, classification);
  const vault = {
    ideaNote: await persistVaultDocument(writeIdeaNote(idea), env),
    dailyAppend: await persistVaultDocument(appendIdeaToDailyNote(idea), env),
  };
  return json({ ok: true, idea, classification, vault, shortcut: request.method === 'GET' }, 201);
}

export async function handleIdeaRequest({ path, request, body, env, json }) {
  // POST or GET /api/capture/idea. GET exists so Apple Shortcuts can use a simple URL action.
  if (path === '/api/capture/idea') {
    const guard = methodGuard(request, ['POST', 'GET'], json);
    if (guard) return guard;
    return captureIdea({ request, body, env, json });
  }

  // GET /api/ideas/stats
  if (path === '/api/ideas/stats') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, stats: getIdeaStats() });
  }

  // GET /api/project-queue
  if (path === '/api/project-queue') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, queues: getProjectQueues() });
  }

  // GET /api/brain/status
  if (path === '/api/brain/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({
      ok: true,
      mode: 'planner-ready',
      execution: 'disabled',
      capture: 'ready',
      classifier: 'deterministic-rules',
      council: 'mock-mode',
      providers: 'configured-by-env-only',
      tools: 'allowlist-first',
      memory: env.GITHUB_TOKEN && env.GITHUB_REPO ? 'configured' : 'mock-mode',
      stats: getIdeaStats(),
    });
  }

  // GET /api/orchestration/status
  if (path === '/api/orchestration/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({
      ok: true,
      pipeline: [
        'mobile capture',
        'idea inbox',
        'deterministic classifier',
        'skill selection',
        'planner',
        'optional mock council',
        'provider router',
        'tool/MCP safety registry',
        'vault memory',
        'Cursor/Codex prompt generation',
      ],
      automaticExecution: false,
      queues: getProjectQueues(),
    });
  }

  // GET /api/ideas
  if (path === '/api/ideas') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const result = listIdeas({
      status: VALID_STATUSES.has(status) ? status : null,
      limit,
      offset,
    });
    return json({ ok: true, ...result });
  }

  // Subaction routes: /api/ideas/:id/{triage,plan,dismiss,convert,cursor-prompt,codex-prompt}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|plan|dismiss|convert|cursor-prompt|codex-prompt)$/);
  if (subMatch) {
    const ideaId = subMatch[1];
    const subAction = subMatch[2];

    if (subAction === 'triage') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const result = triageIdea(ideaId, {
        status: body.status || 'triaged',
        category: body.category,
        skill: body.skill,
        riskLevel: body.riskLevel,
        suggestedAction: body.suggestedAction,
        confirmationRequired: body.confirmationRequired,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
      });
      if (!result.ok) return json({ ok: false, error: result.error }, 400);

      const plan = createPlan(result.idea.text);
      return json({ ok: true, idea: result.idea, plan });
    }

    if (subAction === 'plan') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const plan = createPlan(body.task || idea.text);
      const updated = planIdea(ideaId);
      return json({ ok: true, idea: updated, plan });
    }

    if (subAction === 'dismiss') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      return json({ ok: true, idea: dismissIdea(ideaId) });
    }

    if (subAction === 'convert') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const noteType = normalizeIdeaNoteType(body.type || 'research');
      const validTypes = ['project', 'decision', 'research', 'meeting', 'email', 'tasks', 'idea'];
      if (!validTypes.includes(noteType)) {
        return json({ ok: false, error: `Invalid note type. Use: ${validTypes.join(', ')}, project-update, decision-log, research-note, meeting-note, task-list, email-draft-note, idea-note` }, 400);
      }

      try {
        const document = convertIdeaToNote(idea, noteType);
        const result = await persistVaultDocument(document, env);
        updateIdea(ideaId, { status: 'converted-to-note' });
        const updated = getIdea(ideaId);
        return json({ ok: true, idea: updated, document, vault: result });
      } catch (err) {
        return json({ ok: false, error: err.message }, 400);
      }
    }

    if (subAction === 'cursor-prompt') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const prompt = createCursorPrompt({ idea, project: body.project || idea.project, task: body.task });
      updateIdea(ideaId, { status: 'ready-for-cursor' });
      const updated = getIdea(ideaId);
      return json({ ok: true, idea: updated, prompt, kind: 'cursor' });
    }

    if (subAction === 'codex-prompt') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const prompt = createCodexPrompt({ idea, project: body.project || idea.project, task: body.task });
      updateIdea(ideaId, { status: 'ready-for-codex' });
      const updated = getIdea(ideaId);
      return json({ ok: true, idea: updated, prompt, kind: 'codex' });
    }

    return null;
  }

  // GET /api/ideas/:id
  const ideaIdMatch = path.match(/^\/api\/ideas\/([^/]+)$/);
  if (ideaIdMatch) {
    const ideaId = ideaIdMatch[1];
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const idea = getIdea(ideaId);
    if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
    return json({ ok: true, idea });
  }

  return null;
}
