import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { captureIdea, listIdeas, getIdea, triageIdea, _clearInbox, VALID_SOURCES, VALID_STATUSES } from '../src/ideaStore.js';
import { classifyIdea } from '../src/ideaClassifier.js';
import { matchSkill } from '../src/skills.js';

beforeEach(() => _clearInbox());

describe('idea capture — valid input', () => {
  it('captures a valid idea and returns required fields', () => {
    const idea = captureIdea({ text: 'fix JazzBackend rhythm tests', source: 'dashboard', tags: ['music', 'code'] });
    assert.ok(idea.id, 'has id');
    assert.ok(idea.id.startsWith('idea-'), 'id starts with idea-');
    assert.equal(idea.text, 'fix JazzBackend rhythm tests');
    assert.equal(idea.source, 'dashboard');
    assert.deepEqual(idea.tags, ['music', 'code']);
    assert.equal(idea.status, 'new');
    assert.ok(idea.createdAt, 'has createdAt');
    assert.ok(idea.updatedAt, 'has updatedAt');
    assert.ok(idea.category, 'has category');
    assert.ok(idea.riskLevel, 'has riskLevel');
    assert.ok(idea.suggestedAction, 'has suggestedAction');
    assert.equal(typeof idea.confirmationRequired, 'boolean', 'has confirmationRequired boolean');
  });

  it('generates a unique id each time', () => {
    const a = captureIdea({ text: 'idea one' });
    const b = captureIdea({ text: 'idea two' });
    assert.notEqual(a.id, b.id);
  });

  it('uses manual source as default when source is not provided', () => {
    const idea = captureIdea({ text: 'just a note' });
    assert.equal(idea.source, 'manual');
  });

  it('accepts all valid sources', () => {
    for (const source of VALID_SOURCES) {
      const idea = captureIdea({ text: `test from ${source}`, source });
      assert.equal(idea.source, source);
    }
  });
});

describe('idea capture — input validation', () => {
  it('rejects empty text', () => {
    assert.throws(() => captureIdea({ text: '' }), /empty/i);
  });

  it('rejects missing text', () => {
    assert.throws(() => captureIdea({}), /required|string|empty/i);
  });

  it('rejects text that exceeds the maximum length', () => {
    const huge = 'x'.repeat(5000);
    assert.throws(() => captureIdea({ text: huge }), /exceed|maximum/i);
  });

  it('uses a safe id (no path traversal characters)', () => {
    const idea = captureIdea({ text: 'valid idea' });
    assert.ok(!/[/\\<>]/.test(idea.id), 'id has no unsafe chars');
  });
});

describe('idea store — list and get', () => {
  it('lists captured ideas', () => {
    captureIdea({ text: 'first idea' });
    captureIdea({ text: 'second idea' });
    const ideas = listIdeas();
    assert.ok(ideas.length >= 2);
  });

  it('returns an idea by id', () => {
    const captured = captureIdea({ text: 'findable idea' });
    const found = getIdea(captured.id);
    assert.equal(found.text, 'findable idea');
  });

  it('returns null for a missing idea id', () => {
    const found = getIdea('nonexistent-id');
    assert.equal(found, null);
  });

  it('filters ideas by status', () => {
    const idea = captureIdea({ text: 'triaged idea' });
    triageIdea(idea.id, { status: 'triaged' });
    const triaged = listIdeas({ status: 'triaged' });
    assert.ok(triaged.some((i) => i.id === idea.id));
  });
});

describe('idea triage', () => {
  it('updates status after triage', () => {
    const idea = captureIdea({ text: 'something to triage' });
    const updated = triageIdea(idea.id, { status: 'planned', notes: 'Make this a Cursor prompt' });
    assert.equal(updated.status, 'planned');
    assert.equal(updated.triageNotes, 'Make this a Cursor prompt');
  });

  it('returns null for nonexistent idea', () => {
    const result = triageIdea('bad-id', { status: 'planned' });
    assert.equal(result, null);
  });
});

describe('idea classifier', () => {
  it('classifies a coding idea', () => {
    const result = classifyIdea('fix the bug in the API endpoint');
    assert.equal(result.category, 'coding');
    assert.equal(result.skill, 'coding');
    assert.ok(['safe', 'medium'].includes(result.riskLevel));
  });

  it('classifies a JazzBackend task as music or coding', () => {
    const result = classifyIdea('fix JazzBackend rhythm tests');
    assert.ok(['coding', 'music'].includes(result.category), `category should be coding or music, got: ${result.category}`);
    assert.ok(['coding', 'jazz-generation'].includes(result.skill), `skill should be coding or jazz-generation, got: ${result.skill}`);
    assert.ok(['safe', 'medium'].includes(result.riskLevel));
  });

  it('classifies an email idea as medium risk', () => {
    const result = classifyIdea('email Mr. Welgoss about NHS');
    assert.equal(result.category, 'email');
    assert.equal(result.skill, 'email-drafting');
    assert.equal(result.riskLevel, 'medium');
    assert.equal(result.confirmationRequired, true);
  });

  it('classifies a memory/note idea as safe', () => {
    const result = classifyIdea('remember catalase lab analysis for bio');
    assert.equal(result.riskLevel, 'safe');
    assert.equal(result.confirmationRequired, false);
  });

  it('classifies deploy as high risk with confirmation required', () => {
    const result = classifyIdea('deploy this to Cloudflare now');
    assert.equal(result.riskLevel, 'high');
    assert.equal(result.confirmationRequired, true);
  });

  it('classifies delete files as high risk', () => {
    const result = classifyIdea('delete files from the repo');
    assert.equal(result.riskLevel, 'high');
    assert.equal(result.confirmationRequired, true);
  });

  it('classifies Band Council drafting as medium risk', () => {
    const result = classifyIdea('make Band Council agenda for next meeting');
    assert.equal(result.skill, 'band-council');
    assert.equal(result.riskLevel, 'medium');
  });

  it('throws on empty input', () => {
    assert.throws(() => classifyIdea(''), /required/i);
  });
});

describe('skill matcher', () => {
  it('matches coding from a code-related idea', () => {
    const skill = matchSkill('fix the bug in the API endpoint');
    assert.ok(skill, 'matched a skill');
    assert.equal(skill.id, 'coding');
  });

  it('matches email-drafting', () => {
    const skill = matchSkill('email the professor about office hours');
    assert.ok(skill);
    assert.equal(skill.id, 'email-drafting');
  });

  it('matches obsidian-memory for remember/note keywords', () => {
    const skill = matchSkill('remember this note for later');
    assert.ok(skill);
    assert.equal(skill.id, 'obsidian-memory');
  });

  it('returns null for empty input', () => {
    const skill = matchSkill('');
    assert.equal(skill, null);
  });
});
