import {
  Notice,
  ReadError,
} from "@/app/admin/(shell)/_components/notice";
import {
  describeGap,
  describeMatchReason,
  diffEid,
  type MemberSuggestion,
} from "@/lib/attendance";
import { formatEventRange } from "@/lib/events";

// Ranked suggestions for an unresolved submission (§7 Stage 5).
//
// Presentational only, and deliberately inert: nothing here is a form control
// and nothing is preselected. The officer reads these, then picks in the
// resolution form below. "Don't auto-resolve near-misses" is easiest to break
// by accident with a defaultChecked, so there is nothing here to check.

export type EventSuggestionView = {
  eventId: string;
  title: string;
  status: string;
  headline: string;
  eventRelative: string;
  range: string;
};

/** Build the view models. Ordering is whatever `nearby_events()` returned —
 * SQL owns the ranking, this only annotates it. */
export function buildEventSuggestions(
  nearby: { event_id: string; title: string; gap: string }[],
  windows: Map<
    string,
    {
      starts_at: string;
      ends_at: string;
      checkin_opens_at: string | null;
      checkin_closes_at: string | null;
      status: string;
    }
  >,
  submittedAt: string
): EventSuggestionView[] {
  return nearby.flatMap((row) => {
    const event = windows.get(row.event_id);
    if (!event) return [];
    const described = describeGap({ gap: row.gap, submittedAt, event });
    return [
      {
        eventId: row.event_id,
        title: row.title,
        status: event.status,
        headline: described.headline,
        eventRelative: described.eventRelative,
        range: formatEventRange(event.starts_at, event.ends_at),
      },
    ];
  });
}

export function EventSuggestions({
  suggestions,
  outsideWindow,
  failed = false,
}: {
  suggestions: EventSuggestionView[];
  outsideWindow: boolean;
  /** 🔓 The read failed. Distinct from "nothing nearby" — see below. */
  failed?: boolean;
}) {
  // ⚠️ `failed` is checked FIRST and is not derived from `suggestions.length`.
  // It used to be: the page passed `outsideWindow={suggestions.length === 0}`,
  // so a failed nearby_events RPC produced the sentence "That is normal for a
  // submission that has been waiting a while" — a broken query explained away
  // as expected behaviour, on the screen that decides whether someone is
  // credited for attending.
  if (failed) {
    return (
      <ReadError what="the suggested events" />
    );
  }
  if (suggestions.length === 0) {
    return (
      <Notice>
        {outsideWindow
          ? "No published event is within 48 hours of this submission, so there is nothing to suggest. That is normal for a submission that has been waiting a while — pick the event by hand below."
          : "No nearby published events. Pick the event by hand below."}
      </Notice>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.eventId}
          className="border border-black/20 bg-misa-panel px-4 py-3"
        >
          <p className="text-sm">
            {index === 0 && (
              <span className="mr-2 border border-black/30 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
                closest
              </span>
            )}
            <strong>{suggestion.title}</strong>
            {suggestion.status !== "published" && (
              <span className="ml-2 text-xs text-foreground/60">
                {suggestion.status}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-foreground/80">
            {/* Window-relative first: that is what refused the check-in. The
                event-relative number is what nearby_events ranked on. */}
            {suggestion.headline}{" "}
            <span className="text-foreground/60">
              ({suggestion.eventRelative})
            </span>
          </p>
          <p className="mt-1 text-xs text-foreground/60">{suggestion.range}</p>
        </li>
      ))}
    </ol>
  );
}

export function MemberSuggestions({
  suggestions,
  submittedEid,
  failed = false,
}: {
  suggestions: MemberSuggestion[];
  submittedEid: string;
  failed?: boolean;
}) {
  // A roster that was never read must not read as "nothing on the roster
  // looks like a match" — that is a confident claim about people.
  if (failed) {
    return <ReadError what="the roster to suggest a member from" />;
  }
  if (suggestions.length === 0) {
    return (
      <Notice>
        Nothing on the roster looks like a close enough match to suggest. Search
        for the member by hand below, or leave this unlinked — a weak guess here
        would be worse than none.
      </Notice>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {suggestions.map((suggestion) => {
        const diff = diffEid(
          submittedEid,
          suggestion.member.eid
        );
        return (
          <li
            key={suggestion.member.id}
            className="border border-black/20 bg-misa-panel px-4 py-3"
          >
            <p className="text-sm">
              <strong>{suggestion.member.fullName}</strong>
              {!suggestion.member.active && (
                <span className="ml-2 text-xs text-foreground/60">inactive</span>
              )}
            </p>
            <p className="mt-1 font-mono text-xs">
              <span className="text-foreground/60">submitted</span>{" "}
              {submittedEid}
              {" · "}
              <span className="text-foreground/60">roster</span>{" "}
              <NearMiss
                value={suggestion.member.eid}
                at={diff.firstDifferenceAt}
              />
            </p>
            <p className="mt-1 text-xs text-foreground/70">
              {suggestion.member.email}
            </p>
            <p className="mt-1 text-xs text-foreground/60">
              {suggestion.reasons
                .map(describeMatchReason)
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Highlights the first character that differs, so a one-digit typo is visible
 * rather than something the officer has to compare by eye. */
function NearMiss({ value, at }: { value: string; at: number | null }) {
  if (at === null || at >= value.length) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <mark className="bg-amber-200 px-0.5">{value[at]}</mark>
      {value.slice(at + 1)}
    </>
  );
}
