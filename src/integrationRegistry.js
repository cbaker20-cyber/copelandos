import integrationsConfig from '../config/integrations.json' with { type: 'json' };

function hasConfiguredEnv(env, names = []) {
  return names.every((name) => {
    const value = env?.[name];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });
}

function publicIntegration(integration, env = {}) {
  const configured = hasConfiguredEnv(env, integration.requiredEnvVars);
  const internal = integration.status === 'internal';
  const scaffold = integration.status === 'scaffold';

  return {
    ...integration,
    configured: internal || configured,
    connected: internal,
    runtimeStatus: internal
      ? 'available-in-worker'
      : configured
        ? 'configured-not-probed'
        : scaffold
          ? 'scaffold-only'
          : 'not-configured',
    honestStatus: internal
      ? 'Internal Worker module is present.'
      : configured
        ? 'Required configuration is present, but this route does not perform a live probe.'
        : 'No live connection is claimed.',
  };
}

export function listIntegrations(env = {}) {
  return integrationsConfig.integrations.map((integration) => publicIntegration(integration, env));
}

export function getIntegration(id, env = {}) {
  const integration = integrationsConfig.integrations.find((item) => item.id === id);
  return integration ? publicIntegration(integration, env) : null;
}

export function getIntegrationSummary(env = {}) {
  const integrations = listIntegrations(env);
  return {
    version: integrationsConfig.version,
    policy: integrationsConfig.policy,
    total: integrations.length,
    connected: integrations.filter((item) => item.connected).length,
    configuredNotProbed: integrations.filter((item) => item.runtimeStatus === 'configured-not-probed').map((item) => item.id),
    scaffolded: integrations.filter((item) => item.runtimeStatus === 'scaffold-only').map((item) => item.id),
    notConfigured: integrations.filter((item) => item.runtimeStatus === 'not-configured').map((item) => item.id),
  };
}

export function getControlLoop(env = {}) {
  const byId = new Map(listIntegrations(env).map((integration) => [integration.id, integration]));
  return integrationsConfig.controlLoop.map((id, index) => {
    const integration = byId.get(id);
    return {
      order: index + 1,
      id,
      displayName: integration?.displayName || id,
      layer: integration?.layer || 'unknown',
      runtimeStatus: integration?.runtimeStatus || 'unknown',
      connected: Boolean(integration?.connected),
      next: integrationsConfig.controlLoop[index + 1] || null,
    };
  });
}
