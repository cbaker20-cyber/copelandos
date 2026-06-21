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
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

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
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return values
    .map(sanitizeTag)
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

export function validateIdeaInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const text = sanitizeText(input.text);
  if (!text) return { ok: false, error: 'Idea text is required.' };
  if (String(input.text || '').length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `Idea text exceeds ${MAX_TEXT_LENGTH} character limit.` };
  }

  const source = VALID_SOURCES.has(input.source) ? input.source : 'manual';
  const tags = sanitizeTags(input.tags || input.tag);
  const project = sanitizeText(input.project, 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || null;
  const urgency = ['low', 'medium', 'high'].includes(input.urgency) ? input.urgency : 'medium';

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
  const byStatus = Object.fromEntries([...VALID_STATUSES].map(status => [status, 0]));
  const byRisk = { safe: 0, medium: 0, high: 0, unknown: 0 };
  const bySkill = {};
  for (const idea of ideas) {
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
    byRisk[idea.riskLevel || 'unknown'] = (byRisk[idea.riskLevel || 'unknown'] || 0) + 1;
    if (idea.skill) bySkill[idea.skill] = (bySkill[idea.skill] || 0) + 1;
  }
  return {
    total: ideas.length,
    byStatus,
    byRisk,
    bySkill,
    open: ideas.filter(idea => !['converted-to-note', 'dismissed'].includes(idea.status)).length,
    readyForCursor: ideas.filter(idea => idea.status === 'ready-for-cursor').length,
    readyForCodex: ideas.filter(idea => idea.status === 'ready-for-codex').length,
  };
}

export function getProjectQueues() {
  const queues = {};
  for (const idea of inbox.values()) {
    const project = idea.project || 'unassigned';
    if (!queues[project]) {
      queues[project] = {
        project,
        total: 0,
        open: 0,
        highRisk: 0,
        readyForCursor: 0,
        readyForCodex: 0,
        ideas: [],
      };
    }
    queues[project].total += 1;
    if (!['converted-to-note', 'dismissed'].includes(idea.status)) queues[project].open += 1;
    if (idea.riskLevel === 'high') queues[project].highRisk += 1;
    if (idea.status === 'ready-for-cursor') queues[project].readyForCursor += 1;
    if (idea.status === 'ready-for-codex') queues[project].readyForCodex += 1;
    queues[project].ideas.push({
      id: idea.id,
      text: idea.text,
      status: idea.status,
      skill: idea.skill,
      riskLevel: idea.riskLevel,
      updatedAt: idea.updatedAt,
    });
  }
  return Object.values(queues).sort((a, b) => b.open - a.open || a.project.localeCompare(b.project));
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
  const next = { ...triageData, status: triageData.status || 'triaged' };
  if (!VALID_STATUSES.has(next.status || '')) {
    return { ok: false, error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  return { ok: true, idea: updateIdea(id, next) };
}

export function planIdea(id, plan) {
  const idea = getIdea(id);
  if (!idea) return null;
  return updateIdea(id, { status: 'planned', suggestedAction: plan?.steps?.[0] || idea.suggestedAction });
}

export function dismissIdea(id) {
  const idea = getIdea(id);
  if (!idea) return null;
  return updateIdea(id, { status: 'dismissed' });
}

export function _clearInbox() {
  inbox.clear();
}

export { VALID_STATUSES, VALID_SOURCES };
