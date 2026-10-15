import { Disclosure } from "@foldkit/ui";
import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";

type Child = Html | string;

export type TraceStatus = "running" | "error" | "pending";

export type TracePartConfig<M> = Readonly<{
  className?: string;
  attributes?: ReadonlyArray<Attribute<M>>;
}>;

export type TraceLineConfig<M> = TracePartConfig<M> & Readonly<{ status?: TraceStatus }>;

export const traceClass =
  "flex w-full min-w-0 flex-col gap-2 *:has-[>[data-slot=trace-line]]:flex *:has-[>[data-slot=trace-line]]:w-fit *:has-[>[data-slot=trace-line]]:max-w-full *:has-[>[data-slot=trace-line]]:min-w-0 *:has-[>[data-slot=trace-line]]:rounded-md *:has-[>[data-slot=trace-line]]:text-left *:has-[>[data-slot=trace-line]]:outline-none *:has-[>[data-slot=trace-line]]:focus-visible:ring-3 *:has-[>[data-slot=trace-line]]:focus-visible:ring-ring/50";

export const traceLineClass =
  "flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors in-[a,button]:cursor-pointer in-[a:hover,button:hover]:text-foreground data-[status=error]:text-destructive data-[status=error]:in-[a:hover,button:hover]:text-destructive data-[status=pending]:opacity-60 data-[status=running]:*:data-[slot=trace-title]:trace-shimmer";

export const traceIconClass =
  "flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [[data-slot=trace-title]~&]:-ml-1";

export const traceTitleClass = "min-w-0 truncate motion-reduce:trace-shimmer-none";

export const traceDescriptionClass = "shrink-0 text-muted-foreground/70 tabular-nums";

export const traceCollapsibleClass =
  "flex w-full min-w-0 flex-col [&>div]:motion-reduce:transition-none!";

export const traceCollapsibleTriggerClass =
  "group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 has-[[data-status=error]]:text-destructive aria-disabled:pointer-events-none aria-disabled:opacity-50";

export const traceCollapsibleContentClass = "min-w-0 overflow-hidden";

export const traceCollapsibleContentInnerClass =
  "mt-2 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 border-l border-border pr-1 pl-4 text-sm leading-relaxed wrap-break-word text-muted-foreground";

const traceContainer = <M>(
  config: TracePartConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cn(traceClass, config.className)),
      h.DataAttribute("slot", "trace"),
      ...(config.attributes ?? []),
    ],
    children,
  );

const traceLine = <M>(
  config: TraceLineConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(traceLineClass, config.className)),
      h.DataAttribute("slot", "trace-line"),
      ...(config.status === undefined ? [] : [h.DataAttribute("status", config.status)]),
      ...(config.attributes ?? []),
    ],
    children,
  );

const traceIcon = <M>(
  config: TracePartConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(traceIconClass, config.className)),
      h.DataAttribute("slot", "trace-icon"),
      h.AriaHidden(true),
      ...(config.attributes ?? []),
    ],
    children,
  );

const traceTitle = <M>(
  config: TracePartConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(traceTitleClass, config.className)),
      h.DataAttribute("slot", "trace-title"),
      ...(config.attributes ?? []),
    ],
    children,
  );

const traceDescription = <M>(
  config: TracePartConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(traceDescriptionClass, config.className)),
      h.DataAttribute("slot", "trace-description"),
      ...(config.attributes ?? []),
    ],
    children,
  );

export type TraceCollapsibleTriggerConfig<M> = TracePartConfig<M> &
  Readonly<{
    disclosure: Pick<Disclosure.DisclosureAttributes<M>, "button">;
  }>;

