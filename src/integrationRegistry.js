import integrationsConfig from '../config/integrations.json' with { type: 'json' };

const INTEGRATIONS = integrationsConfig.integrations;
const PROVIDER_ENV_KEYS = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'GROQ_KEY',
  'CEREBRAS_API_KEY',
  'CEREBRAS_KEY',
  'GEMINI_API_KEY',
  'GEMINI_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_KEY',
  'OLLAMA_BASE_URL',
]);

function hasEnv(env, key) {
  return Boolean(env && env[key] && String(env[key]).trim().length > 0);
}

function hasAnyProviderConfig(env) {
  return [...PROVIDER_ENV_KEYS].some((key) => hasEnv(env, key));
}

function isConfigured(integration, env) {
  if (integration.status === 'active') return true;
  if (integration.id === 'provider-router') return hasAnyProviderConfig(env);
  if (!integration.requiredEnvVars || integration.requiredEnvVars.length === 0) return false;
  if (integration.status === 'scaffold-only') return false;
  return integration.requiredEnvVars.every((key) => hasEnv(env, key));
}

export function listIntegrationStatuses(env = {}) {
  return INTEGRATIONS.map((integration) => {
    const configured = isConfigured(integration, env);
    return {
      id: integration.id,
      displayName: integration.displayName,
      category: integration.category,
      status: integration.status,
      mode: integration.mode,
      configured,
      connected: false,
      entrypoints: integration.entrypoints,
      requiredEnvVars: integration.requiredEnvVars,
      allowedActions: integration.allowedActions,
      blockedActions: integration.blockedActions,
      safetyNotes: integration.safetyNotes,
      message: configured
        ? `${integration.displayName} has required configuration, but live connection checks are not performed here.`
        : `${integration.displayName} is ${integration.status}; no live connection is assumed.`,
    };
  });
}

export function getIntegrationStatus(id, env = {}) {
  return listIntegrationStatuses(env).find((integration) => integration.id === id) || null;
}

export function getIntegrationSummary(env = {}) {
  const integrations = listIntegrationStatuses(env);
  return {
    version: integrationsConfig.version,
    total: integrations.length,
    configured: integrations.filter((integration) => integration.configured).length,
    connected: integrations.filter((integration) => integration.connected).length,
    categories: integrations.reduce((counts, integration) => {
      counts[integration.category] = (counts[integration.category] || 0) + 1;
      return counts;
    }, {}),
    flow: integrationsConfig.flow,
    principles: integrationsConfig.principles,
  };
}
