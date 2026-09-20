// Form controls: the label/error wrapper and the three input skins.
//
// 📌 This replaces a genuinely surprising amount of duplication. A local
// `Field` component was redefined VERBATIM in nine files (seven under /admin,
// plus /attend and /lookup), and `inputClass` / `selectClass` / `fieldClass` /
// `controlClass` were redeclared as local constants in eleven files — carrying
// only four distinct values between them. Nothing was shared because
// `components/ui/` had no form vocabulary to share.
//
// ⚠️ **Two of those nine outlived the extraction and were only folded in at v2
// phase 4** — the resolution form's and the custom-field form's, both now thin
// adapters that reshape `error` and nothing else. Each had drifted while it
// sat there: one gave its errors no `role="alert"` and coloured them
// `--misa-caution` on a field that had just refused a save, and the other put
// its hint inside the `<label>`, which is the accessible-name bug the component
// doc below describes. **A duplicate left standing does not stay still.**
//
// 📌 The skin follows DESIGN.md's Text Field: a Vellum interior, square, at a
// 1px edge rather than the heavier `border-black/70` the admin had been
// shipping. ⚠️ That edge was `--misa-border`, the card Frame, until v2 phase 3
// round 1a measured it at 1.51:1 and moved it to `--misa-control-edge` — see
// the note on `CONTROL` below, which is where the 3:1 argument lives.
//
// 🪤 **These components are deliberately thin, and that is a correctness
// requirement rather than minimalism.** Three form invariants in this codebase
// are broken by exactly the kind of helpfulness a form library adds:
//
//   • `name` and `defaultValue` pass straight through. React 19 resets an
//     uncontrolled `<form action={…}>` once the action resolves, so every
//     `defaultValue` is driven from echoed-back server state — and must be a
//     STRING, never `undefined`, or the field silently becomes uncontrolled.
//     Nothing here defaults, coerces, or remembers a value.
//   • No wrapper renders a hidden input. There is one carrier per field name;
//     a hidden input earlier in the form wins `formData.get()`, so an invisible
//     second carrier is a data bug that looks like a rendering bug.
//   • No component here renders its own submit button. Never put `formAction`
//     on a submit button whose `name`/`value` is read — React drops the
//     submitter's name from the FormData.

import { Children, cloneElement, isValidElement, useId } from "react";
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * The shared control skin.
 *
 * `aria-invalid` drives the error border, so the visual state and the state
 * assistive technology is told cannot drift apart — there is no separate
 * `invalid` prop to forget.
 */
// 🪤 No `w-full` here. `Input` / `Select` / `Textarea` add it, because a form
// field should fill its column — but the officer filter bars call
// `controlClass` directly for controls that sit inline in a flex row, and a
// forced full width there stretches a six-control row into six stacked ones.
// 🪤 The placeholder is Secondary Graphite, not Annotation Grey, and that is a
// contrast fix rather than a preference. Annotation Grey (#6f7275) is 4.84:1 on
// Paper — fine — but only **4.33:1 on the Vellum interior these controls now
// have**, which fails AA for placeholder text. Secondary (#4a4d50) is 7.60:1 on
// the same ground. Measure a grey against the ground it actually sits on: this
// one passed everywhere it was used until the day the field ground changed.
// 🔓 **The border is `--misa-control-edge`, not `--misa-border`, and that is
// WCAG 1.4.11 rather than taste** (v2 phase 3, round 1a). The skin note above
// says the frame is "the FRAME border weight (1px `--misa-border`)"; it no
// longer is, and the reason is that a control has a bar a card does not.
// 1.4.11 wants 3:1 from the colours ADJACENT to the thing that identifies a
// component, and an input has two of them at once: the sheet outside and its
// own Vellum interior inside. Frame failed on both under either reading of
// what an alpha border composites against: over the control's own fill (what
// `background-clip: border-box` actually paints) it is `#c7c7c8`, **1.69:1 vs
// the sheet and 1.51:1 vs the fill**; over white it is `#d2d2d2`, **1.51:1 and
// 1.35:1**. The fill is 1.12:1 from a white sheet, so an EMPTY input was a
// rectangle with no measurable edge. `--misa-control-edge` (`#858687`) is
// opaque — one reading — and measures **3.65:1 on Paper, 3.26:1 on Vellum**.
// The token comment in `globals.css` carries the derivation and the argument
// for leaving the global Frame token where it is.
//
// 🪤 **The HOVER border had to move with it, or hovering made the boundary
// worse than not hovering.** `misa-blue/50` composites to 2.92:1 on white and
// 2.85:1 on the fill — it FAILED the same 3:1 the rest state now meets, so a
// control that passed at rest dropped below the bar exactly when the pointer
// was on it. `/55` is the smallest step that clears both (**3.36:1** and
// **3.24:1**), solved rather than picked. Focus is solid navy at 13.03:1 and
// `aria-invalid` is Critical at 8.63:1; both were already clear.
//
// 📌 Measured on the running site before and after, on `/portal/attend`'s white
// sheet and across 77 controls on nine `/admin` screens — every one of which
// sits on white, inside a Panel, not on the grey page ground. The token clears
// 3:1 on both anyway, so a control placed directly on `/admin`'s Vellum `<main>`
// is covered too.
const CONTROL =
  "border border-misa-control-edge bg-misa-panel text-foreground transition-colors duration-150 " +
  "placeholder:text-misa-secondary hover:border-misa-blue/55 focus:border-misa-blue " +
  "aria-invalid:border-misa-critical " +
  "disabled:pointer-events-none disabled:opacity-50";

