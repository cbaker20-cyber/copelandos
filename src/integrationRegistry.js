import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const CONTROL_LOOP = integrationsConfig.controlLoop;
const INTEGRATIONS = integrationsConfig.integrations;

function hasEnvValue(env, name) {
  const value = env?.[name];
  return Boolean(typeof value === 'string' ? value.trim() : value);
}

function envConfigured(requiredEnvVars, env) {
  return requiredEnvVars.every((name) => hasEnvValue(env, name));
}

function publicIntegration(integration, env) {
  const requiredEnvVars = integration.requiredEnvVars || [];
  const configured = envConfigured(requiredEnvVars, env);
  const internal = integration.kind === 'internal-module' || integration.kind === 'safety' || integration.kind === 'routing';

  return {
    id: integration.id,
    displayName: integration.displayName,
    kind: integration.kind,
    stage: integration.stage,
    surface: integration.surface || [],
    implementedEndpoints: integration.implementedEndpoints || [],
    safeActions: integration.safeActions || [],
    blockedActions: integration.blockedActions || [],
    configured,
    ready: internal || configured,
    connected: false,
    connectionStatus: configured
      ? 'configured-not-probed'
      : requiredEnvVars.length === 0
        ? 'no-env-required'
        : 'missing-required-env',
    missingEnvVars: requiredEnvVars.filter((name) => !hasEnvValue(env, name)),
    notes: integration.notes || null,
  };
}

export function listIntegrations(env = {}) {
  return INTEGRATIONS.map((integration) => publicIntegration(integration, env));
}

export function getIntegration(id, env = {}) {
  const integration = INTEGRATIONS.find((item) => item.id === id);
  return integration ? publicIntegration(integration, env) : null;
}

export function getControlLoop() {
  return CONTROL_LOOP.map((id, index) => {
    const integration = INTEGRATIONS.find((item) => item.id === id);
    return {
      order: index + 1,
      id,
      displayName: integration?.displayName || id,
      stage: integration?.stage || 'unknown',
    };
  });
}

export function getIntegrationSummary(env = {}) {
  const integrations = listIntegrations(env);
  const stages = {};
  for (const integration of integrations) {
    stages[integration.stage] = (stages[integration.stage] || 0) + 1;
  }

  return {
    version: integrationsConfig.version,
    architecture: integrationsConfig.architecture,
    policy: integrationsConfig.policy,
    totalIntegrations: integrations.length,
    stages,
    ready: integrations.filter((item) => item.ready).map((item) => item.id),
    configuredExternal: integrations
      .filter((item) => item.configured && item.connectionStatus === 'configured-not-probed')
      .map((item) => item.id),
    missingConfiguration: integrations
      .filter((item) => item.missingEnvVars.length > 0)
      .map((item) => ({ id: item.id, missingEnvVars: item.missingEnvVars })),
    honestStatus: 'External integrations are configuration-scaffolded only; this registry never performs live probes or reports connected=true.',
  };
}
