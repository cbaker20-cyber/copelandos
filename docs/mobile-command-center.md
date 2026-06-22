# Mobile Command Center

CopelandOS should be usable from an iPhone first: capture an idea in seconds, review the inbox later, and wake up to a clear project status report. The mobile surface is a control panel, not an autonomous execution device.

## Target Architecture

```text
iPhone
  Siri / Shortcut / widget / share sheet
    -> POST /api/capture/idea
    -> CopelandOS inbox
    -> deterministic classifier
    -> planner and role selector
    -> provider router or mock council
    -> tool/MCP allowlist check
    -> Obsidian Git vault preview/write
    -> Cursor or Codex prompt
    -> draft PR
    -> morning report
```

## Current Foundation

- `POST /api/capture/idea` captures an idea with `text`, `source`, `tags`, `project`, and `urgency`.
- `GET /api/ideas` lists captured ideas for triage.
- `src/ideaClassifier.js` assigns category, skill, risk, and suggested action.
- `POST /api/ideas/:id/cursor-prompt` and `POST /api/ideas/:id/codex-prompt` generate scoped prompts.
- The dashboard is responsive and has push-to-talk input where supported by the browser.
- `GET /api/integrations/control-loop` exposes the intended phone-to-report loop.

## iPhone Shortcut

Shortcut name: `Capture Idea`

Recommended actions:

1. `Dictate Text` or `Ask for Input`.
2. Optional: `Choose from Menu` for project: CopelandOS, Score Scanner, JazzBackend, Band Council, Connectome, Other.
3. `Get Contents of URL`.
4. URL: `https://<worker-host>/api/capture/idea`.
5. Method: `POST`.
6. Header: `Content-Type: application/json`.
7. JSON body:

```json
{
  "text": "[Shortcut Input]",
  "source": "siri",
  "tags": ["mobile"],
  "project": "copelandos",
  "urgency": "medium"
}
```

The Shortcut should show only a confirmation such as `Captured for review`. It should not execute a command, open a shell, send email, merge a PR, or deploy.

## Share Sheet Flow

Future native or PWA share-sheet flow:

1. User shares text, URL, or selected paragraph.
2. CopelandOS prepares a capture draft.
3. User confirms project and tags.
4. App posts to `/api/capture/idea`.
5. App shows risk and next suggested action returned by the classifier.

URLs should be stored as context, not fetched automatically unless routed through a read-only web tool with an allowlist and audit log.

## Widget / App Intent Flow

Apple App Intents can power Shortcuts, Siri, Spotlight, and interactive widget/snippet surfaces. Apple describes snippets as compact views returned by App Intents and widget interactions as App Intent-driven actions in the system UI.

Useful references:

- Apple WWDC session on interactive snippets: https://developer.apple.com/videos/play/wwdc2025/281/
- Apple `ShowsSnippetView` docs: https://developer.apple.com/documentation/appintents/showssnippetview
- App Intents overview article with widget/shortcut context: https://swiftcrafted.dev/article/app-intents-from-first-principles-interactive-widgets-snippets-siri-shortcuts-ios-26

Future widget cards:

- `Capture`: one-tap dictation or text entry.
- `Inbox`: count of untriaged ideas.
- `Morning`: top projects, blockers, draft PRs, and tests.
- `Safe Route`: provider/router status without API keys displayed.

## Mobile Dashboard Polish

The mobile dashboard should prioritize:

- One-handed idea capture.
- Honest status badges.
- Large tap targets.
- A command palette that remains optional.
- A control-loop view showing where work is blocked.
- No decorative assets that imply unsafe autonomous control.

## Privacy And Safety

- Do not store private student data.
- Do not store tokens in Shortcuts bodies.
- Keep `ALLOWED_ORIGIN` exact; CORS is not authentication.
- Treat captured URLs and text as untrusted input.
- Gmail remains draft-only.
- GitHub status remains read-only until a scoped connector is implemented.
- Local actions require the local-agent allowlist and confirmation.

## Acceptance Checks

- Capturing from mobile creates an inbox item with `source: "siri"` or `source: "shortcuts"`.
- The dashboard shows the item without a desktop-only layout.
- The classifier marks high-risk language as confirmation-required.
- The integration panel does not show external services as connected unless the Worker can prove it.
