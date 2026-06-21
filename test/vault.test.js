import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  sanitizePathSegment,
  validateVaultContent,
  buildDailyIdeaAppend,
  convertIdeaToNote,
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
  assert.throws(() => validateVaultContent('Student ID 12345 belongs in this note'), /private student/i);
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

test('idea note path is sanitized and includes capture metadata', () => {
  const note = writeIdeaNote({
    id: '../unsafe/id',
    text: 'remember catalase lab analysis',
    source: 'siri',
    tags: ['mobile'],
    urgency: 'high',
    category: 'school',
    skill: 'lab-analysis',
    riskLevel: 'safe',
    status: 'new',
  });
  assert.match(note.path, /^Inbox\/idea-/);
  assert.ok(!note.path.includes('..'));
  assert.match(note.content, /Urgency/);
  assert.match(note.content, /lab-analysis/);
});

test('daily idea append block is generated without executing action', () => {
  const block = buildDailyIdeaAppend({
    id: 'idea-1',
    text: 'fix JazzBackend rhythm test',
    source: 'shortcuts',
    status: 'new',
    riskLevel: 'safe',
    skill: 'coding',
  });
  assert.match(block, /Captured idea/);
  assert.match(block, /No action was executed automatically/);

  const note = writeDailyIdeaAppend({ id: 'idea-1', text: 'daily append' }, '2026-06-21');
  assert.equal(note.type, 'daily');
  assert.match(note.path, /Daily\/2026-06-21\.md/);
});

test('convertIdeaToNote supports explicit conversion aliases', () => {
  const idea = { text: 'draft a Band Council agenda', project: 'band-council-agent' };
  assert.equal(convertIdeaToNote(idea, 'project-update').type, 'project');
  assert.equal(convertIdeaToNote(idea, 'decision-log').type, 'decision');
  assert.equal(convertIdeaToNote(idea, 'research-note').type, 'research');
  assert.equal(convertIdeaToNote(idea, 'meeting-note').type, 'meeting');
  assert.equal(convertIdeaToNote(idea, 'task-list').type, 'tasks');
  assert.equal(convertIdeaToNote(idea, 'email-draft-note').type, 'email');
});
