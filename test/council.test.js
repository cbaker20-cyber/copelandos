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

import worker from '../worker.js';

function makeRequest(path, options = {}) {
  const url = `https://worker.example${path}`;
  return new Request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

async function postJson(path, body, env = {}) {
  const request = makeRequest(path, { method: 'POST', body: JSON.stringify(body) });
  const response = await worker.fetch(request, env, {});
  return { response, data: await response.json() };
}

async function getJson(path, env = {}) {
  const request = makeRequest(path, { method: 'GET' });
  const response = await worker.fetch(request, env, {});
  return { response, data: await response.json() };
}

// ── createCouncilPrompt ────────────────────────────────────────────────

test('createCouncilPrompt returns a string containing the task', () => {
  const roles = [{ displayName: 'Planner', description: 'Plans things' }];
  const prompt = createCouncilPrompt('refactor the auth module', roles);
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('refactor the auth module'));
  assert.ok(prompt.includes('Planner'));
});

test('createCouncilPrompt includes council instructions', () => {
  const roles = [{ displayName: 'Coder', description: 'Codes' }];
  const prompt = createCouncilPrompt('fix bug', roles);
  assert.ok(prompt.includes('Council'));
  assert.ok(prompt.includes('consensus'));
});

test('createCouncilPrompt truncates very long task descriptions', () => {
  const longTask = 'x'.repeat(2000);
  const roles = [{ displayName: 'Planner', description: 'Plans' }];
  const prompt = createCouncilPrompt(longTask, roles);
  assert.ok(prompt.length < longTask.length + 500);
});

// ── createRolePrompt ───────────────────────────────────────────────────

test('createRolePrompt returns a string for known role "planner"', () => {
  const prompt = createRolePrompt('planner', 'build a new feature');
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.includes('build a new feature'));
});

test('createRolePrompt includes the role system prompt context', () => {
  const prompt = createRolePrompt('security-reviewer', 'deploy to production');
  assert.ok(prompt.toLowerCase().includes('security') || prompt.includes('Security'));
});

test('createRolePrompt includes structured output fields', () => {
  const prompt = createRolePrompt('coder', 'implement user auth');
  assert.ok(prompt.includes('Assessment') || prompt.includes('assessment'));
  assert.ok(prompt.includes('Risks') || prompt.includes('risks'));
  assert.ok(prompt.includes('Recommendation') || prompt.includes('recommendation'));
});

test('createRolePrompt throws for an unknown role id', () => {
  assert.throws(() => createRolePrompt('unknown-role-xyz', 'task'), /Unknown council role/i);
});

test('createRolePrompt works for all defined roles', () => {
  const knownRoles = ['planner', 'researcher', 'coder', 'critic', 'security-reviewer', 'designer', 'summarizer', 'final-judge'];
  for (const roleId of knownRoles) {
    const prompt = createRolePrompt(roleId, 'test task');
    assert.ok(typeof prompt === 'string', `Role ${roleId} should return a string`);
    assert.ok(prompt.length > 0, `Role ${roleId} prompt should not be empty`);
  }
});

// ── mergeCouncilResults ────────────────────────────────────────────────

