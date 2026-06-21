import planningRoles from '../config/planning-roles.json' with { type: 'json' };
import projectRegistry from '../config/projects.json' with { type: 'json' };
import { classify } from './ideaClassifier.js';
import { getSkill } from './skills.js';

const ROLES = Object.fromEntries(planningRoles.roles.map(r => [r.id, r]));
const SELECTION_RULES = planningRoles.selectionRules;

export function classifyTask(input) {
  return classify(String(input || ''));
}

export function chooseSkill(task) {
  const classification = classifyTask(task);
  if (!classification.skill) return null;
  return getSkill(classification.skill);
}

export function chooseCouncilMode(task) {
  const classification = classifyTask(task);
  const text = String(task || '').toLowerCase();

  // Security tasks always use council
  if (/(security|auth|permission|cors|token|secret|deploy|vulnerability)/i.test(text)) {
    return { useCouncil: true, reason: 'Security-sensitive task; council with Security Reviewer required.' };
  }

  // Complex tasks trigger council
  if (
    classification.riskLevel === 'high' ||
    text.length > 200 ||
    /(complex|architecture|major|critical|refactor|design|system|multi-step|end-to-end)/i.test(text)
  ) {
    return { useCouncil: true, reason: 'Complex or high-risk task; AI council recommended.' };
  }

  // Simple tasks: short, safe, no ambiguity
  if (
    classification.riskLevel === 'safe' &&
    text.length < 120 &&
    !/(complex|architecture|major|big|critical|refactor|design|council|multi|system)/i.test(text)
  ) {
    return { useCouncil: false, reason: 'Simple task; single-planner mode sufficient.' };
  }

  return { useCouncil: false, reason: 'Moderate task; planner mode with optional review.' };
}

export function selectRoles(task) {
  const classification = classifyTask(task);
  const councilMode = chooseCouncilMode(task);
  const text = String(task || '').toLowerCase();

  if (councilMode.useCouncil) {
    let roleSet = [...SELECTION_RULES.council];
    // Ensure security reviewer for security tasks
    if (/(security|auth|permission|cors|token|secret|deploy)/i.test(text)) {
      if (!roleSet.includes('security-reviewer')) roleSet.push('security-reviewer');
    }
    return roleSet.map(id => ROLES[id]).filter(Boolean);
  }

  // Simple/moderate role selection
  switch (classification.category) {
    case 'coding':
      return SELECTION_RULES.coding.map(id => ROLES[id]).filter(Boolean);
    case 'research':
      return SELECTION_RULES.research.map(id => ROLES[id]).filter(Boolean);
    case 'design':
      return SELECTION_RULES.design.map(id => ROLES[id]).filter(Boolean);
    default:
      return SELECTION_RULES.simple.map(id => ROLES[id]).filter(Boolean);
  }
}

export function createPlan(task) {
  const classification = classifyTask(task);
  const skill = getSkill(classification.skill);
  const councilMode = chooseCouncilMode(task);
  const roles = selectRoles(task);

  return {
    task: String(task || ''),
    classification,
    skill: skill ? { id: skill.id, displayName: skill.displayName, outputType: skill.outputType } : null,
    councilMode,
    roles: roles.map(r => ({ id: r.id, displayName: r.displayName, description: r.description })),
    steps: buildSteps(task, classification, skill),
    warnings: buildWarnings(classification),
    requiresHumanConfirmation: classification.confirmationRequired,
    planVersion: 1,
    createdAt: new Date().toISOString(),
  };
}

function buildSteps(task, classification, skill) {
  const steps = [];
  if (classification.riskLevel === 'high') {
    steps.push('STOP: High-risk action detected. Present to human for explicit approval before any action.');
    steps.push('If approved: identify the minimal safe scope.');
    steps.push('If approved: create a reversible plan with a rollback path.');
    return steps;
  }

  steps.push(`Understand the goal: "${String(task).slice(0, 120)}"`);

  if (skill) {
    steps.push(`Apply skill: ${skill.displayName} (${skill.outputType})`);
    if (skill.outputType === 'cursor-prompt') {
      steps.push('Generate a scoped Cursor implementation prompt with repo, goal, constraints, and tests.');
    } else if (skill.outputType === 'codex-prompt') {
      steps.push('Generate a scoped Codex architecture prompt with files, goal, and forbidden actions.');
    } else if (skill.outputType === 'email-draft') {
      steps.push('Create email draft for human review. Do not send.');
    } else if (skill.outputType === 'vault-note') {
      steps.push('Write to Obsidian vault with sanitized path.');
    }
  }

  if (classification.confirmationRequired) {
    steps.push('Present plan to human for confirmation before execution.');
  }

  steps.push('Log outcome and update idea status.');
  return steps;
}

