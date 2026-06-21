import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  sanitizePathSegment,
  validateVaultContent,
  convertIdeaToNote,
  persistVaultDocument,
  writeDailyIdeaAppend,
  writeEmailDraftNote,
  writeIdeaNote,
} from '../src/vault.js';

test('vault filenames are sanitized and traversal is blocked', () => {
  assert.equal(sanitizePathSegment('Project: Update?'), 'Project-Update');
  assert.throws(() => sanitizePathSegment('../secrets'), /Unsafe vault path/);
  assert.throws(() => sanitizePathSegment('folder\\secret'), /Unsafe vault path/);
});

test('vault content blocks obvious secrets and private-student flags', () => {
  assert.throws(() => validateVaultContent(`sk-${'a'.repeat(26)}`), /secret/i);
  assert.throws(() => validateVaultContent('ordinary note', { containsPrivateStudentData: true }), /Private student data/);
  assert.throws(() => validateVaultContent('student id 12345 should not be stored'), /private student data/i);
});

test('email notes remain visibly draft-only', () => {
  const note = writeEmailDraftNote('Hello there', 'Draft body');
  assert.match(note.content, /DRAFT — NOT SENT/);
  assert.match(note.path, /^Inbox\//);
});

test('Obsidian URI builders encode vault, file, and content', () => {
  const open = new URL(buildObsidianOpenUri('Copeland Vault', 'Projects/A & B.md'));
  assert.equal(open.protocol, 'obsidian:');
  assert.equal(open.searchParams.get('vault'), 'Copeland Vault');
  assert.equal(open.searchParams.get('file'), 'Projects/A & B.md');

  const created = new URL(buildObsidianNewUri('CopelandVault', 'Inbox/New note.md', '# Heading'));
  assert.equal(created.searchParams.get('content'), '# Heading');
  assert.equal(new URL(buildObsidianDailyUri('CopelandVault')).hostname, 'daily');
});

test('idea note path is sanitized and stays in Inbox', () => {
  const note = writeIdeaNote({
    id: '../bad/id',
    text: 'remember catalase lab analysis',
    source: 'siri',
    tags: ['mobile'],
    status: 'new',
    riskLevel: 'safe',
  });
  assert.match(note.path, /^Inbox\/idea-/);
  assert.equal(note.path.includes('..'), false);
  assert.equal(note.path.includes('\\'), false);
});

test('daily idea append document targets sanitized daily note path', () => {
  const document = writeDailyIdeaAppend({
    id: 'idea-123',
    text: 'captured thought',
    source: 'mobile-web',
    tags: ['mobile'],
    status: 'new',
    riskLevel: 'safe',
    createdAt: '2026-06-21T12:00:00.000Z',
  }, '2026-06-21');
  assert.equal(document.append, true);
  assert.equal(document.path, 'Daily/2026-06-21.md');
  assert.match(document.content, /Captured idea: idea-123/);
});

test('convertIdeaToNote supports explicit conversion aliases', () => {
  const idea = { id: 'idea-1', text: 'make a decision log', source: 'manual', tags: [] };
  assert.match(convertIdeaToNote(idea, 'project-update').path, /^Projects\//);
  assert.match(convertIdeaToNote(idea, 'decision-log').path, /^Decisions\//);
  assert.match(convertIdeaToNote(idea, 'research-note').path, /^Research\//);
  assert.match(convertIdeaToNote(idea, 'meeting-note').path, /^BandCouncil\//);
  assert.match(convertIdeaToNote(idea, 'task-list').path, /^Projects\//);
  assert.match(convertIdeaToNote(idea, 'email-draft-note').path, /^Inbox\//);
  assert.match(convertIdeaToNote(idea, 'idea-note').path, /^Inbox\//);
});

test('persistVaultDocument appends daily note content in GitHub mode', async () => {
  const existing = btoa('# 2026-06-21\n\nExisting line\n');
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) {
      return Response.json({ sha: 'abc123', content: existing });
    }
    return Response.json({ content: { path: 'CopelandVault/Daily/2026-06-21.md' } });
  };
  const result = await persistVaultDocument({
    path: 'Daily/2026-06-21.md',
    content: '## Captured idea\n\nNew line\n',
    append: true,
  }, {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/private-vault',
  }, fetchImpl);

  assert.equal(result.ok, true);
  const put = calls.find(call => call.options.method === 'PUT');
  const body = JSON.parse(put.options.body);
  const decoded = atob(body.content);
  assert.match(decoded, /Existing line/);
  assert.match(decoded, /New line/);
  assert.equal(body.sha, 'abc123');
});
