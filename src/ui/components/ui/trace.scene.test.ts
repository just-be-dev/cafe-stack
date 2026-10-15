import { it } from "@effect/vitest";
import { Disclosure } from "@foldkit/ui";
import * as Schema from "effect/Schema";
import type { HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { click, expect, given, keydown, role, scene, selector, text } from "foldkit/scene";
import { modifyFields } from "foldkit/struct";
import type * as Update from "foldkit/update";

import { Trace } from "./trace";

const Model = Schema.Struct({
  isOpen: Schema.Boolean,
  isNestedOpen: Schema.Boolean,
  isDisabled: Schema.Boolean,
  keepMounted: Schema.Boolean,
  isAnimated: Schema.Boolean,
});
type Model = typeof Model.Type;

const Message = defineMessageUnion({
  ToggledOutput: { isOpen: Schema.Boolean },
  ToggledNestedOutput: { isOpen: Schema.Boolean },
});
type Message = typeof Message.Type;

const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ToggledOutput: ({ isOpen }) => ({ model: modifyFields(model, { isOpen: () => isOpen }) }),
    ToggledNestedOutput: ({ isOpen }) => ({
      model: modifyFields(model, { isNestedOpen: () => isOpen }),
    }),
  });

const initialModel = Model.make({
  isOpen: false,
  isNestedOpen: false,
  isDisabled: false,
  keepMounted: false,
  isAnimated: false,
});

const view = (model: Model, h: HtmlBuilder<Message>) =>
  Trace(
    { className: "max-w-md", attributes: [h.AriaLabel("Execution trace")] },
    [
      Trace.line(
        {},
        [
          Trace.icon({}, ["✓"], h),
          Trace.title({}, ["Installed packages"], h),
          Trace.description({}, ["2s"], h),
        ],
        h,
      ),
      Trace.line({ status: "error" }, [Trace.title({}, ["Failed to run lint"], h)], h),
      Trace.line({ status: "running" }, [Trace.title({}, ["Running build"], h)], h),
      Trace.line({ status: "pending" }, [Trace.title({}, ["Run tests"], h)], h),
      h.a([h.Href("#source")], [Trace.line({}, [Trace.title({}, ["Read the source"], h)], h)]),
      Trace.collapsible(
        {
          id: "output",
          isOpen: model.isOpen,
          onToggle: (isOpen) => Message.ToggledOutput({ isOpen }),
          isDisabled: model.isDisabled,
          keepMounted: model.keepMounted,
          isAnimated: model.isAnimated,
          className: "custom-wrapper",
          triggerClass: "custom-trigger",
          contentClass: "custom-content",
        },
        {
          trigger: [
            Trace.line(
              {},
              [Trace.icon({}, ["$"], h), Trace.title({}, ["Ran bun --version"], h)],
              h,
            ),
          ],
          content: [
            h.pre([], ["1.4.3"]),
            Trace(
              {},
              [
                Trace.collapsible(
                  {
                    id: "nested-output",
                    isOpen: model.isNestedOpen,
                    onToggle: (isOpen) => Message.ToggledNestedOutput({ isOpen }),
                  },
                  {
                    trigger: [Trace.line({}, [Trace.title({}, ["Show details"], h)], h)],
                    content: ["Nested output"],
                  },
                  h,
                ),
              ],
              h,
            ),
          ],
        },
        h,
      ),
    ],
    h,
  );

it("trace lines are text; links and disclosure triggers own their semantics", () => {
  scene(
    { update, view },
    given(initialModel),
    expect(selector('[data-slot="trace"]')).toHaveAttr("aria-label", "Execution trace"),
    expect(text("Installed packages")).not.toHaveAttr("tabindex"),
    expect(selector('[data-slot="trace-icon"]')).toHaveAttr("aria-hidden", "true"),
    expect(role("link", { name: "Read the source" })).toHaveAttr("href", "#source"),
    expect(selector('[data-status="error"]')).toContainText("Failed to run lint"),
    expect(selector('[data-status="running"]')).toContainText("Running build"),
    expect(selector('[data-status="pending"]')).toContainText("Run tests"),
    expect(role("button", { name: "Ran bun --version" })).toHaveAttr("type", "button"),
    expect(role("button", { name: "Ran bun --version" })).toHaveAttr("aria-expanded", "false"),
    expect(selector("#output-panel")).toBeAbsent(),
    click(role("button", { name: "Ran bun --version" })),
    expect(role("button", { name: "Ran bun --version" })).toHaveAttr(
      "aria-controls",
      "output-panel",
    ),
    expect(text("1.4.3")).toBeVisible(),
    expect(selector('[data-slot="trace-collapsible-content-inner"]')).toHaveClass("custom-content"),
    keydown(role("button", { name: "Ran bun --version" }), "Enter"),
    expect(selector("#output-panel")).toBeAbsent(),
    keydown(role("button", { name: "Ran bun --version" }), " "),
    expect(text("1.4.3")).toBeVisible(),
  );
});

