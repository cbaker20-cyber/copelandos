# CopelandOS AI Council

## Overview

The AI Council is a multi-role review system for complex or high-stakes tasks. Instead of relying on a single model, the council assigns different perspectives to specialized roles and synthesizes the results into a final plan.

**In this PR:** The council scaffold is implemented in mock/stub-compatible mode. No paid API calls are made. Tests verify behavior. Real AI calls can be layered on top in a future PR by replacing stub results with actual provider calls.

## When Council Mode Activates

Simple tasks skip council and go directly to single-agent mode. Council activates when:

1. Risk level is `high`
2. Complexity score ≥ 3 (keywords: "architecture", "redesign", "migrate", "security", "deploy", "publish", "merge", "multi-step", "investigate", "risky")

## Roles

Defined in `config/planning-roles.json`:

| Role | Always Included | Triggers |
|---|---|---|
| **Planner** | Yes | — |
| **Researcher** | No | research, school, science, evidence, literature |
| **Coder** | No | coding, code, bug, test, implement, refactor |
| **Critic** | No | coding, implementation, architecture, design |
| **Security Reviewer** | No (always for high-risk) | high, deploy, secret, auth, token, permission, shell |
| **Designer** | No | design, ui, ux, css, layout, dashboard, visual |
| **Summarizer** | No | research, long, complex, summarize, explain |
| **Final Judge** | Yes (council mode) | — |

## Functions (`src/council.js`)

```js
createCouncilPrompt(task, roles)       // Top-level council framing prompt
createRolePrompt(roleId, task)         // Role-specific system prompt
mergeCouncilResults(results)           // Merge outputs from all roles
produceFinalPlan(merged, task)         // Final synthesis with consensus/disagreements
detectDisagreements(results)           // Detect opposing recommendations
summarizeTradeoffs(results)            // Concise tradeoff summary
createStubResult(roleId, overrides)    // Mock result for testing
```

## Output Structure

The final council plan includes:

```json
{
  "task": "...",
  "consensus": "Full consensus | Partial consensus with noted disagreements",
  "disagreements": ["role A vs role B: ..."],
  "risks": ["risk 1", "risk 2"],
  "missingInformation": ["what is needed"],
  "recommendedNextAction": "Proceed with ...",
  "finalPlan": "## Final Council Plan\n\n...",
  "producedAt": "2026-06-21T..."
}
```

## Security Reviewer Veto Power

The Security Reviewer role has veto power. If the Security Reviewer recommends "block" while other roles recommend "proceed", this is flagged as a disagreement in `detectDisagreements()` and surfaces prominently in the final plan. The Final Judge must explicitly address this before producing a recommended action.

## Mock / Stub Mode

All council functions are mockable:

```js
const stubResult = createStubResult('coder', {
  recommendation: 'Use async/await',
  risks: ['may miss edge cases'],
});
const merged = mergeCouncilResults([stubResult]);
const plan = produceFinalPlan(merged, 'My task');
```

This allows tests to verify council behavior without any real API calls.

## Integration with Provider Router

When council mode is active, `chooseCouncilProviders(taskProfile, env)` selects which providers to use for each role. Providers are drawn from the `councilPreference` order: OpenRouter → Groq → Cerebras → Gemini.

If fewer than 2 council providers are configured, the system falls back to single-provider mode and notes this in the plan.

## Future Enhancements

- Real multi-provider council calls (OpenRouter Fusion-style)
- Per-role model selection
- Council session history stored in vault
- Streaming council outputs to dashboard
