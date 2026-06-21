import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { writeIdeaNote, buildDailyIdeaAppend, sanitizePathSegment } from '../src/vault.js';

const sampleIdea = {
  id: 'idea-test-001',
  text: 'Remember to write the catalase lab analysis for biology class',
  source: 'siri',
  tags: ['school', 'biology'],
  project: null,
  category: 'school',
  skill: 'lab-analysis',
  skillDisplayName: 'Lab Analysis',
  riskLevel: 'safe',
  urgency: 'medium',
  suggestedAction: 'Write a research or lab note in vault',
  confirmationRequired: false,
  createdAt: '2026-06-21T18:00:00.000Z',
  updatedAt: '2026-06-21T18:00:00.000Z',
  status: 'new',
};

describe('vault idea note', () => {
  it('writes an idea note with correct folder', () => {
    const doc = writeIdeaNote(sampleIdea);
    assert.equal(doc.folder, 'Inbox', 'idea notes go in Inbox folder');
    assert.ok(doc.path.startsWith('Inbox/'), 'path starts with Inbox/');
  });

  it('sanitizes path — no traversal', () => {
    const badIdea = { ...sampleIdea, id: '../../../etc/passwd' };
    assert.throws(() => writeIdeaNote(badIdea), /unsafe|traversal|empty/i);
  });

  it('includes idea text in content', () => {
    const doc = writeIdeaNote(sampleIdea);
    assert.ok(doc.content.includes(sampleIdea.text), 'idea text in content');
  });

  it('includes classification metadata in content', () => {
    const doc = writeIdeaNote(sampleIdea);
    assert.ok(doc.content.includes('lab-analysis') || doc.content.includes('Lab Analysis'), 'includes skill');
    assert.ok(doc.content.includes('safe'), 'includes risk level');
    assert.ok(doc.content.includes('siri'), 'includes source');
  });

  it('blocks vault write containing a secret pattern', () => {
    const secretIdea = { ...sampleIdea, text: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890' };
    assert.throws(() => writeIdeaNote(secretIdea), /secret/i);
  });
});

describe('vault daily idea append', () => {
  it('builds a formatted daily note append line', () => {
    const line = buildDailyIdeaAppend(sampleIdea);
    assert.ok(line.startsWith('- ['), 'starts with list item');
    assert.ok(line.includes('siri'), 'includes source');
    assert.ok(line.includes('Lab Analysis') || line.includes('lab-analysis'), 'includes skill');
  });

  it('truncates long idea text', () => {
    const longIdea = { ...sampleIdea, text: 'a'.repeat(200) };
    const line = buildDailyIdeaAppend(longIdea);
    assert.ok(line.length < 300, 'line is not unbounded');
    assert.ok(line.includes('...'), 'truncated with ellipsis');
  });
});

describe('vault path sanitization', () => {
  it('sanitizes normal filenames correctly', () => {
    const safe = sanitizePathSegment('my idea about jazz');
    assert.equal(safe, 'my-idea-about-jazz');
  });

  it('blocks path traversal', () => {
    assert.throws(() => sanitizePathSegment('../etc/passwd'), /unsafe/i);
  });

  it('blocks null bytes', () => {
    assert.throws(() => sanitizePathSegment('file\0name'), /unsafe/i);
  });
});
