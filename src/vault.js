const NOTE_TYPES = Object.freeze({
  daily: 'Daily',
  project: 'Projects',
  decision: 'Decisions',
  research: 'Research',
  meeting: 'BandCouncil',
  email: 'Inbox',
  tasks: 'Projects',
  idea: 'Inbox',
});

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/i,
  /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
];

const PRIVATE_STUDENT_PATTERNS = [
  /\b(student\s*id|school\s*id)\b/i,
  /\b(iep|504\s*plan|discipline|detention|suspension)\b/i,
  /\b(parent|guardian)\s+(phone|email|contact)\b/i,
  /\b[A-Z][a-z]+ [A-Z][a-z]+\s+(grade|gpa|absence|medical|address)\b/,
];

export const VAULT_STRUCTURE = Object.freeze([
  'Daily', 'Projects', 'School', 'BandCouncil', 'Music', 'Research', 'Decisions', 'Inbox', 'Templates',
]);

export const VAULT_TEMPLATES = Object.freeze({
  daily: '# {{date}}\n\n## Daily mission\n\n- [ ] \n\n## Notes\n',
  project: '# {{project}} update\n\n## Progress\n\n## Blockers\n\n## Next action\n',
  decision: '# Decision: {{title}}\n\n## Context\n\n## Decision\n\n## Consequences\n',
  research: '# Research: {{topic}}\n\n## Question\n\n## Sources\n\n## Notes\n',
  meeting: '# Meeting: {{title}}\n\n## Agenda\n\n## Decisions\n\n## Actions\n',
  email: '# Email draft: {{subject}}\n\n> DRAFT — NOT SENT\n\n## Draft\n',
  tasks: '# {{project}} tasks\n\n- [ ] \n',
  idea: '# Idea capture: {{id}}\n\n## Raw idea\n\n{{text}}\n\n## Triage\n\n- Source: {{source}}\n- Skill: {{skill}}\n- Risk: {{risk}}\n',
  ideaTriaged: '# Idea triage: {{id}}\n\n## Classification\n\n- Category: {{category}}\n- Skill: {{skill}}\n- Risk: {{risk}}\n\n## Suggested action\n\n{{suggestedAction}}\n',
});

