import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;

function hasValue(env, key) {
  return Boolean(env && env[key] && String(env[key]).trim().length > 0);
}

function requiredAllConfigured(integration, env) {
  const required = integration.requiredEnvVars || [];
  return required.length === 0 || required.every(key => hasValue(env, key));
}

function requiredAnyConfigured(integration, env) {
  const requiredAny = integration.requiredEnvVarsAny || [];
  return requiredAny.length === 0 || requiredAny.some(key => hasValue(env, key));
}

export function getIntegration(id) {
  return INTEGRATIONS.find(integration => integration.id === id) || null;
}

export function listIntegrations({ stage, surface } = {}) {
  let integrations = INTEGRATIONS;
  if (stage) integrations = integrations.filter(integration => integration.stage === stage);
  if (surface) integrations = integrations.filter(integration => integration.surface === surface);
  return integrations;
}

export function getIntegrationStatus(integrationOrId, env = {}) {
  const integration = typeof integrationOrId === 'string'
    ? getIntegration(integrationOrId)
    : integrationOrId;
  if (!integration) {
    return {
      ok: false,
      connected: false,
      configured: false,
      reason: 'Integration is not registered.',
    };
  }

  const configured = requiredAllConfigured(integration, env) && requiredAnyConfigured(integration, env);
  const connected = false;
  const reason = configured
    ? 'Configuration evidence exists, but this registry does not probe or claim live connectivity.'
    : 'Missing required configuration or implementation remains scaffolded.';

  return {
    ok: true,
    id: integration.id,
    displayName: integration.displayName,
    surface: integration.surface,
    stage: integration.stage,
    connectionMode: integration.connectionMode,
    configured,
    connected,
    reason,
    entrypoints: integration.entrypoints,
    allowedInboundRoutes: integration.allowedInboundRoutes,
    allowedActions: integration.allowedActions,
    blockedActions: integration.blockedActions,
    dataClasses: integration.dataClasses,
    safetyNotes: integration.safetyNotes,
  };
}

export function listIntegrationStatuses(env = {}, filters = {}) {
  return listIntegrations(filters).map(integration => getIntegrationStatus(integration, env));
}

export function getIntegrationSummary(env = {}) {
  const statuses = listIntegrationStatuses(env);
  return {
    version: integrationsConfig.version,
    controlLoop: integrationsConfig.controlLoop,
    total: statuses.length,
    configured: statuses.filter(status => status.configured).map(status => status.id),
    connected: statuses.filter(status => status.connected).map(status => status.id),
    scaffolded: statuses.filter(status => ['scaffold', 'roadmap'].includes(status.stage)).map(status => status.id),
    safetyInvariant: 'The registry is descriptive and allowlist-oriented. It never claims live connectivity without an explicit probe implemented elsewhere.',
  };
}
