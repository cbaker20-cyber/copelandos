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
const MAX_PROJECT_LENGTH = 80;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `idea-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeText(value, maxLength = MAX_TEXT_LENGTH) {
  const str = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return str.slice(0, maxLength);
}

function sanitizeProject(value) {
  const project = sanitizeText(value, MAX_PROJECT_LENGTH)
    .replace(/[<>:"\\|?*\0]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!project || project.includes('..') || /[\\/]/.test(project)) return null;
  return project;
}

function sanitizeTag(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_TAG_LENGTH);
}

function sanitizeTags(raw) {
  const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return values
    .map(sanitizeTag)
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

export function validateIdeaInput(body) {
  const rawText = String(body.text || '');
  const text = sanitizeText(rawText);
  if (!text) return { ok: false, error: 'Idea text is required.' };
  if (rawText.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Idea text exceeds ${MAX_TEXT_LENGTH} character limit.` };
  }

  const source = VALID_SOURCES.has(body.source) ? body.source : 'manual';
  const tags = sanitizeTags(body.tags || body.tag);
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

export function getIdeaStats() {
  const stats = {
    total: inbox.size,
    byStatus: {},
    byRisk: {},
    bySource: {},
  };
  for (const status of VALID_STATUSES) stats.byStatus[status] = 0;
  for (const idea of inbox.values()) {
    stats.byStatus[idea.status] = (stats.byStatus[idea.status] || 0) + 1;
    const risk = idea.riskLevel || 'unknown';
    stats.byRisk[risk] = (stats.byRisk[risk] || 0) + 1;
    stats.bySource[idea.source] = (stats.bySource[idea.source] || 0) + 1;
  }
  return stats;
}

export function getProjectQueues() {
  const queues = {};
  for (const idea of inbox.values()) {
    const project = idea.project || 'unassigned';
    if (!queues[project]) queues[project] = [];
    queues[project].push(idea);
  }
  for (const project of Object.keys(queues)) {
    queues[project].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return queues;
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

export function triageIdea(id, triageData) {
  const idea = getIdea(id);
  if (!idea) return null;
  if (!VALID_STATUSES.has(triageData.status || '')) {
    return { ok: false, error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  return { ok: true, idea: updateIdea(id, triageData) };
}

export function _clearInbox() {
  inbox.clear();
}

export { VALID_STATUSES, VALID_SOURCES };
