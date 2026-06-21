// AI Council scaffold — mockable/stub-compatible.
// All functions return structured objects that tests can verify.
// No real API calls are made in this module; real AI calls are
// layered on top by the provider router or the /api/ai route.

import planningRoles from '../config/planning-roles.json' with { type: 'json' };

const ROLES_MAP = Object.fromEntries(planningRoles.roles.map(r => [r.id, r]));

export function createCouncilPrompt(task, roles) {
  const roleList = roles.map(r => `- ${r.displayName}: ${r.description}`).join('\n');
  return [
    'CopelandOS AI Council — Multi-perspective review session.',
    '',
    `Task under review: ${String(task || '').slice(0, 500)}`,
    '',
    'Council members assigned to this task:',
    roleList,
    '',
    'Instructions:',
    '1. Each council member analyzes the task from their perspective.',
    '2. Identify agreements, disagreements, and unknowns.',
    '3. Produce a final consensus recommendation.',
    '4. Flag anything that requires human confirmation.',
    '5. Never approve high-risk actions automatically.',
  ].join('\n');
}

export function createRolePrompt(roleId, task) {
  const role = ROLES_MAP[roleId];
  if (!role) throw new Error(`Unknown council role: ${roleId}`);
  return [
    role.systemPrompt,
    '',
    `Task: ${String(task || '').slice(0, 500)}`,
    '',
    'Provide your perspective in structured form:',
    '- Assessment: [your evaluation]',
    '- Risks: [specific risks you see]',
    '- Recommendation: [what you recommend]',
    '- Open questions: [what needs clarification]',
  ].join('\n');
}

export function mergeCouncilResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      ok: false,
      error: 'No council results to merge.',
      consensus: null,
      disagreements: [],
      risks: [],
      missingInformation: [],
      recommendedAction: null,
      finalPlan: null,
    };
  }

  const allRisks = results.flatMap(r => r.risks || []);
  const allRecommendations = results.map(r => r.recommendation).filter(Boolean);
  const allOpenQuestions = results.flatMap(r => r.openQuestions || []);

  return {
    ok: true,
    roleCount: results.length,
    consensus: deriveConsensus(results),
    disagreements: detectDisagreements(results),
    risks: [...new Set(allRisks)],
    missingInformation: [...new Set(allOpenQuestions)],
    recommendedAction: allRecommendations[allRecommendations.length - 1] || null,
    roles: results.map(r => r.role),
  };
}

export function detectDisagreements(results) {
  if (!Array.isArray(results) || results.length < 2) return [];
  const disagreements = [];
  const recommendations = results.map(r => r.recommendation || '').filter(Boolean);
  if (recommendations.length < 2) return [];

  // Check for contradictory recommendations (proceed vs block)
  const hasApprove = recommendations.some(r => /\b(proceed|approve|safe|go ahead)\b/i.test(r));
  const hasBlock = recommendations.some(r => /\b(block|stop|reject|unsafe|dangerous|risk)\b/i.test(r));
  if (hasApprove && hasBlock) {
    disagreements.push('Council is split: some roles recommend proceeding while others recommend blocking.');
  }

  return disagreements;
}

export function summarizeTradeoffs(results) {
  const merged = mergeCouncilResults(results);
  return {
    summary: merged.consensus || 'No consensus reached.',
    riskCount: merged.risks.length,
    disagreementCount: merged.disagreements.length,
    openQuestionCount: merged.missingInformation.length,
    tradeoffs: buildTradeoffList(merged),
  };
}

function buildTradeoffList(merged) {
  const tradeoffs = [];
  if (merged.risks.length > 0) {
    tradeoffs.push(`${merged.risks.length} risk(s) identified: ${merged.risks.slice(0, 3).join('; ')}`);
  }
  if (merged.disagreements.length > 0) {
    tradeoffs.push(`${merged.disagreements.length} disagreement(s): ${merged.disagreements[0]}`);
  }
  if (merged.missingInformation.length > 0) {
    tradeoffs.push(`${merged.missingInformation.length} open question(s) need resolution before proceeding.`);
  }
  return tradeoffs;
}

function deriveConsensus(results) {
  const recommendations = results.map(r => r.recommendation || '').filter(Boolean);
  if (recommendations.length === 0) return 'No recommendations provided.';

  const hasBlock = recommendations.some(r => /\b(block|stop|reject|unsafe|dangerous)\b/i.test(r));
  if (hasBlock) return 'Consensus: BLOCKED. One or more council members flagged a critical risk.';

  const hasConfirmation = recommendations.some(r => /\b(confirmation|approve|confirm|human)\b/i.test(r));
  if (hasConfirmation) return 'Consensus: CONFIRMATION REQUIRED before proceeding.';

  return 'Consensus: PROCEED with caution. Review all risks and open questions.';
}

export function produceFinalPlan(results, task) {
  const merged = mergeCouncilResults(results);
  const tradeoffs = summarizeTradeoffs(results);

  const blocked = merged.consensus?.includes('BLOCKED') || false;
  const confirmationRequired = merged.consensus?.includes('CONFIRMATION') || false;

  return {
    task: String(task || '').slice(0, 200),
    councilSize: results.length,
    consensus: merged.consensus,
    disagreements: merged.disagreements,
    risks: merged.risks,
    missingInformation: merged.missingInformation,
    recommendedNextAction: blocked
      ? 'Stop. Present council findings to human before any action.'
      : confirmationRequired
        ? 'Present plan to human for explicit confirmation.'
        : merged.recommendedAction || 'Proceed with documented steps.',
    finalPlan: blocked ? null : buildFinalPlanSteps(results, merged),
    requiresHumanConfirmation: blocked || confirmationRequired,
    tradeoffSummary: tradeoffs.summary,
    generatedAt: new Date().toISOString(),
  };
}

function buildFinalPlanSteps(results, merged) {
  const steps = [
    'Review all council findings and risks.',
    ...merged.risks.map(r => `Address risk: ${r}`),
    ...merged.missingInformation.map(q => `Resolve: ${q}`),
    'Implement the minimum viable change.',
    'Verify with tests.',
    'Submit for human review before merging.',
  ];
  return steps;
}

// Mock council result for testing without real AI providers
export function createMockCouncilResult(roleId, task) {
  return {
    role: roleId,
    assessment: `[MOCK] ${roleId} analysis of: ${String(task).slice(0, 80)}`,
    risks: roleId === 'security-reviewer' ? ['Input not validated', 'Credentials exposure possible'] : [],
    recommendation: roleId === 'final-judge' ? 'PROCEED with caution — see risks.' : 'Review and test carefully.',
    openQuestions: ['Is this change reversible?', 'Have tests been updated?'],
    mock: true,
  };
}
