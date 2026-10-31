import * as Schema from "effect/Schema";

export const Info = Schema.Struct({ name: Schema.String, status: Schema.Literal("ok") });
export type Info = typeof Info.Type;

/** A visitor's display name: trimmed, 1 to 40 characters. */
export const GreetingName = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isNonEmpty(),
  Schema.isMaxLength(40),
).pipe(Schema.brand("GreetingName"));
export type GreetingName = typeof GreetingName.Type;

export const Greeting = Schema.Struct({ message: Schema.String, app: Schema.String });
export type Greeting = typeof Greeting.Type;

/** The name is well-formed but reserved for the system. */
export class ReservedName extends Schema.TaggedError<
  ReservedName,
  { readonly brand: unique symbol }
>()("ReservedName", {
  name: GreetingName,
}) {}
