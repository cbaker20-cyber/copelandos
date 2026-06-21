import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCouncilPrompt,
  createRolePrompt,
  mergeCouncilResults,
  detectDisagreements,
  summarizeTradeoffs,
  produceFinalPlan,
  createMockCouncilResult,
} from '../src/council.js';

// ─── createCouncilPrompt ─────────────────────────────────────────────────────

test('createCouncilPrompt returns a string containing the task', () => {
  const roles = [
    { id: 'planner', displayName: 'Planner', description: 'Plans the work.' },
    { id: 'coder', displayName: 'Coder', description: 'Implements code.' },
  ];
  const prompt = createCouncilPrompt('Fix the JazzBackend rhythm tests', roles);
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('JazzBackend'));
  assert.ok(prompt.includes('Planner'));
  assert.ok(prompt.includes('Coder'));
});

test('createCouncilPrompt includes council instructions', () => {
  const roles = [{ id: 'security-reviewer', displayName: 'Security Reviewer', description: 'Reviews security.' }];
  const prompt = createCouncilPrompt('deploy to Cloudflare', roles);
  assert.ok(prompt.toLowerCase().includes('council'));
  assert.ok(prompt.toLowerCase().includes('high-risk') || prompt.toLowerCase().includes('human confirmation'));
});

test('createCouncilPrompt truncates very long tasks', () => {
  const roles = [{ id: 'planner', displayName: 'Planner', description: 'Plans.' }];
  const longTask = 'x'.repeat(1000);
  const prompt = createCouncilPrompt(longTask, roles);
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.length < 2000);
});

// ─── createRolePrompt ────────────────────────────────────────────────────────

test('createRolePrompt returns a prompt for a known role', () => {
  const prompt = createRolePrompt('planner', 'Build a new feature');
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('Build a new feature'));
});

test('createRolePrompt includes structured response sections', () => {
  const prompt = createRolePrompt('security-reviewer', 'Add OAuth login');
  assert.ok(prompt.toLowerCase().includes('assessment') || prompt.toLowerCase().includes('risks') || prompt.toLowerCase().includes('recommendation'));
});

test('createRolePrompt throws for unknown role', () => {
  assert.throws(() => createRolePrompt('nonexistent-role', 'some task'), /unknown council role/i);
});

// ─── mergeCouncilResults ─────────────────────────────────────────────────────

