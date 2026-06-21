import {
  validateIdeaInput,
  createIdea,
  getIdea,
  listIdeas,
  triageIdea,
  updateIdea,
  VALID_STATUSES,
} from './ideaStore.js';
import { classify, classifyWithContext } from './ideaClassifier.js';
import { createPlan, createCursorPrompt, createCodexPrompt } from './planner.js';
import { writeIdeaNote, convertIdeaToNote } from './vault.js';

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

    const idea = createIdea(validation, classification);
    return json({ ok: true, idea, classification }, 201);
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

  // Subaction routes: /api/ideas/:id/{triage,convert,cursor-prompt,codex-prompt}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|convert|cursor-prompt|codex-prompt)$/);
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
        status: body.status,
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

    // POST /api/ideas/:id/convert
    if (subAction === 'convert') {
      const guard = methodGuard(request, ['POST'], json);
      if (guard) return guard;
      const idea = getIdea(ideaId);
      if (!idea) return json({ ok: false, error: 'Idea not found.' }, 404);

      const noteType = body.type || 'research';
      const validTypes = ['project', 'decision', 'research', 'meeting', 'email', 'tasks', 'idea'];
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

async function persistVaultDocumentIfConfigured(document, env) {
  const { persistVaultDocument } = await import('./vault.js');
  return persistVaultDocument(document, env);
}
