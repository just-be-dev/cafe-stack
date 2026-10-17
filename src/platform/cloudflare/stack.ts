import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import Api from "./api.ts";
import { basePath, prodRoute, stackName } from "./project.ts";

export const App = Cloudflare.Website.Foldkit("App", {
  main: "src/platform/cloudflare/edge.ts",
  env: { API: Api, BASE_PATH: basePath },
  // Static assets are matched against the full path, so API calls are
  // `<base>api/*` (`/api/*` unless deployed under a project path).
  assets: { runWorkerFirst: [`${basePath}api/*`] },
  ...(prodRoute === undefined ? {} : { routes: prodRoute.routes }),
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
    return { url: prodRoute?.url ?? app.url };
  }),
);
