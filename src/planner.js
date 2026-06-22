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

  if (/\bcouncil\b/i.test(text)) {
    return { useCouncil: true, reason: 'Council mode was explicitly requested.' };
  }

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

function projectById(project) {
  return projectRegistry.projects.find(p => p.id === project) || null;
}

function projectSpecificRules(project) {
  switch (project?.id) {
    case 'score-scanner':
      return ['Score Scanner: no fake PDF/photo OMR; MusicXML-only unless explicitly implemented and tested.'];
    case 'jazz-backend':
      return ['JazzBackend: preserve musical constraints and MusicXML validity; do not remove failing tests to pass.'];
    case 'band-council-agent':
      return ['Band Council: privacy-safe, draft-only, no private student data, no autonomous communication.'];
    case 'connectome-perturbation':
      return ['Connectome: evidence-first, no invented research, provenance before scientific interpretation.'];
    case 'copelandos':
      return [
        'CopelandOS: security-first; worker.js is the canonical Cloudflare Worker entry point.',
        'CopelandOS: no fake connected claims; Gmail remains draft-only; CORS must stay exact-origin.',
      ];
    default:
      return [];
  }
}

function filesToInspect(project) {
  if (!project) return ['README.md', 'package.json', 'docs/security-model.md', 'relevant source and tests'];
  if (project.id === 'copelandos') {
    return [
      'README.md',
      'worker.js',
      'src/foundationApi.js',
      'src/ideaApi.js',
      'src/vault.js',
      'config/projects.json',
      'docs/security-model.md',
      'test/**/*.test.js',
    ];
  }
  return ['README.md', project.taskSource, 'relevant source files', 'relevant tests'];
}

function testsToRun(project) {
  if (!project || project.id === 'copelandos') {
    return [
      'npm test',
      'node --check worker.js',
      'node --check src/foundationApi.js',
      'node --check src/vault.js',
      'git diff --check',
    ];
  }
  return ['repository test suite', 'targeted tests for changed files', 'git diff --check'];
}

function draftTitle(kind, project, idea, task) {
  const prefix = kind === 'cursor' ? 'Implement' : 'Review';
  const target = project?.displayName || 'Captured Idea';
  const goal = String(task || idea?.text || 'task').replace(/\s+/g, ' ').slice(0, 70);
  return `${prefix} ${target}: ${goal}`;
}

function buildAgentPrompt(kind, { idea, project, task }) {
  const proj = projectById(project);
  const goal = task || idea?.text || '';
  const classification = classifyTask(goal);
  const agent = kind === 'cursor' ? 'Cursor implementation agent' : 'Codex architecture and security agent';
  const focus = kind === 'cursor'
    ? ['Implement the smallest safe change.', 'Add or update tests.', 'Open a draft PR and stop on blockers.']
    : ['Review architecture and security trade-offs.', 'Identify minimal safe implementation boundaries.', 'Call out missing tests and unsafe assumptions.'];

  return [
    `You are the ${agent}${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    proj ? `- ${proj.repo}` : '- Unknown repo; inspect the current workspace before acting.',
    proj ? `- Task source: ${proj.taskSource}` : '',
    proj ? `- Current phase: ${proj.currentPhase}` : '',
    proj ? `- Next recommended task: ${proj.nextRecommendedTask}` : '',
    '',
    'ISSUE OR IDEA ID:',
    `- ${idea?.id || 'captured-idea'}`,
    '',
    'GOAL:',
    `- ${goal || 'See captured idea.'}`,
    '',
    'FILES TO INSPECT:',
    ...filesToInspect(proj).map(file => `- ${file}`),
    '',
    'CONSTRAINTS:',
    `- Category: ${classification.category}`,
    `- Skill: ${classification.skill || 'general'}`,
    `- Risk level: ${classification.riskLevel}`,
    ...(proj ? [`- Safe actions: ${proj.safeActions.join(', ')}`] : []),
    ...projectSpecificRules(proj).map(rule => `- ${rule}`),
    '- Keep edits scoped and follow existing repository patterns.',
    '- Do not weaken tests or expose upstream error bodies that may contain sensitive information.',
    '',
    'SAFETY RULES:',
    '- Do not commit secrets, tokens, OAuth codes, refresh tokens, private email content, .env, or .dev.vars.',
    '- Do not send email; Gmail work must remain draft-only.',
    '- Do not deploy, merge PRs, delete files, install packages unnecessarily, or run arbitrary shell actions.',
    '- Do not claim providers, tools, or integrations are connected without env/config evidence.',
    '- High-risk actions require explicit human confirmation and must not execute automatically.',
    '',
    'TESTS TO RUN:',
    ...testsToRun(proj).map(command => `- ${command}`),
    '',
    'DRAFT PR TITLE:',
    `- ${draftTitle(kind, proj, idea, goal)}`,
    '',
    'FORBIDDEN ACTIONS:',
    ...(proj ? proj.forbiddenActions.map(action => `- ${action}`) : []),
    '- automatic email sending',
    '- deploy controls',
    '- merge controls',
    '- arbitrary shell execution',
    '- screen/mouse/keyboard automation',
    '',
    'FORBIDDEN CLAIMS:',
    ...(proj ? proj.forbiddenClaims.map(claim => `- ${claim}`) : []),
    '- integration_is_connected_without_evidence',
    '',
    'WORK MODE:',
    ...focus.map(item => `- ${item}`),
  ].filter(line => line !== '').join('\n');
}

export function createCursorPrompt({ idea, project, task }) {
  return buildAgentPrompt('cursor', { idea, project, task });
}

export function createCodexPrompt({ idea, project, task }) {
  return buildAgentPrompt('codex', { idea, project, task });
}
