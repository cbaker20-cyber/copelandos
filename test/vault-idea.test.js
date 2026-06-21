import assert from 'node:assert/strict';
import test from 'node:test';

import {
  writeIdeaNote,
  convertIdeaToNote,
  buildDailyIdeaAppend,
  sanitizePathSegment,
  validateVaultContent,
  VAULT_STRUCTURE,
} from '../src/vault.js';

const baseIdea = {
  id: 'test-idea-abc123',
  text: 'fix the JazzBackend rhythm triplet test',
  source: 'siri',
  tags: ['mobile', 'jazzbackend'],
  status: 'new',
  riskLevel: 'safe',
  project: 'jazz-backend',
  suggestedAction: 'Generate a Cursor task prompt.',
};

test('writeIdeaNote creates document in Inbox folder', () => {
  const doc = writeIdeaNote(baseIdea);
  assert.ok(doc.folder === 'Inbox', 'idea notes go to Inbox');
  assert.ok(doc.path.startsWith('Inbox/'), 'path should start with Inbox/');
  assert.ok(doc.path.endsWith('.md'), 'path should end with .md');
});

test('writeIdeaNote includes idea text in content', () => {
  const doc = writeIdeaNote(baseIdea);
  assert.ok(doc.content.includes(baseIdea.text), 'content should include the idea text');
});

test('writeIdeaNote includes source and tags in content', () => {
  const doc = writeIdeaNote(baseIdea);
  assert.ok(doc.content.includes('siri'), 'content should include source');
  assert.ok(doc.content.includes('mobile') || doc.content.includes('jazzbackend'), 'content should include tags');
});

test('writeIdeaNote includes risk level in content', () => {
  const doc = writeIdeaNote({ ...baseIdea, riskLevel: 'high' });
  assert.ok(doc.content.includes('high'), 'content should include risk level');
});

test('writeIdeaNote includes suggested action when present', () => {
  const doc = writeIdeaNote(baseIdea);
  assert.ok(doc.content.includes('Cursor') || doc.content.includes('suggested'), 'should include suggested action');
});

test('writeIdeaNote path is sanitized — no traversal characters', () => {
  const doc = writeIdeaNote(baseIdea);
  assert.ok(!doc.path.includes('..'), 'path must not contain ..');
  assert.ok(!doc.path.includes('\\'), 'path must not contain backslash');
  assert.ok(!doc.path.includes('\0'), 'path must not contain null byte');
});

test('writeIdeaNote with path-traversal id does not escape Inbox', () => {
  const riskyIdea = { ...baseIdea, id: '../../etc/passwd' };
  const doc = writeIdeaNote(riskyIdea);
  // Path must stay inside Inbox — traversal characters are stripped from the ID
  assert.ok(doc.path.startsWith('Inbox/'), 'must stay inside Inbox');
  assert.ok(!doc.path.includes('..'), 'traversal sequences must be stripped');
  assert.ok(!doc.path.includes('/etc/'), 'absolute path injection must be blocked');
  assert.ok(!doc.path.includes('passwd'), 'passwd literal must not appear');
});

test('buildDailyIdeaAppend returns a string line', () => {
  const result = buildDailyIdeaAppend(baseIdea);
  assert.ok(typeof result.line === 'string');
  assert.ok(result.line.length > 0);
  assert.ok(result.folder === 'Daily');
});

test('buildDailyIdeaAppend includes source in line', () => {
  const result = buildDailyIdeaAppend(baseIdea);
  assert.ok(result.line.includes('siri'), 'should include source');
});

test('buildDailyIdeaAppend includes risk badge for high-risk idea', () => {
  const highRisk = { ...baseIdea, riskLevel: 'high', text: 'deploy to production' };
  const result = buildDailyIdeaAppend(highRisk);
  assert.ok(result.line.includes('HIGH RISK') || result.line.includes('high'), 'should flag high risk');
});

test('buildDailyIdeaAppend truncates very long text', () => {
  const longIdea = { ...baseIdea, text: 'a'.repeat(300) };
  const result = buildDailyIdeaAppend(longIdea);
  assert.ok(result.line.length < 400, 'should not be unreasonably long');
});

test('convertIdeaToNote to research type creates research document', () => {
  const doc = convertIdeaToNote(baseIdea, 'research');
  assert.ok(doc.folder === 'Research' || doc.path.startsWith('Research/'));
  assert.ok(doc.content.includes(baseIdea.text));
});

test('convertIdeaToNote to decision type creates decision document', () => {
  const doc = convertIdeaToNote(baseIdea, 'decision');
  assert.ok(doc.folder === 'Decisions' || doc.path.startsWith('Decisions/'));
});

test('convertIdeaToNote to email type is draft-only', () => {
  const doc = convertIdeaToNote(baseIdea, 'email');
  assert.ok(doc.content.includes('DRAFT') || doc.content.includes('NOT SENT'), 'email conversion must be draft-only');
  assert.ok(doc.path.startsWith('Inbox/'), 'email drafts go to Inbox');
});

test('convertIdeaToNote to meeting type creates meeting note', () => {
  const doc = convertIdeaToNote(baseIdea, 'meeting');
  assert.ok(doc.folder === 'BandCouncil' || doc.path.startsWith('BandCouncil/'));
});

test('convertIdeaToNote to tasks type creates task list', () => {
  const doc = convertIdeaToNote(baseIdea, 'tasks');
  assert.ok(doc.content.includes('- [ ]'), 'tasks should include checkbox items');
});

test('convertIdeaToNote default (idea) type stays in Inbox', () => {
  const doc = convertIdeaToNote(baseIdea, 'idea');
  assert.ok(doc.path.startsWith('Inbox/'));
});

test('validateVaultContent blocks API key patterns', () => {
  assert.throws(
    () => validateVaultContent('Authorization: Bearer sk-' + 'a'.repeat(25)),
    /secret/i
  );
});

test('validateVaultContent blocks GitHub token patterns', () => {
  assert.throws(
    () => validateVaultContent('token: ghp_' + 'abcdefghij1234567890'),
    /secret/i
  );
});

test('validateVaultContent allows normal note content', () => {
  const text = '# Research Note\n\n## Summary\n\nThis is normal research content with no secrets.';
  const result = validateVaultContent(text);
  assert.equal(result, text);
});

test('VAULT_STRUCTURE includes Inbox and Daily folders', () => {
  assert.ok(VAULT_STRUCTURE.includes('Inbox'), 'Inbox must be in vault structure');
  assert.ok(VAULT_STRUCTURE.includes('Daily'), 'Daily must be in vault structure');
  assert.ok(VAULT_STRUCTURE.includes('Research'), 'Research must be in vault structure');
  assert.ok(VAULT_STRUCTURE.includes('BandCouncil'), 'BandCouncil must be in vault structure');
});
