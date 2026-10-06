import { Pill } from "@/components/ui/pill";
import { formatProjectEligibility } from "@/lib/member-types";

// The project-eligibility verdict as a mark (migration 30) — one rendering for
// the directory row and the member page, so "No" cannot read one way in the
// table and another on the page beside it.
//
// No "use client", and nothing that needs it: a pure function of one string.
// directory-row.tsx imports it, which puts it in the client bundle as well,
// so it must stay free of Intl and of anything server-only — it is both.
//
// 📌 Calculated, never ticked: there is no control here and there never should
// be. The only way to change the verdict is attendance, an officer resolving a
// check-in, or the member's type.

export function EligibilityMark({ value }: { value: string | null }) {
  // A member with no row for the term in question — the member page's
  // off-roster case. Never another term's verdict standing in for this one.
  if (value === null) {
    return <span className="text-misa-muted">—</span>;
  }
  if (value === "yes") {
    return <Pill tone="affirm" fill>{formatProjectEligibility(value)}</Pill>;
  }
  if (value === "no") {
    return <Pill tone="critical" fill>{formatProjectEligibility(value)}</Pill>;
  }
  if (value === "not_applicable") {
    // Muted text, not a pill: N/A is not a fact about how the member is doing,
    // it is the absence of a question — the same treatment the events grid
    // gives an event that has not happened.
    return (
      <span className="text-sm text-misa-muted">
        {formatProjectEligibility(value)}
      </span>
    );
  }
  // A value this component has never heard of renders as ITSELF, never as a
  // blank — the rule pill.tsx states for statuses.
  return <Pill tone="neutral">{formatProjectEligibility(value)}</Pill>;
}
