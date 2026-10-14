import { Button as FoldkitButton } from "@foldkit/ui";
import type { Attribute, Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";

/** Button variant keys. Sync with `buttonVariants` is compiler-enforced:
 *  `buttonVariants` is `Record<ButtonVariant, string>` (missing key = error)
 *  and annotated object literals reject unknown keys. */
export const buttonVariantKeys = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;

export const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  destructive:
    "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
  outline:
    "border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
  ghost:
    "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
  link: "text-primary underline-offset-4 hover:underline",
};

export type ButtonVariant = (typeof buttonVariantKeys)[number];

/** Button size keys. Sync with `buttonSizes` is compiler-enforced (see above). */
export const buttonSizeKeys = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const;

export const buttonSizes: Record<ButtonSize, string> = {
  default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
  icon: "size-8",
  "icon-xs":
    "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
  "icon-lg": "size-9",
};

export type ButtonSize = (typeof buttonSizeKeys)[number];

const buttonBase =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

/** The button's classes, for a link that should look like one. */
export const buttonClass = (
  config: Readonly<{ variant?: ButtonVariant; size?: ButtonSize; className?: string }>,
) =>
  cn(
    buttonBase,
    buttonVariants[config.variant ?? "default"],
    buttonSizes[config.size ?? "default"],
    config.className,
  );

export type ButtonConfig<M> = Readonly<{
  onClick?: M;
  isDisabled?: boolean;
  type?: "button" | "submit" | "reset";
  isAutofocus?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Extra attributes merged onto the button element (ids, handlers,
   *  popoover anchors, …). */
  attributes?: ReadonlyArray<Attribute<M>>;
}>;

export type ButtonLabel = Html | string | ReadonlyArray<Html | string>;

/** Styled button built on the @foldkit/ui Button helper. */
export const button = <M>(config: ButtonConfig<M>, label: ButtonLabel, h: HtmlBuilder<M>): Html =>
  FoldkitButton.view<M>(
    {
      onClick: config.onClick,
      isDisabled: config.isDisabled,
      type: config.type,
      isAutofocus: config.isAutofocus,
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(buttonClass(config)),
            h.DataAttribute("slot", "button"),
            ...(config.attributes ?? []),
          ],
          Array.isArray(label) ? label : [label],
        ),
    },
    h,
  );
