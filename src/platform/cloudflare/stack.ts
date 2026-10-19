import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import Api from "./api.ts";

/** A path prefix with leading and trailing slashes, like `/` or `/my-app/`. */
const BasePath = Schema.String.check(
  Schema.isPattern(/^\/(?:.*\/)?$/, { message: "BASE_PATH must start and end with /" }),
);

/** An optional variable; blank counts as unset. */
const optional = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Config.map(Option.map((value) => value.trim())),
    Config.map(Option.filter((value) => value.length > 0)),
  );

/**
 * Optional deploy settings, read at plan time. With none set, the stack is
 * `project-starter`, served from `/`, with no custom domain.
 *
 * - PROJECT_NAME  names the stack, so each project keeps its own Alchemy state.
 * - BASE_PATH     serves the app under a path prefix, e.g. `/app/`.
 * - STAGE, PROJECT_HOST, PROJECT_ZONE  with STAGE=prod, prod claims `<host>`
 *                 on the zone, e.g. `cafe.example.com`.
 */
export const DeployConfig = Config.all({
  project: optional("PROJECT_NAME"),
  basePath: Config.schema(BasePath, "BASE_PATH").pipe(Config.withDefault("/")),
  stage: optional("STAGE"),
  host: optional("PROJECT_HOST"),
  zone: optional("PROJECT_ZONE"),
}).pipe(
  Config.map(({ project, basePath, stage, host, zone }) => ({
    stackName: Option.getOrElse(project, () => "project-starter"),
    basePath,
    prodRoute: Option.all({ host, zone }).pipe(
      Option.filter(() => Option.contains(stage, "prod")),
      // The custom domain gives the host DNS and a certificate. The route is
      // there too because routes outrank custom domains, so a zone-wide
      // wildcard route (`*.example.com/*`) would otherwise win.
      Option.map(({ host, zone }) => ({
        domain: host,
        routes: [{ pattern: `${host}${basePath}*`, zoneName: zone }],
        url: `https://${host}${basePath}`,
      })),
    ),
  })),
);

// Alchemy.Stack takes its name as a plain string, so the deploy settings are
// read once, when the stack module loads.
const { stackName, basePath, prodRoute } = Effect.runSync(DeployConfig);

export const App = Cloudflare.Website.Foldkit("App", {
  main: "src/platform/cloudflare/edge.ts",
  env: { API: Api, BASE_PATH: basePath },
  // Static assets are matched against the full path, so API calls are
  // `<base>api/*` (`/api/*` unless deployed under a project path).
  assets: { runWorkerFirst: [`${basePath}api/*`] },
  ...Option.match(prodRoute, {
    onNone: () => ({}),
    onSome: ({ domain, routes }) => ({ domain, routes }),
  }),
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

// The stack name keys Alchemy state and prefixes resource names.
export default Alchemy.Stack(
  stackName,
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    yield* Api;
    const app = yield* App;
    return { url: Option.match(prodRoute, { onNone: () => app.url, onSome: ({ url }) => url }) };
  }),
);
