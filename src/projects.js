export function listProjects(registry) {
  return (registry.projects || []).map((project) => structuredClone(project));
}

export function getProject(registry, projectId) {
  const normalized = String(projectId || '').trim().toLowerCase();
  const project = (registry.projects || []).find((item) => item.id.toLowerCase() === normalized);
  return project ? structuredClone(project) : null;
}

export function publicProjectSummary(project) {
  if (!project) return null;
  return {
    id: project.id,
    displayName: project.displayName,
    repo: project.repo,
    category: project.category,
    goal: project.goal,
    currentPhase: project.currentPhase,
    nextRecommendedTask: project.nextRecommendedTask,
    status: project.status,
  };
}
