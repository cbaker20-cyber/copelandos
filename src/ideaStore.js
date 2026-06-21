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
  const project = sanitizeText(body.project, 80) || null;
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

export function getIdeaStats() {
  const all = [...inbox.values()];
  const byStatus = {};
  for (const status of VALID_STATUSES) byStatus[status] = 0;
  for (const idea of all) {
    if (byStatus[idea.status] !== undefined) byStatus[idea.status]++;
    else byStatus[idea.status] = 1;
  }

  const bySource = {};
  for (const idea of all) {
    bySource[idea.source] = (bySource[idea.source] || 0) + 1;
  }

  const byRisk = { safe: 0, medium: 0, high: 0, unknown: 0 };
  for (const idea of all) {
    const r = idea.riskLevel || 'unknown';
    byRisk[r] = (byRisk[r] || 0) + 1;
  }

  const pendingConfirmation = all.filter(i => i.confirmationRequired && i.status === 'new').length;
  const readyForAction = all.filter(i =>
    i.status === 'ready-for-cursor' || i.status === 'ready-for-codex'
  ).length;

  return {
    total: all.length,
    byStatus,
    bySource,
    byRisk,
    pendingConfirmation,
    readyForAction,
  };
}

// Test helper only — clears the in-memory inbox for isolation.
export function _clearInbox() {
  inbox.clear();
}

export { VALID_STATUSES, VALID_SOURCES };