function buildWarnings(classification) {
  const warnings = [];
  if (classification.riskLevel === 'high') {
    warnings.push('HIGH RISK: This action requires explicit human approval and cannot be executed automatically.');
  }
  if (classification.riskLevel === 'medium') {
    warnings.push('MEDIUM RISK: Confirmation required before action.');
  }
  if (classification.skill === 'band-council') {
    warnings.push('PRIVACY: Band Council tasks must not include private student data.');
  }
  if (classification.skill === 'email-drafting') {
    warnings.push('DRAFT ONLY: Email drafts are never sent automatically.');
  }
  return warnings;
}

export function createTaskBrief(task) {
  const plan = createPlan(task);
  return {
    title: String(task).slice(0, 80),
    category: plan.classification.category,
    skill: plan.skill?.displayName || 'unassigned',
    risk: plan.classification.riskLevel,
    councilMode: plan.councilMode.useCouncil,
    roles: plan.roles.map(r => r.id),
    steps: plan.steps,
    warnings: plan.warnings,
    requiresConfirmation: plan.requiresHumanConfirmation,
  };
}

function buildFilesToInspect(project, classification) {
  const common = ['README.md', 'package.json'];
  if (!project) return common.concat(['src/', 'test/']);
  const byProject = {
    'score-scanner': ['src/', 'tests/', 'docs/cursor-ready-issues.md', 'musicxml fixtures'],
    'jazz-backend': ['src/', 'tests/', 'docs/cursor-ready-issues.md', 'MusicXML generation code'],
    'connectome-perturbation': ['README.md', 'docs/', 'scripts/', 'data manifest'],
    'band-council-agent': ['README.md', 'templates/', 'docs/', 'privacy policy files'],
    copelandos: ['worker.js', 'src/', 'config/', 'frontend/index.html', 'test/', 'docs/'],
  };
  if (byProject[project.id]) return byProject[project.id];
  if (classification.category === 'design') return ['frontend/', 'styles/', 'README.md'];
  if (classification.category === 'coding') return ['src/', 'test/', 'README.md'];
  return common.concat(['docs/']);
}

function buildProjectRules(project) {
  if (!project) return [];
  const rules = {
    'score-scanner': ['Score Scanner: no fake PDF/photo OMR; MusicXML-only unless explicitly implemented and tested.'],
    'jazz-backend': ['JazzBackend: preserve musical constraints and do not weaken generated MusicXML validity.'],
    'band-council-agent': ['Band Council: privacy-safe, draft-only, no private student data.'],
    'connectome-perturbation': ['Connectome: evidence-first, no invented research or provenance.'],
    copelandos: ['CopelandOS: security-first, no fake connected claims, worker.js remains canonical.'],
  };
  return rules[project.id] || [];
}

function projectById(project) {
  return projectRegistry.projects.find(p => p.id === project) || null;
}

function promptGoal(idea, task) {
  return String(task || idea?.text || '').trim();
}

function promptTitle(agentKind, project, goal) {
  const prefix = agentKind === 'cursor' ? 'Implement' : 'Review';
  const projectName = project?.displayName || 'CopelandOS task';
  return `${prefix}: ${projectName} - ${goal.slice(0, 58) || 'captured idea'}`;
}

