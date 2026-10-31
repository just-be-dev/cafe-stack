import { describe, expect, it } from "@effect/vitest";
import { Command, given, message, model, story } from "foldkit/story";
import { GreetingName } from "../model.ts";
import {
  FetchGreeting,
  GreetingFailure,
  GreetingRequest,
  init,
  Message,
  Model,
  update,
} from "./main.ts";

const ada = GreetingName.make("Ada");
const greeting = { message: "Hello, Ada!", app: "Starter" };

it("increments compose and reset returns to zero", () => {
  story(
    update,
    given(init().model),
    message(Message.ClickedIncrement()),
    message(Message.ClickedIncrement()),
    model((value) => expect(value.count).toBe(2)),
    message(Message.ClickedReset()),
    model((value) => expect(value.count).toBe(0)),
  );
});

describe("greeting", () => {
  it("submits the trimmed name and shows the greeting", () => {
    story(
      update,
      given(init().model),
      message(Message.UpdatedName({ value: "  Ada " })),
      message(Message.SubmittedGreeting()),
      model((value) => expect(value.greeting).toEqual(GreetingRequest.Loading({ name: ada }))),
      Command.expectExact(FetchGreeting({ name: ada })),
      Command.resolve(FetchGreeting, Message.SucceededFetchGreeting({ greeting })),
      model((value) => expect(value.greeting).toEqual(GreetingRequest.Succeeded({ greeting }))),
    );
  });

  it("rejects an invalid name without calling the API", () => {
    story(
      update,
      given(init().model),
      message(Message.UpdatedName({ value: "   " })),
      message(Message.SubmittedGreeting()),
      model((value) => expect(value.greeting).toEqual(GreetingRequest.InvalidName())),
      Command.expectNone(),
      message(Message.UpdatedName({ value: "x".repeat(41) })),
      message(Message.SubmittedGreeting()),
      model((value) => expect(value.greeting).toEqual(GreetingRequest.InvalidName())),
      Command.expectNone(),
    );
  });

  it("ignores a second submit while a request is in flight", () => {
    const loading = Model.make({
      count: 0,
      name: "Grace",
      greeting: GreetingRequest.Loading({ name: ada }),
    });
    story(
      update,
      given(loading),
      message(Message.SubmittedGreeting()),
      model((value) => expect(value).toEqual(loading)),
      Command.expectNone(),
      message(Message.FailedFetchGreeting({ failure: GreetingFailure.Unavailable() })),
      model((value) =>
        expect(value.greeting).toEqual(
          GreetingRequest.Failed({ failure: GreetingFailure.Unavailable() }),
        ),
      ),
    );
  });
});
