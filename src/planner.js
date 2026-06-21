import planningRoles from '../config/planning-roles.json' with { type: 'json' };
import projectRegistry from '../config/projects.json' with { type: 'json' };
import { classify } from './ideaClassifier.js';
import { getSkill } from './skills.js';

const ROLES = Object.fromEntries(planningRoles.roles.map(r => [r.id, r]));
const SELECTION_RULES = planningRoles.selectionRules;

const PROJECT_RULES = Object.freeze({
  'score-scanner': [
    'Score Scanner: no fake PDF/photo OMR; MusicXML-only unless explicitly implemented and tested.',
    'Do not claim PDF or photo optical music recognition works unless the repository contains real implementation evidence.',
  ],
  'jazz-backend': [
    'JazzBackend: preserve musical constraints, MusicXML validity, rhythm integrity, and existing generator invariants.',
  ],
  'band-council-agent': [
    'Band Council: privacy-safe, draft-only, no private student data, no autonomous communication.',
  ],
  'connectome-perturbation': [
    'Connectome: evidence-first, reproducible methods, no invented research claims or provenance.',
  ],
  copelandos: [
    'CopelandOS: security-first, canonical Worker entry point, no fake connected claims, no unsafe local control.',
  ],
});

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
  return createAgentPrompt('cursor', { idea, project, task });
}

export function createCodexPrompt({ idea, project, task }) {
  return createAgentPrompt('codex', { idea, project, task });
}

function createAgentPrompt(kind, { idea, project, task }) {
  const proj = projectRegistry.projects.find(p => p.id === project);
  const goal = String(task || idea?.text || '').trim() || 'Review the captured idea and propose the safest next step.';
  const classification = classifyTask(goal);
  const repo = proj?.repo || 'unknown-repo';
  const projectRules = proj ? (PROJECT_RULES[proj.id] || []) : [];
  const forbiddenActions = [
    ...(proj?.forbiddenActions || []),
    'commit secrets',
    'send email',
    'merge PRs',
    'deploy',
    'delete files',
    'run arbitrary shell',
    'control screen/mouse/keyboard',
    'claim integrations are connected without evidence',
  ];
  const filesToInspect = inferFilesToInspect(proj, classification);
  const testsToRun = inferTestsToRun(proj, classification);
  const agentName = kind === 'cursor'
    ? 'Cursor implementation agent'
    : 'Codex architecture and security agent';

  const lines = [
    `You are the ${agentName}${proj ? ` for ${proj.displayName}` : ''}.`,
    '',
    'REPO:',
    repo,
    '',
    'ISSUE OR IDEA ID:',
    idea?.id || 'captured-idea-without-id',
    '',
    'GOAL:',
    goal,
    '',
    'FILES TO INSPECT:',
    ...filesToInspect.map(file => `- ${file}`),
    '',
    'CONSTRAINTS:',
    `- Category: ${classification.category}`,
    `- Skill: ${classification.skill || 'general'}`,
    `- Risk level: ${classification.riskLevel}`,
    proj ? `- Current phase: ${proj.currentPhase}` : '- Project registry entry was not matched; inspect before editing.',
    ...(proj?.forbiddenClaims || []).map(claim => `- Forbidden claim: ${claim}`),
    ...projectRules.map(rule => `- ${rule}`),
    '',
    'SAFETY RULES:',
    '- Do not execute captured ideas automatically.',
    '- Add or update focused tests for behavioral changes.',
    '- Preserve existing security boundaries and exact-origin CORS.',
    '- Stop on blockers instead of guessing.',
    '- Open a branch and draft PR; never push directly to main.',
    '',
    'TESTS TO RUN:',
    ...testsToRun.map(test => `- ${test}`),
    '',
    'DRAFT PR TITLE:',
    draftPrTitle(proj, goal, kind),
    '',
    'FORBIDDEN ACTIONS:',
    ...[...new Set(forbiddenActions)].map(action => `- ${action}`),
    '',
    kind === 'cursor' ? 'IMPLEMENTATION MODE:' : 'REVIEW MODE:',
    kind === 'cursor'
      ? 'Implement the smallest safe change, verify it, and prepare a draft PR summary.'
      : 'Analyze architecture, security, tests, and risks before recommending implementation.',
  ];

  return lines.join('\n');
}

function inferFilesToInspect(project, classification) {
  if (!project) return ['README.md', 'docs/', 'src/', 'test/'];
  if (project.id === 'copelandos') {
    const files = ['README.md', 'worker.js', 'src/', 'config/', 'docs/', 'test/'];
    if (classification.category === 'design') files.push('frontend/index.html');
    if (classification.category === 'memory') files.push('src/vault.js', 'docs/obsidian-vault.md');
    return files;
  }
  if (project.id === 'score-scanner') return ['README.md', 'src/', 'tests/', 'docs/', 'fixtures/musicxml/'];
  if (project.id === 'jazz-backend') return ['README.md', 'src/', 'tests/', 'docs/', 'musicxml fixtures'];
  if (project.id === 'band-council-agent') return ['README.md', 'templates/', 'docs/', 'privacy policy'];
  if (project.id === 'connectome-perturbation') return ['README.md', 'docs/', 'scripts/', 'data manifest', 'environment files'];
  return ['README.md', 'src/', 'test/', 'docs/'];
}

function inferTestsToRun(project, classification) {
  if (project?.id === 'copelandos') {
    const checks = ['npm test', 'node --check worker.js', 'git diff --check'];
    if (classification.category === 'coding' || classification.category === 'memory') checks.push('node --check src/foundationApi.js', 'node --check src/vault.js');
    return checks;
  }
  if (project?.id === 'jazz-backend') return ['Run the existing rhythm/MusicXML test suite', 'Add focused regression tests for changed musical behavior'];
  if (project?.id === 'score-scanner') return ['Run existing MusicXML parser/reorder tests', 'Do not add fake OMR tests unless OMR is actually implemented'];
  return ['Run the repository test suite', 'Run syntax/type checks used by the project', 'Add focused tests for the requested behavior'];
}

function draftPrTitle(project, goal, kind) {
  const prefix = kind === 'cursor' ? 'Implement' : 'Review';
  const projectName = project?.displayName || 'Project';
  const compactGoal = goal
    .replace(/\s+/g, ' ')
    .replace(/[^\w .:/-]/g, '')
    .slice(0, 72)
    .trim();
  return `${prefix} ${projectName}: ${compactGoal || 'captured idea'}`;
}
