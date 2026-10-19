import { expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { DeployConfig } from "./stack.ts";

const read = (env: Record<string, string>) => DeployConfig.parse(ConfigProvider.fromUnknown(env));

const platform = {
  PROJECT_NAME: "cafe",
  PROJECT_HOST: "cafe.example.com",
  PROJECT_ZONE: "example.com",
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

it.effect("gives prod its own host", () =>
  Effect.gen(function* () {
    const settings = yield* read({ ...platform, STAGE: "prod" });
    expect(settings.stackName).toBe("cafe");
    expect(settings.basePath).toBe("/");
    expect(settings.prodRoute).toEqual(
      Option.some({
        domain: "cafe.example.com",
        routes: [{ pattern: "cafe.example.com/*", zoneName: "example.com" }],
        url: "https://cafe.example.com/",
      }),
    );
  }),
);

it.effect("keeps a base path on prod's host", () =>
  Effect.gen(function* () {
    const settings = yield* read({ ...platform, BASE_PATH: "/app/", STAGE: "prod" });
    expect(settings.prodRoute).toEqual(
      Option.some({
        domain: "cafe.example.com",
        routes: [{ pattern: "cafe.example.com/app/*", zoneName: "example.com" }],
        url: "https://cafe.example.com/app/",
      }),
    );
  }),
);

it.effect("doesn't need PROJECT_NAME to give prod a host", () =>
  Effect.gen(function* () {
    const { PROJECT_NAME: _, ...noName } = platform;
    const settings = yield* read({ ...noName, STAGE: "prod" });
    expect(settings.stackName).toBe("project-starter");
    expect(Option.isSome(settings.prodRoute)).toBe(true);
  }),
);

it.effect("skips the host for previews and when the host or zone is missing", () =>
  Effect.gen(function* () {
    const preview = yield* read({ ...platform, STAGE: "b-feature-1a2b" });
    expect(Option.isNone(preview.prodRoute)).toBe(true);
    const { PROJECT_ZONE: _, ...noZone } = platform;
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
