import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import Api from "./api.ts";
import { DeployConfig } from "./project.ts";

// Alchemy.Stack takes its name as a plain string, so the deploy settings are
// read once, when the stack module loads.
const { stackName, basePath, prodRoute } = Effect.runSync(DeployConfig);

export const App = Cloudflare.Website.Foldkit("App", {
  main: "src/platform/cloudflare/edge.ts",
  env: { API: Api, BASE_PATH: basePath },
  // Static assets are matched against the full path, so API calls are
  // `<base>api/*` (`/api/*` unless deployed under a project path).
  assets: { runWorkerFirst: [`${basePath}api/*`] },
  ...Option.match(prodRoute, { onNone: () => ({}), onSome: ({ routes }) => ({ routes }) }),
  compatibility: { date: "2026-10-04" },
  observability: {
    enabled: true,
    logs: { enabled: true, invocationLogs: true, headSamplingRate: 1, persist: true },
    traces: { enabled: true, headSamplingRate: 1, persist: true },
  },
});

export type AppEnv = Cloudflare.InferEnv<typeof App>;

const state = Layer.unwrap(
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV.pipe(Effect.orDie);
    return dev ? Alchemy.localState() : Cloudflare.state();
  }),
);

// The stack name keys Alchemy state and prefixes resource names; projects get
// their own (see project.ts).
export default Alchemy.Stack(
  stackName,
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    yield* Api;
    const app = yield* App;
    return { url: Option.match(prodRoute, { onNone: () => app.url, onSome: ({ url }) => url }) };
  }),
);