export function createCursorPrompt({ idea, project, task }) {
  const proj = projectById(project);
  const goal = promptGoal(idea, task);
  const classification = classifyTask(goal);
  const filesToInspect = buildFilesToInspect(proj, classification);
  const forbiddenActions = proj?.forbiddenActions || ['send_email', 'merge_pr', 'deploy', 'delete_files', 'arbitrary_shell', 'control_screen'];
  const lines = [
    `You are the Cursor implementation agent${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    proj ? proj.repo : 'unknown - inspect the active repository before editing',
    '',
    'ISSUE OR IDEA ID:',
    idea?.id || 'captured-idea',
    '',
    'GOAL:',
    goal || 'Convert the captured idea into the smallest safe implementation task.',
    '',
    'FILES TO INSPECT:',
    ...filesToInspect.map(file => `- ${file}`),
    '',
    'TASK PROFILE:',
    `- Category: ${classification.category}`,
    `- Skill: ${classification.skill || 'general'}`,
    `- Risk level: ${classification.riskLevel}`,
    `- Human confirmation required: ${classification.confirmationRequired}`,
    '',
    'CONSTRAINTS:',
    ...(proj ? [`- Current phase: ${proj.currentPhase}`, `- Task source: ${proj.taskSource}`] : []),
    ...buildProjectRules(proj).map(rule => `- ${rule}`),
    '- Do not commit secrets, tokens, or private data.',
    '- Use a branch and draft PR. Do not push to main directly.',
    '- Stop and report blockers instead of guessing.',
    '- Do not claim integrations are connected without evidence.',
    '',
    'SAFETY RULES:',
    '- Captured ideas are never executed automatically.',
    '- Gmail remains draft-only.',
    '- High-risk actions require human confirmation and must not run automatically.',
    '- Do not deploy, merge, delete files, run arbitrary shell, or control the screen.',
    '',
    'TESTS TO RUN:',
    '- npm test',
    '- node --check worker.js',
    '- node --check src/foundationApi.js',
    '- node --check src/vault.js',
    '',
    'DRAFT PR TITLE:',
    promptTitle('cursor', proj, goal),
    '',
    'FORBIDDEN ACTIONS:',
    ...forbiddenActions.map(action => `- ${action}`),
    ...(proj ? proj.forbiddenClaims.map(claim => `- Forbidden claim: ${claim}`) : []),
    '',
    'DELIVERABLE:',
    'Implement the minimal scoped change, add or update tests, and open a draft PR. Stop on blockers.',
  ].filter(Boolean);

  return lines.join('\n');
}

export function createCodexPrompt({ idea, project, task }) {
  const proj = projectById(project);
  const goal = promptGoal(idea, task);
  const classification = classifyTask(goal);
  const filesToInspect = buildFilesToInspect(proj, classification);
  const forbiddenActions = proj?.forbiddenActions || ['send_email', 'merge_pr', 'deploy', 'delete_files', 'arbitrary_shell', 'control_screen'];
  const lines = [
    `You are the Codex architecture and security agent${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    proj ? proj.repo : 'unknown - inspect the active repository before proposing changes',
    '',
    'ISSUE OR IDEA ID:',
    idea?.id || 'captured-idea',
    '',
    'GOAL:',
    goal || 'Review this captured idea and produce a safe architecture plan.',
    '',
    'FILES TO INSPECT:',
    ...filesToInspect.map(file => `- ${file}`),
    '',
    'TASK PROFILE:',
    `- Category: ${classification.category}`,
    `- Skill: ${classification.skill || 'general'}`,
    `- Risk level: ${classification.riskLevel}`,
    '',
    'REVIEW FOCUS:',
    '- Architecture decisions and trade-offs',
    '- Security: auth, CORS, input validation, secret handling',
    '- Test coverage and testability',
    '- Dependency choices and risk',
    '',
    'CONSTRAINTS:',
    ...buildProjectRules(proj).map(rule => `- ${rule}`),
    '- Do not claim integration is connected without evidence.',
    '- Do not weaken existing tests.',
    '- Never add secrets or tokens to the codebase.',
    '',
    'SAFETY RULES:',
    '- Captured ideas are planning inputs only; do not execute them.',
    '- Gmail is draft-only.',
    '- High-risk actions require confirmation and should be represented as blocked/confirmation_required.',
    '- Do not deploy, merge, delete files, run arbitrary shell, or control screen/mouse/keyboard.',
    '',
    'TESTS TO RUN:',
    '- npm test',
    '- node --check worker.js',
    '- node --check src/foundationApi.js',
    '- node --check src/vault.js',
    '',
    'DRAFT PR TITLE:',
    promptTitle('codex', proj, goal),
    '',
    'FORBIDDEN ACTIONS:',
    ...forbiddenActions.map(action => `- ${action}`),
    ...(proj ? proj.forbiddenClaims.map(claim => `- Forbidden claim: ${claim}`) : []),
    '',
    'DELIVERABLE:',
    'Produce a concise implementation or review plan with risks, files, tests, and open questions.',
  ].filter(Boolean);

  return lines.join('\n');
}
