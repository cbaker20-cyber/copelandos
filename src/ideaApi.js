import {
  validateIdeaInput,
  createIdea,
  getIdea,
  listIdeas,
  triageIdea,
  updateIdea,
  dismissIdea,
  getIdeaStats,
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
      // Only pass explicit user-provided urgency; null triggers text-pattern detection
      urgency: validation.urgencyOverride,
    });

    const idea = createIdea(validation, classification);

    // Auto-write vault note (mock mode when GITHUB_TOKEN not configured)
    try {
      const vaultNote = writeIdeaNote(idea);
      idea._vaultNote = { path: vaultNote.path, mode: 'mock' };
    } catch {
      // Non-fatal — vault note is best-effort
    }

    return json({ ok: true, idea, classification }, 201);
  }

  // GET /api/ideas/stats — must come before /api/ideas/:id pattern
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

  // GET /api/brain/status — unified pipeline status
  if (path === '/api/brain/status') {
    const guard = methodGuard(request, ['GET'], json);
    if (guard) return guard;
    return json({ ok: true, status: buildBrainStatus(env) });
  }

  // Subaction routes: /api/ideas/:id/{triage,convert,cursor-prompt,codex-prompt,dismiss}
  const subMatch = path.match(/^\/api\/ideas\/([^/]+)\/(triage|convert|cursor-prompt|codex-prompt|dismiss)$/);
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
        const vaultResult = await persistVaultDocumentIfConfigured(document, env);
        updateIdea(ideaId, { status: 'converted-to-note' });
        const updated = getIdea(ideaId);
        return json({ ok: true, idea: updated, document, vault: vaultResult });
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
      const result = dismissIdea(ideaId);
      if (!result) return json({ ok: false, error: 'Idea not found.' }, 404);
      return json({ ok: true, idea: result.idea });
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
  const stages = [
    { id: 'capture', name: 'Idea Capture', status: 'ready', note: 'POST /api/capture/idea accepts ideas from Siri, Shortcuts, mobile-web, dashboard, or manual' },
    { id: 'inbox', name: 'Idea Inbox', status: 'ready', note: 'In-memory inbox — bind IDEAS_KV for durable persistence' },
    { id: 'classifier', name: 'Deterministic Classifier', status: 'ready', note: 'Rule-based category, skill, risk, urgency detection — AI layer hookable' },
    { id: 'skill-registry', name: 'Skill Registry', status: 'ready', note: 'config/skills.json loaded; 15+ skills defined' },
    { id: 'planner', name: 'AI Planner', status: 'ready', note: 'createPlan(), createTaskBrief(), createCursorPrompt(), createCodexPrompt() implemented' },
    { id: 'council', name: 'AI Council', status: 'mock', note: 'Council scaffold ready; real AI calls require OPENROUTER_API_KEY or similar' },
    { id: 'provider-router', name: 'Provider Router', status: env && (env.OPENROUTER_API_KEY || env.OPENAI_API_KEY) ? 'configured' : 'local-fallback', note: env && (env.OPENROUTER_API_KEY || env.OPENAI_API_KEY) ? 'Provider configured' : 'No provider key — local/Ollama fallback available' },
    { id: 'tool-registry', name: 'Tool & MCP Registry', status: 'ready', note: 'Allowlist-first; high-risk actions require confirmation' },
    { id: 'vault', name: 'Obsidian Vault', status: env && env.GITHUB_TOKEN ? 'configured' : 'mock', note: env && env.GITHUB_TOKEN ? 'GitHub-backed vault connected' : 'GITHUB_TOKEN not set — vault writes in mock mode' },
    { id: 'dashboard', name: 'Dashboard UI', status: 'ready', note: 'Mobile-first command center' },
    { id: 'cursor-codex', name: 'Cursor/Codex Prompts', status: 'ready', note: 'Prompt generation wired to idea and project registry' },
  ];

  return {
    pipeline: 'CopelandOS AI Brain',
    stages,
    summary: {
      ready: stages.filter(s => s.status === 'ready').length,
      configured: stages.filter(s => s.status === 'configured').length,
      mock: stages.filter(s => s.status === 'mock').length,
      localFallback: stages.filter(s => s.status === 'local-fallback').length,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function persistVaultDocumentIfConfigured(document, env) {
  const { persistVaultDocument } = await import('./vault.js');
  return persistVaultDocument(document, env);
}
