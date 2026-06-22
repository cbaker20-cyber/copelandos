import {
  validateIdeaInput,
  createIdea,
  getIdea,
  listIdeas,
  triageIdea,
  updateIdea,
  getIdeaStats,
  getProjectQueue,
  VALID_STATUSES,
} from './ideaStore.js';
import { classify, classifyWithContext } from './ideaClassifier.js';
import { createPlan, createTaskBrief, createCursorPrompt, createCodexPrompt } from './planner.js';
import { writeIdeaNote, writeDailyIdeaAppend, convertIdeaToNote, persistVaultDocument } from './vault.js';

function methodGuard(request, allowed, json) {
  if (!allowed.includes(request.method)) {
    return json({ ok: false, error: `Method not allowed. Use: ${allowed.join(', ')}.` }, 405);
  }
  return null;
}

export async function handleIdeaRequest({ path, request, body, env, json }) {
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

    try {
      const idea = await createIdea(validation, classification, env);
      const vault = await persistCaptureVaultDocuments(idea, env);
      return json({ ok: true, idea, classification, storage: vault.storage, vault }, 201);
    } catch (error) {
      return json({ ok: false, error: error.message }, 500);
    }
  }

  // GET /api/ideas/stats
  if (path === '/api/ideas/stats') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, ...(await getIdeaStats(env)) });
  }

  // GET /api/ideas
  if (path === '/api/ideas') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const result = await listIdeas({
      status: VALID_STATUSES.has(status) ? status : null,
      limit,
      offset,
    }, env);
    return json({ ok: true, ...result });
  }

  // GET /api/project-queue
  if (path === '/api/project-queue') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const url = new URL(request.url);
    return json({ ok: true, ...(await getProjectQueue(url.searchParams.get('project') || null, env)) });
  }

  // GET /api/brain/status
  if (path === '/api/brain/status' || path === '/api/orchestration/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    const stats = await getIdeaStats(env);
    return json({
      ok: true,
      capture: { endpoint: '/api/capture/idea', executeAutomatically: false, storage: stats.storage },
      inbox: { total: stats.total, byStatus: stats.byStatus },
      classifier: { mode: 'deterministic-rules', aiLayer: 'scaffolded-not-connected' },
      planner: { mode: 'local-deterministic', council: 'mock-compatible' },
      prompts: { cursor: true, codex: true },
      safety: { highRiskAutoExecute: false, gmail: 'draft-only' },
    });
  }

  // Subaction routes: /api/ideas/:id/{triage,convert,plan,dismiss,cursor-prompt,codex-prompt}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|convert|plan|dismiss|cursor-prompt|codex-prompt)$/);
  if (subMatch) {
    const ideaId = subMatch[1];
    const subAction = subMatch[2];

    // POST /api/ideas/:id/triage
    if (subAction === 'triage') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const result = await triageIdea(ideaId, {
        status: body.status,
        category: body.category,
        skill: body.skill,
        riskLevel: body.riskLevel,
        suggestedAction: body.suggestedAction,
        confirmationRequired: body.confirmationRequired,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
      }, env);
      if (!result.ok) return json({ ok: false, error: result.error }, 400);

      const plan = createPlan(result.idea.text);
      return json({ ok: true, idea: result.idea, plan });
    }

    // POST /api/ideas/:id/convert
    if (subAction === 'convert') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const noteType = body.type || 'research';
      const validTypes = ['project', 'decision', 'research', 'meeting', 'email', 'tasks', 'idea', 'daily'];
      if (!validTypes.includes(noteType)) {
        return json({ ok: false, error: `Invalid note type. Use: ${validTypes.join(', ')}` }, 400);
      }

      try {
        const document = convertIdeaToNote(idea, noteType);
        const result = await persistVaultDocument(document, env);
        await updateIdea(ideaId, { status: 'converted-to-note' }, env);
        const updated = await getIdea(ideaId, env);
        return json({ ok: true, idea: updated, document, vault: result });
      } catch (err) {
        return json({ ok: false, error: err.message }, 400);
      }
    }

    // POST /api/ideas/:id/plan
    if (subAction === 'plan') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      const plan = createPlan(body.task || idea.text);
      const brief = createTaskBrief(body.task || idea.text);
      await updateIdea(ideaId, { status: 'planned' }, env);
      return json({ ok: true, idea: await getIdea(ideaId, env), plan, brief });
    }

    // POST /api/ideas/:id/dismiss
    if (subAction === 'dismiss') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
      await updateIdea(ideaId, { status: 'dismissed' }, env);
      return json({ ok: true, idea: await getIdea(ideaId, env), execute: false });
    }

    // POST /api/ideas/:id/cursor-prompt
    if (subAction === 'cursor-prompt') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const prompt = createCursorPrompt({ idea, project: body.project || idea.project, task: body.task });
      await updateIdea(ideaId, { status: 'ready-for-cursor' }, env);
      const updated = await getIdea(ideaId, env);
      return json({ ok: true, idea: updated, prompt, kind: 'cursor' });
    }

    // POST /api/ideas/:id/codex-prompt
    if (subAction === 'codex-prompt') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = await getIdea(ideaId, env);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const prompt = createCodexPrompt({ idea, project: body.project || idea.project, task: body.task });
      await updateIdea(ideaId, { status: 'ready-for-codex' }, env);
      const updated = await getIdea(ideaId, env);
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
    const idea = await getIdea(ideaId, env);
    if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);
    return json({ ok: true, idea });
  }

  return null;
}

async function persistCaptureVaultDocuments(idea, env) {
  const ideaDocument = writeIdeaNote(idea);
  const dailyDocument = writeDailyIdeaAppend(idea);
  const ideaNote = await persistVaultDocument(ideaDocument, env);
  const dailyAppend = await persistVaultDocument(dailyDocument, env);
  return {
    storage: {
      inbox: env?.IDEAS_KV || env?.IDEA_INBOX || env?.IDEAS ? 'kv' : 'memory',
      vault: ideaNote.mode,
      durable: Boolean(env?.IDEAS_KV || env?.IDEA_INBOX || env?.IDEAS || ideaNote.connected),
    },
    ideaNote,
    dailyAppend,
  };
}
