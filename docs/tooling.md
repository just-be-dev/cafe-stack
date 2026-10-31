# Tooling

Every dependency in `package.json` is pinned to an exact version, and `bun.lock` locks the rest of the tree. Upgrades are deliberate.

| Tool / package group                 | Role                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| Bun / mise                           | Runtime, package manager, tools and tasks                  |
| Node.js / Vitest / @effect/vitest    | Test runtime, runner, and scoped Effect testing            |
| Playwright / axe-core                | Browser tests and accessibility scans of the built UI      |
| TypeScript 7                         | Strict native compiler via `tsc --noEmit`                  |
| Effect 4 + browser/Bun platforms     | Schemas, services, errors, concurrency, platform runtime   |
| Effect language service / tsgo patch | Editor diagnostics and the patched native compiler         |
| Alchemy v2                           | Effect-native Cloudflare infrastructure and local dev      |
| Foldkit / @foldkit/ui                | Elm-style Effect UI and UI primitives                      |
| Foldkit Vite / DevTools MCP / lint   | Build integration, state inspection, UI architecture rules |
| Vite                                 | UI dev server and bundler, run by Alchemy                  |
| Tailwind v4 + Vite plugin            | Token-based CSS                                            |
| Oxfmt / Oxlint                       | Formatting and linting                                     |
| Effect Oxlint plugin                 | Effect lint rules                                          |
| Cloudflare types / workerd override  | Worker types and a pinned workerd                          |
| UI assets                            | Fontsource fonts, `cn`, `tw-animate-css`                   |

Effect 4 is a stable release; older guides that call it a pre-release are out of date. TypeScript 7 ships its native compiler as `tsc`, and the `prepare` script runs `effect-tsgo patch` on it. Check both when upgrading.

## Config files

- `mise.toml`: pins Bun and Node.js, turns on experimental settings and pinning, adds `node_modules/.bin` to PATH, and installs the dependencies locked in `bun.lock` after tools install, so `mise install` is the only setup step. Each package script has a matching mise task, and `mise tasks` lists them all. Change tool versions with `mise use bun@<version>` or `mise use node@<version>`.
- `vitest.config.ts`: discovers `src/**/*.test.ts` in the Node.js environment, with the UI `@/` alias and Effect/Foldkit deduplication. This separate config keeps the app's Vite plugins and DevTools relay out of test runs. Tests import helpers from `@effect/vitest`; Effect tests use `it.effect` for test services and automatic scope cleanup. `src/ui/vitest-setup.ts` registers Foldkit's Scene matchers (`toHaveText`, `toExist`, and the rest) on Vitest's `expect`, for assertions on a located VNode inside a Scene `tap` step. Scenes render to VNodes and run without a DOM. Scene's `pointerDown` builds a DOM event target, so a file that uses it needs a DOM: add an exact-pinned `happy-dom` and put `// @vitest-environment happy-dom` at the top of that file, so backend tests stay on Node. Vitest never picks up the Playwright specs in `e2e/`, which end in `.spec.ts` and sit outside `src/`.
- `playwright.config.ts`: Chromium and WebKit projects against a `vite preview` of the UI built into `dist/e2e/root/`, plus a Chromium `base-path` project against a second build under `BASE_PATH=/app/` in `dist/e2e/base-path/`. Ports are fixed in `e2e/constant.ts` with `strictPort`, and `reuseExistingServer` is off so a stale server never answers. CI (`CI` set) forbids `.only` and adds the GitHub and HTML reporters; traces and screenshots are kept for failures. `e2e/api.ts` serves the real API routes through `page.route`, and `e2e/page.ts` holds the shared page checks.
- `package.json`: ESM, `private: true`, scripts, exact pins, the Effect/platform and workerd overrides, and Bun patch mappings.
- `tsconfig.json`: strict mode, `noUncheckedIndexedAccess`, bundler resolution, preserved modules, `verbatimModuleSyntax`, and the Effect language-service plugin. Browser, Worker, and Bun types are all loaded; the boundary test keeps native globals out of backend domains.
- Language-service overrides allow the unstable `effect/http` module only in HTTP, UI command, and platform API files, `effect/rpc` only in the RPC contract, `src/api.ts`, and `src/ui/api.ts`, `effect/http` in `e2e/api.ts` (which serves the routes to the browser tests), and `@effect/vitest` only in test files. The HTTP, RPC, and UI client tests permit all three. `effect-oxlint` is allowed as a duplicate Effect consumer. Add narrow per-file exceptions for other unstable APIs as you use them.
- `vite.config.ts`: the `foldkit()` and Tailwind plugins, UI entry optimization, the `@/` alias, Effect/Foldkit deduplication, and watch exclusions for `.alchemy/` and `repos/`. Alchemy adds its Cloudflare integration on top for dev and deploy. `mise run build` checks the UI bundle locally.
- `oxlint.config.ts`: loads the Effect and Foldkit plugins and turns on three Effect rules, `typescript/no-explicit-any`, `typescript/consistent-type-assertions` (no `as` casts; decode with Schema or use `satisfies`), and `no-unused-vars` (prefix intentionally unused names with `_`) everywhere. It applies Foldkit's architecture rules to `src/ui/**/*.ts`, and `no-restricted-imports` overrides keep backend domain and HTTP code, the UI, and the browser tests in `e2e/` from importing `src/platform/`, Alchemy, `agents`, `cloudflare:*`, or `@cloudflare/*`.
- `components.json`: foldcn registry and UI aliases for the shadcn CLI, pointing at `src/ui/styles.css`.
- `.mcp.json`: runs the `@foldkit/devtools-mcp` server with Bun. The tools inspect a running app's Model and Messages and support time travel during local development.
- `public/_headers`: CSP and `nosniff` for static assets. Fonts, images (including `public/favicon.svg`), and scripts are same-origin.
- `src/ui/AGENTS.md`: Foldkit conventions for this release and the steps to refresh them after an upgrade.
- `src/platform/boundary.test.ts`: the authoritative dependency-direction check for backend code, the UI, and `e2e/`. The lint overrides mirror it for editor feedback; the test also resolves paths exactly, including `@/`, and scans backend code for Cloudflare globals. Change both together.
- `patches/`: two Bun patches for the Foldkit DevTools relay, documented in `patches/README.md`.

