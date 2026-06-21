import providersConfig from '../config/providers.json' with { type: 'json' };

const PROVIDERS = providersConfig.providers;
const ROUTING_STRATEGY = providersConfig.routingStrategy;
const FAILOVER_POLICY = providersConfig.failoverPolicy;

function isProviderConfigured(provider, env) {
  const envKey = provider.envKey;
  const legacyKey = provider.legacyEnvKey;
  if (!env) return false;
  const value = env[envKey] || (legacyKey && env[legacyKey]) || '';
  return Boolean(value && String(value).trim().length > 0);
}

function providerStatus(provider, env) {
  const configured = isProviderConfigured(provider, env);
  const isLocal = provider.type === 'ollama';
  return {
    id: provider.id,
    displayName: provider.displayName,
    type: provider.type,
    configured,
    connected: false,
    status: configured ? (isLocal ? 'local-fallback' : 'configured') : 'not-connected',
    costTier: provider.costTier,
    speedTier: provider.speedTier,
    privacyTier: provider.privacyTier,
    offline: provider.offline || false,
    supportsToolCalling: provider.supportsToolCalling,
    supportsStructuredOutput: provider.supportsStructuredOutput,
    note: provider.notes || null,
  };
}

export function listProviderStatuses(env) {
  return PROVIDERS.map(p => providerStatus(p, env));
}

export function chooseProvider(taskProfile, env) {
  const taskType = taskProfile.taskType || 'reasoning';
  const route = ROUTING_STRATEGY[taskType] || ROUTING_STRATEGY.reasoning;

  for (const providerId of route) {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) continue;
    if (isProviderConfigured(provider, env)) {
      return {
        ok: true,
        provider: provider.id,
        displayName: provider.displayName,
        type: provider.type,
        modelAlias: provider.modelAlias,
        taskType,
        costTier: provider.costTier,
        reason: `Selected ${provider.displayName} as first configured provider for ${taskType}.`,
      };
    }
  }

  // No provider configured
  return {
    ok: false,
    provider: null,
    taskType,
    error: 'No provider configured for this task type.',
    localFallback: getLocalFallback(taskProfile, env),
    noSubscriptionRoute: getNoSubscriptionRoute(taskProfile, env),
    message: 'Configure at least one provider key to enable AI routing.',
  };
}

export function chooseFallbacks(taskProfile, env) {
  const taskType = taskProfile.taskType || 'reasoning';
  const route = ROUTING_STRATEGY[taskType] || ROUTING_STRATEGY.reasoning;
  const configured = [];
  const unconfigured = [];

  for (const providerId of route) {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) continue;
    const status = providerStatus(provider, env);
    if (status.configured) {
      configured.push({ id: provider.id, displayName: provider.displayName, costTier: provider.costTier });
    } else {
      unconfigured.push({ id: provider.id, displayName: provider.displayName, costTier: provider.costTier });
    }
  }

  return {
    taskType,
    primary: configured[0] || null,
    fallbacks: configured.slice(1),
    unconfigured,
    maxRetries: FAILOVER_POLICY.maxRetries,
  };
}

export function chooseCouncilProviders(taskProfile, env) {
  const councilRoute = ROUTING_STRATEGY.council || [];
  const providers = councilRoute
    .map(id => PROVIDERS.find(p => p.id === id))
    .filter(Boolean)
    .map(p => ({ ...providerStatus(p, env), id: p.id }));

  const configured = providers.filter(p => p.configured);
  if (configured.length === 0) {
    return {
      ok: false,
      configured: false,
      providers: [],
      message: 'No council providers configured. Council mode requires at least one AI provider.',
      localFallback: getLocalFallback(taskProfile, env),
    };
  }

  return {
    ok: true,
    configured: true,
    providers: configured,
    councilSize: configured.length,
    message: `${configured.length} provider(s) available for council mode.`,
  };
}

export function explainRoutingDecision(taskProfile, env) {
  const primary = chooseProvider(taskProfile, env);
  const fallbacks = chooseFallbacks(taskProfile, env);
  const statuses = listProviderStatuses(env);

  return {
    taskType: taskProfile.taskType || 'reasoning',
    decision: primary.ok ? 'provider-selected' : 'no-provider-configured',
    selected: primary.ok ? { id: primary.provider, displayName: primary.displayName } : null,
    reason: primary.reason || primary.message || 'No provider selected.',
    fallbackChain: fallbacks.fallbacks.map(f => f.id),
    configuredProviders: statuses.filter(s => s.configured).map(s => s.id),
    unconfiguredProviders: statuses.filter(s => !s.configured).map(s => s.id),
    localFallback: getLocalFallback(taskProfile, env),
    honestStatus: 'Only providers with confirmed env vars are shown as configured.',
  };
}

export function getLocalFallback(taskProfile, env) {
  const ollama = PROVIDERS.find(p => p.type === 'ollama');
  if (!ollama) return null;
  const configured = isProviderConfigured(ollama, env);
  return {
    id: 'ollama',
    displayName: 'Ollama (local)',
    configured,
    status: configured ? 'local-fallback' : 'not-running',
    message: configured
      ? 'Ollama is configured. Start the local Ollama server to use it.'
      : 'Ollama is not configured. Set OLLAMA_BASE_URL to enable local model fallback.',
    offline: true,
    privacyTier: 'local',
    costTier: 'free',
  };
}

export function getNoSubscriptionRoute(taskProfile, env) {
  const freeProviders = PROVIDERS.filter(p =>
    ['free', 'free-tier'].includes(p.costTier) && p.type !== 'ollama'
  );
  const configured = freeProviders.filter(p => isProviderConfigured(p, env));

  return {
    available: configured.length > 0,
    providers: configured.map(p => ({
      id: p.id,
      displayName: p.displayName,
      costTier: p.costTier,
    })),
    message: configured.length > 0
      ? `${configured.length} free-tier provider(s) available without a paid subscription.`
      : 'No free-tier providers configured. Register API keys for Groq, Cerebras, Gemini, or OpenRouter to use without a paid plan.',
    localFallback: 'Ollama is always available for free if running locally.',
  };
}
