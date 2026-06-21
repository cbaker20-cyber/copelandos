# CopelandOS Local Windows Agent

This optional Node service is a narrow, permissioned bridge to one Windows PC. It is not a remote desktop tool and does not accept arbitrary shell commands.

## v1 capabilities

- Read basic system status.
- Open an allowlisted URL or Obsidian URI.
- Open an allowlisted project folder.
- Start explicitly configured Cursor or VS Code tunnel executables.
- Run an exact test command defined in `allowlist.json`.
- Write a new note inside an explicitly configured local vault.
- Return Git status for allowlisted repositories.

It cannot delete files, send email, merge PRs, deploy, install software, change secrets, run arbitrary commands, inspect all documents, type/click arbitrary applications, or take screenshots.

## Setup

1. Copy `allowlist.json` and replace placeholder paths. Enable only entries you intend to use.
2. Set a long random local token outside the repository:

   ```powershell
   $env:LOCAL_AGENT_TOKEN = '<at-least-24-random-characters>'
   $env:LOCAL_AGENT_ALLOWED_ORIGIN = 'http://127.0.0.1:8787'
   npm run local-agent
   ```

3. The service binds to `127.0.0.1:43120` by default.

Medium-risk actions require `"confirmed": true` and must still match the allowlist. High-risk actions always return `confirmation_required` and are never executed.

## Optional Tailscale

Tailscale is documentation-only in v1. Do not expose the local agent to the public internet. A non-local bind is rejected unless `ALLOW_TAILSCALE_BIND=true`; using that override still requires a reviewed firewall, Tailscale ACL, HTTPS/reverse-proxy plan, and token handling design.
