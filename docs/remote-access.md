# Remote Access

The local agent binds to localhost by default. Public internet exposure is forbidden.

Tailscale is an optional future transport, not an implemented connection. Before enabling it, define:

- a Tailscale ACL restricted to the user's devices;
- TLS or a reviewed reverse-proxy path;
- local-token storage and rotation;
- origin policy and browser-to-agent authentication;
- request logging without content/secrets;
- a kill switch and recovery steps.

Setting `ALLOW_TAILSCALE_BIND=true` only removes the local bind guard; it does not make the deployment secure. The dashboard must continue to say `not connected` until a live authenticated status check succeeds.
