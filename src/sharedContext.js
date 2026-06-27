const DEFAULT_CONTEXT_WINDOW_TOKENS = 200000;
const MAX_CONTEXT_ITEMS = 24;

const CONTEXT_SOURCES = Object.freeze([
  {
    id: 'project_registry',
    name: 'Project registry',
    mode: 'always-on',
    includes: ['repo', 'phase', 'next task', 'safe actions', 'forbidden actions'],
  },
  {
    id: 'github_prs',
    name: 'GitHub PRs and issues',
    mode: 'connector-planned',
    includes: ['open PRs', 'recent commits', 'CI state', 'blocked reviews'],
  },
  {
    id: 'vault_memory',
    name: 'CopelandVault memory',
    mode: 'github-or-mock',
    includes: ['daily notes', 'project updates', 'decisions', 'captured ideas'],
  },
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    mode: 'oauth-planned',
    includes: ['Gmail drafts', 'Calendar obligations', 'Drive docs', 'Sheets trackers'],
  },
  {
    id: 'chat_context',
    name: 'Conversation context',
    mode: 'prompt-provided',
    includes: ['current instructions', 'constraints', 'recent decisions'],
  },
  {
    id: 'automation_registry',
    name: 'Automation registry',
    mode: 'always-on',
    includes: ['Mimo', 'Ornith', 'Workspace', 'GitHub Actions', 'Slack', 'n8n/Make/Zapier previews'],
  },
]);

const AGENT_TEAM = Object.freeze([
  {
    id: 'hermes',
    role: 'Chief router and shared-context compiler',
    defaultModelClass: 'largest-context-available',
    output: 'One task brief with relevant memory, risks, and next actions.',
  },
  {
    id: 'architect',
    role: 'System design and repo architecture',
    defaultModelClass: 'reasoning',
    output: 'Implementation plan and risks.',
  },
  {
    id: 'engineer',
    role: 'Code, tests, and PR prompts',
    defaultModelClass: 'coding',
    output: 'Reviewable Cursor/Codex prompt or patch plan.',
  },
  {
    id: 'secretary',
    role: 'Email, calendar, Drive, and Band Council ops',
    defaultModelClass: 'workspace',
    output: 'Drafts and schedule/delegation proposals only.',
  },
  {
    id: 'researcher',
    role: 'Sources, citations, and evidence tracking',
    defaultModelClass: 'web-research',
    output: 'Source-grounded brief with uncertainties.',
  },
  {
    id: 'tutor',
    role: 'Mimo-style lessons and practice',
    defaultModelClass: 'teaching',
    output: 'Guided lesson, quiz, or study plan.',
  },
  {
    id: 'ornith',
    role: 'Experimental harness/eval designer',
    defaultModelClass: 'sandbox-required',
    output: 'Harness/eval proposal; no real execution by default.',
  },
]);

export function getSharedContextStatus(env = {}, projectRegistry = {}) {
  const configuredProviders = [
    ['OpenRouter', env.OPENROUTER_KEY || env.OPENROUTER_API_KEY],
    ['Gemini', env.GEMINI_KEY || env.GEMINI_API_KEY],
    ['Groq', env.GROQ_KEY || env.GROQ_API_KEY],
    ['Cerebras', env.CEREBRAS_KEY || env.CEREBRAS_API_KEY],
    ['Google Workspace', env.GOOGLE_REFRESH_TOKEN || env.GMAIL_REFRESH_TOKEN],
    ['GitHub Vault', env.GITHUB_TOKEN && env.GITHUB_REPO],
  ].filter(([, value]) => Boolean(value)).map(([name]) => name);

  return {
    ok: true,
    mode: 'cloud-and-connector-only',
    localAgents: false,
    targetContextWindowTokens: Number(env.SHARED_CONTEXT_WINDOW_TOKENS || DEFAULT_CONTEXT_WINDOW_TOKENS),
    projectCount: projectRegistry.projects?.length || 0,
    configuredProviders,
    sources: CONTEXT_SOURCES,
    agents: AGENT_TEAM,
    nextStep: 'Build a context pack for one project/task, then route it through Hermes to the agent team.',
  };
}

