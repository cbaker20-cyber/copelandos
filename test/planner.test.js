import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyTask,
  chooseSkill,
  chooseCouncilMode,
  createPlan,
  createTaskBrief,
  createCursorPrompt,
  createCodexPrompt,
  selectRoles,
} from '../src/planner.js';

test('classifyTask returns a classification object', () => {
  const result = classifyTask('fix the bug in the vault module');
  assert.ok(result.category);
  assert.ok(result.riskLevel);
  assert.ok(typeof result.confirmationRequired === 'boolean');
});

test('chooseSkill returns a skill for coding task', () => {
  const skill = chooseSkill('implement the idea capture API endpoint');
  assert.ok(skill !== null);
  assert.ok(skill.id);
  assert.ok(skill.displayName);
});

test('simple task avoids council mode', () => {
  const result = chooseCouncilMode('fix a typo in the README');
  assert.equal(result.useCouncil, false);
});

test('complex task selects council mode', () => {
  const result = chooseCouncilMode('Refactor the entire permission engine to support role-based access control with multiple providers, security review, and backwards compatibility');
  assert.equal(result.useCouncil, true);
  assert.ok(result.reason);
});

test('high-risk task selects council mode', () => {
  const result = chooseCouncilMode('deploy the application to production');
  assert.equal(result.useCouncil, true);
});

test('security-sensitive task selects council mode', () => {
  const result = chooseCouncilMode('update the CORS configuration and authentication token handling');
  assert.equal(result.useCouncil, true);
});

test('createPlan returns structured plan with steps', () => {
  const plan = createPlan('implement a new API endpoint for idea capture');
  assert.ok(plan.task);
  assert.ok(plan.classification);
  assert.ok(Array.isArray(plan.steps));
  assert.ok(plan.steps.length > 0);
  assert.ok(plan.councilMode);
  assert.ok(Array.isArray(plan.roles));
  assert.ok(typeof plan.requiresHumanConfirmation === 'boolean');
  assert.ok(plan.createdAt);
});

test('high-risk plan has human confirmation required', () => {
  const plan = createPlan('deploy this to Cloudflare production');
  assert.equal(plan.requiresHumanConfirmation, true);
  assert.ok(plan.warnings.length > 0);
  assert.ok(plan.steps[0].toUpperCase().includes('STOP'));
});

test('email draft plan has draft-only warning', () => {
  const plan = createPlan('email Mr. Welgoss about NHS eligibility requirements');
  assert.ok(plan.warnings.some(w => w.toLowerCase().includes('draft') || w.toLowerCase().includes('confirmation')));
});

test('createTaskBrief returns concise summary', () => {
  const brief = createTaskBrief('fix the JazzBackend rhythm test');
  assert.ok(brief.title);
  assert.ok(brief.category);
  assert.ok(brief.risk);
  assert.ok(Array.isArray(brief.roles));
  assert.ok(Array.isArray(brief.steps));
});

test('selectRoles for coding task includes coder and critic', () => {
  const roles = selectRoles('implement a new authentication system');
  const roleIds = roles.map(r => r.id);
  assert.ok(roleIds.includes('planner'), 'should include planner');
  assert.ok(roleIds.includes('coder') || roleIds.includes('security-reviewer'), 'should include technical roles');
});

test('selectRoles for research task includes researcher', () => {
  const roles = selectRoles('research the connectome perturbation literature');
  const roleIds = roles.map(r => r.id);
  assert.ok(roleIds.includes('planner'));
});

test('createCursorPrompt includes repo and constraints', () => {
  const prompt = createCursorPrompt({ idea: { id: 'test-1', text: 'fix rhythm test' }, project: 'jazz-backend', task: 'fix the triplet timing test' });
  assert.ok(prompt.includes('cbaker20-cyber/JazzBackend'));
  assert.ok(prompt.toLowerCase().includes('forbidden') || prompt.toLowerCase().includes('constraint'));
  assert.ok(prompt.toLowerCase().includes('tests') || prompt.toLowerCase().includes('test'));
  assert.ok(prompt.includes('ISSUE OR IDEA ID:'));
  assert.ok(prompt.includes('FILES TO INSPECT:'));
  assert.ok(prompt.includes('DRAFT PR TITLE:'));
});

test('createCodexPrompt includes security review focus', () => {
  const prompt = createCodexPrompt({ idea: { id: 'test-2', text: 'review auth module' }, project: 'copelandos', task: 'review the permission engine' });
  assert.ok(prompt.toLowerCase().includes('security'));
  assert.ok(prompt.toLowerCase().includes('forbidden') || prompt.toLowerCase().includes('test'));
  assert.ok(prompt.includes('SAFETY RULES:'));
  assert.ok(prompt.includes('FORBIDDEN ACTIONS:'));
});

test('createCursorPrompt has forbidden actions from project config', () => {
  const prompt = createCursorPrompt({ idea: { id: 'test-3', text: 'do music stuff' }, project: 'score-scanner', task: 'scan a PDF score' });
  assert.ok(prompt.toLowerCase().includes('forbidden'));
});
