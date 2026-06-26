# CopelandOS automation integrations

CopelandOS treats external automation tools as planning and payload-preview targets first. They do not execute webhooks, send messages, modify Drive, deploy, merge, delete, or run shell commands without a separate explicit approval step.

## Added integration slots

- Mimo: learning and tutorial plans only.
- Ornith: placeholder external automation surface until an official API/base URL is configured and probed.
- n8n: webhook/workflow payload previews.
- Make: scenario/webhook payload previews.
- Zapier: Zap/webhook payload previews.
- GitHub Actions: reviewed workflow drafts and CI inspection.
- Google Workspace: Gmail, Calendar, Drive, Docs, Slides, Sheets, Forms, Tasks, and Contacts, with read/draft/propose before write.
- Slack: draft-first team messages and delegation summaries.

## Endpoints

```text
GET  /api/automation/integrations
GET  /api/automation/integrations/:id
POST /api/automation/route
POST /api/hermes/route
```

## Environment variables

```text
MIMO_API_KEY
MIMO_BASE_URL
ORNITH_API_KEY
ORNITH_BASE_URL
N8N_WEBHOOK_URL
N8N_API_KEY
MAKE_WEBHOOK_URL
ZAPIER_WEBHOOK_URL
SLACK_BOT_TOKEN
SLACK_WEBHOOK_URL
GOOGLE_REFRESH_TOKEN
GMAIL_REFRESH_TOKEN
GITHUB_TOKEN
GITHUB_REPO
```

These secrets belong in Cloudflare Worker secrets, not GitHub.

## Safety rules

- No webhook fires without approval.
- No bulk Gmail, Calendar, Slack, Drive, or GitHub actions without approval.
- No secrets are written into the repo.
- Unknown tools such as Ornith remain `placeholder` mode until a connection probe is implemented.
- Mimo is a tutor surface, not a live repo editor.
