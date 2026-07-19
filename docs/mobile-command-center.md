# Mobile Command Center

CopelandOS is phone-first for capture and review, not autonomous execution. The mobile surface should make it easy to capture intent and inspect status while preserving the same Worker safety model as the desktop dashboard.

## Supported today

- `POST /api/capture/idea` for dashboard and authenticated clients.
- `GET /api/capture/idea?...` for Apple Shortcuts-style capture when the configured capture token is supplied.
- `GET /api/ideas`, `GET /api/project-queue`, and planner/prompt routes for review workflows.
- `GET /api/integrations/control-loop` for a read-only map of the overnight loop.

## Future mobile surfaces

- Home Screen PWA shortcut for the dashboard.
- iOS Shortcut for dictated idea capture.
- Share sheet action that posts text into the inbox.
- Morning report view that reads the control-loop status and project queue.

## Safety rules

- Mobile capture only enqueues ideas. It does not execute tasks.
- A shortcut token is a capture credential, not general API authentication.
- Email can only become a draft, never a send.
- No deploy, merge, shell, delete, screen-control, or unreviewed MCP install actions are part of the mobile path.
