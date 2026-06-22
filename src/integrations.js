import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;

function hasConfiguredEnv(env, keys = []) {
  if (!env || keys.length === 0) return false;
  return keys.some((key) => Boolean(env[key] && String(env[key]).trim()));
}

function publicIntegration(integration, env = {}) {
  const configured = integration.connectionMode === 'internal'
    || integration.connectionMode === 'internal-config'
    || hasConfiguredEnv(env, integration.requiredEnvVars);
  const connected = integration.status === 'active'
    && (integration.connectionMode === 'internal' || integration.connectionMode === 'internal-config');

  return {
    id: integration.id,
    displayName: integration.displayName,
    surface: integration.surface,
    category: integration.category,
    status: integration.status,
    connectionMode: integration.connectionMode,
    configured,
    connected,
    entrypoints: integration.entrypoints,
    allowedActions: integration.allowedActions,
    blockedActions: integration.blockedActions,
    privacyNotes: integration.privacyNotes,
  };
}

export function listIntegrations(env = {}, { category, surface } = {}) {
  let integrations = INTEGRATIONS;
  if (category) integrations = integrations.filter((item) => item.category === category);
  if (surface) integrations = integrations.filter((item) => item.surface === surface);
  return integrations.map((integration) => publicIntegration(integration, env));
}

export function getIntegration(id, env = {}) {
  const integration = INTEGRATIONS.find((item) => item.id === id);
  return integration ? publicIntegration(integration, env) : null;
}

export function getIntegrationSummary(env = {}) {
  const integrations = listIntegrations(env);
  return {
    policy: integrationsConfig.policy,
    architecture: integrationsConfig.architecture,
    total: integrations.length,
    active: integrations.filter((item) => item.status === 'active').map((item) => item.id),
    scaffolded: integrations.filter((item) => item.status === 'scaffolded').map((item) => item.id),
    planned: integrations.filter((item) => item.status === 'planned').map((item) => item.id),
    connected: integrations.filter((item) => item.connected).map((item) => item.id),
    configured: integrations.filter((item) => item.configured).map((item) => item.id),
  };
}

export function checkIntegrationAction(integrationId, action) {
  const integration = INTEGRATIONS.find((item) => item.id === integrationId);
  if (!integration) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      reason: `Integration '${integrationId}' is not in the allowlist registry.`,
    };
  }

  if (integration.blockedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      blocked: true,
      reason: `Action '${action}' is blocked for integration '${integrationId}'.`,
    };
  }

  if (!integration.allowedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      blocked: false,
      reason: `Action '${action}' is not listed for integration '${integrationId}'.`,
    };
  }

  return {
    ok: true,
    allowed: true,
    blocked: false,
    reason: `Action '${action}' is allowed for integration '${integrationId}' within its documented scope.`,
  };
}
