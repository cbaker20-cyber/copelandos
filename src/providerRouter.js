import providersConfig from '../config/providers.json' with { type: 'json' };

const ALL_PROVIDERS = providersConfig.providers;
const ROUTING_STRATEGY = providersConfig.routingStrategy;

/**
 * Check whether a provider's required env var is set in the given env object.
 */
function isProviderConfigured(provider, env) {
  if (!env) return false;
  const primary = env[provider.envVar];
  const alt = provider.altEnvVar ? env[provider.altEnvVar] : null;
  return Boolean(primary || alt);
}

/**
 * Get the active credential key for a provider from env.
 */
function getProviderKey(provider, env) {
  if (!env) return null;
  return env[provider.envVar] || (provider.altEnvVar ? env[provider.altEnvVar] : null) || null;
}

/**
 * Map a task profile to a preference list of provider IDs.
 */
function preferenceListForTask(taskProfile) {
  const type = (taskProfile?.taskType || '').toLowerCase();
  const skill = (taskProfile?.skill || '').toLowerCase();
  const privacy = taskProfile?.requiresPrivacy === true;

  if (privacy) return ROUTING_STRATEGY.privacyPreference;
  if (type === 'coding' || skill === 'coding' || skill === 'code') return ROUTING_STRATEGY.codingPreference;
  if (type === 'research' || skill === 'research-notes') return ROUTING_STRATEGY.researchPreference;
  if (type === 'council') return ROUTING_STRATEGY.councilPreference;
  return ROUTING_STRATEGY.defaultPreference;
}

/**
 * Choose the best available provider for a task profile.
 * Never claims a provider is connected unless the env var exists.
 *
 * @param {object} taskProfile - { taskType, skill, requiresToolCalling, requiresPrivacy }
 * @param {object} env - environment variables
 * @returns {{ ok: boolean, provider: string|null, model: string|null, explanation: string, tried: string[] }}
 */
export function chooseProvider(taskProfile, env) {
  const preference = preferenceListForTask(taskProfile);
  const tried = [];

  for (const id of preference) {
    const provider = ALL_PROVIDERS.find((p) => p.id === id);
    if (!provider) continue;
    tried.push(id);

    if (taskProfile?.requiresToolCalling && !provider.supportsToolCalling) continue;
    if (!isProviderConfigured(provider, env)) continue;

    return {
      ok: true,
      provider: provider.id,
      model: provider.modelAlias,
      displayName: provider.displayName,
      explanation: `Selected ${provider.displayName} (${provider.costTier}) for ${taskProfile?.taskType || 'general'} task.`,
      tried,
    };
  }

  return {
    ok: false,
    provider: null,
    model: null,
    explanation: 'No configured provider found for this task. See local fallback.',
    tried,
    localFallback: getLocalFallback(taskProfile, env),
    noSubscriptionRoute: getNoSubscriptionRoute(taskProfile),
  };
}

/**
 * Choose a fallback chain for a given task profile.
 */
export function chooseFallbacks(taskProfile, env) {
  const preference = preferenceListForTask(taskProfile);
  const fallbacks = [];

  for (const id of preference) {
    const provider = ALL_PROVIDERS.find((p) => p.id === id);
    if (!provider) continue;
    if (isProviderConfigured(provider, env)) {
      fallbacks.push({ provider: provider.id, model: provider.modelAlias, displayName: provider.displayName, configured: true });
    } else {
      fallbacks.push({ provider: provider.id, model: provider.modelAlias, displayName: provider.displayName, configured: false, status: 'not connected / env var not set' });
    }
  }

  return fallbacks;
}

/**
 * Choose providers suitable for council mode (multi-model synthesis).
 */
export function chooseCouncilProviders(taskProfile, env) {
  const councilIds = ROUTING_STRATEGY.councilPreference;
  const available = [];
  const unavailable = [];

  for (const id of councilIds) {
    const provider = ALL_PROVIDERS.find((p) => p.id === id);
    if (!provider) continue;
    if (isProviderConfigured(provider, env)) {
      available.push({ provider: provider.id, model: provider.modelAlias, displayName: provider.displayName });
    } else {
      unavailable.push({ provider: provider.id, displayName: provider.displayName, status: 'not connected' });
    }
  }

  return {
    available,
    unavailable,
    councilPossible: available.length >= 2,
    message: available.length >= 2
      ? `Council mode available with ${available.length} providers.`
      : available.length === 1
        ? 'Only one council provider configured; using single-provider mode.'
        : 'No council providers configured. Add OPENROUTER_API_KEY or GROQ_API_KEY.',
  };
}

/**
 * Explain the routing decision for a task profile in human-readable form.
 */
export function explainRoutingDecision(taskProfile, env) {
  const choice = chooseProvider(taskProfile, env);
  const fallbacks = chooseFallbacks(taskProfile, env);
  const councilInfo = chooseCouncilProviders(taskProfile, env);

  return {
    task: taskProfile,
    selected: choice,
    fallbackChain: fallbacks,
    council: councilInfo,
    strategy: `Preference order for ${taskProfile?.taskType || 'general'}: ${preferenceListForTask(taskProfile).join(' → ')}`,
  };
}

/**
 * Get the local fallback option (Ollama), regardless of whether it's running.
 */
export function getLocalFallback(taskProfile, env) {
  const ollama = ALL_PROVIDERS.find((p) => p.id === 'ollama');
  if (!ollama) return null;
  const configured = isProviderConfigured(ollama, env);
  return {
    provider: 'ollama',
    model: ollama.modelAlias,
    displayName: ollama.displayName,
    configured,
    offline: true,
    status: configured ? 'configured (OLLAMA_BASE_URL set)' : 'not configured — set OLLAMA_BASE_URL to enable',
    instructions: 'Install Ollama locally: https://ollama.ai — then set OLLAMA_BASE_URL in your environment.',
  };
}

/**
 * Get a routing option that avoids paid subscriptions.
 */
export function getNoSubscriptionRoute(taskProfile) {
  const freeProviders = ALL_PROVIDERS.filter((p) => p.freeOption);
  return {
    available: freeProviders.map((p) => ({
      provider: p.id,
      model: p.modelAlias,
      displayName: p.displayName,
      envVar: p.envVar,
      status: 'free tier — set env var to enable',
    })),
    message: 'Free-tier providers: Groq, Cerebras, OpenRouter, Gemini, Ollama (local). No paid subscription required.',
  };
}

/**
 * List all provider statuses for the dashboard.
 */
export function listAllProviderStatuses(env) {
  return ALL_PROVIDERS.map((p) => ({
    provider: p.id,
    displayName: p.displayName,
    configured: isProviderConfigured(p, env),
    costTier: p.costTier,
    offlineLocal: p.offlineLocal,
    freeOption: p.freeOption,
    taskStrengths: p.taskStrengths,
  }));
}
