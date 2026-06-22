import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendIdeaToDailyNote,
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  convertIdeaToNote,
  persistVaultDocument,
  sanitizePathSegment,
  validateVaultContent,
  writeEmailDraftNote,
} from '../src/vault.js';

test('vault filenames are sanitized and traversal is blocked', () => {
  assert.equal(sanitizePathSegment('Project: Update?'), 'Project-Update');
  assert.throws(() => sanitizePathSegment('../secrets'), /Unsafe vault path/);
  assert.throws(() => sanitizePathSegment('folder\\secret'), /Unsafe vault path/);
});

test('vault content blocks obvious secrets and private-student flags', () => {
  assert.throws(() => validateVaultContent(`sk-${'a'.repeat(26)}`), /secret/i);
  assert.throws(() => validateVaultContent('ordinary note', { containsPrivateStudentData: true }), /Private student data/);
  assert.throws(() => validateVaultContent('student ID number is private'), /private student data/i);
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

test('idea conversion aliases create expected vault paths', () => {
  const idea = { id: 'idea-1', text: 'research catalase reaction notes', source: 'manual', tags: [] };
  const research = convertIdeaToNote(idea, 'research-note');
  assert.match(research.path, /^Research\//);

  const email = convertIdeaToNote(idea, 'email-draft-note');
  assert.match(email.path, /^Inbox\//);
  assert.match(email.content, /DRAFT/);
});

test('daily idea append document has sanitized path and append flag', () => {
  const idea = {
    id: '../bad',
    text: 'remember catalase lab analysis',
    source: 'siri',
    tags: ['mobile'],
    status: 'new',
    riskLevel: 'safe',
    createdAt: '2026-06-22T00:00:00.000Z',
  };
  const document = appendIdeaToDailyNote(idea, '2026-06-22');
  assert.equal(document.path, 'Daily/2026-06-22.md');
  assert.equal(document.append, true);
  assert.match(document.content, /Captured idea/);
});

test('persistVaultDocument appends to existing daily note in GitHub mode', async () => {
  const document = appendIdeaToDailyNote({
    text: 'daily append test',
    source: 'manual',
    tags: [],
    status: 'new',
    riskLevel: 'safe',
  }, '2026-06-22');
  let putPayload = null;
  const existingContent = Buffer.from('# 2026-06-22\n\nExisting note\n').toString('base64');
  const fetchImpl = async (url, options = {}) => {
    if (!options.method) {
      return Response.json({ sha: 'abc123', content: existingContent });
    }
    putPayload = JSON.parse(options.body);
    return Response.json({ ok: true });
  };

  const result = await persistVaultDocument(document, {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/vault',
  }, fetchImpl);
  assert.equal(result.connected, true);
  assert.equal(putPayload.sha, 'abc123');
  const written = Buffer.from(putPayload.content, 'base64').toString('utf8');
  assert.match(written, /Existing note/);
  assert.match(written, /daily append test/);
});
