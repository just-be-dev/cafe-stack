# Guardrails

| Concern               | Rule                                                                         | How it's checked                                                        |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Platform isolation    | Domains and HTTP don't import Cloudflare or Alchemy                          | `src/platform/boundary.test.ts`; extend it for new imports and globals  |
| Untrusted data        | Schema-decode bodies, params, storage, remote output, config, AI answers     | Malformed-input tests                                                   |
| Effect errors         | Typed expected failures; map errors structurally across RPC                  | `Schema.TaggedError`, failure tests, lint rules                         |
| Request lifetime      | Identity belongs to one request; locks to the instance they protect          | Concurrency and request-isolation tests, native smoke checks            |
| Use-case ownership    | The application operation owns authorization, writes, partial success, retry | Fail after each required write and assert what's left                   |
| Durable behavior      | At-least-once delivery, deterministic replay, idempotent side effects        | Crash, retry, and replay tests on the real host                         |
| Storage compatibility | Append migrations; keep stored contracts or migrate them explicitly          | Upgrade and old-data tests                                              |
| UI architecture       | Schema Model, fact-like Messages, pure update/view, effects in Commands      | Foldkit lint rules in `src/ui/`, Story and Scene tests                  |
| Dependencies          | Exact pins, reviewed patches and lockfile                                    | Frozen install, typecheck, lint, tests, build, documented patch removal |
| Operations            | No deploys, production writes, or publishing without approval                | Agent instructions and human sign-off                                   |

## Security

- The API is public on its workers.dev URL and through the Website. Add verified identity and authorization that covers both before exposing protected data.
- Keep the persisted Worker logs and traces and the API's `Cloudflare.Telemetry` layer. Tune sampling and retention for your traffic. Never put secrets, auth headers, payloads, or personal data in logs or spans.
- Cap API request bodies (32 KB is a sensible default) and return errors as `{ "error": string }`. Test both sides of the limit.
- If the app accepts outbound URLs, guard against SSRF both when validating and right before sending: HTTPS only, no embedded credentials, no private or loopback destinations, and a clear policy for redirects and DNS.
- Don't forward credentials or tracing headers to external hosts. Keep secrets out of business models, prompts, and workflow definitions.
- Serve fonts and scripts from your own origin. Start from the CSP in `public/_headers` and loosen it only for resources you actually load. `style-src 'unsafe-inline'` is a candidate for tightening.
- Keep secrets in runtime bindings or configuration. `.gitignore` covers `.env`, `.dev.vars`, local Alchemy and Wrangler state, dependencies, and build output.
- If an integration is simulated, label the results as simulated.

## Verification

```sh
mise run check
mise run build  # for UI or bundling changes; touches no infrastructure
```

Put `*.test.ts` files next to the code they cover and import test helpers from `@effect/vitest`. Use `it.effect` for Effect programs: it supplies test services and automatically closes the test's scope. Use `it.live` for Effects that need real time, and plain `it` for synchronous or Promise tests. Use memory implementations with scripted external services. Pick test inputs that a plausible wrong implementation would fail: both sides of a limit, asymmetric values, interrupted writes, duplicate delivery, stale replies, overlapping reports. Work out expected results independently of the code.

`mise run test` runs the suite once; `mise run test:watch` watches for changes. To target a file or test name, run `bun run test src/api.test.ts` or `bun run test -t "health"`. The [Effect testing guide](https://www.effect.solutions/testing) explains test clocks, layers, and scoped resources; check its APIs against the installed packages.

Foldkit Story tests send Messages through update. Scene tests drive the view through accessible locators. Put page-owned behavior in page-level tests and routing or parent-child communication in root tests. For visual changes, also open the app in a browser and look at the affected states.

Run native checks under `mise run dev` against the Website URL it prints. Start with GET endpoints and assert on both the status and the decoded body. Mutating calls can change data, schedule jobs, call paid AI, or reach other systems, so use throwaway local data and approved destinations. Native transactions, callback delivery, real AI calls, and telemetry ingestion all need checks beyond memory tests; confirm logs and traces in the Cloudflare dashboard after an approved deploy.

When reporting, list what you couldn't verify (expired credentials, untested model calls, missing auth coverage) and say whether changes are local, committed, pushed, or deployed.

## Approvals

Refactor without changing behavior first, verify, then change behavior in a separate step. Leave the user's work and unrelated fixes alone.

Get explicit approval before deploying or destroying, running dev against a deployed stage, writing to or migrating a shared database, restarting production, changing access controls, pushing, opening PRs, or publishing. Keep deploys and shared-state migrations out of install hooks and CI checks.
