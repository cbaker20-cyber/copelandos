import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations || [];
const CONTROL_LOOP = integrationsConfig.controlLoop || [];
const VALID_STATUSES = new Set(['implemented', 'scaffold-only']);
const VALID_STAGES = new Set(['implemented', 'scaffolded', 'planned']);

function envValue(env, name) {
  const value = name ? env?.[name] : undefined;
  return typeof value === 'string' ? value.trim() : value;
}

function hasRequiredEnv(env, requiredEnvVars = []) {
  return requiredEnvVars.every((name) => Boolean(envValue(env, name)));
}

function publicIntegration(integration, env = {}) {
  const requiredEnvVars = Array.isArray(integration.requiredEnvVars) ? integration.requiredEnvVars : [];
  const configured = hasRequiredEnv(env, requiredEnvVars);
  const internal = integration.mode === 'internal';
  const implemented = integration.status === 'implemented';

  return {
    id: integration.id,
    displayName: integration.displayName,
    category: integration.category,
    stage: integration.stage,
    mode: integration.mode,
    riskLevel: integration.riskLevel,
    status: integration.status,
    configured,
    ready: internal && implemented,
    connected: false,
    endpoint: integration.endpoint || null,
    allowedActions: integration.allowedActions || [],
    blockedActions: integration.blockedActions || [],
    requiredEnvVars,
    notes: integration.notes || '',
    honestStatus: internal && implemented
      ? 'Internal module is implemented; no external connection is implied.'
      : configured
        ? 'Required environment is present, but no live connection probe has run.'
        : 'Not connected. Required configuration is missing or this is future work.',
  };
}

export function listIntegrations({ category, stage, env } = {}) {
  return INTEGRATIONS
    .filter((integration) => !category || integration.category === category)
    .filter((integration) => !stage || integration.stage === stage)
    .map((integration) => publicIntegration(integration, env));
}

export function getIntegration(id, env = {}) {
  const integration = INTEGRATIONS.find((item) => item.id === id);
  return integration ? publicIntegration(integration, env) : null;
}

export function checkIntegration(id, env = {}) {
  const integration = getIntegration(id, env);
  if (!integration) {
    return {
      ok: false,
      allowed: false,
      error: `Integration '${id}' is not registered.`,
      connected: false,
    };
  }

  if (integration.status === 'scaffold-only' || integration.stage === 'planned') {
    return {
      ok: false,
      allowed: false,
      integration,
      connected: false,
      scaffold: true,
      reason: `Integration '${id}' is scaffolded but not active.`,
    };
  }

  return {
    ok: true,
    allowed: true,
    integration,
    connected: false,
    reason: integration.honestStatus,
  };
}

export function getControlLoop(env = {}) {
  return CONTROL_LOOP.map((step) => ({
    ...step,
    integration: getIntegration(step.integrationId, env),
  }));
}

export function getMorningReportPlan() {
  return {
    ...integrationsConfig.morningReport,
    generatedBy: 'CopelandOS integration registry',
    safety: 'Dashboard-first status. Email may only be created as an unsent draft.',
  };
}

export function getIntegrationSummary(env = {}) {
  const integrations = listIntegrations({ env });
  const byStage = {};
  const byCategory = {};

  for (const integration of integrations) {
    byStage[integration.stage] = (byStage[integration.stage] || 0) + 1;
    byCategory[integration.category] = (byCategory[integration.category] || 0) + 1;
  }

  return {
    total: integrations.length,
    implemented: integrations.filter((item) => item.status === 'implemented').length,
    scaffoldOnly: integrations.filter((item) => item.status === 'scaffold-only').length,
    connected: integrations.filter((item) => item.connected).length,
    configured: integrations.filter((item) => item.configured).length,
    byStage,
    byCategory,
    statusPolicy: integrationsConfig.statusPolicy,
  };
}

export function validateIntegrationRegistry() {
  const ids = new Set();
  const errors = [];

  for (const integration of INTEGRATIONS) {
    if (!integration.id) errors.push('Integration missing id.');
    if (ids.has(integration.id)) errors.push(`Duplicate integration id '${integration.id}'.`);
    ids.add(integration.id);

    if (!integration.displayName) errors.push(`${integration.id} missing displayName.`);
    if (!VALID_STAGES.has(integration.stage)) errors.push(`${integration.id} has invalid stage '${integration.stage}'.`);
    if (!VALID_STATUSES.has(integration.status)) errors.push(`${integration.id} has invalid status '${integration.status}'.`);
    if (!Array.isArray(integration.requiredEnvVars)) errors.push(`${integration.id} missing requiredEnvVars array.`);
    if (!Array.isArray(integration.allowedActions)) errors.push(`${integration.id} missing allowedActions array.`);
    if (!Array.isArray(integration.blockedActions)) errors.push(`${integration.id} missing blockedActions array.`);
    if (integration.connected === true) errors.push(`${integration.id} must not hard-code connected: true.`);
  }

  for (const step of CONTROL_LOOP) {
    if (!ids.has(step.integrationId)) {
      errors.push(`Control loop step ${step.step} references unknown integration '${step.integrationId}'.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    integrationCount: INTEGRATIONS.length,
    controlLoopSteps: CONTROL_LOOP.length,
  };
}
