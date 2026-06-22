import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
  sanitizePathSegment,
  validateVaultContent,
  writeDailyIdeaAppend,
  writeEmailDraftNote,
  convertIdeaToNote,
} from '../src/vault.js';

test('vault filenames are sanitized and traversal is blocked', () => {
  assert.equal(sanitizePathSegment('Project: Update?'), 'Project-Update');
  assert.throws(() => sanitizePathSegment('../secrets'), /Unsafe vault path/);
  assert.throws(() => sanitizePathSegment('folder\\secret'), /Unsafe vault path/);
});

test('vault content blocks obvious secrets and private-student flags', () => {
  assert.throws(() => validateVaultContent(`sk-${'a'.repeat(26)}`), /secret/i);
  assert.throws(() => validateVaultContent('ordinary note', { containsPrivateStudentData: true }), /Private student data/);
  assert.throws(() => validateVaultContent('student id: 123456'), /private student data/i);
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

test('daily idea append uses sanitized daily path and append mode', () => {
  const note = writeDailyIdeaAppend({
    id: 'idea-123456',
    text: 'remember catalase lab analysis',
    source: 'siri',
    status: 'new',
    skill: 'lab-analysis',
    riskLevel: 'safe',
  }, '2026-06-22');
  assert.equal(note.path, 'Daily/2026-06-22.md');
  assert.equal(note.append, true);
  assert.match(note.content, /Captured ideas/);
});

test('idea conversion supports daily append notes', () => {
  const note = convertIdeaToNote({ id: 'abc', text: 'daily memory', source: 'manual' }, 'daily');
  assert.equal(note.type, 'daily');
  assert.equal(note.append, true);
  assert.match(note.path, /^Daily\//);
});
