import planningRoles from '../config/planning-roles.json' with { type: 'json' };
import projectRegistry from '../config/projects.json' with { type: 'json' };
import { classify } from './ideaClassifier.js';
import { getSkill } from './skills.js';

const ROLES = Object.fromEntries(planningRoles.roles.map(r => [r.id, r]));
const SELECTION_RULES = planningRoles.selectionRules;

const PROJECT_PROMPT_RULES = {
  'score-scanner': {
    filesToInspect: ['README.md', 'docs/cursor-ready-issues.md', 'src/', 'tests/'],
    testsToRun: ['npm test', 'node --test'],
    safetyRules: ['No fake PDF/photo OMR claims or implementation.', 'MusicXML-only unless real OMR is explicitly implemented and tested.'],
    draftPrTitle: 'Scope Score Scanner MusicXML task',
  },
  'jazz-backend': {
    filesToInspect: ['README.md', 'src/', 'tests/', 'docs/cursor-ready-issues.md'],
    testsToRun: ['npm test', 'pytest if present'],
    safetyRules: ['Preserve musical constraints.', 'Do not remove failing rhythm or MusicXML tests to pass CI.'],
    draftPrTitle: 'Improve JazzBackend task safely',
  },
  'band-council-agent': {
    filesToInspect: ['README.md', 'docs/', 'templates/'],
    testsToRun: ['npm test if present'],
    safetyRules: ['Privacy-safe only.', 'Draft-only communications.', 'Do not store private student data.'],
    draftPrTitle: 'Draft Band Council workflow update',
  },
  'connectome-perturbation': {
    filesToInspect: ['README.md', 'docs/', 'scripts/', 'data manifest if present'],
    testsToRun: ['pytest if present', 'validation scripts documented by repo'],
    safetyRules: ['Evidence-first.', 'Do not invent research claims or provenance.', 'Do not commit private or large generated data.'],
    draftPrTitle: 'Document Connectome evidence workflow',
  },
  copelandos: {
    filesToInspect: ['README.md', 'worker.js', 'src/', 'config/', 'docs/', 'test/'],
    testsToRun: ['npm test', 'node --check worker.js', 'git diff --check'],
    safetyRules: ['Security-first.', 'No fake connected claims.', 'Do not add secrets, deploy controls, merge controls, or arbitrary shell execution.'],
    draftPrTitle: 'Build CopelandOS foundation task',
  },
};

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

export function createCursorPrompt({ idea, project, task }) {
  const proj = projectRegistry.projects.find(p => p.id === project);
  const classification = classifyTask(task || idea?.text || '');
  const rules = getPromptRules(project, proj);
  const goal = task || idea?.text || '';
  const lines = [
    `You are the Cursor implementation agent${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    proj ? proj.repo : 'Unknown repo - inspect the idea/project before editing.',
    '',
    'ISSUE OR IDEA ID:',
    idea?.id || 'No issue id provided. Use the captured idea text as the source of truth.',
    '',
    'GOAL:',
    goal,
    '',
    'FILES TO INSPECT:',
    ...rules.filesToInspect.map((file) => `- ${file}`),
    '',
    proj ? `CURRENT PHASE: ${proj.currentPhase}` : '',
    `Category: ${classification.category}`,
    `Skill: ${classification.skill || 'general'}`,
    `Risk level: ${classification.riskLevel}`,
    '',
    'CONSTRAINTS:',
    ...(rules.safetyRules || []).map((rule) => `- ${rule}`),
    ...(proj ? proj.forbiddenActions.map(a => `- FORBIDDEN: ${a}`) : []),
    ...(proj ? proj.forbiddenClaims.map(c => `- FORBIDDEN CLAIM: ${c}`) : []),
    '- Do not commit secrets, tokens, or private data.',
    '- Use a branch and draft PR. Do not push to main directly.',
    '- Stop and report blockers instead of guessing.',
    '- Run tests before proposing a merge.',
    '',
    'REQUIRED STEPS:',
    '1. Read the repository and understand the existing code.',
    '2. Identify the files that need to change.',
    '3. Implement the minimal change that satisfies the goal.',
    '4. Add or update tests.',
    '5. Open a draft PR with a clear description.',
    '',
    'TESTS TO RUN:',
    ...rules.testsToRun.map((test) => `- ${test}`),
    '',
    'DRAFT PR TITLE:',
    rules.draftPrTitle,
    '',
    'FORBIDDEN ACTIONS:',
    '- Do not merge PRs.',
    '- Do not deploy.',
    '- Do not send email.',
    '- Do not run arbitrary shell commands outside the repo task.',
    '- Do not delete user files or secrets.',
    '',
    proj ? `SAFE ACTIONS: ${proj.safeActions.join(', ')}` : '',
    `TASK BRIEF: ${goal || 'See idea above'}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function createCodexPrompt({ idea, project, task }) {
  const proj = projectRegistry.projects.find(p => p.id === project);
  const classification = classifyTask(task || idea?.text || '');
  const rules = getPromptRules(project, proj);
  const goal = task || idea?.text || '';
  const lines = [
    `You are the Codex architecture and security agent${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    proj ? proj.repo : 'Unknown repo - inspect the idea/project before editing.',
    '',
    'ISSUE OR IDEA ID:',
    idea?.id || 'No issue id provided. Use the captured idea text as the source of truth.',
    '',
    'GOAL:',
    goal,
    '',
    'FILES TO INSPECT:',
    ...rules.filesToInspect.map((file) => `- ${file}`),
    '',
    `Category: ${classification.category}`,
    `Skill: ${classification.skill || 'general'}`,
    '',
    'REVIEW FOCUS:',
    '- Architecture decisions and trade-offs',
    '- Security: auth, CORS, input validation, secret handling',
    '- Test coverage and testability',
    '- Dependency choices and risk',
    '',
    'CONSTRAINTS:',
    ...(rules.safetyRules || []).map((rule) => `- ${rule}`),
    ...(proj ? proj.forbiddenActions.map(a => `- FORBIDDEN: ${a}`) : []),
    '- Do not claim integration is connected without evidence.',
    '- Do not weaken existing tests.',
    '- Never add secrets or tokens to the codebase.',
    '',
    'TESTS TO RUN:',
    ...rules.testsToRun.map((test) => `- ${test}`),
    '',
    'DRAFT PR TITLE:',
    rules.draftPrTitle,
    '',
    'FORBIDDEN ACTIONS:',
    '- Do not merge PRs.',
    '- Do not deploy.',
    '- Do not send email.',
    '- Do not delete files or data.',
    '- Do not install random MCP servers.',
    '',
    proj ? `FORBIDDEN CLAIMS: ${proj.forbiddenClaims.join('; ')}` : '',
    `TASK: ${goal || 'See idea above'}`,
  ].filter(Boolean);

  return lines.join('\n');
}

function getPromptRules(projectId, project) {
  return PROJECT_PROMPT_RULES[projectId] || {
    filesToInspect: ['README.md', 'docs/', 'src/', 'test/'],
    testsToRun: ['npm test', 'project-specific checks from README'],
    safetyRules: project ? [
      `Project goal: ${project.goal}`,
      `Safe actions: ${project.safeActions.join(', ')}`,
    ] : ['Inspect the repo before making changes.', 'Preserve existing tests and security boundaries.'],
    draftPrTitle: project ? `Implement ${project.displayName} task` : 'Implement captured idea safely',
  };
}
