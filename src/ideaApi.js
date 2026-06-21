import {
  validateIdeaInput,
  createIdea,
  getIdea,
  listIdeas,
  triageIdea,
  updateIdea,
  dismissIdea,
  getIdeaStats,
  getProjectQueues,
  VALID_STATUSES,
} from './ideaStore.js';
import { classify, classifyWithContext } from './ideaClassifier.js';
import { createPlan, createTaskBrief, createCursorPrompt, createCodexPrompt } from './planner.js';
import { writeIdeaNote, convertIdeaToNote, buildDailyIdeaAppend } from './vault.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handleIdeaRequest({ path, request, body, env, json }) {
  // GET /api/brain/status
  if (path === '/api/brain/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({
      ok: true,
      status: buildBrainStatus(env),
      stats: getIdeaStats(),
      projectQueues: getProjectQueues(),
    });
  }

  // GET /api/project-queue
  if (path === '/api/project-queue') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, queues: getProjectQueues() });
  }

  // GET /api/orchestration/status
  if (path === '/api/orchestration/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const queues = getProjectQueues();
    return json({
      ok: true,
      mode: 'scaffold',
      executesActions: false,
      queues,
      nextActions: queues.map((queue) => ({
        projectId: queue.projectId,
        suggestedAction: queue.highRisk > 0
          ? 'Review high-risk captured ideas before generating tasks.'
          : queue.needsTriage > 0
            ? 'Triage captured ideas into plans or prompts.'
            : 'Generate Cursor/Codex prompts for ready ideas.',
      })),
      safety: 'Captured ideas become plans, vault notes, or prompts only; no deploys, merges, sends, or shell execution.',
    });
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
    try {
      const document = writeIdeaNote(idea);
      const vault = await persistVaultDocumentIfConfigured(document, env);
      updateIdea(idea.id, { vaultPath: vault.path, vaultMode: vault.mode });
      const updated = getIdea(idea.id);
      return json({
        ok: true,
        idea: updated,
        classification,
        vault: {
          ideaNote: vault,
          dailyAppend: buildDailyIdeaAppend(updated),
        },
      }, 201);
    } catch (err) {
      return json({ ok: false, error: err.message }, 400);
    }
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

  // Subaction routes: /api/ideas/:id/{triage,plan,dismiss,convert,cursor-prompt,codex-prompt}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|plan|dismiss|convert|cursor-prompt|codex-prompt)$/);
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
      const brief = createTaskBrief(body.task || idea.text);
      updateIdea(ideaId, { status: 'planned' });
      return json({ ok: true, idea: getIdea(ideaId), plan, brief });
    }

    // POST /api/ideas/:id/dismiss
    if (subAction === 'dismiss') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = dismissIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      return json({ ok: true, idea });
    }

    // POST /api/ideas/:id/convert
    if (subAction === 'convert') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const noteType = body.type || 'research-note';
      const validTypes = [
        'project', 'project-update', 'decision', 'decision-log',
        'research', 'research-note', 'meeting', 'meeting-note',
        'email', 'email-draft-note', 'tasks', 'task-list', 'idea',
      ];
      if (!validTypes.includes(noteType)) {
        return json({ ok: false, error: `Invalid note type. Use: ${validTypes.join(', ')}` }, 400);
      }

      try {
        const document = convertIdeaToNote(idea, noteType);
        const result = await persistVaultDocumentIfConfigured(document, env);
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

function buildBrainStatus(env) {
  const vaultConfigured = Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO);
  return {
    mode: 'working-scaffold',
    executesActionsAutomatically: false,
    stages: [
      { id: 'mobile-capture', label: 'Phone/Siri/mobile idea', status: 'ready for setup' },
      { id: 'capture-api', label: 'POST /api/capture/idea', status: 'configured' },
      { id: 'idea-inbox', label: 'Idea inbox', status: 'configured' },
      { id: 'classifier', label: 'Deterministic classifier', status: 'configured' },
      { id: 'skill-selection', label: 'Skill selection', status: 'configured' },
      { id: 'plan-mode', label: 'Planner', status: 'configured' },
      { id: 'ai-council', label: 'AI council', status: 'mock mode' },
      { id: 'provider-router', label: 'Provider router', status: 'ready for setup' },
      { id: 'tool-mcp-policy', label: 'Tool/MCP safety registry', status: 'configured' },
      { id: 'obsidian-memory', label: 'Obsidian/vault memory', status: vaultConfigured ? 'configured' : 'mock mode' },
      { id: 'task-prompts', label: 'Cursor/Codex prompt generation', status: 'configured' },
    ],
    safety: [
      'Captured ideas are never executed automatically.',
      'Medium and high risk ideas require confirmation.',
      'Gmail remains draft-only.',
      'No provider is marked connected without required env vars.',
    ],
  };
}

async function persistVaultDocumentIfConfigured(document, env) {
  const { persistVaultDocument } = await import('./vault.js');
  return persistVaultDocument(document, env);
}
