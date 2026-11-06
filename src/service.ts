import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Greeting, type GreetingName, Info, ReservedName } from "./model.ts";

export class AppInfo extends Context.Service<AppInfo, { readonly read: Effect.Effect<Info> }>()(
  "starter/AppInfo",
) {
  static readonly layer = (name: string) =>
    Layer.succeed(AppInfo, {
      read: Effect.succeed(Info.make({ name, status: "ok" })),
    });
}

const reservedNames = new Set(["admin", "root", "system"]);

/** Greets a visitor by name, refusing names reserved for the system. */
export const greet = Effect.fn("AppInfo.greet")(function* (name: GreetingName) {
  if (reservedNames.has(name.toLowerCase())) {
    return yield* new ReservedName({ requestedName: name });
  }
  const info = yield* (yield* AppInfo).read;
  return Greeting.make({ message: `Hello, ${name}!`, app: info.name });
});
