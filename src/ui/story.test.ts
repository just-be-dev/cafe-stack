import { expect, it } from "@effect/vitest";
import { given, message, model, story } from "foldkit/story";
import { init, Message, update } from "./main.ts";

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
