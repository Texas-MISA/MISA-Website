// Form controls: the label/error wrapper and the three input skins.
//
// 📌 This replaces a genuinely surprising amount of duplication. A local
// `Field` component was redefined VERBATIM in nine files (seven under /admin,
// plus /attend and /lookup), and `inputClass` / `selectClass` / `fieldClass` /
// `controlClass` were redeclared as local constants in eleven files — carrying
// only four distinct values between them. Nothing was shared because
// `components/ui/` had no form vocabulary to share.
//
// 📌 The skin follows DESIGN.md's Text Field: a Vellum interior, square, at the
// FRAME border weight (1px `--misa-border`) rather than the heavier
// `border-black/70` the admin had been shipping.
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

import type {
  InputHTMLAttributes,
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
const CONTROL =
  "border border-misa-border bg-misa-panel text-foreground transition-colors duration-150 " +
  "placeholder:text-misa-secondary hover:border-misa-blue/50 focus:border-misa-blue " +
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
 * Label, optional hint, control, optional error — wrapped in a `<label>`, so
 * the association needs no id plumbing at the call site.
 */
export function Field({ label, children, error, hint, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`.trim()}>
      <span className="font-medium text-foreground">{label}</span>
      {hint ? <span className="text-xs text-misa-muted">{hint}</span> : null}
      {children}
      {error ? (
        <span role="alert" className="text-xs text-misa-critical">
          {error}
        </span>
      ) : null}
    </label>
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

export function Select({ density = "md", className = "", ...rest }: SelectProps) {
  return (
    <select className={controlClass(density, `w-full ${className}`)} {...rest} />
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