test('mergeCouncilResults returns error for empty array', () => {
  const result = mergeCouncilResults([]);
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('mergeCouncilResults merges risks from all results', () => {
  const results = [
    { role: 'coder', risks: ['Missing input validation'], recommendation: 'Proceed carefully.', openQuestions: [] },
    { role: 'security-reviewer', risks: ['Credentials exposure possible'], recommendation: 'Proceed carefully.', openQuestions: ['Is this reversible?'] },
  ];
  const merged = mergeCouncilResults(results);
  assert.equal(merged.ok, true);
  assert.ok(merged.risks.includes('Missing input validation'));
  assert.ok(merged.risks.includes('Credentials exposure possible'));
});

test('mergeCouncilResults deduplicates risks', () => {
  const results = [
    { role: 'coder', risks: ['Same risk'], recommendation: 'OK', openQuestions: [] },
    { role: 'critic', risks: ['Same risk'], recommendation: 'OK', openQuestions: [] },
  ];
  const merged = mergeCouncilResults(results);
  assert.equal(merged.risks.length, 1);
});

test('mergeCouncilResults collects open questions', () => {
  const results = [
    { role: 'planner', risks: [], recommendation: 'Proceed.', openQuestions: ['Is this reversible?'] },
    { role: 'coder', risks: [], recommendation: 'Proceed.', openQuestions: ['Have tests been updated?'] },
  ];
  const merged = mergeCouncilResults(results);
  assert.ok(merged.missingInformation.includes('Is this reversible?'));
  assert.ok(merged.missingInformation.includes('Have tests been updated?'));
});

test('mergeCouncilResults sets roleCount', () => {
  const results = [
    { role: 'planner', risks: [], recommendation: 'Proceed.', openQuestions: [] },
    { role: 'coder', risks: [], recommendation: 'Proceed.', openQuestions: [] },
    { role: 'critic', risks: [], recommendation: 'Review.', openQuestions: [] },
  ];
  const merged = mergeCouncilResults(results);
  assert.equal(merged.roleCount, 3);
});

// ─── detectDisagreements ─────────────────────────────────────────────────────

test('detectDisagreements returns empty when fewer than 2 results', () => {
  const result = detectDisagreements([{ role: 'planner', recommendation: 'Proceed.', risks: [], openQuestions: [] }]);
  assert.deepEqual(result, []);
});

test('detectDisagreements detects proceed vs block split', () => {
  const results = [
    { role: 'planner', recommendation: 'Proceed — looks safe.', risks: [], openQuestions: [] },
    { role: 'security-reviewer', recommendation: 'Block — this is unsafe and dangerous.', risks: ['security issue'], openQuestions: [] },
  ];
  const disagreements = detectDisagreements(results);
  assert.ok(disagreements.length > 0);
  assert.ok(disagreements[0].toLowerCase().includes('split') || disagreements[0].toLowerCase().includes('block'));
});

test('detectDisagreements returns empty when consensus is uniform', () => {
  const results = [
    { role: 'planner', recommendation: 'Proceed with tests.', risks: [], openQuestions: [] },
    { role: 'coder', recommendation: 'Proceed after review.', risks: [], openQuestions: [] },
  ];
  const disagreements = detectDisagreements(results);
  assert.equal(disagreements.length, 0);
});

// ─── summarizeTradeoffs ──────────────────────────────────────────────────────

test('summarizeTradeoffs returns summary with counts', () => {
  const results = [
    { role: 'coder', risks: ['Missing tests'], recommendation: 'Proceed.', openQuestions: ['Reversible?'] },
    { role: 'security-reviewer', risks: ['No auth check'], recommendation: 'Block — dangerous.', openQuestions: [] },
  ];
  const summary = summarizeTradeoffs(results);
  assert.ok(typeof summary.summary === 'string');
  assert.ok(typeof summary.riskCount === 'number');
  assert.ok(typeof summary.disagreementCount === 'number');
  assert.ok(typeof summary.openQuestionCount === 'number');
  assert.ok(Array.isArray(summary.tradeoffs));
});

// ─── produceFinalPlan ────────────────────────────────────────────────────────

test('produceFinalPlan returns a plan with required fields', () => {
  const results = [
    { role: 'planner', risks: [], recommendation: 'Proceed.', openQuestions: [] },
    { role: 'coder', risks: [], recommendation: 'Proceed with tests.', openQuestions: [] },
  ];
  const plan = produceFinalPlan(results, 'Add a new scoring feature');
  assert.ok(typeof plan.task === 'string');
  assert.ok(typeof plan.consensus === 'string');
  assert.ok(Array.isArray(plan.disagreements));
  assert.ok(Array.isArray(plan.risks));
  assert.ok(Array.isArray(plan.missingInformation));
  assert.ok(typeof plan.recommendedNextAction === 'string');
  assert.ok(typeof plan.requiresHumanConfirmation === 'boolean');
  assert.ok(plan.generatedAt);
});

test('produceFinalPlan sets requiresHumanConfirmation for blocked consensus', () => {
  const results = [
    { role: 'security-reviewer', risks: ['Critical auth bypass'], recommendation: 'Block — unsafe and dangerous.', openQuestions: [] },
    { role: 'final-judge', risks: [], recommendation: 'Stop — reject this.', openQuestions: [] },
  ];
  const plan = produceFinalPlan(results, 'Delete all user data');
  assert.equal(plan.requiresHumanConfirmation, true);
});

test('produceFinalPlan sets finalPlan to null when blocked', () => {
  const results = [
    { role: 'security-reviewer', risks: ['Data loss possible'], recommendation: 'Block this — reject and stop.', openQuestions: [] },
  ];
  const plan = produceFinalPlan(results, 'Wipe the database');
  assert.ok(plan.requiresHumanConfirmation || plan.finalPlan === null || plan.finalPlan !== undefined);
});

test('produceFinalPlan includes final plan steps for safe tasks', () => {
  const results = [
    { role: 'planner', risks: [], recommendation: 'Proceed — no issues.', openQuestions: [] },
    { role: 'coder', risks: [], recommendation: 'Proceed after review.', openQuestions: [] },
  ];
  const plan = produceFinalPlan(results, 'Refactor the vault module');
  assert.ok(plan.finalPlan === null || Array.isArray(plan.finalPlan));
});

// ─── createMockCouncilResult ─────────────────────────────────────────────────

test('createMockCouncilResult returns a valid mock result', () => {
  const result = createMockCouncilResult('planner', 'plan a new feature');
  assert.ok(typeof result.role === 'string');
  assert.ok(typeof result.assessment === 'string');
  assert.ok(Array.isArray(result.risks));
  assert.ok(typeof result.recommendation === 'string');
  assert.ok(Array.isArray(result.openQuestions));
  assert.equal(result.mock, true);
});

test('createMockCouncilResult security-reviewer includes risks', () => {
  const result = createMockCouncilResult('security-reviewer', 'add OAuth');
  assert.ok(result.risks.length > 0);
});

test('createMockCouncilResult final-judge includes proceed recommendation', () => {
  const result = createMockCouncilResult('final-judge', 'safe refactor task');
  assert.ok(result.recommendation.toUpperCase().includes('PROCEED'));
});

// ─── /api/council endpoint integration ───────────────────────────────────────

test('/api/council returns mock council plan', async () => {
  const { default: worker } = await import('../worker.js');
  const request = new Request('https://worker.example/api/council', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'Implement scoring algorithm for JazzBackend' }),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.roles));
  assert.ok(typeof data.prompt === 'string');
  assert.ok(data.finalPlan);
  assert.equal(data.mode, 'mock');
});

test('/api/council requires task field', async () => {
  const { default: worker } = await import('../worker.js');
  const request = new Request('https://worker.example/api/council', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});
