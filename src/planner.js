import planningRolesConfig from '../config/planning-roles.json' with { type: 'json' };
import projectRegistry from '../config/projects.json' with { type: 'json' };
import { classifyIdea } from './ideaClassifier.js';
import { getSkill } from './skills.js';

const ROLES = planningRolesConfig.roles;

const COUNCIL_COMPLEXITY_THRESHOLD = 3;

const COMPLEXITY_KEYWORDS = [
  'architecture', 'redesign', 'migrate', 'security', 'deploy',
  'publish', 'merge', 'multi-step', 'council', 'review all',
  'investigate', 'unknown', 'tricky', 'risky', 'multiple',
];

function scoreComplexity(text) {
  const lower = (text || '').toLowerCase();
  let score = 0;
  for (const kw of COMPLEXITY_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  if (text.length > 300) score += 1;
  return score;
}

/**
 * Classify a task string. Returns classification metadata.
 */
export function classifyTask(input) {
  return classifyIdea(String(input || ''));
}

/**
 * Choose the best skill for a task description.
 */
export function chooseSkill(task) {
  const classification = classifyTask(task);
  if (!classification.skill) return null;
  return getSkill(classification.skill);
}

/**
 * Decide whether to use council mode for a task.
 * Simple tasks skip council; complex or high-risk tasks use it.
 */
export function chooseCouncilMode(task, classification) {
  const clf = classification || classifyTask(task);
  if (clf.riskLevel === 'high') return { useCouncil: true, reason: 'High-risk task requires council review' };
  const complexity = scoreComplexity(task);
  if (complexity >= COUNCIL_COMPLEXITY_THRESHOLD) {
    return { useCouncil: true, reason: `Complex task (score ${complexity}) benefits from council review` };
  }
  return { useCouncil: false, reason: 'Task is straightforward; single-agent mode is sufficient' };
}

/**
 * Select which roles should participate for a given task profile.
 */
function selectRoles(task, classification) {
  const text = (task || '').toLowerCase();
  const risk = (classification?.riskLevel || 'safe').toLowerCase();
  const skill = (classification?.skill || '').toLowerCase();
  const { useCouncil } = chooseCouncilMode(task, classification);

  const selected = [];

  for (const role of ROLES) {
    if (role.alwaysIncluded) { selected.push(role.id); continue; }
    if (role.alwaysForCouncil && useCouncil) { selected.push(role.id); continue; }
    if (role.alwaysForRisk && role.alwaysForRisk.includes(risk)) { selected.push(role.id); continue; }
    const triggers = role.triggers || [];
    if (triggers.some((t) => text.includes(t) || skill.includes(t))) {
      selected.push(role.id);
    }
  }

  return [...new Set(selected)];
}

/**
 * Build a full plan for a task.
 */
export function createPlan(task) {
  const classification = classifyTask(task);
  const skill = getSkill(classification.skill);
  const councilMode = chooseCouncilMode(task, classification);
  const roles = selectRoles(task, classification);

  return {
    task,
    classification,
    skill: skill ? { id: skill.id, displayName: skill.displayName } : null,
    councilMode,
    roles,
    planVersion: 'v1',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a concise task brief for a human or AI to act on.
 */
export function createTaskBrief(task, plan) {
  const p = plan || createPlan(task);
  return {
    summary: `Task: ${task.slice(0, 120)}`,
    skill: p.skill?.displayName || 'Unknown',
    risk: p.classification.riskLevel,
    requiresConfirmation: p.classification.confirmationRequired,
    suggestedAction: p.classification.suggestedAction,
    councilNeeded: p.councilMode.useCouncil,
    rolesInvolved: p.roles,
    note: p.classification.confirmationRequired
      ? 'Human confirmation required before execution.'
      : 'Safe to proceed with suggested action.',
  };
}

/**
 * Generate a Cursor-style prompt for a coding/implementation task.
 */
export function createCursorPrompt(task, options = {}) {
  const project = options.project || findProjectForTask(task);
  const plan = options.plan || createPlan(task);

  const lines = [
    `# Cursor Task Prompt`,
    ``,
    `## Context`,
    `- **System:** CopelandOS`,
    `- **Project:** ${project?.displayName || 'CopelandOS'}`,
    `- **Repo:** ${project?.repo || 'cbaker20-cyber/copelandos'}`,
    `- **Phase:** ${project?.currentPhase || 'Not specified'}`,
    ``,
    `## Goal`,
    ``,
    task,
    ``,
    `## Skill Selected`,
    `${plan.skill?.displayName || 'General'}`,
    ``,
    `## Files to Inspect`,
    `- worker.js`,
    `- src/foundationApi.js`,
    `- src/permissions.js`,
    `- src/vault.js`,
    `- config/projects.json`,
    ...(options.files || []).map((f) => `- ${f}`),
    ``,
    `## Constraints`,
    `- Open a branch and draft PR; do not push directly to main.`,
    `- Do not commit secrets, real API keys, or environment files.`,
    `- Gmail operations are draft-only. Do not call the send endpoint.`,
    `- Do not weaken existing tests.`,
    `- Do not fake connected-provider states.`,
    ...(project?.forbiddenActions || []).map((a) => `- FORBIDDEN: ${a}`),
    ...(project?.forbiddenClaims || []).map((c) => `- FORBIDDEN CLAIM: ${c}`),
    ``,
    `## Tests to Run`,
    `- npm test`,
    `- node --check worker.js`,
    `- node --check src/foundationApi.js`,
    ``,
    `## Safety Rules`,
    `- Risk level: ${plan.classification.riskLevel}`,
    `- Confirmation required: ${plan.classification.confirmationRequired}`,
    `- Stop on blockers instead of guessing.`,
    `- Inspect the repository before acting.`,
    ``,
    `## Draft PR Title`,
    `${options.prTitle || `feat: ${task.slice(0, 60)}`}`,
    ``,
    `## Forbidden Actions`,
    `- send_email`,
    `- arbitrary_shell`,
    `- delete_file`,
    `- merge_pr (without explicit instruction)`,
    `- deploy (without explicit instruction)`,
    `- control_screen / control_mouse / control_keyboard`,
    `- install_package (without explicit instruction)`,
  ];

  return lines.join('\n');
}

/**
 * Generate a Codex-style prompt for architecture/security tasks.
 */
export function createCodexPrompt(task, options = {}) {
  const project = options.project || findProjectForTask(task);
  const plan = options.plan || createPlan(task);

  const lines = [
    `# Codex Architecture & Security Prompt`,
    ``,
    `## System`,
    `CopelandOS — Personal Jarvis command center`,
    ``,
    `## Project`,
    `- **Name:** ${project?.displayName || 'CopelandOS'}`,
    `- **Repo:** ${project?.repo || 'cbaker20-cyber/copelandos'}`,
    ``,
    `## Task`,
    ``,
    task,
    ``,
    `## Architecture Scope`,
    `- Review the system architecture before proposing changes.`,
    `- Prefer adding adapters and modules over editing core files unnecessarily.`,
    `- Maintain the Cloudflare Worker constraint (no Node-only APIs in worker.js).`,
    ``,
    `## Security Requirements`,
    `- No secrets, tokens, or credentials in code.`,
    `- CORS restricted to ALLOWED_ORIGIN env var.`,
    `- All high-risk actions return confirmation_required.`,
    `- Gmail must remain draft-only.`,
    `- MCP registry is allowlist-first; no arbitrary server installation.`,
    ``,
    `## Risk Assessment`,
    `- Risk level: ${plan.classification.riskLevel}`,
    `- Confirmation required: ${plan.classification.confirmationRequired}`,
    ``,
    `## Files to Review`,
    `- worker.js (canonical entry point)`,
    `- src/foundationApi.js`,
    `- src/permissions.js`,
    `- src/vault.js`,
    `- docs/security-model.md`,
    `- docs/architecture.md`,
    ...(options.files || []).map((f) => `- ${f}`),
    ``,
    `## Forbidden Actions`,
    `- Do not add real API calls without stub/mock fallback.`,
    `- Do not add arbitrary shell execution.`,
    `- Do not add email sending.`,
    `- Do not add deploy controls.`,
    `- Do not add screen/mouse/keyboard automation.`,
    `- Do not install random MCP servers.`,
    `- Do not fake connected states.`,
    ...(project?.forbiddenClaims || []).map((c) => `- DO NOT CLAIM: ${c}`),
    ``,
    `## Tests to Run`,
    `- npm test`,
    `- node --check worker.js`,
  ];

  return lines.join('\n');
}

function findProjectForTask(task) {
  const lower = (task || '').toLowerCase();
  const projects = projectRegistry.projects || [];
  for (const p of projects) {
    if (lower.includes(p.id.toLowerCase()) || lower.includes(p.displayName.toLowerCase())) return p;
  }
  return projects.find((p) => p.id === 'copelandos') || null;
}
