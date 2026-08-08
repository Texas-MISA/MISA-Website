import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { fetchPresets } from "@/lib/member-presets";
import { parseMemberFilter } from "@/lib/filters";
import { presetSummary } from "@/lib/presets";
import { createAdminClient } from "@/lib/supabase/admin";

import { PresetRow } from "./_components/preset-row";

// Saved directory filters (§7 Stage 6 phase 7a) — rename and delete.
//
// Reached from the directory's chip row rather than the admin nav, for the same
// reason the custom-fields screen is: admin-nav.tsx marks an entry active with
// pathname.startsWith, so an entry here would light "Members" up alongside it.
//
// ⚠️ There is deliberately NO "update this view to the current filter" here.
// That operation needs a current filter to read, and this page has none — the
// control belongs on the directory, where it is the "Replace …" option on the
// one save form. Putting a second copy here would mean inventing a filter for it
// to point at, which is how the two screens would start disagreeing about what a
// preset holds.
//
// Any officer may rename or delete anyone's preset (§9 #6). They are shared by
// design: a gate would leave one person owning the team's saved views, which is
// the problem the feature exists to solve.

export const metadata: Metadata = { title: "Saved views" };

export default async function MemberPresetsPage() {
  await requireOfficer();

  const db = createAdminClient();
  const [presets, definitions, events] = await Promise.all([
    fetchPresets(db),
    fetchFieldDefinitions(db),
    fetchEventOptions(db),
  ]);

  const eventLabels = new Map(events.map((event) => [event.id, event.label]));

  // Each stored query is parsed exactly as the directory would parse it, so the
  // summary describes what the view will ACTUALLY narrow to rather than what it
  // narrowed to when it was saved. That is the whole value of showing one here:
  // a preset naming a since-archived custom field reads as a shorter list of
  // clauses, which is visible, instead of silently applying less than its name
  // promises.
  const rows = presets.map((preset) => {
    const parts = presetSummary(
      parseMemberFilter(
        Object.fromEntries(new URLSearchParams(preset.query)),
        definitions
      ),
      definitions,
      eventLabels
    );
    return { preset, parts };
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Saved views
      </h1>

      <p className="mt-3 text-sm">
        <Link href="/admin/members" className="underline">
          ← Back to the directory
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-foreground/70">
        Named filters, <span className="font-medium">shared by every officer</span>
        . Save a new one from the directory once you have narrowed the list; this
        page is for renaming and clearing out the ones nobody uses.
      </p>

      <div className="mt-10">
        {rows.length === 0 ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            No saved views yet. Filter the directory, then use{" "}
            <span className="font-medium">Save this view…</span> under the
            filters.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map(({ preset, parts }) => (
              <PresetRow
                key={preset.id}
                id={preset.id}
                name={preset.name}
                query={preset.query}
                // Joined on the server: this is display text, and the row is a
                // Client Component that has neither the definitions nor the
                // event labels the summary is built from.
                summary={parts.length > 0 ? parts.join(" · ") : "Everyone"}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
