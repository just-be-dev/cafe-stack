# Effect · Cloudflare · Foldkit template

A starter for TypeScript apps on Cloudflare, built with Effect 4, Foldkit, Bun, mise, and Alchemy v2.

It comes with a Foldkit counter page, a small Effect service, a `GET /api/health` route, and an Alchemy stack with two Workers: a Website that serves the UI and an API. Both Workers send logs and traces to Workers Observability, and the API's Effect spans show up in Cloudflare's trace view.

```sh
mise trust && mise install
mise run check
mise run build
mise run dev
```

`mise run dev` prints a Website URL. The UI is served there, and `/api/*` is forwarded to the API Worker, which also has its own workers.dev URL. `GET /api/health` returns `{ "name": "Project starter", "status": "ok" }`. Unknown API routes return a JSON 404.

## Layout

```text
alchemy.run.ts                   re-exports the platform stack
src/
  model.ts / service.ts          portable Schema and Effect service
  api.ts / api.test.ts           routes and HTTP contract tests
  platform/
    boundary.test.ts             keeps platform imports out of domain code
    cloudflare/{stack,api,edge}.ts  resources, API Worker, forwarding edge
  ui/
    entry.ts                     runtime boot
    main.ts                      Model, Messages, init, update, view
    styles.css                   light/dark Tailwind theme
    components/ui/               foldcn badge, bubble, button, empty,
                                 input, message, and textarea;
                                 local shadcn Trace port
    lib/utils.ts                 `cn` class helper
    story.test.ts / scene.test.ts  update and view tests
    AGENTS.md                    Foldkit conventions
```

Root files configure Bun, mise, Node.js, TypeScript, Vite, Vitest with `@effect/vitest`, Oxlint/Oxfmt, foldcn, the Foldkit DevTools MCP server, and dependency patches.

## Starting a new project

1. Click **Use this template → Create a new repository** and pick the new repository's visibility.
2. Decide on the product's domain names, who owns which data, how users authenticate, and whether you need D1, Durable Objects, or AI.
3. Rename things: `name` in `package.json`, the `project-starter` stack in `src/platform/cloudflare/stack.ts`, the app name in `src/platform/cloudflare/api.ts`, and the page title and content in `index.html` and `src/ui/`. Resource names stick once deployed, so settle them before the first deploy.
4. Run `mise trust && mise install`. It installs Bun, Node.js for Vitest, and the locked dependencies. Commit `bun.lock`. Read the [tooling guide](docs/tooling.md) before upgrading dependencies.
5. Replace the sample service and counter with your first real feature. Keep Cloudflare code in `src/platform/cloudflare/` and runtime boot in `src/ui/entry.ts`.
6. Add your product's invariants to `AGENTS.md`, rewrite this README, and run the [checks](docs/guardrails.md).

A prompt for an agent: "Read AGENTS.md and docs/. Adapt this starter for an application that does [product description]. Keep the stack and boundaries. Build one useful vertical slice and verify it locally. Do not deploy."

## Deploying

Set up a Cloudflare profile with `mise run cloudflare:profile`, or point `ALCHEMY_PROFILE` at an existing one. `mise run deploy` deploys the `prod` stage. The first deploy may offer to create Cloudflare-hosted Alchemy state.

Both Workers are public. The API answers on its workers.dev URL and through the Website's service binding, so any authentication you add has to cover both.

## Telemetry

Both Workers persist invocation logs and traces with a sampling rate of `1`, so every request is recorded. The API also provides `Cloudflare.Telemetry({ headSamplingRate: 1, persist: true })`, which exports the `Api.request` span and any `Effect.withSpan` or `Effect.fn` spans to Cloudflare.

After a deploy, request `/api/health` and open **Workers & Pages → App / Api → Observability**. Lower the sampling rates in `stack.ts` and `api.ts` once traffic grows. The [Cloudflare guide](docs/cloudflare.md) has the details.

## Trace UI

`src/ui/components/ui/trace.ts` ports [shadcn's Base UI Trace](https://ui.shadcn.com/docs/components/base/trace) with base-nova styling into foldcn-style builders. Import `Trace` from `@/components/ui/trace`. The container and its `line`, `icon`, `title`, and `description` parts take `(config, children, h)`. Every part accepts `className` and extra `attributes`. Lines accept `status: "running" | "error" | "pending"`; omit it for completed work. Running titles shimmer, respecting reduced motion.

```ts
Trace(
  {},
  [
    Trace.line(
      { status: "running" },
      [Trace.title({}, ["Running build"], h), Trace.description({}, ["3s"], h)],
      h,
    ),
    Trace.collapsible(
      {
        id: "build-output",
        isOpen: model.isBuildOutputOpen,
        onToggle: (isOpen) => Message.ToggledBuildOutput({ isOpen }),
      },
      {
        trigger: [Trace.line({}, [Trace.title({}, ["Ran typecheck"], h)], h)],
        content: [h.pre([], ["No type errors."])],
      },
      h,
    ),
  ],
  h,
);
```

Store `isBuildOutputOpen: Schema.Boolean` in the parent Model and handle `ToggledBuildOutput` in its update. Use a unique, stable `id` for each disclosure. Initialize the field to `true` for an initially open row; external updates can change the same field. The default removes closed content immediately. `keepMounted: true` retains closed content with native `hidden` and `inert` attributes, without animation. `isAnimated: true` uses Foldkit's animated panel, which stays mounted for height transitions and becomes inert and hidden from assistive technology while closed. Animation requires retention, so `isAnimated` takes precedence over `keepMounted`. Both options default to `false`. Nested state stays in the parent Model in every mode.

`Trace.collapsible` also accepts `isDisabled`, `ariaLabel`, `ariaLabelledBy`, `triggerClass`, and `contentClass`. For custom layouts, `Trace.collapsibleTrigger` and `Trace.collapsibleContent` require a `disclosure` config field from `@foldkit/ui`'s `Disclosure.view`; each builder applies the appropriate attribute bundle. Render custom content conditionally on `isOpen`, or wrap it in `disclosure.animatePanel` and keep it mounted. For example, inside `Disclosure.view`:

```ts
toView: (disclosure) =>
  Trace(
    {},
    [
      Trace.collapsibleTrigger(
        { disclosure },
        [Trace.line({}, [Trace.title({}, ["Ran typecheck"], h)], h)],
        h,
      ),
      model.isBuildOutputOpen
        ? Trace.collapsibleContent({ disclosure }, ["No type errors."], h)
        : h.empty,
    ],
    h,
  );
```

Wrap a line in an anchor or another component's trigger to give it link or dialog behavior. Icons are decorative; describe running and failed states in the title too.

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
| [Dependency patches](patches/README.md)   | Alchemy and Foldkit DevTools fixes                      |