it("disabled disclosure removes pointer and keyboard activation handlers", () => {
  scene(
    { update, view },
    given(modifyFields(initialModel, { isDisabled: () => true })),
    expect(role("button", { name: "Ran bun --version" })).toBeDisabled(),
    expect(role("button", { name: "Ran bun --version" })).not.toHaveHandler("click"),
    expect(role("button", { name: "Ran bun --version" })).not.toHaveHandler("keydown"),
    expect(role("button", { name: "Ran bun --version" })).toHaveAttr("aria-expanded", "false"),
    expect(selector("#output-panel")).toBeAbsent(),
  );
});

it("kept panels are inert while closed and retain nested state across toggles", () => {
  scene(
    { update, view },
    given(modifyFields(initialModel, { keepMounted: () => true })),
    expect(selector("#output-panel")).toExist(),
    expect(selector("#output-panel")).toHaveAttr("hidden"),
    expect(selector("[inert]")).toHaveAttr("aria-hidden", "true"),
    click(role("button", { name: "Ran bun --version" })),
    expect(selector("#output-panel")).not.toHaveAttr("hidden"),
    click(role("button", { name: "Show details" })),
    expect(text("Nested output")).toBeVisible(),
    click(role("button", { name: "Ran bun --version" })),
    expect(selector("[inert]")).toHaveAttr("aria-hidden", "true"),
    click(role("button", { name: "Ran bun --version" })),
    expect(role("button", { name: "Show details" })).toHaveAttr("aria-expanded", "true"),
    expect(text("Nested output")).toBeVisible(),
  );
});

it("animated panels remain mounted and inert independently of keepMounted", () => {
  scene(
    { update, view },
    given(modifyFields(initialModel, { isAnimated: () => true })),
    expect(selector("#output-panel")).toExist(),
    expect(selector("[inert]")).toHaveAttr("aria-hidden", "true"),
    expect(selector("#output-panel")).not.toHaveAttr("hidden"),
    click(role("button", { name: "Ran bun --version" })),
    expect(selector("[inert]")).toBeAbsent(),
    click(role("button", { name: "Ran bun --version" })),
    expect(selector("#output-panel")).toExist(),
    expect(selector("[inert]")).toHaveAttr("aria-hidden", "true"),
  );
});

const customView = (model: Model, h: HtmlBuilder<Message>) =>
  Disclosure.view(
    {
      id: "custom-output",
      isOpen: model.isOpen,
      onToggle: (isOpen) => Message.ToggledOutput({ isOpen }),
      toView: (disclosure) =>
        Trace(
          {},
          [
            Trace.collapsibleTrigger(
              { disclosure },
              [Trace.line({}, [Trace.title({}, ["Show custom output"], h)], h)],
              h,
            ),
            model.isOpen ? Trace.collapsibleContent({ disclosure }, ["Custom output"], h) : h.empty,
          ],
          h,
        ),
    },
    h,
  );

it("custom layouts receive disclosure semantics through required bundles", () => {
  scene(
    { update, view: customView },
    given(initialModel),
    expect(role("button", { name: "Show custom output" })).toHaveAttr("type", "button"),
    click(role("button", { name: "Show custom output" })),
    expect(role("button", { name: "Show custom output" })).toHaveAttr(
      "aria-controls",
      "custom-output-panel",
    ),
    expect(selector("#custom-output-panel")).toContainText("Custom output"),
    keydown(role("button", { name: "Show custom output" }), "Enter"),
    expect(selector("#custom-output-panel")).toBeAbsent(),
  );
});
