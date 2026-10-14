import { Textarea as FoldkitTextarea } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";

export const textareaClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-disabled:bg-input/50 data-disabled:bg-input/50 dark:aria-disabled:bg-input/80 dark:data-disabled:bg-input/80 flex field-sizing-content min-h-16 w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50";

/** Same string as the `label` item's component classes (upstream label.tsx). */
/** Upstream string re-keyed for foldkit: the label precedes the control, so
 *  upstream's native peer-disabled sibling variant can never match; disabled
 *  state flows from the wrapper (group/field + data-disabled, mirroring
 *  switch.ts). */
export const textareaLabelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:cursor-not-allowed group-data-[disabled]/field:opacity-50";

export const textareaDescriptionClass = "text-sm text-muted-foreground";

export const textareaWrapperClass = "group/field flex flex-col gap-1.5 w-full";

export type TextareaConfig<M> = Readonly<{
  id: string;
  label: string;
  description?: string;
  onInput?: (value: string) => M;
  value?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isAutofocus?: boolean;
  name?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** Styled textarea with label and optional description, built on the
 *  @foldkit/ui Textarea helper. */
export const textarea = <M>(config: TextareaConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitTextarea.view<M>(
    {
      id: config.id,
      hasDescription: config.description !== undefined,
      onInput: config.onInput,
      value: config.value,
      isDisabled: config.isDisabled,
      isReadOnly: config.isReadOnly,
      isInvalid: config.isInvalid,
      isAutofocus: config.isAutofocus,
      name: config.name,
      rows: config.rows,
      placeholder: config.placeholder,
      toView: (attributes) =>
        h.div(
          [
            h.Class(cn(textareaWrapperClass, config.wrapperClass)),
            ...(config.isDisabled ? [h.DataAttribute("disabled", "")] : []),
          ],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute("slot", "label"),
                h.Class(cn(textareaLabelClass, config.labelClass)),
              ],
              [config.label],
            ),
            h.textarea([
              ...attributes.textarea,
              h.DataAttribute("slot", "textarea"),
              h.Class(cn(textareaClass, config.className)),
            ]),
            config.description === undefined
              ? h.empty
              : h.span(
                  [
                    ...attributes.description,
                    h.Class(cn(textareaDescriptionClass, config.descriptionClass)),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  );
