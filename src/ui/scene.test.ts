import { describe, it } from "@effect/vitest";
import {
  click,
  Command,
  expect,
  given,
  label,
  role,
  scene,
  submit,
  text,
  type,
} from "foldkit/scene";
import { GreetingName } from "../model.ts";
import { FetchGreeting, GreetingFailure, init, Message, update, view } from "./main.ts";

it("the accessible controls update the rendered count", () => {
  scene(
    { update, view },
    given(init().model),
    expect(text("Count: 0")).toBeVisible(),
    click(role("button", { name: "Increment" })),
    expect(text("Count: 1")).toBeVisible(),
    click(role("button", { name: "Reset" })),
    expect(text("Count: 0")).toBeVisible(),
  );
});

describe("greeting form", () => {
  const form = role("form", { name: "Greeting" });
  const nameField = label("Your name");

  it("shows loading, then the greeting", () => {
    scene(
      { update, view },
      given(init().model),
      expect(text("No greeting yet.")).toBeVisible(),
      type(nameField, "Ada"),
      submit(form),
      expect(text("Greeting Ada…")).toBeVisible(),
      expect(role("button", { name: "Greet" })).toBeDisabled(),
      Command.resolve(
        FetchGreeting,
        Message.SucceededFetchGreeting({
          greeting: { message: "Hello, Ada!", app: "Starter" },
        }),
      ),
      expect(text("Hello, Ada! (from Starter)")).toBeVisible(),
      expect(role("button", { name: "Greet" })).toBeEnabled(),
    );
  });

  it("explains invalid, reserved, and unavailable outcomes", () => {
    scene(
      { update, view },
      given(init().model),
      submit(form),
      expect(text("Enter a name of 1 to 40 characters.")).toBeVisible(),
      type(nameField, "admin"),
      submit(form),
      Command.resolve(
        FetchGreeting,
        Message.FailedFetchGreeting({
          failure: GreetingFailure.ReservedName({ name: GreetingName.make("admin") }),
        }),
      ),
      expect(text("“admin” is reserved. Try another name.")).toBeVisible(),
      type(nameField, "Ada"),
      submit(form),
      Command.resolve(
        FetchGreeting,
        Message.FailedFetchGreeting({ failure: GreetingFailure.Unavailable() }),
      ),
      expect(text("The API didn't answer. Try again.")).toBeVisible(),
    );
  });
});
