# Effect · Cloudflare · Foldkit template

A starter for TypeScript apps on Cloudflare, built with Effect 4, Foldkit, Bun, mise, and Alchemy v2.

It comes with a Foldkit page (a counter and a typed RPC call), a small Effect service, a `GET /api/health` route, a typed Effect RPC endpoint at `POST /api/rpc`, and an Alchemy stack with two Workers: a Website that serves the UI and an API. Both Workers send logs and traces to Workers Observability, and the API's Effect spans show up in Cloudflare's trace view.

```sh
mise trust && mise install
mise run check
mise run build
mise run test:e2e:install && mise run test:e2e   # browser tests
mise run dev
```

`mise run dev` prints a Website URL. The UI is served there, and `/api/*` is forwarded to the API Worker, which also has its own workers.dev URL. `GET /api/health` returns `{ "name": "Project starter", "status": "ok" }`. `POST /api/rpc` serves the `AppRpcs` group from `src/rpc.ts`, which the UI calls through a typed client. Unknown API routes return a JSON 404.

## Layout

```text
alchemy.run.ts                   re-exports the platform stack
src/
  model.ts / service.ts          portable Schema and Effect service
  rpc.ts / rpc.test.ts           shared RPC contract; client-server tests
  api.ts / api.test.ts           routes, RPC request bounds, HTTP tests
  platform/
    boundary.test.ts             keeps platform imports out of domain code
    cloudflare/{stack,api,edge}.ts  resources, API Worker, forwarding edge
  ui/
    entry.ts                     runtime boot, provides the RPC client
    api.ts / api.test.ts         typed RPC client and Command tests
    main.ts                      Model, Messages, Commands, update, view
    styles.css                   light/dark Tailwind theme
    components/ui/               foldcn badge, bubble, button, empty,
                                 input, message, and textarea
    lib/utils.ts                 `cn` class helper
    story.test.ts / scene.test.ts  update and view tests
    AGENTS.md                    Foldkit conventions
e2e/
  *.spec.ts                      Playwright and axe tests of the built UI
  api.ts                         serves the real API routes to the page
  page.ts                        shared page checks (clean boot, CSP, focus)
```

Root files configure Bun, mise, Node.js, TypeScript (checked by tsrs), Zed and Neovim language servers, Vite, Vitest with `@effect/vitest`, Playwright, Oxlint/Oxfmt, foldcn, the Foldkit DevTools MCP server, and dependency patches.

GitHub Actions (`.github/workflows/ci.yml`) runs `mise run check` and `mise run build` on pushes to `main` and on pull requests, then the Playwright suite in Chromium and WebKit in a separate `browser` job. It doesn't deploy and needs no secrets. The browser tests serve the UI with `vite preview` and answer `/api/*` with the real routes in the test process, so native Worker, D1, Durable Object, and AI behavior still needs checks under `mise run dev`.

## Starting a new project

1. Click **Use this template → Create a new repository** and pick the new repository's visibility.
2. Decide on the product's domain names, who owns which data, how users authenticate, and whether you need D1, Durable Objects, or AI.
3. Rename things: `name` in `package.json`, the `project-starter` stack name in `src/platform/cloudflare/stack.ts`, the app name in `src/platform/cloudflare/api.ts`, and the page title, description, theme colors, and content in `index.html` and `src/ui/`, plus `public/favicon.svg`. Resource names stick once deployed, so settle them before the first deploy.
4. Run `mise trust && mise install`. It installs Bun, Node.js for Vitest, and the locked dependencies. Commit `bun.lock`. Read the [tooling guide](docs/tooling.md) before upgrading dependencies.
5. Replace the sample service and counter with your first real feature. Keep Cloudflare code in `src/platform/cloudflare/` and runtime boot in `src/ui/entry.ts`.
6. Add your product's invariants to `AGENTS.md`, rewrite this README, and run the [checks](docs/guardrails.md).

A prompt for an agent: "Read AGENTS.md and docs/. Adapt this starter for an application that does [product description]. Keep the stack and boundaries. Build one useful vertical slice and verify it locally. Do not deploy."

## Deploying

Set up a Cloudflare profile with `mise run cloudflare:profile`, or point `ALCHEMY_PROFILE` at an existing one. `mise run deploy` deploys the `prod` stage. The first deploy may offer to create Cloudflare-hosted Alchemy state.

Both Workers are public. The API answers on its workers.dev URL and through the Website's service binding, so any authentication you add has to cover both.

### Environment variables

All of these are optional. With none set, the stack is named `project-starter`, the app is served from `/`, and there is no custom domain.

| Variable       | Effect                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `PROJECT_NAME` | Names the Alchemy stack. Alchemy keys state and resource names by stack, so give each project its own. |
| `BASE_PATH`    | Serves the app under a path prefix such as `/app/`. It must start and end with `/`.                    |
| `STAGE`        | Set to `prod` to give prod the host below.                                                             |
| `PROJECT_HOST` | The hostname prod claims, such as `cafe.example.com`.                                                  |
| `PROJECT_ZONE` | Cloudflare zone that owns that host, such as `example.com`.                                            |

When `STAGE=prod` and `PROJECT_HOST` and `PROJECT_ZONE` are both set, the Website claims `<host>` as a custom domain and routes `<host><base>*`, and the stack returns `https://<host><base>` as its URL. The route is there because routes outrank custom domains, so a zone-wide wildcard route would otherwise win. projects.just-be.dev sets `PROJECT_HOST` to `<project>.just-be.dev` and `BASE_PATH` to `/`.

Under a base path, UI code must build URLs from `import.meta.env.BASE_URL`, not absolute `/` paths.

## Telemetry

Both Workers persist invocation logs and traces with a sampling rate of `1`, so every request is recorded. The API also provides `Cloudflare.Telemetry({ headSamplingRate: 1, persist: true })`, which exports the `Api.request` span and any `Effect.withSpan` or `Effect.fn` spans to Cloudflare.

After a deploy, request `/api/health` and open **Workers & Pages → App / Api → Observability**. Lower the sampling rates in `stack.ts` and `api.ts` once traffic grows. The [Cloudflare guide](docs/cloudflare.md) has the details.

## Docs

| Guide                                     | Covers                                                  |
| ----------------------------------------- | ------------------------------------------------------- |
| [Organization](docs/organization.md)      | Where code goes as the project grows                    |
| [Architecture](docs/architecture.md)      | Domains, services and layers, lifetimes, transactions   |
| [Tooling](docs/tooling.md)                | Pinned versions, config files, commands, patches, AI    |
| [Cloudflare](docs/cloudflare.md)          | Alchemy phases, Worker topology, telemetry, state, D1   |
| [Guardrails](docs/guardrails.md)          | Boundaries, security, verification, what needs approval |
| [Agent instructions](AGENTS.md)           | Rules for agents working in this repo                   |
| [UI agent instructions](src/ui/AGENTS.md) | Foldkit architecture, testing, components, upgrades     |
| [Dependency patches](patches/README.md)   | Patch policy and retired patches                        |
