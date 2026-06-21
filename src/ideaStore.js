// In-memory idea inbox.
// For production, bind an IDEAS_KV Cloudflare KV namespace and replace the
// Map operations with KV get/put/list calls. This module-level Map persists
// within a single Worker isolate but is not durable across restarts.

const inbox = new Map();

const VALID_STATUSES = new Set([
  'new', 'triaged', 'planned', 'ready-for-cursor',
  'ready-for-codex', 'converted-to-note', 'dismissed',
]);

const VALID_SOURCES = new Set([
  'siri', 'shortcuts', 'mobile-web', 'dashboard', 'manual',
]);

const MAX_TEXT_LENGTH = 5000;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS = 10;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `idea-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeText(value, maxLength = MAX_TEXT_LENGTH) {
  const str = String(value || '').trim();
  return str.slice(0, maxLength);
}

function sanitizeProject(value) {
  const text = sanitizeText(value, 80);
  if (!text) return null;
  return text
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\0]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || null;
}

function sanitizeTag(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH);
}

function sanitizeTags(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeTag)
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

export function validateIdeaInput(body) {
  const text = sanitizeText(body.text);
  if (!text) return { ok: false, error: 'Idea text is required.' };
  if ((body.text || '').length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Idea text exceeds ${MAX_TEXT_LENGTH} character limit.` };
  }

  const source = VALID_SOURCES.has(body.source) ? body.source : 'manual';
  const tags = sanitizeTags(body.tags);
  const project = sanitizeProject(body.project);
  const urgency = ['low', 'medium', 'high'].includes(body.urgency) ? body.urgency : 'medium';

  return { ok: true, text, source, tags, project, urgency };
}

export function createIdea(validated, classification = {}) {
  const now = new Date().toISOString();
  const idea = {
    id: generateId(),
    text: validated.text,
    source: validated.source,
    tags: validated.tags,
    project: validated.project,
    urgency: validated.urgency,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    category: classification.category || null,
    skill: classification.skill || null,
    riskLevel: classification.riskLevel || null,
    suggestedAction: classification.suggestedAction || null,
    confirmationRequired: classification.confirmationRequired || false,
  };
  inbox.set(idea.id, idea);
  return idea;
}

export function getIdea(id) {
  return inbox.get(String(id)) || null;
}

export function listIdeas({ status, limit = 50, offset = 0 } = {}) {
  let ideas = [...inbox.values()];
  if (status) ideas = ideas.filter(i => i.status === status);
  ideas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    ideas: ideas.slice(offset, offset + limit),
    total: ideas.length,
    offset,
    limit,
  };
}

export function updateIdea(id, patch) {
  const idea = inbox.get(String(id));
  if (!idea) return null;
  const allowed = [
    'status', 'category', 'skill', 'riskLevel',
    'suggestedAction', 'confirmationRequired', 'tags', 'project',
  ];
  for (const key of allowed) {
    if (key in patch) idea[key] = patch[key];
  }
  idea.updatedAt = new Date().toISOString();
  inbox.set(id, idea);
  return idea;
}

export function triageIdea(id, triageData) {
  const idea = getIdea(id);
  if (!idea) return null;
  if (!VALID_STATUSES.has(triageData.status || '')) {
    return { ok: false, error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  return { ok: true, idea: updateIdea(id, triageData) };
}

export function planIdea(id) {
  const idea = getIdea(id);
  if (!idea) return null;
  return updateIdea(id, { status: 'planned' });
}

export function dismissIdea(id) {
  const idea = getIdea(id);
  if (!idea) return null;
  return updateIdea(id, { status: 'dismissed' });
}

export function getIdeaStats() {
  const byStatus = Object.fromEntries([...VALID_STATUSES].map(status => [status, 0]));
  const byRisk = { safe: 0, medium: 0, high: 0, unknown: 0 };
  const bySkill = {};
  for (const idea of inbox.values()) {
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
    const risk = idea.riskLevel || 'unknown';
    byRisk[risk] = (byRisk[risk] || 0) + 1;
    const skill = idea.skill || 'unassigned';
    bySkill[skill] = (bySkill[skill] || 0) + 1;
  }
  return {
    total: inbox.size,
    byStatus,
    byRisk,
    bySkill,
    open: [...inbox.values()].filter(idea => !['converted-to-note', 'dismissed'].includes(idea.status)).length,
  };
}

function inferProjectId(idea) {
  const text = `${idea.project || ''} ${idea.tags.join(' ')} ${idea.text}`.toLowerCase();
  if (idea.project) return idea.project;
  if (/score\s*scanner|musicxml|score/.test(text)) return 'score-scanner';
  if (/jazzbackend|jazz|rhythm|sight.?reading/.test(text)) return 'jazz-backend';
  if (/connectome|neuroscience|research/.test(text)) return 'connectome-perturbation';
  if (/band\s*council|agenda|minutes|delegation/.test(text)) return 'band-council-agent';
  if (/copelandos|jarvis|dashboard|worker|cloudflare/.test(text)) return 'copelandos';
  return 'inbox';
}

export function getProjectQueues(projects = []) {
  const knownProjects = new Set(projects.map(project => project.id));
  const queues = Object.fromEntries(projects.map(project => [project.id, {
    projectId: project.id,
    displayName: project.displayName,
    readyForCursor: [],
    readyForCodex: [],
    planned: [],
    newIdeas: [],
  }]));
  queues.inbox = { projectId: 'inbox', displayName: 'Idea Inbox', readyForCursor: [], readyForCodex: [], planned: [], newIdeas: [] };

  for (const idea of inbox.values()) {
    const projectId = inferProjectId(idea);
    const queue = knownProjects.has(projectId) ? queues[projectId] : queues.inbox;
    const summary = {
      id: idea.id,
      text: idea.text.slice(0, 160),
      status: idea.status,
      skill: idea.skill,
      riskLevel: idea.riskLevel,
      suggestedAction: idea.suggestedAction,
      createdAt: idea.createdAt,
    };
    if (idea.status === 'ready-for-cursor') queue.readyForCursor.push(summary);
    else if (idea.status === 'ready-for-codex') queue.readyForCodex.push(summary);
    else if (idea.status === 'planned' || idea.status === 'triaged') queue.planned.push(summary);
    else if (idea.status === 'new') queue.newIdeas.push(summary);
  }

  return Object.values(queues).map(queue => ({
    ...queue,
    total: queue.readyForCursor.length + queue.readyForCodex.length + queue.planned.length + queue.newIdeas.length,
  }));
}

export function _clearInbox() {
  inbox.clear();
}

export { VALID_STATUSES, VALID_SOURCES, MAX_TEXT_LENGTH };
