import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { describeMatchReason, type MemberSuggestion } from "@/lib/attendance";

// Ranked suggestions for a payment nobody is credited with (§7 Stage 6.5 phase
// 3), modelled on the attendance resolution screen's MemberSuggestions.
//
// Presentational only, and deliberately inert: nothing here is a form control
// and nothing is preselected. The officer reads these, then picks in the editor
// below. "Don't auto-resolve near-misses" is easiest to break by accident with a
// stray defaultChecked, so there is nothing here to check.
//
// The ranking comes from lib/dues.ts's rankPaymentSuggestions, which is a new
// CALLER of the Stage 5 ranker rather than a second ranker — the weights and
// the score floor stay in one place.

export function PaymentSuggestions({
  suggestions,
  failed = false,
}: {
  suggestions: MemberSuggestion[];
  /** 🔓 The roster read failed. Never derived from `suggestions.length`. */
  failed?: boolean;
}) {
  if (failed) {
    return <ReadError what="the roster to suggest a member from" />;
  }
  if (suggestions.length === 0) {
    return (
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        Nothing on the roster looks like a close enough match to suggest. Read
        the note and the payer&apos;s name above and pick by hand below, or leave
        it queued — a weak guess here credits the wrong person&apos;s dues, and
        neither they nor the real payer has any reason to notice.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.member.id}
          className="border border-misa-border bg-misa-panel px-4 py-3"
        >
          <p className="text-sm">
            <strong>{suggestion.member.fullName}</strong>
            {!suggestion.member.active && (
              <span className="ml-2 text-xs text-misa-muted">inactive</span>
            )}
          </p>
          <p className="mt-1 font-mono text-xs">{suggestion.member.eid}</p>
          <p className="mt-1 text-xs text-misa-secondary">
            {suggestion.member.email}
          </p>
          <p className="mt-1 text-xs text-misa-muted">
            {suggestion.reasons
              .map(describeMatchReason)
              .filter(Boolean)
              .join(" · ")}
          </p>
        </li>
      ))}
    </ol>
  );
}
