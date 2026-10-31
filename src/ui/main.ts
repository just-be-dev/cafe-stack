import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Command from "foldkit/command";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { defineTaggedUnion } from "foldkit/schema";
import { modifyFields } from "foldkit/struct";
import type * as Update from "foldkit/update";
import { Greeting, GreetingName } from "../model.ts";
import { Input } from "@foldkit/ui";
import { AppClient } from "@/api";
import { button } from "@/components/ui/button";
import { input } from "@/components/ui/input";

// MODEL

export const GreetingFailure = defineTaggedUnion({
  ReservedName: { name: GreetingName },
  Unavailable: {},
});
export type GreetingFailure = typeof GreetingFailure.Type;

export const GreetingRequest = defineTaggedUnion({
  Idle: {},
  InvalidName: {},
  Loading: { name: GreetingName },
  Succeeded: { greeting: Greeting },
  Failed: { failure: GreetingFailure },
});
export type GreetingRequest = typeof GreetingRequest.Type;

export const Model = Schema.Struct({
  count: Schema.Int,
  name: Schema.String,
  greeting: GreetingRequest,
});
export type Model = typeof Model.Type;

// MESSAGE

export const Message = defineMessageUnion({
  ClickedIncrement: {},
  ClickedReset: {},
  UpdatedName: { value: Schema.String },
  SubmittedGreeting: {},
  SucceededFetchGreeting: { greeting: Greeting },
  FailedFetchGreeting: { failure: GreetingFailure },
});
export type Message = typeof Message.Type;

// INIT

export const init = () => ({
  model: Model.make({ count: 0, name: "", greeting: GreetingRequest.Idle() }),
});

// COMMAND

export const GREETING_TIMEOUT = "10 seconds";

const failedFetchGreeting = (failure: GreetingFailure) =>
  Effect.succeed(Message.FailedFetchGreeting({ failure }));

export const FetchGreeting = Command.define("FetchGreeting", {
  args: { name: GreetingName },
  messages: [Message.SucceededFetchGreeting, Message.FailedFetchGreeting],
  execute: ({ name }) =>
    Effect.gen(function* () {
      const client = yield* AppClient;
      const greeting = yield* client.Greet({ name });
      return Message.SucceededFetchGreeting({ greeting });
    }).pipe(
      Effect.timeout(GREETING_TIMEOUT),
      Effect.catchTag("ReservedName", (error) =>
        failedFetchGreeting(GreetingFailure.ReservedName({ name: error.name })),
      ),
      Effect.catch(() => failedFetchGreeting(GreetingFailure.Unavailable())),
      Effect.catchDefect((defect) =>
        Effect.logError("Greeting failed unexpectedly", Cause.die(defect)).pipe(
          Effect.andThen(failedFetchGreeting(GreetingFailure.Unavailable())),
        ),
      ),
    ),
});

// UPDATE

const decodeName = Schema.decodeUnknownOption(GreetingName);

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message, AppClient>>(message, {
    ClickedIncrement: () => ({ model: modifyFields(model, { count: (count) => count + 1 }) }),
    ClickedReset: () => ({ model: modifyFields(model, { count: () => 0 }) }),
    UpdatedName: ({ value }) => ({ model: modifyFields(model, { name: () => value }) }),
    SubmittedGreeting: () => {
      if (GreetingRequest.guards.Loading(model.greeting)) {
        return { model };
      }
      return Option.match(decodeName(model.name.trim()), {
        onNone: () => ({
          model: modifyFields(model, { greeting: () => GreetingRequest.InvalidName() }),
        }),
        onSome: (name) => ({
          model: modifyFields(model, { greeting: () => GreetingRequest.Loading({ name }) }),
          commands: [FetchGreeting({ name })],
        }),
      });
    },
    SucceededFetchGreeting: ({ greeting }) => ({
      model: modifyFields(model, { greeting: () => GreetingRequest.Succeeded({ greeting }) }),
    }),
    FailedFetchGreeting: ({ failure }) => ({
      model: modifyFields(model, { greeting: () => GreetingRequest.Failed({ failure }) }),
    }),
  });

// VIEW

const GREETING_NAME_ID = "greeting-name";

