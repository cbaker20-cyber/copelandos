import planningRolesConfig from '../config/planning-roles.json' with { type: 'json' };

const ALL_ROLES = planningRolesConfig.roles;

function getRole(id) {
  return ALL_ROLES.find((r) => r.id === id) || null;
}

/**
 * Build the top-level council prompt that frames the task for all roles.
 */
export function createCouncilPrompt(task, roles) {
  const roleNames = roles.map((r) => {
    const role = typeof r === 'string' ? getRole(r) : r;
    return role ? role.displayName : r;
  }).join(', ');

  return [
    `# CopelandOS AI Council Session`,
    ``,
    `## Task`,
    ``,
    task,
    ``,
    `## Council Roles`,
    roleNames,
    ``,
    `## Ground Rules`,
    `- Each role provides its perspective independently.`,
    `- Disagreements must be explicitly noted.`,
    `- No role fabricates facts or claims false confidence.`,
    `- Security Reviewer has veto power on unsafe actions.`,
    `- Final Judge synthesizes into a single recommended next action.`,
    ``,
    `## Output Format`,
    `Each role outputs: perspective, recommendation, risks, missing information.`,
    `Final Judge outputs: consensus, disagreements, risks, missing information, recommended next action, final plan.`,
  ].join('\n');
}

/**
 * Build a role-specific prompt for a council session.
 */
export function createRolePrompt(roleId, task) {
  const role = getRole(roleId);
  if (!role) throw new Error(`Unknown council role: ${roleId}`);

  return [
    role.systemPrompt,
    ``,
    `## Task`,
    ``,
    task,
    ``,
    `## Your Output`,
    `Provide:`,
    `1. Perspective: your analysis from the ${role.displayName} viewpoint`,
    `2. Recommendation: what you recommend doing`,
    `3. Risks: what could go wrong`,
    `4. Missing information: what you need to know to be more confident`,
  ].join('\n');
}

/**
 * Merge results from multiple council role outputs into a structured response.
 *
 * In mock/stub mode, results are plain objects with { roleId, perspective,
 * recommendation, risks, missingInfo }. A real AI backend would populate
 * these from actual model calls.
 */
export function mergeCouncilResults(results) {
  const recommendations = results.map((r) => ({ role: r.roleId, recommendation: r.recommendation || null }));
  const allRisks = results.flatMap((r) => (Array.isArray(r.risks) ? r.risks : r.risks ? [r.risks] : []));
  const allMissing = results.flatMap((r) => (Array.isArray(r.missingInfo) ? r.missingInfo : r.missingInfo ? [r.missingInfo] : []));
  const disagreements = detectDisagreements(results);

  return {
    recommendations,
    risks: [...new Set(allRisks)],
    missingInfo: [...new Set(allMissing)],
    disagreements,
    roleCount: results.length,
  };
}

/**
 * Produce the final council plan from merged results.
 */
export function produceFinalPlan(merged, task) {
  const primaryRecommendation = merged.recommendations.find((r) => r.role === 'final-judge')
    || merged.recommendations[0]
    || { recommendation: 'Review task manually.' };

  return {
    task,
    consensus: merged.disagreements.length === 0 ? 'Full consensus' : 'Partial consensus with noted disagreements',
    disagreements: merged.disagreements,
    risks: merged.risks,
    missingInformation: merged.missingInfo,
    recommendedNextAction: primaryRecommendation.recommendation,
    finalPlan: buildFinalPlanText(task, merged, primaryRecommendation),
    producedAt: new Date().toISOString(),
  };
}

function buildFinalPlanText(task, merged, primaryRec) {
  const lines = [
    `## Final Council Plan`,
    ``,
    `**Task:** ${task.slice(0, 200)}`,
    ``,
    `**Recommended action:** ${primaryRec.recommendation || 'Manual review required'}`,
  ];

  if (merged.disagreements.length > 0) {
    lines.push(``, `**Disagreements:**`);
    merged.disagreements.forEach((d) => lines.push(`- ${d}`));
  }

  if (merged.risks.length > 0) {
    lines.push(``, `**Risks:**`);
    merged.risks.forEach((r) => lines.push(`- ${r}`));
  }

  if (merged.missingInfo.length > 0) {
    lines.push(``, `**Missing information:**`);
    merged.missingInfo.forEach((m) => lines.push(`- ${m}`));
  }

  return lines.join('\n');
}

/**
 * Detect disagreements between council members.
 * Two results disagree if their recommendations diverge significantly.
 */
export function detectDisagreements(results) {
  const disagreements = [];

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i];
      const b = results[j];
      if (!a.recommendation || !b.recommendation) continue;
      const aLower = a.recommendation.toLowerCase();
      const bLower = b.recommendation.toLowerCase();

      const opposites = [
        ['proceed', 'block'],
        ['safe', 'unsafe'],
        ['approve', 'reject'],
        ['yes', 'no'],
        ['do not', 'should'],
      ];

      for (const [x, y] of opposites) {
        if ((aLower.includes(x) && bLower.includes(y)) || (aLower.includes(y) && bLower.includes(x))) {
          disagreements.push(`${a.roleId} vs ${b.roleId}: ${a.recommendation.slice(0, 60)} ≠ ${b.recommendation.slice(0, 60)}`);
        }
      }
    }
  }

  return disagreements;
}

/**
 * Summarize trade-offs from council results for human review.
 */
export function summarizeTradeoffs(results) {
  return results.map((r) => ({
    role: r.roleId,
    recommendation: (r.recommendation || 'No recommendation').slice(0, 200),
    topRisk: Array.isArray(r.risks) ? (r.risks[0] || 'None identified') : (r.risks || 'None identified'),
  }));
}

/**
 * Create a stub council result for a single role.
 * Use this in tests and mock mode.
 */
export function createStubResult(roleId, overrides = {}) {
  return {
    roleId,
    perspective: overrides.perspective || `${roleId} perspective (mock mode — no AI call made)`,
    recommendation: overrides.recommendation || `Proceed with caution. Review task manually.`,
    risks: overrides.risks || ['Mock result — real AI analysis not performed'],
    missingInfo: overrides.missingInfo || ['Real AI response required for production use'],
    mock: true,
  };
}
