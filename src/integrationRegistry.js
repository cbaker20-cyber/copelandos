import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;

function hasEnvValue(env, name) {
  return Boolean(env && env[name] && String(env[name]).trim().length > 0);
}

function requiredEnvConfigured(integration, env) {
  const required = integration.requiredEnvVars || [];
  if (required.length === 0) return true;
  return required.every(name => hasEnvValue(env, name));
}

function isExternallyConnected(integration) {
  return integration.mode !== 'internal' && integration.mode !== 'deterministic-first';
}

export function getIntegration(id) {
  return INTEGRATIONS.find(integration => integration.id === id) || null;
}

export function listIntegrations({ category, status } = {}) {
  let integrations = INTEGRATIONS;
  if (category) integrations = integrations.filter(integration => integration.category === category);
  if (status) integrations = integrations.filter(integration => integration.status === status);
  return integrations;
}

export function integrationStatus(integration, env) {
  const configured = requiredEnvConfigured(integration, env);
  const external = isExternallyConnected(integration);
  return {
    id: integration.id,
    displayName: integration.displayName,
    category: integration.category,
    status: integration.status,
    mode: integration.mode,
    riskLevel: integration.riskLevel,
    configured,
    connected: external ? false : configured && integration.status === 'allowed',
    available: configured && integration.status !== 'blocked',
    scaffold: integration.status === 'scaffold-only',
    confirmationRequired: integration.confirmationRequired,
    requiredEnvVars: integration.requiredEnvVars || [],
    note: integration.notes || null,
  };
}

export function publicIntegrationSummary(integration, env) {
  const status = integrationStatus(integration, env);
  return {
    ...status,
    description: integration.description,
    allowedOperations: integration.allowedOperations || [],
    blockedOperations: integration.blockedOperations || [],
  };
}

export function listIntegrationStatuses(env, filters = {}) {
  return listIntegrations(filters).map(integration => publicIntegrationSummary(integration, env));
}

export function checkIntegrationPermission(integrationId, operation) {
  const integration = getIntegration(integrationId);
  if (!integration) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      reason: `Integration '${integrationId}' is not in the registry.`,
      policy: integrationsConfig.policy,
    };
  }

  if (integration.status === 'blocked') {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      riskLevel: integration.riskLevel,
      reason: `Integration '${integrationId}' is blocked.`,
    };
  }

  if (integration.status === 'scaffold-only') {
    return {
      ok: false,
      allowed: false,
      scaffold: true,
      riskLevel: integration.riskLevel,
      reason: `Integration '${integrationId}' is scaffolded but not active.`,
    };
  }

  if (operation && (integration.blockedOperations || []).includes(operation)) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      riskLevel: integration.riskLevel,
      reason: `Operation '${operation}' is blocked for integration '${integrationId}'.`,
    };
  }

  if (operation && !(integration.allowedOperations || []).includes(operation)) {
    return {
      ok: false,
      allowed: false,
      confirmation_required: true,
      riskLevel: integration.riskLevel,
      reason: `Operation '${operation}' is not allowlisted for integration '${integrationId}'.`,
    };
  }

  if (integration.confirmationRequired || integration.status === 'allowed-with-confirmation') {
    return {
      ok: true,
      allowed: true,
      confirmation_required: true,
      riskLevel: integration.riskLevel,
      reason: `Integration '${integrationId}' operation '${operation || 'allowed operation'}' requires human confirmation.`,
    };
  }

  return {
    ok: true,
    allowed: true,
    confirmation_required: false,
    riskLevel: integration.riskLevel,
    reason: `Integration '${integrationId}' operation '${operation || 'allowed operation'}' is permitted.`,
  };
}

export function getIntegrationRegistrySummary() {
  const categories = {};
  const statuses = {};
  for (const integration of INTEGRATIONS) {
    categories[integration.category] = (categories[integration.category] || 0) + 1;
    statuses[integration.status] = (statuses[integration.status] || 0) + 1;
  }

  return {
    totalIntegrations: INTEGRATIONS.length,
    categories,
    statuses,
    policy: integrationsConfig.policy,
    architecture: integrationsConfig.architecture,
    scaffoldedIntegrations: INTEGRATIONS.filter(integration => integration.status === 'scaffold-only').map(integration => integration.id),
    confirmationRequiredIntegrations: INTEGRATIONS.filter(integration => integration.confirmationRequired).map(integration => integration.id),
  };
}

export function getIntegrationArchitecture() {
  return integrationsConfig.architecture;
}