export function buildSharedContextPack({ task = '', projectId = '', urgency = 'medium', include = [] } = {}, projectRegistry = {}, env = {}) {
  const projects = Array.isArray(projectRegistry.projects) ? projectRegistry.projects : [];
  const selectedProject = projects.find((project) => project.id === projectId)
    || inferProject(task, projects)
    || projects[0]
    || null;

  const contextItems = [
    selectedProject ? {
      source: 'project_registry',
      title: selectedProject.displayName || selectedProject.id,
      content: [
        `Repo: ${selectedProject.repo}`,
        `Phase: ${selectedProject.currentPhase}`,
        `Next recommended task: ${selectedProject.nextRecommendedTask}`,
        `Safe actions: ${(selectedProject.safeActions || []).join(', ')}`,
        `Forbidden actions: ${(selectedProject.forbiddenActions || []).join(', ')}`,
      ].join('\n'),
      priority: 'high',
    } : null,
    {
      source: 'task',
      title: 'Current task',
      content: String(task || 'No task supplied.'),
      priority: 'high',
    },
    {
      source: 'operating_rules',
      title: 'Operating rules',
      content: [
        'No local agents or PC bridge.',
        'Use cloud APIs, GitHub, Google Workspace, and connector-accessible context only.',
        'Draft, plan, preview, and open PRs first; do not send, deploy, delete, merge, or fire webhooks without explicit approval.',
        'Prefer the largest configured context window for synthesis; compress older context into project memory notes.',
      ].join('\n'),
      priority: 'high',
    },
  ].filter(Boolean).slice(0, MAX_CONTEXT_ITEMS);

  return {
    ok: true,
    mode: 'cloud-and-connector-only',
    localAgents: false,
    task,
    urgency,
    projectId: selectedProject?.id || null,
    project: selectedProject || null,
    include,
    contextBudgetTokens: Number(env.SHARED_CONTEXT_WINDOW_TOKENS || DEFAULT_CONTEXT_WINDOW_TOKENS),
    contextItems,
    recommendedTeam: selectAgentTeam(task),
    handoffPrompt: buildHandoffPrompt(task, selectedProject, contextItems),
  };
}

function inferProject(task, projects) {
  const lower = String(task || '').toLowerCase();
  return projects.find((project) => lower.includes(project.id?.toLowerCase()))
    || projects.find((project) => lower.includes(String(project.displayName || '').toLowerCase()))
    || null;
}

function selectAgentTeam(task) {
  const lower = String(task || '').toLowerCase();
  const ids = ['hermes'];
  if (/code|repo|bug|test|cursor|github|worker|backend|frontend/.test(lower)) ids.push('architect', 'engineer');
  if (/email|calendar|drive|sheets|docs|band|schedule|delegate/.test(lower)) ids.push('secretary');
  if (/research|source|cite|paper|regeneron|science/.test(lower)) ids.push('researcher');
  if (/learn|lesson|practice|mimo|quiz/.test(lower)) ids.push('tutor');
  if (/ornith|harness|eval|agent loop/.test(lower)) ids.push('ornith');
  return AGENT_TEAM.filter((agent) => ids.includes(agent.id));
}

function buildHandoffPrompt(task, project, contextItems) {
  return [
    'CopelandOS shared-context handoff',
    project ? `Project: ${project.displayName || project.id}` : 'Project: unresolved',
    '',
    'Task:',
    task || '(none)',
    '',
    'Context pack:',
    ...contextItems.map((item) => `## ${item.title}\n${item.content}`),
    '',
    'Instructions:',
    '- Use this shared context as the single source of truth.',
    '- Ask Hermes to route subtasks to the right specialist agents.',
    '- Produce reviewable drafts/plans/PR prompts before any write action.',
  ].join('\n');
}
