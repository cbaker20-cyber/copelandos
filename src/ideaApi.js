import {
  validateIdeaInput,
  createIdea,
  getIdea,
  getIdeaStats,
  getProjectQueues,
  listIdeas,
  dismissIdea,
  planIdea,
  triageIdea,
  updateIdea,
  VALID_STATUSES,
} from './ideaStore.js';
import { classify, classifyWithContext } from './ideaClassifier.js';
import { createPlan, createCursorPrompt, createCodexPrompt } from './planner.js';
import { listProviderStatuses } from './providerRouter.js';
import { publicSkillSummary, listSkills } from './skills.js';
import { getRegistrySummary } from './toolRegistry.js';
import { writeDailyIdeaAppend, writeIdeaNote, convertIdeaToNote, persistVaultDocument } from './vault.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handleIdeaRequest({ path, request, body, env, json }) {
  if (path === '/api/brain/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({
      ok: true,
      mode: 'scaffold',
      classifier: 'deterministic-rules',
      planner: 'ready',
      council: 'mock-mode',
      execution: 'disabled',
      skills: listSkills().map(publicSkillSummary),
      providers: listProviderStatuses(env),
      registries: getRegistrySummary(),
      guarantees: [
        'Captured ideas are not executed automatically.',
        'Medium/high risk work requires human confirmation.',
        'Provider states require env vars and are never faked.',
      ],
    });
  }

  if (path === '/api/orchestration/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({
      ok: true,
      status: 'ready-for-setup',
      pipeline: [
        'capture idea',
        'inbox',
        'classifier',
        'skill selection',
        'planner',
        'optional council',
        'provider router',
        'tool/MCP policy',
        'vault memory',
        'Cursor/Codex prompt',
      ],
      automaticExecution: false,
      projectQueues: getProjectQueues(),
    });
  }

  if (path === '/api/project-queue') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, queues: getProjectQueues() });
  }

  // POST /api/capture/idea
  if (path === '/api/capture/idea') {
    const guard = methodGuard(request, ['POST'], json);
    if (guard) return guard;

    const validation = validateIdeaInput(body);
    if (!validation.ok) return json({ ok: false, error: validation.error }, 400);

    const classification = classifyWithContext(validation.text, {
      project: validation.project,
      tags: validation.tags,
    });

    const idea = createIdea(validation, classification);
    const vault = await persistCapturedIdea(idea, env);
    return json({ ok: true, idea, classification, vault }, 201);
  }

  // GET /api/ideas/stats
  if (path === '/api/ideas/stats') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, stats: getIdeaStats() });
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

  // Subaction routes: /api/ideas/:id/{triage,plan,convert,cursor-prompt,codex-prompt,dismiss}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|plan|convert|cursor-prompt|codex-prompt|dismiss)$/);
  if (subMatch) {
    const ideaId = subMatch[1];
    const subAction = subMatch[2];

    // POST /api/ideas/:id/triage
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

    // POST /api/ideas/:id/plan
    if (subAction === 'plan') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const plan = createPlan(body.task || idea.text);
      const updated = planIdea(ideaId, plan);
      return json({ ok: true, idea: updated, plan });
    }

    // POST /api/ideas/:id/convert
    if (subAction === 'convert') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const noteType = body.type || 'research';
      const validTypes = [
        'project', 'project-update',
        'decision', 'decision-log',
        'research', 'research-note',
        'meeting', 'meeting-note',
        'email', 'email-draft-note',
        'tasks', 'task-list',
        'idea', 'idea-note',
      ];
      if (!validTypes.includes(noteType)) {
        return json({ ok: false, error: `Invalid note type. Use: ${validTypes.join(', ')}` }, 400);
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

    // POST /api/ideas/:id/cursor-prompt
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

    // POST /api/ideas/:id/codex-prompt
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

    // POST /api/ideas/:id/dismiss
    if (subAction === 'dismiss') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      return json({ ok: true, idea: dismissIdea(ideaId) });
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

async function persistCapturedIdea(idea, env) {
  const ideaNote = writeIdeaNote(idea);
  const dailyAppend = writeDailyIdeaAppend(idea);
  const results = {};

  try {
    results.ideaNote = await persistVaultDocument(ideaNote, env);
  } catch (error) {
    results.ideaNote = { ok: false, error: error.message, mode: 'blocked' };
  }

  try {
    results.dailyAppend = await persistVaultDocument(dailyAppend, env);
  } catch (error) {
    results.dailyAppend = { ok: false, error: error.message, mode: 'blocked' };
  }

  return results;
}