The `@effect/tsgo` Oxlint presets aren't enabled. Its type-aware Oxlint integration (`effect-tsgo patch --oxlint`) replaces the native `oxlint` and `oxlint-tsgolint` binaries in `node_modules`, needs `oxlint-tsgolint` as an extra dependency, and `@effect/tsgo` `0.52.0` supports only Oxlint `1.83.0`–`1.87.0`; with the pinned `1.88.0` the patch fails with `UnsupportedTargetPackageVersionError`. The same correctness diagnostics already run during `tsc --noEmit` through the patched compiler and the language-service plugin. Reconsider when `@effect/tsgo` supports the pinned Oxlint.

Point your editor at the workspace TypeScript version so the language-service plugin loads. Effect Solutions guides are useful, but check their imports and patch commands against the installed Effect 4 and native compiler.

## Commands

Run these from the repo root:

```sh
mise trust && mise install
mise run check   # typecheck, lint, test, format:check
mise run test:watch
mise run test:e2e:install   # once, and after a Playwright upgrade
mise run test:e2e
mise run build
mise run dev
```

`mise run format` rewrites files; `format:check` only reports. `mise run foldkit:source` shallow-clones Foldkit at the installed `foldkit@<version>` tag into `repos/foldkit/`, so agents can read its source and examples locally. It does nothing when the clone is already at that tag and replaces it after an upgrade. `repos/` is in `.gitignore` and `.ignore`, so Git, ripgrep, Oxlint, and Oxfmt skip it; TypeScript includes only `src/`, `e2e/`, and the root config files, Vitest only `src/`, and Vite doesn't watch it. `test-results/` and `playwright-report/` are gitignored, so the same tools skip them. `mise run deploy` runs `alchemy deploy --stage prod` and changes shared infrastructure, so only run it with approval and after setting up your own stack, account, and stage.

## Patches

Under `alchemy dev`, Cloudflare's Vite upgrade listener interferes with Foldkit's DevTools relay on Vite's HTTP server. One patch moves the relay to its own token-protected loopback listener. The other adds backoff when a connection closes right after opening, in both MCP client entry points. The Vite patch also adapts UUID generation to Effect 4.0.4. See [patches/README.md](../patches/README.md).

Edit patches with `mise run patch <package>` and `mise run patch:commit <package>`, and document the symptom, cause, fix, and when to remove it. After an upgrade, check whether each patch is still needed and run a browser-connected DevTools session under `alchemy dev`; a clean install doesn't prove the relay is stable. Keep the relay on loopback with its token.

Effect and its platform packages are aligned at `4.0.4` through exact overrides. Foldkit `0.168.0`, its tools, and the Effect lint wrapper still declare `4.0.0` dependencies or peers; the overrides keep one Effect instance and matching platform APIs. Recheck these overrides against upstream declarations on every upgrade and verify the native Workers and browser runtime together.

`@playwright/test` and `@axe-core/playwright` are exact pins. Playwright downloads browsers that match its version, so run `mise run test:e2e:install` after upgrading it (CI passes `--with-deps` to add the Ubuntu system libraries). The Playwright runner runs on Node.js; Bun only launches it.

`@effect/vitest` is pinned at `4.0.4` to match Effect, with Vitest `5.0.4` satisfying its peer dependency. Use the stable package versions here rather than the older beta installation command in the Effect Solutions guide. Bun still installs dependencies and runs project scripts; Vitest runs the tests on the pinned Node.js runtime.

Some dependencies aren't imported anywhere in `src/` but are still needed: `@effect/platform-browser` is a Foldkit peer, `@effect/platform-bun` is loaded by the Alchemy CLI when it runs under Bun, and `@types/bun` supplies the `fetch` types the tests use. Foldkit DevTools brings its own MCP SDK.

The workerd override is `1.20261014.1`; Alchemy's Cloudflare runtime currently pins an older build. Revisit the override whenever you upgrade Alchemy and smoke-test both local Workers.

## AI and durable workflows

No AI or durable-workflow packages are installed. When the product needs them, add exact pins for `@earendil-works/pi-ai`, `@earendil-works/pi-durable`, or `agents`. `agents` also needs exact pins for its MCP peers (`@modelcontextprotocol/client`, `@modelcontextprotocol/server`, and `@modelcontextprotocol/sdk`). The boundary test and lint rules already keep `agents` inside `src/platform/`.

Define the AI or conversation capability in its owning domain and implement it with Workers AI or pi in `src/platform/cloudflare/`. Wrap Promise calls in `Effect.tryPromise`, decode model output with Schema, and make prompting, persistence, and retry policies explicit.

Never import a harness that loads `cloudflare:*` at the top level from a path Alchemy's Bun plan step reaches. Local dev can still call paid remote AI. Reuse idempotency or request IDs across replays where the API supports it, and verify real model calls separately from scripted tests.