export function sanitizePathSegment(value, fallback = 'note') {
  const input = String(value || '').normalize('NFKC').trim();
  if (!input || input.includes('..') || /[\\/\0]/.test(input)) {
    if (!input) return fallback;
    throw new Error('Unsafe vault path segment.');
  }
  const safe = input
    .replace(/[<>:"|?*#\[\]]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  if (!safe) throw new Error('Vault filename is empty after sanitization.');
  return safe;
}

export function validateVaultContent(content, { containsPrivateStudentData = false } = {}) {
  const text = String(content || '');
  if (containsPrivateStudentData) throw new Error('Private student data is not allowed in the vault integration.');
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) throw new Error('Potential secret detected; vault write blocked.');
  if (PRIVATE_STUDENT_PATTERNS.some((pattern) => pattern.test(text))) throw new Error('Potential private student data detected; vault write blocked.');
  return text;
}

function createDocument(type, title, content, options = {}) {
  const folder = NOTE_TYPES[type];
  if (!folder) throw new Error(`Unsupported vault note type: ${type}`);
  const safeTitle = sanitizePathSegment(title);
  const safeContent = validateVaultContent(content, options);
  const prefix = type === 'email' ? '> DRAFT — NOT SENT\n\n' : '';
  return {
    type,
    folder,
    title: String(title || safeTitle),
    path: `${folder}/${safeTitle}.md`,
    content: `# ${String(title || safeTitle).trim()}\n\n${prefix}${safeContent}`,
  };
}

export function writeDailyNote(date, content, options) {
  return createDocument('daily', String(date), content, options);
}

export function writeProjectUpdate(projectId, content, options) {
  return createDocument('project', `${projectId}-update`, content, options);
}

export function writeDecisionLog(title, content, options) {
  return createDocument('decision', title, content, options);
}

export function writeResearchNote(topic, content, options) {
  return createDocument('research', topic, content, options);
}

export function writeMeetingNote(title, content, options) {
  return createDocument('meeting', title, content, options);
}

export function writeEmailDraftNote(subject, content, options) {
  return createDocument('email', subject, content, options);
}

export function writeIdeaNote(idea, options) {
  const date = new Date().toISOString().slice(0, 10);
  const idFragment = sanitizePathSegment(String(idea.id || 'captured').slice(0, 12), 'captured');
  const title = `idea-${date}-${idFragment}`;
  const content = [
    `**Source:** ${idea.source || 'manual'}`,
    `**Tags:** ${(idea.tags || []).join(', ') || 'none'}`,
    `**Risk level:** ${idea.riskLevel || 'unknown'}`,
    `**Status:** ${idea.status || 'new'}`,
    idea.project ? `**Project:** ${idea.project}` : '',
    '',
    '## Idea',
    '',
    idea.text || '',
    '',
    idea.suggestedAction ? `## Suggested action\n\n${idea.suggestedAction}` : '',
  ].filter(s => s !== null).join('\n');

  return createDocument('idea', title, content.trim(), options);
}

export function buildDailyIdeaAppend(idea, date = new Date().toISOString().slice(0, 10), options) {
  const safeDate = sanitizePathSegment(date, new Date().toISOString().slice(0, 10));
  const content = validateVaultContent([
    `- ${new Date().toISOString()} [${idea.source || 'manual'}] ${idea.text || ''}`,
    `  - Status: ${idea.status || 'new'}`,
    `  - Skill: ${idea.skill || 'unassigned'}`,
    `  - Risk: ${idea.riskLevel || 'unknown'}`,
    idea.suggestedAction ? `  - Suggested action: ${idea.suggestedAction}` : '',
  ].filter(Boolean).join('\n'), options);
  return {
    type: 'daily-idea-append',
    folder: 'Daily',
    title: safeDate,
    path: `Daily/${safeDate}.md`,
    content,
    append: true,
    section: '## Captured ideas',
  };
}

export function writeDailyIdeaAppend(idea, options) {
  return buildDailyIdeaAppend(idea, new Date().toISOString().slice(0, 10), options);
}

function normalizeIdeaNoteType(noteType) {
  const key = String(noteType || 'idea').trim().toLowerCase();
  const aliases = {
    'project-update': 'project',
    'decision-log': 'decision',
    'research-note': 'research',
    'meeting-note': 'meeting',
    'task-list': 'tasks',
    'email-draft': 'email',
    'email-draft-note': 'email',
    'idea-note': 'idea',
  };
  return aliases[key] || key;
}

export function convertIdeaToNote(idea, noteType) {
  const normalizedType = normalizeIdeaNoteType(noteType);
  const text = idea.text || '';
  const date = new Date().toISOString().slice(0, 10);
  switch (normalizedType) {
    case 'project':
      return writeProjectUpdate(idea.project || 'idea', `From captured idea (${date}):\n\n${text}`);
    case 'decision':
      return writeDecisionLog(`Decision from idea ${date}`, `Context:\n\n${text}\n\nDecision:\n\nTBD`);
    case 'research':
      return writeResearchNote(`Research: ${text.slice(0, 50)}`, `Source idea:\n\n${text}`);
    case 'meeting':
      return writeMeetingNote(`Meeting note ${date}`, text);
    case 'email':
      return writeEmailDraftNote(`Draft from idea ${date}`, text);
    case 'tasks':
      return writeTaskList(idea.project || 'ideas', [text]);
    case 'idea':
    default:
      return writeIdeaNote(idea);
  }
}

export function getSupportedIdeaNoteTypes() {
  return ['project', 'project-update', 'decision', 'decision-log', 'research', 'research-note', 'meeting', 'meeting-note', 'email', 'email-draft-note', 'tasks', 'task-list', 'idea', 'idea-note'];
}

export function writeTaskList(projectId, tasks, options) {
  const lines = Array.isArray(tasks) ? tasks.map((task) => `- [ ] ${String(task)}`).join('\n') : String(tasks || '');
  return createDocument('tasks', `${projectId}-tasks`, lines, options);
}

function obsidianUri(action, params) {
  const query = new URLSearchParams(params);
  return `obsidian://${action}?${query.toString()}`;
}

export function buildObsidianOpenUri(vault, file) {
  return obsidianUri('open', { vault: String(vault || ''), file: String(file || '') });
}

export function buildObsidianNewUri(vault, file, content) {
  return obsidianUri('new', { vault: String(vault || ''), file: String(file || ''), content: String(content || '') });
}

export function buildObsidianDailyUri(vault) {
  return obsidianUri('daily', { vault: String(vault || '') });
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(text) {
  const binary = atob(String(text || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function appendVaultContent(existingContent, document) {
  const section = document.section || '## Appended notes';
  const current = String(existingContent || '').trimEnd();
  const addition = String(document.content || '').trim();
  if (!current) return `# ${document.title}\n\n${section}\n\n${addition}\n`;
  if (current.includes(section)) return `${current}\n${addition}\n`;
  return `${current}\n\n${section}\n\n${addition}\n`;
}

export async function persistVaultDocument(document, env, fetchImpl = fetch) {
  const root = sanitizePathSegment(env.VAULT_ROOT || 'CopelandVault', 'CopelandVault');
  const fullPath = `${root}/${document.path}`;
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return { ok: true, connected: false, mode: 'mock', path: fullPath, document };
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPO)) throw new Error('Invalid GITHUB_REPO value.');

  const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${fullPath.split('/').map(encodeURIComponent).join('/')}`;
  const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'CopelandOS' };
  const existing = await fetchImpl(apiUrl, { headers });
  let sha;
  let existingContent = '';
  if (existing.ok) {
    const existingJson = await existing.json();
    sha = existingJson.sha;
    if (document.append && existingJson.content) existingContent = decodeBase64(existingJson.content);
  }
  else if (existing.status !== 404) throw new Error(`Vault lookup failed (${existing.status}).`);

  const content = document.append ? appendVaultContent(existingContent, document) : document.content;
  const payload = {
    message: `CopelandOS vault: ${document.path}`,
    content: encodeBase64(content),
    branch: env.VAULT_BRANCH || 'main',
  };
  if (sha) payload.sha = sha;
  const response = await fetchImpl(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Vault write failed (${response.status}).`);
  return { ok: true, connected: true, mode: 'github', path: fullPath };
}
