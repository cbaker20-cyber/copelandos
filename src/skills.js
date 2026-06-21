import skillsConfig from '../config/skills.json' with { type: 'json' };

export function listSkills() {
  return skillsConfig.skills;
}

export function getSkill(id) {
  return skillsConfig.skills.find(s => s.id === id) || null;
}

export function findSkillByKeyword(keywords) {
  const lower = keywords.map(k => k.toLowerCase());
  let bestMatch = null;
  let bestScore = 0;
  for (const skill of skillsConfig.skills) {
    const score = skill.keywords.filter(kw => lower.some(k => k.includes(kw) || kw.includes(k))).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = skill;
    }
  }
  return bestMatch;
}

export function publicSkillSummary(skill) {
  return {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    riskLevel: skill.riskLevel,
    outputType: skill.outputType,
    confirmationRequired: skill.confirmationRequired,
  };
}
