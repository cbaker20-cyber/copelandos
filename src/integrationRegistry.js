import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;

export function listIntegrations({ stage } = {}) {
  if (!stage) return INTEGRATIONS;
  return INTEGRATIONS.filter((integration) => integration.stage === stage);
}

export function getIntegration(id) {
  return INTEGRATIONS.find((integration) => integration.id === id) || null;
}

export function getIntegrationSummary() {
  const byStage = {};
  for (const integration of INTEGRATIONS) {
    byStage[integration.stage] = (byStage[integration.stage] || 0) + 1;
  }

  return {
    version: integrationsConfig.version,
    totalIntegrations: INTEGRATIONS.length,
    byStage,
    architecture: integrationsConfig.architecture,
    controlLoop: integrationsConfig.controlLoop,
    safetyBoundary: 'Integrations report configured/scaffold/planned status only; no live connection is implied.',
  };
}

export function describeControlLoop() {
  return {
    architecture: integrationsConfig.architecture,
    controlLoop: integrationsConfig.controlLoop,
    dispatchPolicy: {
      automaticExecution: false,
      draftPrOnly: true,
      humanReviewRequired: true,
      blockedActions: [
        'send_email',
        'merge_pr',
        'deploy',
        'delete_files',
        'arbitrary_shell',
        'store_private_student_data',
      ],
    },
  };
}

export function checkIntegrationAction(integrationId, action) {
  const integration = getIntegration(integrationId);
  if (!integration) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      reason: `Integration '${integrationId}' is not registered.`,
    };
  }

  if (integration.blockedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      integrationId,
      action,
      reason: `Action '${action}' is blocked for integration '${integrationId}'.`,
    };
  }

  if (!integration.allowedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      blocked: false,
      integrationId,
      action,
      confirmation_required: integration.requiresHumanReview,
      reason: `Action '${action}' is not in the allowed action list for '${integrationId}'.`,
    };
  }

  return {
    ok: true,
    allowed: !integration.requiresHumanReview,
    confirmation_required: integration.requiresHumanReview,
    integrationId,
    action,
    stage: integration.stage,
    reason: integration.requiresHumanReview
      ? `Action '${action}' is allowed for '${integrationId}' but requires human review.`
      : `Action '${action}' is allowed for '${integrationId}'.`,
  };
}
