import { routeAutomationTask } from './automationIntegrations.js';

const HIGH_RISK_KEYWORDS = /\b(send\s+email|send\s+it|merge\s+pr|deploy|delete|trash|run\s+shell|terminal|ssh|screen\s+control|auto\s*send|fire\s+webhook|bulk\s+move|bulk\s+delete)\b/i;
const EMAIL_KEYWORDS = /\b(email|gmail|reply|draft|message\s+to)\b/i;
const VAULT_KEYWORDS = /\b(obsidian|vault|note|remember|save\s+this|memory)\b/i;
const CODE_KEYWORDS = /\b(code|repo|github|cursor|bug|fix|test|ci|pull\s+request|pr|worker|javascript|python|api)\b/i;
const LEARNING_KEYWORDS = /\b(learn|teach|mimo|lesson|practice|quiz|explain\s+like|tutorial|study)\b/i;
const RESEARCH_KEYWORDS = /\b(research|look\s+up|sources|cite|web|current|latest)\b/i;
const AUTOMATION_KEYWORDS = /\b(automate|automation|ornith|n8n|zapier|make\.com|webhook|workflow|slack|calendar|drive|sheets|docs|slides|forms|tasks|contacts)\b/i;

const SAFE_ACTIONS = Object.freeze([
  'capture_idea',
  'create_plan',
  'create_cursor_prompt',
  'create_gmail_draft',
  'preview_vault_note',
  'write_safe_vault_note',
  'generate_learning_plan',
  'preview_automation_payload',
  'create_approval_checklist',
]);

const BLOCKED_ACTIONS = Object.freeze([
  'send_email',
  'merge_pr',
  'deploy',
  'delete_files',
  'arbitrary_shell',
  'screen_control',
  'fire_webhook_without_approval',
  'bulk_modify_without_approval',
  'mark_external_integration_connected_without_probe',
]);

export function routeHermesTask(input = {}, env = {}) {
  const task = String(input.task || input.text || '').trim();
  const source = String(input.source || 'copelandos');
  const urgency = String(input.urgency || 'medium');
  const project = String(input.project || inferProject(task));
  const signals = detectSignals(task);
  const risk = classifyRisk(task, signals);
  const route = chooseRoute(signals, risk);
  const automation = signals.automation ? routeAutomationTask(task, env) : null;
  const providerRecommendation = chooseProviderRecommendation(route, task, env, automation);

  return {
    ok: true,
    agent: 'hermes',
    mode: 'router-only',
    task,
    source,
    urgency,
    project,
    route,
    automation,
    risk,
    providerRecommendation,
    allowedActions: SAFE_ACTIONS,
    blockedActions: BLOCKED_ACTIONS,
    requiresHumanApproval: risk.level !== 'safe' || Boolean(automation),
    nextStep: automation?.nextStep || buildNextStep(route, risk),
    cursorPrompt: buildCursorPrompt({ task, route, risk, project, providerRecommendation, automation }),
    notes: [
      'Hermes routes and plans only; it does not execute tools directly.',
      'Mimo is treated as a learning/tutor surface, not a repo editor.',
      'Ornith and external automators are treated as unverified until explicitly configured and probed.',
      'Provider choice is best-available by task type and configured credentials, not hard-coded to one vendor.',
    ],
  };
}

function detectSignals(task) {
  return {
    highRisk: HIGH_RISK_KEYWORDS.test(task),
    email: EMAIL_KEYWORDS.test(task),
    vault: VAULT_KEYWORDS.test(task),
    code: CODE_KEYWORDS.test(task),
    learning: LEARNING_KEYWORDS.test(task),
    research: RESEARCH_KEYWORDS.test(task),
    automation: AUTOMATION_KEYWORDS.test(task),
  };
}

function classifyRisk(task, signals) {
  if (!task) return { level: 'safe', reason: 'Empty task can only produce a scaffolded plan.' };
  if (signals.highRisk) return { level: 'high', reason: 'Task mentions a write/destructive/automation action that needs explicit review.' };
  if (signals.automation || signals.email || signals.code || signals.vault) return { level: 'medium', reason: 'Task may create drafts, notes, code prompts, or automation payloads but must stay review-first.' };
  return { level: 'safe', reason: 'Task can be handled as planning, explanation, or inbox capture.' };
}

function chooseRoute(signals, risk) {
  if (signals.learning) return 'mimo_learning_plan';
  if (signals.automation) return 'automation_plan';
  if (signals.email) return 'gmail_draft';
  if (signals.vault) return 'obsidian_note';
  if (signals.code) return 'cursor_coding_prompt';
  if (signals.research) return 'research_plan';
  if (risk.level === 'high') return 'approval_required_plan';
  return 'chief_of_staff_plan';
}

