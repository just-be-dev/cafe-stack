# Dependency patches

Bun applies these patches on install through `patchedDependencies` in `package.json`. Each patch is tied to an exact version. When you upgrade a patched package, check whether upstream fixed the problem. Then either drop the patch or recreate it with `mise run patch <pkg>` and `mise run patch:commit <pkg>`, and update this file.

Every patch needs an entry here. Inside the patched code, mark the change with a `PATCH:` comment.

No patches are active.

## Retired

### Foldkit DevTools MCP reconnect loop under `alchemy dev`

Patched `@foldkit/vite-plugin@0.27.1` and `@foldkit/devtools-mcp@0.24.1`. Under `alchemy dev`, Alchemy's Cloudflare Vite integration forwarded every non-`vite` WebSocket upgrade on Vite's HTTP server to workerd and destroyed the socket Foldkit's relay had already accepted. The MCP client reconnected without backoff, so it looped. The patches moved the relay to a dedicated loopback listener and added backoff after short-lived connections. The Vite patch also called `crypto.randomUUIDv4()` as a method for Effect `4.0.4`.

Dropped on the upgrade to Foldkit `0.170.0`, Effect `4.1.3`, and Alchemy `2.0.0-beta.85`: `@foldkit/vite-plugin@0.29.0` always binds the relay to its own token-protected `127.0.0.1` listener, `@foldkit/devtools-mcp@0.26.0` connects on demand per tool call instead of keeping a reconnect loop, and the relay ID now comes from Effect 4.1's `SecureRandom`. Not yet rechecked with a browser-connected MCP session under `mise run dev`; if the loop comes back, recreate the patch against the new versions.
