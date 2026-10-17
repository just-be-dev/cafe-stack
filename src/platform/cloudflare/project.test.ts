import { expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { DeployConfig } from "./project.ts";

const read = (env: Record<string, string>) => DeployConfig.parse(ConfigProvider.fromUnknown(env));

const platform = {
  PROJECT_NAME: "cafe",
  BASE_PATH: "/cafe/",
  PROJECTS_HOST: "apps.example.com",
  PROJECTS_ZONE: "example.com",
};

it.effect("defaults to the starter stack at / with no route", () =>
  Effect.gen(function* () {
    const settings = yield* read({});
    expect(settings.stackName).toBe("project-starter");
    expect(settings.basePath).toBe("/");
    expect(Option.isNone(settings.prodRoute)).toBe(true);
  }),
);

it.effect("treats blank variables as unset", () =>
  Effect.gen(function* () {
    const settings = yield* read({ PROJECT_NAME: "  ", STAGE: "" });
    expect(settings.stackName).toBe("project-starter");
  }),
);

it.effect("routes prod under the project path", () =>
  Effect.gen(function* () {
    const settings = yield* read({ ...platform, STAGE: "prod" });
    expect(settings.stackName).toBe("cafe");
    expect(settings.basePath).toBe("/cafe/");
    expect(settings.prodRoute).toEqual(
      Option.some({
        routes: [{ pattern: "apps.example.com/cafe/*", zoneName: "example.com" }],
        url: "https://apps.example.com/cafe/",
      }),
    );
  }),
);

it.effect("skips the route for previews and when the host or zone is missing", () =>
  Effect.gen(function* () {
    const preview = yield* read({ ...platform, STAGE: "b-feature-1a2b" });
    expect(Option.isNone(preview.prodRoute)).toBe(true);
    const { PROJECTS_ZONE: _, ...noZone } = platform;
    const missing = yield* read({ ...noZone, STAGE: "prod" });
    expect(Option.isNone(missing.prodRoute)).toBe(true);
  }),
);

it.effect("rejects a base path without leading and trailing slashes", () =>
  Effect.gen(function* () {
    for (const BASE_PATH of ["cafe/", "/cafe"]) {
      const exit = yield* Effect.exit(read({ BASE_PATH }));
      expect(Exit.isFailure(exit)).toBe(true);
    }
  }),
);
