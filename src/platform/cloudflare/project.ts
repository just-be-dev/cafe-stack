/**
 * Optional deploy settings, read at plan time. With none set, the stack is
 * `project-starter`, served from `/`, with no custom routes.
 *
 * - PROJECT_NAME  names the stack, so each project keeps its own Alchemy state.
 * - BASE_PATH     serves the app under a path prefix, e.g. `/<project>/`.
 * - STAGE, PROJECTS_HOST, PROJECTS_ZONE  with STAGE=prod and PROJECT_NAME set,
 *                 route `<host>/<project>/*` on the zone.
 */
const env = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ]?.trim() || undefined;

const project = env("PROJECT_NAME");
const host = env("PROJECTS_HOST");
const zone = env("PROJECTS_ZONE");

export const stackName = project ?? "project-starter";

/** Where the app is served from, always with a trailing slash. */
export const basePath = env("BASE_PATH") ?? "/";

/** The prod route and its URL, when every setting it needs is present. */
export const prodRoute =
  env("STAGE") === "prod" && project !== undefined && host !== undefined && zone !== undefined
    ? {
        routes: [{ pattern: `${host}/${project}/*`, zoneName: zone }],
        url: `https://${host}/${project}/`,
      }
    : undefined;
