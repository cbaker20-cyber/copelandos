// Idea inbox storage.
// Cloudflare KV is used when env.IDEAS_KV, env.IDEA_INBOX, or env.IDEAS is
// bound. The in-memory Map remains as an honest mock/local fallback for tests
// and unconfigured development workers.

const inbox = new Map();
const INDEX_KEY = 'ideas/index';
const IDEA_PREFIX = 'ideas/';

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

function getIdeaKv(env) {
  return env?.IDEAS_KV || env?.IDEA_INBOX || env?.IDEAS || null;
}

function ideaKey(id) {
  return `${IDEA_PREFIX}${String(id)}`;
}

async function readJson(kv, key, fallback) {
  if (!kv) return fallback;
  const value = await kv.get(key, 'json').catch(async () => kv.get(key));
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

async function loadIndex(kv) {
  const index = await readJson(kv, INDEX_KEY, []);
  return Array.isArray(index) ? index.map(String) : [];
}

async function saveIndex(kv, ids) {
  await writeJson(kv, INDEX_KEY, [...new Set(ids.map(String))]);
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
  const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return values
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
  const tags = sanitizeTags([...(Array.isArray(body.tags) ? body.tags : []), body.tag].filter(Boolean));
  const project = sanitizeTag(body.project) || null;
  const urgency = ['low', 'medium', 'high'].includes(body.urgency) ? body.urgency : 'medium';

  return { ok: true, text, source, tags, project, urgency };
}

function buildIdea(validated, classification = {}) {
  const now = new Date().toISOString();
  return {
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
}

async function saveIdea(idea, env) {
  inbox.set(idea.id, idea);
  const kv = getIdeaKv(env);
  if (kv) {
    await writeJson(kv, ideaKey(idea.id), idea);
    const index = await loadIndex(kv);
    index.unshift(idea.id);
    await saveIndex(kv, index);
  }
  return idea;
}

export async function createIdea(validated, classification = {}, env) {
  return saveIdea(buildIdea(validated, classification), env);
}

export async function getIdea(id, env) {
  const kv = getIdeaKv(env);
  if (kv) {
    const idea = await readJson(kv, ideaKey(id), null);
    if (idea) inbox.set(idea.id, idea);
    return idea;
  }
  return inbox.get(String(id)) || null;
}

export async function listIdeas({ status, limit = 50, offset = 0 } = {}, env) {
  const kv = getIdeaKv(env);
  let ideas;
  if (kv) {
    const ids = await loadIndex(kv);
    ideas = (await Promise.all(ids.map(id => readJson(kv, ideaKey(id), null)))).filter(Boolean);
  } else {
    ideas = [...inbox.values()];
  }
  if (status) ideas = ideas.filter(i => i.status === status);
  ideas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    ideas: ideas.slice(offset, offset + limit),
    total: ideas.length,
    offset,
    limit,
  };
}

export async function updateIdea(id, patch, env) {
  const idea = await getIdea(id, env);
  if (!idea) return null;
  const allowed = [
    'status', 'category', 'skill', 'riskLevel',
    'suggestedAction', 'confirmationRequired', 'tags', 'project',
  ];
  for (const key of allowed) {
    if (key in patch) idea[key] = patch[key];
  }
  idea.updatedAt = new Date().toISOString();
  return saveIdea(idea, env);
}

export async function triageIdea(id, triageData, env) {
  const idea = await getIdea(id, env);
  if (!idea) return null;
  if (!VALID_STATUSES.has(triageData.status || '')) {
    return { ok: false, error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` };
  }
  return { ok: true, idea: await updateIdea(id, triageData, env) };
}

export async function getIdeaStats(env) {
  const { ideas, total } = await listIdeas({}, env);
  const byStatus = {};
  const byProject = {};
  for (const idea of ideas) {
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
    if (idea.project) byProject[idea.project] = (byProject[idea.project] || 0) + 1;
  }
  return {
    total,
    byStatus,
    byProject,
    storage: getIdeaKv(env) ? { mode: 'kv', durable: true } : { mode: 'memory', durable: false },
  };
}

export async function getProjectQueue(project, env) {
  const { ideas } = await listIdeas({ limit: 100 }, env);
  const queued = ideas.filter((idea) => {
    if (project && idea.project !== project) return false;
    return !['dismissed', 'converted-to-note'].includes(idea.status);
  });
  return {
    project: project || null,
    ideas: queued,
    total: queued.length,
  };
}

export function _clearInbox() {
  inbox.clear();
}

export { VALID_STATUSES, VALID_SOURCES };
