// Check-in origin badge. Spec: docs/checkin-location-verification.md.
//
// 📌 Same shape as status-pill.tsx: the badge is components/ui/pill.tsx and
// what lives here is the thing genuinely about origins — the flag → tone
// mapping and the hover text.
//
// ⚠️ ADVISORY ONLY, and the tones say so. Nothing here is `critical`: this
// mechanism detects "submitted from a different network than most attendees,
// and not from a phone", which is a proxy for "not in the room" only when the
// venue's network is distinctive — and on a campus it is not. A red badge
// against a member's name would claim more than the data can carry. The
// strongest tone available is `caution`, which means "worth a glance".

import type { PillTone } from "@/components/ui/pill";
import { ORIGIN_FLAG_LABEL, type OriginFlag } from "@/lib/checkin-origin";
import { Pill } from "@/components/ui/pill";

function toneFor(flag: OriginFlag): PillTone {
  if (flag === "at_venue") return "affirm";
  if (flag === "off_network" || flag === "on_campus") return "caution";
  return "neutral";
}

/**
 * Why each badge says what it says, on hover.
 *
 * 🔓 The wording is a design constraint, not copy. None of these may assert
 * fraud, and `cellular` in particular has to explain that it is a deliberate
 * exemption rather than a gap — otherwise an officer reads it as "we could not
 * check this one" and treats it with suspicion, which is the exact outcome the
 * exemption exists to prevent.
 */
const EXPLANATION: Record<OriginFlag, string> = {
  off: "Origin checking is turned off for this event.",
  not_applicable:
    "Entered by an officer, so there was no check-in request to read an origin from.",
  no_venue:
    "Not enough check-ins came from one network to say which was the venue, so nothing is compared.",
  unknown: "No usable network origin was recorded for this check-in.",
  cellular:
    "Submitted over a mobile network. Being on cellular does not indicate absence, so this is never marked.",
  at_venue: "Matches the network most attendees checked in from.",
  on_campus:
    "University network, but not the one most attendees used. Only meaningful if the campus uses separate networks per building.",
  off_network:
    "Neither the network most attendees used nor a university one. Worth a look — not evidence about a person.",
};

/**
 * Renders nothing for `off`, `no_venue` or `not_applicable`.
 *
 * 🪤 Deliberate: a badge reading "not checked" against every row of an event
 * whose toggle is off is noise an officer has to learn to ignore, and an
 * officer who learns to ignore one badge learns to ignore the row of badges it
 * sits in. The event header says whether checking ran; the rows stay quiet.
 *
 * 📌 `not_applicable` is silent for a second reason: an officer-entered row is
 * ALREADY badged as officer entry elsewhere in /admin (see
 * ATTENDANCE_SOURCES in lib/attendance.ts and the queue's source badge), so
 * saying it again here would be the same fact twice in one row.
 */
export function OriginPill({ flag }: { flag: OriginFlag }) {
  if (flag === "off" || flag === "no_venue" || flag === "not_applicable") {
    return null;
  }
  return (
    <Pill tone={toneFor(flag)} size="sm" title={EXPLANATION[flag]}>
      {ORIGIN_FLAG_LABEL[flag]}
    </Pill>
  );
}