const traceCollapsibleTrigger = <M>(
  config: TraceCollapsibleTriggerConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.button(
    [
      ...config.disclosure.button,
      h.Class(cn(traceCollapsibleTriggerClass, config.className)),
      h.DataAttribute("slot", "trace-collapsible-trigger"),
      ...(config.attributes ?? []),
    ],
    [
      ...children,
      traceIcon(
        {
          className:
            "transition-transform motion-reduce:transition-none group-aria-expanded/trace-collapsible-trigger:rotate-90",
        },
        [
          h.svg(
            [
              h.ViewBox("0 0 24 24"),
              h.Fill("none"),
              h.Stroke("currentColor"),
              h.StrokeWidth("2"),
              h.StrokeLinecap("round"),
              h.StrokeLinejoin("round"),
              h.Attribute("focusable", "false"),
            ],
            [h.path([h.D("m9 18 6-6-6-6")])],
          ),
        ],
        h,
      ),
    ],
  );

export type TraceCollapsibleContentConfig<M> = TracePartConfig<M> &
  Readonly<{
    disclosure: Pick<Disclosure.DisclosureAttributes<M>, "panel">;
  }>;

const traceCollapsibleContent = <M>(
  config: TraceCollapsibleContentConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      ...config.disclosure.panel,
      h.Class(traceCollapsibleContentClass),
      h.DataAttribute("slot", "trace-collapsible-content"),
      ...(config.attributes ?? []),
    ],
    [
      h.div(
        [
          h.Class(cn(traceCollapsibleContentInnerClass, config.className)),
          h.DataAttribute("slot", "trace-collapsible-content-inner"),
        ],
        children,
      ),
    ],
  );

export type TraceCollapsibleConfig<M> = TracePartConfig<M> &
  Omit<Disclosure.ViewConfig<M>, "toView"> &
  Readonly<{
    keepMounted?: boolean;
    isAnimated?: boolean;
    triggerClass?: string;
    contentClass?: string;
  }>;

export type TraceCollapsibleChildren = Readonly<{
  trigger: ReadonlyArray<Child>;
  content: ReadonlyArray<Child>;
}>;

/** Controlled disclosure: store isOpen in the parent Model and handle onToggle in update.
 * keepMounted retains closed content; isAnimated retains it for height transitions. */
const traceCollapsible = <M>(
  config: TraceCollapsibleConfig<M>,
  children: TraceCollapsibleChildren,
  h: HtmlBuilder<M>,
): Html =>
  Disclosure.view(
    {
      id: config.id,
      isOpen: config.isOpen,
      onToggle: config.onToggle,
      isDisabled: config.isDisabled,
      ariaLabel: config.ariaLabel,
      ariaLabelledBy: config.ariaLabelledBy,
      toView: (disclosure) =>
        h.div(
          [
            h.Class(cn(traceCollapsibleClass, config.className)),
            h.DataAttribute("slot", "trace-collapsible"),
            ...(config.attributes ?? []),
          ],
          [
            traceCollapsibleTrigger(
              { className: config.triggerClass, disclosure },
              children.trigger,
              h,
            ),
            config.isAnimated
              ? disclosure.animatePanel(
                  traceCollapsibleContent(
                    { className: config.contentClass, disclosure },
                    children.content,
                    h,
                  ),
                )
              : config.isOpen || config.keepMounted
                ? traceCollapsibleContent(
                    {
                      className: config.contentClass,
                      disclosure,
                      attributes: config.isOpen
                        ? []
                        : [h.Hidden(true), h.Inert(true), h.AriaHidden(true)],
                    },
                    children.content,
                    h,
                  )
                : h.empty,
          ],
        ),
    },
    h,
  );

/** Foldkit port of shadcn/ui's Base UI Trace (base-nova styling).
 * https://ui.shadcn.com/docs/components/base/trace */
export const Trace = Object.assign(traceContainer, {
  line: traceLine,
  icon: traceIcon,
  title: traceTitle,
  description: traceDescription,
  collapsible: traceCollapsible,
  collapsibleTrigger: traceCollapsibleTrigger,
  collapsibleContent: traceCollapsibleContent,
});
