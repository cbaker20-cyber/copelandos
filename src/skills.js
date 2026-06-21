import skillsConfig from '../config/skills.json' with { type: 'json' };

export const SKILLS = Object.freeze(skillsConfig.skills.map((s) => Object.freeze({ ...s })));

export function getSkill(id) {
  return SKILLS.find((s) => s.id === id) || null;
}

export function listSkills() {
  return [...SKILLS];
}

/**
 * Find the best matching skill for a given text using keyword scoring.
 * Returns the skill with the highest match score, or null if none matched.
 */
export function matchSkill(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  let bestSkill = null;
  let bestScore = 0;

  for (const skill of SKILLS) {
    let score = 0;
    for (const kw of skill.keywords) {
      if (lower.includes(kw.toLowerCase())) score += kw.split(' ').length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
  }

  return bestSkill;
}

export function publicSkillSummary(skill) {
  return {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    defaultRisk: skill.defaultRisk,
    defaultAction: skill.defaultAction,
    confirmationRequired: skill.confirmationRequired,
  };
}
