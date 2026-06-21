/**
 * In-memory idea inbox with safe ID generation and field validation.
 *
 * In a deployed Cloudflare Worker, this is an in-memory cache — ideas are
 * persisted to the vault via persistVaultDocument when GITHUB_TOKEN is set.
 * For a persistent inbox, replace this store with a KV binding.
 */

import { classifyIdea } from './ideaClassifier.js';
import { sanitizePathSegment } from './vault.js';

export const VALID_SOURCES = Object.freeze([
  'siri', 'shortcuts', 'mobile-web', 'dashboard', 'manual',
]);

export const VALID_STATUSES = Object.freeze([
  'new', 'triaged', 'planned', 'ready-for-cursor',
  'ready-for-codex', 'converted-to-note', 'dismissed',
]);

const MAX_IDEA_LENGTH = 4000;
const MAX_TAG_LENGTH = 40;
const MAX_TAGS = 10;

const _inbox = new Map();

function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `idea-${ts}-${rand}`;
}

function sanitizeText(value, label, maxLen) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty.`);
  if (trimmed.length > maxLen) throw new Error(`${label} exceeds maximum length of ${maxLen} characters.`);
  return trimmed;
}

function sanitizeSource(source) {
  if (!source) return 'manual';
  const s = String(source).toLowerCase().trim();
  return VALID_SOURCES.includes(s) ? s : 'manual';
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .slice(0, MAX_TAGS)
    .map((t) => sanitizePathSegment(String(t).toLowerCase().trim().slice(0, MAX_TAG_LENGTH), ''))
    .filter(Boolean);
}

function sanitizeProject(project) {
  if (!project) return null;
  const p = String(project).trim().slice(0, 60);
  return p || null;
}

function sanitizeUrgency(urgency) {
  const valid = ['low', 'medium', 'high'];
  if (!urgency) return 'medium';
  const u = String(urgency).toLowerCase().trim();
  return valid.includes(u) ? u : 'medium';
}

/**
 * Create and store a new idea. Returns the stored idea object.
 */
export function captureIdea(body) {
  const text = sanitizeText(body.text, 'text', MAX_IDEA_LENGTH);
  const source = sanitizeSource(body.source);
  const tags = sanitizeTags(body.tags || []);
  const project = sanitizeProject(body.project);
  const urgency = sanitizeUrgency(body.urgency);

  const classification = classifyIdea(text, { tags, source });

  const now = new Date().toISOString();
  const idea = {
    id: generateId(),
    text,
    source,
    tags,
    project,
    urgency,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    category: classification.category,
    skill: classification.skill,
    skillDisplayName: classification.skillDisplayName,
    riskLevel: classification.riskLevel,
    suggestedAction: classification.suggestedAction,
    confirmationRequired: classification.confirmationRequired,
    classifierVersion: classification.classifierVersion,
  };

  _inbox.set(idea.id, idea);
  return idea;
}

/**
 * List all ideas, newest first.
 */
export function listIdeas({ status, limit = 50 } = {}) {
  const all = [..._inbox.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (status && VALID_STATUSES.includes(status)) return all.filter((i) => i.status === status).slice(0, limit);
  return all.slice(0, limit);
}

/**
 * Get a single idea by id.
 */
export function getIdea(id) {
  return _inbox.get(String(id)) || null;
}

/**
 * Triage an idea: update status and optionally override classification.
 */
export function triageIdea(id, body) {
  const idea = getIdea(id);
  if (!idea) return null;

  const status = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'triaged';
  const notes = body.notes ? String(body.notes).trim().slice(0, 500) : undefined;

  const updated = {
    ...idea,
    status,
    updatedAt: new Date().toISOString(),
    ...(notes !== undefined && { triageNotes: notes }),
    ...(body.skill && { skill: String(body.skill).trim().slice(0, 60) }),
    ...(body.urgency && { urgency: sanitizeUrgency(body.urgency) }),
  };

  _inbox.set(id, updated);
  return updated;
}

/**
 * Convert an idea to a vault note type. Does not persist — returns the
 * document spec for the caller to persist.
 */
export function convertIdeaSpec(id, body) {
  const idea = getIdea(id);
  if (!idea) return null;

  const validTypes = ['project', 'decision', 'research', 'meeting', 'email', 'daily', 'tasks'];
  const type = body.type && validTypes.includes(body.type) ? body.type : 'research';

  const titleBase = body.title || idea.text.slice(0, 60);

  const content = [
    `Source: ${idea.source}`,
    `Tags: ${(idea.tags || []).join(', ') || 'none'}`,
    idea.project ? `Project: ${idea.project}` : null,
    `Category: ${idea.category}`,
    `Skill: ${idea.skillDisplayName || idea.skill || 'unknown'}`,
    `Risk level: ${idea.riskLevel}`,
    `Suggested action: ${idea.suggestedAction}`,
    `Captured: ${idea.createdAt}`,
    '',
    '## Idea',
    '',
    idea.text,
    '',
    body.additionalNotes ? `## Notes\n\n${String(body.additionalNotes).trim().slice(0, 2000)}` : null,
  ].filter((l) => l !== null).join('\n');

  return { type, title: titleBase, content, ideaId: id };
}

/**
 * Mark an idea as converted after a successful vault write.
 */
export function markConverted(id, vaultPath) {
  const idea = getIdea(id);
  if (!idea) return null;
  const updated = {
    ...idea,
    status: 'converted-to-note',
    updatedAt: new Date().toISOString(),
    vaultPath,
  };
  _inbox.set(id, updated);
  return updated;
}

/**
 * Clear the inbox (for testing only).
 */
export function _clearInbox() {
  _inbox.clear();
}
