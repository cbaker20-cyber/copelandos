# CopelandOS AI Brain

The AI brain is the planning and coordination layer that sits between raw idea capture and concrete action. It classifies incoming ideas, selects appropriate skills, decides whether council mode is needed, routes to the best available AI provider, and generates structured Cursor or Codex prompts.

## Architecture

```text
Phone / Siri / Shortcuts / Mobile web
  └─ POST /api/capture/idea
       ├─ Input validation and sanitization
       ├─ Idea classifier (deterministic rules → AI layer later)
       │    ├─ Category detection
       │    ├─ Skill selection
       │    ├─ Risk level assessment
       │    └─ Suggested action generation
       ├─ Idea stored in inbox (Map / KV in production)
       └─ Returns classified idea with confirmationRequired flag

Idea inbox (/api/ideas)
  └─ Triage (/api/ideas/:id/triage)
       └─ Planner (src/planner.js)
            ├─ classifyTask → skill → council mode decision → roles
            ├─ createPlan → steps, warnings, human confirmation flag
            ├─ Simple tasks → single planner
            └─ Complex/high-risk tasks → AI council

Provider router (src/providerRouter.js)
  └─ Chooses best configured provider for task type
       ├─ Free-tier first: Groq, Cerebras, Gemini, OpenRouter
       ├─ Paid fallback: Anthropic, OpenAI
       └─ Always-available local: Ollama

Output
  ├─ Cursor prompt (/api/ideas/:id/cursor-prompt)
  ├─ Codex prompt (/api/ideas/:id/codex-prompt)
  ├─ Vault note (/api/ideas/:id/convert)
  └─ AI council result (/api/council)
```

## Modules

### `src/ideaClassifier.js`

Deterministic rule-based classifier. Uses keyword matching and regex patterns to:
- Detect category (coding, music, school, research, email, planning, memory, design, github, local-action, general)
- Detect risk level (safe, medium, high)
- Select a skill from `config/skills.json`
- Generate a suggested action
- Flag `confirmationRequired` for medium and high risk

AI classification can be added later by calling `/api/ai` with the classifier output as context.

### `src/skills.js`

Registry wrapper around `config/skills.json`. Provides keyword-based skill matching and public skill summaries.

### `src/planner.js`

Implements the planning layer:
- `classifyTask(input)` — wraps the classifier
- `chooseSkill(task)` — returns the matched skill
- `chooseCouncilMode(task)` — decides whether to use single-planner or full council
- `selectRoles(task)` — picks planning roles based on task type
- `createPlan(task)` — builds a structured plan with steps and warnings
- `createTaskBrief(task)` — returns a concise summary
- `createCursorPrompt({ idea, project, task })` — generates a Cursor implementation prompt
- `createCodexPrompt({ idea, project, task })` — generates a Codex architecture prompt

### `src/council.js`

AI council scaffold:
- `createCouncilPrompt(task, roles)` — builds the full council system prompt
- `createRolePrompt(roleId, task)` — builds a role-specific prompt
- `mergeCouncilResults(results)` — synthesizes multiple role outputs
- `detectDisagreements(results)` — finds contradictory recommendations
- `summarizeTradeoffs(results)` — produces a concise tradeoff summary
- `produceFinalPlan(results, task)` — generates the final actionable plan
- `createMockCouncilResult(roleId, task)` — stub for testing without real AI

## Council mode rules

| Task type | Uses council |
|---|---|
| Simple, safe, < 120 chars | No |
| Complex, > 200 chars | Yes |
| High risk | Yes |
| Security-sensitive | Yes (includes Security Reviewer) |
| UI/design | Optional (includes Designer) |
| Coding | No (Coder + Critic + Security Reviewer) |
| Research | No (Planner + Researcher + Summarizer) |

## Skill registry

See `config/skills.json` for the full skill list. Key skills:
- `school-writing` — essays, reports (safe)
- `lab-analysis` — science labs (safe)
- `coding` — implementation (safe → Cursor prompt)
- `email-drafting` — draft only, never send (medium)
- `band-council` — privacy caution (medium)
- `local-computer-action` — requires confirmation (high)

## Safety rules

- High-risk actions are never executed automatically
- Medium-risk actions require explicit human confirmation
- Email is draft-only; sending is permanently blocked
- Private student data is blocked from vault writes
- Deploys, merges, deletes, and shell execution are blocked
