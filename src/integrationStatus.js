import { listProviderStatuses } from './providerRouter.js';

export const INTEGRATION_STATUSES = Object.freeze([
  'ready',
  'configured',
  'not_configured',
  'unavailable',
  'mock_mode',
  'needs_user_action',
  'unsafe_disabled',
]);

export const INTEGRATION_IDS = Object.freeze([
  'github',
  'gmail',
  'google_calendar',
  'obsidian_vault',
  'local_agent',
  'openclaw_worker',
  'free_provider_pool',
  'cloudflare_worker',
  'ai_provider_router',
]);

const FREEBUFF_PLACEHOLDER = Object.freeze({
  id: 'freebuff',
  displayName: 'FreeBuff',
  status: 'not_configured',
  note: 'Placeholder provider family. Exact link and setup details are pending.',
});

const FREE_PROVIDER_IDS = Object.freeze(['groq', 'cerebras', 'gemini-flash', 'openrouter-free', 'ollama']);

function hasEnv(env, ...keys) {
  return keys.some((key) => {
    const value = env?.[key];
    return Boolean(value && String(value).trim().length > 0);
  });
}

function integrationEntry(status, detail = {}) {
  if (!INTEGRATION_STATUSES.includes(status)) {
    throw new Error(`Invalid integration status: ${status}`);
  }
  return {
    status,
    ...detail,
  };
}

function resolveGithubStatus(env) {
  if (!hasEnv(env, 'GITHUB_TOKEN')) {
    return integrationEntry('not_configured', {
      label: 'GitHub supervisor',
      note: 'Set GITHUB_TOKEN for read-only supervision. Live PR queries are not enabled in this foundation route.',
    });
  }
  return integrationEntry('configured', {
    label: 'GitHub supervisor',
    note: 'Token present. Live repository and PR summaries are not queried by default.',
  });
}

