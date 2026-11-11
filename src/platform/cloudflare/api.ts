import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import { AppInfo } from "../../service.ts";
import { apiRoutes } from "../../api.ts";

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  {
    main: import.meta.url,
    compatibility: {
      date: "2026-10-04",
      flags: ["enable_request_signal", "request_signal_passthrough"],
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1, persist: true },
    },
  },
  Effect.gen(function* () {
    const handler = yield* HttpRouter.toHttpEffect(apiRoutes);
    return {
      fetch: handler.pipe(
        Effect.withSpan("Api.request"),
        Effect.provide(AppInfo.layer("Project starter")),
      ),
    };
  }).pipe(Effect.provide(Cloudflare.Telemetry({ headSamplingRate: 1, persist: true }))),
) {}
