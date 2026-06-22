import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;

function hasConfiguredEnv(env, name) {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function integrationStatus(integration, env) {
  const requiredEnvVars = integration.requiredEnvVars || [];
  const configuredEnvVars = requiredEnvVars.filter(name => hasConfiguredEnv(env, name));
  const missingEnvVars = requiredEnvVars.filter(name => !hasConfiguredEnv(env, name));
  const implemented = integration.stage === 'implemented';
  const configured = requiredEnvVars.length === 0 || missingEnvVars.length === 0;

  return {
    id: integration.id,
    displayName: integration.displayName,
    stage: integration.stage,
    surface: integration.surface,
    entrypoints: integration.entrypoints,
    allowedActions: integration.allowedActions,
    blockedActions: integration.blockedActions,
    configured,
    connected: false,
    status: configured && implemented ? 'available-local-scaffold' : integrationsConfig.safetyPolicy.defaultConnectionState,
    requiredEnvVars,
    configuredEnvVars,
    missingEnvVars,
    privacyNotes: integration.privacyNotes,
    nextStep: integration.nextStep,
  };
}

export function listIntegrations({ stage, surface } = {}, env = {}) {
  let integrations = INTEGRATIONS;
  if (stage) integrations = integrations.filter(integration => integration.stage === stage);
  if (surface) integrations = integrations.filter(integration => integration.surface === surface);
  return integrations.map(integration => integrationStatus(integration, env));
}

export function getIntegration(id, env = {}) {
  const integration = INTEGRATIONS.find(item => item.id === id);
  return integration ? integrationStatus(integration, env) : null;
}

export function getIntegrationSafetyPolicy() {
  return integrationsConfig.safetyPolicy;
}

export function getControlLoop() {
  return integrationsConfig.controlLoop;
}

export function getCommandCenterSummary(env = {}) {
  const integrations = listIntegrations({}, env);
  return {
    version: integrationsConfig.version,
    totalIntegrations: integrations.length,
    implemented: integrations.filter(item => item.stage === 'implemented').map(item => item.id),
    scaffolded: integrations.filter(item => item.stage === 'scaffolded').map(item => item.id),
    planned: integrations.filter(item => item.stage === 'planned').map(item => item.id),
    configured: integrations.filter(item => item.configured).map(item => item.id),
    connected: integrations.filter(item => item.connected).map(item => item.id),
    controlLoop: getControlLoop(),
    safetyPolicy: integrationsConfig.safetyPolicy,
    honestStatus: 'Integrations are never marked connected unless a live probe proves it.',
  };
}
