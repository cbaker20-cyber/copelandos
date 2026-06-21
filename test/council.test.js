import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCouncilPrompt,
  createRolePrompt,
  mergeCouncilResults,
  produceFinalPlan,
  detectDisagreements,
  summarizeTradeoffs,
  createMockCouncilResult,
} from '../src/council.js';

import { selectRoles } from '../src/planner.js';

test('createCouncilPrompt includes task and role list', () => {
  const roles = [
    { displayName: 'Planner', description: 'Plans the task.' },
    { displayName: 'Security Reviewer', description: 'Reviews security.' },
  ];
  const prompt = createCouncilPrompt('refactor the authentication module', roles);
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('refactor the authentication module'));
  assert.ok(prompt.includes('Planner'));
  assert.ok(prompt.includes('Security Reviewer'));
  assert.ok(prompt.toLowerCase().includes('council'));
});

test('createRolePrompt returns structured prompt for known role', () => {
  const prompt = createRolePrompt('planner', 'implement an idea capture endpoint');
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.length > 0);
  assert.ok(prompt.toLowerCase().includes('assessment') || prompt.toLowerCase().includes('risk') || prompt.toLowerCase().includes('task'));
});

test('createRolePrompt throws for unknown role', () => {
  assert.throws(() => createRolePrompt('nonexistent-role-xyz', 'some task'), /unknown/i);
});

test('createRolePrompt for security reviewer mentions security', () => {
  const prompt = createRolePrompt('security-reviewer', 'update CORS configuration');
  assert.ok(prompt.toLowerCase().includes('security'));
});

test('mergeCouncilResults with empty array returns ok: false', () => {
  const result = mergeCouncilResults([]);
  assert.equal(result.ok, false);
  assert.ok(result.error);
  assert.equal(result.consensus, null);
});

test('mergeCouncilResults with mock results produces consensus', () => {
  const task = 'implement a new API endpoint';
  const roles = selectRoles(task);
  const mockResults = roles.map(r => createMockCouncilResult(r.id, task));
  const merged = mergeCouncilResults(mockResults);
  assert.equal(merged.ok, true);
  assert.ok(merged.consensus);
  assert.ok(typeof merged.roleCount === 'number');
  assert.ok(merged.roleCount > 0);
  assert.ok(Array.isArray(merged.risks));
  assert.ok(Array.isArray(merged.disagreements));
  assert.ok(Array.isArray(merged.missingInformation));
});

test('detectDisagreements returns empty array for single result', () => {
  const result = [createMockCouncilResult('planner', 'fix a typo')];
  const disagreements = detectDisagreements(result);
  assert.ok(Array.isArray(disagreements));
  assert.equal(disagreements.length, 0);
});

test('detectDisagreements flags contradictory recommendations', () => {
  const conflicting = [
    { role: 'planner', recommendation: 'Proceed and approve this change.', risks: [], openQuestions: [] },
    { role: 'security-reviewer', recommendation: 'Block this. It is dangerous and unsafe.', risks: ['security hole'], openQuestions: [] },
  ];
  const disagreements = detectDisagreements(conflicting);
  assert.ok(Array.isArray(disagreements));
  assert.ok(disagreements.length > 0);
  assert.ok(disagreements[0].toLowerCase().includes('split') || disagreements[0].toLowerCase().includes('block') || disagreements[0].toLowerCase().includes('recommend'));
});

test('summarizeTradeoffs returns risk and disagreement counts', () => {
  const task = 'deploy the application to production';
  const roles = selectRoles(task);
  const results = roles.map(r => createMockCouncilResult(r.id, task));
  const tradeoffs = summarizeTradeoffs(results);
  assert.ok(typeof tradeoffs.summary === 'string');
  assert.ok(typeof tradeoffs.riskCount === 'number');
  assert.ok(typeof tradeoffs.disagreementCount === 'number');
  assert.ok(typeof tradeoffs.openQuestionCount === 'number');
  assert.ok(Array.isArray(tradeoffs.tradeoffs));
});

test('produceFinalPlan returns structured output with task and consensus', () => {
  const task = 'implement idea capture API';
  const roles = selectRoles(task);
  const results = roles.map(r => createMockCouncilResult(r.id, task));
  const plan = produceFinalPlan(results, task);
  assert.ok(plan.task);
  assert.ok(plan.consensus);
  assert.ok(plan.recommendedNextAction);
  assert.ok(typeof plan.requiresHumanConfirmation === 'boolean');
  assert.ok(plan.generatedAt);
});

test('produceFinalPlan with blocked consensus sets requiresHumanConfirmation', () => {
  const blockedResults = [
    { role: 'security-reviewer', recommendation: 'Block this immediately.', risks: ['critical vulnerability'], openQuestions: [] },
    { role: 'critic', recommendation: 'Stop — this is dangerous.', risks: ['data loss risk'], openQuestions: [] },
  ];
  const plan = produceFinalPlan(blockedResults, 'delete all files');
  assert.equal(plan.requiresHumanConfirmation, true);
  assert.ok(plan.recommendedNextAction.toLowerCase().includes('stop') || plan.recommendedNextAction.toLowerCase().includes('human') || plan.recommendedNextAction.toLowerCase().includes('council'));
});

test('simple task does not trigger council mode via worker /api/council', async () => {
  const worker = (await import('../worker.js')).default;
  const request = new Request('https://worker.example/api/council', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'fix a typo in the README' }),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.roles));
  assert.ok(data.finalPlan);
  assert.equal(data.mode, 'mock');
});

test('complex security task triggers council with security-reviewer role', async () => {
  const worker = (await import('../worker.js')).default;
  const request = new Request('https://worker.example/api/council', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'refactor the entire authentication and CORS system with multi-provider security review' }),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.ok(data.roles.includes('security-reviewer'), 'Security-sensitive task should include security-reviewer');
});

test('GET /api/council/roles lists all roles and selection rules', async () => {
  const worker = (await import('../worker.js')).default;
  const request = new Request('https://worker.example/api/council/roles', { method: 'GET' });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.roles));
  assert.ok(data.roles.length > 0);
  assert.ok(data.selectionRules);
  const roleIds = data.roles.map(r => r.id);
  assert.ok(roleIds.includes('planner'));
  assert.ok(roleIds.includes('security-reviewer'));
  assert.ok(roleIds.includes('coder'));
});

test('POST /api/council/role-prompt returns role-specific prompt', async () => {
  const worker = (await import('../worker.js')).default;
  const request = new Request('https://worker.example/api/council/role-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: 'coder', task: 'implement the idea capture endpoint' }),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(typeof data.prompt === 'string');
  assert.ok(data.prompt.length > 0);
  assert.equal(data.roleId, 'coder');
});

test('POST /api/council/role-prompt returns 400 for unknown role', async () => {
  const worker = (await import('../worker.js')).default;
  const request = new Request('https://worker.example/api/council/role-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: 'unknown-role-xyz', task: 'do something' }),
  });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test('createMockCouncilResult produces role-specific output', () => {
  const result = createMockCouncilResult('security-reviewer', 'update CORS config');
  assert.ok(result.role === 'security-reviewer');
  assert.ok(Array.isArray(result.risks));
  assert.ok(result.risks.length > 0, 'security reviewer should flag risks');
  assert.equal(result.mock, true);
});