function chooseProviderRecommendation(route, task, env, automation = null) {
  const hasLocal = Boolean(env.OLLAMA_BASE_URL);
  const hasOpenRouter = Boolean(env.OPENROUTER_KEY || env.OPENROUTER_API_KEY);
  const hasGroq = Boolean(env.GROQ_KEY || env.GROQ_API_KEY);
  const hasCerebras = Boolean(env.CEREBRAS_KEY || env.CEREBRAS_API_KEY);
  const hasGemini = Boolean(env.GEMINI_KEY || env.GEMINI_API_KEY);

  if (route === 'mimo_learning_plan') {
    return {
      primary: 'mimo-scaffold',
      fallback: hasLocal ? 'local-ollama' : 'copelandos-template',
      reason: 'Learning tasks should become guided lessons/quizzes, not autonomous repo edits.',
      connected: false,
    };
  }
  if (route === 'automation_plan') {
    return {
      primary: automation?.selected || 'automation-registry',
      fallback: hasLocal ? 'local-ollama' : hasGemini ? 'gemini' : 'copelandos-template',
      reason: 'Automation tasks should create reviewable payloads and approval checklists before any webhook/tool execution.',
      connected: Boolean(automation?.integration?.connected),
    };
  }
  if (route === 'cursor_coding_prompt') {
    return {
      primary: hasOpenRouter ? 'openrouter-code-model' : hasGemini ? 'gemini' : hasLocal ? 'local-ollama' : 'cursor-manual',
      fallback: hasGroq ? 'groq' : hasCerebras ? 'cerebras' : 'template',
      reason: 'Coding tasks should produce reviewable Cursor prompts and tests first.',
      connected: hasOpenRouter || hasGemini || hasLocal || hasGroq || hasCerebras,
    };
  }
  return {
    primary: hasLocal ? 'local-ollama' : hasGroq ? 'groq' : hasCerebras ? 'cerebras' : hasGemini ? 'gemini' : 'template',
    fallback: 'template',
    reason: 'General planning should prefer local/private routing when available, then configured free-tier providers.',
    connected: hasLocal || hasGroq || hasCerebras || hasGemini,
  };
}

function buildNextStep(route, risk) {
  if (risk.level === 'high') return 'Create a reviewable plan and ask for explicit confirmation before any write action.';
  const map = {
    mimo_learning_plan: 'Generate a Mimo-style lesson/practice plan with no file or repo writes.',
    automation_plan: 'Generate a reviewed automation payload/checklist; do not fire external tools automatically.',
    gmail_draft: 'Create a Gmail draft only; never send automatically.',
    obsidian_note: 'Preview or safely write a sanitized vault note.',
    cursor_coding_prompt: 'Generate a scoped Cursor prompt with tests and safety constraints.',
    research_plan: 'Draft a source-grounded research plan before web/tool use.',
    chief_of_staff_plan: 'Create a prioritized plan and capture it in the inbox.',
    approval_required_plan: 'Block execution and produce an approval checklist.',
  };
  return map[route] || map.chief_of_staff_plan;
}

function buildCursorPrompt({ task, route, risk, project, providerRecommendation, automation }) {
  return [
    `CopelandOS Hermes route: ${route}`,
    `Project: ${project}`,
    `Risk: ${risk.level} — ${risk.reason}`,
    `Provider recommendation: ${providerRecommendation.primary} with fallback ${providerRecommendation.fallback}`,
    automation ? `Automation target: ${automation.selected} (${automation.integration?.mode || 'unknown'})` : '',
    '',
    'Task:',
    task || '(empty task)',
    '',
    'Rules:',
    '- Do not send email, merge PRs, deploy, delete files, fire webhooks, or run arbitrary shell commands without explicit confirmation.',
    '- Produce drafts, notes, prompts, payload previews, or tests only unless Copeland explicitly confirms a specific write action.',
    '- Keep Mimo/learning workflows tutorial-only; no repo editing from Mimo.',
    '- Treat Ornith as unverified until official configuration and a probe endpoint exist.',
  ].filter(Boolean).join('\n');
}

function inferProject(task) {
  const lower = String(task || '').toLowerCase();
  if (lower.includes('score')) return 'score-scanner';
  if (lower.includes('band')) return 'band-council-agent';
  if (lower.includes('jazz')) return 'JazzBackend';
  if (lower.includes('connectome') || lower.includes('fly')) return 'connectome-perturbation';
  return 'copelandos';
}
