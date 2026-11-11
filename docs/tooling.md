# Tooling

Every dependency in `package.json` is pinned to an exact version, and `bun.lock` locks the rest of the tree. Upgrades are deliberate.

| Tool / package group                | Role                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| Bun / mise                          | Runtime, package manager, tools and tasks                  |
| Node.js / Vitest / @effect/vitest   | Test runtime, runner, and scoped Effect testing            |
| Playwright / axe-core               | Browser tests and accessibility scans of the built UI      |
| tsrs                                | Strict native TypeScript 7 checker via `tsrs --noEmit`     |
| Effect 4 + browser/Bun platforms    | Schemas, services, errors, concurrency, platform runtime   |
| `@effect/tsgo` tsrs patch           | Effect diagnostics in the checker and language server      |
| Alchemy v2                          | Effect-native Cloudflare infrastructure and local dev      |
| Foldkit / @foldkit/ui               | Elm-style Effect UI and UI primitives                      |
| Foldkit Vite / DevTools MCP / lint  | Build integration, state inspection, UI architecture rules |
| Vite                                | UI dev server and bundler, run by Alchemy                  |
| Tailwind v4 + Vite plugin           | Token-based CSS                                            |
| Oxfmt / Oxlint                      | Formatting and linting                                     |
| Effect Oxlint plugin                | Effect lint rules                                          |
| Cloudflare types / workerd override | Worker types and a pinned workerd                          |
| UI assets                           | Fontsource fonts, `cn`, `tw-animate-css`                   |

