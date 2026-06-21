import assert from 'node:assert/strict';
import test from 'node:test';

import {
  writeIdeaNote,
  convertIdeaToNote,
  buildDailyIdeaAppend,
  sanitizePathSegment,
} from '../src/vault.js';

function makeIdea(overrides = {}) {
  return {
    id: 'abc12345',
    text: 'fix the JazzBackend rhythm triplet test',
    source: 'siri',
    tags: ['mobile', 'jazzbackend'],
    riskLevel: 'safe',
    urgency: 'medium',
    status: 'new',
    skill: 'coding',
    project: 'jazzbackend',
    suggestedAction: 'Generate a Cursor prompt.',
    ...overrides,
  };
}

// ── sanitizePathSegment ────────────────────────────────────────────────

test('sanitizePathSegment converts spaces to dashes', () => {
  const result = sanitizePathSegment('hello world');
  assert.equal(result, 'hello-world');
});

test('sanitizePathSegment strips forbidden characters', () => {
  const result = sanitizePathSegment('my:file|name');
  assert.ok(!result.includes(':'));
  assert.ok(!result.includes('|'));
});

test('sanitizePathSegment throws on path traversal', () => {
  assert.throws(() => sanitizePathSegment('../etc/passwd'), /Unsafe/i);
});

test('sanitizePathSegment throws on empty result after sanitization', () => {
  assert.throws(() => sanitizePathSegment('|:|:||'), /empty/i);
});

test('sanitizePathSegment returns fallback for empty input', () => {
  const result = sanitizePathSegment('', 'default');
  assert.equal(result, 'default');
});

test('sanitizePathSegment limits length to 80 chars', () => {
  const long = 'a'.repeat(200);
  const result = sanitizePathSegment(long);
  assert.ok(result.length <= 80);
});

// ── writeIdeaNote ─────────────────────────────────────────────────────

test('writeIdeaNote returns a document object', () => {
  const doc = writeIdeaNote(makeIdea());
  assert.ok(doc);
  assert.equal(typeof doc.path, 'string');
  assert.equal(typeof doc.content, 'string');
  assert.equal(doc.folder, 'Inbox');
});

test('writeIdeaNote path uses sanitized date+id prefix', () => {
  const doc = writeIdeaNote(makeIdea());
  assert.ok(doc.path.startsWith('Inbox/idea-'), `path should start with Inbox/idea-, got: ${doc.path}`);
  assert.ok(doc.path.includes('abc123'), `path should include truncated id, got: ${doc.path}`);
});

test('writeIdeaNote content includes idea text', () => {
  const idea = makeIdea({ text: 'remember catalase lab analysis' });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('remember catalase lab analysis'));
});

test('writeIdeaNote content includes source', () => {
  const doc = writeIdeaNote(makeIdea({ source: 'shortcuts' }));
  assert.ok(doc.content.includes('shortcuts'));
});

test('writeIdeaNote content includes risk level', () => {
  const doc = writeIdeaNote(makeIdea({ riskLevel: 'high' }));
  assert.ok(doc.content.includes('high'));
});

test('writeIdeaNote content includes suggested action', () => {
  const idea = makeIdea({ suggestedAction: 'Draft email for review.' });
  const doc = writeIdeaNote(idea);
  assert.ok(doc.content.includes('Draft email for review.'));
});

test('writeIdeaNote blocks secret patterns', () => {
  const idea = makeIdea({ text: 'sk-abc123456789012345678901234567890123456789' });
  assert.throws(() => writeIdeaNote(idea), /secret/i);
});

test('writeIdeaNote blocks path traversal in title', () => {
  const idea = makeIdea({ id: '../etc' });
  assert.throws(() => writeIdeaNote(idea), /Unsafe|empty/i);
});

// ── convertIdeaToNote ─────────────────────────────────────────────────

test('convertIdeaToNote type=research creates a Research note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'research');
  assert.equal(doc.folder, 'Research');
  assert.ok(doc.content.includes(makeIdea().text.slice(0, 40)));
});

test('convertIdeaToNote type=project creates a Projects note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'project');
  assert.equal(doc.folder, 'Projects');
});

test('convertIdeaToNote type=decision creates a Decisions note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'decision');
  assert.equal(doc.folder, 'Decisions');
});

test('convertIdeaToNote type=meeting creates a BandCouncil note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'meeting');
  assert.equal(doc.folder, 'BandCouncil');
});

test('convertIdeaToNote type=email creates a draft note in Inbox folder', () => {
  const doc = convertIdeaToNote(makeIdea(), 'email');
  assert.equal(doc.folder, 'Inbox');
  assert.ok(doc.content.includes('DRAFT'));
});

test('convertIdeaToNote type=tasks creates task list note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'tasks');
  assert.ok(doc.content.includes('- [ ]'));
});

test('convertIdeaToNote type=idea creates an Inbox idea note', () => {
  const doc = convertIdeaToNote(makeIdea(), 'idea');
  assert.equal(doc.folder, 'Inbox');
});

// ── buildDailyIdeaAppend ──────────────────────────────────────────────

test('buildDailyIdeaAppend returns a non-empty string', () => {
  const result = buildDailyIdeaAppend(makeIdea());
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
});

test('buildDailyIdeaAppend includes the idea text', () => {
  const result = buildDailyIdeaAppend(makeIdea({ text: 'write NHS email to Mr. Welgoss' }));
  assert.ok(result.includes('write NHS email to Mr. Welgoss'));
});

test('buildDailyIdeaAppend includes risk badge for high risk', () => {
  const result = buildDailyIdeaAppend(makeIdea({ riskLevel: 'high' }));
  assert.ok(result.includes('HIGH') || result.includes('🔴'));
});

test('buildDailyIdeaAppend includes risk badge for safe', () => {
  const result = buildDailyIdeaAppend(makeIdea({ riskLevel: 'safe' }));
  assert.ok(result.includes('SAFE') || result.includes('🟢'));
});

test('buildDailyIdeaAppend includes urgency indicator when high', () => {
  const result = buildDailyIdeaAppend(makeIdea({ urgency: 'high' }));
  assert.ok(result.includes('HIGH') || result.includes('⚡'));
});

test('buildDailyIdeaAppend includes idea id', () => {
  const result = buildDailyIdeaAppend(makeIdea({ id: 'test-id-9999' }));
  assert.ok(result.includes('test-id-9999'));
});

test('buildDailyIdeaAppend handles missing optional fields gracefully', () => {
  const minimalIdea = { id: 'min1', text: 'minimal idea', source: 'manual' };
  const result = buildDailyIdeaAppend(minimalIdea);
  assert.ok(typeof result === 'string');
  assert.ok(result.includes('minimal idea'));
});

test('buildDailyIdeaAppend result can be concatenated for multiple ideas', () => {
  const idea1 = makeIdea({ text: 'first idea', id: 'id001' });
  const idea2 = makeIdea({ text: 'second idea', id: 'id002' });
  const combined = buildDailyIdeaAppend(idea1) + buildDailyIdeaAppend(idea2);
  assert.ok(combined.includes('first idea'));
  assert.ok(combined.includes('second idea'));
});
