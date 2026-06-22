// Deterministic rule-based idea classifier.
// Uses keyword matching and pattern detection to assign categories, skills,
// risk levels, and suggested actions. AI classification can be layered on top
// later by replacing or augmenting the classify() function.

import { findSkillByKeyword, getSkill } from './skills.js';

const HIGH_RISK_PATTERNS = [
  /\bdeploy\b/i,
  /\bpublish\b/i,
  /\bmerge\s+pr\b/i,
  /\bdelete\b/i,
  /\bdelete\s+repo\b/i,
  /\binstall\b/i,
  /\buninstall\b/i,
  /\bformat\b/i,
  /\bwipe\b/i,
  /\broot\b/i,
  /\bsudo\b/i,
  /\barbitrary\s+shell\b/i,
  /\bcontrol\s+(screen|mouse|keyboard)\b/i,
  /\bsend\s+email\b/i,
  /\bforce\s+push\b/i,
];

const MEDIUM_RISK_PATTERNS = [
  /\bcreate\s+(issue|pr|pull\s+request)\b/i,
  /\bdraft\s+email\b/i,
  /\bwrite\s+(to|an?)\s+email\b/i,
  /\bemail\s+\w+\b/i,
  /\bband\s+council\b/i,
  /\bagenda\b/i,
  /\bmeeting\s+notes?\b/i,
  /\bschedule\s+meeting\b/i,
  /\bopen\s+(cursor|vscode|terminal)\b/i,
  /\blaunch\b/i,
  /\bstart\s+cursor\b/i,
];

const CATEGORY_PATTERNS = [
  { category: 'coding', patterns: [/\b(code|fix|bug|implement|function|class|test|build|debug|script|algorithm|refactor)\b/i] },
  { category: 'music', patterns: [/\b(music|chord|jazz|score|midi|musicxml|theory|rhythm|harmony|scale|band|piano|violin)\b/i] },
  { category: 'school', patterns: [/\b(essay|homework|assignment|lab|class|course|grade|ap |test|exam|study|report|biology|chemistry|calculus|english)\b/i] },
  { category: 'research', patterns: [/\b(research|paper|literature|study|connectome|neuroscience|evidence|journal|source|citation)\b/i] },
  { category: 'email', patterns: [/\b(email|message|draft|send|compose|reply|welgoss|nhs|teacher|professor)\b/i] },
  { category: 'planning', patterns: [/\b(plan|schedule|calendar|deadline|internship|scholarship|goal|roadmap|timeline|milestone)\b/i] },
  { category: 'memory', patterns: [/\b(remember|note|save|obsidian|vault|journal|log|capture|record)\b/i] },
  { category: 'design', patterns: [/\b(design|ui|ux|css|style|layout|visual|dashboard|polish|color|typography)\b/i] },
  { category: 'github', patterns: [/\b(github|issue|pr|pull request|repo|branch|commit|merge|review)\b/i] },
  { category: 'local-action', patterns: [/\b(open|launch|start|run|execute|cursor|vscode|terminal|pc|computer|local agent)\b/i] },
];

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(lower))) return category;
  }
  return 'general';
}

function detectRiskLevel(text) {
  if (HIGH_RISK_PATTERNS.some(p => p.test(text))) return 'high';
  if (MEDIUM_RISK_PATTERNS.some(p => p.test(text))) return 'medium';
  return 'safe';
}

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function buildSuggestedAction(skill, riskLevel, category) {
  if (riskLevel === 'high') {
    return 'Flag for human review. High-risk action detected — do not execute automatically.';
  }
  if (!skill) {
    return 'Review manually and assign a skill before planning.';
  }
  switch (skill.outputType) {
    case 'cursor-prompt':
      return `Generate a Cursor task prompt for the ${skill.displayName} skill.`;
    case 'codex-prompt':
      return `Generate a Codex implementation prompt for the ${skill.displayName} skill.`;
    case 'email-draft':
      return 'Draft email for human review. Do not send automatically.';
    case 'vault-note':
      return 'Save to Obsidian vault as a memory note.';
    case 'plan':
      return `Create a structured plan using the ${skill.displayName} skill.`;
    case 'note':
      return `Create a research or knowledge note for ${skill.displayName}.`;
    case 'draft':
      return `Create a draft document for ${skill.displayName} — human review required.`;
    case 'local-action':
      return 'Request local agent action — confirmation required.';
    default:
      return `Process with ${skill.displayName} skill.`;
  }
}

export function classify(text) {
  const category = detectCategory(text);
  const riskLevel = detectRiskLevel(text);
  const keywords = extractKeywords(text);
  const skill = findSkillByKeyword(keywords);
  const confirmationRequired = riskLevel !== 'safe' || (skill && skill.confirmationRequired);
  const suggestedAction = buildSuggestedAction(skill, riskLevel, category);

  return {
    category,
    skill: skill ? skill.id : null,
    skillDetail: skill || null,
    riskLevel,
    confirmationRequired: Boolean(confirmationRequired),
    suggestedAction,
    keywords: keywords.slice(0, 10),
    classifiedBy: 'deterministic-rules',
  };
}

// Skill-specific classification examples documented in tests:
// "email Mr. Welgoss about NHS" → email-drafting, medium, draft-only
// "fix JazzBackend rhythm tests" → coding, safe/medium, Cursor prompt
// "remember catalase lab analysis" → lab-analysis, safe
// "make Band Council agenda" → band-council, medium, privacy caution
// "deploy this to Cloudflare" → high risk, confirmation_required
// "delete files" → high risk, confirmation_required

export function classifyWithContext(text, { project, tags = [] } = {}) {
  const base = classify(text);
  const safeTags = Array.isArray(tags) ? tags : [];
  // Project-specific overrides
  if (project === 'band-council-agent' && base.riskLevel === 'safe') {
    base.riskLevel = 'medium';
    base.confirmationRequired = true;
    base.suggestedAction = 'Band Council task: privacy caution. Human review required.';
  }
  if (project === 'copelandos' || safeTags.includes('security')) {
    if (base.riskLevel === 'safe' && base.category === 'coding') {
      base.suggestedAction += ' Apply CopelandOS security-first rules.';
    }
  }
  return base;
}
