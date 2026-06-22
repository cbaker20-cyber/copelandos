import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations || [];

function hasEnvVar(env, key) {
  const value = env?.[key];
  return Boolean(value && String(value).trim().length > 0);
}

function requiredEnvConfigured(integration, env) {
  const required = integration.requiredEnvVars || [];
  return required.every((key) => hasEnvVar(env, key));
}

function configuredOptionalEnvVars(integration, env) {
  return (integration.optionalEnvVars || []).filter((key) => hasEnvVar(env, key));
}

function connectionStatus(integration, env = {}) {
  const requiredConfigured = requiredEnvConfigured(integration, env);
  const configuredOptional = configuredOptionalEnvVars(integration, env);
  const isExternal = ['external-provider', 'external-storage', 'mobile-client'].includes(integration.connectionKind);

  return {
    id: integration.id,
    displayName: integration.displayName,
    layer: integration.layer,
    implementationStatus: integration.implementationStatus,
    connectionKind: integration.connectionKind,
    configured: requiredConfigured,
    configuredOptionalEnvVars: configuredOptional,
    connected: false,
    status: requiredConfigured
      ? (isExternal ? 'configured-not-verified' : integration.implementationStatus)
      : 'missing-required-config',
    riskLevel: integration.riskLevel,
    entrypoints: integration.entrypoints || [],
    docs: integration.docs || [],
    note: integration.notes || null,
  };
}

export function listIntegrations({ layer, implementationStatus } = {}) {
  let integrations = INTEGRATIONS;
  if (layer) integrations = integrations.filter((item) => item.layer === layer);
  if (implementationStatus) {
    integrations = integrations.filter((item) => item.implementationStatus === implementationStatus);
  }
  return integrations.map((item) => structuredClone(item));
}

export function getIntegration(id) {
  const normalized = String(id || '').trim().toLowerCase();
  const integration = INTEGRATIONS.find((item) => item.id.toLowerCase() === normalized);
  return integration ? structuredClone(integration) : null;
}

export function listIntegrationStatuses(env = {}, filters = {}) {
  return listIntegrations(filters).map((integration) => connectionStatus(integration, env));
}

export function getIntegrationStatus(id, env = {}) {
  const integration = getIntegration(id);
  return integration ? connectionStatus(integration, env) : null;
}

export function getIntegrationFlow() {
  return [...(integrationsConfig.flow || [])];
}

export function getIntegrationSummary(env = {}) {
  const statuses = listIntegrationStatuses(env);
  const byLayer = {};
  for (const status of statuses) {
    byLayer[status.layer] = (byLayer[status.layer] || 0) + 1;
  }

  return {
    version: integrationsConfig.version,
    policy: integrationsConfig.policy,
    totalIntegrations: statuses.length,
    byLayer,
    implemented: statuses.filter((item) => item.implementationStatus === 'implemented').map((item) => item.id),
    scaffoldOnly: statuses.filter((item) => item.implementationStatus === 'scaffold-only').map((item) => item.id),
    connected: statuses.filter((item) => item.connected).map((item) => item.id),
    configured: statuses.filter((item) => item.configured).map((item) => item.id),
    honestStatus: 'External integrations are not reported connected without a live verification route.',
  };
}
