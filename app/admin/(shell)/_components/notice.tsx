// The admin's name for `components/ui/banner.tsx`.
//
// 📌 The panel itself moved into the shared vocabulary — /admin and the public
// pages had been drawing the same idea at two different rule weights. This file
// stays because twelve admin files import `Notice` / `ReadError` by name and
// those names read correctly at the point of use; it is an alias now, not a
// definition.
//
// ⚠️ **The tone names differ from the shared component's on purpose.** `warning`
// / `error` / `success` describe what happened; `caution` / `critical` /
// `affirm` describe how loudly to say it. Both vocabularies are right for their
// side of the boundary, and the mapping is here so neither has to bend.

import { Banner, ReadError as SharedReadError } from "@/components/ui/banner";
import type { BannerTone } from "@/components/ui/banner";

const TONE_MAP = {
  /** Neutral: an empty list, an explanation, a "nothing to do here". */
  info: "info",
  /** Something needs an officer's attention, but nothing is broken. */
  warning: "caution",
  /** 🔓 A READ FAILED. Never reuse `info` for this — that is the whole point. */
  error: "critical",
  /** An action succeeded. */
  success: "affirm",
} as const satisfies Record<string, BannerTone>;

export type NoticeTone = keyof typeof TONE_MAP;

export function Notice({
  tone = "info",
  className = "",
  role,
  children,
}: {
  tone?: NoticeTone;
  className?: string;
  /**
   * Left unset by default. An empty state is not an alert, and announcing every
   * "no rows match" to a screen reader is noise. Pass `role="alert"` where the
   * message is the result of something the officer just did.
   */
  role?: "alert" | "status";
  children: React.ReactNode;
}) {
  return (
    <Banner tone={TONE_MAP[tone]} className={className} role={role}>
      {children}
    </Banner>
  );
}

/**
 * The standard "we could not read this" message.
 *
 * A component rather than a string so the wording stays consistent, and so the
 * distinction from an empty state is structural: you cannot render this by
 * accident when you meant "nothing here".
 */
export const ReadError = SharedReadError;
