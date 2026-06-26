const DEFAULT_CONTEXT_WINDOW_TOKENS = 200000;

const AGENTS = Object.freeze([
  { id: 'hermes', role: 'Chief router and context compiler' },
  { id: 'architect', role: 'Architecture and system design' },
  { id: 'engineer', role: 'Code, tests, and reviewable implementation prompts' },
  { id: 'secretary', role: 'Gmail, Calendar, Drive, Sheets, and Band Council drafts' },
  { id: 'researcher', role: 'Evidence, sources, and uncertainty tracking' },
  { id: 'tutor', role: 'Mimo-style lessons and practice' },
  { id: 'ornith', role: 'Experimental harness and eval design' },
]);

export function getSharedContextStatus(env = {}, projectRegistry = {}) {
  return {
    ok: true,
    mode: 'cloud-and-connector-only',
    localAgents: false,
    targetContextWindowTokens: Number(env.SHARED_CONTEXT_WINDOW_TOKENS || DEFAULT_CONTEXT_WINDOW_TOKENS),
    projectCount: projectRegistry.projects?.length || 0,
    agents: AGENTS,
  };
}

export function buildSharedContextPack({ task = '', projectId = '', urgency = 'medium' } = {}, projectRegistry = {}, env = {}) {
  const projects = Array.isArray(projectRegistry.projects) ? projectRegistry.projects : [];
  const selectedProject = projects.find((project) => project.id === projectId) || inferProject(task, projects) || projects[0] || null;
  const contextItems = [
    selectedProject ? {
      source: 'project_registry',
      title: selectedProject.displayName || selectedProject.id,
      content: [
        `Repo: ${selectedProject.repo}`,
        `Phase: ${selectedProject.currentPhase}`,
        `Next task: ${selectedProject.nextRecommendedTask}`,
        `Safe actions: ${(selectedProject.safeActions || []).join(', ')}`,
        `Forbidden actions: ${(selectedProject.forbiddenActions || []).join(', ')}`,
      ].join('\n'),
      priority: 'high',
    } : null,
    { source: 'task', title: 'Current task', content: String(task || 'No task supplied.'), priority: 'high' },
    {
      source: 'rules',
      title: 'Operating rules',
      content: 'Use cloud APIs, GitHub, Google Workspace, and connector context only. Draft and plan first. Require approval for sends, deletes, merges, deploys, calendar or drive writes, and webhooks.',
      priority: 'high',
    },
  ].filter(Boolean);
  return {
    ok: true,
    mode: 'cloud-and-connector-only',
    localAgents: false,
    task,
    urgency,
    projectId: selectedProject?.id || null,
    project: selectedProject,
    contextBudgetTokens: Number(env.SHARED_CONTEXT_WINDOW_TOKENS || DEFAULT_CONTEXT_WINDOW_TOKENS),
    contextItems,
    recommendedTeam: selectAgentTeam(task),
    handoffPrompt: buildHandoffPrompt(task, selectedProject, contextItems),
  };
}

function inferProject(task, projects) {
  const lower = String(task || '').toLowerCase();
  return projects.find((project) => lower.includes(String(project.id || '').toLowerCase()))
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
  return AGENTS.filter((agent) => ids.includes(agent.id));
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
    '- Route subtasks to the right specialist agents.',
    '- Produce reviewable drafts, plans, or prompts before any write action.',
  ].join('\n');
}
