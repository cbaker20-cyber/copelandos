export const RISK = Object.freeze({
  SAFE: 'SAFE',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

const ACTION_RISKS = new Map([
  ['read_status', RISK.SAFE],
  ['repo_statuses', RISK.SAFE],
  ['summarize', RISK.SAFE],
  ['search', RISK.SAFE],
  ['draft_text', RISK.SAFE],
  ['write_vault_note', RISK.SAFE],
  ['generate_plan', RISK.SAFE],
  ['open_url', RISK.SAFE],
  ['open_obsidian_uri', RISK.SAFE],
  ['create_github_issue', RISK.MEDIUM],
  ['create_gmail_draft', RISK.MEDIUM],
  ['create_task', RISK.MEDIUM],
  ['update_project_status', RISK.MEDIUM],
  ['run_approved_test', RISK.MEDIUM],
  ['start_cursor', RISK.MEDIUM],
  ['start_vscode_tunnel', RISK.MEDIUM],
  ['open_project_folder', RISK.MEDIUM],
  ['write_local_vault_note', RISK.MEDIUM],
  ['send_email', RISK.HIGH],
  ['merge_pr', RISK.HIGH],
  ['delete_file', RISK.HIGH],
  ['deploy', RISK.HIGH],
  ['install_package', RISK.HIGH],
  ['arbitrary_shell', RISK.HIGH],
  ['change_secrets', RISK.HIGH],
  ['publish_public_content', RISK.HIGH],
  ['access_private_student_data', RISK.HIGH],
  ['control_screen', RISK.HIGH],
  ['control_mouse', RISK.HIGH],
  ['control_keyboard', RISK.HIGH],
  ['take_screenshot', RISK.HIGH],
]);

export function normalizeAction(action) {
  return String(action || '')
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function classifyRisk(action) {
  const normalized = normalizeAction(action);
  return ACTION_RISKS.get(normalized) || RISK.HIGH;
}

export function evaluatePermission(action, { confirmed = false } = {}) {
  const normalized = normalizeAction(action);
  const risk = classifyRisk(normalized);

  if (risk === RISK.HIGH) {
    return {
      ok: false,
      allowed: false,
      confirmation_required: true,
      risk,
      action: normalized,
      message: 'Human confirmation required. High-risk actions are never executed automatically.',
    };
  }

  if (risk === RISK.MEDIUM && !confirmed) {
    return {
      ok: false,
      allowed: false,
      confirmation_required: true,
      risk,
      action: normalized,
      message: 'Explicit confirmation is required for this action.',
    };
  }

  return {
    ok: true,
    allowed: true,
    confirmation_required: false,
    risk,
    action: normalized,
    logged: risk === RISK.MEDIUM,
    message: risk === RISK.SAFE ? 'Safe action allowed.' : 'Confirmed medium-risk action allowed.',
  };
}

export function listPermissionRules() {
  return [...ACTION_RISKS.entries()].map(([action, risk]) => ({ action, risk }));
}
