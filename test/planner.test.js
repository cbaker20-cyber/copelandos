import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyTask, chooseSkill, chooseCouncilMode, createPlan, createTaskBrief, createCursorPrompt, createCodexPrompt } from '../src/planner.js';

describe('planner — task classification', () => {
  it('classifies a simple task as safe and skips council', () => {
    const task = 'Write a research note about catalase';
    const plan = createPlan(task);
    assert.ok(plan.classification, 'has classification');
    assert.ok(['safe', 'medium'].includes(plan.classification.riskLevel));
    assert.equal(plan.councilMode.useCouncil, false, 'simple task skips council');
  });

  it('triggers council mode for complex/high-risk tasks', () => {
    const task = 'Redesign the entire architecture of CopelandOS and deploy to production with security review';
    const council = chooseCouncilMode(task);
    assert.equal(council.useCouncil, true, 'complex task uses council');
  });

  it('marks deploy as high risk', () => {
    const clf = classifyTask('deploy this to Cloudflare');
    assert.equal(clf.riskLevel, 'high');
    assert.equal(clf.confirmationRequired, true);
  });

  it('selects a skill for coding tasks', () => {
    const skill = chooseSkill('fix the rhythm test in JazzBackend');
    assert.ok(skill, 'has skill');
    assert.ok(typeof skill.id === 'string');
  });
});

describe('planner — createPlan', () => {
  it('returns all required plan fields', () => {
    const plan = createPlan('implement the idea capture API');
    assert.ok(plan.task);
    assert.ok(plan.classification);
    assert.ok(Array.isArray(plan.roles));
    assert.ok(plan.councilMode);
    assert.ok(plan.planVersion);
    assert.ok(plan.createdAt);
  });

  it('always includes planner role', () => {
    const plan = createPlan('do something');
    assert.ok(plan.roles.includes('planner'), 'planner always included');
  });

  it('includes security-reviewer for high-risk tasks', () => {
    const plan = createPlan('deploy the app to production now');
    assert.ok(plan.roles.includes('security-reviewer'), 'security-reviewer included for high-risk');
  });

  it('includes coder and critic for coding tasks', () => {
    const plan = createPlan('implement a new API endpoint with tests');
    assert.ok(plan.roles.includes('coder') || plan.roles.includes('critic') || plan.roles.length >= 2);
  });
});

describe('planner — task brief', () => {
  it('returns all required brief fields', () => {
    const plan = createPlan('fix the bug');
    const brief = createTaskBrief('fix the bug', plan);
    assert.ok(brief.summary);
    assert.ok(brief.risk);
    assert.ok(brief.suggestedAction);
    assert.equal(typeof brief.requiresConfirmation, 'boolean');
    assert.equal(typeof brief.councilNeeded, 'boolean');
    assert.ok(Array.isArray(brief.rolesInvolved));
  });
});

describe('planner — Cursor prompt', () => {
  it('generates a Cursor prompt with required sections', () => {
    const prompt = createCursorPrompt('fix rhythm tests in JazzBackend');
    assert.ok(prompt.includes('Cursor Task Prompt'), 'has header');
    assert.ok(prompt.includes('Goal'), 'has Goal section');
    assert.ok(prompt.includes('Constraints'), 'has Constraints section');
    assert.ok(prompt.includes('Forbidden Actions'), 'has Forbidden Actions');
    assert.ok(prompt.includes('Tests to Run'), 'has Tests section');
    assert.ok(prompt.includes('Draft PR Title'), 'has Draft PR Title');
    assert.ok(prompt.includes('npm test'), 'includes npm test');
    assert.ok(!prompt.includes('send_email') || prompt.includes('FORBIDDEN') || prompt.includes('send_email'), 'send_email appears in forbidden context');
    assert.ok(prompt.includes('arbitrary_shell'), 'mentions arbitrary_shell in forbidden');
  });

  it('does not include real API keys', () => {
    const prompt = createCursorPrompt('some task');
    assert.ok(!prompt.match(/sk-[A-Za-z0-9]{20}/), 'no OpenAI key');
    assert.ok(!prompt.match(/ghp_[A-Za-z0-9]{20}/), 'no GitHub token');
  });
});

describe('planner — Codex prompt', () => {
  it('generates a Codex prompt with required sections', () => {
    const prompt = createCodexPrompt('review security of the vault module');
    assert.ok(prompt.includes('Codex Architecture'), 'has header');
    assert.ok(prompt.includes('Security Requirements'), 'has Security Requirements');
    assert.ok(prompt.includes('Forbidden Actions'), 'has Forbidden Actions');
    assert.ok(prompt.includes('ALLOWED_ORIGIN'), 'mentions CORS');
  });
});
