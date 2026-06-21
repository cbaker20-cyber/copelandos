import assert from 'node:assert/strict';
import test from 'node:test';

import {
  writeIdeaNote,
  buildDailyIdeaAppend,
  convertIdeaToNote,
  sanitizePathSegment,
} from '../src/vault.js';

function makeIdea(overrides = {}) {
  return {
    id: 'abc12345-6789-0abc-def0-123456789012',
    text: 'Implement a new scoring algorithm for JazzBackend',
    source: 'siri',
    tags: ['music', 'coding'],
    project: 'jazz-backend',
    riskLevel: 'safe',
    status: 'new',
    suggestedAction: 'Generate a Cursor task prompt.',
    ...overrides,
  };
}

// ─── writeIdeaNote ───────────────────────────────────────────────────────────

test('writeIdeaNote returns a document with Inbox folder', () => {
  const doc = writeIdeaNote(makeIdea());
  assert.equal(doc.folder, 'Inbox');
  assert.equal(doc.type, 'idea');
});

test('writeIdeaNote path contains sanitized id prefix', () => {
  const doc = writeIdeaNote(makeIdea());
  assert.ok(doc.path.startsWith('Inbox/idea-'));
  assert.ok(doc.path.endsWith('.md'));
});

test('writeIdeaNote content includes idea text', () => {
  const idea = makeIdea({ text: 'Remember the catalase lab results' });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('catalase lab results'));
});

test('writeIdeaNote content includes source and tags', () => {
  const idea = makeIdea({ source: 'siri', tags: ['mobile', 'lab'] });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('siri'));
  assert.ok(doc.content.includes('mobile') || doc.content.includes('lab'));
});

test('writeIdeaNote content includes suggested action', () => {
  const idea = makeIdea({ suggestedAction: 'Create a Cursor prompt.' });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('Create a Cursor prompt.'));
});

test('writeIdeaNote content includes risk level', () => {
  const idea = makeIdea({ riskLevel: 'medium' });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('medium'));
});

test('writeIdeaNote uses safe filename (no unsafe chars)', () => {
  const idea = makeIdea({ id: 'abc-123' });
  const doc = writeIdeaNote(idea);
  assert.ok(!/[<>:"|?*#\[\]]/.test(doc.path));
  assert.ok(!doc.path.includes('..'));
});

test('writeIdeaNote works for idea with minimal fields', () => {
  const doc = writeIdeaNote({ id: 'min01', text: 'minimal idea', source: 'manual', tags: [] });
  assert.ok(doc.content.includes('minimal idea'));
});

// ─── buildDailyIdeaAppend ────────────────────────────────────────────────────

test('buildDailyIdeaAppend returns a non-empty string', () => {
  const append = buildDailyIdeaAppend(makeIdea());
  assert.ok(typeof append === 'string');
  assert.ok(append.length > 0);
});

test('buildDailyIdeaAppend includes idea text', () => {
  const idea = makeIdea({ text: 'Plan the Band Council agenda' });
  const append = buildDailyIdeaAppend(idea);
  assert.ok(append.includes('Band Council agenda'));
});

test('buildDailyIdeaAppend includes source', () => {
  const append = buildDailyIdeaAppend(makeIdea({ source: 'shortcuts' }));
  assert.ok(append.includes('shortcuts'));
});

test('buildDailyIdeaAppend includes risk badge for safe', () => {
  const append = buildDailyIdeaAppend(makeIdea({ riskLevel: 'safe' }));
  assert.ok(append.includes('🟢') || append.includes('safe'));
});

test('buildDailyIdeaAppend includes risk badge for medium', () => {
  const append = buildDailyIdeaAppend(makeIdea({ riskLevel: 'medium' }));
  assert.ok(append.includes('🟡') || append.includes('medium'));
});

test('buildDailyIdeaAppend includes risk badge for high', () => {
  const append = buildDailyIdeaAppend(makeIdea({ riskLevel: 'high' }));
  assert.ok(append.includes('🔴') || append.includes('high'));
});

test('buildDailyIdeaAppend truncates very long text safely', () => {
  const idea = makeIdea({ text: 'x'.repeat(500) });
  const append = buildDailyIdeaAppend(idea);
  assert.ok(append.length < 1500);
});

// ─── convertIdeaToNote ───────────────────────────────────────────────────────

test('convertIdeaToNote type=project returns Projects folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'project');
  assert.equal(doc.folder, 'Projects');
});

test('convertIdeaToNote type=decision returns Decisions folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'decision');
  assert.equal(doc.folder, 'Decisions');
});

test('convertIdeaToNote type=research returns Research folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'research');
  assert.equal(doc.folder, 'Research');
});

test('convertIdeaToNote type=meeting returns BandCouncil folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'meeting');
  assert.equal(doc.folder, 'BandCouncil');
});

test('convertIdeaToNote type=email returns Inbox folder with draft marker', () => {
  const doc = convertIdeaToNote(makeIdea(), 'email');
  assert.equal(doc.folder, 'Inbox');
  assert.ok(doc.content.includes('DRAFT'));
});

test('convertIdeaToNote type=tasks returns Projects folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'tasks');
  assert.equal(doc.folder, 'Projects');
});

test('convertIdeaToNote type=idea returns Inbox folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'idea');
  assert.equal(doc.folder, 'Inbox');
});

test('convertIdeaToNote default (no type) returns Inbox', () => {
  const doc = convertIdeaToNote(makeIdea());
  assert.ok(['Inbox', 'Research'].includes(doc.folder));
});

test('convertIdeaToNote includes idea text in output', () => {
  const idea = makeIdea({ text: 'Build a new dashboard panel' });
  const doc = convertIdeaToNote(idea, 'research');
  assert.ok(doc.content.includes('Build a new dashboard panel'));
});

// ─── vault path sanitization (idea-related) ──────────────────────────────────

test('vault sanitizePathSegment strips unsafe chars from idea id', () => {
  const safe = sanitizePathSegment('idea-2024-06-21-abc12345');
  assert.ok(!safe.includes('<'));
  assert.ok(!safe.includes('>'));
  assert.ok(!safe.includes('..'));
});

test('vault sanitizePathSegment rejects path traversal', () => {
  assert.throws(() => sanitizePathSegment('../etc/passwd'), /unsafe/i);
});

test('vault sanitizePathSegment rejects null bytes', () => {
  assert.throws(() => sanitizePathSegment('file\0name'), /unsafe/i);
});
