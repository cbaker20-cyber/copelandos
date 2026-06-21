# Local Agent Protocol

## Transport

- Default base URL: `http://127.0.0.1:43120`.
- Authentication: `Authorization: Bearer <LOCAL_AGENT_TOKEN>`.
- Optional browser origin must exactly match `LOCAL_AGENT_ALLOWED_ORIGIN`.
- Request bodies are limited to 64 KiB.

## Routes

### `GET /v1/status`

Returns basic OS status after token authentication.

### `POST /v1/action`

```json
{
  "action": "run_approved_test",
  "confirmed": true,
  "payload": { "repoId": "copelandos", "testId": "node-tests" }
}
```

MEDIUM actions without confirmation return HTTP 409. HIGH or non-allowlisted actions never execute.

## Allowlist

`local-agent/allowlist.json` controls URL origins, repository paths, exact command/argument arrays, executable paths, and the local vault root. It contains placeholders by default so no personal paths are published.

## Non-goals

No arbitrary shell, filesystem browser, email delivery, GitHub merge/deploy, software installation, credential management, arbitrary UI input, or screenshot capture.
