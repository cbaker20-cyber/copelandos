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
  const str = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return str.slice(0, maxLength);
}

function sanitizeField(value, maxLength = 80) {
  return sanitizeText(value, maxLength)
    .replace(/[<>:"\\|?*\0]/g, '')
    .replace(/[/.]{2,}/g, '')
    .slice(0, maxLength)
    .trim();
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
  const project = sanitizeField(body.project, 80) || null;
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
  const ideas = [...inbox.values()];
  const byStatus = {};
  const byCategory = {};
  const byRisk = {};
  for (const idea of ideas) {
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
    byCategory[idea.category || 'uncategorized'] = (byCategory[idea.category || 'uncategorized'] || 0) + 1;
    byRisk[idea.riskLevel || 'unknown'] = (byRisk[idea.riskLevel || 'unknown'] || 0) + 1;
  }
  return {
    total: ideas.length,
    byStatus,
    byCategory,
    byRisk,
    confirmationRequired: ideas.filter((idea) => idea.confirmationRequired).length,
  };
}

export function getProjectQueues() {
  const queues = new Map();
  for (const idea of inbox.values()) {
    const projectId = idea.project || inferProjectId(idea);
    if (!projectId) continue;
    if (!queues.has(projectId)) queues.set(projectId, []);
    queues.get(projectId).push(idea);
  }

  return [...queues.entries()].map(([projectId, ideas]) => ({
    projectId,
    total: ideas.length,
    readyForCursor: ideas.filter((idea) => idea.status === 'ready-for-cursor').length,
    readyForCodex: ideas.filter((idea) => idea.status === 'ready-for-codex').length,
    needsTriage: ideas.filter((idea) => idea.status === 'new' || idea.status === 'triaged').length,
    highRisk: ideas.filter((idea) => idea.riskLevel === 'high').length,
    ideas: ideas
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((idea) => ({
        id: idea.id,
        text: idea.text,
        status: idea.status,
        skill: idea.skill,
        riskLevel: idea.riskLevel,
        updatedAt: idea.updatedAt,
      })),
  }));
}

export function updateIdea(id, patch) {
  const idea = inbox.get(String(id));
  if (!idea) return null;
  const allowed = [
    'status', 'category', 'skill', 'riskLevel',
    'suggestedAction', 'confirmationRequired', 'tags', 'project',
    'urgency', 'vaultPath', 'vaultMode',
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
  const status = triageData.status || 'triaged';
  if (!VALID_STATUSES.has(status)) {
    return { ok: false, error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  return { ok: true, idea: updateIdea(id, { ...triageData, status }) };
}

export function dismissIdea(id) {
  const idea = getIdea(id);
  if (!idea) return null;
  return updateIdea(id, { status: 'dismissed' });
}

export function _clearInbox() {
  inbox.clear();
}

function inferProjectId(idea) {
  const text = `${idea.text || ''} ${(idea.tags || []).join(' ')}`.toLowerCase();
  if (text.includes('jazzbackend') || text.includes('jazz backend')) return 'jazz-backend';
  if (text.includes('score scanner') || text.includes('musicxml') || text.includes('score-scanner')) return 'score-scanner';
  if (text.includes('band council')) return 'band-council-agent';
  if (text.includes('connectome')) return 'connectome-perturbation';
  if (text.includes('copelandos') || text.includes('brain pipeline')) return 'copelandos';
  return null;
}

export { VALID_STATUSES, VALID_SOURCES };
