import assert from 'node:assert/strict';
import test from 'node:test';

import { classify, classifyWithContext } from '../src/ideaClassifier.js';

test('classify detects coding category', () => {
  const result = classify('fix the bug in the authentication module');
  assert.equal(result.category, 'coding');
});

test('classify detects email category and medium risk', () => {
  const result = classify('email Mr. Welgoss about NHS eligibility');
  assert.equal(result.category, 'email');
  assert.equal(result.riskLevel, 'medium');
  assert.equal(result.confirmationRequired, true);
});

test('classify flags deploy as high risk', () => {
  const result = classify('deploy this to Cloudflare now');
  assert.equal(result.riskLevel, 'high');
  assert.equal(result.confirmationRequired, true);
});

test('classify flags delete files as high risk', () => {
  const result = classify('delete all files in the temp directory');
  assert.equal(result.riskLevel, 'high');
});

test('classify detects lab analysis as safe', () => {
  const result = classify('remember catalase lab analysis results from today');
  assert.equal(result.riskLevel, 'safe');
  assert.ok(['school', 'memory', 'research'].includes(result.category));
});

test('classify detects Band Council as medium risk', () => {
  const result = classify('make Band Council agenda for next meeting');
  assert.ok(result.category === 'music' || result.riskLevel === 'medium' || result.skill !== null);
  assert.equal(result.confirmationRequired, true);
});

test('classify music tasks correctly', () => {
  const result = classify('fix JazzBackend rhythm triplet test cases');
  assert.ok(['coding', 'music'].includes(result.category));
  assert.equal(result.riskLevel, 'safe');
});

test('classify provides a suggestedAction', () => {
  const result = classify('implement the idea inbox API endpoint');
  assert.ok(typeof result.suggestedAction === 'string');
  assert.ok(result.suggestedAction.length > 0);
});

test('classify provides classification metadata', () => {
  const result = classify('research the connectome perturbation dataset');
  assert.ok(result.classifiedBy);
  assert.ok(Array.isArray(result.keywords));
});

test('classifyWithContext applies project overrides for band-council', () => {
  const result = classifyWithContext('draft the meeting agenda', {
    project: 'band-council-agent',
    tags: [],
  });
  assert.equal(result.riskLevel, 'medium');
  assert.equal(result.confirmationRequired, true);
});

test('classify returns safe for simple memory/note tasks', () => {
  const result = classify('remember to review the Score Scanner MusicXML test');
  assert.equal(result.riskLevel, 'safe');
});

test('classify assigns a skill when keywords match', () => {
  const result = classify('write an essay about the catalase experiment results');
  assert.ok(result.skill !== null, 'should assign a skill');
});

test('classify handles send email as medium risk', () => {
  const result = classify('draft email to professor about the lab report');
  assert.equal(result.riskLevel, 'medium');
});

// ── Urgency detection ──────────────────────────────────────────────────

test('classify detects high urgency from "urgent" keyword', () => {
  const result = classify('urgent: fix production database crash');
  assert.equal(result.urgency, 'high');
});

test('classify detects high urgency from "asap" keyword', () => {
  const result = classify('fix this ASAP or we miss the deadline');
  assert.equal(result.urgency, 'high');
});

test('classify detects low urgency from "someday" keyword', () => {
  const result = classify('someday refactor the old utility module');
  assert.equal(result.urgency, 'low');
});

test('classify detects low urgency from "backlog" keyword', () => {
  const result = classify('add to backlog: improve error messages');
  assert.equal(result.urgency, 'low');
});

test('classify defaults to medium urgency for neutral ideas', () => {
  const result = classify('write a helper function for date parsing');
  assert.equal(result.urgency, 'medium');
});

test('classify includes urgency field in all results', () => {
  const texts = ['fix bug', 'email teacher', 'deploy to prod', 'remember lab notes'];
  for (const text of texts) {
    const result = classify(text);
    assert.ok('urgency' in result, `Expected urgency field in classify result for: "${text}"`);
    assert.ok(['low', 'medium', 'high'].includes(result.urgency));
  }
});