test('mergeCouncilResults returns error when given empty array', () => {
  const result = mergeCouncilResults([]);
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('mergeCouncilResults handles single result', () => {
  const results = [createMockCouncilResult('planner', 'add new endpoint')];
  const merged = mergeCouncilResults(results);
  assert.equal(merged.ok, true);
  assert.equal(merged.roleCount, 1);
  assert.ok(merged.consensus);
});

test('mergeCouncilResults combines risks from multiple roles', () => {
  const results = [
    createMockCouncilResult('security-reviewer', 'deploy to prod'),
    createMockCouncilResult('planner', 'deploy to prod'),
  ];
  const merged = mergeCouncilResults(results);
  assert.equal(merged.ok, true);
  assert.ok(Array.isArray(merged.risks));
  assert.ok(merged.risks.length > 0, 'Security reviewer should contribute risks');
});

test('mergeCouncilResults includes all role ids', () => {
  const results = [
    createMockCouncilResult('planner', 'task'),
    createMockCouncilResult('coder', 'task'),
    createMockCouncilResult('critic', 'task'),
  ];
  const merged = mergeCouncilResults(results);
  assert.ok(merged.roles.includes('planner'));
  assert.ok(merged.roles.includes('coder'));
  assert.ok(merged.roles.includes('critic'));
});

// ── detectDisagreements ────────────────────────────────────────────────

test('detectDisagreements returns empty array for single result', () => {
  const result = [createMockCouncilResult('planner', 'task')];
  assert.deepEqual(detectDisagreements(result), []);
});

test('detectDisagreements returns empty array for empty input', () => {
  assert.deepEqual(detectDisagreements([]), []);
});

test('detectDisagreements detects split vote when roles contradict', () => {
  const results = [
    { role: 'planner', recommendation: 'Proceed — this is safe and reversible.' },
    { role: 'security-reviewer', recommendation: 'Block — this action is unsafe and dangerous.' },
  ];
  const disagreements = detectDisagreements(results);
  assert.ok(disagreements.length > 0, 'Should detect disagreement between proceed and block');
});

// ── summarizeTradeoffs ─────────────────────────────────────────────────

test('summarizeTradeoffs returns summary string and counts', () => {
  const results = [
    createMockCouncilResult('planner', 'refactor auth'),
    createMockCouncilResult('security-reviewer', 'refactor auth'),
  ];
  const summary = summarizeTradeoffs(results);
  assert.ok(typeof summary.summary === 'string');
  assert.ok(typeof summary.riskCount === 'number');
  assert.ok(typeof summary.disagreementCount === 'number');
  assert.ok(typeof summary.openQuestionCount === 'number');
  assert.ok(Array.isArray(summary.tradeoffs));
});

// ── produceFinalPlan ───────────────────────────────────────────────────

test('produceFinalPlan returns a final plan object', () => {
  const results = [
    createMockCouncilResult('planner', 'add feature'),
    createMockCouncilResult('coder', 'add feature'),
  ];
  const plan = produceFinalPlan(results, 'add feature');
  assert.ok(typeof plan === 'object');
  assert.ok(plan.task);
  assert.ok(plan.consensus);
  assert.ok(typeof plan.requiresHumanConfirmation === 'boolean');
  assert.ok(plan.generatedAt);
});

test('produceFinalPlan includes risks and missingInformation', () => {
  const results = [createMockCouncilResult('security-reviewer', 'sensitive task')];
  const plan = produceFinalPlan(results, 'sensitive task');
  assert.ok(Array.isArray(plan.risks));
  assert.ok(Array.isArray(plan.missingInformation));
});

// ── /api/council endpoint ──────────────────────────────────────────────

test('POST /api/council returns council analysis in mock mode', async () => {
  const { response, data } = await postJson('/api/council', { task: 'design a new database schema' });
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, 'mock');
  assert.ok(Array.isArray(data.roles));
  assert.ok(data.prompt);
  assert.ok(data.finalPlan);
});

test('POST /api/council requires task field', async () => {
  const { response, data } = await postJson('/api/council', {});
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.ok(data.error.toLowerCase().includes('task'));
});

test('POST /api/council selects security-reviewer for security tasks', async () => {
  const { data } = await postJson('/api/council', { task: 'add authentication token validation' });
  assert.ok(data.roles.includes('security-reviewer'), 'Security tasks should include security-reviewer');
});

test('POST /api/council method guard rejects GET', async () => {
  const { response } = await getJson('/api/council');
  assert.equal(response.status, 405);
});

// ── /api/council/roles endpoint ────────────────────────────────────────

test('GET /api/council/roles returns list of roles', async () => {
  const { response, data } = await getJson('/api/council/roles');
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.roles));
  assert.ok(data.roles.length > 0);
  assert.ok(data.selectionRules);
});

test('GET /api/council/roles each role has id and displayName', async () => {
  const { data } = await getJson('/api/council/roles');
  for (const role of data.roles) {
    assert.ok(role.id, `Role should have id: ${JSON.stringify(role)}`);
    assert.ok(role.displayName, `Role should have displayName: ${JSON.stringify(role)}`);
    assert.ok(role.description, `Role should have description: ${JSON.stringify(role)}`);
  }
});

test('GET /api/council/roles includes all eight expected roles', async () => {
  const { data } = await getJson('/api/council/roles');
  const ids = data.roles.map(r => r.id);
  const expected = ['planner', 'researcher', 'coder', 'critic', 'security-reviewer', 'designer', 'summarizer', 'final-judge'];
  for (const id of expected) {
    assert.ok(ids.includes(id), `Expected role ${id} to be in registry`);
  }
});

// ── /api/council/role-prompt endpoint ─────────────────────────────────

test('POST /api/council/role-prompt returns prompt for valid role', async () => {
  const { response, data } = await postJson('/api/council/role-prompt', { roleId: 'planner', task: 'build a new API' });
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(typeof data.prompt === 'string');
  assert.ok(data.prompt.includes('build a new API'));
});

test('POST /api/council/role-prompt rejects unknown roleId', async () => {
  const { response, data } = await postJson('/api/council/role-prompt', { roleId: 'ghost-role', task: 'task' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test('POST /api/council/role-prompt requires roleId', async () => {
  const { response, data } = await postJson('/api/council/role-prompt', { task: 'task' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.ok(data.error.includes('roleId'));
});

test('POST /api/council/role-prompt requires task', async () => {
  const { response, data } = await postJson('/api/council/role-prompt', { roleId: 'coder' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.ok(data.error.includes('task'));
});

test('POST /api/council/role-prompt works for security-reviewer', async () => {
  const { data } = await postJson('/api/council/role-prompt', { roleId: 'security-reviewer', task: 'add file upload endpoint' });
  assert.equal(data.ok, true);
  assert.ok(data.prompt.toLowerCase().includes('security') || data.prompt.includes('Security'));
});
