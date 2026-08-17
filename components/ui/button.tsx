// Button and link styling, as class strings rather than components.
//
// Every call site is already an <a href="mailto:…">, a <Link>, or a real
// <button> with its own behaviour, so wrapping them would mean a component per
// element type. The shared thing here is the skin, and this is it.
//
// 📌 Square corners, no shadow, uppercase Barlow Condensed — the system has no
// radii anywhere. The hover, pressed and disabled states are this codebase's
// addition: the prototypes define no hover on buttons at all, and the handoff
// says to add them off the navy ramp.
//
// 📌 `buttonClass()` is new and is the single source of truth; the six exported
// constants below are now derived from it rather than hand-written. They were
// six independent strings with three different horizontal paddings (`px-6`,
// `px-[30px]`, `px-[22px]`) and two verticals, which is a scale nobody chose.
// /admin had a seventh, eighth and ninth dialect on top of that — 37 pill
// buttons and four local `buttonClass` constants — and they all resolve here.
//
// 🪤 **Press feedback is an ink change, never a transform.** emil-design-eng
// recommends `scale(0.97)` on `:active` and wins on motion generally, but
// DESIGN.md's Square Corner / flat-at-rest rules ban a scale on a control
// outright, and that is the pinned aesthetic. What emil DOES get here is the
// timing: 150ms, the duration it specifies for a colour swap.

/** Ink-change-only transition. Nothing in this system moves on interaction. */
const BASE =
  "inline-flex items-center justify-center gap-2 font-display leading-none font-semibold uppercase transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

export type ButtonVariant =
  /** The primary action on a white ground. */
  | "primary"
  /** Secondary on a white ground — the outline is completed, not tinted. */
  | "outline"
  /** Tertiary on a white ground. The hairline weight, for dense toolbars. */
  | "quiet"
  /** Destructive: void, revoke, remove access. */
  | "danger"
  /** The primary action inside a navy band. */
  | "onNavy"
  /** Secondary inside a navy band. */
  | "onNavyOutline";

export type ButtonSize =
  /** Header, table rows, inline toolbars. */
  | "sm"
  /** The default. */
  | "md"
  /** Page-level calls to action. */
  | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-misa-blue text-white hover:bg-misa-blue-dark active:bg-misa-blue-dark",
  outline:
    "border border-misa-blue text-misa-blue hover:bg-misa-blue hover:text-white active:bg-misa-blue-dark active:text-white",
  quiet:
    "border border-misa-border text-misa-secondary hover:border-misa-blue hover:text-misa-blue active:bg-misa-panel",
  danger:
    "border border-misa-critical text-misa-critical hover:bg-misa-critical hover:text-white active:bg-misa-critical active:text-white",
  onNavy:
    "bg-white text-misa-blue hover:bg-white/85 active:bg-white/75",
  onNavyOutline:
    "border border-white/45 text-white hover:bg-white hover:text-misa-blue active:bg-white/85 active:text-misa-blue",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13px] tracking-[0.06em]",
  md: "px-6 py-3 text-[15px] tracking-[0.1em]",
  lg: "px-8 py-3.5 text-[15px] tracking-[0.1em]",
};

export type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fill the container — full-width submits on narrow forms. */
  block?: boolean;
  className?: string;
};

/**
 * The one place a button skin is assembled.
 *
 * ⚠️ For a disabled `<a>` (a download link, most often) `disabled:` never
 * matches, because an anchor cannot be disabled. Use
 * `pointer-events-none opacity-50` plus `aria-disabled` at the call site —
 * `app/admin/(shell)/_components/export-controls.tsx` is the model.
 */
export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
}: ButtonClassOptions = {}): string {
  return [BASE, VARIANT[variant], SIZE[size], block ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

/* ── Named constants ───────────────────────────────────────────────────────
   Kept because ~40 public call sites import them by name and they read well at
   the point of use. They are aliases now, not definitions. */

/** Primary action on a white ground. */
export const BUTTON_SOLID_NAVY = buttonClass({ variant: "primary", size: "md" });

/** The compact version, for the header's Check In. */
export const BUTTON_SOLID_NAVY_SM = buttonClass({
  variant: "primary",
  size: "sm",
});

/** Primary action on a navy band. */
export const BUTTON_SOLID_WHITE = buttonClass({ variant: "onNavy", size: "lg" });

/** Secondary action on a navy band. */
export const BUTTON_OUTLINE_WHITE = buttonClass({
  variant: "onNavyOutline",
  size: "lg",
});

/** Secondary action on a white ground — fills navy on hover. */
export const BUTTON_OUTLINE_NAVY = buttonClass({
  variant: "outline",
  size: "lg",
});

/* ── Officer-side names ────────────────────────────────────────────────────
   /admin had its own button vocabulary — 37 `rounded-full` pills across 26
   files in three sizes, plus four local `buttonClass` / `dangerButton` /
   `plainButton` constants — because `components/ui/` had nothing it could
   reach for. These are the same six variants under names that read correctly
   in a toolbar, and they resolve to the same square, stamped skin as the
   public pages.

   ⚠️ `BUTTON_QUIET_SM` replaces `border border-black/70`, which was the
   admin's secondary weight. Pure black is not in this palette; Frame
   (`--misa-border`) is what encloses things here. */

/** The default officer action: table-row buttons, toolbar actions. */
export const BUTTON_PRIMARY_SM = buttonClass({ variant: "primary", size: "sm" });

/** Form submits and page-level actions. */
export const BUTTON_PRIMARY = buttonClass({ variant: "primary", size: "md" });

/** Secondary. Was `rounded-full border border-black/70 …`. */
export const BUTTON_QUIET_SM = buttonClass({ variant: "quiet", size: "sm" });

export const BUTTON_QUIET = buttonClass({ variant: "quiet", size: "md" });

/** Secondary form action, where the outline should read as an alternative. */
export const BUTTON_OUTLINE = buttonClass({ variant: "outline", size: "md" });

/** Void, revoke, remove access. */
export const BUTTON_DANGER_SM = buttonClass({ variant: "danger", size: "sm" });

/** Inside the navy admin bar — sign out. */
export const BUTTON_ON_NAVY_SM = buttonClass({
  variant: "onNavyOutline",
  size: "sm",
});

/** The small "See all photos →" / "All projects →" section links. */
export const LINK_EYEBROW =
  "font-display text-[13px] leading-none font-semibold tracking-[0.08em] uppercase transition-colors duration-150";
