import { it } from "@effect/vitest";
import { click, expect, given, role, scene, text } from "foldkit/scene";
import { init, update, view } from "./main.ts";

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
