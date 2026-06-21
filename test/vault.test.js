import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildObsidianDailyUri,
  buildObsidianNewUri,
  buildObsidianOpenUri,
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
