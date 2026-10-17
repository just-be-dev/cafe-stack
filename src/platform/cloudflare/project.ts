import * as Config from "effect/Config";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

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
 * `project-starter`, served from `/`, with no custom routes.
 *
 * - PROJECT_NAME  names the stack, so each project keeps its own Alchemy state.
 * - BASE_PATH     serves the app under a path prefix, e.g. `/<project>/`.
 * - STAGE, PROJECTS_HOST, PROJECTS_ZONE  with STAGE=prod and PROJECT_NAME set,
 *                 route `<host>/<project>/*` on the zone.
 */
export const DeployConfig = Config.all({
  project: optional("PROJECT_NAME"),
  basePath: Config.schema(BasePath, "BASE_PATH").pipe(Config.withDefault("/")),
  stage: optional("STAGE"),
  host: optional("PROJECTS_HOST"),
  zone: optional("PROJECTS_ZONE"),
}).pipe(
  Config.map(({ project, basePath, stage, host, zone }) => ({
    stackName: Option.getOrElse(project, () => "project-starter"),
    basePath,
    prodRoute: Option.all({ project, host, zone }).pipe(
      Option.filter(() => Option.contains(stage, "prod")),
      Option.map(({ project, host, zone }) => ({
        routes: [{ pattern: `${host}/${project}/*`, zoneName: zone }],
        url: `https://${host}/${project}/`,
      })),
    ),
  })),
);