const greetingStatus = (request: GreetingRequest, h: HtmlBuilder<Message>): Html =>
  GreetingRequest.match(request, {
    Idle: () => h.p([h.Class("text-sm text-muted-foreground")], ["No greeting yet."]),
    InvalidName: () =>
      h.p([h.Class("text-sm text-destructive")], ["Enter a name of 1 to 40 characters."]),
    Loading: ({ name }) => h.p([h.Class("text-sm text-muted-foreground")], [`Greeting ${name}…`]),
    Succeeded: ({ greeting }) =>
      h.p([h.Class("font-mono text-sm")], [`${greeting.message} (from ${greeting.app})`]),
    Failed: ({ failure }) =>
      h.p(
        [h.Class("text-sm text-destructive")],
        [
          GreetingFailure.match(failure, {
            ReservedName: ({ name }) => `“${name}” is reserved. Try another name.`,
            Unavailable: () => "The API didn't answer. Try again.",
          }),
        ],
      ),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Project starter",
  body: h.main(
    [h.Class("mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-12")],
    [
      h.header(
        [h.Class("space-y-3")],
        [
          h.p(
            [h.Class("font-mono text-sm text-muted-foreground")],
            ["EFFECT / CLOUDFLARE / FOLDKIT"],
          ),
          h.h1(
            [h.Class("text-4xl font-semibold tracking-tight")],
            ["Your next project starts here."],
          ),
          h.p(
            [h.Class("text-muted-foreground")],
            ["The tooling and boundaries are ready. Make the product your own."],
          ),
        ],
      ),
      h.section(
        [
          h.Class("rounded-xl border border-border bg-card p-6 shadow-sm"),
          h.AriaLabel("Counter example"),
        ],
        [
          h.h2([h.Class("text-lg font-medium")], ["A small, pure update"]),
          h.p(
            [h.Class("mt-2 text-sm text-muted-foreground")],
            ["Messages change the Model; the view follows."],
          ),
          h.p(
            [h.Class("my-6 font-mono text-4xl"), h.AriaLive("polite")],
            [`Count: ${model.count}`],
          ),
          h.div(
            [h.Class("flex gap-3")],
            [
              button({ onClick: Message.ClickedIncrement(), type: "button" }, "Increment", h),
              button(
                { onClick: Message.ClickedReset(), type: "button", variant: "outline" },
                "Reset",
                h,
              ),
            ],
          ),
        ],
      ),
      h.section(
        [
          h.Class("rounded-xl border border-border bg-card p-6 shadow-sm"),
          h.AriaLabel("RPC example"),
        ],
        [
          h.h2([h.Class("text-lg font-medium")], ["A typed call to the API"]),
          h.p(
            [h.Class("mt-2 text-sm text-muted-foreground")],
            ["A Command calls the Greet RPC; its result comes back as a Message."],
          ),
          h.form(
            [
              h.Class("mt-6 flex items-end gap-3"),
              h.AriaLabel("Greeting"),
              h.OnSubmit(Message.SubmittedGreeting()),
            ],
            [
              input(
                {
                  id: GREETING_NAME_ID,
                  label: "Your name",
                  value: model.name,
                  isInvalid: GreetingRequest.guards.InvalidName(model.greeting),
                  hasExternalDescription: true,
                  onInput: (value) => Message.UpdatedName({ value }),
                },
                h,
              ),
              button(
                { type: "submit", isDisabled: GreetingRequest.guards.Loading(model.greeting) },
                "Greet",
                h,
              ),
            ],
          ),
          h.p(
            [
              h.Id(Input.descriptionId(GREETING_NAME_ID)),
              h.Class("mt-1.5 text-sm text-muted-foreground"),
            ],
            ["1 to 40 characters."],
          ),
          // NOTE: min-h fits two lines so wrapped results don't shift the centred page.
          h.div(
            [h.Class("mt-4 min-h-10"), h.AriaLive("polite")],
            [greetingStatus(model.greeting, h)],
          ),
        ],
      ),
      h.p(
        [h.Class("text-sm text-muted-foreground")],
        ["Start with README.md and docs/. The API serves GET /api/health and POST /api/rpc."],
      ),
    ],
  ),
});
