const CONNECTION_ENV = Object.freeze({
  mimo: ['MIMO_API_KEY', 'MIMO_BASE_URL'],
  ornith: ['ORNITH_API_KEY', 'ORNITH_BASE_URL'],
  n8n: ['N8N_WEBHOOK_URL', 'N8N_API_KEY'],
  make: ['MAKE_WEBHOOK_URL'],
  zapier: ['ZAPIER_WEBHOOK_URL'],
  github_actions: ['GITHUB_TOKEN', 'GITHUB_REPO'],
  google_workspace: ['GOOGLE_REFRESH_TOKEN', 'GMAIL_REFRESH_TOKEN'],
  slack: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'],
});

const AUTOMATION_INTEGRATIONS = Object.freeze([
  {
    id: 'mimo',
    name: 'Mimo',
    category: 'learning',
    mode: 'scaffolded',
    description: 'Turns tasks into guided lessons, quizzes, and practice steps. Does not edit repos or run tools.',
    safeActions: ['generate_learning_plan', 'generate_quiz', 'explain_code'],
    blockedActions: ['edit_repo', 'send_email', 'deploy', 'delete_files'],
    routeHints: ['mimo', 'lesson', 'learn', 'quiz', 'teach'],
  },
  {
    id: 'ornith',
    name: 'Ornith',
    category: 'automation',
    mode: 'placeholder',
    description: 'Reserved external automation surface. Treated as unverified until an official API/base URL is configured.',
    safeActions: ['create_plan', 'create_approval_checklist', 'create_webhook_payload_preview'],
    blockedActions: ['execute_webhook_without_approval', 'send_email', 'delete_files', 'deploy'],
    routeHints: ['ornith'],
  },
  {
    id: 'n8n',
    name: 'n8n',
    category: 'workflow-automation',
    mode: 'webhook-preview',
    description: 'Open workflow automation option for review-first webhook payloads.',
    safeActions: ['preview_webhook_payload', 'queue_manual_webhook'],
    blockedActions: ['fire_webhook_without_approval', 'bulk_modify_drive', 'bulk_email_send'],
    routeHints: ['n8n', 'workflow', 'webhook'],
  },
  {
    id: 'make',
    name: 'Make',
    category: 'workflow-automation',
    mode: 'webhook-preview',
    description: 'Visual automation platform target for reviewed webhook payloads.',
    safeActions: ['preview_webhook_payload'],
    blockedActions: ['fire_webhook_without_approval', 'unreviewed_bulk_action'],
    routeHints: ['make.com', 'make', 'scenario'],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'workflow-automation',
    mode: 'webhook-preview',
    description: 'No-code automation target for reviewed webhook payloads.',
    safeActions: ['preview_webhook_payload'],
    blockedActions: ['fire_webhook_without_approval', 'unreviewed_bulk_action'],
    routeHints: ['zapier', 'zap'],
  },
  {
    id: 'github_actions',
    name: 'GitHub Actions',
    category: 'developer-automation',
    mode: 'review-first',
    description: 'Runs CI and scheduled repo tasks only through reviewed workflow files and PRs.',
    safeActions: ['draft_workflow', 'inspect_ci', 'create_issue'],
    blockedActions: ['merge_pr_without_approval', 'deploy_without_approval', 'write_secret_to_repo'],
    routeHints: ['github actions', 'ci', 'workflow'],
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    category: 'school-productivity',
    mode: 'approval-required',
    description: 'Gmail, Calendar, Drive, Docs, Slides, Sheets, Forms, Tasks, and Contacts. Reads and drafts first; writes need approval.',
    safeActions: ['read_summary', 'create_draft', 'propose_calendar_event', 'propose_drive_reorg'],
    blockedActions: ['send_email_without_approval', 'delete_calendar_event_without_approval', 'bulk_drive_move_without_approval'],
    routeHints: ['gmail', 'calendar', 'drive', 'docs', 'slides', 'sheets', 'forms', 'tasks', 'contacts'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'team-automation',
    mode: 'draft-first',
    description: 'Band Council and team reminders, delegation summaries, and draft announcements.',
    safeActions: ['draft_message', 'summarize_channel', 'create_reminder_plan'],
    blockedActions: ['post_without_approval', 'dm_without_approval'],
    routeHints: ['slack', 'channel', 'delegation'],
  },
]);

export function listAutomationIntegrations(env = {}) {
  return AUTOMATION_INTEGRATIONS.map((integration) => ({
    ...integration,
    configured: getConnectionKeys(integration.id).some((key) => Boolean(env[key])),
    connected: false,
    requiredEnv: getConnectionKeys(integration.id),
    connectionStatus: 'not-probed',
  }));
}

export function getAutomationIntegration(id, env = {}) {
  return listAutomationIntegrations(env).find((integration) => integration.id === id) || null;
}

export function routeAutomationTask(task = '', env = {}) {
  const lower = String(task || '').toLowerCase();
  const integrations = listAutomationIntegrations(env);
  const matched = integrations.find((integration) => integration.routeHints.some((hint) => lower.includes(hint)));
  const selected = matched || integrations.find((integration) => integration.id === 'google_workspace');
  return {
    ok: true,
    selected: selected?.id || 'chief_of_staff',
    integration: selected || null,
    execute: false,
    requiresApproval: true,
    nextStep: selected
      ? `Create a reviewed ${selected.name} plan/payload. Do not execute until Copeland approves.`
      : 'Create a normal Chief of Staff plan.',
  };
}

function getConnectionKeys(id) {
  return CONNECTION_ENV[id] || [];
}