Effect 4 is a stable release; older guides that call it a pre-release are out of date. Type checking uses [tsrs](https://github.com/oxc-project/tsrs), a Rust port of the TypeScript 7 compiler and language server. Upstream tsrs has no Effect support yet ([oxc-project/tsrs#834](https://github.com/oxc-project/tsrs/issues/834)), so the `prepare` script runs `effect-tsgo patch --tsrs --no-typescript`, which replaces the installed tsrs binary with the Effect-patched build that `@effect/tsgo` ships for that exact version. Each `@effect/tsgo` release supports specific tsrs versions (see its README), so upgrade `tsrs` and `@effect/tsgo` together and confirm that `bun install` prints `Patched tsrs` or `tsrs skipped because its hash matches the replacement`. The `typescript` package isn't installed: nothing imports it, and the only packages that mention it (`valibot` and `capnp-es`, through Alchemy) list it as an optional peer. `--no-typescript` stops the patch step from looking for it.

## Config files

- `mise.toml`: pins Bun and Node.js, turns on experimental settings and pinning, adds `node_modules/.bin` to PATH, and installs the dependencies locked in `bun.lock` after tools install, so `mise install` is the only setup step. Each package script has a matching mise task, and `mise tasks` lists them all. Change tool versions with `mise use bun@<version>` or `mise use node@<version>`.
- `vitest.config.ts`: discovers `src/**/*.test.ts` in the Node.js environment, with the UI `@/` alias and Effect/Foldkit deduplication. This separate config keeps the app's Vite plugins and DevTools relay out of test runs. Tests import helpers from `@effect/vitest`; Effect tests use `it.effect` for test services and automatic scope cleanup. `src/ui/vitest-setup.ts` registers Foldkit's Scene matchers (`toHaveText`, `toExist`, and the rest) on Vitest's `expect`, for assertions on a located VNode inside a Scene `tap` step. Scenes render to VNodes and run without a DOM. Scene's `pointerDown` builds a DOM event target, so a file that uses it needs a DOM: add an exact-pinned `happy-dom` and put `// @vitest-environment happy-dom` at the top of that file, so backend tests stay on Node. Vitest never picks up the Playwright specs in `e2e/`, which end in `.spec.ts` and sit outside `src/`.
- `playwright.config.ts`: Chromium and WebKit projects against a `vite preview` of the UI built into `dist/e2e/root/`, plus a Chromium `base-path` project against a second build under `BASE_PATH=/app/` in `dist/e2e/base-path/`. Ports are fixed in `e2e/constant.ts` with `strictPort`, and `reuseExistingServer` is off so a stale server never answers. CI (`CI` set) forbids `.only` and adds the GitHub and HTML reporters; traces and screenshots are kept for failures. `e2e/api.ts` serves the real API routes through `page.route`, and `e2e/page.ts` holds the shared page checks.
- `package.json`: ESM, `private: true`, scripts, exact pins, the Effect/platform and workerd overrides, and Bun patch mappings.
- `tsconfig.json`: strict mode, `noUncheckedIndexedAccess`, bundler resolution, preserved modules, `verbatimModuleSyntax`, and the Effect language-service plugin, which the patched tsrs reads under its `@effect/language-service` name. Browser, Worker, and Bun types are all loaded; the boundary test keeps native globals out of backend domains.
- Language-service overrides allow the unstable `effect/http` module only in HTTP, UI command, and platform API files, `effect/rpc` only in the RPC contract, `src/api.ts`, and `src/ui/api.ts`, `effect/http` in `e2e/api.ts` (which serves the routes to the browser tests), and `@effect/vitest` only in test files. The HTTP, RPC, and UI client tests permit all three. `effect-oxlint` is allowed as a duplicate Effect consumer. Add narrow per-file exceptions for other unstable APIs as you use them.
- `vite.config.ts`: the `foldkit()` and Tailwind plugins, UI entry optimization, the `@/` alias, Effect/Foldkit deduplication, and watch exclusions for `.alchemy/` and `repos/`. Alchemy adds its Cloudflare integration on top for dev and deploy. `mise run build` checks the UI bundle locally.
- `oxlint.config.ts`: loads the Effect and Foldkit plugins and turns on three Effect rules, `typescript/no-explicit-any`, `typescript/consistent-type-assertions` (no `as` casts; decode with Schema or use `satisfies`), and `no-unused-vars` (prefix intentionally unused names with `_`) everywhere. It applies Foldkit's architecture rules to `src/ui/**/*.ts`, and `no-restricted-imports` overrides keep backend domain and HTTP code, the UI, and the browser tests in `e2e/` from importing `src/platform/`, Alchemy, `agents`, `cloudflare:*`, or `@cloudflare/*`.
- `components.json`: foldcn registry and UI aliases for the shadcn CLI, pointing at `src/ui/styles.css`.
- `.mcp.json`: runs the `@foldkit/devtools-mcp` server with Bun. The tools inspect a running app's Model and Messages and support time travel during local development.
- `public/_headers`: CSP and `nosniff` for static assets. Fonts, images (including `public/favicon.svg`), and scripts are same-origin.
- `src/ui/AGENTS.md`: Foldkit conventions for this release and the steps to refresh them after an upgrade.
- `src/platform/boundary.test.ts`: the authoritative dependency-direction check for backend code, the UI, and `e2e/`. The lint overrides mirror it for editor feedback; the test also resolves paths exactly, including `@/`, and scans backend code for Cloudflare globals. Change both together.
- `patches/`: Bun patches, documented in `patches/README.md`. None are active right now.

The `@effect/tsgo` Oxlint presets aren't enabled. `@effect/tsgo` `0.67.4` supports the pinned Oxlint, and `effect-tsgo --tsrs-lint oxlint --type-aware` could run them on tsrs, but the same Effect diagnostics already run during `tsrs --noEmit`, so enabling them would report each finding twice.

Effect Solutions guides are useful, but check their imports and patch commands against the installed Effect 4 and native compiler.

## Editors

The editor's TypeScript server must be the workspace tsrs (`node_modules/.bin/tsrs --lsp --stdio`) so it reports the Effect diagnostics `mise run typecheck` does. Other TypeScript servers, such as vtsls, typescript-language-server, or a global TypeScript 7 `tsc`, check without them. Run `mise install` before opening the editor, so the patched binary exists.

- Zed: install the "TypeScript Language Server" extension (`tsgo`). `.zed/settings.json` points its `typescript-ls` server at the workspace tsrs and turns off vtsls and typescript-language-server for TypeScript, TSX, and JavaScript. Trust the worktree when Zed asks; it starts no language server before that.
- Neovim 0.11+: `.nvim.lua` registers a `tsrs` server for this repo and keeps `tsc`, `tsgo`, `ts_ls`, `tsserver`, and `vtsls` off its buffers. Neovim runs it when your init sets `vim.o.exrc = true`; accept the `:trust` prompt the first time. LazyVim gets the same setup from `.lazy.lua`, which lazy.nvim loads without `exrc` and which disables those servers in nvim-lspconfig's `opts.servers`. Start Neovim inside the repo, since both files resolve the repo from the working directory or their own path.
- VS Code: with the TypeScript 7 extension, set `"js/ts.experimental.useTsgo": true` and `"js/ts.tsdk.path": "./node_modules/tsrs/tsdk"`. On Windows, see the [tsrs editor setup](https://github.com/oxc-project/tsrs/blob/main/docs/LSP.md#editor-setup).

After upgrading `tsrs` or `@effect/tsgo`, restart the editor's language server so it picks up the newly patched binary.

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

No patches are active. The Foldkit DevTools relay patches were dropped with Foldkit `0.170.0`, whose Vite plugin always hosts the relay on its own token-protected loopback listener and whose MCP server connects on demand instead of looping on reconnects. See [patches/README.md](../patches/README.md).

Edit patches with `mise run patch <package>` and `mise run patch:commit <package>`, and document the symptom, cause, fix, and when to remove it. After an upgrade, check whether each patch is still needed and run a browser-connected DevTools session under `alchemy dev`; a clean install doesn't prove the relay is stable. Keep the relay on loopback with its token.

Effect and its platform packages are aligned at `4.1.3` through exact overrides. Alchemy `2.0.0-beta.85` (`alchemy`, `@alchemy.run/cloudflare`, `@alchemy.run/frontend-frameworks`) needs Effect `^4.1`, and Foldkit `0.170.0` and its tools need `~4.1.0`. The Effect lint wrapper still depends on `4.0.0`; the overrides keep one Effect instance and matching platform APIs. Recheck these overrides against upstream declarations on every upgrade and verify the native Workers and browser runtime together.

`@playwright/test` and `@axe-core/playwright` are exact pins. Playwright downloads browsers that match its version, so run `mise run test:e2e:install` after upgrading it (CI passes `--with-deps` to add the Ubuntu system libraries). The Playwright runner runs on Node.js; Bun only launches it.

`@effect/vitest` is pinned at `4.1.3` to match Effect, with Vitest `5.0.4` satisfying its peer dependency. Use the stable package versions here rather than the older beta installation command in the Effect Solutions guide. Bun still installs dependencies and runs project scripts; Vitest runs the tests on the pinned Node.js runtime.

Some dependencies aren't imported anywhere in `src/` but are still needed: `@effect/platform-browser` is a Foldkit peer, `@effect/platform-bun` is loaded by the Alchemy CLI when it runs under Bun, and `@types/bun` supplies the `fetch` types the tests use. Foldkit DevTools brings its own MCP SDK.

The workerd override is `1.20261014.1`; Alchemy's Cloudflare runtime currently pins an older build. Revisit the override whenever you upgrade Alchemy and smoke-test both local Workers.

## AI and durable workflows

No AI or durable-workflow packages are installed. When the product needs them, add exact pins for `@earendil-works/pi-ai`, `@earendil-works/pi-durable`, or `agents`. `agents` also needs exact pins for its MCP peers (`@modelcontextprotocol/client`, `@modelcontextprotocol/server`, and `@modelcontextprotocol/sdk`). The boundary test and lint rules already keep `agents` inside `src/platform/`.

Define the AI or conversation capability in its owning domain and implement it with Workers AI or pi in `src/platform/cloudflare/`. Wrap Promise calls in `Effect.tryPromise`, decode model output with Schema, and make prompting, persistence, and retry policies explicit.

Never import a harness that loads `cloudflare:*` at the top level from a path Alchemy's Bun plan step reaches. Local dev can still call paid remote AI. Reuse idempotency or request IDs across replays where the API supports it, and verify real model calls separately from scripted tests.
