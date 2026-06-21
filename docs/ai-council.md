# CopelandOS AI Council

The AI council is a multi-perspective review system for complex or high-risk tasks. Instead of a single AI model making all decisions, the council assigns multiple specialist roles, each analyzing the task from a different angle. The results are merged into a consensus recommendation with explicit disagreements, risks, and a final plan.

## When the council activates

- Task text exceeds 200 characters
- Task is classified as high risk
- Task contains security-sensitive keywords (auth, CORS, token, secret, deploy)
- Task explicitly requests council mode
- Simple, safe, short tasks skip the council for efficiency

## Council roles (`config/planning-roles.json`)

| Role | Responsibility |
|---|---|
| Planner | Decomposes goals into steps, identifies dependencies |
| Researcher | Finds prior work, documentation, and evidence |
| Coder | Proposes implementation, identifies files, specifies tests |
| Critic | Challenges assumptions, finds edge cases and flaws |
| Security Reviewer | Reviews for security risks, permission violations, unsafe patterns |
| Designer | Reviews UI/UX, visual hierarchy, mobile layout, accessibility |
| Summarizer | Synthesizes council output into a concise recommendation |
| Final Judge | Makes the final call, states what is approved vs blocked |

## Role selection rules

```text
simple          → [Planner]
complex         → [Planner, Researcher, Coder, Critic, Summarizer, Final Judge]
security        → [Planner, Security Reviewer, Final Judge]
coding          → [Planner, Coder, Critic, Security Reviewer]
research        → [Planner, Researcher, Summarizer]
design          → [Planner, Designer, Critic]
council (full)  → all 8 roles
```

Security Reviewer is always added for security-sensitive tasks regardless of mode.

## Council output format

```json
{
  "consensus": "Consensus: PROCEED with caution. Review all risks.",
  "disagreements": ["Council is split on approach A vs approach B"],
  "risks": ["Input not validated", "Credentials exposure possible"],
  "missingInformation": ["Is this change reversible?", "Have tests been updated?"],
  "recommendedNextAction": "Present plan to human for explicit confirmation.",
  "finalPlan": ["Review council findings", "Address risks", "Implement minimal change", "Verify tests", "Submit for human review"],
  "requiresHumanConfirmation": true
}
```

## Mock mode

The council scaffold runs in mock mode when no AI provider is configured. `createMockCouncilResult()` returns structured stubs that allow tests to verify council behavior without real API calls. Real providers are layered on top via the provider router.

## API

`POST /api/council`
```json
{ "task": "Refactor the permission engine to support role-based access control" }
```

Returns the council prompt, role assignments, mock results (if no provider configured), and the final plan.

## Implementation location

`src/council.js` — All functions are pure and testable without network access.

`config/planning-roles.json` — Role definitions and selection rules.
