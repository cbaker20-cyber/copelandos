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
  persistVaultDocument,
} from '../src/vault.js';

test('vault filenames are sanitized and traversal is blocked', () => {
  assert.equal(sanitizePathSegment('Project: Update?'), 'Project-Update');
  assert.throws(() => sanitizePathSegment('../secrets'), /Unsafe vault path/);
  assert.throws(() => sanitizePathSegment('folder\\secret'), /Unsafe vault path/);
});

test('vault content blocks obvious secrets and private-student flags', () => {
  assert.throws(() => validateVaultContent(`sk-${'a'.repeat(26)}`), /secret/i);
  assert.throws(() => validateVaultContent('ordinary note', { containsPrivateStudentData: true }), /Private student data/);
  assert.throws(() => validateVaultContent('Jane Doe grade report'), /private student data/i);
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

test('daily idea append document uses sanitized daily path', () => {
  const document = writeDailyIdeaAppend({
    id: 'abc123',
    text: 'remember catalase lab analysis',
    source: 'siri',
    status: 'new',
    skill: 'lab-analysis',
    riskLevel: 'safe',
  });
  assert.equal(document.append, true);
  assert.match(document.path, /^Daily\/\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(document.content, /remember catalase/);
});

test('idea conversion aliases map to requested note families', () => {
  const idea = { id: 'idea-1', text: 'choose the safer implementation path', source: 'manual', tags: [], status: 'triaged' };
  assert.match(convertIdeaToNote(idea, 'project-update').path, /^Projects\//);
  assert.match(convertIdeaToNote(idea, 'research-note').path, /^Research\//);
  assert.match(convertIdeaToNote(idea, 'meeting-note').path, /^BandCouncil\//);
  assert.match(convertIdeaToNote(idea, 'task-list').path, /^Projects\//);
  assert.match(convertIdeaToNote(idea, 'email-draft-note').content, /DRAFT — NOT SENT/);
});

test('persistVaultDocument appends daily idea content when GitHub file exists', async () => {
  const existingContent = '# 2026-06-21\n\n## Notes\n\nExisting note\n';
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (!options.method) {
      return new Response(JSON.stringify({
        sha: 'sha-1',
        content: btoa(existingContent),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const body = JSON.parse(options.body);
    const written = atob(body.content);
    assert.match(written, /Existing note/);
    assert.match(written, /## Captured ideas/);
    assert.match(written, /new captured idea/);
    assert.equal(body.sha, 'sha-1');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await persistVaultDocument({
    type: 'daily-idea-append',
    path: 'Daily/2026-06-21.md',
    title: '2026-06-21',
    content: '- new captured idea',
    append: true,
    section: '## Captured ideas',
  }, {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/repo',
  }, fetchImpl);

  assert.equal(result.ok, true);
  assert.equal(result.connected, true);
  assert.equal(calls.length, 2);
});
