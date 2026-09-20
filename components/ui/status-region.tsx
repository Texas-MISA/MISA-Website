// The always-mounted announcement region — v2 phase 3, the Portal Rebuild.
//
// 📌 **Two callers, and both briefs prescribe the same answer.**
// `/portal/attend` (EV11) and `/portal/lookup` (EV7) each need one atomic
// status message, and the lookup brief says so in as many words: "the same
// answer check-in's brief gives, so the portal solves this once."
//
// 🪤 **A live region must be in the DOM BEFORE its contents change.** This is
// the invariant this component exists to make unforgettable. A node that MOUNTS
// already carrying its text is not an announcement — assistive technology sees
// a new element appear, not a region whose contents changed, and says nothing.
// That is exactly what `/portal/attend` does today: `ResultPanel` and
// `ReviewPanel` both mount already carrying `role="status"` and their heading,
// so the one screen telling a member their attendance was recorded may announce
// nothing at all.
//
// 🪤 **So it is a SEPARATE region, never a role on the message node**, and never
// a WRAPPER around conditional siblings. An empty wrapper inside a
// `flex … gap-*` row is still a flex item and still contributes a gap, so an
// invisible announcer would push the layout around whenever it was empty.
// `sr-only` is absolutely positioned and moves nothing, which is why it is the
// right hiding mechanism here and `hidden` is not — `hidden` content is not
// announced.
//
// 🪤 **Render it unconditionally.** `{message && <StatusRegion …>}` re-creates
// the exact defect above: the region would mount with its text already in
// place. Pass an empty string instead; an empty region announces nothing and
// costs nothing.
//
// 📌 **`aria-atomic` so the whole sentence is read**, not the words that
// changed. An outcome is one statement — "You're checked in" — and a partial
// re-read of a diff is not a sentence anyone can act on.

export function StatusRegion({
  /**
   * The sentence to announce. Empty until there is an outcome; always a
   * string, never `undefined`, so the region's contents CHANGE rather than
   * the node appearing.
   */
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <p role="status" aria-atomic="true" className={`sr-only ${className}`.trim()}>
      {message}
    </p>
  );
}
