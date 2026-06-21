import { matchSkill } from './skills.js';

export const RISK = Object.freeze({ SAFE: 'safe', MEDIUM: 'medium', HIGH: 'high' });

export const CATEGORIES = Object.freeze({
  SCHOOL: 'school',
  CODING: 'coding',
  MUSIC: 'music',
  RESEARCH: 'research',
  EMAIL: 'email',
  PLANNING: 'planning',
  MEMORY: 'memory',
  LOCAL_ACTION: 'local-action',
  DESIGN: 'design',
  OTHER: 'other',
});

const BLOCKED_PATTERNS = [
  /\b(delete|rm\s+-rf|drop\s+table|format\s+drive|wipe)\b/i,
  /\b(arbitrary\s+shell|bash\s+-c|exec\s*\(|eval\s*\()\b/i,
  /\b(merge\s+to\s+main|force\s+push|git\s+push.*--force)\b/i,
  /\b(control_screen|control_mouse|control_keyboard|take_screenshot)\b/i,
];

const HIGH_RISK_PATTERNS = [
  /\b(deploy|ship\s+to\s+prod|push\s+to\s+cloudflare|publish)\b/i,
  /\b(delete\s+(file|folder|repo|database|data))\b/i,
  /\b(send\s+(email|message)|email.*mr\.|email.*professor).*now\b/i,
  /\b(install\s+package|npm\s+install|pip\s+install)\b/i,
  /\b(merge\s+(pr|pull\s+request))\b/i,
  /\b(arbitrary\s+shell|run\s+shell|execute\s+command)\b/i,
];

const MEDIUM_RISK_PATTERNS = [
  /\b(email|draft.*email|write.*email|email.*to)\b/i,
  /\b(create.*issue|open.*github.*issue|file.*bug)\b/i,
  /\b(fix|refactor|implement|add\s+feature)\b/i,
  /\b(band\s+council|agenda|meeting)\b/i,
  /\b(update\s+project|change\s+status)\b/i,
  /\b(run\s+test|execute\s+test)\b/i,
];

function detectRisk(text) {
  const lower = text.toLowerCase();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lower)) return { risk: RISK.HIGH, blocked: true };
  }
  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(lower)) return { risk: RISK.HIGH, blocked: false };
  }
  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(lower)) return { risk: RISK.MEDIUM, blocked: false };
  }
  return { risk: RISK.SAFE, blocked: false };
}

function detectCategory(text, skill) {
  if (skill) {
    const map = {
      'school-writing': CATEGORIES.SCHOOL,
      'lab-analysis': CATEGORIES.SCHOOL,
      'math-stats': CATEGORIES.SCHOOL,
      'coding': CATEGORIES.CODING,
      'repo-review': CATEGORIES.CODING,
      'github-issue-planning': CATEGORIES.CODING,
      'music-theory': CATEGORIES.MUSIC,
      'score-scanning': CATEGORIES.MUSIC,
      'jazz-generation': CATEGORIES.MUSIC,
      'band-council': CATEGORIES.MUSIC,
      'research-notes': CATEGORIES.RESEARCH,
      'design-polish': CATEGORIES.DESIGN,
      'obsidian-memory': CATEGORIES.MEMORY,
      'email-drafting': CATEGORIES.EMAIL,
      'schedule-planning': CATEGORIES.PLANNING,
      'personal-planning': CATEGORIES.PLANNING,
      'local-computer-action': CATEGORIES.LOCAL_ACTION,
    };
    if (map[skill.id]) return map[skill.id];
  }
  return CATEGORIES.OTHER;
}

function suggestAction(skill, risk) {
  if (!skill) return 'Capture idea in vault for later review';
  if (risk === RISK.HIGH) return 'Requires explicit confirmation before any action';
  const actions = {
    'school-writing': 'Draft a text note and save to vault',
    'lab-analysis': 'Write a research or lab note in vault',
    'math-stats': 'Draft computation or explanation',
    'coding': 'Generate a Cursor prompt for this coding task',
    'repo-review': 'Summarize relevant repository and PR status',
    'github-issue-planning': 'Draft a GitHub issue with goal and acceptance criteria',
    'music-theory': 'Draft a theory explanation or analysis note',
    'score-scanning': 'Generate a Cursor prompt for Score Scanner task',
    'jazz-generation': 'Generate a Cursor prompt for JazzBackend task',
    'band-council': 'Draft a Band Council agenda or communication note',
    'research-notes': 'Write a research note in vault',
    'design-polish': 'Generate a Cursor prompt for UI/design improvement',
    'obsidian-memory': 'Save directly to Obsidian vault',
    'email-drafting': 'Create a Gmail draft (requires confirmation, never auto-sends)',
    'schedule-planning': 'Draft a schedule or plan note',
    'personal-planning': 'Draft a personal goal or strategy note',
    'local-computer-action': 'Submit action request to local agent with confirmation',
  };
  return actions[skill.id] || 'Save idea to vault for manual review';
}

/**
 * Classify an idea text and return structured metadata.
 *
 * This is a deterministic rule-based classifier.
 * AI-powered classification can be layered on top in a future PR.
 */
export function classifyIdea(text, { tags = [], source = 'manual' } = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Idea text is required for classification.');
  }

  const skill = matchSkill(text);
  const { risk, blocked } = detectRisk(text);
  const category = detectCategory(text, skill);
  const suggestedAction = suggestAction(skill, risk);
  const confirmationRequired = risk !== RISK.SAFE;

  return {
    category,
    skill: skill ? skill.id : null,
    skillDisplayName: skill ? skill.displayName : null,
    riskLevel: risk,
    blocked,
    suggestedAction,
    confirmationRequired,
    classifierVersion: 'deterministic-v1',
  };
}
