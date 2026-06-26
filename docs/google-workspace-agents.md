# CopelandOS Google Workspace agents

CopelandOS should use one Google Cloud OAuth application and route the granted access into separate internal agents. The agents stay separate even when the OAuth app is shared.

## OAuth app

Use one Google Cloud project and one OAuth client for the Worker.

Authorized redirect URI:

```text
https://copelandos.copelandbaker20.workers.dev/api/auth/callback
```

Worker secrets:

```text
GMAIL_CLIENT_ID or GOOGLE_CLIENT_ID
GMAIL_CLIENT_SECRET or GOOGLE_CLIENT_SECRET
GMAIL_REFRESH_TOKEN or GOOGLE_REFRESH_TOKEN
```

The current Worker implements Gmail draft auth through `/api/auth/gmail`. The broader Google auth route should be added only when Gmail, Calendar, and Drive write actions are all routed through the permission system.

## Agent boundaries

### Gmail agent

Allowed now:

- list/read inbox after OAuth is configured
- create drafts for review
- label/archive messages after explicit approval

Blocked by default:

- sending email without explicit user approval
- trash/delete without explicit user approval
- bulk operations without a clear query and confirmation

Recommended scopes:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.modify
```

### Calendar agent

Allowed first:

- read schedule
- find availability
- propose events

Write actions require approval:

- create event
- update event
- delete event
- respond to invitations

Recommended scopes:

```text
https://www.googleapis.com/auth/calendar.events.readonly
https://www.googleapis.com/auth/calendar.events
```

### Drive agent

Allowed first:

- search/list files
- propose folder organization
- detect duplicates or clutter

Write actions require approval:

- move files
- rename files
- create folders
- change sharing
- trash/delete files

Recommended starting scope:

```text
https://www.googleapis.com/auth/drive.metadata.readonly
```

Escalate only when needed:

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive
```

## Safety model

- Request the narrowest scopes first.
- Prefer incremental authorization.
- Store refresh tokens only as Cloudflare Worker secrets.
- Never put OAuth client secrets, refresh tokens, or `.dev.vars` in GitHub.
- Keep Gmail send, Calendar edits, and Drive moves behind explicit confirmation.
- Use dry-run previews for bulk Gmail/Drive operations before applying changes.
