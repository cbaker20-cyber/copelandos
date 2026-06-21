import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCouncilPrompt,
  createRolePrompt,
  mergeCouncilResults,
  produceFinalPlan,
  detectDisagreements,
  summarizeTradeoffs,
  createStubResult,
} from '../src/council.js';

const SAMPLE_TASK = 'Redesign the vault module with better error handling and security review';

describe('council — prompt generation', () => {
  it('creates a council prompt with task and roles', () => {
    const prompt = createCouncilPrompt(SAMPLE_TASK, ['planner', 'coder', 'security-reviewer']);
    assert.ok(prompt.includes(SAMPLE_TASK), 'includes task');
    assert.ok(prompt.includes('Planner'), 'includes Planner role');
    assert.ok(prompt.includes('Coder'), 'includes Coder role');
    assert.ok(prompt.includes('Security Reviewer'), 'includes Security Reviewer role');
    assert.ok(prompt.includes('Ground Rules'), 'has Ground Rules');
  });

  it('creates a role prompt for a known role', () => {
    const prompt = createRolePrompt('coder', SAMPLE_TASK);
    assert.ok(prompt.includes(SAMPLE_TASK), 'includes task');
    assert.ok(prompt.includes('Coder'), 'mentions Coder');
    assert.ok(prompt.includes('Recommendation'), 'has Recommendation section');
  });

  it('throws for unknown role', () => {
    assert.throws(() => createRolePrompt('nonexistent-role-xyz', SAMPLE_TASK), /unknown/i);
  });
});

describe('council — mock/stub results', () => {
  it('creates a stub result with mock: true', () => {
    const stub = createStubResult('coder', { recommendation: 'Use async/await' });
    assert.equal(stub.roleId, 'coder');
    assert.equal(stub.mock, true);
    assert.ok(stub.recommendation.includes('async/await'));
  });

  it('merges results from multiple roles', () => {
    const results = [
      createStubResult('planner', { recommendation: 'proceed', risks: ['scope creep'] }),
      createStubResult('security-reviewer', { recommendation: 'proceed with caution', risks: ['auth bypass'] }),
    ];
    const merged = mergeCouncilResults(results);
    assert.ok(Array.isArray(merged.recommendations));
    assert.equal(merged.recommendations.length, 2);
    assert.ok(Array.isArray(merged.risks));
    assert.ok(merged.risks.includes('scope creep'));
    assert.ok(merged.risks.includes('auth bypass'));
  });
});

describe('council — disagreement detection', () => {
  it('detects no disagreements when results align', () => {
    const results = [
      createStubResult('planner', { recommendation: 'proceed safely' }),
      createStubResult('coder', { recommendation: 'proceed with tests' }),
    ];
    const disagreements = detectDisagreements(results);
    assert.equal(disagreements.length, 0, 'no disagreements when aligned');
  });

  it('detects disagreements between opposing recommendations', () => {
    const results = [
      { roleId: 'planner', recommendation: 'proceed with the plan' },
      { roleId: 'security-reviewer', recommendation: 'block — unsafe pattern detected' },
    ];
    const disagreements = detectDisagreements(results);
    assert.ok(disagreements.length > 0, 'disagrement detected');
  });
});

describe('council — final plan', () => {
  it('produces a final plan with all required fields', () => {
    const results = [
      createStubResult('planner', { recommendation: 'proceed' }),
      createStubResult('final-judge', { recommendation: 'Proceed with tests and security check' }),
    ];
    const merged = mergeCouncilResults(results);
    const plan = produceFinalPlan(merged, SAMPLE_TASK);

    assert.ok(plan.task);
    assert.ok(plan.consensus);
    assert.ok(Array.isArray(plan.disagreements));
    assert.ok(Array.isArray(plan.risks));
    assert.ok(Array.isArray(plan.missingInformation));
    assert.ok(plan.recommendedNextAction);
    assert.ok(plan.finalPlan);
    assert.ok(plan.producedAt);
  });
});

describe('council — tradeoff summary', () => {
  it('summarizes tradeoffs across roles', () => {
    const results = [
      createStubResult('coder', { recommendation: 'implement fast', risks: ['may miss edge cases'] }),
      createStubResult('critic', { recommendation: 'slow down, add tests', risks: ['timeline'] }),
    ];
    const summary = summarizeTradeoffs(results);
    assert.equal(summary.length, 2);
    assert.ok(summary[0].role);
    assert.ok(summary[0].recommendation);
    assert.ok(summary[0].topRisk);
  });
});
