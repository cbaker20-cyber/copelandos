const TASK_TYPES = new Set([
  'fast',
  'reasoning',
  'coding',
  'summarization',
  'research',
  'planning',
  'music',
  'security_review',
  'local_fallback',
]);

export function normalizeTaskType(taskType) {
  const normalized = String(taskType || 'reasoning').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TASK_TYPES.has(normalized) ? normalized : 'reasoning';
}

function envValue(env, name) {
  const value = name ? env?.[name] : undefined;
  return typeof value === 'string' ? value.trim() : value;
}

export function providerStatus(provider, env, config) {
  const providerConfig = config.providers?.[provider];
  if (!providerConfig) return { provider, configured: false, reason: 'unknown_provider' };

  if (provider === 'ollama') {
    const baseUrl = envValue(env, providerConfig.baseUrlEnv);
    return {
      provider,
      configured: Boolean(baseUrl),
      local: true,
      model: envValue(env, providerConfig.modelEnv) || providerConfig.defaultModel,
      reason: baseUrl ? 'configured' : 'missing_base_url',
    };
  }

  const configured = Boolean(
    envValue(env, providerConfig.keyEnv) || envValue(env, providerConfig.legacyKeyEnv),
  );
  return {
    provider,
    configured,
    local: false,
    model: envValue(env, providerConfig.modelEnv) || providerConfig.defaultModel,
    reason: configured ? 'configured' : 'missing_key',
  };
}

export function listProviderStatuses(env, config) {
  return Object.keys(config.providers || {}).map((provider) => providerStatus(provider, env, config));
}

export function routeModel(taskType, env, config) {
  const normalizedTask = normalizeTaskType(taskType);
  const candidates = config.routes?.[normalizedTask] || [];
  const statuses = candidates.map((provider) => providerStatus(provider, env, config));
  const selected = statuses.find((status) => status.configured);

  if (!selected) {
    return {
      ok: false,
      taskType: normalizedTask,
      provider: null,
      model: null,
      error: `No configured provider is available for task type '${normalizedTask}'.`,
      tried: statuses.map(({ provider, reason }) => ({ provider, reason })),
    };
  }

  return {
    ok: true,
    taskType: normalizedTask,
    provider: selected.provider,
    model: selected.model,
    local: selected.local,
    reason: `Selected the first configured provider in the '${normalizedTask}' route.`,
  };
}

export function getProviderCredential(env, provider, config) {
  const providerConfig = config.providers?.[provider];
  if (!providerConfig || provider === 'ollama') return null;
  return envValue(env, providerConfig.keyEnv) || envValue(env, providerConfig.legacyKeyEnv) || null;
}