function resolveGmailStatus(env) {
  const hasRefresh = hasEnv(env, 'GMAIL_REFRESH_TOKEN');
  const hasClient = hasEnv(env, 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET');
  if (hasRefresh && hasClient) {
    return integrationEntry('configured', {
      label: 'Gmail',
      mode: 'draft-only',
      note: 'OAuth credentials present. Sending email remains blocked.',
    });
  }
  if (hasClient && !hasRefresh) {
    return integrationEntry('needs_user_action', {
      label: 'Gmail',
      mode: 'draft-only',
      note: 'OAuth client configured. Complete enrollment at /api/auth/gmail and store GMAIL_REFRESH_TOKEN as a secret.',
    });
  }
  return integrationEntry('not_configured', {
    label: 'Gmail',
    mode: 'draft-only',
    note: 'Gmail draft assistant is not configured.',
  });
}

function resolveGoogleCalendarStatus(env) {
  if (hasEnv(env, 'GOOGLE_CALENDAR_REFRESH_TOKEN', 'CALENDAR_REFRESH_TOKEN')) {
    return integrationEntry('configured', {
      label: 'Google Calendar',
      note: 'Calendar credentials detected. Calendar routes are not implemented in this foundation PR.',
    });
  }
  return integrationEntry('not_configured', {
    label: 'Google Calendar',
    note: 'No calendar connector is configured.',
  });
}

function resolveObsidianVaultStatus(env) {
  if (hasEnv(env, 'GITHUB_TOKEN', 'GITHUB_REPO')) {
    return integrationEntry('configured', {
      label: 'Obsidian vault',
      mode: 'github',
      note: 'Private GitHub vault target is configured.',
    });
  }
  return integrationEntry('mock_mode', {
    label: 'Obsidian vault',
    mode: 'preview',
    note: 'Vault writes return a safe preview until GITHUB_TOKEN and GITHUB_REPO are configured.',
  });
}

function resolveLocalAgentStatus(env) {
  const hasUrl = hasEnv(env, 'LOCAL_AGENT_URL');
  const hasToken = hasEnv(env, 'LOCAL_AGENT_TOKEN');
  if (hasUrl && hasToken) {
    return integrationEntry('configured', {
      label: 'Local agent',
      note: 'Worker knows a local-agent URL and token. No live probe is performed by default.',
    });
  }
  if (hasUrl && !hasToken) {
    return integrationEntry('needs_user_action', {
      label: 'Local agent',
      note: 'LOCAL_AGENT_URL is set but LOCAL_AGENT_TOKEN is missing.',
    });
  }
  return integrationEntry('not_configured', {
    label: 'Local agent',
    note: 'Optional localhost bridge is not configured.',
  });
}

function resolveOpenClawWorkerStatus(env) {
  const hasUrl = hasEnv(env, 'OPENCLAW_WORKER_URL', 'OPENCLAW_BASE_URL');
  const hasToken = hasEnv(env, 'OPENCLAW_TOKEN', 'OPENCLAW_WORKER_TOKEN');
  if (hasUrl && hasToken) {
    return integrationEntry('configured', {
      label: 'OpenClaw worker',
      note: 'OpenClaw endpoint and token are configured. CopelandOS treats OpenClaw as an optional scoped worker, not root brain.',
    });
  }
  if (hasUrl && !hasToken) {
    return integrationEntry('needs_user_action', {
      label: 'OpenClaw worker',
      note: 'OpenClaw URL is set but worker token is missing.',
    });
  }
  return integrationEntry('not_configured', {
    label: 'OpenClaw worker',
    note: 'Optional OpenClaw execution worker is not configured.',
  });
}

function resolveFreeProviderPoolStatus(env) {
  const statuses = listProviderStatuses(env || {});
  const freeProviders = statuses.filter((provider) => FREE_PROVIDER_IDS.includes(provider.id));
  const configured = freeProviders.filter((provider) => provider.configured);
  const freebuff = { ...FREEBUFF_PLACEHOLDER };

  if (configured.length === 0) {
    return integrationEntry('not_configured', {
      label: 'Free provider pool',
      configuredCount: 0,
      totalFreeProviders: freeProviders.length,
      providers: freeProviders.map((provider) => ({
        id: provider.id,
        status: provider.configured ? 'configured' : 'not_configured',
      })),
      freebuff,
      note: 'No free-tier provider keys are configured. Register Groq, Cerebras, Gemini, OpenRouter, or Ollama locally.',
    });
  }

  if (configured.length < freeProviders.length) {
    return integrationEntry('configured', {
      label: 'Free provider pool',
      configuredCount: configured.length,
      totalFreeProviders: freeProviders.length,
      partial: true,
      providers: freeProviders.map((provider) => ({
        id: provider.id,
        status: provider.configured ? 'configured' : 'not_configured',
      })),
      freebuff,
      note: `${configured.length} of ${freeProviders.length} free providers configured. FreeBuff remains a placeholder pending exact provider details.`,
    });
  }

  return integrationEntry('ready', {
    label: 'Free provider pool',
    configuredCount: configured.length,
    totalFreeProviders: freeProviders.length,
    providers: freeProviders.map((provider) => ({
      id: provider.id,
      status: 'configured',
    })),
    freebuff,
    note: 'All known free providers in the pool are configured. FreeBuff remains a placeholder pending exact provider details.',
  });
}

function resolveCloudflareWorkerStatus() {
  return integrationEntry('ready', {
    label: 'Cloudflare Worker',
    note: 'Canonical backend route layer is online.',
  });
}

function resolveAiProviderRouterStatus(env) {
  const statuses = listProviderStatuses(env || {});
  const configured = statuses.filter((provider) => provider.configured);
  if (configured.length === 0) {
    return integrationEntry('mock_mode', {
      label: 'AI provider router',
      configuredProviders: [],
      note: 'Provider routing is available but no provider keys are configured.',
    });
  }
  return integrationEntry('configured', {
    label: 'AI provider router',
    configuredProviders: configured.map((provider) => provider.id),
    note: `${configured.length} provider(s) configured for task-based routing.`,
  });
}

export function buildIntegrationStatuses(env = {}) {
  return {
    github: resolveGithubStatus(env),
    gmail: resolveGmailStatus(env),
    google_calendar: resolveGoogleCalendarStatus(env),
    obsidian_vault: resolveObsidianVaultStatus(env),
    local_agent: resolveLocalAgentStatus(env),
    openclaw_worker: resolveOpenClawWorkerStatus(env),
    free_provider_pool: resolveFreeProviderPoolStatus(env),
    cloudflare_worker: resolveCloudflareWorkerStatus(env),
    ai_provider_router: resolveAiProviderRouterStatus(env),
  };
}

function collectMissingSetup(integrations) {
  return Object.entries(integrations)
    .filter(([, value]) => ['not_configured', 'needs_user_action', 'mock_mode'].includes(value.status))
    .map(([id, value]) => ({
      id,
      status: value.status,
      note: value.note || null,
    }));
}

function collectWarnings(integrations) {
  const warnings = [];
  if (integrations.openclaw_worker.status === 'not_configured') {
    warnings.push('OpenClaw worker is not configured. Optional local execution remains unavailable.');
  }
  if (integrations.free_provider_pool.status === 'not_configured') {
    warnings.push('Free provider pool has no configured providers. AI routing will return explicit errors.');
  }
  if (integrations.free_provider_pool.freebuff?.status === 'not_configured') {
    warnings.push('FreeBuff is a placeholder only. Do not treat it as an available provider.');
  }
  if (integrations.github.status === 'configured') {
    warnings.push('GitHub token is present but live supervision queries are not enabled in this foundation route.');
  }
  if (integrations.gmail.status === 'needs_user_action') {
    warnings.push('Gmail OAuth client is configured but refresh token enrollment is incomplete.');
  }
  return warnings;
}

export function buildTruthDashboardStatus(env = {}, options = {}) {
  const integrations = buildIntegrationStatuses(env);
  const environmentMode = options.environmentMode
    || (env?.ENVIRONMENT_MODE || env?.NODE_ENV || 'foundation');

  return {
    ok: true,
    app: 'CopelandOS',
    version: options.version || 'foundation',
    environment_mode: environmentMode,
    safety_mode: true,
    integrations,
    warnings: collectWarnings(integrations),
    missing_setup: collectMissingSetup(integrations),
  };
}

export function isAllowedIntegrationStatus(status) {
  return INTEGRATION_STATUSES.includes(status);
}

export function assertNoSecretsInStatus(payload) {
  const serialized = JSON.stringify(payload);
  const secretPatterns = [
    /sk-[A-Za-z0-9]{8,}/,
    /ghp_[A-Za-z0-9]{8,}/,
    /["']refresh-secret-token["']/,
    /["']openclaw-secret-token["']/,
    /["']local-agent-secret-token["']/,
    /["']test-key["']/,
    /API_KEY["']?\s*:\s*["'][^"']{8,}/i,
  ];
  return !secretPatterns.some((pattern) => pattern.test(serialized));
}
