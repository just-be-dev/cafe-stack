# Effect / Cloudflare / Foldkit

A runnable starter. Read `README.md` and `docs/`, replace the sample service and UI, and add the product's own layout, API, and invariants.

`src/model.ts` and `src/service.ts` hold the sample Schema and service. `src/api.ts` defines the health route. `src/platform/cloudflare/{stack,api,edge}.ts` declare resources, host the API, and forward Website requests. `src/ui/entry.ts` boots the counter defined in `src/ui/main.ts`. D1, Durable Objects, and AI can be added when the product needs them.

## Ownership and scope

- Keep small apps flat under `src/`. As responsibilities emerge, group business code by domain under `src/<domain>/`, keeping models, validation, operations, and capability contracts together.
- Platform-independent HTTP starts in `src/api.ts`. Handlers decode input, call a complete application operation, and encode the response. Move routes into `src/http/` when they need their own modules.
- Cloudflare SDKs, native globals, storage adapters, entry points, identity extraction, bindings, and deployment config go in `src/platform/cloudflare/`. Domain code never imports them.
- Platform imports domain, never the reverse. Keep `src/platform/boundary.test.ts` passing and extend it when adding platform SDKs or aliases.
- UI lives in `src/ui/` and follows its `AGENTS.md`. The `@/` alias maps to `src/ui/`.
- Split by responsibility and lifetime, not line count. Add abstractions at real boundaries. Refactor structure and change behavior in separate steps.
- Keep public schemas, storage keys, callback names and payloads, and replay journal names compatible unless a migration changes them explicitly.

## Effect

- Before writing Effect code, run `mise run effect-solutions list`, then `mise run effect-solutions show <topic>` for the patterns you need. Check examples against the installed Effect 4 APIs.
- Import modules directly, e.g. `import * as Effect from "effect/Effect"`.
- Write new Worker and Durable Object code in Effect. Wrap Promise SDKs at the platform boundary with `Effect.tryPromise` and a typed error.
- Decode HTTP bodies and params, stored values, remote responses, configuration, and model output with Schema. Decide what happens when stored data no longer decodes.
- Model expected failures with `Schema.TaggedError` and name operations with `Effect.fn("Module.operation")`.
- Services describe capabilities; layers build implementations. Capture runtime dependencies at the request or instance lifetime so public operations expose only portable requirements.
- Authorization, write ordering, transactions, and partial-failure policy belong to the application operation. Memory and production adapters share the same business validation.
- Use brands for IDs and discriminated unions for states. For replay, keep execution state separate from the records shown to users.
- Recognize errors crossing Durable Object RPC by their structural fields, not `instanceof`.

## Alchemy v2 and Cloudflare

- Use Alchemy v2's Effect API. `node_modules/alchemy/src` is the final reference; docs start at https://alchemy.run/llms.txt.
- A Worker or Durable Object's outer Effect runs at plan time and cold start: declare and acquire bindings there. Storage, raw bindings, callbacks, and identity are usable only in the returned instance or request handler.
- Never load `cloudflare:*` at module top level on a path imported at plan time.
- The Website edge only forwards requests. The API Worker is public on its workers.dev URL and also reached through the Website's service binding; both paths hit the same routes.
- Both Workers are public. Add identity and authorization, covering both entry points, before exposing protected operations.
- Keep Workers Observability logs and traces on both Workers, and keep `Cloudflare.Telemetry` on Effect-native hosts so `Effect.withSpan` and `Effect.fn` spans reach Cloudflare. Compatibility dates must be `2026-07-28` or later. Tune sampling for volume, and never attach secrets or payloads to telemetry.
- Callbacks are delivered at least once. Make side effects and scheduled jobs idempotent, and test crash and retry behavior.
- Use checkout-local Alchemy state in dev and Cloudflare-hosted state for deployed stages. Never commit local state or credentials.
- Never edit an applied D1 migration; add the next numbered one.

## Verify before finishing

From the repo root:

```sh
mise run check
```

- Run `mise run build` for UI or build changes. It's a local check, not a deploy.
- Tests use Vitest with imports from `@effect/vitest` next to the code they cover. Use `it.effect` for Effect tests with automatic scoping and test services, `it.live` when real time is required, and plain `it` for synchronous or Promise tests.
- Use memory services for application tests. Native Worker, Durable Object, D1, identity, and AI behavior needs local end-to-end checks with `mise run dev` and the URL it prints.
- Test both sides of boundaries, plus failure, retry, and concurrency cases that would catch a plausible bug. Memory tests don't prove native transactional guarantees.
- UI tests use Foldkit Story and Scene. Render and look at affected visual states before calling visual changes done; DOM and accessibility checks are enough for interaction-only changes.
- For template maintenance, also check the frozen install, doc links, config parsing, native API smoke tests, and publication status. A passing UI build is not a deployment.

## Dependencies and operational safety

- Keep Foldkit, `@foldkit/*`, Vite, and `@effect/platform-*` exactly pinned. Upgrade compatible versions together and refresh the UI conventions from the installed Foldkit tag.
- Patch dependencies only with `mise run patch` and `mise run patch:commit`, and document the symptom, cause, fix, and removal criteria in `patches/README.md`. Recheck patches on every upgrade.
- Never commit secrets, tokens, `.env` files, `.alchemy/`, `.wrangler/`, `node_modules/`, or build output. `private: true` blocks npm publishing; GitHub visibility is set separately.
- When the user shares a local URL, start with read-only API calls. Mutating requests, AI prompts, job starts, and migrations can change data or cost money.
- Get explicit approval before deploying or destroying, running dev against a deployed stage, migrating shared databases, restarting production, changing access controls, pushing, publishing, or opening or merging PRs. Local disposable tests are fine.
- Preserve existing user work. Report exactly what was verified and whether the work is local, committed, pushed, or deployed.