/**
 * `md` is the touch-sized default and the right choice on any member-facing
 * form. `sm` is for the dense officer toolbars, where a filter row carries six
 * controls and vertical space is the scarce thing. `xs` is for a control that
 * lives inside a table cell.
 *
 * ⚠️ 16px (`text-base`) on `md` is not a style choice — iOS Safari zooms the
 * viewport when a focused input's text is smaller, and /attend is used
 * standing up on a phone.
 */
const CONTROL_SIZE = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-2 text-sm",
  md: "px-3 py-3 text-base",
} as const;

export type ControlSize = keyof typeof CONTROL_SIZE;

export function controlClass(size: ControlSize = "md", className = ""): string {
  return [CONTROL, CONTROL_SIZE[size], className].filter(Boolean).join(" ");
}

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  /** Rendered with `role="alert"` beneath the control. */
  error?: string | null;
  /** Static guidance. Shown above the control, so it is read before typing. */
  hint?: ReactNode;
  className?: string;
};

/**
 * Label, optional hint, control, optional error. **The call site passes no id** —
 * this component generates one and wires the explicit `<label htmlFor>` itself.
 *
 * *(It wrapped everything in a `<label>` for implicit association until v2
 * phase 4; the paragraph below is why that had to change.)*
 *
 * 🐛 **The hint and the error sit OUTSIDE the `<label>`, and that is an
 * accessible-name fix rather than a layout preference.** Everything inside a
 * `<label>` becomes part of the control's name, so a field with a hint was
 * announced as *"Label What officers see — the column header and the field
 * name. Safe to change at any time."* — one run-on string, with the actual
 * label buried at the front. The hint is guidance ABOUT the control, which is
 * what `aria-describedby` is for; it is read after the name, separately, and
 * only when the person wants it.
 *
 * 🪤 **The hint keeps its position above the control** — that placement is a
 * decision ("so it is read before typing"), and only the DOM nesting changed.
 * The `<label>` is explicit now rather than wrapping, so the component threads
 * the id itself and the call site still passes none.
 */
export function Field({
  label,
  children,
  error,
  hint,
  className = "",
}: FieldProps) {
  // `useId` rather than a counter: two Fields with the same label render on one
  // screen (the directory's min/max pair), and a colliding id would point both
  // controls at one description.
  const id = useId();
  const controlId = `${id}-control`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  // 🪤 **The FIRST element child is the control, not `children` itself.** Two
  // call sites pass a `<select>` followed by an explanatory `<p>`, which makes
  // `children` an array — treating it as a single element there would leave the
  // label pointing at nothing and silently un-name the control. Walking the
  // array is what keeps the explicit `htmlFor` as reliable as the wrapping
  // `<label>` it replaced.
  //
  // A call site that sets its own `id` wins: the props spread comes last.
  const list = Children.toArray(children);
  const controlIndex = list.findIndex((child) => isValidElement(child));
  const labelled = controlIndex !== -1;
  const control = labelled
    ? list.map((child, i) =>
        i === controlIndex
          ? cloneElement(
              child as ReactElement<{
                id?: string;
                "aria-describedby"?: string;
              }>,
              {
                id: controlId,
                "aria-describedby": describedBy,
                ...((child as ReactElement).props as object),
              },
            )
          : child,
      )
    : children;

  return (
    <div className={`flex flex-col gap-1 text-sm ${className}`.trim()}>
      <label
        htmlFor={labelled ? controlId : undefined}
        className="font-medium text-foreground"
      >
        {label}
      </label>
      {hint ? (
        <span id={hintId} className="text-xs text-misa-muted">
          {hint}
        </span>
      ) : null}
      {control}
      {error ? (
        <span id={errorId} role="alert" className="text-xs text-misa-critical">
          {error}
        </span>
      ) : null}
    </div>
  );
}

// 🪤 The size prop is called `density`, not `size`, and the reason is a type
// error rather than taste: `<input>` and `<select>` both HAVE a native `size`
// attribute (a character width, and a visible-row count). Intersecting our
// union with that `number` collapses the prop to `never`, so every call site
// fails to compile at once — and shadowing it instead would quietly take a
// working HTML attribute away from every future caller.

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  density?: ControlSize;
};

export function Input({ density = "md", className = "", ...rest }: InputProps) {
  return (
    <input className={controlClass(density, `w-full ${className}`)} {...rest} />
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  density?: ControlSize;
};

export function Select({
  density = "md",
  className = "",
  ...rest
}: SelectProps) {
  return (
    <select
      className={controlClass(density, `w-full ${className}`)}
      {...rest}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  density?: ControlSize;
};

export function Textarea({
  density = "md",
  className = "",
  ...rest
}: TextareaProps) {
  return (
    <textarea
      className={controlClass(density, `w-full ${className}`)}
      {...rest}
    />
  );
}

/**
 * The checkbox and radio skin. Native controls, tinted to the brand.
 *
 * 📌 Worth having as a constant because the app currently styles them three
 * ways: `size-4 accent-black`, `mt-1 size-4`, and — in the attendance table's
 * select-all and row boxes — not at all.
 */
export const CHECKBOX = "size-4 shrink-0 accent-misa-blue";
