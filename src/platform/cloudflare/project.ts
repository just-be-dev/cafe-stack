/**
 * Deploy settings for projects.just-be.dev. Its runner sets these variables;
 * without them (a plain `alchemy dev` or `alchemy deploy`) the stack behaves
 * exactly like the starter always has.
 *
 * - PROJECT_NAME  the project's repo name. It names the stack, so every
 *                 project keeps its own Alchemy state.
 * - STAGE         `prod` for main, `b-<slug>-<hash>` for other branches.
 * - BASE_PATH     `/<project>/` in prod, `/` for previews.
 * - PROJECTS_HOST, PROJECTS_ZONE  where prod is routed.
 *
 * Plan time only. The stack must keep returning `{ url }`.
 */
const env = (name: string) =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    name
  ]?.trim() || undefined;

/** Stack name: the project when deployed by the platform, the starter's name otherwise. */
export const stackName = env("PROJECT_NAME") ?? "project-starter";

/** Where the app is served from, always with a trailing slash. */
export const basePath = env("BASE_PATH") ?? "/";

const project = env("PROJECT_NAME");
const host = env("PROJECTS_HOST") ?? "projects.just-be.dev";
const zone = env("PROJECTS_ZONE") ?? "just-be.dev";

/** Prod on the platform: route `<host>/<project>/*` and report that URL. */
export const prodRoute =
  env("STAGE") === "prod" && project !== undefined
    ? {
        routes: [{ pattern: `${host}/${project}/*`, zoneName: zone }],
        url: `https://${host}/${project}/`,
      }
    : undefined;
